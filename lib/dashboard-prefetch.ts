'use client'

import { smartCacheManager } from '@/lib/cache/smart-cache-manager'

interface PrefetchResult {
  success: boolean
  data?: any
  error?: string
}

/**
 * Prefetches dashboard data during login success to reduce loading time
 * This runs in the background and doesn't block the login redirect
 */
export class DashboardPrefetcher {
  private static instance: DashboardPrefetcher
  private isPrefetching = false
  private prefetchPromise: Promise<PrefetchResult> | null = null
  private prefetchResult: PrefetchResult | null = null

  static getInstance(): DashboardPrefetcher {
    if (!DashboardPrefetcher.instance) {
      DashboardPrefetcher.instance = new DashboardPrefetcher()
    }
    return DashboardPrefetcher.instance
  }

  /**
   * Starts prefetching dashboard data in the background
   * Called after successful login but before redirect
   * Returns a promise that resolves with prefetch result
   */
  async prefetchDashboardData(): Promise<PrefetchResult> {
    if (this.prefetchPromise) {
      return this.prefetchPromise
    }

    if (this.prefetchResult) {
      return this.prefetchResult
    }

    this.isPrefetching = true

    this.prefetchPromise = this.performPrefetch().finally(() => {
      this.isPrefetching = false
    })

    this.prefetchResult = await this.prefetchPromise
    return this.prefetchResult
  }

  private async performPrefetch(): Promise<PrefetchResult> {
    try {
      console.log('Starting dashboard data prefetch...')

      // Prefetch comprehensive dashboard data only (no fallback)
      const comprehensiveResult = await this.prefetchComprehensiveData()

      if (comprehensiveResult.success) {
        console.log('Comprehensive dashboard data prefetched successfully')
      } else {
        console.log('Comprehensive prefetch failed, no fallback available')
      }

      return comprehensiveResult

    } catch (error) {
      console.warn('Dashboard prefetch failed:', error)
      // Don't throw - prefetch failures should not block login
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  }

  private async prefetchComprehensiveData(): Promise<PrefetchResult> {
    try {
      const response = await fetch('/api/trpc/admin.dashboard.getComprehensiveDashboardData?input=%7B%22analyticsDays%22%3A7%2C%22activitiesLimit%22%3A10%7D', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      })

      if (!response.ok) {
        return { success: false, error: `HTTP ${response.status}` }
      }

      const data = await response.json()

      if (!data?.result?.data) {
        return { success: false, error: 'Invalid response structure' }
      }

      // Store in cache immediately
      await smartCacheManager.set('comprehensive-dashboard-data', data.result.data, {
        namespace: 'dashboard',
        dataType: 'comprehensive-dashboard-data',
        context: {
          dataType: 'comprehensive-dashboard-data',
          timeOfDay: new Date(),
          dayOfWeek: new Date().getDay(),
          systemLoad: 'medium' as const,
          userProfile: {
            isActive: true,
            lastActivity: new Date(),
            role: 'admin'
          }
        },
        metadata: { prefetched: true, prefetchedAt: new Date().toISOString() }
      })

      return { success: true, data: data.result.data }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  }

  private async prefetchCriticalData(): Promise<PrefetchResult> {
    try {
      const response = await fetch('/api/trpc/admin.dashboard.getCriticalDashboardData', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      })

      if (!response.ok) {
        return { success: false, error: `HTTP ${response.status}` }
      }

      const data = await response.json()

      if (!data?.result?.data) {
        return { success: false, error: 'Invalid response structure' }
      }

      await smartCacheManager.set('critical-dashboard-data', data.result.data, {
        namespace: 'dashboard',
        dataType: 'critical-dashboard-data',
        context: {
          dataType: 'critical-dashboard-data',
          timeOfDay: new Date(),
          dayOfWeek: new Date().getDay(),
          systemLoad: 'medium' as const,
          userProfile: {
            isActive: true,
            lastActivity: new Date(),
            role: 'admin'
          }
        },
        metadata: { prefetched: true, prefetchedAt: new Date().toISOString() }
      })

      return { success: true, data: data.result.data }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  }

  private async prefetchSecondaryData(): Promise<PrefetchResult> {
    try {
      const response = await fetch('/api/trpc/admin.dashboard.getSecondaryDashboardData?input=%7B%22analyticsDays%22%3A7%7D', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      })

      if (!response.ok) {
        return { success: false, error: `HTTP ${response.status}` }
      }

      const data = await response.json()

      if (!data?.result?.data) {
        return { success: false, error: 'Invalid response structure' }
      }

      await smartCacheManager.set('secondary-dashboard-data', data.result.data, {
        namespace: 'dashboard',
        dataType: 'secondary-dashboard-data',
        context: {
          dataType: 'secondary-dashboard-data',
          timeOfDay: new Date(),
          dayOfWeek: new Date().getDay(),
          systemLoad: 'medium' as const,
          userProfile: {
            isActive: true,
            lastActivity: new Date(),
            role: 'admin'
          }
        },
        metadata: { prefetched: true, prefetchedAt: new Date().toISOString() }
      })

      return { success: true, data: data.result.data }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  }

  private async prefetchDetailedData(): Promise<PrefetchResult> {
    try {
      const response = await fetch('/api/trpc/admin.dashboard.getDetailedDashboardData', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      })

      if (!response.ok) {
        return { success: false, error: `HTTP ${response.status}` }
      }

      const data = await response.json()

      if (!data?.result?.data) {
        return { success: false, error: 'Invalid response structure' }
      }

      await smartCacheManager.set('detailed-dashboard-data', data.result.data, {
        namespace: 'dashboard',
        dataType: 'detailed-dashboard-data',
        context: {
          dataType: 'detailed-dashboard-data',
          timeOfDay: new Date(),
          dayOfWeek: new Date().getDay(),
          systemLoad: 'medium' as const,
          userProfile: {
            isActive: true,
            lastActivity: new Date(),
            role: 'admin'
          }
        },
        metadata: { prefetched: true, prefetchedAt: new Date().toISOString() }
      })

      return { success: true, data: data.result.data }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  }

  /**
   * Checks if prefetch is currently running
   */
  isCurrentlyPrefetching(): boolean {
    return this.isPrefetching
  }

  /**
   * Checks if prefetch has completed
   */
  hasPrefetchCompleted(): boolean {
    return this.prefetchResult !== null
  }

  /**
   * Gets the prefetch result if available
   */
  getPrefetchResult(): PrefetchResult | null {
    return this.prefetchResult
  }
}

// Export singleton instance
export const dashboardPrefetcher = DashboardPrefetcher.getInstance()