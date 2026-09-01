import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema'; // Standard business schema
import { masterDb } from './master-connection';
import { tenants } from './master-schema';
import { eq, or } from 'drizzle-orm';


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
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tenantId);
        
        const tenant = await masterDb.query.tenants.findFirst({
            where: isUuid
                ? eq(tenants.id, tenantId)
                : or(eq(tenants.tenant_schema, tenantId), eq(tenants.slug, tenantId.replace(/^tenant_/, ''))),
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
        // On control-plane errors, preserve a known state. A tenant with no
        // known state must not be treated as active because that would turn a
        // control-plane outage into an authorization bypass.
        const prev = tenantLockoutCache.get(tenantId);
        return prev ? prev.blocked : true;
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
    const isCustomExternalDb = !!databaseUrl && databaseUrl !== process.env.DATABASE_URL;
    const safeSchemaName = schemaName ? schemaName.replace(/[^a-zA-Z0-9_]/g, '') : null;

    // Cache key: If custom external DB -> tenantId; If shared DB -> shared_${safeSchemaName}
    const cacheKey = isCustomExternalDb ? tenantId : `shared_${safeSchemaName || 'public'}`;
    const cached = connectionPoolCache.get(cacheKey);
    
    if (cached) {
        cached.lastUsed = Date.now();
        return cached.db;
    }

    const targetDbUrl = isCustomExternalDb ? databaseUrl! : process.env.DATABASE_URL!;
    if (!targetDbUrl) {
        throw new Error('Database URL configuration is missing.');
    }

    console.log(`[DB Router] Initializing new connection pool for: ${cacheKey} (search_path: ${safeSchemaName ? `${safeSchemaName}, public` : 'public'})`);

    const connectionParams: Record<string, any> = {};
    if (safeSchemaName) {
        connectionParams.search_path = `${safeSchemaName}, public`;
    }

    const client = postgres(targetDbUrl, {
        prepare: false,
        max: isCustomExternalDb ? 10 : 4, // More connections for custom external DBs, fewer for shared schemas
        idle_timeout: 20,
        connect_timeout: 15,
        max_lifetime: 60 * 30, // Refresh connections every 30 minutes
        connection: connectionParams
    });

    const db = drizzle(client, { schema });
    connectionPoolCache.set(cacheKey, { client, db, lastUsed: Date.now() });
    
    return db;
}

/**
 * Clears cached connections and lockout state for a deleted tenant.
 * Called by deprovisionTenant() during tenant deletion.
 */
export function clearTenantConnectionCache(tenantId: string, schemaName: string): void {
    // Clear connection pool entries matching this tenant
    for (const [key, cached] of connectionPoolCache.entries()) {
        if (key.includes(tenantId) || key.includes(schemaName)) {
            try { cached.client.end(); } catch { /* ignore */ }
            connectionPoolCache.delete(key);
            console.log(`[DB Router] Cleared connection pool for deleted tenant: ${key}`);
        }
    }
    // Clear lockout cache
    tenantLockoutCache.delete(tenantId);
}

export { refreshTenantLockoutState };
