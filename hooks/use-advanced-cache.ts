// ============================================
// hooks/use-advanced-cache.ts
// React Query integration hooks for advanced caching
// ============================================

import { useQuery, useMutation, useQueryClient, UseQueryOptions, UseMutationOptions } from '@tanstack/react-query';
import { advancedCacheManager } from '../lib/cache/advanced-cache-manager';
import { adaptiveTTLEngine, TTLCalculationContext } from '../lib/cache/adaptive-ttl-engine';
import { cacheInvalidation } from '../lib/cache/cache-invalidation';
import { backgroundRefresher } from '../lib/cache/background-refresher';

// Types for cache-enhanced queries
export interface CacheQueryOptions<TData, TError = Error> extends Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'> {
  cacheKey?: string
  cacheNamespace?: string
  dataType?: string
  context?: TTLCalculationContext
  enableBackgroundRefresh?: boolean
  enableCacheMetrics?: boolean
  dependencies?: string[]
  staleWhileRevalidate?: boolean
  backgroundRefreshInterval?: number
}

export interface CacheMutationOptions<TData, TError = Error, TVariables = unknown, TContext = unknown> 
  extends Omit<UseMutationOptions<TData, TError, TVariables, TContext>, 'mutationFn'> {
  invalidateRelatedCaches?: boolean
  relatedCacheKeys?: string[]
  invalidateOnSuccess?: boolean
  cacheStrategy?: 'write-through' | 'write-back' | 'write-around'
}

export interface CacheMetrics {
  hitRate: number
  totalRequests: number
  cacheHits: number
  cacheMisses: number
  averageResponseTime: number
  memoryUsage: {
    used: number
    total: number
    compressionRatio: number
  }
  backgroundRefreshRate: number
  lastUpdated: number
}

// Hook for cache-enhanced queries
export function useCacheQuery<TData = unknown, TError = Error>(
  cacheKey: string,
  queryFn: () => Promise<TData>,
  options: CacheQueryOptions<TData, TError> = {}
) {
  const queryClient = useQueryClient();
  const {
    cacheNamespace = 'default',
    dataType,
    context,
    enableBackgroundRefresh = true,
    enableCacheMetrics = false,
    dependencies = [],
    staleWhileRevalidate = true,
    backgroundRefreshInterval,
    ...reactQueryOptions
  } = options;

  return useQuery<TData, TError>({
    queryKey: [cacheKey],
    queryFn: async () => {
      const startTime = Date.now();
      
      // Try to get from cache first
      try {
        const cachedData = await advancedCacheManager.get<TData>(cacheKey, cacheNamespace);
        
        if (cachedData !== null) {
          if (enableCacheMetrics) {
            // Record cache hit metrics
            queryClient.setQueryData(['cache-metrics', cacheKey], (old: CacheMetrics | undefined) => ({
              ...old,
              hitRate: (old?.hitRate || 0) + 0.1,
              cacheHits: (old?.cacheHits || 0) + 1,
              totalRequests: (old?.totalRequests || 0) + 1,
              averageResponseTime: (old?.averageResponseTime || 0) + (Date.now() - startTime),
              lastUpdated: Date.now()
            }));
          }
          
          // Return cached data if still fresh enough for stale-while-revalidate
          if (staleWhileRevalidate) {
            // Trigger background refresh if enabled
            if (enableBackgroundRefresh) {
              setTimeout(() => {
                queryClient.invalidateQueries({ queryKey: [cacheKey] });
              }, 100);
            }
            
            return cachedData;
          }
          
          return cachedData;
        }
      } catch (error) {
        console.warn(`Cache read failed for ${cacheKey}:`, error);
      }

      // Cache miss or data expired - fetch fresh data
      if (enableCacheMetrics) {
        queryClient.setQueryData(['cache-metrics', cacheKey], (old: CacheMetrics | undefined) => ({
          ...old,
          cacheMisses: (old?.cacheMisses || 0) + 1,
          totalRequests: (old?.totalRequests || 0) + 1,
          lastUpdated: Date.now()
        }));
      }

      const freshData = await queryFn();
      
      // Cache the fresh data
      try {
        await advancedCacheManager.set(cacheKey, freshData, {
          namespace: cacheNamespace,
          dataType,
          context,
          dependencies,
          refreshFunction: enableBackgroundRefresh ? queryFn : undefined
        });
      } catch (error) {
        console.warn(`Cache write failed for ${cacheKey}:`, error);
      }

      return freshData;
    },
    ...reactQueryOptions
  });
}

// Hook for cache-enhanced mutations
export function useCacheMutation<TData = unknown, TError = Error, TVariables = unknown, TContext = unknown>(
  mutationFn: (variables: TVariables) => Promise<TData>,
  options: CacheMutationOptions<TData, TError, TVariables, TContext> = {}
) {
  const queryClient = useQueryClient();
  const {
    invalidateRelatedCaches = true,
    relatedCacheKeys = [],
    invalidateOnSuccess = true,
    cacheStrategy = 'write-through',
    ...reactQueryOptions
  } = options;

  return useMutation<TData, TError, TVariables, TContext>({
    mutationFn,
    ...reactQueryOptions,
    onSuccess: async (data, variables, context) => {
      // Handle cache strategy
      switch (cacheStrategy) {
        case 'write-through':
          // Update cache immediately with fresh data
          for (const cacheKey of relatedCacheKeys) {
            await advancedCacheManager.invalidate(cacheKey, 'mutation-success');
          }
          break;

        case 'write-back':
          // Mark cache as stale, update on next access
          // This is handled by the mutation invalidation
          break;

        case 'write-around':
          // Don't update cache, let it refresh naturally
          break;
      }

      // Invalidate related caches if enabled
      if (invalidateOnSuccess) {
        await queryClient.invalidateQueries({ 
          queryKey: relatedCacheKeys.map(key => [key]) 
        });
        
        if (invalidateRelatedCaches) {
          // Use smart invalidation
          for (const cacheKey of relatedCacheKeys) {
            advancedCacheManager.invalidate(cacheKey, 'mutation-success');
          }
        }
      }

      // Call original onSuccess if provided
      if (options.onSuccess) {
        options.onSuccess(data, variables, context as TContext, undefined as any);
      }
    },
    onError: (error, variables, context) => {
      // Log cache-related errors
      console.error('Cache mutation failed:', error);
      
      // Call original onError if provided
      if (options.onError) {
        options.onError(error, variables, context as TContext, undefined as any);
      }
    }
  });
}

// Hook for manual cache operations
export function useCacheManager() {
  const queryClient = useQueryClient();

  const cacheManager = {
    // Get data from cache
    get: async <T = unknown>(key: string, namespace?: string): Promise<T | null> => {
      return await advancedCacheManager.get<T>(key, namespace);
    },

    // Set data in cache
    set: async <T = unknown>(
      key: string, 
      data: T, 
      options?: {
        namespace?: string
        ttl?: number
        dataType?: string
        context?: TTLCalculationContext
        dependencies?: string[]
      }
    ): Promise<void> => {
      await advancedCacheManager.set(key, data, options);
    },

    // Invalidate cache entries
    invalidate: (key: string, reason?: string, namespace?: string): void => {
      advancedCacheManager.invalidate(key, reason, namespace);
      queryClient.invalidateQueries({ queryKey: [key] });
    },

    // Invalidate entire namespace
    invalidateNamespace: (namespace: string, reason?: string): void => {
      advancedCacheManager.invalidateNamespace(namespace, reason);
      queryClient.invalidateQueries({ queryKey: [namespace] });
    },

    // Force refresh cache entry
    refresh: async (key: string, namespace?: string): Promise<void> => {
      await advancedCacheManager.forceRefresh(key, namespace);
    },

    // Add cache dependency
    addDependency: (sourceKey: string, targetKeys: string[], type: 'strong' | 'weak' | 'conditional' = 'strong'): void => {
      advancedCacheManager.addDependency(sourceKey, targetKeys, type);
    },

    // Remove cache dependency
    removeDependency: (sourceKey: string, targetKey: string): void => {
      advancedCacheManager.removeDependency(sourceKey, targetKey);
    },

    // Get cache metrics
    getMetrics: () => {
      return advancedCacheManager.getMetrics();
    },

    // Get cache statistics
    getStats: () => {
      return advancedCacheManager.getMetrics();
    },

    // Optimize cache
    optimize: async (): Promise<void> => {
      await advancedCacheManager.optimize();
    },

    // Clear cache
    clear: (): void => {
      advancedCacheManager.destroy();
    }
  };

  return cacheManager;
}

// Hook for cache metrics and monitoring
export function useCacheMetrics(cacheKey?: string) {
  const queryClient = useQueryClient();
  
  const query = useQuery({
    queryKey: ['cache-metrics', cacheKey || 'global'],
    queryFn: async (): Promise<CacheMetrics> => {
      const metrics = advancedCacheManager.getMetrics();
      return {
        hitRate: metrics.cacheHitRate,
        totalRequests: metrics.totalOperations,
        cacheHits: Math.floor(metrics.cacheHitRate * metrics.totalOperations),
        cacheMisses: metrics.totalOperations - Math.floor(metrics.cacheHitRate * metrics.totalOperations),
        averageResponseTime: metrics.averageResponseTime,
        memoryUsage: metrics.memoryUsage,
        backgroundRefreshRate: metrics.backgroundRefreshRate,
        lastUpdated: Date.now()
      };
    },
    refetchInterval: 5000, // Update every 5 seconds
    enabled: !!cacheKey
  });

  return query;
}

// Hook for background refresh management
export function useBackgroundRefresh() {
  const refreshManager = {
    // Get refresh status
    getStatus: () => {
      return backgroundRefresher.getRefreshStatus();
    },

    // Force refresh a specific task
    forceRefresh: async (taskId: string): Promise<unknown> => {
      return await backgroundRefresher.forceRefresh(taskId);
    },

    // Pause refresh task
    pauseTask: (taskId: string): void => {
      backgroundRefresher.pauseRefreshTask(taskId);
    },

    // Resume refresh task
    resumeTask: (taskId: string): void => {
      backgroundRefresher.resumeRefreshTask(taskId);
    },

    // Add refresh callback
    addCallback: (taskId: string, callback: (success: boolean, data?: unknown, error?: Error) => void): void => {
      backgroundRefresher.addRefreshCallback(taskId, callback);
    },

    // Remove refresh callback
    removeCallback: (taskId: string, callback: (success: boolean, data?: unknown, error?: Error) => void): void => {
      backgroundRefresher.removeRefreshCallback(taskId, callback);
    }
  };

  return refreshManager;
}

// Hook for cache invalidation management
export function useCacheInvalidation() {
  const invalidationManager = {
    // Invalidate by pattern
    invalidatePattern: (pattern: string, reason?: string): void => {
      // For now, use basic invalidation through advanced cache manager
      advancedCacheManager.invalidate(pattern, reason);
    },

    // Add invalidation pattern
    addPattern: (pattern: any): void => {
      // This would integrate with the smart invalidator
      console.log('Adding invalidation pattern:', pattern);
    },

    // Get invalidation history
    getHistory: (limit?: number) => {
      return cacheInvalidation.getEventHistory(limit);
    },

    // Get invalidation stats
    getStats: () => {
      return cacheInvalidation.getInvalidationStats();
    },

    // Invalidate on user action
    invalidateOnUserAction: (userId: string, action: string, metadata?: Record<string, unknown>): void => {
      cacheInvalidation.invalidateOnUserAction(userId, action, metadata);
    },

    // Invalidate on data change
    invalidateOnDataChange: (dataType: string, recordId?: string, metadata?: Record<string, unknown>): void => {
      cacheInvalidation.invalidateOnDataChange(dataType, recordId, metadata);
    }
  };

  return invalidationManager;
}

// Pre-configured hooks for common use cases
export function useDashboardData<T = unknown>(cacheKey: string, queryFn: () => Promise<T>) {
  const context: TTLCalculationContext = {
    dataType: 'dashboard-data',
    timeOfDay: new Date(),
    dayOfWeek: new Date().getDay(),
    systemLoad: 'medium'
  };

  return useCacheQuery(cacheKey, queryFn, {
    dataType: 'dashboard-data',
    context,
    staleTime: 30000, // 30 seconds
    gcTime: 300000, // 5 minutes
    enableBackgroundRefresh: true,
    enableCacheMetrics: true
  });
}

export function useUserProfile<T = unknown>(userId: string, queryFn: () => Promise<T>) {
  return useCacheQuery(`user-profile-${userId}`, queryFn, {
    dataType: 'user-profile',
    context: {
      dataType: 'user-profile',
      timeOfDay: new Date(),
      dayOfWeek: new Date().getDay(),
      systemLoad: 'medium',
      userProfile: {
        isActive: true,
        lastActivity: new Date(),
        role: 'user'
      }
    },
    staleTime: 60000, // 1 minute
    gcTime: 600000, // 10 minutes
    enableBackgroundRefresh: true,
    dependencies: [`dashboard-critical`]
  });
}

export function useAnalyticsData<T = unknown>(queryFn: () => Promise<T>) {
  return useCacheQuery('analytics-data', queryFn, {
    dataType: 'analytics',
    context: {
      dataType: 'analytics',
      timeOfDay: new Date(),
      dayOfWeek: new Date().getDay(),
      systemLoad: 'medium'
    },
    staleTime: 300000, // 5 minutes
    gcTime: 1800000, // 30 minutes
    enableBackgroundRefresh: true,
    backgroundRefreshInterval: 600000 // 10 minutes
  });
}