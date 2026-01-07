// ============================================
// types/index.ts
// ============================================
export type Module = 'dashboard' | 'users' | 'reports' | 'settings' | 'analytics' | 'notifications' | 'billing' | 'profile' | 'attendance' | 'leaves' | 'payroll'

export type UserRole = 'admin' | 'moderator' | 'employee'

export type ActivityType = 'login' | 'logout' | 'profile_update' | 'data_view' | 'data_edit' | 'data_delete' | 'create_user'

export interface Designation {
  id: string
  name: string
  description: string | null
  role: UserRole | string | null
  created_at: string | null
  updated_at: string | null
}

export interface Profile {
  id: string
  user_id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  role: UserRole
  designation_id?: string | null
  designation?: Designation | null
  first_name?: string | null
  middle_name?: string | null
  last_name?: string | null
  mobile_no?: string | null
  date_of_birth?: string | null
  sex?: string | null
  status: 'active' | 'deactive' | 'deleted' | null
  created_at: string | null
  updated_at: string | null
  allowed_modules?: string[] | null
}

export interface Activity {
  id: string
  user_id: string
  activity_type: ActivityType
  description: string | null
  metadata: Record<string, unknown>
  created_at: string | null
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
  type?: string
  link?: string
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

export interface Attendance {
  id: string
  profile_id: string
  date: string
  check_in: string | null
  check_out: string | null
  working_hours: number | null
  status: 'pending' | 'verified' | 'rejected'
  remarks: string | null
  verified_by: string | null
  created_at: string | null
  updated_at: string | null
}

export interface Leave {
  id: string
  profile_id: string
  leave_type: string | null
  start_date: string
  end_date: string
  reason: string | null
  status: 'pending' | 'approved' | 'rejected'
  remarks: string | null
  approved_by: string | null
  created_at: string | null
  updated_at: string | null
}

export interface OfficeSettings {
  id: string
  default_check_in: string
  default_check_out: string
  updated_at: string
}

export interface OfficeClosure {
  id: string
  date: string
  reason: string
  type: 'holiday' | 'closed'
  created_at: string
}

export interface EmployeeSettings {
  profile_id: string
  custom_check_in: string | null
  custom_check_out: string | null
  updated_at: string
}