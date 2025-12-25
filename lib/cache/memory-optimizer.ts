// ============================================
// lib/cache/memory-optimizer.ts
// Cache memory optimization system for Phase 3
// ============================================

import { smartCacheManager, CacheEntry } from './smart-cache-manager';

export interface MemoryOptimizationConfig {
  memoryThreshold: number // Percentage of memory usage to trigger optimization
  gcInterval: number // Garbage collection interval in milliseconds
  compressionRatioThreshold: number // Minimum compression ratio to keep compressed data
  maxOptimizationTime: number // Maximum time to spend on optimization per cycle
  enableAggressiveGC: boolean // Enable aggressive garbage collection
  memoryPressureMultiplier: number // Factor for memory pressure calculations
}

export interface MemoryStats {
  totalMemory: number
  usedMemory: number
  availableMemory: number
  compressionRatio: number
  gcCount: number
  lastGC: number
  optimizationCount: number
  memoryPressure: 'low' | 'medium' | 'high' | 'critical'
  hitRate?: number
}

export interface GCStats {
  entriesEvicted: number
  memoryFreed: number
  compressionSavings: number
  optimizationTime: number
  gcReason: string
}

export class MemoryOptimizer {
  private static instance: MemoryOptimizer;
  private config: MemoryOptimizationConfig;
  private gcStats: GCStats[];
  private lastOptimization: number = 0;
  private optimizationScheduled: boolean = false;
  private gcTimer: NodeJS.Timeout | null = null;
  private memoryStats: MemoryStats;

  private constructor(config: Partial<MemoryOptimizationConfig> = {}) {
    this.config = {
      memoryThreshold: 80, // 80% memory usage
      gcInterval: 30000, // 30 seconds
      compressionRatioThreshold: 0.3, // 30% compression ratio
      maxOptimizationTime: 5000, // 5 seconds
      enableAggressiveGC: false,
      memoryPressureMultiplier: 1.5,
      ...config
    };

    this.gcStats = [];
    this.memoryStats = this.initializeMemoryStats();
    this.startGCTimer();
  }

  static getInstance(config?: Partial<MemoryOptimizationConfig>): MemoryOptimizer {
    if (!MemoryOptimizer.instance) {
      MemoryOptimizer.instance = new MemoryOptimizer(config);
    }
    return MemoryOptimizer.instance;
  }

  private initializeMemoryStats(): MemoryStats {
    return {
      totalMemory: this.getTotalMemory(),
      usedMemory: 0,
      availableMemory: 0,
      compressionRatio: 0,
      gcCount: 0,
      lastGC: 0,
      optimizationCount: 0,
      memoryPressure: 'low'
    };
  }

  private getTotalMemory(): number {
    // In a browser environment, we can't directly get total memory
    // So we estimate based on cache config and available memory
    if (typeof performance !== 'undefined' && (performance as any).memory) {
      return (performance as any).memory.jsHeapSizeLimit || 0;
    }
    
    // Fallback to estimated memory based on cache size
    const cacheStats = smartCacheManager.getStats();
    return cacheStats.totalSize * 4; // Estimate 4x cache size as total memory
  }

  private getUsedMemory(): number {
    const cacheStats = smartCacheManager.getStats();
    return cacheStats.totalSize;
  }

  private getAvailableMemory(): number {
    return this.memoryStats.totalMemory - this.memoryStats.usedMemory;
  }

  private startGCTimer(): void {
    if (this.gcTimer) {
      clearInterval(this.gcTimer);
    }

    this.gcTimer = setInterval(() => {
      this.scheduleOptimization();
    }, this.config.gcInterval);
  }

  scheduleOptimization(): void {
    if (this.optimizationScheduled) return;
    
    this.optimizationScheduled = true;
    
    // Schedule optimization with slight delay to avoid blocking
    setTimeout(() => {
      this.optimize().finally(() => {
        this.optimizationScheduled = false;
      });
    }, 100);
  }

  async optimize(): Promise<void> {
    const startTime = Date.now();
    this.updateMemoryStats();

    console.log('Starting memory optimization...', {
      memoryPressure: this.memoryStats.memoryPressure,
      usedMemory: this.memoryStats.usedMemory,
      totalMemory: this.memoryStats.totalMemory
    });

    const initialMemory = this.memoryStats.usedMemory;
    let optimizationPerformed = false;

    try {
      // Check if optimization is needed based on memory pressure
      if (this.shouldOptimize()) {
        optimizationPerformed = true;
        
        // Step 1: Compress eligible data
        await this.compressEligibleData();
        
        // Step 2: Evict least valuable entries if still under pressure
        if (this.shouldEvictEntries()) {
          await this.evictLeastValuableEntries();
        }
        
        // Step 3: Aggressive GC if enabled and memory pressure is critical
        if (this.config.enableAggressiveGC && this.memoryStats.memoryPressure === 'critical') {
          await this.performAggressiveGC();
        }

        // Step 4: Final cleanup
        await this.performCleanup();
      }

      // Update final stats
      this.updateMemoryStats();
      const finalMemory = this.memoryStats.usedMemory;
      const memoryFreed = initialMemory - finalMemory;
      const optimizationTime = Date.now() - startTime;

      this.recordGCStats({
        entriesEvicted: this.getEvictedEntriesCount(),
        memoryFreed,
        compressionSavings: this.getCompressionSavings(),
        optimizationTime,
        gcReason: this.getGCReason()
      });

      this.memoryStats.optimizationCount++;
      this.memoryStats.lastGC = Date.now();

      console.log('Memory optimization completed', {
        optimizationPerformed,
        memoryFreed,
        optimizationTime,
        newMemoryPressure: this.memoryStats.memoryPressure
      });

    } catch (error) {
      console.error('Memory optimization failed:', error);
      throw error;
    }
  }

  private shouldOptimize(): boolean {
    // Check memory pressure
    const memoryUsagePercent = (this.memoryStats.usedMemory / this.memoryStats.totalMemory) * 100;
    
    if (memoryUsagePercent >= this.config.memoryThreshold) {
      return true;
    }

    // Check if it's been too long since last optimization
    const timeSinceLastGC = Date.now() - this.memoryStats.lastGC;
    if (timeSinceLastGC > this.config.gcInterval * 2) {
      return true;
    }

    // Check cache hit rate - if hit rate is low, optimize
    const cacheStats = smartCacheManager.getStats();
    if (cacheStats.hitRate < 0.7) {
      return true;
    }

    return false;
  }

  private shouldEvictEntries(): boolean {
    const memoryUsagePercent = (this.memoryStats.usedMemory / this.memoryStats.totalMemory) * 100;
    return memoryUsagePercent >= (this.config.memoryThreshold + 10);
  }

  private async compressEligibleData(): Promise<void> {
    const entries = smartCacheManager.getAllEntries();
    const maxTime = Date.now() + this.config.maxOptimizationTime / 2; // Half the time for compression

    for (const entry of entries) {
      if (Date.now() > maxTime) break; // Don't exceed time limit

      // Check if entry can be better compressed
      if (this.canImproveCompression(entry)) {
        await this.recompressEntry(entry);
      }
    }
  }

  private canImproveCompression(entry: CacheEntry): boolean {
    // Skip if already compressed and compression is good
    if (entry.compressed) {
      // Check if we can achieve better compression
      return false; // For now, don't recompress already compressed data
    }

    // Check if data size justifies compression
    return entry.size >= this.config.compressionRatioThreshold * 1000;
  }

  private async recompressEntry(entry: CacheEntry): Promise<void> {
    try {
      // Get the original data
      const originalData = await smartCacheManager.get(entry.key, entry.namespace);
      if (originalData !== null) {
        // Re-compress with better settings
        // For now, we'll just mark it for recompression later
        // In a full implementation, this would involve re-compressing with better algorithms
        console.debug(`Marked ${entry.key} for recompression`);
      }
    } catch (error) {
      console.warn(`Failed to recompress ${entry.key}:`, error);
    }
  }

  private async evictLeastValuableEntries(): Promise<void> {
    const entries = smartCacheManager.getAllEntries();
    const entriesWithValue = entries.map(entry => ({
      ...entry,
      valueScore: this.calculateValueScore(entry)
    }));

    // Sort by value score (lowest first)
    entriesWithValue.sort((a, b) => a.valueScore - b.valueScore);

    const maxTime = Date.now() + this.config.maxOptimizationTime / 2;
    let evictedCount = 0;

    for (const entry of entriesWithValue) {
      if (Date.now() > maxTime) break;
      if (evictedCount >= 10) break; // Limit evictions per cycle

      // Don't evict critical entries
      if (this.isCriticalEntry(entry)) {
        continue;
      }

      smartCacheManager.delete(entry.key, entry.namespace);
      evictedCount++;
    }

    console.log(`Evicted ${evictedCount} least valuable entries`);
  }

  private calculateValueScore(entry: CacheEntry): number {
    let score = 0;

    // Higher score for recently accessed entries
    const timeSinceAccess = Date.now() - entry.lastAccessed;
    const accessScore = Math.max(0, 1 - (timeSinceAccess / (24 * 60 * 60 * 1000))); // 1 day decay
    score += accessScore * 10;

    // Higher score for frequently accessed entries
    score += Math.log(entry.accessCount + 1) * 5;

    // Lower score for large entries (expensive to keep in memory)
    score -= Math.log(entry.size / 1024) * 2; // Size penalty

    // Higher score for compressed entries (more efficient)
    if (entry.compressed) {
      score += 2;
    }

    // Lower score for old entries
    const timeSinceCreated = Date.now() - entry.timestamp;
    const ageScore = Math.max(0, 1 - (timeSinceCreated / (7 * 24 * 60 * 60 * 1000))); // 7 day decay
    score += ageScore * 3;

    return score;
  }

  private isCriticalEntry(entry: CacheEntry): boolean {
    // Don't evict critical dashboard data or user profile data
    return entry.key.includes('critical') || 
           entry.key.includes('profile') || 
           entry.key.includes('realtime');
  }

  private async performAggressiveGC(): Promise<void> {
    console.log('Performing aggressive garbage collection...');
    
    // Clear all non-critical cache entries
    const entries = smartCacheManager.getAllEntries();
    const maxTime = Date.now() + 2000; // 2 seconds for aggressive GC
    
    let evictedCount = 0;
    for (const entry of entries) {
      if (Date.now() > maxTime) break;
      
      if (!this.isCriticalEntry(entry)) {
        smartCacheManager.delete(entry.key, entry.namespace);
        evictedCount++;
      }
    }

    console.log(`Aggressive GC evicted ${evictedCount} entries`);
  }

  private async performCleanup(): Promise<void> {
    // Perform final cleanup tasks
    const now = Date.now();
    
    // Clean up expired entries manually if needed
    const entries = smartCacheManager.getAllEntries();
    for (const entry of entries) {
      if (now - entry.timestamp > entry.ttl) {
        smartCacheManager.delete(entry.key, entry.namespace);
      }
    }
  }

  private updateMemoryStats(): void {
    this.memoryStats.totalMemory = this.getTotalMemory();
    this.memoryStats.usedMemory = this.getUsedMemory();
    this.memoryStats.availableMemory = this.getAvailableMemory();

    const cacheStats = smartCacheManager.getStats();
    this.memoryStats.compressionRatio = cacheStats.compressionRatio;
    
    this.memoryStats.memoryPressure = this.calculateMemoryPressure();
  }

  private calculateMemoryPressure(): 'low' | 'medium' | 'high' | 'critical' {
    const usagePercent = (this.memoryStats.usedMemory / this.memoryStats.totalMemory) * 100;
    
    if (usagePercent >= 95) return 'critical';
    if (usagePercent >= this.config.memoryThreshold) return 'high';
    if (usagePercent >= this.config.memoryThreshold * 0.7) return 'medium';
    return 'low';
  }

  private recordGCStats(stats: GCStats): void {
    this.gcStats.push(stats);
    
    // Keep only recent stats
    if (this.gcStats.length > 100) {
      this.gcStats = this.gcStats.slice(-100);
    }

    this.memoryStats.gcCount++;
  }

  private getEvictedEntriesCount(): number {
    return this.gcStats.length > 0 ? this.gcStats[this.gcStats.length - 1].entriesEvicted : 0;
  }

  private getCompressionSavings(): number {
    const cacheStats = smartCacheManager.getStats();
    return cacheStats.totalSize * cacheStats.compressionRatio;
  }

  private getGCReason(): string {
    const memoryUsagePercent = (this.memoryStats.usedMemory / this.memoryStats.totalMemory) * 100;
    
    if (memoryUsagePercent >= 95) return 'critical-memory-pressure';
    if (memoryUsagePercent >= this.config.memoryThreshold) return 'memory-threshold-exceeded';
    if (this.memoryStats.hitRate && this.memoryStats.hitRate < 0.7) return 'low-hit-rate';
    return 'scheduled-cleanup';
  }

  // Public API methods
  getStats(): MemoryStats {
    this.updateMemoryStats();
    return { ...this.memoryStats };
  }

  getGCStats(): GCStats[] {
    return [...this.gcStats];
  }

  forceOptimization(): Promise<void> {
    return this.optimize();
  }

  updateConfig(newConfig: Partial<MemoryOptimizationConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    if (newConfig.gcInterval) {
      this.startGCTimer();
    }
  }

  // Cleanup method
  destroy(): void {
    if (this.gcTimer) {
      clearInterval(this.gcTimer);
      this.gcTimer = null;
    }
    
    this.gcStats = [];
  }
}