import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as masterSchema from './master-schema';

const connectionString = process.env.DATABASE_URL!;

if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is missing.');
}

const client = postgres(connectionString, {
    prepare: false,
    max: 5, // Master control database queries are light and infrequent
    idle_timeout: 20,
    connect_timeout: 15,
});

export const masterDb = drizzle(client, { schema: masterSchema });
