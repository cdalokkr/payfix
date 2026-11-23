import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as masterSchema from './master-schema';
import dns from 'dns';

// Ensure IPv4 lookup is preferred over IPv6 (prevents getaddrinfo ENOTFOUND on dual-stack Supabase poolers)
if (typeof dns?.setDefaultResultOrder === 'function') {
    dns.setDefaultResultOrder('ipv4first');
}

// Lazy singleton anchored to globalThis so HMR and route handlers preserve active connection pool
const globalForMasterDb = globalThis as unknown as {
    masterClient?: postgres.Sql | null;
    masterDbInstance?: ReturnType<typeof drizzle> | null;
};

function getMasterDb() {
    if (!globalForMasterDb.masterDbInstance) {
        const connectionString = process.env.DATABASE_URL;
        if (!connectionString) {
            throw new Error('DATABASE_URL environment variable is missing.');
        }
        globalForMasterDb.masterClient = postgres(connectionString, {
            prepare: false,
            max: process.env.VERCEL ? 2 : 5, // Master control database queries are light and infrequent
            idle_timeout: 20,
            connect_timeout: 30,
            backoff: (attempt) => Math.min(attempt * 0.25, 2),
            onnotice: (notice) => {
                // Ignore routine "already exists, skipping" notices from DDL checks
                if (notice.code === '42P07' || notice.code === '42701') return;
                console.info(`[DB Notice] ${notice.message}`);
            }
        });
        globalForMasterDb.masterDbInstance = drizzle(globalForMasterDb.masterClient, { schema: masterSchema });
    }
    return globalForMasterDb.masterDbInstance;
}

export const masterDb = new Proxy({} as any, {
    get(_, prop, receiver) {
        const database = getMasterDb();
        return Reflect.get(database, prop, database);
    }
});
