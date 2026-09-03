import { NextRequest, NextResponse } from 'next/server';
import { headers, cookies } from 'next/headers';
import { tenantStorage } from '@/lib/tenant/store';
import { centralDb } from '@/lib/db';
import { sql } from 'drizzle-orm';
import { canAccessTenantHealthDiagnostics } from '@/lib/auth/optimized-context';

type ProfileCount = number | null;

function parseProfileCount(value: unknown): ProfileCount {
    const count = Number(value);
    return Number.isInteger(count) && count >= 0 ? count : null;
}

/**
 * Diagnostic endpoint to verify tenant context propagation.
 * GET /api/health/tenant
 * 
 * Returns: what headers/cookies/context the server sees,
 * and which schema the DB queries would hit.
 */
export async function GET(request: NextRequest) {
    if (!await canAccessTenantHealthDiagnostics(request)) {
        return NextResponse.json(
            { error: 'Unauthorized' },
            {
                status: 401,
                headers: { 'Cache-Control': 'no-store' },
            },
        );
    }

    try {
        // 1. Read raw headers from proxy
        const headerStore = await headers();
        const tenantHeaders = {
            'x-tenant-id': headerStore.get('x-tenant-id'),
            'x-tenant-slug': headerStore.get('x-tenant-slug'),
            'x-tenant-schema': headerStore.get('x-tenant-schema'),
        };

        // 2. Read cookies
        const cookieStore = await cookies();
        const tenantFallbackCookie = cookieStore.get('tenant_fallback')?.value || null;

        // 3. Check AsyncLocalStorage context
        const asyncContext = tenantStorage.getStore();

        // 4. Try resolving tenant from cookie fallback
        let resolvedTenant: any = null;
        if (tenantFallbackCookie) {
            try {
                const { resolveTenant } = await import('@/lib/tenant/resolver');
                resolvedTenant = await resolveTenant(tenantFallbackCookie);
            } catch (err: any) {
                resolvedTenant = { error: err.message };
            }
        }

        // 5. Check what schema centralDb queries would hit
        let currentSearchPath = null;
        try {
            const result = await centralDb.execute(sql`SHOW search_path;`);
            currentSearchPath = result[0]?.search_path || null;
        } catch {}

        // 6. Count profiles in both schemas
        let publicProfileCount: ProfileCount = null;
        let tenantProfileCount: ProfileCount = null;
        const tenantSchema = tenantHeaders['x-tenant-schema'] || resolvedTenant?.tenant_schema;

        try {
            const publicResult = await centralDb.execute(sql`SELECT COUNT(*) as cnt FROM public.profiles;`);
            publicProfileCount = parseProfileCount(publicResult[0]?.cnt);
        } catch {}

        if (tenantSchema) {
            try {
                const tenantResult = await centralDb.execute(sql`
                    SELECT COUNT(*) as cnt FROM ${sql.raw(tenantSchema)}.profiles;
                `);
                tenantProfileCount = parseProfileCount(tenantResult[0]?.cnt);
            } catch {
                tenantProfileCount = null;
            }
        }

        return NextResponse.json({
            timestamp: new Date().toISOString(),
            diagnosis: {
                proxyHeaders: tenantHeaders,
                hasTenantFallbackCookie: Boolean(tenantFallbackCookie),
                asyncLocalStorageContext: asyncContext ? {
                    tenantId: asyncContext.tenantId,
                    slug: asyncContext.slug,
                    tenantSchema: asyncContext.tenantSchema,
                } : null,
                resolvedTenantFromCookie: resolvedTenant ? {
                    id: resolvedTenant.id,
                    slug: resolvedTenant.slug,
                    tenant_schema: resolvedTenant.tenant_schema,
                } : null,
                currentSearchPath,
                profileCounts: {
                    publicSchema: publicProfileCount,
                    tenantSchema: tenantProfileCount,
                    tenantSchemaName: tenantSchema || 'N/A',
                }
            },
            verdict: tenantHeaders['x-tenant-slug']
                ? '✅ Proxy injected tenant headers correctly'
                : tenantFallbackCookie
                    ? '⚠️ No proxy headers, but cookie exists — headers may not propagate from proxy.ts'
                    : '❌ No tenant context at all — cookie and headers both missing'
        });
    } catch (error) {
        console.error('[TENANT-HEALTH] Diagnostic failed:', error);
        return NextResponse.json({
            error: 'Tenant health diagnostic failed',
        }, { status: 500 });
    }
}
