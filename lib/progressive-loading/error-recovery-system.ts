// ============================================
// lib/progressive-loading/error-recovery-system.ts
// ============================================

import { smartCacheManager } from '@/lib/cache/smart-cache-manager'
import { progressiveLoadingStrategy } from './progressive-loading-strategy'

export interface ErrorRecoveryConfig {
  maxRetries: number
  retryDelay: number
  exponentialBackoff: boolean
  circuitBreakerThreshold: number
  circuitBreakerTimeout: number
  enableOfflineMode: boolean
  offlineDataRetention: number // hours
  fallbackStrategies: {
    useCache: boolean
    useStaleData: boolean
    showOfflineMessage: boolean
  }
}

export interface RecoveryAttempt {
  id: string
  timestamp: Date
  error: Error
  retryCount: number
  strategy: RecoveryStrategy
  success: boolean
  duration: number
}

export type RecoveryStrategy = 
  | 'retry-immediate'
  | 'retry-delayed'
  | 'retry-exponential'
  | 'fallback-cache'
  | 'fallback-stale'
  | 'offline-mode'
  | 'circuit-breaker'

export interface OfflineData {
  data: any
  timestamp: Date
  expiresAt: Date
  source: 'cache' | 'stale' | 'user-input'
  quality: 'full' | 'partial' | 'minimal'
}

export interface ErrorRecoveryState {
  isOnline: boolean
  circuitBreakerOpen: boolean
  totalFailures: number
  recentFailures: number
  lastSuccess: Date | null
  offlineDataAvailable: boolean
  currentStrategy: RecoveryStrategy | null
}

class ErrorRecoverySystem {
  private config: ErrorRecoveryConfig
  private state: ErrorRecoveryState
  private failureHistory: Map<string, RecoveryAttempt[]> = new Map()
  private circuitBreakerState: Map<string, 'closed' | 'open' | 'half-open'> = new Map()
  private offlineStorage: Map<string, OfflineData> = new Map()
  private retryTimeouts: Map<string, NodeJS.Timeout> = new Map()

  constructor(config: Partial<ErrorRecoveryConfig> = {}) {
    this.config = {
      maxRetries: 3,
      retryDelay: 1000,
      exponentialBackoff: true,
      circuitBreakerThreshold: 5,
      circuitBreakerTimeout: 60000, // 1 minute
      enableOfflineMode: true,
      offlineDataRetention: 24, // 24 hours
      fallbackStrategies: {
        useCache: true,
        useStaleData: true,
        showOfflineMessage: true
      },
      ...config
    }

    this.state = this.createInitialState()
    this.setupConnectivityMonitoring()
    this.setupOfflineDataManagement()
  }

  private createInitialState(): ErrorRecoveryState {
    return {
      isOnline: navigator.onLine,
      circuitBreakerOpen: false,
      totalFailures: 0,
      recentFailures: 0,
      lastSuccess: null,
      offlineDataAvailable: false,
      currentStrategy: null
    }
  }

  private setupConnectivityMonitoring(): void {
    if (typeof window === 'undefined') return

    // Monitor online/offline status
    const updateOnlineStatus = () => {
      const wasOnline = this.state.isOnline
      this.state.isOnline = navigator.onLine

      if (!wasOnline && this.state.isOnline) {
        // Just came back online
        console.log('Connection restored, attempting to recover')
        this.handleConnectionRestore()
      } else if (wasOnline && !this.state.isOnline) {
        // Just went offline
        console.log('Connection lost, entering offline mode')
        this.handleConnectionLoss()
      }
    }

    window.addEventListener('online', updateOnlineStatus)
    window.addEventListener('offline', updateOnlineStatus)
  }

  private setupOfflineDataManagement(): void {
    // Periodically clean up expired offline data
    setInterval(() => {
      this.cleanupExpiredOfflineData()
    }, 60000) // Check every minute
  }

  private cleanupExpiredOfflineData(): void {
    const now = new Date()
    const expiredKeys: string[] = []

    this.offlineStorage.forEach((data, key) => {
      if (now > data.expiresAt) {
        expiredKeys.push(key)
      }
    })

    expiredKeys.forEach(key => {
      this.offlineStorage.delete(key)
      console.log(`Cleaned up expired offline data: ${key}`)
    })

    this.state.offlineDataAvailable = this.offlineStorage.size > 0
  }

  // Main error recovery function
  async recoverFromError<T>(
    operation: () => Promise<T>,
    dataKey: string,
    context: string = 'general'
  ): Promise<T> {
    const failureKey = `${context}:${dataKey}`

    try {
      // Check circuit breaker first
      if (this.isCircuitBreakerOpen(failureKey)) {
        console.warn(`Circuit breaker open for ${failureKey}, attempting fallback`)
        return await this.attemptFallback<T>(operation, dataKey, 'circuit-breaker')
      }

      // Attempt the operation
      const startTime = Date.now()
      const result = await operation()
      const duration = Date.now() - startTime

      // Record success
      this.recordSuccess(failureKey, duration)
      return result

    } catch (error) {
      console.error(`Operation failed for ${failureKey}:`, error)
      
      // Record failure
      this.recordFailure(failureKey, error as Error)
      
      // Check if we should attempt recovery
      if (!this.state.isOnline) {
        return this.attemptFallback<T>(operation, dataKey, 'offline-mode')
      }

      // Determine recovery strategy
      const strategy = this.determineRecoveryStrategy(failureKey, error as Error)
      
      try {
        return await this.executeRecoveryStrategy<T>(operation, dataKey, strategy)
      } catch (recoveryError) {
        console.error(`Recovery strategy ${strategy} failed:`, recoveryError)
        return this.attemptFallback<T>(operation, dataKey, strategy)
      }
    }
  }

  private determineRecoveryStrategy(failureKey: string, error: Error): RecoveryStrategy {
    const history = this.failureHistory.get(failureKey) || []
    const recentFailures = history.filter(h => 
      Date.now() - h.timestamp.getTime() < 300000 // 5 minutes
    ).length

    // If too many recent failures, use circuit breaker
    if (recentFailures >= this.config.circuitBreakerThreshold) {
      return 'circuit-breaker'
    }

    // Check error type for appropriate strategy
    if (error.name === 'NetworkError' || error.message.includes('fetch')) {
      if (this.state.isOnline) {
        return recentFailures === 0 ? 'retry-immediate' : 'retry-exponential'
      } else {
        return 'offline-mode'
      }
    }

    if (error.name === 'TimeoutError') {
      return 'retry-delayed'
    }

    if (error.name === 'ValidationError' || error.name === 'AuthError') {
      return 'fallback-cache' // Don't retry validation/auth errors
    }

    // Default to exponential backoff for unknown errors
    return 'retry-exponential'
  }

  private async executeRecoveryStrategy<T>(
    operation: () => Promise<T>,
    dataKey: string,
    strategy: RecoveryStrategy
  ): Promise<T> {
    this.state.currentStrategy = strategy

    switch (strategy) {
      case 'retry-immediate':
        return this.retryOperation(operation, dataKey, 0)

      case 'retry-delayed':
        return this.retryOperation(operation, dataKey, this.config.retryDelay)

      case 'retry-exponential':
        return this.retryOperationWithBackoff(operation, dataKey)

      case 'fallback-cache':
        return this.fallbackToCache<T>(dataKey)

      case 'fallback-stale':
        return this.fallbackToStaleData<T>(dataKey)

      case 'offline-mode':
        return this.enterOfflineMode<T>(operation, dataKey)

      case 'circuit-breaker':
        return this.handleCircuitBreaker<T>(operation, dataKey)

      default:
        throw new Error(`Unknown recovery strategy: ${strategy}`)
    }
  }

  private async retryOperation<T>(
    operation: () => Promise<T>,
    dataKey: string,
    delay: number
  ): Promise<T> {
    if (delay > 0) {
      await this.sleep(delay)
    }

    return operation()
  }

  private async retryOperationWithBackoff<T>(
    operation: () => Promise<T>,
    dataKey: string
  ): Promise<T> {
    const failureKey = `general:${dataKey}`
    const history = this.failureHistory.get(failureKey) || []
    const retryCount = history.length

    const delay = this.config.exponentialBackoff 
      ? this.config.retryDelay * Math.pow(2, retryCount)
      : this.config.retryDelay

    if (retryCount >= this.config.maxRetries) {
      throw new Error(`Max retries (${this.config.maxRetries}) exceeded`)
    }

    console.log(`Retrying operation with ${delay}ms delay (attempt ${retryCount + 1})`)
    
    await this.sleep(delay)
    return operation()
  }

  private async fallbackToCache<T>(dataKey: string): Promise<T> {
    try {
      const cachedData = await smartCacheManager.get(dataKey)
      if (cachedData) {
        console.log(`Using cached data for ${dataKey}`)
        return cachedData as T
      }
    } catch (error) {
      console.warn(`Cache lookup failed for ${dataKey}:`, error)
    }

    throw new Error('No cached data available')
  }

  private async fallbackToStaleData<T>(dataKey: string): Promise<T> {
    // Try to get stale data (data that might be expired but still usable)
    try {
      const cacheKey = `stale:${dataKey}`
      const staleData = await smartCacheManager.get(cacheKey)
      if (staleData) {
        console.log(`Using stale data for ${dataKey}`)
        return staleData as T
      }
    } catch (error) {
      console.warn(`Stale data lookup failed for ${dataKey}:`, error)
    }

    throw new Error('No stale data available')
  }

  private async enterOfflineMode<T>(
    operation: () => Promise<T>,
    dataKey: string
  ): Promise<T> {
    // Store the operation for later when connection is restored
    this.storeOfflineOperation(dataKey, operation)

    // Try to get any available offline data
    const offlineData = this.offlineStorage.get(dataKey)
    if (offlineData) {
      console.log(`Using offline data for ${dataKey}`)
      return offlineData.data as T
    }

    // If no offline data, return a minimal/fallback response
    return this.generateMinimalResponse<T>(dataKey)
  }

  private async handleCircuitBreaker<T>(
    operation: () => Promise<T>,
    dataKey: string
  ): Promise<T> {
    const failureKey = `general:${dataKey}`
    
    // Try fallback first
    try {
      return await this.fallbackToCache<T>(dataKey)
    } catch {
      // If cache fails, try stale data
      try {
        return await this.fallbackToStaleData<T>(dataKey)
      } catch {
        // If all fallbacks fail, return minimal response
        return this.generateMinimalResponse<T>(dataKey)
      }
    }
  }

  private async attemptFallback<T>(
    operation: () => Promise<T>,
    dataKey: string,
    strategy: RecoveryStrategy
  ): Promise<T> {
    // Try different fallback strategies
    const strategies: RecoveryStrategy[] = ['fallback-cache', 'fallback-stale', 'offline-mode']
    
    for (const fallbackStrategy of strategies) {
      try {
        console.log(`Attempting fallback strategy: ${fallbackStrategy}`)
        return await this.executeRecoveryStrategy(operation, dataKey, fallbackStrategy)
      } catch (error) {
        console.warn(`Fallback strategy ${fallbackStrategy} failed:`, error)
        continue
      }
    }

    // If all fallbacks fail, return minimal response
    console.warn('All fallback strategies exhausted, returning minimal response')
    return this.generateMinimalResponse<T>(dataKey)
  }

  private recordSuccess(failureKey: string, duration: number): void {
    this.state.totalFailures = 0
    this.state.recentFailures = 0
    this.state.lastSuccess = new Date()
    this.state.circuitBreakerOpen = false

    // Reset circuit breaker for this key
    this.circuitBreakerState.set(failureKey, 'closed')

    console.log(`Operation succeeded for ${failureKey} in ${duration}ms`)
  }

  private recordFailure(failureKey: string, error: Error): void {
    this.state.totalFailures++
    this.state.recentFailures++

    // Record in history
    const attempt: RecoveryAttempt = {
      id: `${failureKey}-${Date.now()}`,
      timestamp: new Date(),
      error,
      retryCount: this.failureHistory.get(failureKey)?.length || 0,
      strategy: this.state.currentStrategy || 'retry-immediate',
      success: false,
      duration: 0
    }

    if (!this.failureHistory.has(failureKey)) {
      this.failureHistory.set(failureKey, [])
    }
    this.failureHistory.get(failureKey)!.push(attempt)

    // Update circuit breaker
    this.updateCircuitBreaker(failureKey)

    console.error(`Operation failed for ${failureKey}:`, error)
  }

  private updateCircuitBreaker(failureKey: string): void {
    const history = this.failureHistory.get(failureKey) || []
    const recentFailures = history.filter(h => 
      Date.now() - h.timestamp.getTime() < 300000 // 5 minutes
    )

    if (recentFailures.length >= this.config.circuitBreakerThreshold) {
      this.circuitBreakerState.set(failureKey, 'open')
      this.state.circuitBreakerOpen = true

      // Set timer to try half-open state
      setTimeout(() => {
        this.circuitBreakerState.set(failureKey, 'half-open')
        console.log(`Circuit breaker half-open for ${failureKey}`)
      }, this.config.circuitBreakerTimeout)
    }
  }

  private isCircuitBreakerOpen(failureKey: string): boolean {
    const state = this.circuitBreakerState.get(failureKey)
    return state === 'open'
  }

  private handleConnectionRestore(): void {
    console.log('Connection restored, processing queued operations')
    
    // Process any stored offline operations
    this.processOfflineOperations()
    
    // Reset failure counts
    this.state.recentFailures = 0
    
    // Try to refresh cached data
    this.refreshOfflineData()
  }

  private handleConnectionLoss(): void {
    console.log('Connection lost, preparing offline mode')
    
    // Mark as offline
    this.state.isOnline = false
  }

  private storeOfflineOperation(dataKey: string, operation: () => Promise<any>): void {
    // In a real implementation, you'd store this in IndexedDB or similar
    console.log(`Storing offline operation for ${dataKey}`)
  }

  private async processOfflineOperations(): Promise<void> {
    // Process queued offline operations when connection is restored
    console.log('Processing offline operations')
  }

  private async refreshOfflineData(): Promise<void> {
    // Refresh data from server when connection is restored
    console.log('Refreshing offline data from server')
  }

  private generateMinimalResponse<T>(dataKey: string): T {
    // Return a minimal/fallback response based on the data key
    console.log(`Generating minimal response for ${dataKey}`)
    
    // This is a generic fallback - in real implementation, 
    // you'd have specific fallbacks for different types of data
    return {} as T
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  // Public API methods
  
  getState(): ErrorRecoveryState {
    return { ...this.state }
  }

  isOnline(): boolean {
    return this.state.isOnline
  }

  hasOfflineData(dataKey: string): boolean {
    return this.offlineStorage.has(dataKey)
  }

  getOfflineData(dataKey: string): OfflineData | null {
    return this.offlineStorage.get(dataKey) || null
  }

  storeOfflineData(dataKey: string, data: any, quality: OfflineData['quality'] = 'full'): void {
    const expiresAt = new Date(Date.now() + (this.config.offlineDataRetention * 60 * 60 * 1000))
    
    this.offlineStorage.set(dataKey, {
      data,
      timestamp: new Date(),
      expiresAt,
      source: 'user-input',
      quality
    })

    this.state.offlineDataAvailable = true
    console.log(`Stored offline data for ${dataKey}`)
  }

  clearOfflineData(dataKey?: string): void {
    if (dataKey) {
      this.offlineStorage.delete(dataKey)
    } else {
      this.offlineStorage.clear()
    }

    this.state.offlineDataAvailable = this.offlineStorage.size > 0
  }

  getFailureHistory(dataKey?: string): RecoveryAttempt[] {
    if (dataKey) {
      return this.failureHistory.get(`general:${dataKey}`) || []
    }
    
    // Return all failures
    const allFailures: RecoveryAttempt[] = []
    this.failureHistory.forEach(failures => {
      allFailures.push(...failures)
    })
    
    return allFailures.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
  }

  resetFailureHistory(): void {
    this.failureHistory.clear()
    this.state.totalFailures = 0
    this.state.recentFailures = 0
  }

  setOfflineMode(enabled: boolean): void {
    this.config.enableOfflineMode = enabled
    if (!enabled) {
      this.clearOfflineData()
    }
  }

  // Cleanup method
  cleanup(): void {
    // Clear all timeouts
    this.retryTimeouts.forEach(timeout => clearTimeout(timeout))
    this.retryTimeouts.clear()
    
    // Clean up event listeners would be done here if added
  }
}

// Export singleton instance
export const errorRecoverySystem = new ErrorRecoverySystem()