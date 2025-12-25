// ============================================
// lib/progressive-loading/progressive-loading-strategy.ts
// ============================================

import { smartCacheManager } from '@/lib/cache/smart-cache-manager'
import { adaptiveTTLEngine } from '@/lib/cache/adaptive-ttl-engine'

export interface DataPriority {
  level: 'critical' | 'important' | 'normal' | 'low'
  weight: number
  loadTime: number // maximum acceptable load time in ms
  staleTime: number // how long data can be stale before requiring refresh
  prefetchDistance: number // distance before element comes into view
}

export interface ProgressiveLoadingConfig {
  enablePrefetching: boolean
  enableVirtualScrolling: boolean
  enableCompression: boolean
  batchSize: number
  maxConcurrentRequests: number
  retryAttempts: number
  retryDelay: number
  prefetchMargin: number
  loadingThresholds: {
    fastConnection: number
    slowConnection: number
  }
}

export interface LoadingState {
  isLoading: boolean
  progress: number
  phase: 'initializing' | 'loading' | 'refining' | 'complete'
  currentPriority: DataPriority['level']
  totalItems: number
  loadedItems: number
  error?: Error | null
  cacheHits: number
  networkRequests: number
  timeToFirstByte: number
  timeToInteractive: number
}

export interface LoadingStrategy {
  strategy: 'progressive' | 'batch' | 'streaming' | 'hybrid'
  priorityQueue: Array<{
    data: any
    priority: DataPriority
    dependencies: string[]
    status: 'pending' | 'loading' | 'loaded' | 'error'
    loadTime: number
  }>
  requestBatcher: RequestBatcher
  prefetchManager: PrefetchManager
  errorRecovery: ErrorRecoveryManager
}

class RequestBatcher {
  private batchQueue: Array<{
    request: () => Promise<any>
    priority: DataPriority
    resolve: (value: any) => void
    reject: (error: any) => void
  }> = []

  private batchTimer: NodeJS.Timeout | null = null
  private concurrentRequests = 0
  private readonly maxConcurrent: number

  constructor(maxConcurrent: number = 5) {
    this.maxConcurrent = maxConcurrent
  }

  async addRequest(
    request: () => Promise<any>,
    priority: DataPriority
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      this.batchQueue.push({
        request,
        priority,
        resolve,
        reject
      })

      this.scheduleBatch()
    })
  }

  private scheduleBatch() {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer)
    }

    // Schedule batch processing based on priority and available capacity
    const delay = this.calculateOptimalDelay()
    this.batchTimer = setTimeout(() => this.processBatch(), delay)
  }

  private calculateOptimalDelay(): number {
    const highPriorityCount = this.batchQueue.filter(
      item => item.priority.level === 'critical'
    ).length

    if (highPriorityCount > 0) {
      return 0 // Process immediately for critical items
    }

    if (this.concurrentRequests < this.maxConcurrent * 0.5) {
      return 50 // Quick processing when capacity available
    }

    return 200 // Longer delay when approaching capacity
  }

  private async processBatch() {
    if (this.batchQueue.length === 0) {
      return
    }

    // Sort by priority (critical first, then by weight)
    this.batchQueue.sort((a, b) => {
      const priorityOrder = { critical: 0, important: 1, normal: 2, low: 3 }
      const aPriority = priorityOrder[a.priority.level]
      const bPriority = priorityOrder[b.priority.level]

      if (aPriority !== bPriority) {
        return aPriority - bPriority
      }

      return b.priority.weight - a.priority.weight
    })

    // Process requests up to capacity
    const requestsToProcess = this.batchQueue.splice(0, this.maxConcurrent - this.concurrentRequests)

    const promises = requestsToProcess.map(async (item) => {
      this.concurrentRequests++

      try {
        const result = await item.request()
        item.resolve(result)
      } catch (error) {
        item.reject(error)
      } finally {
        this.concurrentRequests--
        this.scheduleBatch() // Process next batch
      }
    })

    await Promise.allSettled(promises)
  }

  getCurrentLoad(): number {
    return this.concurrentRequests / this.maxConcurrent
  }

  isAtCapacity(): boolean {
    return this.concurrentRequests >= this.maxConcurrent
  }
}

class PrefetchManager {
  private prefetchQueue: Array<{
    url: string
    priority: DataPriority
    dependencies: string[]
    lastRequested: number
  }> = []

  private intersectionObserver: IntersectionObserver | null = null
  private readonly prefetchMargin: number

  constructor(prefetchMargin: number = 200) {
    this.prefetchMargin = prefetchMargin
    this.setupIntersectionObserver()
  }

  private setupIntersectionObserver() {
    if (typeof window === 'undefined') return

    this.intersectionObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const element = entry.target as HTMLElement
            const prefetchData = element.dataset.prefetch

            if (prefetchData) {
              this.prefetch(prefetchData, {
                level: 'normal',
                weight: 0.5,
                loadTime: 1000,
                staleTime: 60000,
                prefetchDistance: this.prefetchMargin
              })
            }
          }
        })
      },
      {
        rootMargin: `${this.prefetchMargin}px`
      }
    )
  }

  async prefetch(url: string, priority: DataPriority, dependencies: string[] = []) {
    const existingRequest = this.prefetchQueue.find(item => item.url === url)
    
    if (existingRequest && existingRequest.priority.level === priority.level) {
      return // Already queued with same priority
    }

    // Remove existing request if new priority is higher
    if (existingRequest && this.getPriorityLevel(priority.level) < this.getPriorityLevel(existingRequest.priority.level)) {
      this.prefetchQueue = this.prefetchQueue.filter(item => item.url !== url)
    }

    this.prefetchQueue.push({
      url,
      priority,
      dependencies,
      lastRequested: Date.now()
    })

    this.schedulePrefetch()
  }

  private schedulePrefetch() {
    // Process prefetch queue in priority order
    this.prefetchQueue.sort((a, b) => {
      const aLevel = this.getPriorityLevel(a.priority.level)
      const bLevel = this.getPriorityLevel(b.priority.level)
      
      if (aLevel !== bLevel) {
        return aLevel - bLevel
      }

      return a.priority.weight - b.priority.weight
    })

    // Process top items (limit to avoid overwhelming network)
    const itemsToProcess = this.prefetchQueue.splice(0, 3)
    
    itemsToProcess.forEach(async (item) => {
      try {
        await this.fetchWithCache(item.url, item.priority)
      } catch (error) {
        console.warn(`Prefetch failed for ${item.url}:`, error)
      }
    })
  }

  private getPriorityLevel(level: DataPriority['level']): number {
    const order = { critical: 0, important: 1, normal: 2, low: 3 }
    return order[level]
  }

  private async fetchWithCache(url: string, priority: DataPriority) {
    const cacheKey = this.generateCacheKey(url)
    const cached = await smartCacheManager.get(cacheKey)

    if (cached) {
      return cached
    }

    const response = await fetch(url)
    const data = await response.json()

    await smartCacheManager.set(cacheKey, data, {
      context: {
        dataType: 'prefetch',
        timeOfDay: new Date(),
        dayOfWeek: new Date().getDay(),
        systemLoad: 'medium'
      },
      metadata: { prefetched: true }
    })

    return data
  }

  private generateCacheKey(url: string): string {
    return `prefetch:${btoa(url)}`
  }

  observeElement(element: HTMLElement, url: string, priority: DataPriority) {
    element.dataset.prefetch = url
    this.intersectionObserver?.observe(element)
  }

  unobserveElement(element: HTMLElement) {
    this.intersectionObserver?.unobserve(element)
  }

  clear() {
    this.prefetchQueue.length = 0
  }
}

class ErrorRecoveryManager {
  private retryMap = new Map<string, { count: number; lastAttempt: number }>()
  private readonly maxRetries: number
  private readonly baseDelay: number

  constructor(maxRetries: number = 3, baseDelay: number = 1000) {
    this.maxRetries = maxRetries
    this.baseDelay = baseDelay
  }

  async executeWithRetry<T>(
    operation: () => Promise<T>,
    key: string
  ): Promise<T> {
    const retryInfo = this.retryMap.get(key) || { count: 0, lastAttempt: 0 }

    try {
      const result = await operation()
      this.retryMap.delete(key) // Clear on success
      return result
    } catch (error) {
      retryInfo.count++
      retryInfo.lastAttempt = Date.now()
      this.retryMap.set(key, retryInfo)

      if (retryInfo.count >= this.maxRetries) {
        this.retryMap.delete(key)
        throw error
      }

      // Exponential backoff with jitter
      const delay = this.baseDelay * Math.pow(2, retryInfo.count - 1)
      const jitter = Math.random() * 0.3 * delay
      const finalDelay = delay + jitter

      await this.sleep(finalDelay)
      return this.executeWithRetry(operation, key)
    }
  }

  getRetryCount(key: string): number {
    return this.retryMap.get(key)?.count || 0
  }

  isExhausted(key: string): boolean {
    const retryInfo = this.retryMap.get(key)
    return retryInfo ? retryInfo.count >= this.maxRetries : false
  }

  clear(key?: string) {
    if (key) {
      this.retryMap.delete(key)
    } else {
      this.retryMap.clear()
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

export class ProgressiveLoadingStrategy {
  private config: ProgressiveLoadingConfig
  private requestBatcher: RequestBatcher
  private prefetchManager: PrefetchManager
  private errorRecovery: ErrorRecoveryManager
  private loadingState: LoadingState

  constructor(config: Partial<ProgressiveLoadingConfig> = {}) {
    this.config = {
      enablePrefetching: true,
      enableVirtualScrolling: true,
      enableCompression: true,
      batchSize: 10,
      maxConcurrentRequests: 5,
      retryAttempts: 3,
      retryDelay: 1000,
      prefetchMargin: 200,
      loadingThresholds: {
        fastConnection: 1500,
        slowConnection: 3000
      },
      ...config
    }

    this.requestBatcher = new RequestBatcher(this.config.maxConcurrentRequests)
    this.prefetchManager = new PrefetchManager(this.config.prefetchMargin)
    this.errorRecovery = new ErrorRecoveryManager(this.config.retryAttempts, this.config.retryDelay)
    this.loadingState = this.createInitialLoadingState()
  }

  private createInitialLoadingState(): LoadingState {
    return {
      isLoading: false,
      progress: 0,
      phase: 'initializing',
      currentPriority: 'normal',
      totalItems: 0,
      loadedItems: 0,
      error: null,
      cacheHits: 0,
      networkRequests: 0,
      timeToFirstByte: 0,
      timeToInteractive: 0
    }
  }

  async loadData<T>(
    dataKey: string,
    dataLoader: () => Promise<T>,
    priority: DataPriority
  ): Promise<T> {
    const startTime = Date.now()
    this.updateLoadingState({
      isLoading: true,
      currentPriority: priority.level,
      phase: 'loading'
    })

    try {
      // Check cache first
      const cacheKey = this.generateCacheKey(dataKey, priority)
      let data: T | null = null

      // Try to get from smart cache
      try {
        data = await smartCacheManager.get(cacheKey)
        if (data) {
          this.updateLoadingState({
            cacheHits: this.loadingState.cacheHits + 1
          })
        }
      } catch (error) {
        console.warn(`Cache lookup failed for ${dataKey}:`, error)
      }

      // Load from network if not in cache or expired
      if (!data) {
        data = await this.requestBatcher.addRequest(dataLoader, priority)
        
        this.updateLoadingState({
          networkRequests: this.loadingState.networkRequests + 1
        })

        // Cache the result
        await this.cacheData(cacheKey, data, priority)
      }

      // Update performance metrics
      const loadTime = Date.now() - startTime
      this.updatePerformanceMetrics(loadTime)

      // Mark as complete
      this.updateLoadingState({
        isLoading: false,
        phase: 'complete',
        loadedItems: this.loadingState.loadedItems + 1,
        progress: Math.min(100, ((this.loadingState.loadedItems + 1) / this.loadingState.totalItems) * 100)
      })

      // At this point, data must be non-null (either from cache or network)
      return data!

    } catch (error) {
      return this.handleLoadError(dataKey, dataLoader, priority, error as Error)
    }
  }

  private async handleLoadError<T>(
    dataKey: string,
    dataLoader: () => Promise<T>,
    priority: DataPriority,
    error: Error
  ): Promise<T> {
    try {
      const retryKey = this.generateCacheKey(dataKey, priority)
      return await this.errorRecovery.executeWithRetry(dataLoader, retryKey)
    } catch (retryError) {
      this.updateLoadingState({
        isLoading: false,
        phase: 'complete',
        error: retryError as Error
      })
      throw retryError
    }
  }

  private generateCacheKey(dataKey: string, priority: DataPriority): string {
    const baseKey = dataKey
    const prioritySuffix = priority.level
    const timeSuffix = Math.floor(Date.now() / priority.staleTime) // Use stale time as part of key
    
    return `${baseKey}:${prioritySuffix}:${timeSuffix}`
  }

  private async cacheData<T>(
    cacheKey: string,
    data: T,
    priority: DataPriority
  ): Promise<void> {
    try {
      await smartCacheManager.set(cacheKey, data, {
        context: {
          dataType: `progressive-${priority.level}`,
          timeOfDay: new Date(),
          dayOfWeek: new Date().getDay(),
          systemLoad: 'medium'
        },
        metadata: {
          priority: priority.level,
          loadTime: priority.loadTime
        }
      })
    } catch (error) {
      console.warn(`Failed to cache data for ${cacheKey}:`, error)
    }
  }

  private updateLoadingState(updates: Partial<LoadingState>) {
    this.loadingState = { ...this.loadingState, ...updates }
  }

  private updatePerformanceMetrics(loadTime: number) {
    this.updateLoadingState({
      timeToFirstByte: this.loadingState.timeToFirstByte === 0 
        ? loadTime 
        : Math.min(this.loadingState.timeToFirstByte, loadTime),
      timeToInteractive: Date.now() // Would be calculated based on user interaction
    })
  }

  getLoadingState(): LoadingState {
    return { ...this.loadingState }
  }

  getRequestBatcher(): RequestBatcher {
    return this.requestBatcher
  }

  getPrefetchManager(): PrefetchManager {
    return this.prefetchManager
  }

  getErrorRecovery(): ErrorRecoveryManager {
    return this.errorRecovery
  }

  // Smart loading based on connection and device capabilities
  adaptLoadingStrategy(): void {
    if (typeof window === 'undefined') return

    const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
    const isSlowConnection = connection && connection.effectiveType && ['slow-2g', '2g'].includes(connection.effectiveType)

    if (isSlowConnection || isMobile) {
      this.config.batchSize = 5
      this.config.maxConcurrentRequests = 3
      this.config.prefetchMargin = 400
    } else if (connection && ['4g', 'ethernet', 'wifi'].includes(connection.effectiveType)) {
      this.config.batchSize = 20
      this.config.maxConcurrentRequests = 8
      this.config.prefetchMargin = 100
    }
  }

  cleanup() {
    this.requestBatcher = new RequestBatcher(this.config.maxConcurrentRequests)
    this.prefetchManager.clear()
    this.errorRecovery.clear()
    this.loadingState = this.createInitialLoadingState()
  }
}

// Export singleton instance
export const progressiveLoadingStrategy = new ProgressiveLoadingStrategy()