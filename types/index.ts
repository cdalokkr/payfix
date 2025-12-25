// ============================================
// types/index.ts
// ============================================
export type Module = 'dashboard' | 'users' | 'reports' | 'settings' | 'analytics' | 'notifications' | 'billing' | 'profile'

export type UserRole = 'admin' | 'moderator' | 'employee'

export type ActivityType = 'login' | 'logout' | 'profile_update' | 'data_view' | 'data_edit' | 'data_delete' | 'create_user'

export interface Designation {
  id: string
  name: string
  description: string | null
  role: UserRole
  created_at: string
  updated_at: string
}

export interface Profile {
  id: string
  user_id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  role: UserRole
  designation_id?: string | null
  designation?: Designation
  first_name?: string
  middle_name?: string
  last_name?: string
  mobile_no?: string
  date_of_birth?: string
  sex?: string
  status: 'active' | 'deactive' | 'deleted'
  created_at: string
  updated_at: string
  allowed_modules?: Module[]
}

export interface Activity {
  id: string
  user_id: string
  activity_type: ActivityType
  description: string | null
  metadata: Record<string, unknown>
  created_at: string
}

export interface AnalyticsMetric {
  id: string
  metric_name: string
  metric_value: number
  metric_date: string
  metadata: Record<string, unknown>
  created_at: string
}

export interface Notification {
  id: string
  user_id: string
  title: string
  message: string
  is_read: boolean
  created_at: string
}

export interface AdminStats {
  totalUsers: number
  totalActivities: number
  todayActivities: number
}

export interface DashboardData {
  stats: AdminStats
  analytics: AnalyticsMetric[]
  recentActivities: (Activity & { profiles?: { email: string; full_name: string } })[]
  metadata: {
    fetchedAt: string
    version: string
    cacheExpiry: number
  }
}

// Analytics-specific types
export interface AnalyticsKPIs {
  userEngagementRate: number
  averageSessionDuration: number
  conversionRate: number
  bounceRate: number
  pageViews: number
  uniqueVisitors: number
  newUsers: number
  returningUsers: number
  topPages: TopPage[]
  cohortAnalysis: CohortAnalysis[]
  funnelStages: FunnelStage[]
}

export interface TopPage {
  page: string
  views: number
  uniqueViews: number
  avgTimeOnPage: number
  bounceRate: number
}

export interface CohortAnalysis {
  cohort: string
  period: string
  users: number
  retention: number
  revenue?: number
}

export interface FunnelStage {
  stage: string
  users: number
  conversionRate: number
  dropOffRate: number
}

export interface AnalyticsFilters {
  dateRange: {
    start: Date
    end: Date
  }
  userSegments: string[]
  metricTypes: string[]
}

export interface AnalyticsDrilldownData {
  metric: string
  data: Array<{
    date: string
    value: number
    breakdown?: Record<string, number>
  }>
}

export interface AnalyticsExportOptions {
  format: 'csv' | 'json' | 'pdf'
  dateRange: {
    start: Date
    end: Date
  }
  metrics: string[]
  includeCharts: boolean
}