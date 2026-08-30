import { NextRequest } from 'next/server';
import { tenantStorage, TenantContext } from './store';
import { headers } from 'next/headers';
import { resolveTrustedTenantContext, TenantContextError } from './trusted-context';

/**
 * Higher-order function to wrap Next.js API route handlers.
 * Extracts tenant headers injected by the middleware and runs the handler
 * within the AsyncLocalStorage context.
 */
export function withTenantContext(handler: (req: NextRequest, ...args: any[]) => Promise<Response>) {
    return async (req: NextRequest, ...args: any[]) => {
        try {
            const context = await resolveTrustedTenantContext(req.headers);
            return tenantStorage.run(context, () => handler(req, ...args));
        } catch (error) {
            if (error instanceof TenantContextError) {
                return new Response(JSON.stringify({ error: 'Invalid tenant context' }), {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' },
                });
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
    const headersList = await headers();
    const context = await resolveTrustedTenantContext(headersList);
    return tenantStorage.run(context, callback);
}
