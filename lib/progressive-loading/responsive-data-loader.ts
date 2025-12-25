// ============================================
// lib/progressive-loading/responsive-data-loader.ts
// ============================================

import { progressiveLoadingStrategy, DataPriority } from './progressive-loading-strategy'
import { smartCacheManager } from '@/lib/cache/smart-cache-manager'

export interface DeviceCapabilities {
  isMobile: boolean
  isTablet: boolean
  isDesktop: boolean
  isLowEndDevice: boolean
  screenSize: 'small' | 'medium' | 'large' | 'xlarge'
  pixelRatio: number
  memory: 'low' | 'medium' | 'high'
  cores: number
}

export interface NetworkInfo {
  effectiveType: 'slow-2g' | '2g' | '3g' | '4g' | 'wifi' | 'ethernet' | 'unknown'
  downlink: number // Mbps
  rtt: number // ms
  saveData: boolean
  isConnectionExpensive: boolean
}

export interface ResponsiveLoadingConfig {
  // Data size limits based on device capabilities
  maxDataSize: {
    small: number // bytes
    medium: number
    large: number
    xlarge: number
  }
  
  // Batch sizes for different screen sizes
  batchSizes: {
    small: number
    medium: number
    large: number
    xlarge: number
  }
  
  // Image quality settings
  imageQuality: {
    small: number // 0-1
    medium: number
    large: number
    xlarge: number
  }
  
  // Prefetch distances
  prefetchDistances: {
    small: number
    medium: number
    large: number
    xlarge: number
  }
  
  // Compression settings
  enableCompression: boolean
  compressionThreshold: number
  
  // Lazy loading thresholds
  lazyLoadingThresholds: {
    small: number
    medium: number
    large: number
    xlarge: number
  }
}

export interface ResponsiveDataRequest {
  url: string
  priority: DataPriority
  deviceOptimized: boolean
  compressed: boolean
  cached: boolean
  dataSize: number
  loadingTime: number
}

class ResponsiveDataLoader {
  private config: ResponsiveLoadingConfig
  private deviceCapabilities: DeviceCapabilities | null = null
  private networkInfo: NetworkInfo | null = null
  private performanceObserver: PerformanceObserver | null = null

  constructor(config: Partial<ResponsiveLoadingConfig> = {}) {
    this.config = {
      maxDataSize: {
        small: 100 * 1024,      // 100KB for small screens
        medium: 500 * 1024,     // 500KB for medium screens
        large: 2 * 1024 * 1024, // 2MB for large screens
        xlarge: 5 * 1024 * 1024 // 5MB for extra large screens
      },
      batchSizes: {
        small: 5,
        medium: 10,
        large: 20,
        xlarge: 50
      },
      imageQuality: {
        small: 0.6,
        medium: 0.7,
        large: 0.8,
        xlarge: 0.9
      },
      prefetchDistances: {
        small: 200,
        medium: 150,
        large: 100,
        xlarge: 50
      },
      enableCompression: true,
      compressionThreshold: 1024, // 1KB
      lazyLoadingThresholds: {
        small: 50,
        medium: 30,
        large: 20,
        xlarge: 10
      },
      ...config
    }

    this.detectDeviceCapabilities()
    this.detectNetworkInfo()
    this.setupPerformanceMonitoring()
  }

  private detectDeviceCapabilities(): void {
    if (typeof window === 'undefined') return

    const screen = window.screen
    const userAgent = navigator.userAgent
    const hardwareConcurrency = navigator.hardwareConcurrency || 4
    const deviceMemory = (navigator as any).deviceMemory || 4

    // Detect device type
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent)
    const isTablet = /iPad|Android(?=.*Tablet)|Tab/i.test(userAgent)
    const isDesktop = !isMobile && !isTablet

    // Determine screen size category
    let screenSize: DeviceCapabilities['screenSize']
    const width = screen.width

    if (width < 640) {
      screenSize = 'small'
    } else if (width < 1024) {
      screenSize = 'medium'
    } else if (width < 1440) {
      screenSize = 'large'
    } else {
      screenSize = 'xlarge'
    }

    // Determine device performance level
    const isLowEndDevice = hardwareConcurrency <= 2 || deviceMemory <= 2 || screen.width <= 640

    // Memory classification
    let memory: DeviceCapabilities['memory']
    if (deviceMemory <= 2) {
      memory = 'low'
    } else if (deviceMemory <= 4) {
      memory = 'medium'
    } else {
      memory = 'high'
    }

    this.deviceCapabilities = {
      isMobile,
      isTablet,
      isDesktop,
      isLowEndDevice,
      screenSize,
      pixelRatio: window.devicePixelRatio || 1,
      memory,
      cores: hardwareConcurrency
    }

    console.log('Device capabilities detected:', this.deviceCapabilities)
  }

  private detectNetworkInfo(): void {
    if (typeof window === 'undefined' || !('connection' in navigator)) {
      return
    }

    const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection

    if (!connection) return

    this.networkInfo = {
      effectiveType: connection.effectiveType || 'unknown',
      downlink: connection.downlink || 0,
      rtt: connection.rtt || 0,
      saveData: connection.saveData || false,
      isConnectionExpensive: connection.saveData || false
    }

    // Listen for network changes
    connection.addEventListener('change', () => {
      this.networkInfo = {
        effectiveType: connection.effectiveType || 'unknown',
        downlink: connection.downlink || 0,
        rtt: connection.rtt || 0,
        saveData: connection.saveData || false,
        isConnectionExpensive: connection.saveData || false
      }
    })

    console.log('Network info detected:', this.networkInfo)
  }

  private setupPerformanceMonitoring(): void {
    if (typeof window === 'undefined' || !('PerformanceObserver' in window)) {
      return
    }

    try {
      this.performanceObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries()
        entries.forEach((entry) => {
          if (entry.entryType === 'navigation') {
            // Monitor page load performance
            const navEntry = entry as PerformanceNavigationTiming
            if (navEntry.loadEventEnd && navEntry.loadEventStart) {
              console.log('Page load time:', navEntry.loadEventEnd - navEntry.loadEventStart)
            }
          } else if (entry.entryType === 'resource') {
            // Monitor resource loading performance
            const resourceEntry = entry as PerformanceResourceTiming
            if (resourceEntry.name.includes('/api/')) {
              console.log(`API call ${resourceEntry.name} took ${resourceEntry.duration}ms`)
            }
          }
        })
      })

      this.performanceObserver.observe({ entryTypes: ['navigation', 'resource'] })
    } catch (error) {
      console.warn('Performance observer setup failed:', error)
    }
  }

  getDeviceCapabilities(): DeviceCapabilities | null {
    return this.deviceCapabilities
  }

  getNetworkInfo(): NetworkInfo | null {
    return this.networkInfo
  }

  getOptimalBatchSize(): number {
    if (!this.deviceCapabilities) {
      return this.config.batchSizes.medium
    }

    const { screenSize } = this.deviceCapabilities
    return this.config.batchSizes[screenSize]
  }

  getOptimalDataSizeLimit(): number {
    if (!this.deviceCapabilities) {
      return this.config.maxDataSize.medium
    }

    const { screenSize, isLowEndDevice } = this.deviceCapabilities
    
    // Apply network constraints
    if (this.networkInfo?.saveData || this.networkInfo?.isConnectionExpensive) {
      return this.config.maxDataSize.small // Conservative limit for metered connections
    }

    // Apply device constraints
    if (isLowEndDevice) {
      return Math.min(this.config.maxDataSize[screenSize], this.config.maxDataSize.small)
    }

    return this.config.maxDataSize[screenSize]
  }

  getOptimalImageQuality(): number {
    if (!this.deviceCapabilities) {
      return this.config.imageQuality.medium
    }

    const { screenSize, pixelRatio } = this.deviceCapabilities
    
    let quality = this.config.imageQuality[screenSize]
    
    // Adjust for high DPI displays
    if (pixelRatio > 2) {
      quality = Math.min(quality + 0.1, 1.0)
    }

    // Reduce quality for metered connections
    if (this.networkInfo?.saveData || this.networkInfo?.isConnectionExpensive) {
      quality = Math.max(quality - 0.2, 0.4)
    }

    return quality
  }

  getOptimalPrefetchDistance(): number {
    if (!this.deviceCapabilities) {
      return this.config.prefetchDistances.medium
    }

    const { screenSize } = this.deviceCapabilities
    return this.config.prefetchDistances[screenSize]
  }

  getLazyLoadingThreshold(): number {
    if (!this.deviceCapabilities) {
      return this.config.lazyLoadingThresholds.medium
    }

    const { screenSize } = this.deviceCapabilities
    return this.config.lazyLoadingThresholds[screenSize]
  }

  // Apply responsive optimizations to a data request
  optimizeDataRequest<T>(
    originalRequest: () => Promise<T>,
    priority: DataPriority,
    dataKey: string
  ): () => Promise<T> {
    return () => {
      const dataSizeLimit = this.getOptimalDataSizeLimit()
      const batchSize = this.getOptimalBatchSize()
      const shouldCompress = this.config.enableCompression && this.getNetworkCompressionPreference()

      // Create a modified request that respects device capabilities
      return this.createOptimizedRequest(originalRequest, {
        dataSizeLimit,
        batchSize,
        shouldCompress,
        priority
      })()
    }
  }

  private getNetworkCompressionPreference(): boolean {
    if (!this.networkInfo) return true

    // Don't compress on very slow connections to avoid extra processing time
    if (this.networkInfo.effectiveType === 'slow-2g' || this.networkInfo.effectiveType === '2g') {
      return false
    }

    // Compress by default for slower connections
    if (this.networkInfo.effectiveType === '3g') {
      return true
    }

    // Always compress on 4G+ for better performance
    return true
  }

  private createOptimizedRequest<T>(
    originalRequest: () => Promise<T>,
    options: {
      dataSizeLimit: number
      batchSize: number
      shouldCompress: boolean
      priority: DataPriority
    }
  ): () => Promise<T> {
    return () => {
      const startTime = performance.now()
      
      return new Promise<T>((resolve, reject) => {
        originalRequest()
          .then(data => {
            // Apply responsive optimizations
            const optimizedData = this.applyDataOptimizations(data, options)
            
            const loadTime = performance.now() - startTime
            console.log(`Optimized request completed in ${loadTime.toFixed(2)}ms`)
            
            resolve(optimizedData as T)
          })
          .catch(error => {
            console.error('Optimized request failed:', error)
            reject(error)
          })
      })
    }
  }

  private applyDataOptimizations(data: any, options: any): any {
    // Apply compression if enabled and beneficial
    if (options.shouldCompress && this.config.enableCompression) {
      return this.compressDataIfBeneficial(data, options)
    }

    // Apply data size limits
    if (this.getDataSize(data) > options.dataSizeLimit) {
      return this.truncateData(data, options.dataSizeLimit)
    }

    return data
  }

  private compressDataIfBeneficial(data: any, options: any): any {
    const dataSize = this.getDataSize(data)
    
    if (dataSize < this.config.compressionThreshold) {
      return data // Don't compress small data
    }

    try {
      // In a real implementation, you would use a compression library
      // For now, we'll just simulate compression
      const compressedSize = Math.floor(dataSize * 0.7) // Simulate 30% compression
      
      if (compressedSize < dataSize) {
        console.log(`Compressed data from ${dataSize} to ${compressedSize} bytes`)
        // Return compressed version
        return {
          compressed: true,
          data: data,
          originalSize: dataSize
        }
      }
    } catch (error) {
      console.warn('Compression failed, returning original data:', error)
    }

    return data
  }

  private truncateData(data: any, maxSize: number): any {
    const dataSize = this.getDataSize(data)
    
    if (dataSize <= maxSize) {
      return data
    }

    console.warn(`Data size ${dataSize} exceeds limit ${maxSize}, truncating`)

    if (Array.isArray(data)) {
      // Truncate array and add truncation marker
      const truncatedSize = Math.floor(maxSize / this.getAverageItemSize(data))
      return {
        truncated: true,
        originalLength: data.length,
        data: data.slice(0, truncatedSize),
        remaining: data.length - truncatedSize
      }
    } else if (typeof data === 'object' && data !== null) {
      // For objects, remove non-essential properties
      const optimized: any = { ...data }
      
      // Remove large non-critical properties
      const nonCriticalKeys = Object.keys(optimized).filter(key => 
        typeof optimized[key] === 'string' && 
        optimized[key].length > 1000
      )
      
      nonCriticalKeys.forEach(key => {
        if (this.getDataSize(optimized) > maxSize) {
          delete optimized[key]
        }
      })

      return optimized
    }

    return data
  }

  private getDataSize(data: any): number {
    try {
      return new Blob([JSON.stringify(data)]).size
    } catch (error) {
      return JSON.stringify(data).length
    }
  }

  private getAverageItemSize(array: any[]): number {
    if (array.length === 0) return 0
    const totalSize = array.reduce((sum, item) => sum + this.getDataSize(item), 0)
    return totalSize / array.length
  }

  // Load data with responsive optimizations
  async loadResponsiveData<T>(
    dataKey: string,
    dataLoader: () => Promise<T>,
    priority: DataPriority
  ): Promise<T> {
    const optimizedLoader = this.optimizeDataRequest(dataLoader, priority, dataKey)
    
    return progressiveLoadingStrategy.loadData(dataKey, optimizedLoader, priority)
  }

  // Monitor and adapt based on performance
  adaptToPerformance(): void {
    if (typeof window === 'undefined') return

    // Monitor memory usage
    if ('memory' in performance) {
      const memory = (performance as any).memory
      const memoryUsageRatio = memory.usedJSHeapSize / memory.jsHeapSizeLimit
      
      if (memoryUsageRatio > 0.8) {
        // High memory usage - be more conservative
        console.warn('High memory usage detected, adjusting loading strategy')
        this.config.maxDataSize.small *= 0.5
        this.config.maxDataSize.medium *= 0.7
      }
    }

    // Monitor CPU usage (simplified)
    const startTime = performance.now()
    setTimeout(() => {
      const elapsed = performance.now() - startTime
      if (elapsed > 100) {
        // High CPU usage detected
        console.warn('High CPU usage detected, adjusting loading strategy')
        this.config.batchSizes.small *= 0.8
        this.config.batchSizes.medium *= 0.8
      }
    }, 50)
  }

  // Get responsive loading statistics
  getLoadingStats() {
    return {
      deviceCapabilities: this.deviceCapabilities,
      networkInfo: this.networkInfo,
      optimalBatchSize: this.getOptimalBatchSize(),
      optimalDataSizeLimit: this.getOptimalDataSizeLimit(),
      optimalImageQuality: this.getOptimalImageQuality(),
      optimalPrefetchDistance: this.getOptimalPrefetchDistance(),
      lazyLoadingThreshold: this.getLazyLoadingThreshold()
    }
  }

  cleanup(): void {
    if (this.performanceObserver) {
      this.performanceObserver.disconnect()
      this.performanceObserver = null
    }
  }
}

// Export singleton instance
export const responsiveDataLoader = new ResponsiveDataLoader()