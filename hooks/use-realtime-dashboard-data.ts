'use client'

import { trpc } from '@/lib/trpc/client'
import { createClient } from '@/lib/supabase/client'
import { useEffect, useCallback, useState, useRef, useMemo } from 'react'
import { usePathname } from 'next/navigation'
import type { UserRole } from '@/types'
import type { RealtimeChannel } from '@supabase/supabase-js'
import {
  isPrefetched,
  getPrefetchedData,
  clearPrefetchStatus,
  MINIMUM_SKELETON_DISPLAY_TIME
} from '@/lib/prefetch-status'
import { DASHBOARD_QUERY_PARAMS, DASHBOARD_FRESH_PARAMS } from '@/lib/dashboard-config'
import {
  type AnyRealtimeEvent,
  type EventCategory,
  type UserRole as EventUserRole,
  validateEvent
} from '@/lib/events/event-types'
import { getEventBroadcaster } from '@/lib/events/event-broadcaster'

// ============================================
// ENHANCED REAL-TIME DASHBOARD DATA HOOK WITH EVENT FILTERING
// Uses Unified Endpoint + Role-Filtered Real-time Subscriptions + Event Broadcasting
// ============================================

// ============================================
// MULTI-TIER TTL CACHE FOR PERFORMANCE
// ============================================

interface CacheTier {
  name: 'ultra-critical' | 'critical' | 'secondary' | 'detailed'
  ttl: number
  maxSize: number
  priority: number
}

const CACHE_TIERS: CacheTier[] = [
  { name: 'ultra-critical', ttl: 1000, maxSize: 10, priority: 4 },   // 1 second
  { name: 'critical', ttl: 3000, maxSize: 20, priority: 3 },         // 3 seconds
  { name: 'secondary', ttl: 10000, maxSize: 50, priority: 2 },       // 10 seconds
  { name: 'detailed', ttl: 30000, maxSize: 100, priority: 1 }        // 30 seconds
]

class MultiTierCache {
  private caches = new Map<CacheTier['name'], Map<string, { data: unknown; timestamp: number }>>()

  constructor() {
    CACHE_TIERS.forEach(tier => {
      this.caches.set(tier.name, new Map())
    })
  }

  set(key: string, data: unknown, tier: CacheTier['name'] = 'detailed'): void {
    const cache = this.caches.get(tier)
    if (!cache) return

    // Get the full tier configuration to access properties like maxSize
    const tierConfig = CACHE_TIERS.find(t => t.name === tier)
    if (!tierConfig) return

    // Enforce size limit
    if (cache.size >= tierConfig.maxSize) {
      // Remove oldest entry
      const firstKey = cache.keys().next().value
      if (firstKey) {
        cache.delete(firstKey)
      }
    }

    cache.set(key, { data, timestamp: Date.now() })
  }

  get(key: string, tier: CacheTier['name'] = 'detailed'): unknown | null {
    const cache = this.caches.get(tier)
    if (!cache) return null

    const entry = cache.get(key)
    if (!entry) return null

    const tierConfig = CACHE_TIERS.find(t => t.name === tier)
    if (!tierConfig) return null

    // Check if entry has expired
    if (Date.now() - entry.timestamp > tierConfig.ttl) {
      cache.delete(key)
      return null
    }

    return entry.data
  }

  clear(tier?: CacheTier['name']): void {
    if (tier) {
      const cache = this.caches.get(tier)
      if (cache) {
        cache.clear()
      }
    } else {
      // Clear all tiers
      this.caches.forEach(cache => cache.clear())
    }
  }

  getStats(): Record<CacheTier['name'], { size: number; hits: number; misses: number }> {
    const stats = {} as Record<CacheTier['name'], { size: number; hits: number; misses: number }>

    CACHE_TIERS.forEach(tier => {
      const cache = this.caches.get(tier.name)
      stats[tier.name] = {
        size: cache?.size || 0,
        hits: 0, // Could be implemented with hit tracking
        misses: 0
      }
    })

    return stats
  }
}

// Global multi-tier cache instance
const globalCache = new MultiTierCache()

// ============================================
// SMART EVENT FILTERING
// ============================================

interface EventFilterConfig {
  /** Maximum events per second to prevent spam */
  maxEventsPerSecond: number
  /** Enable smart batching */
  enableBatching: boolean
  /** Batch timeout in milliseconds */
  batchTimeout: number
  /** Event deduplication window */
  deduplicationWindow: number
}

const DEFAULT_FILTER_CONFIG: EventFilterConfig = {
  maxEventsPerSecond: 10,
  enableBatching: true,
  batchTimeout: 200,
  deduplicationWindow: 5000
}

class SmartEventFilter {
  private eventCounts = new Map<string, number>()
  private recentEvents = new Set<string>()
  private batchQueue: AnyRealtimeEvent[] = []
  private batchTimer: NodeJS.Timeout | null = null
  private config: EventFilterConfig

  constructor(config: Partial<EventFilterConfig> = {}) {
    this.config = { ...DEFAULT_FILTER_CONFIG, ...config }
  }

  shouldProcessEvent(event: AnyRealtimeEvent): boolean {
    const now = Date.now()
    const eventKey = `${event.metadata.category}-${event.metadata.eventId}`

    // Remove expired events from recent set
    this.recentEvents.forEach(key => {
      const timestamp = parseInt(key.split('-').pop() || '0')
      if (now - timestamp > this.config.deduplicationWindow) {
        this.recentEvents.delete(key)
      }
    })

    // Check for duplicate events
    if (this.recentEvents.has(eventKey)) {
      console.log(`[SMART-FILTER] Duplicate event filtered: ${event.metadata.eventId}`)
      return false
    }

    // Check rate limiting
    const countKey = event.metadata.category
    const currentCount = this.eventCounts.get(countKey) || 0
    const eventsPerSecond = 1000 / this.config.deduplicationWindow * currentCount

    if (eventsPerSecond > this.config.maxEventsPerSecond) {
      console.log(`[SMART-FILTER] Rate limit exceeded for ${countKey}: ${eventsPerSecond.toFixed(1)} events/sec`)
      return false
    }

    // Add to recent events
    this.recentEvents.add(eventKey)
    this.eventCounts.set(countKey, currentCount + 1)

    return true
  }

  async processEvent(event: AnyRealtimeEvent): Promise<void> {
    if (!this.shouldProcessEvent(event)) {
      return
    }

    if (this.config.enableBatching) {
      this.addToBatch(event)
    } else {
      await this.processEventImmediate(event)
    }
  }

  private addToBatch(event: AnyRealtimeEvent): void {
    this.batchQueue.push(event)

    if (!this.batchTimer) {
      this.batchTimer = setTimeout(() => {
        this.processBatch()
      }, this.config.batchTimeout)
    }
  }

  private async processBatch(): Promise<void> {
    const events = [...this.batchQueue]
    this.batchQueue = []

    if (this.batchTimer) {
      clearTimeout(this.batchTimer)
      this.batchTimer = null
    }

    if (events.length === 0) return

    console.log(`[SMART-FILTER] Processing batch of ${events.length} events`)

    for (const event of events) {
      await this.processEventImmediate(event)
    }
  }

  private async processEventImmediate(event: AnyRealtimeEvent): Promise<void> {
    try {
      // Validate event
      const errors = validateEvent(event)
      if (errors.length > 0) {
        console.warn('[SMART-FILTER] Event validation failed:', errors)
        return
      }

      // Store in appropriate cache tier based on priority
      const cacheKey = `event-${event.metadata.eventId}`
      const cacheTier = this.getCacheTierFromPriority(event.metadata.priority)
      globalCache.set(cacheKey, event, cacheTier)

      console.log(`[SMART-FILTER] Processed ${event.metadata.category} event in ${cacheTier} tier`)
    } catch (error) {
      console.error('[SMART-FILTER] Error processing event:', error)
    }
  }

  private getCacheTierFromPriority(priority: string): CacheTier['name'] {
    switch (priority) {
      case 'ultra-critical': return 'ultra-critical'
      case 'critical': return 'critical'
      case 'secondary': return 'secondary'
      default: return 'detailed'
    }
  }

  getStats() {
    return {
      recentEventCount: this.recentEvents.size,
      eventCounts: Object.fromEntries(this.eventCounts),
      batchQueueSize: this.batchQueue.length,
      cacheStats: globalCache.getStats()
    }
  }

  reset(): void {
    this.eventCounts.clear()
    this.recentEvents.clear()
    this.batchQueue = []

    if (this.batchTimer) {
      clearTimeout(this.batchTimer)
      this.batchTimer = null
    }
  }
}

// Global smart event filter instance
const globalEventFilter = new SmartEventFilter()

// ============================================
// SHARED CHANNEL MANAGEMENT
// Prevents premature cleanup during React Strict Mode double-mount
// and reuses existing channels to avoid "mismatch" errors
// ============================================
const sharedChannelSubscribers = new Map<string, number>()
const activeChannels = new Map<string, RealtimeChannel>()

// Track reconnection attempts per channel to implement exponential backoff
const channelReconnectAttempts = new Map<string, number>()
const MAX_RECONNECT_ATTEMPTS = 5
const BASE_RECONNECT_DELAY = 1000 // 1 second

const incrementSubscribers = (channelName: string): number => {
  const count = sharedChannelSubscribers.get(channelName) || 0
  const newCount = count + 1
  sharedChannelSubscribers.set(channelName, newCount)
  console.log(`📊 Channel ${channelName} subscribers: ${count} -> ${newCount}`)
  return newCount
}

const decrementSubscribers = (channelName: string): number => {
  const count = sharedChannelSubscribers.get(channelName) || 0
  const newCount = Math.max(0, count - 1)
  sharedChannelSubscribers.set(channelName, newCount)
  console.log(`📊 Channel ${channelName} subscribers: ${count} -> ${newCount}`)
  return newCount
}

interface DashboardStats {
  totalUsers: number
  totalActivities: number
  todayActivities: number
  moderatorCount: number
  employeeCount: number
  adminCount: number
}

interface RecentActivity {
  id: string
  description: string
  created_at: string
  activity_type?: string
  profiles?: {
    email: string
    full_name: string
    role?: string
  }
}

interface AnalyticsMetric {
  id: string
  metric_name: string
  metric_value: number
  metric_date: string
}

interface RealtimeDashboardData {
  stats: DashboardStats
  recentActivities: RecentActivity[]
  analytics: AnalyticsMetric[]
  isLoading: boolean
  isError: boolean
  error: unknown
  refetch: (options?: { forceFresh?: boolean }) => Promise<any>
  activeUsers: number
  dataSource: 'cache' | 'fresh' | 'loading'
  lastUpdated: Date | null
  magicCardsDataReady: boolean
  recentActivityDataReady: boolean
  /** Whether skeleton should be shown (respects minimum display time) */
  showSkeleton: boolean
  attendance?: {
    todayRecord: any
    pendingRecord: any
    settings: any
    closures: any
  }
}

// Type for the unified dashboard data returned by the tRPC query
type UnifiedDashboardData = {
  critical: {
    totalUsers: number
    activeUsers: number
    moderatorCount: number
    employeeCount: number
    adminCount: number
    metadata: {
      tier: 'critical'
      fetchedAt: string
      cacheExpiry: number
    }
  }
  secondary: {
    totalActivities: number
    todayActivities: number
    analytics: AnalyticsMetric[]
    metadata: {
      tier: 'secondary'
      fetchedAt: string
      cacheExpiry: number
    }
  }
  detailed: {
    recentActivities: RecentActivity[]
    metadata: {
      tier: 'detailed'
      fetchedAt: string
      cacheExpiry: number
    }
  }
  metadata: {
    consolidated: boolean
    unified: boolean
    fetchedAt: string
    version: string
    priority: string
    performance: {
      totalQueries: number
      databaseTime: number
      cacheHit: boolean
    }
  }
}

// Prefetch key for dashboard data
const PREFETCH_KEY = 'unified-dashboard-data'

// Configuration for role-based subscriptions
interface RealtimeConfig {
  role: UserRole
  userId: string
}

// Enhanced configuration with event filtering and caching options
interface EnhancedRealtimeConfig extends RealtimeConfig {
  /** Enable enhanced event filtering */
  enableSmartFiltering?: boolean
  /** Enable the unified dashboard query used by dashboard overview pages */
  enableDashboardQuery?: boolean
  /** Enable multi-tier caching */
  enableMultiTierCache?: boolean
  /** Cache tier configuration */
  cacheConfig?: {
    ultraCriticalTtl?: number
    criticalTtl?: number
    secondaryTtl?: number
    detailedTtl?: number
  }
  /** Event filter configuration */
  filterConfig?: Partial<EventFilterConfig>
  /** Initial data for hydration */
  initialData?: UnifiedDashboardData
}

/**
 * Enhanced role-based real-time dashboard hook with event filtering and multi-tier caching
 *
 * @param config - Enhanced configuration object with role, userId, and performance options
 * @returns Dashboard data with role-appropriate real-time updates and enhanced performance
 *
 * Behavior:
 * - Admin users: Subscribe to profiles, activities, and analytics_metrics tables
 *   - Receive updates when new users are added (with enhanced event broadcasting)
 *   - Receive updates for ALL activity changes (with role-based filtering)
 *   - Receive updates for analytics metrics changes
 *   - Get ultra-critical cache tier for user creation events
 *   - Smart event filtering prevents notification spam
 *
 * - Regular users: Subscribe only to their own activities
 *   - Do NOT receive updates when new users are added
 *   - Do NOT receive updates for other users' activities
 *   - Only receive updates for their own activity changes
 *   - Enhanced with smart batching and lower priority caching
 */
export function useRoleBasedRealtimeDashboard(config: EnhancedRealtimeConfig): RealtimeDashboardData {
  const {
    role,
    userId,
    enableSmartFiltering = true,
    enableDashboardQuery = true,
    enableMultiTierCache = true,
    cacheConfig,
    filterConfig,
    initialData
  } = config

  // Initialize enhanced components if enabled
  const enhancedEventFilter = useMemo(() => {
    return enableSmartFiltering ? new SmartEventFilter(filterConfig) : null
  }, [enableSmartFiltering, filterConfig])

  // Configure cache tiers based on config
  const configuredCacheTiers = useMemo(() => {
    if (!enableMultiTierCache || !cacheConfig) return CACHE_TIERS

    return CACHE_TIERS.map(tier => ({
      ...tier,
      ttl: cacheConfig[`${tier.name}Ttl` as keyof typeof cacheConfig] || tier.ttl
    }))
  }, [enableMultiTierCache, cacheConfig])
  const pathname = usePathname()

  // State to force fresh data fetch
  const [forceFresh, setForceFresh] = useState(false)

  // Calculate local date for timezone consistency
  const localDateStr = useMemo(() => {
    // Current date in YYYY-MM-DD format using local time
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }, []);

  // Server-prefetched data should render immediately. Skeletons are only
  // needed when there is no usable dashboard data yet.
  const hasInitialData = Boolean(initialData && 'critical' in initialData)
  const [magicCardsDataReady, setMagicCardsDataReady] = useState(hasInitialData)
  const [recentActivityDataReady, setRecentActivityDataReady] = useState(hasInitialData)

  const [showSkeleton, setShowSkeleton] = useState(!hasInitialData)
  const skeletonStartTimeRef = useRef<number>(Date.now())
  const previousPathnameRef = useRef<string | null>(null)

  // State to trigger channel recreation
  const [channelRecreationTrigger, setChannelRecreationTrigger] = useState(0)

  // Get tRPC utils for cache invalidation
  const utils = trpc.useUtils()

  // Use the unified endpoint for all data
  // IMPORTANT: Use shared config to ensure cache key consistency with prefetch
  // CACHE KEY FIX: Use exact same params as prefetch to ensure cache hit
  // Don't add localDate here - unified dashboard handles date internally
  const queryParams = forceFresh ? DASHBOARD_FRESH_PARAMS : DASHBOARD_QUERY_PARAMS

  const {
    data: dashboardData,
    isLoading,
    isFetching,
    isError,
    error,
    refetch: trpcRefetch
  } = trpc.admin.dashboard.getUnifiedDashboardData.useQuery(
    queryParams,
    {
      enabled: enableDashboardQuery,
      // Keep data fresh but allow some caching for performance
      staleTime: forceFresh ? 0 : 30000,
      // PERFORMANCE FIX: Disable refetchOnWindowFocus since we handle visibility manually
      // This prevents duplicate API calls when tab regains focus
      refetchOnWindowFocus: false,
      // OPTIMIZATION: Skip refetch on mount if SSR data is available
      // This prevents duplicate API calls while real-time subscriptions keep data fresh
      // When no initialData, always refetch to ensure fresh data on navigation
      refetchOnMount: initialData ? false : 'always',
      refetchOnReconnect: true,
      // CRITICAL: Keep previous data while refetching to prevent zero values flash
      // This ensures the UI shows the last known data during background refetch
      initialData: initialData,
      placeholderData: (previousData: UnifiedDashboardData | undefined) => previousData || initialData,
    }
  )

  // Server-side cache invalidation mutation for forcing fresh data
  const invalidateCacheMutation = trpc.admin.dashboard.invalidateCache.useMutation()

  // Refs for debouncing/deduplicating refetches
  const lastRefetchTimeRef = useRef<number>(0)
  const pendingRefetchPromiseRef = useRef<Promise<any> | null>(null)

  // Manual refresh function that ensures fresh data by invalidating server cache first
  // This is critical for cross-browser updates where the server cache might return stale data
  const refetch = useCallback(async (options?: { forceFresh?: boolean }) => {
    const now = Date.now()
    // Deduplicate concurrent calls within 500ms
    if (now - lastRefetchTimeRef.current < 500 && pendingRefetchPromiseRef.current) {
      console.log('[REALTIME] Deduplicating concurrent dashboard refetch')
      return pendingRefetchPromiseRef.current
    }
    lastRefetchTimeRef.current = now

    const performRefetch = async () => {
      console.log(`[REALTIME] Dashboard refresh triggered${options?.forceFresh ? ' (FORCE FRESH)' : ''}`)

      // Attendance-only pages still use this hook for realtime subscriptions,
      // but must not reintroduce the expensive dashboard query on refresh.
      if (!enableDashboardQuery) {
        return utils.attendance.invalidate()
      }

      // If forceFresh is requested, we MUST invalidate the server cache first
      // This overcomes any race conditions or stale cache layers
      if (options?.forceFresh) {
        try {
          const result = await invalidateCacheMutation.mutateAsync({ reason: 'force-fresh-refresh' })
          console.log(`[REALTIME] Server cache invalidated (Force). Version: ${result.cacheVersion}, Entries cleared: ${result.invalidatedCount}`)
        } catch (e) {
          console.warn('[REALTIME] Server cache invalidation failed during force-fresh:', e)
        }
      } else {
        // Non-blocking invalidation for standard refreshes
        invalidateCacheMutation.mutate({ reason: 'realtime-refresh' })
      }

      // Now refetch everything by invalidating caches
      // Use invalidate() to ensure all mounted components using these queries are updated.
      // This automatically triggers active queries (like getUnifiedDashboardData) to refetch.
      const invPromise = utils.admin.dashboard.getUnifiedDashboardData.invalidate()
      utils.attendance.invalidate()
      return invPromise
    }

    const promise = performRefetch().finally(() => {
      pendingRefetchPromiseRef.current = null
    })
    pendingRefetchPromiseRef.current = promise
    return promise
  }, [enableDashboardQuery, invalidateCacheMutation, utils])

  // Ref to track if component is mounted (for handling React Strict Mode)
  const isMountedRef = useRef(true)
  // Ref to store the channel for cleanup
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>['channel']> | null>(null)
  // Ref to store cleanup timeout
  const cleanupTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  // Ref to store reconnection timeout
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  // Ref to store supabase client
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null)

  // Function to recreate channel with exponential backoff
  const recreateChannel = useCallback((channelName: string) => {
    if (!isMountedRef.current) return

    const attempts = channelReconnectAttempts.get(channelName) || 0

    if (attempts >= MAX_RECONNECT_ATTEMPTS) {
      console.warn(`[REALTIME] Max reconnection attempts (${MAX_RECONNECT_ATTEMPTS}) reached for ${channelName}. Manual refresh required.`)
      return
    }

    // Calculate delay with exponential backoff (1s, 2s, 4s, 8s, 16s, max 30s)
    const delay = Math.min(BASE_RECONNECT_DELAY * Math.pow(2, attempts), 30000)

    console.log(`[REALTIME] Scheduling channel recreation for ${channelName} in ${delay}ms (attempt ${attempts + 1}/${MAX_RECONNECT_ATTEMPTS})`)

    // Clear any existing reconnect timeout
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
    }

    reconnectTimeoutRef.current = setTimeout(() => {
      if (!isMountedRef.current) return

      // Only reconnect if tab is visible
      if (document.visibilityState !== 'visible') {
        console.log('[REALTIME] Tab not visible, deferring reconnection...')
        return
      }

      channelReconnectAttempts.set(channelName, attempts + 1)

      // Clean up existing channel before recreation
      const existingChannel = activeChannels.get(channelName)
      if (existingChannel && supabaseRef.current) {
        console.log(`[REALTIME] Removing stale channel ${channelName} before recreation...`)
        supabaseRef.current.removeChannel(existingChannel)
        activeChannels.delete(channelName)
        sharedChannelSubscribers.delete(channelName)
      }

      // Trigger channel recreation by updating state
      console.log(`[REALTIME] Triggering channel recreation for ${channelName}...`)
      setChannelRecreationTrigger(prev => prev + 1)
    }, delay)
  }, [])

  // Role-based real-time subscription for cross-client updates
  useEffect(() => {
    // Mark as mounted
    isMountedRef.current = true

    // Clear any pending cleanup from previous mount (React Strict Mode)
    if (cleanupTimeoutRef.current) {
      console.log('🔄 Clearing pending cleanup (React Strict Mode re-mount detected)')
      clearTimeout(cleanupTimeoutRef.current)
      cleanupTimeoutRef.current = null
    }

    // Clear any pending reconnect timeout
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }

    if (!userId) {
      if (process.env.NODE_ENV === 'development') {
        console.log('[REALTIME] Skipping realtime subscription: No userId provided (logged out)')
      }
      return
    }

    const supabase = createClient()
    supabaseRef.current = supabase

    // Create role-specific channel name
    // IMPORTANT: For admins and moderators, use a SHARED channel so they receive each other's updates
    // For users, use user-specific channels since they only need their own activity updates
    const channelName = (role === 'admin' || role === 'moderator')
      ? 'dashboard-management-shared' // All managers share this channel
      : `dashboard-user-${userId}` // Users have individual channels

    // Track if THIS effect instance incremented the subscriber count
    // This is critical for proper cleanup - only decrement if we incremented
    let didIncrement = false

    console.log(`🔌 Setting up ${role} real-time dashboard subscriptions on channel: ${channelName}`)
    console.log(`📡 Channel type: ${(role === 'admin' || role === 'moderator') ? 'SHARED (all managers)' : 'USER-SPECIFIC'}`)

    // Check if we already have an active channel with this name
    // This prevents the "mismatch between server and client bindings" error
    // that occurs when trying to create a new channel with the same name
    const existingChannel = activeChannels.get(channelName)

    if (existingChannel) {
      // Reuse the existing channel - don't create a new one
      // IMPORTANT: Do NOT increment subscriber count when reusing - we didn't create anything
      console.log(`♻️ Reusing existing channel: ${channelName} (not incrementing subscriber count)`)
      channelRef.current = existingChannel

      // No need to subscribe again - the channel is already subscribed
      // Return cleanup that does NOT decrement (since we didn't increment)
      return () => {
        console.log(`🔌 Cleanup requested for ${role} (reused channel, no decrement needed)`)
        isMountedRef.current = false
        // Don't decrement - we didn't increment when reusing the channel
      }
    }

    // Only NOW increment because we're actually creating a new channel
    const subscriberCount = incrementSubscribers(channelName)
    didIncrement = true
    console.log(`👥 Channel ${channelName} subscribers: ${subscriberCount - 1} -> ${subscriberCount} (new channel)`)

    // Clean up any existing channel with the same name from Supabase's internal client state to avoid "after subscribe" errors
    try {
      const channels = supabase.getChannels()
      const existingInternalChannel = channels.find(ch => ch.topic === channelName || ch.topic === `realtime:${channelName}`)
      if (existingInternalChannel) {
        console.log(`🧹 Found existing internal channel ${channelName} in Supabase client cache, removing...`)
        supabase.removeChannel(existingInternalChannel)
      }
    } catch (e) {
      console.warn('[REALTIME] Failed to clean up cached Supabase channel:', e)
    }

    // Create a new channel since none exists
    console.log(`🆕 Creating new channel: ${channelName}`)
    let channel = supabase.channel(channelName)

    if (role === 'admin' || role === 'moderator') {
      // MANAGEMENT SUBSCRIPTIONS: Access to all tables
      console.log(`👑 ${role === 'admin' ? 'Admin' : 'Moderator'} mode: Subscribing to profiles, activities, attendance, leaves, and analytics_metrics`)

      channel = channel
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'profiles' },
          async (payload) => {
            // Only process if still mounted
            if (!isMountedRef.current) return

            console.log('[REALTIME] 📢 [Management] Database change detected on profiles table:', payload.eventType)


            console.log('[REALTIME] Triggering dashboard refresh due to profiles change...')
            refetch()
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'activities' },
          async (payload) => {
            // Only process if still mounted
            if (!isMountedRef.current) return

            console.log('[REALTIME] 📢 [Management] Database change detected on activities table:', payload.eventType)


            console.log('[REALTIME] Triggering dashboard refresh due to activities change...')
            refetch()
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'attendance' },
          async (payload) => {
            // Only process if still mounted
            if (!isMountedRef.current) return

            console.log('[REALTIME] 📢 [Management] Database change detected on attendance table:', payload.eventType)

            // Invalidate attendance queries
            utils.attendance.getAttendance.invalidate()

            console.log('[REALTIME] Triggering dashboard refresh due to attendance change...')
            refetch()
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'leaves' },
          async (payload) => {
            // Only process if still mounted
            if (!isMountedRef.current) return

            console.log('[REALTIME] 📢 [Management] Database change detected on leaves table:', payload.eventType)

            // Invalidate leaves queries
            utils.attendance.getLeaves.invalidate()

            console.log('[REALTIME] Triggering dashboard refresh due to leaves change...')
            refetch()
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'analytics_metrics' },
          (payload) => {
            // Only process if still mounted
            if (!isMountedRef.current) return

            console.log('[REALTIME] 📢 [Management] Database change detected on analytics_metrics table:', payload.eventType)

            console.log('[REALTIME] Triggering dashboard refresh due to analytics_metrics change...')
            refetch()
          }
        )
        .on(
          'broadcast',
          { event: 'realtime-event' },
          async ({ payload }: any) => {
            if (!isMountedRef.current) return

            const category = payload?.metadata?.category

            // Handle dashboard_sync events (legacy support)
            if (category === 'dashboard_sync') {
              console.log('[REALTIME] 🚀 [Management] Sync broadcast received')

              // Toast notifications removed - managed by bell icon now

              refetch({ forceFresh: true })
            }

            // Handle attendance_update events (enhanced notifications)
            if (category === 'attendance_update') {
              console.log('[REALTIME] 🔔 [Management] Attendance update broadcast received:', payload?.payload?.data || payload?.payload)

              // Toast notifications removed - managed by bell icon now

              // Invalidate attendance queries for UI refresh
              utils.attendance.getAttendance.invalidate()
              utils.attendance.getLeaves.invalidate()

              // Trigger dashboard refresh
              refetch({ forceFresh: true })
            }
          }
        )
    } else {
      // USER SUBSCRIPTIONS: Activities, Attendance, and Leaves
      // IMPORTANT: We use Profile UUID (userId) for all filters
      console.log(`👤 User mode: Subscribing to own data (activities, attendance, leaves) for Profile UUID: ${userId}`)

      channel = channel
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'activities',
            filter: `user_id=eq.${userId}`
          },
          async (payload) => {
            if (!isMountedRef.current) return
            console.log('[REALTIME] 📢 [User] Database change detected on own activities:', payload.eventType)


            // For regular users, also invalidate their attendance if an activity related to attendance occurred
            if ((payload.new as any)?.module === 'attendance') {
              utils.attendance.getAttendance.invalidate()
            }

            refetch()
          }
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'attendance',
            filter: `profile_id=eq.${userId}`
          },
          async (payload) => {
            if (!isMountedRef.current) return
            console.log('[REALTIME] 📢 [User] Database change detected on own attendance:', payload.eventType)

            // Invalidate attendance queries to refresh dashboard and calendar
            utils.attendance.getAttendance.invalidate()

            console.log('[REALTIME] Triggering dashboard refresh due to attendance change...')
            refetch()
          }
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'leaves',
            filter: `profile_id=eq.${userId}`
          },
          async (payload) => {
            if (!isMountedRef.current) return
            console.log('[REALTIME] 📢 [User] Database change detected on own leaves:', payload.eventType)

            // Invalidate leaves queries
            utils.attendance.getLeaves.invalidate()

            console.log('[REALTIME] Triggering dashboard refresh due to leaves change...')
            refetch()
          }
        )
        .on(
          'broadcast',
          { event: 'realtime-event' },
          async ({ payload }: any) => {
            if (!isMountedRef.current) return

            const category = payload?.metadata?.category

            // Handle dashboard_sync events (legacy support)
            if (category === 'dashboard_sync') {
              console.log('[REALTIME] 🚀 [User] Sync broadcast received')

              // Toast notifications removed - managed by bell icon now

              refetch({ forceFresh: true })
            }

            // Handle attendance_update events (enhanced bi-directional notifications)
            if (category === 'attendance_update') {
              console.log('[REALTIME] 🔔 [User] Attendance update broadcast received:', payload?.payload?.data || payload?.payload)

              // Toast notifications removed - managed by bell icon now

              // Invalidate attendance queries for UI refresh
              utils.attendance.getAttendance.invalidate()

              // Trigger full dashboard refresh
              refetch({ forceFresh: true })
            }
          }
        )
    }

    // Store channel reference for cleanup and reuse
    channelRef.current = channel
    activeChannels.set(channelName, channel)

    // Subscribe to the channel
    channel.subscribe((status, err) => {
      // Only log if still mounted
      if (!isMountedRef.current) return

      if (status === 'SUBSCRIBED') {
        console.log(`✅ Successfully subscribed to ${role} dashboard updates on ${channelName}`)
        // Reset reconnection attempts on successful subscription
        channelReconnectAttempts.set(channelName, 0)
      } else if (status === 'CHANNEL_ERROR') {
        // Extract error information safely - Supabase errors may have additional properties
        const errorObj = err as { message?: string; code?: string; status?: number } | null
        const errorMessage = errorObj?.message || err?.toString() || 'Unknown error'
        const errorCode = errorObj?.code || errorObj?.status?.toString() || 'UNKNOWN'
        const isMismatchError = errorMessage.includes('mismatch between server and client bindings')
        const isEmptyError = !err || (typeof err === 'object' && Object.keys(err).length === 0)

        if (isMismatchError) {
          // This is an expected error when tab regains focus after being idle
          // Log at warn level instead of error to reduce noise
          console.warn(`[REALTIME] Channel binding mismatch for ${role} (expected on tab refocus), will reconnect...`)
        } else if (isEmptyError) {
          // Empty error object - likely a transient connection issue
          // Log at warn level as it's usually recoverable
          console.warn(`[REALTIME] Channel error for ${role} (empty error - likely transient), will reconnect...`, {
            status,
            channelName,
            channelState: (channel as unknown as { state?: string })?.state
          })
        } else {
          // Log unexpected errors at error level with full details
          console.error(`❌ Channel error for ${role}:`, {
            status,
            errorMessage,
            errorCode,
            error: err,
            channelName,
            channelState: (channel as unknown as { state?: string })?.state,
            timestamp: new Date().toISOString()
          })
        }

        // Clean up stale channel references
        activeChannels.delete(channelName)
        sharedChannelSubscribers.delete(channelName)
        channelRef.current = null

        // Schedule reconnection with exponential backoff
        if (isMountedRef.current) {
          recreateChannel(channelName)
        }
      } else if (status === 'TIMED_OUT') {
        console.warn(`⏱️ Subscription timed out for ${role}, will attempt reconnection...`)
        activeChannels.delete(channelName)
        sharedChannelSubscribers.delete(channelName)
        channelRef.current = null

        // Schedule reconnection with exponential backoff
        if (isMountedRef.current) {
          recreateChannel(channelName)
        }
      } else if (status === 'CLOSED') {
        console.log(`🔌 Channel closed for ${role}`)
        activeChannels.delete(channelName)
        // Don't log as warning - this is expected during cleanup
      } else {
        console.log(`📡 Subscription status for ${role}:`, status)
      }
    })

    // Cleanup function with delayed execution for React Strict Mode
    return () => {
      console.log(`🔌 Cleanup requested for ${role} real-time dashboard subscriptions (didIncrement: ${didIncrement})`)
      isMountedRef.current = false

      // Clear any pending reconnect timeout
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
        reconnectTimeoutRef.current = null
      }

      // Only proceed with cleanup if we actually incremented the subscriber count
      // This prevents the race condition where reused channels cause count mismatches
      if (!didIncrement) {
        console.log(`🔌 Skipping decrement - this instance didn't increment (reused channel)`)
        return
      }

      // Use a small delay to handle React Strict Mode's rapid mount/unmount cycle
      // This prevents premature channel cleanup when the component immediately remounts
      cleanupTimeoutRef.current = setTimeout(() => {
        // Check if component is still unmounted after the delay
        if (!isMountedRef.current) {
          // Decrement subscriber count (only if we incremented)
          const remainingSubscribers = decrementSubscribers(channelName)

          console.log(`🔌 Executing delayed cleanup for ${channelName}`)
          console.log(`👥 Remaining subscribers: ${remainingSubscribers}`)

          // Only actually remove the channel if no subscribers remain
          if (remainingSubscribers === 0) {
            console.log(`🗑️ No subscribers remaining, removing channel: ${channelName}`)
            activeChannels.delete(channelName)
            // Also reset reconnection attempts for this channel
            channelReconnectAttempts.delete(channelName)
            if (channelRef.current) {
              supabase.removeChannel(channelRef.current)
              channelRef.current = null
            }
          } else {
            console.log(`⏳ Channel ${channelName} kept alive for ${remainingSubscribers} remaining subscriber(s)`)
          }
        } else {
          console.log(`🔄 Component remounted, skipping cleanup for ${channelName}`)
        }
      }, 100) // 100ms delay to handle Strict Mode double-mount
    }
  }, [refetch, role, userId, channelRecreationTrigger, recreateChannel, utils.attendance.getAttendance, utils.attendance.getLeaves])

  // Visibility change handler for channel reconnection on tab focus
  // PERFORMANCE FIX: Only refetch when channel is disconnected - trust realtime for connected channels
  // This eliminates duplicate API calls that were happening on every tab focus
  useEffect(() => {
    if (!userId) return

    const channelName = (role === 'admin' || role === 'moderator')
      ? 'dashboard-management-shared'
      : `dashboard-user-${userId}`

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('[REALTIME] 👁️ Tab became visible - checking channel status...')
        const channel = channelRef.current
        const channelState = channel ? (channel as unknown as { state?: string }).state : null

        // Check for errored or closed state and trigger reconnection
        if (channelState === 'errored' || channelState === 'closed') {
          console.log(`[REALTIME] Channel in ${channelState} state - triggering reconnection...`)
          // Reset reconnection attempts when user manually focuses tab
          channelReconnectAttempts.set(channelName, 0)
          recreateChannel(channelName)
        } else if (!channelState || channelState !== 'joined') {
          // Channel doesn't exist or is not joined - refetch data and recreate channel
          console.log(`[REALTIME] Channel disconnected (state: ${channelState || 'none'}) - triggering refresh and reconnection`)
          channelReconnectAttempts.set(channelName, 0)
          refetch()
          recreateChannel(channelName)
        } else {
          console.log('[REALTIME] ✅ Channel is still connected - no refresh needed (trusting realtime)')
        }
      } else {
        console.log('[REALTIME] 👁️ Tab became hidden')
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [refetch, userId, role, recreateChannel])

  // Auto-refetch after local user operations
  useEffect(() => {
    const handleUserOperationComplete = () => {
      console.log('🔄 User operation completed - refreshing dashboard')
      refetch()
    }

    window.addEventListener('user-operation-complete', handleUserOperationComplete)
    return () => {
      window.removeEventListener('user-operation-complete', handleUserOperationComplete)
    }
  }, [refetch])

  // Route change detection - reset skeleton state when navigating to dashboard
  useEffect(() => {
    const isDashboardRoute = pathname?.includes('/admin') || pathname?.includes('/dashboard')
    const wasOnDifferentRoute = previousPathnameRef.current !== null && previousPathnameRef.current !== pathname

    if (isDashboardRoute && wasOnDifferentRoute) {
      console.log('[REALTIME] Route changed to dashboard, resetting skeleton state')
      // Reset skeleton state on route change
      setShowSkeleton(true)
      skeletonStartTimeRef.current = Date.now()
      setMagicCardsDataReady(false)
      setRecentActivityDataReady(false)

      // Clear prefetch status so we get fresh data
      clearPrefetchStatus(PREFETCH_KEY)
    }

    previousPathnameRef.current = pathname
  }, [pathname])

  // Handle progressive loading states with minimum skeleton display time
  useEffect(() => {
    if (!isLoading && dashboardData) {
      // Calculate remaining time to show skeleton (minimum 300ms)
      const elapsedTime = Date.now() - skeletonStartTimeRef.current
      const remainingTime = Math.max(0, MINIMUM_SKELETON_DISPLAY_TIME - elapsedTime)

      // Hide skeleton after minimum display time
      const skeletonTimer = setTimeout(() => {
        setShowSkeleton(false)
      }, Math.max(0, remainingTime))

      // Set data ready states with slight delays for progressive reveal
      // Use Math.max to prevent negative timeout warnings during SSR hydration
      const magicCardsTimer = setTimeout(() => setMagicCardsDataReady(true), Math.max(0, remainingTime + 10))
      const recentActivityTimer = setTimeout(() => setRecentActivityDataReady(true), Math.max(0, remainingTime + 20))

      return () => {
        clearTimeout(skeletonTimer)
        clearTimeout(magicCardsTimer)
        clearTimeout(recentActivityTimer)
      }
    } else if (isLoading) {
      // Reset states when loading starts
      setShowSkeleton(true)
      skeletonStartTimeRef.current = Date.now()
      setMagicCardsDataReady(false)
      setRecentActivityDataReady(false)
    }
  }, [isLoading, dashboardData])

  // Extract data from unified response with proper type narrowing
  // Check if dashboardData has the expected structure (not performance metrics)
  const hasValidData = dashboardData && 'critical' in dashboardData

  const stats: DashboardStats = {
    totalUsers: hasValidData ? (dashboardData.critical?.totalUsers || 0) : 0,
    totalActivities: hasValidData ? (dashboardData.secondary?.totalActivities || 0) : 0,
    todayActivities: hasValidData ? (dashboardData.secondary?.todayActivities || 0) : 0,
    moderatorCount: hasValidData ? (dashboardData.critical?.moderatorCount || 0) : 0,
    employeeCount: hasValidData ? (dashboardData.critical?.employeeCount || 0) : 0,
    adminCount: hasValidData ? (dashboardData.critical?.adminCount || 0) : 0,
  }

  const recentActivities: RecentActivity[] = hasValidData ? (dashboardData.detailed?.recentActivities || []) : []
  const analytics: AnalyticsMetric[] = hasValidData ? (dashboardData.secondary?.analytics || []) : []
  const activeUsers = hasValidData ? (dashboardData.critical?.activeUsers || 0) : 0
  const attendanceData = hasValidData ? dashboardData.attendance : undefined

  // Determine if we're in a background refetch state (has data but fetching new)
  const isBackgroundRefetch = isFetching && !isLoading && hasValidData

  return {
    stats,
    recentActivities,
    analytics,
    // Only show loading state on initial load, not during background refetch
    isLoading: isLoading && !hasValidData,
    isError,
    error,
    refetch,
    activeUsers,
    dataSource: isLoading ? 'loading' : (isBackgroundRefetch ? 'cache' : (forceFresh ? 'fresh' : 'cache')),
    lastUpdated: hasValidData && dashboardData.metadata?.fetchedAt ? new Date(dashboardData.metadata.fetchedAt) : null,
    // Use showSkeleton state which respects minimum display time and route changes
    magicCardsDataReady: Boolean(!showSkeleton && (magicCardsDataReady || isBackgroundRefetch)),
    recentActivityDataReady: Boolean(!showSkeleton && (recentActivityDataReady || isBackgroundRefetch)),
    showSkeleton,
    attendance: attendanceData
  }
}

// ============================================
// ADMIN-SPECIFIC HOOK
// For admin dashboard with full real-time updates
// ============================================
export function useAdminRealtimeDashboard(userId: string, initialData?: UnifiedDashboardData): RealtimeDashboardData {
  return useRoleBasedRealtimeDashboard({ role: 'admin', userId, initialData })
}

// ============================================
// USER-SPECIFIC HOOK
// For regular user dashboard with filtered real-time updates
// ============================================
export function useUserRealtimeDashboard(
  userId: string,
  initialData?: UnifiedDashboardData,
  role: UserRole = 'employee',
  options?: { enableDashboardQuery?: boolean }
): RealtimeDashboardData {
  return useRoleBasedRealtimeDashboard({
    role,
    userId,
    initialData,
    enableDashboardQuery: options?.enableDashboardQuery
  })
}

// ============================================
// LEGACY COMPATIBILITY HOOK
// Maintains backward compatibility with existing code
// Defaults to admin behavior for existing implementations
// ============================================
export function useComprehensiveRealtimeDashboard(): RealtimeDashboardData {
  // For backward compatibility, use a placeholder that will be replaced
  // when the component provides proper user context
  console.warn('⚠️ useComprehensiveRealtimeDashboard is deprecated. Use useAdminRealtimeDashboard or useUserRealtimeDashboard instead.')

  // Default to admin with empty userId - subscriptions won't work without proper userId
  return useRoleBasedRealtimeDashboard({ role: 'admin', userId: '' })
}

// Export the base hook for backward compatibility if needed,
// but mapped to the new implementation
export const useRealtimeDashboardData = useComprehensiveRealtimeDashboard

// ============================================
// PERFORMANCE MONITORING AND UTILITIES
// ============================================

/**
 * Get cache performance statistics
 * Useful for monitoring and debugging cache effectiveness
 */
export function getCacheStats() {
  return {
    globalCache: globalCache.getStats(),
    eventFilter: globalEventFilter.getStats(),
    timestamp: new Date().toISOString()
  }
}

/**
 * Clear cache by tier
 * Useful for manual cache invalidation or testing
 */
export function clearCacheByTier(tier?: 'ultra-critical' | 'critical' | 'secondary' | 'detailed') {
  if (tier) {
    console.log(`[CACHE] Clearing ${tier} tier cache`)
    globalCache.clear(tier)
  } else {
    console.log('[CACHE] Clearing all cache tiers')
    globalCache.clear()
  }
}

/**
 * Reset event filter statistics
 * Useful for testing or after significant event processing
 */
export function resetEventFilter() {
  console.log('[EVENT-FILTER] Resetting filter statistics')
  globalEventFilter.reset()
}

/**
 * Performance monitoring hook
 * Returns cache and event filter statistics for debugging
 */
export function usePerformanceMonitoring() {
  const [stats, setStats] = useState(() => getCacheStats())

  useEffect(() => {
    const interval = setInterval(() => {
      setStats(getCacheStats())
    }, 5000) // Update every 5 seconds

    return () => clearInterval(interval)
  }, [])

  return {
    stats,
    clearCache: clearCacheByTier,
    resetFilter: resetEventFilter
  }
}

/**
 * Enhanced hook creator with custom configuration
 * For advanced use cases requiring custom cache and filtering settings
 */
export function createEnhancedRealtimeDashboard(config: {
  cacheTiers?: CacheTier[]
  filterConfig?: Partial<EventFilterConfig>
  enableMonitoring?: boolean
}) {
  const { cacheTiers, filterConfig, enableMonitoring = false } = config

  return function useEnhancedDashboard(userId: string, role: UserRole): RealtimeDashboardData & {
    performanceStats?: ReturnType<typeof getCacheStats>
    clearCache: (tier?: CacheTier['name']) => void
    resetFilter: () => void
  } {
    const dashboardData = useRoleBasedRealtimeDashboard({
      role,
      userId,
      enableSmartFiltering: true,
      enableMultiTierCache: true,
      filterConfig
    })

    const performance = usePerformanceMonitoring()

    return {
      ...dashboardData,
      ...(enableMonitoring && {
        performanceStats: performance.stats
      }),
      clearCache: performance.clearCache,
      resetFilter: performance.resetFilter
    }
  }
}