// ============================================
// types/index.ts
// ============================================
export type Module = 'dashboard' | 'users' | 'reports' | 'settings' | 'analytics' | 'notifications' | 'billing' | 'profile' | 'attendance' | 'leaves' | 'payroll' | 'complaints' | 'tickets' | 'clients'

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

export interface EmployeeSalarySetup {
  id: string
  profile_id: string
  basic_salary: string
  hra: string
  da: string
  ta: string
  special_allowance: string
  incentive: string
  other_deductions: string
  effective_from_month: number
  effective_from_year: number
  effective_to_month: number | null
  effective_to_year: number | null
  change_reason: string | null
  is_active: boolean
  created_by: string | null
  created_at: string | null
  updated_at: string | null
}

export interface EmployeeAdvance {
  id: string
  profile_id: string
  date: string
  amount: string
  particulars: string
  status: 'pending' | 'adjusted'
  adjusted_in_month: number | null
  adjusted_in_year: number | null
  created_by: string | null
  created_at: string | null
}

export interface MonthlyAttendanceSummary {
  id: string
  profile_id: string
  month: number
  year: number
  total_working_days: number
  total_present_days: number
  total_absent_days: number
  total_half_days: number
  total_leaves: number
  total_working_hours: string | null
  total_extra_hours: string | null
  status: 'draft' | 'set_for_salary' | 'payslip_generated'
  set_for_salary_by: string | null
  set_for_salary_at: string | null
  gross_salary: string | null
  absence_deduction: string | null
  net_salary: string | null
  advance_recovery: string | null
  take_home: string | null
  salary_breakdown: Record<string, unknown> | null
  paid_mode: string | null
  pay_date: string | null
  pay_reference_no: string | null
  payment_remarks: string | null
  paid_by: string | null
  paid_at: string | null
  created_at: string | null
  updated_at: string | null
}

export type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed' | 'cancelled'
export type TicketPriority = 'low' | 'medium' | 'high' | 'critical'
export type CallLogStatus = 'done' | 'pending' | 'cancelled'
export type ComplaintCategory = 'billing' | 'technical' | 'service' | 'product' | 'general'

export interface ClientContact {
  name: string
  role: string
  phone: string
  email: string
}

export interface Client {
  id: string
  company_name: string
  contact_person: string | null
  email: string | null
  phone: string | null
  alt_phone: string | null
  gst_number: string | null
  pan_number: string | null
  website: string | null
  industry: string | null
  address_line1: string | null
  address_line2: string | null
  city: string | null
  state: string | null
  pincode: string | null
  country: string | null
  contacts: ClientContact[] | null
  notes: string | null
  status: 'active' | 'inactive' | null
  created_by: string | null
  created_at: string | null
  updated_at: string | null
}

export interface Complaint {
  id: string
  complaint_number: string
  client_id: string | null
  subject: string
  description: string | null
  category: ComplaintCategory | null
  priority: TicketPriority | null
  status: TicketStatus | null
  source: string | null
  sla_hours: number | null
  resolved_at: string | null
  closed_at: string | null
  created_by: string | null
  created_at: string | null
  updated_at: string | null
  client?: Client | null
  tickets?: Ticket[]
}

export interface Ticket {
  id: string
  ticket_number: string
  complaint_id: string | null
  title: string
  description: string | null
  priority: TicketPriority | null
  status: TicketStatus | null
  due_date: string | null
  estimated_hours: string | null
  actual_hours: string | null
  created_by: string | null
  created_at: string | null
  updated_at: string | null
  complaint?: Complaint | null
  assignments?: TicketAssignment[]
  resolutions?: TicketResolution[]
}

export interface TicketAssignment {
  id: string
  ticket_id: string
  assigned_to: string
  assigned_by: string | null
  role: string | null
  is_primary: boolean | null
  assigned_at: string | null
  assignee?: Profile | null
}

export interface TicketResolution {
  id: string
  ticket_id: string
  resolved_by: string
  resolution_text: string
  remarks: string | null
  hours_spent: string | null
  status_after: TicketStatus | null
  created_at: string | null
  resolver?: Profile | null
}

export interface CallLog {
  id: string
  ticket_id: string | null
  complaint_id: string | null
  client_id: string | null
  called_by: string
  contact_name: string | null
  contact_phone: string | null
  call_type: string | null
  duration_minutes: number | null
  notes: string | null
  remarks: string | null
  status: CallLogStatus | null
  next_follow_up: string | null
  created_at: string | null
  caller?: Profile | null
}
