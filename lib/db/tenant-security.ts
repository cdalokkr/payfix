import { sql } from 'drizzle-orm'
import { centralDb } from './index'
import { tenantRuntimeRoleName } from '@/lib/tenant/trusted-context'

const SCHEMA_PATTERN = /^tenant_[a-z0-9_]{3,40}$/

/**
 * Applies the same non-login role, grants, and schema-bound RLS policy used by
 * the database migration. New tenants call this after their registry row has
 * been created so provisioning cannot drift from existing schemas.
 */
export async function configureTenantDatabaseSecurity(tenantId: string, tenantSchema: string): Promise<void> {
    if (!SCHEMA_PATTERN.test(tenantSchema)) {
        throw new Error('Refusing to configure security for an invalid tenant schema.')
    }
    const roleName = tenantRuntimeRoleName(tenantId)

    await centralDb.execute(sql`
        SELECT payfix_internal.configure_tenant_security(
            ${tenantId}::uuid,
            ${tenantSchema}::name,
            ${roleName}::name
        )
    `)
}