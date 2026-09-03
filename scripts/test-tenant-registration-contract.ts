/**
 * Disposable tenant registration contract proof.
 *
 * This exercises the public signup mutation, verifies that it returns only
 * after the canonical tenant schema is ready, and removes only its disposable
 * tenant fixture. It never uses tenant_primary business rows.
 *
 * Run against a running PayFix app:
 *   PAYFIX_E2E_ALLOW_DISPOSABLE=1 \
 *   PAYFIX_E2E_BASE_URL=http://127.0.0.1:3000 \
 *   pnpm exec tsx scripts/test-tenant-registration-contract.ts
 */
import './env-config'

import { request, type APIRequestContext } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { eq, sql } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'

import { centralDb } from '../lib/db'
import { masterDb } from '../lib/db/master-connection'
import { tenants } from '../lib/db/master-schema'
import { deprovisionTenant } from '../lib/tenant/provisioning'
import {
    inspectTenantSchemaContract,
    tenantSchemaNameFromSlug,
} from '../lib/tenant/schema-contract'

const BASE_URL = (process.env.PAYFIX_E2E_BASE_URL || 'http://127.0.0.1:3000').replace(/\/$/, '')

function assert(condition: unknown, message: string): asserts condition {
    if (!condition) throw new Error(message)
}

async function readJson(response: { status(): number; text(): Promise<string> }) {
    const text = await response.text()
    let body: any = {}
    try {
        body = text ? JSON.parse(text) : {}
    } catch {
        body = { raw: text.slice(0, 500) }
    }
    return { status: response.status(), body }
}

async function postJson(
    api: APIRequestContext,
    path: string,
    payload: unknown,
) {
    return readJson(await api.post(`${BASE_URL}${path}`, {
        headers: { 'content-type': 'application/json' },
        data: payload,
        timeout: 120_000,
    }))
}

function getMutationEnvelope(body: any) {
    return Array.isArray(body) ? body[0] : body
}

async function submitSignup(api: APIRequestContext, input: Record<string, unknown>) {
    const response = await postJson(api, '/api/trpc/auth.registerTenant?batch=1', {
        0: input,
    })
    const envelope = getMutationEnvelope(response.body)
    return {
        response,
        envelope,
        result: envelope?.result?.data?.json ?? envelope?.result?.data,
        errorMessage: envelope?.error?.json?.message || envelope?.error?.message || '',
    }
}

async function findTenant(slug: string) {
    return masterDb.query.tenants.findFirst({
        where: eq(tenants.slug, slug),
    })
}

async function findTenants(slug: string) {
    return masterDb
        .select()
        .from(tenants)
        .where(eq(tenants.slug, slug))
}

function getSupabaseAdmin() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    assert(supabaseUrl && serviceRoleKey, 'Supabase admin configuration is missing')
    return createClient(supabaseUrl, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
    })
}

async function findAuthUsersByEmail(email: string) {
    const { data, error } = await getSupabaseAdmin().auth.admin.listUsers({
        page: 1,
        perPage: 1000,
    })
    assert(!error, `Could not inspect disposable auth users: ${error?.message || 'unknown error'}`)
    return data.users.filter((user) => user.email?.toLowerCase() === email.toLowerCase())
}

async function deleteAuthUsersByEmail(email: string) {
    const users = await findAuthUsersByEmail(email)
    for (const user of users) {
        await getSupabaseAdmin().auth.admin.deleteUser(user.id)
    }
}

async function cleanupTenant(slug: string) {
    const tenant = await findTenant(slug)
    if (!tenant) return

    try {
        if (tenant.status !== 'cancelled') {
            await masterDb
                .update(tenants)
                .set({ status: 'cancelled', updated_at: new Date() })
                .where(eq(tenants.id, tenant.id))
        }
        if (tenant.tenant_schema) {
            const cleanup = await deprovisionTenant(tenant.id, tenant.tenant_schema, tenant.slug)
            assert(cleanup.success, `Disposable tenant cleanup reported errors: ${JSON.stringify(cleanup.errors)}`)
        }
    } catch (error) {
        console.error(`[registration-e2e] Cleanup failed for ${slug}:`, error)
        throw error
    }
}

async function run() {
    if (process.env.PAYFIX_E2E_ALLOW_DISPOSABLE !== '1') {
        throw new Error(
            'Refusing to create test data. Set PAYFIX_E2E_ALLOW_DISPOSABLE=1 to explicitly authorize the disposable registration proof.',
        )
    }

    const suffix = randomUUID().replace(/-/g, '').slice(0, 10)
    const slug = `registration-e2e-${suffix}`
    const email = `${slug}@example.invalid`
    const input = {
        companyName: 'Disposable Registration E2E',
        slug,
        adminEmail: email,
        adminPassword: `Disposable-${suffix}-Password!`,
        firstName: 'Registration',
        lastName: 'Administrator',
        phone: '+919999999999',
        country: 'IN',
        industry: 'Testing',
        teamSize: '1-10',
    }
    const duplicateSlug = `duplicate-e2e-${suffix}`
    const duplicateWinnerEmail = `${duplicateSlug}-winner@example.invalid`
    const duplicateLoserEmail = `${duplicateSlug}-loser@example.invalid`
    const duplicatePassword = `Duplicate-${suffix}-Password!`
    const duplicateWinnerInput = {
        ...input,
        companyName: 'Concurrent Registration Winner',
        slug: duplicateSlug,
        adminEmail: duplicateWinnerEmail,
        adminPassword: duplicatePassword,
    }
    const duplicateLoserInput = {
        ...input,
        companyName: 'Concurrent Registration Loser',
        slug: duplicateSlug,
        adminEmail: duplicateLoserEmail,
        adminPassword: duplicatePassword,
    }
    let api: APIRequestContext | undefined

    try {
        api = await request.newContext({ timeout: 120_000 })
        const { response, result } = await submitSignup(api, input)
        assert(response.status === 200, `Signup failed: ${JSON.stringify(response)}`)

        assert(result?.success === true, `Signup did not report success: ${JSON.stringify(result)}`)
        assert(result.slug === slug, `Signup returned the wrong slug: ${JSON.stringify(result)}`)
        assert(typeof result.tenantId === 'string', `Signup did not return a tenant ID: ${JSON.stringify(result)}`)

        const tenant = await findTenant(slug)
        assert(tenant?.id === result.tenantId, 'Signup response did not match the control-plane tenant record')
        assert(tenant.status === 'trial', `New tenant is not fully provisioned: ${tenant.status}`)
        assert(tenant.tenant_schema === tenantSchemaNameFromSlug(slug), 'Tenant schema does not match the canonical slug mapping')

        const report = await inspectTenantSchemaContract(centralDb, tenant.tenant_schema)
        assert(report.ok, `New tenant schema contract failed: ${JSON.stringify(report)}`)

        const profiles = await centralDb.execute(sql`
            SELECT id, email, role, status
            FROM ${sql.raw(`${tenant.tenant_schema}.profiles`)}
            WHERE email = ${email}
            LIMIT 1
        `)
        assert(profiles.length === 1, 'New tenant admin profile was not created before signup returned')
        assert((profiles[0] as any).role === 'admin', 'New tenant admin profile has the wrong role')
        assert((profiles[0] as any).status === 'active', 'New tenant admin profile is not active')

        const [duplicateWinner, duplicateLoser] = await Promise.all([
            submitSignup(api, duplicateWinnerInput),
            submitSignup(api, duplicateLoserInput),
        ])
        const duplicateResponses = [duplicateWinner, duplicateLoser]
        const successfulDuplicates = duplicateResponses.filter(
            (attempt) => attempt.response.status === 200 && attempt.result?.success === true,
        )
        const rejectedDuplicates = duplicateResponses.filter(
            (attempt) => attempt.response.status === 409
                && attempt.errorMessage === 'Subdomain is already taken. Please try another one.',
        )
        assert(successfulDuplicates.length === 1, `Expected one concurrent signup winner: ${JSON.stringify(duplicateResponses)}`)
        assert(rejectedDuplicates.length === 1, `Expected one clear duplicate-slug conflict: ${JSON.stringify(duplicateResponses)}`)
        const successfulDuplicate = successfulDuplicates[0]
        const successfulEmail = successfulDuplicate === duplicateWinner
            ? duplicateWinnerEmail
            : duplicateLoserEmail
        const rejectedEmail = successfulDuplicate === duplicateWinner
            ? duplicateLoserEmail
            : duplicateWinnerEmail

        const duplicateTenants = await findTenants(duplicateSlug)
        assert(duplicateTenants.length === 1, `Concurrent signup created ${duplicateTenants.length} tenant records`)
        const duplicateTenant = duplicateTenants[0]
        assert(duplicateTenant.status === 'trial', 'Concurrent signup winner did not finish provisioning')
        assert(duplicateTenant.tenant_schema === tenantSchemaNameFromSlug(duplicateSlug), 'Concurrent signup used the wrong schema')

        const duplicateReport = await inspectTenantSchemaContract(centralDb, duplicateTenant.tenant_schema!)
        assert(duplicateReport.ok, `Concurrent signup schema contract failed: ${JSON.stringify(duplicateReport)}`)
        const duplicateProfiles = await centralDb.execute(sql`
            SELECT email, role, status
            FROM ${sql.raw(`${duplicateTenant.tenant_schema}.profiles`)}
            WHERE email IN (${duplicateWinnerEmail}, ${duplicateLoserEmail})
        `)
        assert(duplicateProfiles.length === 1, `Concurrent signup left ${duplicateProfiles.length} matching profiles`)
        assert((duplicateProfiles[0] as any).email === successfulEmail, 'Concurrent signup left the losing admin profile behind')
        const winnerAuthUsers = await findAuthUsersByEmail(successfulEmail)
        const loserAuthUsers = await findAuthUsersByEmail(rejectedEmail)
        assert(winnerAuthUsers.length === 1, 'Concurrent signup winner auth identity is missing')
        assert(loserAuthUsers.length === 0, 'Concurrent signup loser auth identity was not cleaned up')

        console.log(JSON.stringify({
            status: 'passed',
            slug,
            schema: tenant.tenant_schema,
            schemaVersion: report.version,
            adminProfileCreated: true,
            contractOk: report.ok,
            concurrentDuplicateSlug: {
                slug: duplicateSlug,
                exactlyOneTenant: duplicateTenants.length === 1,
                exactlyOneAdminProfile: duplicateProfiles.length === 1,
                loserConflict: rejectedDuplicates[0].errorMessage,
                loserAuthCleanedUp: loserAuthUsers.length === 0,
            },
        }, null, 2))
    } finally {
        await api?.dispose().catch(() => {})
        await cleanupTenant(slug)
        await cleanupTenant(duplicateSlug)
        await deleteAuthUsersByEmail(email)
        await deleteAuthUsersByEmail(duplicateWinnerEmail)
        await deleteAuthUsersByEmail(duplicateLoserEmail)
    }
}

run()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error instanceof Error ? error.message : String(error))
        process.exit(1)
    })