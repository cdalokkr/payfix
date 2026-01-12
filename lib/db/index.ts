import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL!;

// Disable prefetch as it is not supported for "Transaction" pooler mode
// Increase max connections for better parallel query performance
const client = postgres(connectionString, {
    prepare: false,
    max: 20,
    idle_timeout: 20,
    connect_timeout: 30,
    max_lifetime: 60 * 30 // 30 minutes - refresh connections periodically
});
export const db = drizzle(client, { schema });
