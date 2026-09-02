import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as masterSchema from './master-schema';

// Lazy singleton: connection created on first use at runtime,
// NOT during module evaluation at build time (Vercel build has no DATABASE_URL).
let _client: postgres.Sql | null = null;
let _masterDb: ReturnType<typeof drizzle> | null = null;

function getMasterDb() {
    if (!_masterDb) {
        const connectionString = process.env.DATABASE_URL;
        if (!connectionString) {
            throw new Error('DATABASE_URL environment variable is missing.');
        }
        _client = postgres(connectionString, {
            prepare: false,
            max: 5, // Master control database queries are light and infrequent
            idle_timeout: 20,
            connect_timeout: 15,
        });
        _masterDb = drizzle(_client, { schema: masterSchema });
    }
    return _masterDb;
}

export const masterDb = new Proxy({} as any, {
    get(_, prop, receiver) {
        const database = getMasterDb();
        return Reflect.get(database, prop, database);
    }
});
