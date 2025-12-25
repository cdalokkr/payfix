// ============================================
// lib/cache/advanced-cache-manager.ts
// Enhanced cache management system for Phase 3
// ============================================

import { smartCacheManager } from './smart-cache-manager';
import { cacheInvalidation } from './cache-invalidation';
import { backgroundRefresher } from './background-refresher';
import { adaptiveTTLEngine } from './adaptive-ttl-engine';
import { MemoryOptimizer } from './memory-optimizer';
import { CacheConsistency } from './cache-consistency';

export interface AdvancedCacheConfig {
  // Smart cache manager config
  maxSize: number
  maxEntries: number
  enableCompression: boolean
  enableBackgroundRefresh: boolean
  enableLRU: boolean
  compressionThreshold: number
  defaultTTL: number
  cleanupInterval: number
  
  // Smart invalidation config
  enableCrossTabSync: boolean
  crossTabChannelName?: string
  maxEventHistory: number
  debounceTime: number
  
  // Background refresh config
  enabled: boolean
  maxConcurrentRefreshes: number
  refreshInterval: number
  maxBackoffTime: number
  priorityThreshold: number
  enableVisibilityCheck: boolean
  
  // Memory optimization config
  enableMemoryOptimization: boolean
  memoryThreshold: number
  gcInterval: number
  compressionRatioThreshold: number
  
  // Consistency config
  enableConsistencyChecks: boolean
  consistencyCheckInterval: number
  maxInconsistencyRetries: number
}

export interface CacheOperationMetrics {
  totalOperations: number
  successfulOperations: number
  failedOperations: number
  averageResponseTime: number
  cacheHitRate: number
  memoryUsage: {
    used: number
    total: number
    compressionRatio: number
  }
  backgroundRefreshRate: number
  invalidationEvents: number
  consistencyScore: number
}

export interface CacheDependency {
  sourceKey: string
  targetKeys: string[]
  dependencyType: 'strong' | 'weak' | 'conditional'
  autoInvalidate: boolean
}

class AdvancedCacheManager {
  private static instance: AdvancedCacheManager;
  private config: AdvancedCacheConfig;
  private metrics: CacheOperationMetrics;
  private dependencies: Map<string, CacheDependency[]> = new Map();
  private consistencyMonitor: CacheConsistency;
  private memoryOptimizer: MemoryOptimizer;
  private smartInvalidator: any;
  private operationTimers: Map<string, number> = new Map();

  private constructor(config: Partial<AdvancedCacheConfig> = {}) {
    this.config = {
      // Default cache config
      maxSize: 100 * 1024 * 1024, // 100MB
      maxEntries: 2000,
      enableCompression: true,
      enableBackgroundRefresh: true,
      enableLRU: true,
      compressionThreshold: 1024,
      defaultTTL: 5 * 60 * 1000, // 5 minutes
      cleanupInterval: 60 * 1000,
      
      // Smart invalidation config
      enableCrossTabSync: true,
      crossTabChannelName: 'advanced-cache-invalidation',
      maxEventHistory: 1000,
      debounceTime: 100,
      
      // Background refresh config
      enabled: true,
      maxConcurrentRefreshes: 5,
      refreshInterval: 3000,
      maxBackoffTime: 300000,
      priorityThreshold: 1,
      enableVisibilityCheck: true,
      
      // Memory optimization config
      enableMemoryOptimization: true,
      memoryThreshold: 80, // 80% memory usage
      gcInterval: 30000, // 30 seconds
      compressionRatioThreshold: 0.3, // 30% compression ratio
      
      // Consistency config
      enableConsistencyChecks: true,
      consistencyCheckInterval: 60000, // 1 minute
      maxInconsistencyRetries: 3,
      ...config
    };

    this.metrics = this.initializeMetrics();
    
    // Initialize components
    this.consistencyMonitor = CacheConsistency.getInstance({
      enableCrossTabSync: this.config.enableCrossTabSync,
      consistencyCheckInterval: this.config.consistencyCheckInterval,
      maxInconsistencyRetries: this.config.maxInconsistencyRetries
    });
    
    this.memoryOptimizer = MemoryOptimizer.getInstance({
      memoryThreshold: this.config.memoryThreshold,
      gcInterval: this.config.gcInterval,
      compressionRatioThreshold: this.config.compressionRatioThreshold
    });
    
    this.smartInvalidator = {
      invalidate: (key: string, reason?: string, namespace?: string) => {
        smartCacheManager.delete(key, namespace);
      },
      invalidateNamespace: (ns: string, reason?: string) => {
        smartCacheManager.invalidateNamespace(ns);
      },
      shouldInvalidate: (sourceKey: string, targetKeys: string[]) => true
    };
    
    this.initializeManagers();
    this.setupEventListeners();
    this.startMonitoring();
  }

  static getInstance(config?: Partial<AdvancedCacheConfig>): AdvancedCacheManager {
    if (!AdvancedCacheManager.instance) {
      AdvancedCacheManager.instance = new AdvancedCacheManager(config);
    }
    return AdvancedCacheManager.instance;
  }

  private initializeManagers(): void {
    // Configure underlying managers with advanced settings
    smartCacheManager.updateConfig({
      maxSize: this.config.maxSize,
      maxEntries: this.config.maxEntries,
      enableCompression: this.config.enableCompression,
      enableBackgroundRefresh: this.config.enableBackgroundRefresh,
      enableLRU: this.config.enableLRU,
      compressionThreshold: this.config.compressionThreshold,
      defaultTTL: this.config.defaultTTL,
      cleanupInterval: this.config.cleanupInterval
    });

    // Update background refresher config
    backgroundRefresher.updateConfig({
      enabled: this.config.enabled,
      maxConcurrentRefreshes: this.config.maxConcurrentRefreshes,
      refreshInterval: this.config.refreshInterval,
      maxBackoffTime: this.config.maxBackoffTime,
      priorityThreshold: this.config.priorityThreshold,
      enableVisibilityCheck: this.config.enableVisibilityCheck
    });
  }

  private initializeMetrics(): CacheOperationMetrics {
    return {
      totalOperations: 0,
      successfulOperations: 0,
      failedOperations: 0,
      averageResponseTime: 0,
      cacheHitRate: 0,
      memoryUsage: {
        used: 0,
        total: this.config.maxSize,
        compressionRatio: 0
      },
      backgroundRefreshRate: 0,
      invalidationEvents: 0,
      consistencyScore: 1.0
    };
  }

  private setupEventListeners(): void {
    // Listen for cache invalidation events
    cacheInvalidation.addEventListener('user-action', (event) => {
      this.handleInvalidationEvent(event);
    });

    cacheInvalidation.addEventListener('data-change', (event) => {
      this.handleInvalidationEvent(event);
    });

    cacheInvalidation.addEventListener('time-based', (event) => {
      this.handleInvalidationEvent(event);
    });

    // Listen for cache operations to update metrics
    smartCacheManager.getStats(); // Initialize stats
  }

  private startMonitoring(): void {
    // Start metrics collection
    setInterval(() => {
      this.updateMetrics();
    }, 5000);

    // Start memory optimization
    if (this.config.enableMemoryOptimization) {
      setInterval(() => {
        this.memoryOptimizer.forceOptimization();
      }, this.config.gcInterval);
    }

    // Start consistency checks
    if (this.config.enableConsistencyChecks) {
      setInterval(() => {
        this.performConsistencyCheck();
      }, this.config.consistencyCheckInterval);
    }
  }

  private handleInvalidationEvent(event: any): void {
    this.metrics.invalidationEvents++;
    
    // Handle dependency-based invalidation
    this.handleDependencyInvalidation(event.key);
    
    // Trigger memory optimization if needed
    if (this.config.enableMemoryOptimization) {
      this.memoryOptimizer.scheduleOptimization();
    }
  }

  private handleDependencyInvalidation(sourceKey: string): void {
    const dependencies = this.dependencies.get(sourceKey);
    if (!dependencies) return;

    for (const dep of dependencies) {
      if (dep.autoInvalidate) {
        // Smart invalidation based on dependency type
        if (dep.dependencyType === 'strong') {
          dep.targetKeys.forEach(key => {
            this.invalidate(key, 'dependency');
          });
        } else if (dep.dependencyType === 'conditional') {
          // Conditional invalidation logic
          this.performConditionalInvalidation(dep);
        }
      }
    }
  }

  private performConditionalInvalidation(dependency: CacheDependency): void {
    // Check if invalidation conditions are met
    const shouldInvalidate = this.smartInvalidator.shouldInvalidate(
      dependency.sourceKey,
      dependency.targetKeys
    );
    
    if (shouldInvalidate) {
      dependency.targetKeys.forEach(key => {
        this.invalidate(key, 'conditional-dependency');
      });
    }
  }

  private updateMetrics(): void {
    const cacheStats = smartCacheManager.getStats();
    const refreshStatus = backgroundRefresher.getRefreshStatus();
    const memoryStats = this.memoryOptimizer.getStats();

    this.metrics = {
      ...this.metrics,
      cacheHitRate: cacheStats.hitRate,
      memoryUsage: {
        used: cacheStats.totalSize,
        total: this.config.maxSize,
        compressionRatio: cacheStats.compressionRatio
      },
      backgroundRefreshRate: refreshStatus.activeRefreshes / refreshStatus.totalTasks || 0,
      consistencyScore: this.consistencyMonitor.getConsistencyScore()
    };
  }

  private async performConsistencyCheck(): Promise<void> {
    if (!this.config.enableConsistencyChecks) return;

    try {
      const inconsistencies = await this.consistencyMonitor.checkConsistency();
      
      if (inconsistencies.length > 0) {
        // Attempt to resolve inconsistencies
        await this.resolveInconsistencies(inconsistencies);
      }
    } catch (error) {
      console.error('Consistency check failed:', error);
    }
  }

  private async resolveInconsistencies(inconsistencies: any[]): Promise<void> {
    for (const inconsistency of inconsistencies) {
      try {
        // Retry based on retry count
        if (inconsistency.retryCount < this.config.maxInconsistencyRetries) {
          inconsistency.retryCount++;
          
          // Refresh the data
          await this.forceRefresh(inconsistency.key);
        }
      } catch (error) {
        console.error(`Failed to resolve inconsistency for ${inconsistency.key}:`, error);
      }
    }
  }

  // Public API methods
  async set<T>(
    key: string,
    data: T,
    options: {
      namespace?: string
      ttl?: number
      dataType?: string
      context?: any
      metadata?: Record<string, unknown>
      refreshFunction?: () => Promise<T>
      dependencies?: string[]
    } = {}
  ): Promise<void> {
    const startTime = Date.now();
    this.startOperationTimer(key);

    try {
      // Input validation
      if (!key || typeof key !== 'string') {
        throw new Error('Cache key must be a non-empty string');
      }
      if (data === undefined) {
        throw new Error('Cache data cannot be undefined');
      }

      // Set up dependencies if provided
      if (options.dependencies && Array.isArray(options.dependencies)) {
        try {
          this.addDependency(key, options.dependencies);
        } catch (error) {
          console.warn('Failed to set up dependencies:', error);
          // Continue with cache operation even if dependencies fail
        }
      }

      // Use adaptive TTL if possible
      let ttl = options.ttl;
      try {
        if (options.dataType && options.context) {
          ttl = adaptiveTTLEngine.calculateOptimalTTL(options.dataType, options.context);
        }
      } catch (error) {
        console.warn('Failed to calculate adaptive TTL, using default:', error);
        ttl = options.ttl || this.config.defaultTTL;
      }

      await smartCacheManager.set(key, data, {
        namespace: options.namespace,
        ttl,
        dataType: options.dataType,
        context: options.context,
        metadata: options.metadata,
        refreshFunction: options.refreshFunction
      });

      this.recordSuccessfulOperation(key, startTime);
    } catch (error) {
      this.recordFailedOperation(key, startTime);
      console.error(`Cache set operation failed for key ${key}:`, error);
      
      // Don't throw error in production - implement graceful fallback
      if (process.env.NODE_ENV === 'development') {
        throw error;
      }
      
      // Graceful fallback: try to store without compression or advanced features
      try {
        await this.fallbackSet(key, data, options);
      } catch (fallbackError) {
        console.error('Fallback cache operation also failed:', fallbackError);
        // In production, just log and continue - don't throw
        if (process.env.NODE_ENV !== 'production') {
          throw new Error(`Cache operation failed: ${(error as Error).message}`);
        }
      }
    } finally {
      this.endOperationTimer(key);
    }
  }

  private async fallbackSet<T>(key: string, data: T, options: any): Promise<void> {
    // Simple fallback without compression or advanced features
    try {
      // Use localStorage as ultimate fallback
      if (typeof window !== 'undefined' && window.localStorage) {
        const fallbackKey = `fallback-cache:${key}`;
        const fallbackData = {
          data: JSON.stringify(data),
          timestamp: Date.now(),
          ttl: options.ttl || this.config.defaultTTL
        };
        localStorage.setItem(fallbackKey, JSON.stringify(fallbackData));
      }
    } catch (error) {
      console.error('All cache fallbacks failed:', error);
      throw error;
    }
  }

  async get<T>(key: string, namespace?: string): Promise<T | null> {
    const startTime = Date.now();
    this.startOperationTimer(key);

    try {
      // Input validation
      if (!key || typeof key !== 'string') {
        throw new Error('Cache key must be a non-empty string');
      }

      let result: T | null = null;
      
      try {
        result = await smartCacheManager.get<T>(key, namespace);
      } catch (cacheError) {
        console.warn(`Primary cache get failed for ${key}, trying fallback:`, cacheError);
        
        // Try fallback mechanisms
        result = await this.fallbackGet<T>(key, namespace);
      }

      this.recordSuccessfulOperation(key, startTime);
      return result;
    } catch (error) {
      this.recordFailedOperation(key, startTime);
      console.error(`Cache get operation failed for key ${key}:`, error);
      
      // Don't throw error in production - return null as graceful fallback
      if (process.env.NODE_ENV === 'development') {
        throw error;
      }
      
      return null; // Graceful fallback
    } finally {
      this.endOperationTimer(key);
    }
  }

  private async fallbackGet<T>(key: string, namespace?: string): Promise<T | null> {
    try {
      // Check localStorage fallback
      if (typeof window !== 'undefined' && window.localStorage) {
        const fallbackKey = `fallback-cache:${namespace ? namespace + ':' : ''}${key}`;
        const fallbackData = localStorage.getItem(fallbackKey);
        
        if (fallbackData) {
          const parsed = JSON.parse(fallbackData);
          const now = Date.now();
          
          // Check if fallback data is still valid
          if (now - parsed.timestamp < parsed.ttl) {
            return JSON.parse(parsed.data) as T;
          } else {
            // Expired fallback data
            localStorage.removeItem(fallbackKey);
          }
        }
      }
    } catch (error) {
      console.warn('Fallback cache get failed:', error);
    }
    
    return null;
  }

  invalidate(key: string, reason?: string, namespace?: string): void {
    // Smart invalidation
    this.smartInvalidator.invalidate(key, reason, namespace);
    
    // Invalidate through underlying manager
    smartCacheManager.delete(key, namespace);
  }

  invalidateNamespace(namespace: string, reason?: string): void {
    // Smart namespace invalidation
    this.smartInvalidator.invalidateNamespace(namespace, reason);
    
    // Invalidate through underlying manager
    smartCacheManager.invalidateNamespace(namespace);
  }

  async forceRefresh(key: string, namespace?: string): Promise<void> {
    const fullKey = namespace ? `${namespace}:${key}` : key;
    
    // Get refresh task ID and force refresh
    const tasks = backgroundRefresher.getAllTasks();
    const task = tasks.find(t => `${t.namespace}:${t.key}` === fullKey);
    
    if (task) {
      await backgroundRefresher.forceRefresh(task.id);
    }
  }

  addDependency(sourceKey: string, targetKeys: string[], dependencyType: 'strong' | 'weak' | 'conditional' = 'strong'): void {
    const dependency: CacheDependency = {
      sourceKey,
      targetKeys,
      dependencyType,
      autoInvalidate: true
    };

    const existing = this.dependencies.get(sourceKey) || [];
    existing.push(dependency);
    this.dependencies.set(sourceKey, existing);
  }

  removeDependency(sourceKey: string, targetKey: string): void {
    const dependencies = this.dependencies.get(sourceKey);
    if (dependencies) {
      this.dependencies.set(
        sourceKey,
        dependencies.filter(dep => !dep.targetKeys.includes(targetKey))
      );
    }
  }

  getMetrics(): CacheOperationMetrics {
    return { ...this.metrics };
  }

  getDependencyGraph(): Map<string, CacheDependency[]> {
    return new Map(this.dependencies);
  }

  optimize(): Promise<void> {
    return this.memoryOptimizer.optimize();
  }

  // Internal helper methods
  private startOperationTimer(key: string): void {
    this.operationTimers.set(key, Date.now());
  }

  private endOperationTimer(key: string): void {
    this.operationTimers.delete(key);
  }

  private recordSuccessfulOperation(key: string, startTime: number): void {
    this.metrics.totalOperations++;
    this.metrics.successfulOperations++;
    
    const responseTime = Date.now() - startTime;
    this.metrics.averageResponseTime = 
      (this.metrics.averageResponseTime * (this.metrics.successfulOperations - 1) + responseTime) /
      this.metrics.successfulOperations;
  }

  private recordFailedOperation(key: string, startTime: number): void {
    this.metrics.totalOperations++;
    this.metrics.failedOperations++;
  }

  // Cleanup method
  destroy(): void {
    smartCacheManager.clear();
    cacheInvalidation.destroy();
    backgroundRefresher.destroy();
    this.consistencyMonitor.destroy();
    this.memoryOptimizer.destroy();
    this.smartInvalidator.destroy?.();
    this.dependencies.clear();
    this.operationTimers.clear();
  }
}

export const advancedCacheManager = AdvancedCacheManager.getInstance();