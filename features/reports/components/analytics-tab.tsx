"use client"

import React, { useState, useCallback, useMemo, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { trpc } from "@/lib/trpc/client"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"
import {
  Search,
  X,
  User,
  UserStar,
  Shield,
  CircleUserRound,
  Mail,
  Phone,
  Calendar as CalendarIcon,
  Users,
  Activity,
  Download,
  Filter,
  TrendingUp,
  Clock,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Loader2,
  CheckCircle2,
  History,
  ShieldAlert,
  ArrowLeft,
  RefreshCw,
  SlidersHorizontal,
  Check
} from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { ActivityLogFeed, getActivityIcon, getActivityTypeColor, UserActivity } from "@/components/dashboard/activity-log-feed"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { format, isValid } from "date-fns"
import { MetricCard } from "@/components/dashboard/metric-card"
import CreateUserButton, { AsyncState } from "@/components/ui/create-user-button"

interface SearchUser {
  id: string
  user_id: string
  email: string
  first_name: string | null
  last_name: string | null
  middle_name: string | null
  mobile_no: string | null
  avatar_url: string | null
  role: string
  designation?: { name: string } | { name: string }[] | null
}

const SYSTEM_MODULES = [
  { id: 'auth', label: 'Auth & Access' },
  { id: 'attendance', label: 'Attendance' },
  { id: 'leaves', label: 'Leaves' },
  { id: 'shifts', label: 'Shifts & Rosters' },
  { id: 'salary', label: 'Salary & Payroll' },
  { id: 'departments', label: 'Deptt. & Desig.' },
  { id: 'profile', label: 'Profile' },
  { id: 'settings', label: 'Settings' },
]

const SYSTEM_ACTIVITY_TYPES = [
  { id: 'login', label: 'Login' },
  { id: 'logout', label: 'Logout' },
  { id: 'check_in', label: 'Check-in' },
  { id: 'check_out', label: 'Check-out' },
  { id: 'create', label: 'Create' },
  { id: 'update', label: 'Update / Edit' },
  { id: 'delete', label: 'Delete / Remove' },
  { id: 'approval', label: 'Approval' },
  { id: 'export', label: 'Export' },
]

interface AnalyticsTabProps {
  role?: 'admin' | 'moderator'
  defaultModule?: string
}

export function AnalyticsTab({ role = 'admin', defaultModule }: AnalyticsTabProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [searchStatus, setSearchStatus] = useState<AsyncState>('idle')
  const [selectedUser, setSelectedUser] = useState<string | null>(null)
  const [showDropdown, setShowDropdown] = useState(false)
  const [isExporting, setIsExporting] = useState(false)

  // Filters
  const [activityTypeFilter, setActivityTypeFilter] = useState<string[]>([])
  const [appliedActivityTypeFilter, setAppliedActivityTypeFilter] = useState<string[]>([])
  const [moduleFilter, setModuleFilter] = useState<string[]>(defaultModule ? [defaultModule] : [])
  const [appliedModuleFilter, setAppliedModuleFilter] = useState<string[]>(defaultModule ? [defaultModule] : [])

  const [dateRange, setDateRange] = useState<{ from: Date; to: Date } | undefined>()
  const [appliedDateRange, setAppliedDateRange] = useState<{ from: Date; to: Date } | undefined>()

  // Popover state
  const [isActivityPopoverOpen, setIsActivityPopoverOpen] = useState(false)
  const [isModulePopoverOpen, setIsModulePopoverOpen] = useState(false)
  const [isDatePopoverOpen, setIsDatePopoverOpen] = useState(false)

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  // TRPC utils for pre-fetching / exporting
  const utils = trpc.useUtils()

  // Search users for autocomplete
  const { data: searchResults, isLoading: isSearching, refetch: refetchSearch } = (role === 'admin'
    ? trpc.admin.reports.searchUsers
    : trpc.moderator.reports.searchUsers).useQuery(
      { query: searchQuery },
      {
        enabled: false,
      }
    )

  // Get user profile details (when a user is selected)
  const userProfileQuery = (role === 'admin'
    ? trpc.admin.reports.getUserProfile
    : trpc.moderator.reports.getUserProfile) as any
  const { data: userProfileData, isLoading: isLoadingProfile } = userProfileQuery.useQuery(
    {
      userId: selectedUser!,
    },
    {
      enabled: !!selectedUser,
    }
  )

  // Get activities (workspace-wide or filtered by user, always active)
  const {
    data: userActivitiesData,
    isLoading: isLoadingActivities,
    isFetching: isFetchingActivities,
    refetch: refetchActivities,
  } = (role === 'admin'
    ? trpc.admin.reports.getUserActivities
    : trpc.moderator.reports.getUserActivities).useQuery(
      {
        userId: selectedUser || undefined,
        page: currentPage,
        limit: pageSize,
        activityType: appliedActivityTypeFilter.length > 0 ? appliedActivityTypeFilter : undefined,
        module: appliedModuleFilter.length > 0 ? appliedModuleFilter : undefined,
        startDate: appliedDateRange?.from ? new Date(new Date(appliedDateRange.from).setHours(0, 0, 0, 0)).toISOString() : undefined,
        endDate: appliedDateRange?.to ? new Date(new Date(appliedDateRange.to).setHours(23, 59, 59, 999)).toISOString() : appliedDateRange?.from ? new Date(new Date(appliedDateRange.from).setHours(23, 59, 59, 999)).toISOString() : undefined,
        search: searchQuery.trim() || undefined,
      },
      {
        enabled: true,
        placeholderData: (previousData) => previousData,
      }
    )

  // Get user status history (only when user is selected and role is admin)
  const { data: statusHistory } = trpc.admin.reports.getUserStatusHistory.useQuery(
    { userId: selectedUser! },
    { enabled: !!selectedUser && role === 'admin' }
  )

  // Handle user search execution
  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) return

    setSearchStatus('loading')
    try {
      const result = await refetchSearch()
      if (!result.data || result.data.length === 0) {
        setSearchStatus('error')
        setTimeout(() => setSearchStatus('idle'), 2000)
        return
      }
      setSearchStatus('success')
      setShowDropdown(true)
      setTimeout(() => setSearchStatus('idle'), 2000)
    } catch {
      setSearchStatus('error')
      setTimeout(() => setSearchStatus('idle'), 2000)
    }
  }, [searchQuery, refetchSearch])

  // Handle reset to workspace-wide mode
  const handleResetToAllUsers = useCallback(() => {
    setSelectedUser(null)
    setSearchQuery("")
    setShowDropdown(false)
    setCurrentPage(1)
  }, [])

  // Full reset including filters
  const handleResetFilters = useCallback(() => {
    setActivityTypeFilter([])
    setAppliedActivityTypeFilter([])
    setModuleFilter(defaultModule ? [defaultModule] : [])
    setAppliedModuleFilter(defaultModule ? [defaultModule] : [])
    setDateRange(undefined)
    setAppliedDateRange(undefined)
    setCurrentPage(1)
  }, [defaultModule])

  // Handle user select from search dropdown
  const handleUserSelect = useCallback((user: SearchUser) => {
    setSelectedUser(user.id)
    setShowDropdown(false)
    setSearchQuery(`${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email)
    setCurrentPage(1)
  }, [])

  // Export audit logs as CSV
  const handleExportCSV = useCallback(async () => {
    setIsExporting(true)
    try {
      const exportQuery = role === 'admin'
        ? utils.admin.reports.exportAuditLogs
        : utils.moderator.reports.exportAuditLogs

      const result = await exportQuery.fetch({
        userId: selectedUser || undefined,
        activityType: appliedActivityTypeFilter.length > 0 ? appliedActivityTypeFilter : undefined,
        module: appliedModuleFilter.length > 0 ? appliedModuleFilter : undefined,
        startDate: appliedDateRange?.from ? new Date(new Date(appliedDateRange.from).setHours(0, 0, 0, 0)).toISOString() : undefined,
        endDate: appliedDateRange?.to ? new Date(new Date(appliedDateRange.to).setHours(23, 59, 59, 999)).toISOString() : appliedDateRange?.from ? new Date(new Date(appliedDateRange.from).setHours(23, 59, 59, 999)).toISOString() : undefined,
        search: searchQuery.trim() || undefined,
      })

      const rawItems = (result && result.activities && result.activities.length > 0)
        ? result.activities
        : (userActivitiesData?.activities || [])

      if (rawItems.length === 0) {
        setIsExporting(false)
        return
      }

      const headers = ["Date & Time", "Actor Name", "Actor Email", "Actor Role", "Module", "Activity Type", "Description", "IP Address"]
      const rows = rawItems.map((item: any) => [
        item.formattedDate || (item.created_at ? format(new Date(item.created_at), "yyyy-MM-dd HH:mm:ss") : "N/A"),
        item.actorName || item.actor?.name || item.profiles?.full_name || "System",
        item.actorEmail || item.actor?.email || item.profiles?.email || "N/A",
        item.actorRole || item.actor?.role || item.profiles?.role || "N/A",
        item.module || "general",
        item.activityType || item.activity_type || "N/A",
        item.description || "N/A",
        item.ipAddress || item.metadata?.ip || item.metadata?.ipAddress || "N/A"
      ])

      const csvContent = [
        headers.join(","),
        ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      ].join("\n")

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
      const link = document.createElement("a")
      const url = URL.createObjectURL(blob)
      link.setAttribute("href", url)
      const filename = selectedUser
        ? `audit-trail-${userProfileData?.profile?.email || 'user'}-${format(new Date(), "yyyy-MM-dd")}.csv`
        : `workspace-audit-trail-${format(new Date(), "yyyy-MM-dd")}.csv`
      link.setAttribute("download", filename)
      link.style.visibility = "hidden"
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch (err) {
      console.error("Export error:", err)
    } finally {
      setIsExporting(false)
    }
  }, [role, utils, selectedUser, appliedActivityTypeFilter, appliedModuleFilter, appliedDateRange, searchQuery, userProfileData, userActivitiesData])

  // Helper functions
  const getRoleBadgeColor = (roleStr?: string): string => {
    switch (roleStr?.toLowerCase()) {
      case 'admin':
        return "bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-500/20 dark:text-purple-400 dark:border-purple-500/30"
      case 'moderator':
        return "bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-500/20 dark:text-indigo-400 dark:border-indigo-500/30"
      default:
        return "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-500/20 dark:text-blue-400 dark:border-blue-500/30"
    }
  }

  const getStatusBadgeColor = (status?: string): string => {
    switch (status?.toLowerCase()) {
      case 'active':
        return "bg-green-100 text-green-700 border-green-200 dark:bg-green-500/20 dark:text-green-400 dark:border-green-500/30"
      case 'deactive':
        return "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/20 dark:text-amber-400 dark:border-amber-500/30"
      case 'deleted':
        return "bg-red-100 text-red-700 border-red-200 dark:bg-red-500/20 dark:text-red-400 dark:border-red-500/30"
      default:
        return "bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-500/20 dark:text-gray-400 dark:border-gray-500/30"
    }
  }

  const getDesignationName = (designation: any): string => {
    if (!designation) return "N/A"
    if (Array.isArray(designation)) {
      return designation[0]?.name || "N/A"
    }
    return designation.name || "N/A"
  }

  const profile = userProfileData?.profile
  const activities = (userActivitiesData?.activities || []) as UserActivity[]
  const statistics = userProfileData?.statistics
  const pagination = userActivitiesData?.pagination || { total: 0, page: 1, limit: pageSize, totalPages: 1 }

  const hasActiveFilters = appliedActivityTypeFilter.length > 0 ||
    appliedModuleFilter.length > 0 ||
    !!appliedDateRange ||
    !!selectedUser

  return (
    <div className="space-y-6">
      {/* Search & Mode Header */}
      <Card className="shadow-lg border-border/50">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <CardTitle className="text-xl flex items-center gap-2">
                <History className="h-5 w-5 text-primary" />
                {selectedUser ? "User Audit History" : "Workspace Audit Trail & Logs"}
              </CardTitle>
              <CardDescription className="text-xs">
                {selectedUser
                  ? `Viewing complete activity history for user ${profile?.email || searchQuery}`
                  : "Monitor and search real-time activities across all organization members"}
              </CardDescription>
            </div>

            {selectedUser && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleResetToAllUsers}
                className="h-8 gap-1.5 text-xs font-medium"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                View All Users Audit Trail
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search user by name, email, or mobile..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  setShowDropdown(false)
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleSearch()
                  }
                }}
                className="pl-9 h-10"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery("")
                    setShowDropdown(false)
                    if (selectedUser) {
                      handleResetToAllUsers()
                    }
                  }}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}

              {/* Autocomplete Dropdown */}
              <AnimatePresence>
                {showDropdown && searchResults && searchResults.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="absolute z-50 w-full mt-1 bg-background border border-border rounded-lg shadow-xl max-h-60 overflow-auto"
                  >
                    {searchResults.map((user: SearchUser) => (
                      <div
                        key={user.id}
                        className="p-3 cursor-pointer hover:bg-muted/70 border-b border-border/50 last:border-b-0 transition-colors flex items-center justify-between"
                        onClick={() => handleUserSelect(user)}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={user.avatar_url || undefined} />
                            <AvatarFallback>
                              {user.first_name?.[0] || user.email[0].toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">
                              {`${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                          </div>
                        </div>
                        <Badge
                          variant="outline"
                          className={cn("text-[10px] font-bold uppercase tracking-wider ml-2 flex-shrink-0", getRoleBadgeColor(user.role))}
                        >
                          {user.role}
                        </Badge>
                      </div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <CreateUserButton
              onClick={handleSearch}
              loadingText="Searching..."
              successText="Found"
              errorText="No match"
              disabled={!searchQuery.trim()}
              className="min-w-[120px] w-auto h-10"
              asyncState={searchStatus}
              mode="search"
              size="md"
            >
              Find User
            </CreateUserButton>
          </div>
        </CardContent>
      </Card>

      {/* Selected User Profile Details */}
      <AnimatePresence>
        {selectedUser && profile && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="space-y-6"
          >
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* User Profile Card */}
              <Card className="shadow-lg h-full">
                <CardHeader className="pb-0">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-blue-500/20">
                      <Users className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">User Details</CardTitle>
                      <CardDescription className="text-xs">Complete profile information</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="flex flex-col md:flex-row gap-4 md:gap-6">
                    {/* Avatar */}
                    <div className="flex justify-center md:justify-start md:items-center flex-shrink-0">
                      <div className="relative">
                        <Avatar className={cn(
                          "h-24 w-24 md:h-32 md:w-32 border-4 shadow-lg transition-all duration-300",
                          profile.status === 'active'
                            ? "border-green-500 shadow-green-500/20"
                            : profile.status === 'deleted'
                              ? "border-red-500 shadow-red-500/20"
                              : "border-amber-500 shadow-amber-500/20"
                        )}>
                          <AvatarImage
                            src={profile.avatar_url || undefined}
                            alt={`${profile.first_name || ''} ${profile.last_name || ''}`.trim()}
                          />
                          <AvatarFallback className="text-2xl">
                            {profile.first_name?.[0] || profile.email[0].toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className={cn(
                          "absolute -bottom-1 -right-1 h-5 w-5 rounded-full border-2 border-background",
                          profile.status === 'active' ? "bg-green-500" : profile.status === 'deleted' ? "bg-red-500" : "bg-amber-500"
                        )} />
                      </div>
                    </div>

                    {/* Information Grid */}
                    <div className="space-y-2.5 flex-1 flex flex-col justify-center min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-muted rounded-lg flex-shrink-0">
                          <CircleUserRound className="h-4 w-4 text-foreground" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] text-muted-foreground">Full Name</p>
                          <p className="text-sm font-semibold truncate">
                            {`${profile.first_name || ''} ${profile.middle_name || ''} ${profile.last_name || ''}`.trim() || "N/A"}
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 bg-muted rounded-lg flex-shrink-0">
                            {profile.role === "admin" ? (
                              <UserStar className="h-4 w-4 text-foreground" />
                            ) : (
                              <User className="h-4 w-4 text-foreground" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-[11px] text-muted-foreground">Role</p>
                            <span className={cn(
                              "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize border",
                              getRoleBadgeColor(profile.role)
                            )}>
                              {profile.role}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <div className="p-1.5 bg-muted rounded-lg flex-shrink-0">
                            <Shield className="h-4 w-4 text-foreground" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-[11px] text-muted-foreground">Designation</p>
                            <p className="text-sm font-semibold truncate">
                              {getDesignationName(profile.designation)}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-muted rounded-lg flex-shrink-0">
                          <Mail className="h-4 w-4 text-foreground" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] text-muted-foreground">Email</p>
                          <p className="text-sm font-semibold truncate">{profile.email || "N/A"}</p>
                        </div>
                      </div>

                      {profile.mobile_no && (
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 bg-muted rounded-lg flex-shrink-0">
                            <Phone className="h-4 w-4 text-foreground" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-[11px] text-muted-foreground">Mobile</p>
                            <p className="text-sm font-semibold">{profile.mobile_no}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Activity Statistics Card */}
              {statistics && (
                <Card className="shadow-lg border-border/50 bg-background/60 backdrop-blur-xl h-full flex flex-col">
                  <CardHeader className="pb-0">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-lg bg-purple-500/20">
                        <Activity className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">User Activity Summary</CardTitle>
                        <CardDescription className="text-xs">Summary of user actions performed</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="flex-1 flex items-center pt-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
                      <MetricCard
                        title="Total Activities"
                        value={statistics.total}
                        description="All lifetime events"
                        icon={<Activity className="h-5 w-5 text-muted-foreground" />}
                        loading={isLoadingProfile}
                        iconBgColor="bg-blue-500/20"
                        iconColor="text-blue-700"
                        borderColor="border-blue-200"
                        gradientColor="from-blue-500/10 to-cyan-500/10"
                        cardBgColor="bg-blue-50/50 dark:bg-blue-900/10"
                        delay={0.1}
                      />

                      <MetricCard
                        title="Last Activity"
                        value={
                          statistics.lastActivity && isValid(new Date(statistics.lastActivity))
                            ? format(new Date(statistics.lastActivity), "MMM dd, yyyy")
                            : "N/A"
                        }
                        description="Most recent timestamp"
                        icon={<CalendarIcon className="h-5 w-5 text-muted-foreground" />}
                        loading={isLoadingProfile}
                        iconBgColor="bg-green-500/20"
                        iconColor="text-green-700"
                        borderColor="border-green-200"
                        gradientColor="from-green-500/10 to-emerald-500/10"
                        cardBgColor="bg-green-50/50 dark:bg-green-900/10"
                        delay={0.15}
                      />
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Status History Section (Admin only) */}
            {role === 'admin' && statusHistory && statusHistory.length > 0 && (
              <Card className="shadow-lg border-border/50">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-amber-500/20">
                      <History className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div>
                      <CardTitle className="text-base">Account Status History</CardTitle>
                      <CardDescription className="text-xs">Log of status updates and reasons</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="overflow-hidden rounded-lg border bg-background/40">
                    <Table>
                      <TableHeader className="bg-muted/50">
                        <TableRow>
                          <TableHead className="w-[150px]">Date</TableHead>
                          <TableHead className="w-[120px]">New Status</TableHead>
                          <TableHead>Reason</TableHead>
                          <TableHead>Changed By</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {statusHistory.map((history: any) => (
                          <TableRow key={history.id}>
                            <TableCell className="text-xs font-medium">
                              {format(new Date(history.created_at), "MMM dd, yyyy HH:mm")}
                            </TableCell>
                            <TableCell>
                              <Badge className={cn("text-[10px] font-bold uppercase", getStatusBadgeColor(history.new_status))}>
                                {history.new_status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs">
                              {history.reason || <span className="text-muted-foreground italic">No reason provided</span>}
                            </TableCell>
                            <TableCell className="text-xs">
                              <span className="font-medium">{history.changed_by_profile?.full_name || 'System'}</span>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Activity Distribution */}
            {statistics && statistics.total > 0 && Object.keys(statistics.byType).length > 0 && (
              <Card className="shadow-lg border-border/50">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-lg bg-indigo-500/20">
                        <TrendingUp className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                      </div>
                      <div>
                        <CardTitle className="text-base">Activity Breakdown</CardTitle>
                        <CardDescription className="text-xs">Actions performed by category</CardDescription>
                      </div>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      {Object.keys(statistics.byType).length} Types
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5">
                    {Object.entries(statistics.byType)
                      .sort(([, a], [, b]) => (b as number) - (a as number))
                      .map(([type, count]) => {
                        const Icon = getActivityIcon(type)
                        const colorClass = getActivityTypeColor(type)
                        return (
                          <div
                            key={type}
                            className={cn(
                              "flex flex-col p-3 rounded-lg border bg-background/50 transition-all",
                              colorClass.split(' ').find(c => c.startsWith('border-')) || "border-border"
                            )}
                          >
                            <div className="flex items-center justify-between mb-1.5">
                              <div className={cn(
                                "p-1 rounded-md",
                                colorClass.split(' ').filter(c => c.startsWith('bg-') || c.startsWith('text-')).join(' ')
                              )}>
                                <Icon className="h-3.5 w-3.5" />
                              </div>
                              <span className="text-sm font-bold">{count as number}</span>
                            </div>
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground truncate">
                              {type.replace(/_/g, ' ')}
                            </p>
                          </div>
                        )
                      })}
                  </div>
                </CardContent>
              </Card>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Workspace Summary Cards (When in All-Users mode) */}
      {!selectedUser && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <MetricCard
            title="Total Audit Events"
            value={pagination.total.toLocaleString()}
            description="Across whole workspace"
            icon={<History className="h-5 w-5 text-blue-600 dark:text-blue-400" />}
            loading={isLoadingActivities && !userActivitiesData}
            iconBgColor="bg-blue-500/20"
            iconColor="text-blue-700 dark:text-blue-400"
            borderColor="border-blue-200/50 dark:border-blue-900/50"
            gradientColor="from-blue-500/10 to-indigo-500/10"
            cardBgColor="bg-blue-50/40 dark:bg-blue-950/20"
          />

          <MetricCard
            title="Filtered Scope"
            value={appliedModuleFilter.length > 0 ? `${appliedModuleFilter.length} Modules` : "All Modules"}
            description={appliedActivityTypeFilter.length > 0 ? `${appliedActivityTypeFilter.length} activity types` : "All event types"}
            icon={<SlidersHorizontal className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />}
            loading={isLoadingActivities && !userActivitiesData}
            iconBgColor="bg-indigo-500/20"
            iconColor="text-indigo-700 dark:text-indigo-400"
            borderColor="border-indigo-200/50 dark:border-indigo-900/50"
            gradientColor="from-indigo-500/10 to-purple-500/10"
            cardBgColor="bg-indigo-50/40 dark:bg-indigo-950/20"
          />

          <MetricCard
            title="Audit Status"
            value="Active & Live"
            description="Tenant isolation verified"
            icon={<Shield className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />}
            loading={isLoadingActivities && !userActivitiesData}
            iconBgColor="bg-emerald-500/20"
            iconColor="text-emerald-700 dark:text-emerald-400"
            borderColor="border-emerald-200/50 dark:border-emerald-900/50"
            gradientColor="from-emerald-500/10 to-teal-500/10"
            cardBgColor="bg-emerald-50/40 dark:bg-emerald-950/20"
          />
        </div>
      )}

      {/* Main Activity Log Feed Section */}
      <Card className="shadow-lg border-border/50">
        <CardHeader className="pb-3">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <CardTitle className="text-base sm:text-lg">
                  {selectedUser ? "User Activity Logs" : "Activity & Event Logs"}
                </CardTitle>
                <Badge variant="outline" className="text-xs">
                  {pagination.total} events
                </Badge>
              </div>
              <CardDescription className="text-xs">
                {selectedUser
                  ? "Chronological history of this user's interactions with system modules"
                  : "Complete tenant audit trail ordered by most recent occurrence"}
              </CardDescription>
            </div>

            {/* Filter Toolbar */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Activity Type Filter Popover */}
              <Popover open={isActivityPopoverOpen} onOpenChange={setIsActivityPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 border-dashed gap-1 text-xs">
                    <Filter className="h-3.5 w-3.5 text-muted-foreground mr-1" />
                    Type
                    {appliedActivityTypeFilter.length > 0 && (
                      <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">
                        {appliedActivityTypeFilter.length}
                      </Badge>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[220px] p-2" align="start">
                  <div className="space-y-2">
                    <p className="text-xs font-semibold px-1">Filter by Activity Type</p>
                    <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                      {SYSTEM_ACTIVITY_TYPES.map((type) => (
                        <label
                          key={type.id}
                          className="flex items-center space-x-2 p-1.5 rounded hover:bg-muted cursor-pointer text-xs"
                        >
                          <Checkbox
                            checked={activityTypeFilter.includes(type.id)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setActivityTypeFilter([...activityTypeFilter, type.id])
                              } else {
                                setActivityTypeFilter(activityTypeFilter.filter(t => t !== type.id))
                              }
                            }}
                          />
                          <span className="capitalize">{type.label}</span>
                        </label>
                      ))}
                    </div>
                    <div className="flex flex-col gap-1.5 pt-2 border-t">
                      <Button
                        size="sm"
                        className="h-7 text-xs w-full"
                        onClick={() => {
                          setAppliedActivityTypeFilter(activityTypeFilter)
                          setIsActivityPopoverOpen(false)
                          setCurrentPage(1)
                        }}
                      >
                        Apply Filter
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-[11px] w-full text-muted-foreground"
                        onClick={() => {
                          setActivityTypeFilter([])
                          setAppliedActivityTypeFilter([])
                          setCurrentPage(1)
                        }}
                      >
                        Clear
                      </Button>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>

              {/* Module Filter Popover */}
              <Popover open={isModulePopoverOpen} onOpenChange={setIsModulePopoverOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 border-dashed gap-1 text-xs">
                    <Filter className="h-3.5 w-3.5 text-muted-foreground mr-1" />
                    Module
                    {appliedModuleFilter.length > 0 && (
                      <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">
                        {appliedModuleFilter.length}
                      </Badge>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[220px] p-2" align="start">
                  <div className="space-y-2">
                    <p className="text-xs font-semibold px-1">Filter by Module</p>
                    <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                      {SYSTEM_MODULES.map((mod) => (
                        <label
                          key={mod.id}
                          className="flex items-center space-x-2 p-1.5 rounded hover:bg-muted cursor-pointer text-xs"
                        >
                          <Checkbox
                            checked={moduleFilter.includes(mod.id)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setModuleFilter([...moduleFilter, mod.id])
                              } else {
                                setModuleFilter(moduleFilter.filter(m => m !== mod.id))
                              }
                            }}
                          />
                          <span>{mod.label}</span>
                        </label>
                      ))}
                    </div>
                    <div className="flex flex-col gap-1.5 pt-2 border-t">
                      <Button
                        size="sm"
                        className="h-7 text-xs w-full"
                        onClick={() => {
                          setAppliedModuleFilter(moduleFilter)
                          setIsModulePopoverOpen(false)
                          setCurrentPage(1)
                        }}
                      >
                        Apply Filter
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-[11px] w-full text-muted-foreground"
                        onClick={() => {
                          setModuleFilter([])
                          setAppliedModuleFilter([])
                          setCurrentPage(1)
                        }}
                      >
                        Clear
                      </Button>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>

              {/* Date Range Picker */}
              <Popover open={isDatePopoverOpen} onOpenChange={setIsDatePopoverOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 border-dashed gap-1 text-xs">
                    <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground mr-1" />
                    {appliedDateRange?.from ? (
                      appliedDateRange.to ? (
                        `${format(appliedDateRange.from, "MMM dd")} - ${format(appliedDateRange.to, "MMM dd")}`
                      ) : (
                        format(appliedDateRange.from, "MMM dd, yyyy")
                      )
                    ) : (
                      "Date Range"
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-2" align="start">
                  <Calendar
                    initialFocus
                    mode="range"
                    defaultMonth={dateRange?.from}
                    selected={dateRange}
                    onSelect={(range) => {
                      if (range?.from && range?.to) {
                        setDateRange({ from: range.from, to: range.to })
                      } else if (range?.from) {
                        setDateRange({ from: range.from, to: range.from })
                      } else {
                        setDateRange(undefined)
                      }
                    }}
                    numberOfMonths={1}
                  />
                  <div className="flex items-center justify-between pt-2 border-t mt-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-muted-foreground"
                      onClick={() => {
                        setDateRange(undefined)
                        setAppliedDateRange(undefined)
                        setCurrentPage(1)
                      }}
                    >
                      Clear
                    </Button>
                    <Button
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => {
                        setAppliedDateRange(dateRange)
                        setIsDatePopoverOpen(false)
                        setCurrentPage(1)
                      }}
                    >
                      Apply
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>

              {/* Reset Filters Button */}
              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleResetFilters}
                  className="h-8 text-xs text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5 mr-1" />
                  Reset
                </Button>
              )}

              {/* Export CSV Button */}
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportCSV}
                disabled={isExporting || activities.length === 0}
                className="h-8 gap-1.5 text-xs ml-auto"
                title="Export audit log report as CSV"
              >
                {isExporting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Download className="h-3.5 w-3.5 text-muted-foreground" />
                )}
                Export CSV
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <ActivityLogFeed
            activities={activities}
            isLoading={isLoadingActivities}
            skeletonCount={pageSize}
          />

          {/* Pagination Controls */}
          {pagination.total > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6 pt-4 border-t border-border/50">
              <div className="text-xs text-muted-foreground">
                Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} events
              </div>

              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-muted-foreground">Per page:</span>
                  <Select
                    value={`${pageSize}`}
                    onValueChange={(val) => {
                      setPageSize(Number(val))
                      setCurrentPage(1)
                    }}
                  >
                    <SelectTrigger className="h-7 w-[65px] text-xs">
                      <SelectValue placeholder={pageSize} />
                    </SelectTrigger>
                    <SelectContent side="top">
                      {[10, 20, 30, 50].map((size) => (
                        <SelectItem key={size} value={`${size}`} className="text-xs">
                          {size}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="text-xs font-medium">
                  Page {pagination.page} of {pagination.totalPages}
                </div>

                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setCurrentPage(1)}
                    disabled={currentPage === 1 || isFetchingActivities}
                  >
                    <ChevronsLeft className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1 || isFetchingActivities}
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setCurrentPage(p => Math.min(pagination.totalPages, p + 1))}
                    disabled={currentPage >= pagination.totalPages || isFetchingActivities}
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setCurrentPage(pagination.totalPages)}
                    disabled={currentPage >= pagination.totalPages || isFetchingActivities}
                  >
                    <ChevronsRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
