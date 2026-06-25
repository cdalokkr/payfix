import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema'; // Standard business schema
import { masterDb } from './master-connection';
import { tenants } from './master-schema';
import { eq } from 'drizzle-orm';

interface CachedConnection {
    client: postgres.Sql;
    db: any;
    lastUsed: number;
}

const connectionPoolCache = new Map<string, CachedConnection>();

// Prune idle connections in serverless environment (cleanup worker)
if (process.env.NODE_ENV !== 'test') {
    setInterval(() => {
        const now = Date.now();
        const IDLE_TIMEOUT = 10 * 60 * 1000; // 10 minutes
        for (const [key, cached] of connectionPoolCache.entries()) {
            if (now - cached.lastUsed > IDLE_TIMEOUT) {
                console.log(`[DB Router] Closing idle connection pool: ${key}`);
                cached.client.end();
                connectionPoolCache.delete(key);
            }
        }
    }, 5 * 60 * 1000); // Check every 5 minutes
}

// Map to cache blocked/suspended tenant IDs to enforce fast, non-blocking DB-level lockout
const tenantLockoutCache = new Map<string, { blocked: boolean; expires: number }>();
const LOCKOUT_CACHE_TTL = 2 * 60 * 1000; // 2 minutes

/**
 * Queries the control plane in the background to update the tenant's lockout state.
 */
async function refreshTenantLockoutState(tenantId: string): Promise<boolean> {
    try {
        const tenant = await masterDb.query.tenants.findFirst({
            where: eq(tenants.id, tenantId),
            columns: { status: true, trial_start: true, trial_duration_days: true }
        });

        if (!tenant) {
            tenantLockoutCache.set(tenantId, { blocked: true, expires: Date.now() + LOCKOUT_CACHE_TTL });
            return true;
        }

        let blocked = tenant.status === 'suspended' || tenant.status === 'cancelled';
        if (tenant.status === 'trial') {
            const trialExpiry = new Date(tenant.trial_start);
            trialExpiry.setDate(trialExpiry.getDate() + tenant.trial_duration_days);
            if (Date.now() > trialExpiry.getTime()) {
                blocked = true;
            }
        }

        tenantLockoutCache.set(tenantId, { blocked, expires: Date.now() + LOCKOUT_CACHE_TTL });
        return blocked;
    } catch (err) {
        console.error(`[DB Router] Error refreshing lockout state for tenant ${tenantId}:`, err);
        // On connection errors, fallback to previous state if exists, otherwise do not block
        const prev = tenantLockoutCache.get(tenantId);
        return prev ? prev.blocked : false;
    }
}

/**
 * Resolves or creates a connection pool for a specific tenant.
 * Uses schema-per-tenant on the central DB if databaseUrl is not provided.
 * Enforces database-level lockout for expired trials or suspended subscriptions.
 */
export function getTenantDb(tenantId: string, databaseUrl: string | null, schemaName: string | null) {
    // 1. Enforce Subscription Lockout Check
    const cachedLockout = tenantLockoutCache.get(tenantId);
    if (cachedLockout && cachedLockout.blocked) {
        throw new Error("This workspace subscription is suspended. Database access is locked.");
    }

    // Refresh lockout cache in the background if expired/missing
    if (!cachedLockout || Date.now() > cachedLockout.expires) {
        refreshTenantLockoutState(tenantId).catch(console.error);
    }

    // 2. Resolve database connection pool
    const cacheKey = databaseUrl ? tenantId : `shared_${schemaName}`;
    const cached = connectionPoolCache.get(cacheKey);
    
    if (cached) {
        cached.lastUsed = Date.now();
        return cached.db;
    }

    const targetDbUrl = databaseUrl || process.env.DATABASE_URL!;
    if (!targetDbUrl) {
        throw new Error('Database URL configuration is missing.');
    }

    console.log(`[DB Router] Initializing new connection pool for: ${cacheKey}`);

    const connectionParams: Record<string, any> = {};
    if (!databaseUrl && schemaName) {
        const safeSchemaName = schemaName.replace(/[^a-zA-Z0-9_]/g, '');
        connectionParams.search_path = `${safeSchemaName}, public`;
    }

    const client = postgres(targetDbUrl, {
        prepare: false,
        max: databaseUrl ? 10 : 4, // More connections for custom external DBs, fewer for shared schemas
        idle_timeout: 20,
        connect_timeout: 15,
        max_lifetime: 60 * 30, // Refresh connections every 30 minutes
        connection: connectionParams
    });

    const db = drizzle(client, { schema });
    connectionPoolCache.set(cacheKey, { client, db, lastUsed: Date.now() });
    
    return db;
}
export { refreshTenantLockoutState };
