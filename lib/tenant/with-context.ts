import { NextRequest } from 'next/server';
import { tenantStorage, type TenantContext } from './store';
import { headers } from 'next/headers';
import {
    resolveTrustedTenantBySlug,
    resolveTrustedTenantContext,
    TenantContextError,
} from './trusted-context';

function tenantErrorResponse(message: string): Response {
    return new Response(JSON.stringify({ error: message }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
}

/**
 * Higher-order function to wrap Next.js API route handlers.
 * Extracts tenant headers injected by the middleware and runs the handler
 * within the AsyncLocalStorage context.
 */
export function withTenantContext(handler: (req: NextRequest, ...args: any[]) => Promise<Response>) {
    return async (req: NextRequest, ...args: any[]) => {
        try {
            const context = await resolveTrustedTenantContext(new Headers(req.headers));
            return tenantStorage.run(context, () => handler(req, ...args));
        } catch (error) {
            if (error instanceof TenantContextError) {
                return tenantErrorResponse('A valid tenant context is required.');
            }
            throw error;
        }
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
        const tenantId = headersList.get('x-tenant-id');
        const slug = headersList.get('x-tenant-slug');
        const tenantSchema = headersList.get('x-tenant-schema');

        if (tenantId && slug && tenantSchema) {
            const context = await resolveTrustedTenantContext(new Headers(headersList));
            return tenantStorage.run(context, callback);
        }

        if (!slug) {
            try {
                const { cookies } = await import('next/headers');
                const cookieStore = await cookies();
                const fallbackSlug = cookieStore.get('tenant_fallback')?.value;
                if (fallbackSlug) {
                    const context = await resolveTrustedTenantBySlug(fallbackSlug);
                    return tenantStorage.run(context, callback);
                }
            } catch {
                // Fall through so callers that do not need tenant data can run.
            }
        }
    } catch {
        // Outside request context
    }
    return callback();
}
