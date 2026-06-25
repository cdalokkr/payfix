import { NextRequest, NextResponse } from 'next/server';
import { headers, cookies } from 'next/headers';
import { tenantStorage } from '@/lib/tenant/store';
import { centralDb, db } from '@/lib/db';
import { sql } from 'drizzle-orm';
import { profiles } from '@/lib/db/schema';
import { createContext } from '@/lib/trpc/server';

/**
 * Deep diagnostic endpoint — tests entire tenant context chain.
 * GET /api/health/tenant-deep
 */
export async function GET(request: NextRequest) {
    const results: Record<string, any> = {
        timestamp: new Date().toISOString(),
        tests: {},
    };

    try {
        // ═══════════════════════════════════════════
        // TEST 1: Proxy headers
        // ═══════════════════════════════════════════
        const headerStore = await headers();
        const tenantSlug = headerStore.get('x-tenant-slug');
        const tenantSchema = headerStore.get('x-tenant-schema');
        const tenantId = headerStore.get('x-tenant-id');
        results.tests['1_proxy_headers'] = {
            status: tenantSlug ? '✅ PASS' : '❌ FAIL',
            tenantSlug,
            tenantSchema,
            tenantId,
        };

        // ═══════════════════════════════════════════
        // TEST 2: Cookie
        // ═══════════════════════════════════════════
        const cookieStore = await cookies();
        const fallbackCookie = cookieStore.get('tenant_fallback')?.value;
        results.tests['2_cookie'] = {
            status: fallbackCookie ? '✅ PASS' : '❌ FAIL',
            tenant_fallback: fallbackCookie,
        };

        // ═══════════════════════════════════════════
        // TEST 3: tRPC createContext — does it create ctx.tenant?
        // ═══════════════════════════════════════════
        let ctxTenant: any = null;
        try {
            const ctx = await createContext();
            ctxTenant = ctx.tenant;
            results.tests['3_trpc_context'] = {
                status: ctxTenant ? '✅ PASS' : '❌ FAIL — ctx.tenant is null!',
                tenant: ctxTenant ? {
                    tenantId: ctxTenant.tenantId,
                    slug: ctxTenant.slug,
                    tenantSchema: ctxTenant.tenantSchema,
                    databaseUrl: ctxTenant.databaseUrl ? '[SET]' : null,
                } : null,
            };
        } catch (err: any) {
            results.tests['3_trpc_context'] = {
                status: '❌ ERROR',
                error: err.message,
            };
        }

        // ═══════════════════════════════════════════
        // TEST 4: AsyncLocalStorage — is tenantStorage.getStore() null outside run()?
        // ═══════════════════════════════════════════
        const storeOutside = tenantStorage.getStore();
        results.tests['4_asynclocalstorage_outside'] = {
            status: '⚠️ Expected null outside run()',
            value: storeOutside ? storeOutside.slug : null,
        };

        // ═══════════════════════════════════════════
        // TEST 5: AsyncLocalStorage — does run() properly set context?
        // ═══════════════════════════════════════════
        if (ctxTenant) {
            let insideValue: any = null;
            let dbProxyTarget: string = 'unknown';
            let profileCount: number = -1;

            await tenantStorage.run(ctxTenant, async () => {
                // Check 5a: Is getStore() non-null inside run()?
                const store = tenantStorage.getStore();
                insideValue = store ? store.slug : null;

                // Check 5b: Does db Proxy route to tenant DB?
                try {
                    const result = await db.execute(sql`SELECT current_schema(), current_setting('search_path') as search_path`);
                    dbProxyTarget = JSON.stringify(result[0]);
                } catch (err: any) {
                    dbProxyTarget = `ERROR: ${err.message}`;
                }

                // Check 5c: Count profiles via db Proxy
                try {
                    const result = await db.execute(sql`SELECT COUNT(*) as cnt FROM profiles`);
                    profileCount = parseInt(result[0]?.cnt || '0');
                } catch (err: any) {
                    dbProxyTarget += ` | Profile count error: ${err.message}`;
                }
            });

            results.tests['5_asynclocalstorage_inside_run'] = {
                status: insideValue ? '✅ PASS' : '❌ FAIL — context lost inside run()!',
                storeSlug: insideValue,
                dbProxyRoutedTo: dbProxyTarget,
                profileCountViaProxy: profileCount,
                interpretation: profileCount === 1
                    ? '✅ Correct — 1 profile (alpha admin only)'
                    : profileCount === 15
                        ? '❌ WRONG — 15 profiles = old tenant public schema!'
                        : `⚠️ Unexpected count: ${profileCount}`,
            };
        } else {
            results.tests['5_asynclocalstorage_inside_run'] = {
                status: '⏭️ SKIPPED — no tenant context to test with',
            };
        }

        // ═══════════════════════════════════════════
        // TEST 6: Direct schema query comparison
        // ═══════════════════════════════════════════
        let publicCount = 0;
        let tenantCount = 0;
        try {
            const pub = await centralDb.execute(sql`SELECT COUNT(*) as cnt FROM public.profiles`);
            publicCount = parseInt(pub[0]?.cnt || '0');
        } catch {}

        if (tenantSchema) {
            try {
                const ten = await centralDb.execute(
                    sql`SELECT COUNT(*) as cnt FROM ${sql.raw(tenantSchema)}.profiles`
                );
                tenantCount = parseInt(ten[0]?.cnt || '0');
            } catch {}
        }

        results.tests['6_direct_schema_comparison'] = {
            publicProfiles: publicCount,
            tenantProfiles: tenantCount,
            tenantSchemaUsed: tenantSchema,
        };

        // ═══════════════════════════════════════════
        // VERDICT
        // ═══════════════════════════════════════════
        const test3Pass = results.tests['3_trpc_context'].status.includes('PASS');
        const test5Pass = results.tests['5_asynclocalstorage_inside_run']?.status?.includes('PASS');
        const correctData = results.tests['5_asynclocalstorage_inside_run']?.profileCountViaProxy === tenantCount;

        if (test3Pass && test5Pass && correctData) {
            results.verdict = '✅ ALL PASSED — tenant context propagation is working correctly';
            results.nextStep = 'The issue is likely in dashboard component caching. Clear browser cache and hard refresh.';
        } else if (!test3Pass) {
            results.verdict = '❌ BROKEN at tRPC context creation — ctx.tenant is null';
            results.nextStep = 'Headers exist but createContext() is not reading them correctly';
        } else if (!test5Pass) {
            results.verdict = '❌ BROKEN at AsyncLocalStorage — context lost inside run()';
            results.nextStep = 'Node.js AsyncLocalStorage issue in Vercel serverless';
        } else {
            results.verdict = '⚠️ Context works but data mismatch — possible DB connection pool issue';
            results.nextStep = 'Check tenant-connection.ts search_path setting';
        }

        return NextResponse.json(results, {
            headers: { 'Cache-Control': 'no-store' },
        });
    } catch (error: any) {
        return NextResponse.json({
            error: error.message,
            stack: error.stack?.split('\n').slice(0, 5),
        }, { status: 500 });
    }
}
