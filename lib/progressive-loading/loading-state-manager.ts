// ============================================
// lib/progressive-loading/loading-state-manager.ts
// ============================================

import { 
  progressiveLoadingStrategy, 
  LoadingState as ProgressiveLoadingState,
  LoadingStrategy 
} from './progressive-loading-strategy'
import { criticalPathLoader, CriticalPathState } from './critical-path-loader'
import { responsiveDataLoader } from './responsive-data-loader'
import { errorRecoverySystem } from './error-recovery-system'

export interface UnifiedLoadingState {
  // Overall system state
  isLoading: boolean
  overallProgress: number
  phase: 'initializing' | 'loading-critical' | 'loading-important' | 'loading-normal' | 'complete' | 'error' | 'offline'
  startTime: Date | null
  estimatedTimeRemaining: number
  timeElapsed: number
  
  // Component-specific states
  criticalPath: CriticalPathState
  progressiveLoading: ProgressiveLoadingState
  responsiveLoading: {
    deviceCapabilities: any
    networkInfo: any
    optimalSettings: any
  }
  errorRecovery: any
  
  // Performance metrics
  performanceMetrics: {
    timeToFirstByte: number
    timeToInteractive: number
    totalLoadTime: number
    cacheHitRate: number
    networkRequestCount: number
    averageResponseTime: number
    errorRate: number
  }
  
  // User experience metrics
  userExperience: {
    perceivedLoadTime: number
    contentFullyLoaded: boolean
    criticalContentVisible: boolean
    skeletonVisible: boolean
    errorStateVisible: boolean
    offlineState: boolean
  }
  
  // Resource utilization
  resources: {
    memoryUsage: number
    cpuUsage: number
    networkBandwidth: number
    activeConnections: number
  }
}

export interface LoadingStateConfig {
  enableRealTimeMetrics: boolean
  enablePerformanceTracking: boolean
  enableUserExperienceMetrics: boolean
  updateInterval: number
  maxHistoryEntries: number
  enableDebugging: boolean
}

class LoadingStateManager {
  private config: LoadingStateConfig
  private currentState: UnifiedLoadingState
  private stateHistory: UnifiedLoadingState[] = []
  private updateCallbacks: Set<(state: UnifiedLoadingState) => void> = new Set()
  private updateInterval: NodeJS.Timeout | null = null
  private performanceObserver: PerformanceObserver | null = null

  constructor(config: Partial<LoadingStateConfig> = {}) {
    this.config = {
      enableRealTimeMetrics: true,
      enablePerformanceTracking: true,
      enableUserExperienceMetrics: true,
      updateInterval: 100, // 100ms updates
      maxHistoryEntries: 100,
      enableDebugging: process.env.NODE_ENV === 'development',
      ...config
    }

    this.currentState = this.createInitialState()
    this.setupRealTimeUpdates()
    this.setupPerformanceTracking()
  }

  private createInitialState(): UnifiedLoadingState {
    const now = new Date()
    
    return {
      isLoading: false,
      overallProgress: 0,
      phase: 'initializing',
      startTime: null,
      estimatedTimeRemaining: 0,
      timeElapsed: 0,
      
      criticalPath: {
        isLoading: false,
        progress: 0,
        phase: 'idle',
        currentOperation: '',
        completedCritical: 0,
        totalCritical: 0,
        completedImportant: 0,
        totalImportant: 0,
        timeElapsed: 0,
        estimatedTimeRemaining: 0
      },
      
      progressiveLoading: {
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
      },
      
      responsiveLoading: {
        deviceCapabilities: null,
        networkInfo: null,
        optimalSettings: null
      },
      
      errorRecovery: errorRecoverySystem.getState(),
      
      performanceMetrics: {
        timeToFirstByte: 0,
        timeToInteractive: 0,
        totalLoadTime: 0,
        cacheHitRate: 0,
        networkRequestCount: 0,
        averageResponseTime: 0,
        errorRate: 0
      },
      
      userExperience: {
        perceivedLoadTime: 0,
        contentFullyLoaded: false,
        criticalContentVisible: false,
        skeletonVisible: false,
        errorStateVisible: false,
        offlineState: !navigator.onLine
      },
      
      resources: {
        memoryUsage: 0,
        cpuUsage: 0,
        networkBandwidth: 0,
        activeConnections: 0
      }
    }
  }

  private setupRealTimeUpdates(): void {
    if (!this.config.enableRealTimeMetrics) return

    this.updateInterval = setInterval(() => {
      this.updateUnifiedState()
    }, this.config.updateInterval)
  }

  private setupPerformanceTracking(): void {
    if (!this.config.enablePerformanceTracking || typeof window === 'undefined') return

    try {
      this.performanceObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries()
        entries.forEach((entry) => {
          this.handlePerformanceEntry(entry)
        })
      })

      this.performanceObserver.observe({ entryTypes: ['navigation', 'resource', 'measure'] })
    } catch (error) {
      console.warn('Performance tracking setup failed:', error)
    }
  }

  private handlePerformanceEntry(entry: PerformanceEntry): void {
    if (entry.entryType === 'navigation') {
      const navEntry = entry as PerformanceNavigationTiming
      if (navEntry.loadEventEnd && navEntry.loadEventStart) {
        this.updatePerformanceMetric('totalLoadTime', navEntry.loadEventEnd - navEntry.loadEventStart)
      }
      if (navEntry.responseStart && navEntry.fetchStart) {
        this.updatePerformanceMetric('timeToFirstByte', navEntry.responseStart - navEntry.fetchStart)
      }
    } else if (entry.entryType === 'resource') {
      const resourceEntry = entry as PerformanceResourceTiming
      if (resourceEntry.name.includes('/api/')) {
        this.incrementNetworkRequestCount()
        this.updateAverageResponseTime(resourceEntry.duration)
      }
    } else if (entry.entryType === 'measure') {
      // Custom performance measures
      console.log(`Performance measure: ${entry.name} took ${entry.duration}ms`)
    }
  }

  private updateUnifiedState(): void {
    const now = new Date()
    
    // Calculate time elapsed
    const timeElapsed = this.currentState.startTime 
      ? now.getTime() - this.currentState.startTime.getTime()
      : 0

    // Update responsive loading state
    const deviceCapabilities = responsiveDataLoader.getDeviceCapabilities()
    const networkInfo = responsiveDataLoader.getNetworkInfo()
    const optimalSettings = responsiveDataLoader.getLoadingStats()

    // Update critical path state
    const criticalPathState = criticalPathLoader.getState()

    // Update progressive loading state
    const progressiveLoadingState = progressiveLoadingStrategy.getLoadingState()

    // Update error recovery state
    const errorRecoveryState = errorRecoverySystem.getState()

    // Calculate overall progress and phase
    const { overallProgress, phase } = this.calculateOverallProgress(
      criticalPathState,
      progressiveLoadingState
    )

    // Estimate time remaining
    const estimatedTimeRemaining = this.estimateTimeRemaining(overallProgress, timeElapsed)

    // Update user experience metrics
    const userExperience = this.updateUserExperienceMetrics(
      overallProgress,
      criticalPathState,
      progressiveLoadingState,
      errorRecoveryState
    )

    // Update resource metrics
    const resources = this.updateResourceMetrics()

    // Create new unified state
    const newState: UnifiedLoadingState = {
      ...this.currentState,
      isLoading: criticalPathState.isLoading || progressiveLoadingState.isLoading,
      overallProgress,
      phase,
      timeElapsed,
      estimatedTimeRemaining,
      
      criticalPath: criticalPathState,
      progressiveLoading: progressiveLoadingState,
      
      responsiveLoading: {
        deviceCapabilities,
        networkInfo,
        optimalSettings
      },
      
      errorRecovery: errorRecoveryState,
      
      userExperience,
      resources
    }

    // Check if state has changed significantly
    if (this.shouldUpdateState(newState)) {
      this.currentState = newState
      
      // Store in history
      this.addToHistory(newState)
      
      // Notify callbacks
      this.notifyCallbacks(newState)
      
      // Log state changes in development
      if (this.config.enableDebugging) {
        console.log('Loading state updated:', {
          phase: newState.phase,
          progress: Math.round(newState.overallProgress),
          timeElapsed: Math.round(newState.timeElapsed / 1000) + 's'
        })
      }
    }
  }

  private calculateOverallProgress(
    criticalPath: CriticalPathState,
    progressiveLoading: ProgressiveLoadingState
  ): { overallProgress: number; phase: UnifiedLoadingState['phase'] } {
    // Weight different phases differently
    const weights = {
      critical: 0.6,    // 60% for critical path
      progressive: 0.4  // 40% for progressive loading
    }

    // Calculate critical path progress
    let criticalProgress = 0
    if (criticalPath.totalCritical > 0) {
      criticalProgress = (criticalPath.completedCritical / criticalPath.totalCritical) * 100
    }

    // Calculate progressive loading progress
    let progressiveProgress = 0
    if (progressiveLoading.totalItems > 0) {
      progressiveProgress = (progressiveLoading.loadedItems / progressiveLoading.totalItems) * 100
    }

    // Weighted average
    const overallProgress = (criticalProgress * weights.critical) + (progressiveProgress * weights.progressive)

    // Determine phase based on progress
    let phase: UnifiedLoadingState['phase']
    if (overallProgress === 0) {
      phase = 'initializing'
    } else if (criticalProgress < 100) {
      phase = 'loading-critical'
    } else if (progressiveProgress < 100) {
      phase = 'loading-important'
    } else if (overallProgress < 100) {
      phase = 'loading-normal'
    } else {
      phase = 'complete'
    }

    return { overallProgress, phase }
  }

  private estimateTimeRemaining(progress: number, timeElapsed: number): number {
    if (progress === 0) return 0
    
    const estimatedTotalTime = timeElapsed / (progress / 100)
    return Math.max(0, estimatedTotalTime - timeElapsed)
  }

  private updateUserExperienceMetrics(
    overallProgress: number,
    criticalPath: CriticalPathState,
    progressiveLoading: ProgressiveLoadingState,
    errorRecovery: any
  ): UnifiedLoadingState['userExperience'] {
    const now = new Date()
    const startTime = this.currentState.startTime || now
    const perceivedLoadTime = now.getTime() - startTime.getTime()

    return {
      perceivedLoadTime,
      contentFullyLoaded: overallProgress >= 100,
      criticalContentVisible: criticalPath.completedCritical > 0,
      skeletonVisible: this.currentState.isLoading && overallProgress < 100,
      errorStateVisible: errorRecovery.totalFailures > 0,
      offlineState: !navigator.onLine
    }
  }

  private updateResourceMetrics(): UnifiedLoadingState['resources'] {
    const memoryUsage = this.getMemoryUsage()
    const cpuUsage = this.getCpuUsage()
    const networkBandwidth = this.getNetworkBandwidth()
    const activeConnections = this.getActiveConnections()

    return {
      memoryUsage,
      cpuUsage,
      networkBandwidth,
      activeConnections
    }
  }

  private getMemoryUsage(): number {
    if (typeof window === 'undefined' || !('memory' in performance)) {
      return 0
    }

    const memory = (performance as any).memory
    return memory.usedJSHeapSize / memory.jsHeapSizeLimit
  }

  private getCpuUsage(): number {
    // Simplified CPU usage estimation
    // In a real implementation, you'd use more sophisticated methods
    return Math.random() * 0.1 // Placeholder
  }

  private getNetworkBandwidth(): number {
    const connection = (navigator as any).connection
    return connection?.downlink || 0
  }

  private getActiveConnections(): number {
    // This would be implementation-specific
    // For now, return a placeholder
    return 1
  }

  private updatePerformanceMetric(metric: keyof UnifiedLoadingState['performanceMetrics'], value: number): void {
    this.currentState.performanceMetrics[metric] = value
  }

  private incrementNetworkRequestCount(): void {
    this.currentState.performanceMetrics.networkRequestCount++
  }

  private updateAverageResponseTime(duration: number): void {
    const { networkRequestCount, averageResponseTime } = this.currentState.performanceMetrics
    this.currentState.performanceMetrics.averageResponseTime = 
      (averageResponseTime * (networkRequestCount - 1) + duration) / networkRequestCount
  }

  private shouldUpdateState(newState: UnifiedLoadingState): boolean {
    // Only update if significant changes occurred
    const threshold = 1 // 1% change threshold
    
    const progressChanged = Math.abs(newState.overallProgress - this.currentState.overallProgress) > threshold
    const phaseChanged = newState.phase !== this.currentState.phase
    const loadingChanged = newState.isLoading !== this.currentState.isLoading
    
    return progressChanged || phaseChanged || loadingChanged
  }

  private addToHistory(state: UnifiedLoadingState): void {
    this.stateHistory.push(state)
    
    // Limit history size
    if (this.stateHistory.length > this.config.maxHistoryEntries) {
      this.stateHistory.shift()
    }
  }

  private notifyCallbacks(state: UnifiedLoadingState): void {
    this.updateCallbacks.forEach(callback => {
      try {
        callback(state)
      } catch (error) {
        console.error('Error in loading state callback:', error)
      }
    })
  }

  // Public API methods

  startLoading(): void {
    this.currentState = {
      ...this.currentState,
      isLoading: true,
      phase: 'loading-critical',
      startTime: new Date()
    }
  }

  completeLoading(): void {
    this.currentState = {
      ...this.currentState,
      isLoading: false,
      phase: 'complete',
      overallProgress: 100
    }
  }

  getCurrentState(): UnifiedLoadingState {
    return { ...this.currentState }
  }

  getStateHistory(): UnifiedLoadingState[] {
    return [...this.stateHistory]
  }

  subscribe(callback: (state: UnifiedLoadingState) => void): () => void {
    this.updateCallbacks.add(callback)
    
    // Return unsubscribe function
    return () => {
      this.updateCallbacks.delete(callback)
    }
  }

  getPerformanceReport(): any {
    const { performanceMetrics, userExperience, resources } = this.currentState
    
    return {
      performance: performanceMetrics,
      userExperience,
      resources,
      summary: {
        totalLoadTime: performanceMetrics.totalLoadTime,
        timeToInteractive: performanceMetrics.timeToInteractive,
        cacheHitRate: performanceMetrics.cacheHitRate,
        errorRate: performanceMetrics.errorRate,
        overallScore: this.calculateOverallScore()
      }
    }
  }

  private calculateOverallScore(): number {
    const { performanceMetrics, userExperience } = this.currentState
    
    // Simple scoring algorithm
    let score = 100
    
    // Penalize for long load times
    if (performanceMetrics.totalLoadTime > 3000) score -= 20
    if (performanceMetrics.timeToInteractive > 5000) score -= 20
    
    // Penalize for high error rates
    if (performanceMetrics.errorRate > 0.1) score -= 15
    
    // Penalize for offline states
    if (userExperience.offlineState) score -= 25
    
    return Math.max(0, score)
  }

  exportMetrics(): string {
    const report = this.getPerformanceReport()
    return JSON.stringify(report, null, 2)
  }

  reset(): void {
    this.currentState = this.createInitialState()
    this.stateHistory = []
  }

  cleanup(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval)
      this.updateInterval = null
    }
    
    if (this.performanceObserver) {
      this.performanceObserver.disconnect()
      this.performanceObserver = null
    }
    
    this.updateCallbacks.clear()
  }
}

// Export singleton instance
export const loadingStateManager = new LoadingStateManager()

// Note: UnifiedLoadingState is already exported above as an interface