import { NextRequest } from 'next/server';
import { tenantStorage, TenantContext } from './store';
import { headers } from 'next/headers';

/**
 * Higher-order function to wrap Next.js API route handlers.
 * Extracts tenant headers injected by the middleware and runs the handler
 * within the AsyncLocalStorage context.
 */
export function withTenantContext(handler: (req: NextRequest, ...args: any[]) => Promise<Response>) {
    return async (req: NextRequest, ...args: any[]) => {
        const tenantId = req.headers.get('x-tenant-id');
        const slug = req.headers.get('x-tenant-slug');
        const databaseUrl = req.headers.get('x-tenant-db-url');
        const tenantSchema = req.headers.get('x-tenant-schema');
        const brandName = req.headers.get('x-tenant-brand') || 'PayFix';

        if (tenantId && slug) {
            const context: TenantContext = {
                tenantId,
                slug,
                databaseUrl: databaseUrl || null,
                tenantSchema: tenantSchema || null,
                brandName
            };
            return tenantStorage.run(context, () => handler(req, ...args));
        }

        return handler(req, ...args);
    };
}

/**
 * Utility to run synchronous or asynchronous callbacks inside a tenant context.
 * Useful for server actions or layout loaders.
 */
export function runWithTenant<T>(context: TenantContext, callback: () => T): T {
    return tenantStorage.run(context, callback);
}

/**
 * Resolves the tenant context from the Next.js request headers or tenant_fallback cookie
 * and runs a callback within that storage context.
 */
export async function runWithRequestHeaders<T>(callback: () => Promise<T>): Promise<T> {
    try {
        const headersList = await headers();
        let tenantId = headersList.get('x-tenant-id');
        let slug = headersList.get('x-tenant-slug');
        let databaseUrl = headersList.get('x-tenant-db-url');
        let tenantSchema = headersList.get('x-tenant-schema');
        let brandName = headersList.get('x-tenant-brand') || 'PayFix';

        if (!tenantId || !slug) {
            try {
                const { cookies } = await import('next/headers');
                const cookieStore = await cookies();
                const fallbackSlug = cookieStore.get('tenant_fallback')?.value;
                if (fallbackSlug) {
                    const { resolveTenant } = await import('@/lib/tenant/resolver');
                    const tenant = await resolveTenant(fallbackSlug);
                    if (tenant) {
                        tenantId = tenant.id;
                        slug = tenant.slug;
                        databaseUrl = tenant.database_url || null;
                        tenantSchema = tenant.tenant_schema || null;
                        brandName = tenant.branding?.app_name || tenant.company_name;
                    }
                }
            } catch {
                // Ignore cookie error outside request context
            }
        }

        if (tenantId && slug) {
            const context: TenantContext = {
                tenantId,
                slug,
                databaseUrl: databaseUrl || null,
                tenantSchema: tenantSchema || null,
                brandName
            };
            return tenantStorage.run(context, callback);
        }
    } catch {
        // Outside request context
    }
    return callback();
}
