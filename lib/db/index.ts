import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import { getTenantDb } from './tenant-connection';
import { tenantStorage } from '../tenant/store';

const connectionString = process.env.DATABASE_URL!;

if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is missing.');
}

// Default central database connection pool
const client = postgres(connectionString, {
    prepare: false,
    max: 20,
    idle_timeout: 20,
    connect_timeout: 30,
    max_lifetime: 60 * 30 // 30 minutes
});

export const centralDb = drizzle(client, { schema });

/**
 * Proxy database client.
 * Intercepts query methods at runtime and switches connection contexts
 * dynamically based on the request's AsyncLocalStorage context.
 */
export const db = new Proxy({} as any, {
    get(target, prop, receiver) {
        const context = tenantStorage.getStore();
        if (context && context.tenantId) {
            const tenantDb = getTenantDb(context.tenantId, context.databaseUrl, context.tenantSchema);
            return Reflect.get(tenantDb, prop, receiver);
        }
        
        // Fallback context (build time, CLI seeding, migrations, or local admin scripts)
        return Reflect.get(centralDb, prop, receiver);
    }
});
