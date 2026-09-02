import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import { getTenantDb } from './tenant-connection';
import { tenantStorage } from '../tenant/store';
import { resolveTrustedTenantBySchema } from '../tenant/trusted-context';

// Lazy singleton: connection is only created on first use at runtime,
// NOT during module evaluation at build time (Vercel build has no DATABASE_URL).
let _client: postgres.Sql | null = null;
let _centralDb: ReturnType<typeof drizzle> | null = null;

function getCentralDb() {
    if (!_centralDb) {
        const connectionString = process.env.DATABASE_URL;
        if (!connectionString) {
            throw new Error('DATABASE_URL environment variable is missing.');
        }
        _client = postgres(connectionString, {
            prepare: false,
            max: 20,
            idle_timeout: 20,
            connect_timeout: 30,
            max_lifetime: 60 * 30 // 30 minutes
        });
        _centralDb = drizzle(_client, { schema });
    }
    return _centralDb;
}

// Re-export centralDb as a getter-backed proxy so existing imports keep working
export const centralDb = new Proxy({} as any, {
    get(_, prop, receiver) {
        return Reflect.get(getCentralDb(), prop, receiver);
    }
});

/**
 * Proxy database client.
 * Intercepts query methods at runtime and switches connection contexts
 * dynamically based on the request's AsyncLocalStorage context.
 */
// Track which tenant was last logged to avoid log spam
let lastLoggedTenant = '';

export const db = new Proxy({} as any, {
    get(target, prop, receiver) {
        const context = tenantStorage.getStore();
        if (context?.trusted && context.tenantId && context.tenantSchema) {
            // Log routing decision (only on change to avoid spam)
            if (lastLoggedTenant !== context.tenantSchema) {
                console.log(`[DB-PROXY] Routing to tenant DB: ${context.tenantSchema} (tenant: ${context.slug})`);
                lastLoggedTenant = context.tenantSchema || '';
            }
            const tenantDb = getTenantDb(context.tenantId, context.databaseUrl, context.tenantSchema, true);
            return Reflect.get(tenantDb, prop, receiver);
        }

        throw new Error('TENANT_CONTEXT_REQUIRED: use centralDb explicitly for control-plane operations.');
    }
});

/**
 * Run a database callback explicitly inside a specified tenant schema.
 */
export async function runWithTenantSchema<T>(tenantSchema: string, fn: () => Promise<T>): Promise<T> {
    const context = await resolveTrustedTenantBySchema(tenantSchema);
    if (!context) {
        throw new Error('TENANT_CONTEXT_REQUIRED: schema is not registered as an active tenant.');
    }
    return tenantStorage.run(context, fn);
}



