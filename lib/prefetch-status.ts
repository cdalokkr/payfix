// ============================================
// lib/prefetch-status.ts
// Centralized Prefetch Status Tracking System
// ============================================

/**
 * Prefetch status entry with timestamp, data, and promise tracking
 */
export interface PrefetchEntry<T = unknown> {
    key: string
    timestamp: number
    data: T | null
    promise: Promise<T> | null
    status: 'pending' | 'completed' | 'failed'
    error?: string
}

/**
 * Configuration for prefetch status checks
 */
export interface PrefetchCheckOptions {
    maxAge?: number // Maximum age in milliseconds before data is considered stale (default: 30000)
}

/**
 * Module-level Map to persist prefetch status across component unmounts
 * This is critical for maintaining prefetch state during navigation
 */
const prefetchStatusMap = new Map<string, PrefetchEntry>()

/**
 * Default max age for prefetch data (30 seconds)
 */
const DEFAULT_MAX_AGE = 30000

/**
 * Minimum skeleton display time to prevent flash (300ms)
 */
export const MINIMUM_SKELETON_DISPLAY_TIME = 300

/**
 * Set prefetch status for a given key
 * @param key - Unique identifier for the prefetch operation
 * @param entry - Partial entry data to set/update
 */
export function setPrefetchStatus<T>(
    key: string,
    entry: Partial<Omit<PrefetchEntry<T>, 'key'>>
): void {
    const existing = prefetchStatusMap.get(key) as PrefetchEntry<T> | undefined

    const newEntry: PrefetchEntry<T> = {
        key,
        timestamp: entry.timestamp ?? existing?.timestamp ?? Date.now(),
        data: entry.data !== undefined ? entry.data : (existing?.data ?? null),
        promise: entry.promise !== undefined ? entry.promise : (existing?.promise ?? null),
        status: entry.status ?? existing?.status ?? 'pending',
        error: entry.error ?? existing?.error
    }

    prefetchStatusMap.set(key, newEntry as PrefetchEntry)

    console.log(`[PREFETCH-STATUS] Set status for "${key}":`, {
        status: newEntry.status,
        hasData: newEntry.data !== null,
        hasPromise: newEntry.promise !== null,
        timestamp: new Date(newEntry.timestamp).toISOString()
    })
}

/**
 * Check if data has been prefetched and is still valid (not stale)
 * @param key - Unique identifier for the prefetch operation
 * @param options - Configuration options including maxAge
 * @returns true if prefetched data exists and is not stale
 */
export function isPrefetched(key: string, options: PrefetchCheckOptions = {}): boolean {
    const entry = prefetchStatusMap.get(key)

    if (!entry) {
        console.log(`[PREFETCH-STATUS] isPrefetched("${key}"): false (no entry)`)
        return false
    }

    if (entry.status !== 'completed') {
        console.log(`[PREFETCH-STATUS] isPrefetched("${key}"): false (status: ${entry.status})`)
        return false
    }

    const maxAge = options.maxAge ?? DEFAULT_MAX_AGE
    const age = Date.now() - entry.timestamp
    const isStale = age > maxAge

    if (isStale) {
        console.log(`[PREFETCH-STATUS] isPrefetched("${key}"): false (stale, age: ${age}ms, maxAge: ${maxAge}ms)`)
        return false
    }

    console.log(`[PREFETCH-STATUS] isPrefetched("${key}"): true (age: ${age}ms)`)
    return true
}

/**
 * Get prefetched data if available and not stale
 * @param key - Unique identifier for the prefetch operation
 * @param options - Configuration options including maxAge
 * @returns The prefetched data or null if not available/stale
 */
export function getPrefetchedData<T>(key: string, options: PrefetchCheckOptions = {}): T | null {
    const entry = prefetchStatusMap.get(key) as PrefetchEntry<T> | undefined

    if (!entry) {
        console.log(`[PREFETCH-STATUS] getPrefetchedData("${key}"): null (no entry)`)
        return null
    }

    if (entry.status !== 'completed') {
        console.log(`[PREFETCH-STATUS] getPrefetchedData("${key}"): null (status: ${entry.status})`)
        return null
    }

    const maxAge = options.maxAge ?? DEFAULT_MAX_AGE
    const age = Date.now() - entry.timestamp
    const isStale = age > maxAge

    if (isStale) {
        console.log(`[PREFETCH-STATUS] getPrefetchedData("${key}"): null (stale)`)
        return null
    }

    console.log(`[PREFETCH-STATUS] getPrefetchedData("${key}"): returning data`)
    return entry.data
}

/**
 * Get the pending prefetch promise if one exists
 * @param key - Unique identifier for the prefetch operation
 * @returns The pending promise or null
 */
export function getPrefetchPromise<T>(key: string): Promise<T> | null {
    const entry = prefetchStatusMap.get(key) as PrefetchEntry<T> | undefined

    if (!entry || entry.status !== 'pending') {
        return null
    }

    return entry.promise
}

/**
 * Clear prefetch status for a given key
 * @param key - Unique identifier for the prefetch operation
 */
export function clearPrefetchStatus(key: string): void {
    const existed = prefetchStatusMap.delete(key)
    console.log(`[PREFETCH-STATUS] Cleared status for "${key}": ${existed ? 'removed' : 'not found'}`)
}

/**
 * Clear all prefetch statuses
 * Useful for cross-tab invalidation or logout
 */
export function clearAllPrefetchStatus(): void {
    const count = prefetchStatusMap.size
    prefetchStatusMap.clear()
    console.log(`[PREFETCH-STATUS] Cleared all ${count} prefetch entries`)
}

/**
 * Get all prefetch keys (for debugging)
 */
export function getAllPrefetchKeys(): string[] {
    return Array.from(prefetchStatusMap.keys())
}

/**
 * Get prefetch entry details (for debugging)
 */
export function getPrefetchEntry<T>(key: string): PrefetchEntry<T> | undefined {
    return prefetchStatusMap.get(key) as PrefetchEntry<T> | undefined
}

/**
 * Mark a prefetch as started (pending)
 * @param key - Unique identifier for the prefetch operation
 * @param promise - The promise that will resolve with the data
 */
export function markPrefetchStarted<T>(key: string, promise: Promise<T>): void {
    setPrefetchStatus(key, {
        status: 'pending',
        promise,
        timestamp: Date.now(),
        data: null
    })
}

/**
 * Mark a prefetch as completed with data
 * @param key - Unique identifier for the prefetch operation
 * @param data - The prefetched data
 */
export function markPrefetchCompleted<T>(key: string, data: T): void {
    setPrefetchStatus(key, {
        status: 'completed',
        data,
        promise: null,
        timestamp: Date.now()
    })
}

/**
 * Mark a prefetch as failed
 * @param key - Unique identifier for the prefetch operation
 * @param error - Error message
 */
export function markPrefetchFailed(key: string, error: string): void {
    setPrefetchStatus(key, {
        status: 'failed',
        error,
        promise: null,
        data: null
    })
}

/**
 * Listen for cross-tab invalidation events
 * This clears prefetch status when data is invalidated in another tab
 */
if (typeof window !== 'undefined') {
    // Listen for storage events (cross-tab communication)
    window.addEventListener('storage', (event) => {
        if (event.key === 'cache-invalidation' || event.key === 'dashboard-invalidation') {
            console.log('[PREFETCH-STATUS] Cross-tab invalidation detected, clearing all prefetch status')
            clearAllPrefetchStatus()
        }
    })

    // Listen for custom invalidation events within the same tab
    window.addEventListener('dashboard-cache-invalidated', () => {
        console.log('[PREFETCH-STATUS] Dashboard cache invalidated, clearing prefetch status')
        clearPrefetchStatus('dashboard-data')
        clearPrefetchStatus('unified-dashboard-data')
    })

    // Listen for user operations that should invalidate prefetch
    window.addEventListener('user-operation-complete', () => {
        console.log('[PREFETCH-STATUS] User operation complete, clearing dashboard prefetch status')
        clearPrefetchStatus('dashboard-data')
        clearPrefetchStatus('unified-dashboard-data')
    })
}

/**
 * Broadcast cache invalidation to other tabs
 */
export function broadcastCacheInvalidation(): void {
    if (typeof window !== 'undefined') {
        // Use localStorage to broadcast to other tabs
        localStorage.setItem('cache-invalidation', Date.now().toString())
        localStorage.removeItem('cache-invalidation')

        // Also dispatch local event
        window.dispatchEvent(new CustomEvent('dashboard-cache-invalidated'))
    }
}