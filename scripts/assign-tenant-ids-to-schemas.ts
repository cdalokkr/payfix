/**
 * Controlled tenant profile ownership backfill.
 *
 * The default mode is a read-only audit. Pass --apply to fill only NULL
 * tenant_id values. A non-NULL value belonging to another tenant is a
 * conflict: it is never overwritten by this script.
 *
 * Examples:
 *   pnpm exec tsx scripts/assign-tenant-ids-to-schemas.ts
 *   pnpm exec tsx scripts/assign-tenant-ids-to-schemas.ts --apply --report reports/tenant-profile-backfill.json
 */
import './env-config';

import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { sql } from 'drizzle-orm';

import { centralDb } from '../lib/db/index';
import { masterDb } from '../lib/db/master-connection';
import { tenantOwnershipBackfillAudit } from '../lib/db/master-schema';
import { assertTenantSchemaName } from '../lib/tenant/schema-contract';

const UUID_PATTERN =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface TenantProfileBackfillOptions {
    apply?: boolean;
    reportPath?: string;
    tenantSlug?: string;
}

export interface TenantProfileConflict {
    profileId: string;
    email: string | null;
    currentTenantId: string;
    expectedTenantId: string;
}

export interface TenantProfileBackfillTenantReport {
    tenantId: string;
    slug: string;
    companyName: string;
    schemaName: string | null;
    databaseTarget: 'central' | 'custom';
    status: 'verified' | 'updated' | 'missing' | 'missing_schema' | 'missing_profiles' | 'missing_column' | 'conflicts' | 'error';
    totalProfiles: number;
    matchingProfiles: number;
    missingTenantId: number;
    conflictingProfiles: number;
    updatedProfiles: number;
    addedTenantIdColumn: boolean;
    conflicts: TenantProfileConflict[];
    error?: string;
}

export interface TenantProfileBackfillReport {
    startedAt: string;
    completedAt: string;
    mode: 'dry-run' | 'apply';
    tenantCount: number;
    verified: boolean;
    tenants: TenantProfileBackfillTenantReport[];
}

type TenantOwnershipAuditStatus = 'verified' | 'partial' | 'failed';

type Database = {
    execute: (query: any) => Promise<any[]>;
    transaction?: <T>(callback: (transaction: Database) => Promise<T>) => Promise<T>;
};

type TenantRecord = {
    id: string;
    slug: string;
    company_name: string;
    tenant_schema: string | null;
    database_url: string | null;
};

function numberValue(value: unknown): number {
    return Number(value || 0);
}

function auditStatus(report: TenantProfileBackfillTenantReport): TenantOwnershipAuditStatus {
    if (report.status === 'error'
        || report.status === 'missing_schema'
        || report.status === 'missing_profiles'
        || report.status === 'missing_column') {
        return 'failed';
    }

    if (report.status === 'conflicts' || report.status === 'missing') {
        return 'partial';
    }

    return 'verified';
}

function runAuditStatus(reports: TenantProfileBackfillTenantReport[]): TenantOwnershipAuditStatus {
    if (reports.some((report) => auditStatus(report) === 'failed')) {
        return 'failed';
    }
    if (reports.some((report) => auditStatus(report) === 'partial')) {
        return 'partial';
    }
    return 'verified';
}

async function persistApplyAudit(
    reports: TenantProfileBackfillTenantReport[],
    startedAt: string,
    completedAt: string,
): Promise<void> {
    if (reports.length === 0) {
        return;
    }

    const runId = randomUUID();
    const status = runAuditStatus(reports);
    await masterDb.insert(tenantOwnershipBackfillAudit).values(reports.map((report) => ({
        run_id: runId,
        tenant_id: report.tenantId,
        tenant_schema: report.schemaName,
        started_at: new Date(startedAt),
        completed_at: new Date(completedAt),
        mode: 'apply',
        status,
        total_profiles: report.totalProfiles,
        matching_profiles: report.matchingProfiles,
        missing_tenant_id: report.missingTenantId,
        conflicting_profiles: report.conflictingProfiles,
        updated_profiles: report.updatedProfiles,
        unresolved_conflict_count: report.conflictingProfiles,
    })));
}

function parseArgs(args: string[]): TenantProfileBackfillOptions {
    const options: TenantProfileBackfillOptions = { apply: false };

    for (let index = 0; index < args.length; index += 1) {
        const argument = args[index];
        if (argument === '--apply') {
            options.apply = true;
        } else if (argument === '--report' && args[index + 1]) {
            options.reportPath = args[++index];
        } else if (argument === '--tenant' && args[index + 1]) {
            options.tenantSlug = args[++index].toLowerCase();
        } else if (argument === '--help') {
            console.log([
                'Usage: tsx scripts/assign-tenant-ids-to-schemas.ts [--apply] [--tenant <slug>]',
                '       [--report <path>]',
                '',
                'Without --apply, this command is a read-only audit.',
                'Only NULL tenant_id values are repaired. Conflicting non-NULL values are reported.',
            ].join('\n'));
            process.exit(0);
        } else {
            throw new Error(`Unknown argument: ${argument}`);
        }
    }

    return options;
}

function emptyReport(tenant: TenantRecord, databaseTarget: 'central' | 'custom'): TenantProfileBackfillTenantReport {
    return {
        tenantId: tenant.id,
        slug: tenant.slug,
        companyName: tenant.company_name,
        schemaName: tenant.tenant_schema,
        databaseTarget,
        status: 'error',
        totalProfiles: 0,
        matchingProfiles: 0,
        missingTenantId: 0,
        conflictingProfiles: 0,
        updatedProfiles: 0,
        addedTenantIdColumn: false,
        conflicts: [],
    };
}

async function processTenant(
    database: Database,
    tenant: TenantRecord,
    options: TenantProfileBackfillOptions,
    databaseTarget: 'central' | 'custom',
): Promise<TenantProfileBackfillTenantReport> {
    const report = emptyReport(tenant, databaseTarget);
    const schemaName = tenant.tenant_schema;

    if (!schemaName) {
        report.error = 'Tenant has no registered tenant_schema; no workspace table was selected.';
        return report;
    }

    if (!UUID_PATTERN.test(tenant.id)) {
        report.error = 'Tenant registry ID is not a valid UUID.';
        return report;
    }

    try {
        assertTenantSchemaName(schemaName);
    } catch (error) {
        report.error = error instanceof Error ? error.message : String(error);
        return report;
    }

    const schemaCheck = await database.execute(sql`
        SELECT EXISTS (
            SELECT 1
            FROM information_schema.schemata
            WHERE schema_name = ${schemaName}
        ) AS exists
    `);
    if (!Boolean(schemaCheck[0]?.exists)) {
        report.status = 'missing_schema';
        report.error = `Registered tenant schema does not exist: ${schemaName}`;
        return report;
    }

    const tableCheck = await database.execute(sql`
        SELECT EXISTS (
            SELECT 1
            FROM information_schema.tables
            WHERE table_schema = ${schemaName}
              AND table_name = 'profiles'
              AND table_type = 'BASE TABLE'
        ) AS exists
    `);
    if (!Boolean(tableCheck[0]?.exists)) {
        report.status = 'missing_profiles';
        report.error = `Tenant profile table does not exist: ${schemaName}.profiles`;
        return report;
    }

    let tenantIdColumn = await database.execute(sql`
        SELECT data_type, udt_name
        FROM information_schema.columns
        WHERE table_schema = ${schemaName}
          AND table_name = 'profiles'
          AND column_name = 'tenant_id'
    `);

    if (tenantIdColumn.length === 0) {
        if (!options.apply) {
            report.status = 'missing_column';
            report.error = `${schemaName}.profiles.tenant_id is missing; rerun with --apply to add the UUID column and backfill NULL values.`;
            return report;
        }

        await database.execute(sql`
            ALTER TABLE ${sql.raw(schemaName)}.profiles
            ADD COLUMN IF NOT EXISTS tenant_id uuid
        `);
        report.addedTenantIdColumn = true;
        tenantIdColumn = await database.execute(sql`
            SELECT data_type, udt_name
            FROM information_schema.columns
            WHERE table_schema = ${schemaName}
              AND table_name = 'profiles'
              AND column_name = 'tenant_id'
        `);
    }

    if (tenantIdColumn[0]?.udt_name !== 'uuid') {
        report.status = 'error';
        report.error = `${schemaName}.profiles.tenant_id must be uuid, found ${tenantIdColumn[0]?.data_type || 'unknown'}.`;
        return report;
    }

    const counts = await database.execute(sql`
        SELECT
            COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE tenant_id = ${tenant.id}::uuid)::int AS matching,
            COUNT(*) FILTER (WHERE tenant_id IS NULL)::int AS missing,
            COUNT(*) FILTER (WHERE tenant_id IS NOT NULL AND tenant_id <> ${tenant.id}::uuid)::int AS conflicting
        FROM ${sql.raw(schemaName)}.profiles
    `);
    report.totalProfiles = numberValue(counts[0]?.total);
    report.matchingProfiles = numberValue(counts[0]?.matching);
    report.missingTenantId = numberValue(counts[0]?.missing);
    report.conflictingProfiles = numberValue(counts[0]?.conflicting);

    if (report.conflictingProfiles > 0) {
        const conflicts = await database.execute(sql`
            SELECT id::text AS profile_id, email, tenant_id::text AS current_tenant_id
            FROM ${sql.raw(schemaName)}.profiles
            WHERE tenant_id IS NOT NULL
              AND tenant_id <> ${tenant.id}::uuid
            ORDER BY id
        `);
        report.conflicts = conflicts.map((conflict: any) => ({
            profileId: String(conflict.profile_id),
            email: conflict.email ?? null,
            currentTenantId: String(conflict.current_tenant_id),
            expectedTenantId: tenant.id,
        }));
    }

    if (options.apply && report.missingTenantId > 0) {
        const updated: any = await database.execute(sql`
            UPDATE ${sql.raw(schemaName)}.profiles
            SET tenant_id = ${tenant.id}::uuid
            WHERE tenant_id IS NULL
        `);
        report.updatedProfiles = numberValue(updated.count);
    }

    const verification = await database.execute(sql`
        SELECT
            COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE tenant_id = ${tenant.id}::uuid)::int AS matching,
            COUNT(*) FILTER (WHERE tenant_id IS NULL)::int AS missing,
            COUNT(*) FILTER (WHERE tenant_id IS NOT NULL AND tenant_id <> ${tenant.id}::uuid)::int AS conflicting
        FROM ${sql.raw(schemaName)}.profiles
    `);
    report.totalProfiles = numberValue(verification[0]?.total);
    report.matchingProfiles = numberValue(verification[0]?.matching);
    report.missingTenantId = numberValue(verification[0]?.missing);
    report.conflictingProfiles = numberValue(verification[0]?.conflicting);

    if (report.conflictingProfiles > 0) {
        report.status = 'conflicts';
    } else if (report.missingTenantId > 0) {
        report.status = options.apply ? 'error' : 'missing';
        report.error = 'NULL tenant_id values remain because this was a dry-run.';
    } else {
        report.status = report.updatedProfiles > 0 ? 'updated' : 'verified';
    }

    return report;
}

async function databaseForTenant(tenant: TenantRecord): Promise<{
    database: Database;
    close: () => Promise<void>;
    target: 'central' | 'custom';
}> {
    if (!tenant.database_url) {
        return { database: centralDb as Database, close: async () => {}, target: 'central' };
    }

    const client = postgres(tenant.database_url, {
        prepare: false,
        max: 1,
        idle_timeout: 20,
        connect_timeout: 15,
    });
    return {
        database: drizzle(client) as unknown as Database,
        close: async () => client.end({ timeout: 5 }),
        target: 'custom',
    };
}

export async function runTenantProfileBackfill(
    options: TenantProfileBackfillOptions = {},
): Promise<TenantProfileBackfillReport> {
    const startedAt = new Date().toISOString();
    const registeredTenants = await masterDb.query.tenants.findMany();
    const selectedTenants = (registeredTenants as TenantRecord[])
        .filter((tenant) => !options.tenantSlug || tenant.slug.toLowerCase() === options.tenantSlug)
        .sort((left, right) => left.slug.localeCompare(right.slug));
    const tenantReports: TenantProfileBackfillTenantReport[] = [];

    for (const tenant of selectedTenants) {
        let database: Awaited<ReturnType<typeof databaseForTenant>> | undefined;
        try {
            const currentDatabase = await databaseForTenant(tenant);
            database = currentDatabase;
            const run = () => processTenant(currentDatabase.database, tenant, options, currentDatabase.target);
            const report = options.apply && currentDatabase.database.transaction
                ? await currentDatabase.database.transaction(run)
                : await run();
            tenantReports.push(report);
        } catch (error) {
            const report = emptyReport(tenant, database?.target || (tenant.database_url ? 'custom' : 'central'));
            const cause = error instanceof Error && error.cause instanceof Error
                ? ` (${error.cause.message})`
                : '';
            report.error = `${error instanceof Error ? error.message : String(error)}${cause}`;
            tenantReports.push(report);
        } finally {
            await database?.close();
        }
    }

    const report: TenantProfileBackfillReport = {
        startedAt,
        completedAt: new Date().toISOString(),
        mode: options.apply ? 'apply' : 'dry-run',
        tenantCount: selectedTenants.length,
        verified: tenantReports.length === selectedTenants.length
            && tenantReports.every((tenant) =>
                (tenant.status === 'verified' || tenant.status === 'updated')
                && tenant.missingTenantId === 0
                && tenant.conflictingProfiles === 0
                && !tenant.error
            ),
        tenants: tenantReports,
    };

    if (options.apply) {
        await persistApplyAudit(report.tenants, report.startedAt, report.completedAt);
    }

    if (options.reportPath) {
        const reportPath = resolve(options.reportPath);
        await mkdir(dirname(reportPath), { recursive: true });
        await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    }

    return report;
}

export async function main(args = process.argv.slice(2)): Promise<void> {
    const options = parseArgs(args);
    const report = await runTenantProfileBackfill(options);
    console.log(JSON.stringify(report, null, 2));
    // The central database client is a process-level singleton. Exit
    // explicitly so a completed audit does not wait for its idle pool.
    process.exit(report.verified ? 0 : 1);
}

if (process.argv[1]?.endsWith('assign-tenant-ids-to-schemas.ts')) {
    main().catch((error) => {
        console.error('[tenant-profile-backfill] Failed:', error instanceof Error ? error.message : String(error));
        process.exitCode = 1;
    });
}
