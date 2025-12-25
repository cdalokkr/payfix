/**
 * Shared dashboard query parameters to ensure cache key consistency
 * between prefetch and useQuery calls.
 * 
 * This prevents duplicate tRPC API calls by ensuring both prefetch
 * (in login-form.tsx) and useQuery (in use-realtime-dashboard-data.ts)
 * use identical parameters, resulting in the same cache key.
 */

// Standard dashboard query parameters - used for both prefetch and useQuery
export const DASHBOARD_QUERY_PARAMS = {
    analyticsDays: 7,
    activitiesLimit: 10,
    priority: 'speed' as const,
    enableCache: true
} as const

// For fresh data requests (manual refresh scenarios only)
export const DASHBOARD_FRESH_PARAMS = {
    ...DASHBOARD_QUERY_PARAMS,
    priority: 'freshness' as const,
    enableCache: false
} as const

// Type exports for type safety
export type DashboardQueryParams = typeof DASHBOARD_QUERY_PARAMS
export type DashboardFreshParams = typeof DASHBOARD_FRESH_PARAMS