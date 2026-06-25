// ============================================
// lib/cache/smart-cache.ts
// Central cache helper for static database tables (Phase 4)
// Bypasses heavy SELECT * queries with strict column projections
// ============================================
import { db } from '@/lib/db'
import { officeSettings, officeLocations, designations, officeClosures } from '@/lib/db/schema'
import { eq, gte, sql, desc } from 'drizzle-orm'
import { smartCacheManager } from './smart-cache-manager'
import { tenantStorage } from '@/lib/tenant/store'

const CACHE_NAMESPACES = {
    SETTINGS: 'static:settings',
    LOCATIONS: 'static:locations',
    DESIGNATIONS: 'static:designations',
    CLOSURES: 'static:closures'
} as const

// Cache TTL durations
const TTL_1_HOUR = 60 * 60 * 1000
const TTL_24_HOURS = 24 * 60 * 60 * 1000

// Helper: generate tenant-scoped cache key to prevent cross-tenant data leaks
function tenantCacheKey(key: string): string {
    const ctx = tenantStorage.getStore();
    const prefix = ctx?.tenantSchema || 'public';
    return `${prefix}:${key}`;
}

export class SmartCache {
    /**
     * Get office settings cached
     * Strict column projection: selects only required settings attributes
     */
    static async getOfficeSettingsCached() {
        const cacheKey = tenantCacheKey('office_settings')
        const cached = await smartCacheManager.get<any>(cacheKey, CACHE_NAMESPACES.SETTINGS)
        if (cached) return cached

        // Fetch from database with strict projection
        const data = await db.select({
            id: officeSettings.id,
            default_check_in: officeSettings.default_check_in,
            default_check_out: officeSettings.default_check_out,
            off_days: officeSettings.off_days,
            daily_working_hours: officeSettings.daily_working_hours,
            absent_deduction_multiplier: officeSettings.absent_deduction_multiplier
        })
        .from(officeSettings)
        .limit(1)

        const settingsResult = data[0] || null

        if (settingsResult) {
            await smartCacheManager.set(cacheKey, settingsResult, {
                namespace: CACHE_NAMESPACES.SETTINGS,
                ttl: TTL_24_HOURS,
                dataType: 'settings:critical'
            })
        }

        return settingsResult
    }

    /**
     * Get active office locations cached
     * Strict column projection: selects only geofencing coordinate metrics
     */
    static async getOfficeLocationsCached() {
        const cacheKey = tenantCacheKey('active_locations')
        const cached = await smartCacheManager.get<any[]>(cacheKey, CACHE_NAMESPACES.LOCATIONS)
        if (cached) return cached

        // Fetch active geofencing locations with strict projection
        const data = await db.select({
            id: officeLocations.id,
            name: officeLocations.name,
            address: officeLocations.address,
            latitude: officeLocations.latitude,
            longitude: officeLocations.longitude,
            radius_meters: officeLocations.radius_meters,
            is_active: officeLocations.is_active
        })
        .from(officeLocations)
        .where(eq(officeLocations.is_active, true))

        await smartCacheManager.set(cacheKey, data, {
            namespace: CACHE_NAMESPACES.LOCATIONS,
            ttl: TTL_1_HOUR,
            dataType: 'locations:secondary'
        })

        return data
    }

    /**
     * Get designations cached
     * Strict column projection
     */
    static async getDesignationsCached() {
        const cacheKey = tenantCacheKey('all_designations')
        const cached = await smartCacheManager.get<any[]>(cacheKey, CACHE_NAMESPACES.DESIGNATIONS)
        if (cached) return cached

        // Fetch designations with strict projection
        const data = await db.select({
            id: designations.id,
            name: designations.name,
            description: designations.description,
            role: designations.role,
            created_at: designations.created_at,
            updated_at: designations.updated_at
        })
        .from(designations)
        .orderBy(desc(designations.name))

        await smartCacheManager.set(cacheKey, data, {
            namespace: CACHE_NAMESPACES.DESIGNATIONS,
            ttl: TTL_24_HOURS,
            dataType: 'designations:secondary'
        })

        return data
    }

    /**
     * Get office closures cached (all closures)
     * Strict column projection
     */
    static async getOfficeClosuresCached() {
        const cacheKey = tenantCacheKey('all_closures')
        const cached = await smartCacheManager.get<any[]>(cacheKey, CACHE_NAMESPACES.CLOSURES)
        if (cached) return cached

        // Fetch closures with strict projection
        const data = await db.select({
            id: officeClosures.id,
            date: officeClosures.date,
            reason: officeClosures.reason,
            type: officeClosures.type,
            created_at: officeClosures.created_at
        })
        .from(officeClosures)
        .orderBy(desc(officeClosures.date))

        await smartCacheManager.set(cacheKey, data, {
            namespace: CACHE_NAMESPACES.CLOSURES,
            ttl: TTL_1_HOUR,
            dataType: 'closures:secondary'
        })

        return data
    }

    /**
     * Invalidate specific namespace cache keys
     */
    static invalidateSettings() {
        console.log(`[SMART-CACHE] Invalidating settings cache namespace`)
        smartCacheManager.invalidateNamespace(CACHE_NAMESPACES.SETTINGS)
    }

    static invalidateLocations() {
        console.log(`[SMART-CACHE] Invalidating locations cache namespace`)
        smartCacheManager.invalidateNamespace(CACHE_NAMESPACES.LOCATIONS)
    }

    static invalidateDesignations() {
        console.log(`[SMART-CACHE] Invalidating designations cache namespace`)
        smartCacheManager.invalidateNamespace(CACHE_NAMESPACES.DESIGNATIONS)
    }

    static invalidateClosures() {
        console.log(`[SMART-CACHE] Invalidating closures cache namespace`)
        smartCacheManager.invalidateNamespace(CACHE_NAMESPACES.CLOSURES)
    }

    /**
     * Invalidate all static cache namespaces
     */
    static invalidateAll() {
        console.log(`[SMART-CACHE] Invalidating all static cache namespaces`)
        Object.values(CACHE_NAMESPACES).forEach(ns => {
            smartCacheManager.invalidateNamespace(ns)
        })
    }
}
