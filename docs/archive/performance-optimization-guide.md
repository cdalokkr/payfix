# Performance Optimization Guide for Real-Time Dashboard

## Overview

This guide provides detailed performance optimization strategies to achieve **sub-500ms update latency** and **fast dashboard data updates** while maintaining the existing caching and prefetch infrastructure.

## Current Performance Baseline

### Existing Optimizations

- **Request Deduplication Cache**: 5-second TTL with promise-based caching
- **Progressive Loading**: Critical → Secondary → Detailed data tiers
- **Batch Query Execution**: 3 queries per batch to avoid database overwhelm
- **Prefetch Strategy**: Non-blocking dashboard data prefetch during login
- **Performance Monitoring**: Built-in endpoint timing and alerting

### Performance Targets

- **Update Latency**: < 500ms for critical updates
- **Cross-browser Sync**: < 1000ms consistency window  
- **Cache Hit Rate**: > 85% for dashboard data
- **Memory Usage**: < 10MB per browser instance
- **Database Performance**: < 100ms for critical queries

---

## Optimization Strategy 1: Enhanced Caching Architecture

### 1.1 Multi-Tier Cache System

```typescript
// lib/cache/performance-cache.ts
interface CacheTier {
  name: 'ultra-critical' | 'critical' | 'secondary' | 'detailed' | 'background'
  ttl: number
  maxSize: number
  refreshStrategy: 'eager' | 'lazy' | 'predictive'
  compressionEnabled: boolean
  persistToStorage: boolean
}

const PERFORMANCE_CACHE_TIERS: CacheTier[] = [
  {
    name: 'ultra-critical',
    ttl: 1000, // 1 second
    maxSize: 5,
    refreshStrategy: 'eager',
    compressionEnabled: false,
    persistToStorage: false
  },
  {
    name: 'critical',
    ttl: 3000, // 3 seconds
    maxSize: 15,
    refreshStrategy: 'eager',
    compressionEnabled: false,
    persistToStorage: false
  },
  {
    name: 'secondary', 
    ttl: 10000, // 10 seconds
    maxSize: 30,
    refreshStrategy: 'lazy',
    compressionEnabled: true,
    persistToStorage: false
  },
  {
    name: 'detailed',
    ttl: 30000, // 30 seconds  
    maxSize: 50,
    refreshStrategy: 'lazy',
    compressionEnabled: true,
    persistToStorage: true
  },
  {
    name: 'background',
    ttl: 60000, // 60 seconds
    maxSize: 100,
    refreshStrategy: 'predictive',
    compressionEnabled: true,
    persistToStorage: true
  }
]

export class PerformanceCacheManager {
  private caches: Map<string, any[]> = new Map()
  private metadata: Map<string, any> = new Map()
  private compressionWorkers: Worker[] = []
  
  constructor() {
    this.initializeCacheTiers()
    this.startPredictiveRefresh()
  }
  
  // Ultra-fast cache access for critical data
  async getUltraFast<T>(key: string): Promise<T | null> {
    const ultraCache = this.caches.get('ultra-critical') || []
    const entry = ultraCache.find(item => item.key === key)
    
    if (entry && !this.isExpired(entry)) {
      this.updateAccessMetadata(key)
      return entry.data
    }
    
    return null
  }
  
  // Predictive refresh based on usage patterns
  private startPredictiveRefresh(): void {
    setInterval(() => {
      this.analyzeUsagePatterns()
      this.schedulePredictiveRefreshes()
    }, 10000) // Every 10 seconds
  }
  
  private analyzeUsagePatterns(): void {
    // Analyze which cache keys are accessed frequently
    // Schedule refreshes for predicted future access
    const accessPatterns = this.getAccessPatterns()
    
    Object.entries(accessPatterns).forEach(([key, pattern]) => {
      if (pattern.frequency > 0.8 && pattern.nextExpected < Date.now() + 5000) {
        this.schedulePredictiveRefresh(key)
      }
    })
  }
  
  private schedulePredictiveRefresh(key: string): void {
    // Preemptively refresh data that's likely to be needed
    setTimeout(() => {
      this.triggerBackgroundRefresh(key)
    }, Math.random() * 2000) // Stagger refreshes
  }
}
```

### 1.2 Real-Time Cache Invalidation

```typescript
// Enhanced cache invalidation for real-time updates
export class RealTimeCacheInvalidator {
  private invalidationQueue: string[] = []
  private processing = false
  
  async invalidateWithRealTimePriority(keys: string[], priority: 'critical' | 'normal' = 'normal') {
    if (priority === 'critical') {
      // Immediate invalidation for critical updates
      await this.processImmediateInvalidation(keys)
    } else {
      // Queue for batch processing
      this.invalidationQueue.push(...keys)
      this.scheduleBatchProcessing()
    }
  }
  
  private async processImmediateInvalidation(keys: string[]): Promise<void> {
    console.log('[CACHE-INVALIDATOR] Processing immediate invalidation for:', keys)
    
    // Immediately clear from all cache tiers
    keys.forEach(key => {
      PERFORMANCE_CACHE_TIERS.forEach(tier => {
        const cache = this.caches.get(tier.name) || []
        const index = cache.findIndex(item => item.key === key)
        if (index !== -1) {
          cache.splice(index, 1)
          console.log(`[CACHE-INVALIDATOR] Cleared ${key} from ${tier.name} tier`)
        }
      })
    })
    
    // Trigger immediate refresh for critical data
    await this.triggerImmediateRefresh(keys)
  }
  
  private async triggerImmediateRefresh(keys: string[]): Promise<void> {
    const criticalKeys = keys.filter(key => key.includes('critical') || key.includes('users'))
    
    if (criticalKeys.length > 0) {
      // Use performance priority for critical refresh
      await this.refreshCacheEntries(criticalKeys, 'performance')
    }
  }
}

export const realTimeCacheInvalidator = new RealTimeCacheInvalidator()
```

---

## Optimization Strategy 2: Database Query Optimization

### 2.1 Optimized Query Batching

```typescript
// Enhanced query execution with performance focus
export class PerformanceQueryOptimizer {
  private queryCache: Map<string, any> = new Map()
  private executionPlanCache: Map<string, any> = new Map()
  
  async executeOptimizedBatch<T>(queries: QueryBundle[], priority: 'critical' | 'normal' = 'normal'): Promise<T[]> {
    const startTime = performance.now()
    
    try {
      // Phase 1: Analyze queries and create execution plan
      const executionPlan = await this.createExecutionPlan(queries, priority)
      
      // Phase 2: Execute queries with optimized batching
      const results = await this.executeWithOptimalBatching(executionPlan)
      
      // Phase 3: Cache results and execution plans
      this.cacheQueryResults(queries, results)
      this.cacheExecutionPlan(queries, executionPlan)
      
      const totalTime = performance.now() - startTime
      console.log(`[QUERY-OPTIMIZER] Batch completed in ${totalTime.toFixed(2)}ms`)
      
      return results
      
    } catch (error) {
      console.error('[QUERY-OPTIMIZER] Batch execution failed:', error)
      throw error
    }
  }
  
  private async createExecutionPlan(queries: QueryBundle[], priority: string): Promise<ExecutionPlan> {
    // Analyze query complexity and dependencies
    const queryAnalysis = queries.map(query => this.analyzeQueryComplexity(query))
    
    // Group queries by complexity and create optimal execution order
    const groups = this.groupQueriesByComplexity(queryAnalysis)
    
    return {
      groups,
      estimatedTime: this.estimateExecutionTime(groups),
      parallelization: this.determineParallelization(groups, priority)
    }
  }
  
  private async executeWithOptimalBatching(plan: ExecutionPlan): Promise<any[]> {
    const results: any[] = []
    
    for (const group of plan.groups) {
      if (group.shouldRunParallel && group.queries.length > 1) {
        // Run complex queries in parallel with controlled concurrency
        const batchSize = Math.min(group.queries.length, 3) // Max 3 concurrent
        const batches = this.createBatches(group.queries, batchSize)
        
        for (const batch of batches) {
          const batchResults = await Promise.allSettled(
            batch.map(query => this.executeQuery(query))
          )
          
          batchResults.forEach(result => {
            if (result.status === 'fulfilled') {
              results.push(result.value)
            } else {
              console.warn('[QUERY-OPTIMIZER] Query failed:', result.reason)
              results.push(null)
            }
          })
        }
      } else {
        // Run simple queries sequentially
        for (const query of group.queries) {
          const result = await this.executeQuery(query)
          results.push(result)
        }
      }
    }
    
    return results
  }
  
  private async executeQuery(query: QueryBundle): Promise<any> {
    const startTime = performance.now()
    
    try {
      // Add query hints for performance
      const optimizedQuery = this.addPerformanceHints(query)
      
      const result = await this.executeWithRetry(optimizedQuery)
      
      const executionTime = performance.now() - startTime
      
      if (executionTime > 100) {
        console.warn(`[QUERY-OPTIMIZER] Slow query detected: ${executionTime.toFixed(2)}ms`)
      }
      
      return result
      
    } catch (error) {
      console.error('[QUERY-OPTIMIZER] Query execution failed:', error)
      throw error
    }
  }
  
  private addPerformanceHints(query: QueryBundle): QueryBundle {
    // Add database-specific performance hints
    return {
      ...query,
      hints: {
        ...query.hints,
        enable_partitionwise_aggregate: true,
        enable_hash_agg: true,
        enable_merge_join: true,
        random_page_cost: 1.1, // Optimize for SSD
        effective_cache_size: '256MB'
      }
    }
  }
}
```

### 2.2 Connection Pool Optimization

```typescript
// Enhanced Supabase client with connection pooling
export class OptimizedSupabaseClient {
  private connectionPool: any[] = []
  private activeConnections: Set<any> = new Set()
  private maxPoolSize = 5
  
  constructor() {
    this.initializeConnectionPool()
    this.startConnectionHealthMonitor()
  }
  
  async getConnection(): Promise<any> {
    // Reuse existing connections when possible
    if (this.connectionPool.length > 0) {
      const connection = this.connectionPool.pop()!
      this.activeConnections.add(connection)
      return connection
    }
    
    // Create new connection if pool is empty
    if (this.activeConnections.size < this.maxPoolSize) {
      const connection = createClient()
      this.activeConnections.add(connection)
      return connection
    }
    
    // Wait for connection to become available
    return this.waitForConnection()
  }
  
  async executeWithOptimizedConnection<T>(queryFn: (client: any) => Promise<T>): Promise<T> {
    const connection = await this.getConnection()
    
    try {
      return await queryFn(connection)
    } finally {
      // Return connection to pool
      this.activeConnections.delete(connection)
      this.connectionPool.push(connection)
      
      // Trim pool if too large
      if (this.connectionPool.length > this.maxPoolSize) {
        const excess = this.connectionPool.splice(this.maxPoolSize)
        excess.forEach(conn => conn.close())
      }
    }
  }
  
  private startConnectionHealthMonitor(): void {
    setInterval(() => {
      this.checkConnectionHealth()
      this.optimizeConnectionPool()
    }, 30000) // Every 30 seconds
  }
  
  private checkConnectionHealth(): void {
    // Test connections and remove unhealthy ones
    const healthyConnections: any[] = []
    
    this.connectionPool.forEach(async connection => {
      try {
        // Simple health check query
        const { error } = await connection.from('profiles').select('id').limit(1)
        if (!error) {
          healthyConnections.push(connection)
        }
      } catch (error) {
        console.warn('[CONNECTION-POOL] Unhealthy connection detected, removing')
      }
    })
    
    this.connectionPool = healthyConnections
  }
}
```

---

## Optimization Strategy 3: Frontend Performance

### 3.1 Smart Component Updates

```typescript
// Enhanced React components with performance optimization
import { useCallback, useMemo, useRef, useState } from 'react'

export function useOptimizedDashboardUpdate() {
  const [updateQueue, setUpdateQueue] = useState<DashboardUpdate[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const processingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastUpdateTimeRef = useRef<number>(0)
  
  // Batch multiple rapid updates to prevent UI thrashing
  const queueUpdate = useCallback((update: DashboardUpdate) => {
    setUpdateQueue(prev => [...prev, update])
    
    // Schedule batch processing
    if (processingTimeoutRef.current) {
      clearTimeout(processingTimeoutRef.current)
    }
    
    processingTimeoutRef.current = setTimeout(processBatch, 100)
  }, [])
  
  const processBatch = useCallback(async () => {
    if (isProcessing || updateQueue.length === 0) {
      return
    }
    
    setIsProcessing(true)
    
    try {
      const updates = [...updateQueue]
      setUpdateQueue([])
      
      console.log(`[DASHBOARD-UPDATE] Processing batch of ${updates.length} updates`)
      
      // Sort updates by priority and timestamp
      const sortedUpdates = updates.sort((a, b) => {
        const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 }
        return priorityOrder[b.priority] - priorityOrder[a.priority]
      })
      
      // Process updates in optimal order
      for (const update of sortedUpdates) {
        await processIndividualUpdate(update)
      }
      
      lastUpdateTimeRef.current = Date.now()
      
    } finally {
      setIsProcessing(false)
    }
  }, [updateQueue, isProcessing])
  
  const processIndividualUpdate = useCallback(async (update: DashboardUpdate) => {
    switch (update.type) {
      case 'user_count':
        // Update user count with immediate visual feedback
        updateUserCountDisplay(update.data)
        break
        
      case 'activity_feed':
        // Append to activity feed with smooth animation
        appendToActivityFeed(update.data)
        break
        
      case 'dashboard_stats':
        // Update dashboard statistics
        updateDashboardStats(update.data)
        break
    }
  }, [])
  
  // Memoized component updates to prevent unnecessary re-renders
  const optimizedUpdates = useMemo(() => {
    return {
      updateUserCount: useCallback((count: number) => {
        queueUpdate({
          type: 'user_count',
          data: { count },
          priority: 'critical',
          timestamp: Date.now()
        })
      }, [queueUpdate]),
      
      updateActivityFeed: useCallback((activities: any[]) => {
        queueUpdate({
          type: 'activity_feed', 
          data: { activities },
          priority: 'medium',
          timestamp: Date.now()
        })
      }, [queueUpdate]),
      
      forceUpdate: useCallback(() => {
        queueUpdate({
          type: 'force_refresh',
          data: {},
          priority: 'high',
          timestamp: Date.now()
        })
      }, [queueUpdate])
    }
  }, [queueUpdate])
  
  return optimizedUpdates
}

// Optimized dashboard component
export function OptimizedDashboard({ data, onUpdate }: Props) {
  const updates = useOptimizedDashboardUpdate()
  
  // Use React.memo to prevent unnecessary re-renders
  const UserCountCard = useMemo(() => React.memo(({ count }: { count: number }) => (
    <div className="dashboard-card">
      <h3>Total Users</h3>
      <div className="text-3xl font-bold">{count}</div>
    </div>
  )), [])
  
  // Optimized activity feed with virtualization for large lists
  const ActivityFeed = useMemo(() => React.memo(({ activities }: { activities: any[] }) => {
    const [visibleActivities, setVisibleActivities] = useState(activities.slice(0, 50))
    
    useEffect(() => {
      // Virtual scrolling for performance
      const handleScroll = () => {
        if (window.scrollY + window.innerHeight >= document.body.offsetHeight - 1000) {
          setVisibleActivities(prev => {
            const currentIndex = activities.indexOf(prev[prev.length - 1])
            const nextActivities = activities.slice(currentIndex + 1, currentIndex + 26)
            return [...prev, ...nextActivities]
          })
        }
      }
      
      window.addEventListener('scroll', handleScroll)
      return () => window.removeEventListener('scroll', handleScroll)
    }, [activities])
    
    return (
      <div className="activity-feed">
        {visibleActivities.map(activity => (
          <ActivityItem key={activity.id} activity={activity} />
        ))}
      </div>
    )
  }), [])
  
  return (
    <div className="dashboard-grid">
      <UserCountCard count={data.userCount} />
      <ActivityFeed activities={data.activities} />
      {/* Other optimized components */}
    </div>
  )
}
```

### 3.2 Memory Management and Cleanup

```typescript
// Memory management for real-time subscriptions
export class MemoryOptimizedSubscriptionManager {
  private subscriptions: Map<string, any> = new Map()
  private memoryUsageHistory: number[] = []
  private cleanupScheduled = false
  
  // Monitor memory usage and trigger cleanup when needed
  startMemoryMonitoring(): void {
    setInterval(() => {
      const memoryUsage = (performance as any).memory?.usedJSHeapSize || 0
      this.memoryUsageHistory.push(memoryUsage)
      
      // Keep only last 100 measurements
      if (this.memoryUsageHistory.length > 100) {
        this.memoryUsageHistory.shift()
      }
      
      // Check if memory usage is trending upward
      if (this.shouldTriggerCleanup()) {
        this.scheduleMemoryCleanup()
      }
    }, 10000) // Every 10 seconds
  }
  
  private shouldTriggerCleanup(): boolean {
    if (this.memoryUsageHistory.length < 10) return false
    
    const recent = this.memoryUsageHistory.slice(-10)
    const older = this.memoryUsageHistory.slice(-20, -10)
    
    const recentAvg = recent.reduce((a, b) => a + b) / recent.length
    const olderAvg = older.reduce((a, b) => a + b) / older.length
    
    // Trigger cleanup if memory usage increased by more than 20%
    return recentAvg > olderAvg * 1.2
  }
  
  private scheduleMemoryCleanup(): void {
    if (this.cleanupScheduled) return
    
    this.cleanupScheduled = true
    console.log('[MEMORY-MANAGER] Scheduling memory cleanup')
    
    setTimeout(() => {
      this.performMemoryCleanup()
      this.cleanupScheduled = false
    }, 5000) // Wait 5 seconds before cleanup
  }
  
  private performMemoryCleanup(): void {
    console.log('[MEMORY-MANAGER] Performing memory cleanup')
    
    // 1. Clear old event history
    this.clearOldEventHistory()
    
    // 2. Unsubscribe from inactive channels
    this.unsubscribeInactiveChannels()
    
    // 3. Clear temporary cache entries
    this.clearTemporaryCache()
    
    // 4. Force garbage collection if available
    if (window.gc) {
      window.gc()
    }
  }
  
  private clearOldEventHistory(): void {
    // Keep only recent events (last 100)
    const maxEvents = 100
    const eventHistory = this.getEventHistory()
    
    if (eventHistory.length > maxEvents) {
      const eventsToRemove = eventHistory.length - maxEvents
      this.removeOldestEvents(eventsToRemove)
      console.log(`[MEMORY-MANAGER] Cleared ${eventsToRemove} old events`)
    }
  }
  
  private unsubscribeInactiveChannels(): void {
    const now = Date.now()
    const inactiveThreshold = 5 * 60 * 1000 // 5 minutes
    
    this.subscriptions.forEach((subscription, channelId) => {
      if (subscription.lastUsed < now - inactiveThreshold) {
        console.log(`[MEMORY-MANAGER] Unsubscribing from inactive channel: ${channelId}`)
        subscription.unsubscribe()
        this.subscriptions.delete(channelId)
      }
    })
  }
  
  private clearTemporaryCache(): void {
    // Clear cache entries older than 1 minute
    const tempCacheKeys = Array.from(this.caches.keys()).filter(key => 
      key.startsWith('temp_') || key.includes('batch_')
    )
    
    tempCacheKeys.forEach(key => this.caches.delete(key))
    console.log(`[MEMORY-MANAGER] Cleared ${tempCacheKeys.length} temporary cache entries`)
  }
}

export const memoryManager = new MemoryOptimizedSubscriptionManager()
```

---

## Optimization Strategy 4: Network and Protocol Optimization

### 4.1 WebSocket Connection Optimization

```typescript
// Enhanced WebSocket management for real-time connections
export class OptimizedWebSocketManager {
  private connections: Map<string, WebSocket> = new Map()
  private heartbeatInterval: NodeJS.Timeout | null = null
  private reconnectAttempts: Map<string, number> = new Map()
  
  // Optimized connection strategy
  async createOptimizedConnection(url: string, options: ConnectionOptions): Promise<WebSocket> {
    // 1. Reuse existing connection if available
    const existing = this.connections.get(url)
    if (existing && existing.readyState === WebSocket.OPEN) {
      console.log('[WS-MANAGER] Reusing existing connection')
      return existing
    }
    
    // 2. Create new connection with optimizations
    const ws = new WebSocket(url, {
      headers: {
        'Connection': 'keep-alive',
        'Keep-Alive': 'timeout=5, max=1000'
      },
      timeout: 5000,
      maxPayload: 16 * 1024 * 1024 // 16MB max message size
    })
    
    // 3. Set up optimized event handlers
    this.setupOptimizedHandlers(ws, url, options)
    
    // 4. Store connection
    this.connections.set(url, ws)
    
    return ws
  }
  
  private setupOptimizedHandlers(ws: WebSocket, url: string, options: ConnectionOptions): void {
    // Message compression for large payloads
    ws.on('message', (data: WebSocket.Data) => {
      try {
        const message = typeof data === 'string' ? JSON.parse(data) : JSON.parse(data.toString())
        this.processOptimizedMessage(message, url, options)
      } catch (error) {
        console.error('[WS-MANAGER] Failed to parse message:', error)
      }
    })
    
    // Optimized heartbeat
    ws.on('open', () => {
      this.startHeartbeat(ws, url)
      console.log(`[WS-MANAGER] Connection established: ${url}`)
    })
    
    // Graceful reconnection with exponential backoff
    ws.on('close', () => {
      this.stopHeartbeat(url)
      this.scheduleReconnection(url, options)
    })
    
    // Error handling with recovery
    ws.on('error', (error) => {
      console.error(`[WS-MANAGER] Connection error for ${url}:`, error)
      this.handleConnectionError(url, error)
    })
  }
  
  private processOptimizedMessage(message: any, url: string, options: ConnectionOptions): void {
    // 1. Message batching for high-frequency updates
    if (options.enableBatching && message.type === 'batch_update') {
      message.data.forEach((update: any) => {
        this.handleIndividualUpdate(update, url)
      })
    } else {
      this.handleIndividualUpdate(message, url)
    }
    
    // 2. Update last activity timestamp
    this.updateLastActivity(url)
  }
  
  private startHeartbeat(ws: WebSocket, url: string): void {
    this.heartbeatInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }))
      }
    }, 30000) // Every 30 seconds
  }
  
  private stopHeartbeat(url: string): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = null
    }
  }
  
  private scheduleReconnection(url: string, options: ConnectionOptions): void {
    const attempts = this.reconnectAttempts.get(url) || 0
    const maxAttempts = options.maxReconnectAttempts || 5
    
    if (attempts >= maxAttempts) {
      console.warn(`[WS-MANAGER] Max reconnection attempts reached for ${url}`)
      return
    }
    
    const delay = Math.min(1000 * Math.pow(2, attempts), 30000) // Exponential backoff
    
    console.log(`[WS-MANAGER] Scheduling reconnection for ${url} in ${delay}ms (attempt ${attempts + 1})`)
    
    setTimeout(() => {
      this.reconnectAttempts.set(url, attempts + 1)
      this.createOptimizedConnection(url, options)
    }, delay)
  }
}
```

### 4.2 Message Compression and Optimization

```typescript
// Message compression and optimization
export class MessageOptimizer {
  private compressionThreshold = 1024 // 1KB
  private batchThreshold = 10 // Batch messages if more than 10 pending
  
  // Compress large messages
  async compressMessage(message: any): Promise<any> {
    const serialized = JSON.stringify(message)
    
    if (serialized.length < this.compressionThreshold) {
      return message // No compression needed
    }
    
    // Use browser's built-in compression if available
    if ('CompressionStream' in window) {
      return await this.compressWithWebStream(message)
    } else {
      return this.compressWithFallback(message)
    }
  }
  
  // Batch messages for high-frequency updates
  async batchMessages(messages: any[]): Promise<any[]> {
    if (messages.length <= this.batchThreshold) {
      return messages
    }
    
    // Group similar messages
    const batches = this.groupMessagesByType(messages)
    
    return Object.entries(batches).map(([type, batch]) => ({
      type: `batch_${type}`,
      count: batch.length,
      data: batch,
      timestamp: Date.now()
    }))
  }
  
  private groupMessagesByType(messages: any[]): Record<string, any[]> {
    return messages.reduce((groups, message) => {
      const type = message.type || 'unknown'
      if (!groups[type]) {
        groups[type] = []
      }
      groups[type].push(message)
      return groups
    }, {} as Record<string, any[]>)
  }
  
  // Optimize message frequency
  createThrottledSender(sendFn: (message: any) => void, throttleMs: number = 100): (message: any) => void {
    let lastSent = 0
    let pendingMessage: any = null
    
    return (message: any) => {
      const now = Date.now()
      
      if (now - lastSent >= throttleMs) {
        // Send immediately if enough time has passed
        if (pendingMessage) {
          sendFn(pendingMessage)
          pendingMessage = null
        }
        sendFn(message)
        lastSent = now
      } else {
        // Store the latest message and send when throttle period expires
        pendingMessage = message
        setTimeout(() => {
          if (pendingMessage) {
            sendFn(pendingMessage)
            pendingMessage = null
          }
        }, throttleMs - (now - lastSent))
      }
    }
  }
}

export const messageOptimizer = new MessageOptimizer()
```

---

## Performance Monitoring and Alerting

### Real-Time Performance Dashboard

```typescript
// Performance monitoring system
export class PerformanceMonitor {
  private metrics: Map<string, MetricCollector> = new Map()
  private alerts: AlertRule[] = []
  private monitoringInterval: NodeJS.Timeout | null = null
  
  constructor() {
    this.initializeMetrics()
    this.startMonitoring()
    this.setupAlertRules()
  }
  
  // Track real-time update performance
  trackUpdateLatency(eventType: string, latency: number): void {
    this.recordMetric('update_latency', {
      eventType,
      latency,
      timestamp: Date.now()
    })
    
    // Alert if latency is too high
    if (latency > 500) {
      this.triggerAlert('high_latency', {
        eventType,
        latency,
        threshold: 500
      })
    }
  }
  
  // Track cache hit rates
  trackCachePerformance(operation: string, hit: boolean): void {
    const cacheMetric = this.metrics.get('cache_performance') as CacheMetricCollector
    if (cacheMetric) {
      cacheMetric.record(operation, hit)
    }
  }
  
  // Track memory usage
  trackMemoryUsage(): void {
    if ('memory' in performance) {
      const memory = (performance as any).memory
      this.recordMetric('memory_usage', {
        used: memory.usedJSHeapSize,
        total: memory.totalJSHeapSize,
        limit: memory.jsHeapSizeLimit,
        timestamp: Date.now()
      })
    }
  }
  
  // Generate performance report
  generatePerformanceReport(): PerformanceReport {
    return {
      updateLatency: this.getUpdateLatencyStats(),
      cachePerformance: this.getCacheStats(),
      memoryUsage: this.getMemoryStats(),
      connectionHealth: this.getConnectionStats(),
      recommendations: this.generateRecommendations()
    }
  }
  
  private generateRecommendations(): string[] {
    const recommendations: string[] = []
    const report = this.generatePerformanceReport()
    
    if (report.updateLatency.average > 300) {
      recommendations.push('Consider reducing batch size for real-time updates')
    }
    
    if (report.cachePerformance.hitRate < 0.85) {
      recommendations.push('Optimize cache TTL values to improve hit rate')
    }
    
    if (report.memoryUsage.trend === 'increasing') {
      recommendations.push('Implement more aggressive memory cleanup')
    }
    
    return recommendations
  }
}

export const performanceMonitor = new PerformanceMonitor()
```

---

## Performance Benchmarking

### Test Scenarios and Metrics

```typescript
// Performance testing framework
export class PerformanceBenchmark {
  async runUpdateLatencyTest(): Promise<UpdateLatencyResults> {
    const testResults: number[] = []
    
    // Test 1: Critical user count updates
    for (let i = 0; i < 100; i++) {
      const startTime = performance.now()
      
      // Simulate user creation event
      await this.simulateUserCreation()
      
      // Measure time until dashboard reflects change
      const endTime = await this.waitForDashboardUpdate()
      
      testResults.push(endTime - startTime)
    }
    
    return {
      average: testResults.reduce((a, b) => a + b) / testResults.length,
      p50: this.calculatePercentile(testResults, 50),
      p95: this.calculatePercentile(testResults, 95),
      p99: this.calculatePercentile(testResults, 99),
      max: Math.max(...testResults),
      min: Math.min(...testResults)
    }
  }
  
  async runCrossBrowserConsistencyTest(): Promise<CrossBrowserResults> {
    const browserA = await this.launchBrowser('admin')
    const browserB = await this.launchBrowser('admin')  
    const browserC = await this.launchBrowser('user')
    
    try {
      // Synchronize all browsers to dashboard
      await Promise.all([
        browserA.navigateToDashboard(),
        browserB.navigateToDashboard(),
        browserC.navigateToDashboard()
      ])
      
      // Record initial states
      const initialStates = await Promise.all([
        browserA.getDashboardState(),
        browserB.getDashboardState(), 
        browserC.getDashboardState()
      ])
      
      // Trigger update from browser A
      await browserA.createTestUser()
      
      // Wait for all browsers to update
      const startTime = Date.now()
      const finalStates = await Promise.all([
        this.waitForStateChange(browserA, initialStates[0]),
        this.waitForStateChange(browserB, initialStates[1]),
        this.waitForStateChange(browserC, initialStates[2])
      ])
      
      const syncTime = Date.now() - startTime
      
      return {
        totalSyncTime: syncTime,
        consistencyAchieved: this.verifyConsistency(finalStates),
        browserLatencies: {
          adminA: await browserA.getLastUpdateLatency(),
          adminB: await browserB.getLastUpdateLatency(),
          userC: await browserC.getLastUpdateLatency()
        }
      }
      
    } finally {
      await Promise.all([
        browserA.close(),
        browserB.close(),
        browserC.close()
      ])
    }
  }
  
  private calculatePercentile(values: number[], percentile: number): number {
    const sorted = [...values].sort((a, b) => a - b)
    const index = Math.ceil((percentile / 100) * sorted.length) - 1
    return sorted[Math.max(0, index)]
  }
}

export const performanceBenchmark = new PerformanceBenchmark()
```

This performance optimization guide provides:

1. **Enhanced Caching** - Multi-tier cache system with predictive refresh
2. **Database Optimization** - Query batching and connection pooling
3. **Frontend Performance** - Smart component updates and memory management
4. **Network Optimization** - WebSocket optimization and message compression
5. **Monitoring** - Real-time performance tracking and alerting

Together, these optimizations will achieve the target **sub-500ms update latency** while maintaining system stability and reliability.
