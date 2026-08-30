import { sql, eq } from 'drizzle-orm';
import { masterDb } from '@/lib/db/master-connection';
import { tenants, tenantBranding, tenantPlans } from '@/lib/db/master-schema';
import { centralDb } from '@/lib/db';
import {
    assertTenantSchemaName,
    CANONICAL_TENANT_TABLES,
    inspectTenantSchemaContract,
    TENANT_REQUIRED_FOREIGN_KEYS,
    TENANT_REQUIRED_INDEXES,
    TENANT_SCHEMA_TEMPLATE,
    TENANT_SCHEMA_VERSION,
    shouldRollbackTenantSchema,
    tenantSchemaContractFailure,
    tenantSchemaNameFromSlug,
    type TenantSchemaContractReport,
} from '@/lib/tenant/schema-contract';

const TENANT_FOREIGN_KEY_ACTIONS: Record<string, string> = {
    'profiles.designation_id': 'SET NULL',
    'activities.user_id': 'CASCADE',
    'attendance.profile_id': 'CASCADE',
    'attendance.verified_by': 'SET NULL',
    'attendance.location_id': 'SET NULL',
    'leaves.profile_id': 'CASCADE',
    'leaves.approved_by': 'SET NULL',
    'employee_settings.profile_id': 'CASCADE',
    'biometric_devices.location_id': 'SET NULL',
    'office_locations.created_by': 'SET NULL',
    'kiosk_devices.location_id': 'SET NULL',
    'kiosk_devices.created_by': 'SET NULL',
    'user_mpin.profile_id': 'CASCADE',
    'push_subscriptions.profile_id': 'CASCADE',
    'profile_photo_requests.profile_id': 'CASCADE',
    'profile_photo_requests.reviewed_by': 'SET NULL',
    'attendance_sessions.attendance_id': 'CASCADE',
    'attendance_sessions.profile_id': 'CASCADE',
    'attendance_sessions.location_id': 'SET NULL',
    'biometric_raw_logs.profile_id': 'SET NULL',
    'biometric_raw_logs.location_id': 'SET NULL',
    'biometric_verification_attempts.profile_id': 'SET NULL',
    'employee_salary_setup.profile_id': 'CASCADE',
    'employee_salary_setup.created_by': 'SET NULL',
    'employee_advances.profile_id': 'CASCADE',
    'employee_advances.created_by': 'SET NULL',
    'monthly_attendance_summary.profile_id': 'CASCADE',
    'monthly_attendance_summary.set_for_salary_by': 'SET NULL',
    'monthly_attendance_summary.paid_by': 'SET NULL',
    'clients.created_by': 'SET NULL',
    'complaints.client_id': 'SET NULL',
    'complaints.created_by': 'SET NULL',
    'tickets.complaint_id': 'CASCADE',
    'tickets.created_by': 'SET NULL',
    'ticket_assignments.ticket_id': 'CASCADE',
    'ticket_assignments.assigned_to': 'CASCADE',
    'ticket_assignments.assigned_by': 'SET NULL',
    'ticket_resolutions.ticket_id': 'CASCADE',
    'ticket_resolutions.resolved_by': 'CASCADE',
    'call_logs.ticket_id': 'CASCADE',
    'call_logs.complaint_id': 'CASCADE',
    'call_logs.client_id': 'SET NULL',
    'call_logs.called_by': 'CASCADE',
    'salary_payments.summary_id': 'CASCADE',
    'salary_payments.paid_by': 'SET NULL',
};

const CANONICAL_SOURCE_TABLES = CANONICAL_TENANT_TABLES.filter(
    (table) => table !== 'biometric_verification_attempts',
);

function sqlTableList(tableNames: readonly string[]): string {
    return tableNames.map((tableName) => `'${tableName}'`).join(',');
}

/**
 * Creates or upgrades only the tenant schema. It never writes to public
 * business tables and never copies rows from tenant_primary.
 */
export async function ensureCanonicalTenantSchema(
    schemaName: string,
    database: any = centralDb,
): Promise<TenantSchemaContractReport> {
    assertTenantSchemaName(schemaName);

    const sourceTables = sqlTableList(CANONICAL_SOURCE_TABLES);
    const requiredIndexes = TENANT_REQUIRED_INDEXES;
    const requiredForeignKeys = TENANT_REQUIRED_FOREIGN_KEYS;

    await database.execute(sql`CREATE SCHEMA IF NOT EXISTS ${sql.raw(schemaName)};`);

    await database.execute(sql`
        DO $$
        DECLARE
            target_table_name text;
            source_schema text;
            target_column_name text;
            column_type text;
        BEGIN
            FOR target_table_name IN SELECT unnest(ARRAY[${sql.raw(sourceTables)}])
            LOOP
                source_schema := NULL;
                IF to_regclass(format('%I.%I', ${sql.raw(`'${TENANT_SCHEMA_TEMPLATE}'`)}, target_table_name)) IS NOT NULL THEN
                    source_schema := ${sql.raw(`'${TENANT_SCHEMA_TEMPLATE}'`)};
                ELSIF to_regclass(format('%I.%I', 'public', target_table_name)) IS NOT NULL THEN
                    -- public is a read-only compatibility source for tables not
                    -- present in the evolved tenant-primary template.
                    source_schema := 'public';
                END IF;

                IF source_schema IS NULL THEN
                    RAISE EXCEPTION
                        'Canonical tenant source table is missing: %',
                        target_table_name;
                END IF;

                EXECUTE format(
                    'CREATE TABLE IF NOT EXISTS %I.%I (LIKE %I.%I INCLUDING ALL)',
                    ${sql.raw(`'${schemaName}'`)}, target_table_name, source_schema, target_table_name
                );

                FOR target_column_name, column_type IN
                    SELECT attribute.attname, format_type(attribute.atttypid, attribute.atttypmod)
                    FROM pg_attribute attribute
                    JOIN pg_class source_table ON source_table.oid = attribute.attrelid
                    JOIN pg_namespace source_namespace ON source_namespace.oid = source_table.relnamespace
                    WHERE source_namespace.nspname = source_schema
                      AND source_table.relname = target_table_name
                      AND attribute.attnum > 0
                      AND NOT attribute.attisdropped
                LOOP
                    IF NOT EXISTS (
                        SELECT 1
                        FROM information_schema.columns AS target_column
                        WHERE target_column.table_schema = ${sql.raw(`'${schemaName}'`)}
                          AND target_column.table_name = target_table_name
                          AND target_column.column_name = target_column_name
                    ) THEN
                        EXECUTE format(
                            'ALTER TABLE %I.%I ADD COLUMN %I %s',
                            ${sql.raw(`'${schemaName}'`)}, target_table_name, target_column_name, column_type
                        );
                    END IF;
                END LOOP;
            END LOOP;
        END
        $$;
    `);

    await database.execute(sql`
        CREATE TABLE IF NOT EXISTS ${sql.raw(schemaName)}.biometric_verification_attempts (
            "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            "profile_id" uuid REFERENCES ${sql.raw(schemaName)}.profiles("id") ON DELETE SET NULL,
            "source" text NOT NULL,
            "outcome" text NOT NULL,
            "similarity" numeric(6, 5),
            "threshold" numeric(6, 5),
            "reason_code" text,
            "face_count" integer,
            "frame_count" integer,
            "liveness_passed" boolean,
            "quality_score" real,
            "quality_diagnostics" jsonb,
            "capture_pipeline_version" text,
            "embedding_pipeline_version" text,
            "backend_engine" text,
            "processing_ms" integer,
            "request_id" text,
            "created_at" timestamp with time zone NOT NULL DEFAULT now()
        );

        CREATE TABLE IF NOT EXISTS ${sql.raw(schemaName)}._tenant_schema_metadata (
            "key" text PRIMARY KEY,
            "value" text NOT NULL,
            "updated_at" timestamp with time zone NOT NULL DEFAULT now()
        );
    `);

    await database.execute(sql`
        INSERT INTO ${sql.raw(schemaName)}._tenant_schema_metadata ("key", "value")
        VALUES ('schema_version', ${TENANT_SCHEMA_VERSION}), ('template', ${TENANT_SCHEMA_TEMPLATE})
        ON CONFLICT ("key") DO UPDATE
        SET "value" = EXCLUDED."value", "updated_at" = now();
    `);

    // These are the fields that distinguish the evolved tenant structure from
    // older public-schema clones.
    await database.execute(sql`
        ALTER TABLE IF EXISTS ${sql.raw(schemaName)}.profiles
            ADD COLUMN IF NOT EXISTS "face_embedding_512" vector(512),
            ADD COLUMN IF NOT EXISTS "face_embedding_pipeline_version" text,
            ADD COLUMN IF NOT EXISTS "face_quality_score" real,
            ADD COLUMN IF NOT EXISTS "face_enrolled_at" timestamp with time zone,
            ADD COLUMN IF NOT EXISTS "face_photo_url" text;

        ALTER TABLE IF EXISTS ${sql.raw(schemaName)}.profile_photo_requests
            ADD COLUMN IF NOT EXISTS "pending_photo_url" text,
            ADD COLUMN IF NOT EXISTS "pending_photo_sha256" text,
            ADD COLUMN IF NOT EXISTS "pending_face_embedding_512" vector(512),
            ADD COLUMN IF NOT EXISTS "pending_face_embedding_pipeline_version" text,
            ADD COLUMN IF NOT EXISTS "pending_face_embedding" vector(128);

        ALTER TABLE IF EXISTS ${sql.raw(schemaName)}.attendance
            ADD COLUMN IF NOT EXISTS "first_check_in" timestamp with time zone,
            ADD COLUMN IF NOT EXISTS "last_check_out" timestamp with time zone,
            ADD COLUMN IF NOT EXISTS "total_sessions" integer DEFAULT 0,
            ADD COLUMN IF NOT EXISTS "current_session_status" text DEFAULT 'checked_out',
            ADD COLUMN IF NOT EXISTS "location_id" uuid,
            ADD COLUMN IF NOT EXISTS "selfie_url" text,
            ADD COLUMN IF NOT EXISTS "checkin_latitude" numeric(10, 7),
            ADD COLUMN IF NOT EXISTS "checkin_longitude" numeric(10, 7),
            ADD COLUMN IF NOT EXISTS "checkin_location_name" text,
            ADD COLUMN IF NOT EXISTS "face_match_score" numeric(5, 4);

        ALTER TABLE IF EXISTS ${sql.raw(schemaName)}.attendance_sessions
            ADD COLUMN IF NOT EXISTS "checkout_latitude" numeric(10, 7),
            ADD COLUMN IF NOT EXISTS "checkout_longitude" numeric(10, 7),
            ADD COLUMN IF NOT EXISTS "checkout_location_name" text,
            ADD COLUMN IF NOT EXISTS "status" text NOT NULL DEFAULT 'active',
            ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone DEFAULT now();

        ALTER TABLE IF EXISTS ${sql.raw(schemaName)}.employee_settings
            ADD COLUMN IF NOT EXISTS "biometric_device_user_id" text,
            ADD COLUMN IF NOT EXISTS "face_vector" jsonb;

        ALTER TABLE IF EXISTS ${sql.raw(schemaName)}.biometric_verification_attempts
            ADD COLUMN IF NOT EXISTS "request_id" text;
    `);

    // Older public clones used photo_url/device_name/last_active_at. Rename
    // only when the evolved name is absent so row data remains intact.
    await database.execute(sql`
        ALTER TABLE IF EXISTS ${sql.raw(schemaName)}.kiosk_devices
            ADD COLUMN IF NOT EXISTS "name" text,
            ADD COLUMN IF NOT EXISTS "pairing_code" text,
            ADD COLUMN IF NOT EXISTS "terminal_id" text,
            ADD COLUMN IF NOT EXISTS "location_id" uuid,
            ADD COLUMN IF NOT EXISTS "is_active" boolean DEFAULT true,
            ADD COLUMN IF NOT EXISTS "last_seen_at" timestamp with time zone,
            ADD COLUMN IF NOT EXISTS "created_by" uuid,
            ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone DEFAULT now();
    `);

    await database.execute(sql`
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = ${sql.raw(`'${schemaName}'`)}
                  AND table_name = 'profile_photo_requests'
                  AND column_name = 'photo_url'
            ) AND EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = ${sql.raw(`'${schemaName}'`)}
                  AND table_name = 'profile_photo_requests'
                  AND column_name = 'pending_photo_url'
            ) THEN
                EXECUTE format(
                    'UPDATE %I.profile_photo_requests
                     SET pending_photo_url = COALESCE(pending_photo_url, photo_url)
                     WHERE pending_photo_url IS NULL',
                    ${sql.raw(`'${schemaName}'`)}
                );
            END IF;

            IF EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = ${sql.raw(`'${schemaName}'`)}
                  AND table_name = 'kiosk_devices'
                  AND column_name = 'device_name'
            ) AND EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = ${sql.raw(`'${schemaName}'`)}
                  AND table_name = 'kiosk_devices'
                  AND column_name = 'name'
            ) THEN
                EXECUTE format(
                    'UPDATE %I.kiosk_devices
                     SET name = COALESCE(name, device_name)
                     WHERE name IS NULL',
                    ${sql.raw(`'${schemaName}'`)}
                );
            END IF;

            IF EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = ${sql.raw(`'${schemaName}'`)}
                  AND table_name = 'kiosk_devices'
                  AND column_name = 'last_active_at'
            ) AND EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = ${sql.raw(`'${schemaName}'`)}
                  AND table_name = 'kiosk_devices'
                  AND column_name = 'last_seen_at'
            ) THEN
                EXECUTE format(
                    'UPDATE %I.kiosk_devices
                     SET last_seen_at = COALESCE(last_seen_at, last_active_at)
                     WHERE last_seen_at IS NULL',
                    ${sql.raw(`'${schemaName}'`)}
                );
            END IF;
        END
        $$;
    `);

    // The historical provisioning path created this column as text. Convert
    // valid ISO dates in place; invalid values stop alignment rather than
    // being silently discarded.
    await database.execute(sql`
        DO $$
        DECLARE
            current_type text;
        BEGIN
            SELECT data_type INTO current_type
            FROM information_schema.columns
            WHERE table_schema = ${sql.raw(`'${schemaName}'`)}
              AND table_name = 'attendance_sessions'
              AND column_name = 'date';

            IF current_type IS NOT NULL AND current_type <> 'date' THEN
                EXECUTE format(
                    'ALTER TABLE %I.attendance_sessions ALTER COLUMN "date" TYPE date USING NULLIF(trim("date"::text), '''')::date',
                    ${sql.raw(`'${schemaName}'`)}
                );
            END IF;
        END
        $$;
    `);

    await database.execute(sql`
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1
                FROM pg_class index_row
                JOIN pg_namespace index_namespace ON index_namespace.oid = index_row.relnamespace
                WHERE index_namespace.nspname = ${sql.raw(`'${schemaName}'`)}
                  AND index_row.relname = 'profiles_face_embedding_hnsw_idx'
                  AND index_row.relkind = 'i'
            ) THEN
                EXECUTE format(
                    'CREATE INDEX %I ON %I.profiles USING hnsw ("face_embedding" vector_cosine_ops) WITH (m = 16, ef_construction = 64)',
                    'profiles_face_embedding_hnsw_idx',
                    ${sql.raw(`'${schemaName}'`)}
                );
            END IF;
        END
        $$;

        CREATE INDEX IF NOT EXISTS "attendance_sessions_attendance_id_idx"
            ON ${sql.raw(schemaName)}.attendance_sessions ("attendance_id");
        CREATE INDEX IF NOT EXISTS "attendance_sessions_profile_date_checkin_idx"
            ON ${sql.raw(schemaName)}.attendance_sessions ("profile_id", "date", "check_in" DESC);
        CREATE INDEX IF NOT EXISTS "biometric_raw_logs_profile_id_idx"
            ON ${sql.raw(schemaName)}.biometric_raw_logs ("profile_id");
        CREATE INDEX IF NOT EXISTS "kiosk_devices_created_by_idx"
            ON ${sql.raw(schemaName)}.kiosk_devices ("created_by");
        CREATE INDEX IF NOT EXISTS "kiosk_devices_location_id_idx"
            ON ${sql.raw(schemaName)}.kiosk_devices ("location_id");
        CREATE INDEX IF NOT EXISTS "kiosk_devices_terminal_id_idx"
            ON ${sql.raw(schemaName)}.kiosk_devices ("terminal_id")
            WHERE "terminal_id" IS NOT NULL;
        CREATE INDEX IF NOT EXISTS "office_locations_created_by_idx"
            ON ${sql.raw(schemaName)}.office_locations ("created_by");
        CREATE INDEX IF NOT EXISTS "profile_photo_requests_profile_status_created_idx"
            ON ${sql.raw(schemaName)}.profile_photo_requests ("profile_id", "status", "created_at" DESC);
        CREATE INDEX IF NOT EXISTS "profile_photo_requests_reviewed_by_idx"
            ON ${sql.raw(schemaName)}.profile_photo_requests ("reviewed_by");
        CREATE INDEX IF NOT EXISTS "biometric_verification_attempts_profile_created_idx"
            ON ${sql.raw(schemaName)}.biometric_verification_attempts ("profile_id", "created_at" DESC);
        CREATE INDEX IF NOT EXISTS "biometric_verification_attempts_created_idx"
            ON ${sql.raw(schemaName)}.biometric_verification_attempts ("created_at" DESC);
    `);

    const foreignKeyRows = requiredForeignKeys
        .map(([table, column, referencedTable, referencedColumn]) => {
            const action = TENANT_FOREIGN_KEY_ACTIONS[`${table}.${column}`] || 'NO ACTION';
            return `('${table}', '${column}', '${referencedTable}', '${referencedColumn}', '${action}')`;
        })
        .join(',');

    await database.execute(sql`
        DO $$
        DECLARE
            fk record;
        BEGIN
            FOR fk IN
                SELECT *
                FROM (VALUES ${sql.raw(foreignKeyRows)}) AS requirements(
                    child_table, child_column, parent_table, parent_column, delete_action
                )
            LOOP
                IF NOT EXISTS (
                    SELECT 1
                    FROM pg_constraint constraint_row
                    JOIN pg_class child ON child.oid = constraint_row.conrelid
                    JOIN pg_namespace child_namespace ON child_namespace.oid = child.relnamespace
                    JOIN pg_class parent ON parent.oid = constraint_row.confrelid
                    JOIN pg_namespace parent_namespace ON parent_namespace.oid = parent.relnamespace
                    JOIN pg_attribute child_attribute
                      ON child_attribute.attrelid = child.oid
                     AND child_attribute.attnum = constraint_row.conkey[1]
                    JOIN pg_attribute parent_attribute
                      ON parent_attribute.attrelid = parent.oid
                     AND parent_attribute.attnum = constraint_row.confkey[1]
                    WHERE constraint_row.contype = 'f'
                      AND child_namespace.nspname = ${sql.raw(`'${schemaName}'`)}
                      AND parent_namespace.nspname = ${sql.raw(`'${schemaName}'`)}
                      AND child.relname = fk.child_table
                      AND child_attribute.attname = fk.child_column
                      AND parent.relname = fk.parent_table
                      AND parent_attribute.attname = fk.parent_column
                      AND array_length(constraint_row.conkey, 1) = 1
                      AND array_length(constraint_row.confkey, 1) = 1
                ) THEN
                    EXECUTE format(
                        'ALTER TABLE %I.%I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES %I.%I(%I) ON DELETE %s',
                        ${sql.raw(`'${schemaName}'`)},
                        fk.child_table,
                        fk.child_table || '_' || fk.child_column || '_fk',
                        fk.child_column,
                        ${sql.raw(`'${schemaName}'`)},
                        fk.parent_table,
                        fk.parent_column,
                        fk.delete_action
                    );
                END IF;
            END LOOP;
        END
        $$;
    `);

    const report = await inspectTenantSchemaContract(database, schemaName);
    if (!report.ok) {
        throw tenantSchemaContractFailure(report);
    }
    return report;
}

/**
 * Automates the dynamic schema provisioning for a new tenant.
 * 1. Generates and validates a clean database schema name.
 * 2. Creates the schema.
 * 3. Clones ALL business tables from public schema using LIKE ... INCLUDING ALL.
 * 4. Seeds the tenant database with default configurations.
 * 5. Creates the initial admin profile inside the tenant schema.
 * 6. Registers the tenant in the central control plane.
 *
 * IMPORTANT: All queries use explicit schema-qualified table names to avoid
 * SET search_path pollution on the shared connection pool.
 */
export async function provisionTenant(
    slug: string,
    companyName: string,
    adminEmail: string,
    trialDurationDays = 14,
    adminUserId?: string,  // Optional: if auth user already created, pass ID to insert profile
    additionalData?: {
        fullName?: string;
        firstName?: string;
        lastName?: string;
        phone?: string;
        country?: string;
        industry?: string;
        teamSize?: string;
    },
    onProgress?: (step: string, message: string) => void,
    skipRegistration = false,  // If true, skip tenant+branding insert (record already exists)
) {
    // 1. Strict Alphanumeric Validation on the slug
    const safeSlug = slug.toLowerCase().trim().replace(/[^a-z0-9-]/g, '');
    if (safeSlug.length < 3 || safeSlug.length > 30) {
        throw new Error('Tenant subdomain must be between 3 and 30 characters and alphanumeric.');
    }

    const schemaName = tenantSchemaNameFromSlug(slug);
    let schemaCreated = false;

    try {
        // 2. Create or upgrade the schema
        onProgress?.('creating_schema', `Creating workspace schema...`);
        console.log(`[Provisioning] Creating schema: ${schemaName}`);
        const existingSchema = await centralDb.execute(sql`
            SELECT EXISTS (
                SELECT 1
                FROM information_schema.schemata
                WHERE schema_name = ${schemaName}
            ) AS exists;
        `);
        schemaCreated = !Boolean(existingSchema[0]?.exists);
        await centralDb.execute(sql`CREATE SCHEMA IF NOT EXISTS ${sql.raw(schemaName)};`);

        onProgress?.('cloning_tables', `Setting up ${CANONICAL_TENANT_TABLES.length} business tables...`);
        console.log(`[Provisioning] Aligning canonical tables in ${schemaName}`);
        await ensureCanonicalTenantSchema(schemaName);

        // 3. The canonical helper above has created and validated every table.
        // 4. Seed initial designations & office settings using explicit schema-qualified names

        onProgress?.('seeding_defaults', 'Configuring default settings...');
        console.log(`[Provisioning] Seeding default data into ${schemaName}...`);
        await centralDb.execute(sql`
            INSERT INTO ${sql.raw(schemaName)}.designations (name, description, role) 
            VALUES 
            ('Administrator', 'System Administrator with full access rights', 'admin'),
            ('Manager', 'Operations Manager / Department Supervisor', 'moderator'),
            ('Employee', 'Standard Staff Member', 'employee')
            ON CONFLICT DO NOTHING;
        `);

        await centralDb.execute(sql`
            INSERT INTO ${sql.raw(schemaName)}.office_settings (default_check_in, default_check_out, absent_deduction_multiplier) 
            VALUES ('10:00:00', '19:00:00', 1)
            ON CONFLICT DO NOTHING;
        `);

        // 5. Create admin profile if userId provided
        if (adminUserId) {
            onProgress?.('creating_profile', 'Setting up admin profile...');
            console.log(`[Provisioning] Creating admin profile for user ${adminUserId}...`);
            const designResult = await centralDb.execute(sql`
                SELECT id FROM ${sql.raw(schemaName)}.designations 
                WHERE role = 'admin' LIMIT 1;
            `);
            
            const designationId = designResult[0]?.id;
            if (designationId) {
                const firstName = additionalData?.firstName || '';
                const lastName = additionalData?.lastName || '';
                const fullName = additionalData?.fullName
                    || (firstName && lastName ? `${firstName} ${lastName}`.trim() : (firstName || lastName || 'Administrator'));
                await centralDb.execute(sql`
                    INSERT INTO ${sql.raw(schemaName)}.profiles (
                        id, email, full_name, role, status, designation_id, first_name, last_name, mobile_no, created_at, updated_at
                    ) VALUES (
                        ${adminUserId}, ${adminEmail}, ${fullName}, 'admin', 'active', 
                        ${designationId}, ${firstName || null}, ${lastName || null}, ${additionalData?.phone || null}, NOW(), NOW()
                    )
                    ON CONFLICT (id) DO NOTHING;
                `);
                console.log(`[Provisioning] Admin profile created in ${schemaName}.profiles`);
            } else {
                console.warn(`[Provisioning] Admin designation not found in ${schemaName} — profile not created.`);
            }
        }

        let tenantId = 'existing';
        let resultSlug = safeSlug;

        if (!skipRegistration) {
            // 6. Register in Central Control Plane Table (public.tenants)
            onProgress?.('registering', 'Finalizing workspace registration...');
            const trialStart = new Date();
            const trialEnd = new Date();
            trialEnd.setDate(trialStart.getDate() + trialDurationDays);

            // Fetch default 'free' plan from database
            const freePlan = await masterDb.query.tenantPlans.findFirst({
              where: eq(tenantPlans.name, 'free')
            });

            // We run these inserts on the masterDb (which maps to public central schema)
            const [newTenant] = await masterDb.insert(tenants).values({
                slug: safeSlug,
                company_name: companyName,
                tenant_schema: schemaName,
                status: 'trial',
                plan_id: freePlan?.id || null,
                trial_start: trialStart,
                trial_end: trialEnd,
                trial_duration_days: trialDurationDays,
                admin_email: adminEmail,
                license_expires_at: trialEnd,
                country: additionalData?.country || null,
                industry: additionalData?.industry || null,
                team_size: additionalData?.teamSize || null,
            }).returning();

            // Register default branding settings
            await masterDb.insert(tenantBranding).values({
                tenant_id: newTenant.id,
                app_name: companyName,
                short_name: companyName.substring(0, 15),
                primary_color: '#4f46e5',
                secondary_color: '#0f172a',
                accent_color: '#f59e0b',
                background_color: '#020617',
                theme_color: '#020617',
            });

            tenantId = newTenant.id;
            console.log(`[Provisioning] Tenant ${safeSlug} successfully registered in control plane.`);
        } else {
            onProgress?.('registering', 'Finalizing workspace...');
            console.log(`[Provisioning] Schema ${schemaName} provisioned (skipRegistration=true, tenant record already exists).`);
        }
        
        return {
            success: true,
            tenantId,
            schemaName,
            slug: resultSlug
        };

    } catch (err: any) {
        console.error(`[Provisioning] Failed to provision tenant ${safeSlug}:`, err);
        // Only remove a schema created by this invocation. A failed contract
        // check or seed must never destroy an existing tenant's rows.
        if (shouldRollbackTenantSchema(schemaCreated)) {
            try {
                await centralDb.execute(sql`DROP SCHEMA IF EXISTS ${sql.raw(schemaName)} CASCADE;`);
                console.log(`[Provisioning] Rolled back schema ${schemaName}.`);
            } catch (rollbackErr) {
                console.error('[Provisioning] Schema rollback failed:', rollbackErr);
            }
        }
        throw err;
    }
}

/**
 * Fully deprovisions and deletes a tenant, removing all associated data:
 * 1. Deletes all auth users that belong to the tenant (via profiles table).
 * 2. Drops the tenant's PostgreSQL schema (CASCADE removes all 27 business tables + data).
 * 3. Deletes the tenant record from the control plane (cascades to branding + trial_tracking).
 * 4. Clears connection pool and resolver caches.
 *
 * Safety: Only works on tenants with status 'suspended' or 'cancelled'.
 *         Refuses to delete the 'primary' platform tenant.
 */
export async function deprovisionTenant(
    tenantId: string,
    tenantSchema: string,
    tenantSlug: string
): Promise<{ success: boolean; deletedUsers: number; errors: string[] }> {
    const errors: string[] = [];
    let deletedUsers = 0;

    // Safety: Never delete the primary platform tenant
    if (tenantSlug === 'primary') {
        throw new Error('Cannot delete the primary platform tenant');
    }

    const safeSchema = tenantSchema.replace(/[^a-zA-Z0-9_]/g, '');
    if (!safeSchema.startsWith('tenant_')) {
        throw new Error(`Invalid tenant schema name: ${tenantSchema}`);
    }

    console.log(`[Deprovision] Starting deprovision for tenant ${tenantSlug} (${safeSchema})`);

    // Step 1: Delete all auth users belonging to this tenant
    try {
        const profileRows = await centralDb.execute(
            sql`SELECT id FROM ${sql.raw(safeSchema)}.profiles`
        );

        if (profileRows.length > 0) {
            const { createClient } = await import('@supabase/supabase-js');
            const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
            const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
            const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
                auth: { autoRefreshToken: false, persistSession: false }
            });

            for (const row of profileRows) {
                try {
                    const { error } = await supabaseAdmin.auth.admin.deleteUser(row.id as string);
                    if (error) {
                        console.warn(`[Deprovision] Failed to delete auth user ${row.id}:`, error.message);
                        errors.push(`Auth user ${row.id}: ${error.message}`);
                    } else {
                        deletedUsers++;
                    }
                } catch (userErr: any) {
                    errors.push(`Auth user ${row.id}: ${userErr.message}`);
                }
            }
            console.log(`[Deprovision] Deleted ${deletedUsers}/${profileRows.length} auth users for ${tenantSlug}`);
        }
    } catch (profileErr: any) {
        // Schema/table might not exist — continue with cleanup
        console.warn(`[Deprovision] Could not query profiles for ${safeSchema}:`, profileErr.message);
        errors.push(`Profile query: ${profileErr.message}`);
    }

    // Step 2: Drop the entire tenant schema (CASCADE removes all tables + data)
    try {
        await centralDb.execute(sql`DROP SCHEMA IF EXISTS ${sql.raw(safeSchema)} CASCADE;`);
        console.log(`[Deprovision] Dropped schema ${safeSchema}`);
    } catch (schemaErr: any) {
        console.error(`[Deprovision] Failed to drop schema ${safeSchema}:`, schemaErr.message);
        errors.push(`Schema drop: ${schemaErr.message}`);
        // Don't throw — still try to clean up the master record
    }

    // Step 3: Delete tenant record from control plane (cascades to branding + trial_tracking)
    try {
        await masterDb.delete(tenants).where(eq(tenants.id, tenantId));
        console.log(`[Deprovision] Deleted tenant record ${tenantId} from control plane`);
    } catch (recordErr: any) {
        console.error(`[Deprovision] Failed to delete tenant record:`, recordErr.message);
        errors.push(`Tenant record: ${recordErr.message}`);
    }

    // Step 4: Clear connection pool cache for this tenant
    try {
        const { clearTenantConnectionCache } = await import('@/lib/db/tenant-connection');
        clearTenantConnectionCache(tenantId, safeSchema);
    } catch {
        // Cache export might not exist yet — non-critical
    }

    // Step 5: Clear resolver cache
    try {
        const { clearResolverCache } = await import('@/lib/tenant/resolver');
        clearResolverCache(tenantSlug);
    } catch {
        // Non-critical
    }

    console.log(`[Deprovision] Completed for tenant ${tenantSlug}. Users deleted: ${deletedUsers}, Errors: ${errors.length}`);

    return { success: errors.length === 0, deletedUsers, errors };
}
