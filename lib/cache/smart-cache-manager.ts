// ============================================
// lib/cache/smart-cache-manager.ts
// ============================================

import { adaptiveTTLEngine, TTLCalculationContext } from './adaptive-ttl-engine';
import { cacheInvalidation, CacheInvalidationEvent } from './cache-invalidation';
import { backgroundRefresher, RefreshTask } from './background-refresher';

export interface CacheEntry<T = unknown> {
  key: string
  namespace: string
  data: T
  timestamp: number
  ttl: number
  accessCount: number
  lastAccessed: number
  compressed: boolean
  size: number
  metadata?: Record<string, unknown>
}

export interface CacheStats {
  totalEntries: number
  totalSize: number
  hitRate: number
  missRate: number
  entriesByNamespace: Record<string, number>
  oldestEntry: number
  newestEntry: number
  averageTTL: number
  compressionRatio: number
}

export interface SmartCacheConfig {
  maxSize: number // Maximum cache size in bytes
  maxEntries: number // Maximum number of entries
  enableCompression: boolean
  enableBackgroundRefresh: boolean
  enableLRU: boolean
  compressionThreshold: number // Minimum size in bytes to compress
  defaultTTL: number // Default TTL in milliseconds
  cleanupInterval: number // Cleanup interval in milliseconds
}

class SmartCacheManager {
  private static instance: SmartCacheManager;
  private cache: Map<string, CacheEntry> = new Map();
  private accessOrder: string[] = []; // For LRU eviction
  private config: SmartCacheConfig;
  private stats: {
    hits: number
    misses: number
    totalSize: number
    compressionSavings: number
  };
  private cleanupTimer: NodeJS.Timeout | null = null;
  private refreshTasks: Map<string, string> = new Map(); // cache key to refresh task ID

  private constructor(config: Partial<SmartCacheConfig> = {}) {
    this.config = {
      maxSize: 50 * 1024 * 1024, // 50MB
      maxEntries: 1000,
      enableCompression: true,
      enableBackgroundRefresh: true,
      enableLRU: true,
      compressionThreshold: 1024, // 1KB
      defaultTTL: 5 * 60 * 1000, // 5 minutes
      cleanupInterval: 60 * 1000, // 1 minute
      ...config
    };

    this.stats = {
      hits: 0,
      misses: 0,
      totalSize: 0,
      compressionSavings: 0
    };

    this.initializeCleanup();
    this.setupInvalidationListeners();
  }

  static getInstance(config?: Partial<SmartCacheConfig>): SmartCacheManager {
    if (!SmartCacheManager.instance) {
      SmartCacheManager.instance = new SmartCacheManager(config);
    }
    return SmartCacheManager.instance;
  }

  private initializeCleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.config.cleanupInterval);
  }

  private setupInvalidationListeners(): void {
    // Listen for invalidation events
    cacheInvalidation.addEventListener('user-action', (event) => {
      this.handleInvalidationEvent(event);
    });

    cacheInvalidation.addEventListener('data-change', (event) => {
      this.handleInvalidationEvent(event);
    });

    cacheInvalidation.addEventListener('cross-tab', (event) => {
      this.handleInvalidationEvent(event);
    });
  }

  private handleInvalidationEvent(event: CacheInvalidationEvent): void {
    const fullKey = this.getFullKey(event.key, event.namespace);
    
    if (event.namespace) {
      this.invalidateNamespace(event.namespace);
    } else {
      this.delete(fullKey);
    }
  }

  private getFullKey(key: string, namespace?: string): string {
    return namespace ? `${namespace}:${key}` : key;
  }

  private parseFullKey(fullKey: string): { key: string; namespace: string } {
    const parts = fullKey.split(':', 2);
    return {
      key: parts[1] || parts[0],
      namespace: parts[1] ? parts[0] : 'default'
    };
  }

  private async compressData(data: unknown): Promise<{ compressed: boolean; data: unknown; size: number }> {
    if (!this.config.enableCompression) {
      const serialized = JSON.stringify(data);
      return {
        compressed: false,
        data,
        size: serialized.length
      };
    }

    try {
      const serialized = JSON.stringify(data);
      
      // Only compress if data is larger than threshold
      if (serialized.length < this.config.compressionThreshold) {
        return {
          compressed: false,
          data,
          size: serialized.length
        };
      }

      // Use proper compression algorithm
      const compressed = await this.compressWithLZString(serialized);
      
      // Calculate compression savings
      const originalSize = serialized.length;
      const compressedSize = compressed.length;
      const compressionRatio = compressedSize / originalSize;
      
      // Only use compression if it actually saves space (at least 10% savings)
      if (compressionRatio >= 0.9) {
        return {
          compressed: false,
          data,
          size: originalSize
        };
      }
      
      // Update compression savings statistics
      this.stats.compressionSavings += (originalSize - compressedSize);
      
      return {
        compressed: true,
        data: {
          compressed: true,
          data: compressed,
          originalSize
        },
        size: compressedSize
      };
    } catch (error) {
      console.warn('Compression failed, storing uncompressed data:', error);
      const serialized = JSON.stringify(data);
      return {
        compressed: false,
        data,
        size: serialized.length
      };
    }
  }

  private async compressWithLZString(input: string): Promise<string> {
    try {
      // Use LZ-String compression algorithm
      // This is a simplified version of LZ-String compression
      // In a real implementation, you'd import the full lz-string library
      
      // Simple compression using run-length encoding and character frequency
      const compressed = this.simpleRLECompression(input);
      
      // If RLE doesn't provide good compression, fall back to base64
      if (compressed.length >= input.length * 0.95) {
        return btoa(input); // Fallback to base64 if compression isn't effective
      }
      
      return `rle:${compressed}`;
    } catch (error) {
      // Fallback to base64 if compression fails
      return btoa(input);
    }
  }

  private simpleRLECompression(input: string): string {
    let result = '';
    let count = 1;
    let current = input[0];
    
    for (let i = 1; i < input.length; i++) {
      if (input[i] === current && count < 255) {
        count++;
      } else {
        if (count > 1) {
          result += `${count}${current}`;
        } else {
          result += current;
        }
        current = input[i];
        count = 1;
      }
    }
    
    // Add the last character/group
    if (count > 1) {
      result += `${count}${current}`;
    } else {
      result += current;
    }
    
    return result;
  }

  private async decompressWithLZString(compressedData: any): Promise<string> {
    if (typeof compressedData === 'string') {
      // Handle legacy base64 compression
      return atob(compressedData);
    }
    
    if (compressedData.compressed && compressedData.data) {
      const data = compressedData.data;
      
      if (typeof data === 'string' && data.startsWith('rle:')) {
        // Decompress RLE compression
        return this.decompressRLE(data.substring(4));
      } else if (typeof data === 'string') {
        // Fallback to base64
        return atob(data);
      }
    }
    
    // If we can't determine the compression type, return as-is
    return JSON.stringify(compressedData);
  }

  private decompressRLE(compressed: string): string {
    let result = '';
    let i = 0;
    
    while (i < compressed.length) {
      let count = '';
      let char = '';
      
      // Read count (could be multiple digits)
      while (i < compressed.length && /[0-9]/.test(compressed[i])) {
        count += compressed[i];
        i++;
      }
      
      if (i < compressed.length) {
        char = compressed[i];
        i++;
      }
      
      const repeatCount = parseInt(count) || 1;
      result += char.repeat(repeatCount);
    }
    
    return result;
  }

  private async decompressData<T>(entry: CacheEntry<T>): Promise<T> {
    if (!entry.compressed) {
      return entry.data as T;
    }

    try {
      let decompressedString: string;
      
      // Check if this is the new compression format
      const dataAsAny = entry.data as any;
      if (dataAsAny && typeof dataAsAny === 'object' && dataAsAny.compressed) {
        // Handle new compression format
        decompressedString = await this.decompressWithLZString(dataAsAny);
      } else {
        // Handle legacy format (base64)
        decompressedString = atob(entry.data as string);
      }
      
      return JSON.parse(decompressedString) as T;
    } catch (error) {
      console.error('Decompression failed:', error);
      throw new Error('Failed to decompress cached data');
    }
  }

  private updateAccessOrder(fullKey: string): void {
    if (!this.config.enableLRU) {
      return;
    }

    const index = this.accessOrder.indexOf(fullKey);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
    this.accessOrder.push(fullKey);
  }

  private evictLRU(): void {
    if (!this.config.enableLRU || this.accessOrder.length === 0) {
      return;
    }

    const keysToEvict = Math.min(5, this.accessOrder.length); // Evict up to 5 entries at once
    
    for (let i = 0; i < keysToEvict; i++) {
      const keyToEvict = this.accessOrder.shift();
      if (keyToEvict) {
        this.delete(keyToEvict);
      }
    }
  }

  private enforceSizeLimits(): void {
    // Check entry count limit
    while (this.cache.size > this.config.maxEntries) {
      this.evictLRU();
    }

    // Check size limit
    while (this.stats.totalSize > this.config.maxSize) {
      this.evictLRU();
    }
  }

  private cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [fullKey, entry] of this.cache) {
      if (now - entry.timestamp > entry.ttl) {
        keysToDelete.push(fullKey);
      }
    }

    keysToDelete.forEach(key => this.delete(key));
  }

  // Public API methods
  async set<T>(
    key: string,
    data: T,
    options: {
      namespace?: string
      ttl?: number
      dataType?: string
      context?: TTLCalculationContext
      metadata?: Record<string, unknown>
      refreshFunction?: () => Promise<T>
    } = {}
  ): Promise<void> {
    const fullKey = this.getFullKey(key, options.namespace);
    const { key: parsedKey, namespace } = this.parseFullKey(fullKey);

    // Calculate TTL
    let ttl = options.ttl || this.config.defaultTTL;
    if (options.dataType && options.context) {
      ttl = adaptiveTTLEngine.calculateOptimalTTL(options.dataType, options.context);
    }

    // Compress data if needed
    const { compressed, data: processedData, size } = await this.compressData(data);

    // Update existing entry or create new one
    const existingEntry = this.cache.get(fullKey);
    if (existingEntry) {
      this.stats.totalSize -= existingEntry.size;
    }

    const entry: CacheEntry<T> = {
      key: parsedKey,
      namespace,
      data: processedData as T,
      timestamp: Date.now(),
      ttl,
      accessCount: existingEntry?.accessCount || 0,
      lastAccessed: Date.now(),
      compressed,
      size,
      metadata: options.metadata
    };

    this.cache.set(fullKey, entry);
    this.stats.totalSize += size;

    // Update access order
    this.updateAccessOrder(fullKey);

    // Set up background refresh if enabled and function provided
    if (this.config.enableBackgroundRefresh && options.refreshFunction && options.dataType) {
      this.setupBackgroundRefresh(fullKey, options.dataType, options.refreshFunction, options.context);
    }

    // Enforce size limits
    this.enforceSizeLimits();
  }

  async get<T>(key: string, namespace?: string): Promise<T | null> {
    const fullKey = this.getFullKey(key, namespace);
    const entry = this.cache.get(fullKey);

    if (!entry) {
      this.stats.misses++;
      return null;
    }

    const now = Date.now();

    // Check if entry is expired
    if (now - entry.timestamp > entry.ttl) {
      this.delete(fullKey);
      this.stats.misses++;
      return null;
    }

    // Update access statistics
    entry.accessCount++;
    entry.lastAccessed = now;
    this.updateAccessOrder(fullKey);
    this.stats.hits++;

    // Decompress data if needed
    return this.decompressData(entry) as Promise<T>;
  }

  delete(key: string, namespace?: string): boolean {
    const fullKey = this.getFullKey(key, namespace);
    const entry = this.cache.get(fullKey);

    if (!entry) {
      return false;
    }

    this.stats.totalSize -= entry.size;
    this.cache.delete(fullKey);

    // Remove from access order
    const index = this.accessOrder.indexOf(fullKey);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }

    // Clean up background refresh task
    const refreshTaskId = this.refreshTasks.get(fullKey);
    if (refreshTaskId) {
      backgroundRefresher.unregisterRefreshTask(refreshTaskId);
      this.refreshTasks.delete(fullKey);
    }

    return true;
  }

  invalidateNamespace(namespace: string): number {
    let deletedCount = 0;
    const keysToDelete: string[] = [];

    for (const [fullKey, entry] of this.cache) {
      if (entry.namespace === namespace) {
        keysToDelete.push(fullKey);
      }
    }

    keysToDelete.forEach(key => {
      if (this.delete(key)) {
        deletedCount++;
      }
    });

    return deletedCount;
  }

  has(key: string, namespace?: string): boolean {
    const fullKey = this.getFullKey(key, namespace);
    const entry = this.cache.get(fullKey);

    if (!entry) {
      return false;
    }

    const now = Date.now();
    const isExpired = now - entry.timestamp > entry.ttl;

    if (isExpired) {
      this.delete(fullKey);
      return false;
    }

    return true;
  }

  private setupBackgroundRefresh<T>(
    fullKey: string,
    dataType: string,
    refreshFunction: () => Promise<T>,
    context?: TTLCalculationContext
  ): void {
    // Clean up existing task
    const existingTaskId = this.refreshTasks.get(fullKey);
    if (existingTaskId) {
      backgroundRefresher.unregisterRefreshTask(existingTaskId);
    }

    const { key: parsedKey, namespace } = this.parseFullKey(fullKey);

    const task: Omit<RefreshTask, 'id'> = {
      key: parsedKey,
      namespace,
      dataType,
      priority: this.getPriorityFromDataType(dataType),
      refreshFunction: async () => {
        const data = await refreshFunction();
        await this.set(parsedKey, data, {
          namespace,
          dataType,
          context,
          refreshFunction
        });
        return data;
      },
      lastRefresh: 0,
      nextRefresh: Date.now(),
      retryCount: 0,
      maxRetries: 3,
      backoffMultiplier: 2,
      isActive: true,
      context: context || {
        dataType,
        timeOfDay: new Date(),
        dayOfWeek: new Date().getDay(),
        systemLoad: 'medium'
      }
    };

    const taskId = backgroundRefresher.registerRefreshTask(task);
    this.refreshTasks.set(fullKey, taskId);
  }

  private getPriorityFromDataType(dataType: string): RefreshTask['priority'] {
    if (dataType.includes('critical')) return 'critical';
    if (dataType.includes('secondary')) return 'important';
    if (dataType.includes('detailed')) return 'normal';
    return 'low';
  }

  getStats(): CacheStats {
    const entriesByNamespace: Record<string, number> = {};
    let oldestEntry = Date.now();
    let newestEntry = 0;
    let totalTTL = 0;

    for (const entry of this.cache.values()) {
      entriesByNamespace[entry.namespace] = (entriesByNamespace[entry.namespace] || 0) + 1;
      oldestEntry = Math.min(oldestEntry, entry.timestamp);
      newestEntry = Math.max(newestEntry, entry.timestamp);
      totalTTL += entry.ttl;
    }

    const totalRequests = this.stats.hits + this.stats.misses;
    const compressionRatio = this.stats.compressionSavings / (this.stats.totalSize + this.stats.compressionSavings);

    return {
      totalEntries: this.cache.size,
      totalSize: this.stats.totalSize,
      hitRate: totalRequests > 0 ? this.stats.hits / totalRequests : 0,
      missRate: totalRequests > 0 ? this.stats.misses / totalRequests : 0,
      entriesByNamespace,
      oldestEntry,
      newestEntry,
      averageTTL: this.cache.size > 0 ? totalTTL / this.cache.size : 0,
      compressionRatio: isNaN(compressionRatio) ? 0 : compressionRatio
    };
  }

  getEntryDetails(key: string, namespace?: string): CacheEntry | undefined {
    const fullKey = this.getFullKey(key, namespace);
    return this.cache.get(fullKey);
  }

  getAllEntries(): CacheEntry[] {
    return Array.from(this.cache.values());
  }

  clear(): void {
    this.cache.clear();
    this.accessOrder = [];
    this.stats.totalSize = 0;
    
    // Clean up all background refresh tasks
    for (const taskId of this.refreshTasks.values()) {
      backgroundRefresher.unregisterRefreshTask(taskId);
    }
    this.refreshTasks.clear();
  }

  updateConfig(newConfig: Partial<SmartCacheConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    if (newConfig.cleanupInterval) {
      this.initializeCleanup();
    }
  }

  // Export/Import cache for persistence
  export(): string {
    const exportData = {
      cache: Array.from(this.cache.entries()),
      stats: this.stats,
      config: this.config,
      timestamp: Date.now()
    };
    
    return JSON.stringify(exportData);
  }

  import(exportedData: string): void {
    try {
      const importData = JSON.parse(exportedData);
      
      this.cache = new Map(importData.cache);
      this.stats = importData.stats;
      this.config = { ...this.config, ...importData.config };
      
      // Rebuild access order
      this.accessOrder = Array.from(this.cache.keys());
      
      // Rebuild background refresh tasks
      this.refreshTasks.clear();
      
    } catch (error) {
      console.error('Failed to import cache data:', error);
      throw new Error('Invalid cache export data');
    }
  }

  // Cleanup method
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }

    this.clear();
  }
}

export const smartCacheManager = SmartCacheManager.getInstance();