"use client"

import React, { useState, useCallback, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ColumnDef } from "@tanstack/react-table"
import { trpc } from "@/lib/trpc/client"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"
import { Search, X, User, UserStar, Shield, CircleUserRound, Mail, Phone, Calendar as CalendarIcon, Users, Activity, Download, Filter, TrendingUp, Clock, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Loader2, CheckCircle2, History } from "lucide-react"
import { HugeiconsIcon } from '@hugeicons/react'
import { UserListIcon, Activity04Icon } from '@hugeicons/core-free-icons'
import { Skeleton } from "@/components/ui/skeleton"
import { ActivityLogFeed, getActivityIcon, getActivityTypeColor } from "@/components/dashboard/activity-log-feed"
import { getDefaultAvatarUrl } from "@/lib/utils/avatar-helper"
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
import { format } from "date-fns"
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

import type { UserActivity } from "@/components/dashboard/activity-log-feed"

export function AnalyticsTab({ role = 'admin' }: { role?: 'admin' | 'moderator' }) {
  const [searchQuery, setSearchQuery] = useState("")
  const [searchStatus, setSearchStatus] = useState<AsyncState>('idle')
  const [selectedUser, setSelectedUser] = useState<string | null>(null)
  const [showDropdown, setShowDropdown] = useState(false)
  const [activityTypeFilter, setActivityTypeFilter] = useState<string[]>([])
  const [appliedActivityTypeFilter, setAppliedActivityTypeFilter] = useState<string[]>([])
  const [moduleFilter, setModuleFilter] = useState<string[]>([])
  const [appliedModuleFilter, setAppliedModuleFilter] = useState<string[]>([])

  const [dateRange, setDateRange] = useState<{ from: Date; to: Date } | undefined>()
  const [appliedDateRange, setAppliedDateRange] = useState<{ from: Date; to: Date } | undefined>()
  const [isActivityPopoverOpen, setIsActivityPopoverOpen] = useState(false)
  const [isModulePopoverOpen, setIsModulePopoverOpen] = useState(false)
  const [isDatePopoverOpen, setIsDatePopoverOpen] = useState(false)

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  // Search users
  const { data: searchResults, isLoading: isSearching, refetch: refetchSearch } = (role === 'admin'
    ? trpc.admin.reports.searchUsers
    : trpc.moderator.reports.searchUsers).useQuery(
      { query: searchQuery },
      {
        enabled: false, // Only search on button click
      }
    )

  // Get user profile details (only fetches once per user selection)
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

  // Get user activities (refetches on filter change)
  const { data: userActivitiesData, isLoading: isLoadingActivities, isFetching: isFetchingActivities } = (role === 'admin'
    ? trpc.admin.reports.getUserActivities
    : trpc.moderator.reports.getUserActivities).useQuery(
      {
        userId: selectedUser!,
        page: currentPage,
        limit: pageSize,
        activityType: appliedActivityTypeFilter.length > 0 ? appliedActivityTypeFilter : undefined,
        module: appliedModuleFilter.length > 0 ? appliedModuleFilter : undefined,
        startDate: appliedDateRange?.from ? new Date(new Date(appliedDateRange.from).setHours(0, 0, 0, 0)).toISOString() : undefined,
        endDate: appliedDateRange?.to ? new Date(new Date(appliedDateRange.to).setHours(23, 59, 59, 999)).toISOString() : appliedDateRange?.from ? new Date(new Date(appliedDateRange.from).setHours(23, 59, 59, 999)).toISOString() : undefined,
      },
      {
        enabled: !!selectedUser,
        placeholderData: (previousData) => previousData,
      }
    )

  // Get user status history
  const { data: statusHistory, isLoading: isLoadingHistory } = trpc.admin.reports.getUserStatusHistory.useQuery(
    { userId: selectedUser! },
    { enabled: !!selectedUser && role === 'admin' }
  )

  // Handle search
  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) return;

    setSearchStatus('loading');
    try {
      const result = await refetchSearch();
      if (!result.data || result.data.length === 0) {
        setSearchStatus('error');
        setTimeout(() => setSearchStatus('idle'), 2000);
        return;
      }
      setSearchStatus('success');
      setShowDropdown(true);
      setTimeout(() => setSearchStatus('idle'), 2000);
    } catch (error) {
      setSearchStatus('error');
      setTimeout(() => setSearchStatus('idle'), 2000);
    }
  }, [searchQuery, refetchSearch])

  // Handle reset
  const handleReset = useCallback(() => {
    setSearchQuery("")
    setSelectedUser(null)
    setShowDropdown(false)
    setActivityTypeFilter([])
    setAppliedActivityTypeFilter([])
    setModuleFilter([])
    setAppliedModuleFilter([])
    setDateRange(undefined)
    setAppliedDateRange(undefined)
    setIsActivityPopoverOpen(false)
    setIsModulePopoverOpen(false)
    setIsDatePopoverOpen(false)
    setCurrentPage(1)
  }, [])

  // Handle user selection
  const handleUserSelect = useCallback((user: SearchUser) => {
    setSelectedUser(user.id)
    setShowDropdown(false)
    setSearchQuery(`${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email)
    setCurrentPage(1)
  }, [])

  // Helper function to get role badge color
  const getRoleBadgeColor = (role?: string): string => {
    switch (role?.toLowerCase()) {
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


  // Activity columns
  const activityColumns: ColumnDef<UserActivity>[] = useMemo(() => [
    {
      accessorKey: "activity_type",
      header: "Activity Type",
      size: 140,
      cell: ({ row }) => {
        const type = row.getValue("activity_type") as string
        return (
          <Badge className={cn("capitalize border", getActivityTypeColor(type))}>
            {type || "Unknown"}
          </Badge>
        )
      },
    },
    {
      accessorKey: "description",
      header: "Description",
      size: 700,
      cell: ({ row }) => {
        const description = row.getValue("description") as string | null
        return (
          <div className="max-w-[700px] min-w-[500px]">
            <p className="text-sm whitespace-normal break-words leading-relaxed">{description || "No description"}</p>
          </div>
        )
      },
    },
    {
      accessorKey: "created_at",
      header: "Date & Time",
      size: 180,
      cell: ({ row }) => {
        const date = row.getValue("created_at") as string
        return (
          <div className="text-sm text-muted-foreground whitespace-nowrap">
            {format(new Date(date), "MMM dd, yyyy HH:mm:ss")}
          </div>
        )
      },
    },
  ], [])

  // Get unique activity types for filter
  // Get unique activity types for filter from statistics (all activities)
  const activityTypes = useMemo(() => {
    if (!userProfileData?.statistics?.byType) return []
    return Object.keys(userProfileData.statistics.byType)
  }, [userProfileData?.statistics])

  const modules = useMemo(() => {
    return userProfileData?.modules || []
  }, [userProfileData?.modules])

  const profile = userProfileData?.profile
  const activities = userActivitiesData?.activities || []
  const statistics = userProfileData?.statistics

  return (
    <div className="space-y-6">
      {/* Search Section */}
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Search User History</CardTitle>
          <CardDescription>
            Search users by name, email, or mobile number to view their complete activity history
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, or mobile number..."
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
                className="pl-10"
              />
              <AnimatePresence>
                {showDropdown && searchResults && searchResults.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="absolute z-50 w-full mt-1 bg-background border border-border rounded-lg shadow-lg max-h-60 overflow-auto"
                  >
                    {searchResults.map((user: SearchUser) => (
                      <motion.div
                        key={user.id}
                        whileHover={{ backgroundColor: "hsl(var(--muted))" }}
                        className="p-3 cursor-pointer border-b border-border last:border-b-0"
                        onClick={() => handleUserSelect(user)}
                      >
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={user.avatar_url || undefined} />
                            <AvatarFallback>
                              {user.first_name?.[0] || user.email[0].toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">
                              {`${user.first_name || ''} ${user.last_name || ''}`.trim() || "Unknown User"}
                            </p>
                            <p className="text-sm text-muted-foreground truncate">{user.email}</p>
                            {user.mobile_no && (
                              <p className="text-xs text-muted-foreground">{user.mobile_no}</p>
                            )}
                          </div>
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[10px] font-bold uppercase tracking-wider",
                              getRoleBadgeColor(user.role)
                            )}
                          >
                            {user.role}
                          </Badge>
                        </div>
                      </motion.div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <CreateUserButton
              onClick={handleSearch}
              loadingText="Searching..."
              successText="Record Found !!"
              errorText="No Record Found"
              disabled={!searchQuery.trim()}
              className="min-w-[140px] w-auto"
              asyncState={searchStatus}
              mode="search"
              size="md"
            >
              Search
            </CreateUserButton>
          </div>
        </CardContent>
      </Card>

      {/* User Details Section */}
      <AnimatePresence>
        {selectedUser && profile && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* User Profile Card */}
              <Card className="shadow-lg h-full">
                <CardHeader className="pb-0">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-blue-500/20">
                      <HugeiconsIcon icon={UserListIcon} size={24} className="text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">User Details</CardTitle>
                      <CardDescription className="text-xs">Complete profile information</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col md:flex-row gap-4 md:gap-6">
                    {/* Column 1 - Avatar Only */}
                    <div className="flex justify-center md:justify-start md:items-center flex-shrink-0">
                      <motion.div
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: 0.2 }}
                        className="relative"
                      >
                        <Avatar className={cn(
                          "h-28 w-28 md:h-36 md:w-36 border-4 shadow-lg transition-all duration-300",
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
                          <AvatarFallback className="text-2xl md:text-3xl">
                            {profile.first_name?.[0] || profile.email[0].toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className={cn(
                          "absolute -bottom-1 -right-1 h-6 w-6 rounded-full border-4 border-background",
                          profile.status === 'active' ? "bg-green-500" : profile.status === 'deleted' ? "bg-red-500" : "bg-amber-500"
                        )} />
                        {profile.status === 'deleted' && (
                          <div className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-[1px] rounded-full">
                            <span className="text-red-600 dark:text-red-400 text-xs font-bold uppercase tracking-tighter rotate-[-15deg] border-2 border-red-600 dark:border-red-400 px-1 py-0.5 rounded animate-in fade-in zoom-in duration-500">
                              Deleted
                            </span>
                          </div>
                        )}
                      </motion.div>
                    </div>

                    {/* Column 2 - Name, [Mobile + Role], [DOB + Sex], Email */}
                    <div className="space-y-3 flex-1 flex flex-col justify-center min-w-0">
                      {/* Name */}
                      <div className="flex items-center gap-2">
                        <div className="p-2 bg-muted rounded-lg flex-shrink-0">
                          <CircleUserRound className="h-5 w-5 text-foreground" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs text-muted-foreground">Name</p>
                          <p className="text-sm font-semibold truncate">
                            {`${profile.first_name || ''} ${profile.middle_name || ''} ${profile.last_name || ''}`.trim() || "N/A"}
                          </p>
                        </div>
                      </div>

                      {/* Row 2: DOB + Sex */}
                      <div className="grid grid-cols-2 gap-4 md:gap-6">
                        <div className="flex items-center gap-2">
                          <div className="p-2 bg-muted rounded-lg flex-shrink-0">
                            <CalendarIcon className="h-5 w-5 text-foreground" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs text-muted-foreground">Date of Birth</p>
                            <p className="text-sm font-semibold truncate">
                              {profile.date_of_birth
                                ? format(new Date(profile.date_of_birth), "MMM dd, yyyy")
                                : "N/A"}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <div className="p-2 bg-muted rounded-lg flex-shrink-0">
                            <Users className="h-5 w-5 text-foreground" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs text-muted-foreground">Sex</p>
                            <p className="text-sm font-semibold capitalize">{profile.sex || "N/A"}</p>
                          </div>
                        </div>
                      </div>

                      {/* Row 3: Role + Designation */}
                      <div className="grid grid-cols-2 gap-4 md:gap-6">
                        <div className="flex items-center gap-2">
                          <div className="p-2 bg-muted rounded-lg flex-shrink-0">
                            {profile.role === "admin" ? (
                              <UserStar className="h-5 w-5 text-foreground" />
                            ) : (
                              <User className="h-5 w-5 text-foreground" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs text-muted-foreground">Role</p>
                            <span
                              className={cn(
                                "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize border",
                                getRoleBadgeColor(profile.role)
                              )}
                            >
                              {profile.role}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <div className="p-2 bg-muted rounded-lg flex-shrink-0">
                            <Shield className="h-5 w-5 text-foreground" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs text-muted-foreground">Designation</p>
                            <p className="text-sm font-semibold truncate">
                              {getDesignationName(profile.designation)}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Row 4: Mobile */}
                      <div className="flex items-center gap-2">
                        <div className="p-2 bg-muted rounded-lg flex-shrink-0">
                          <Phone className="h-5 w-5 text-foreground" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs text-muted-foreground">Mobile Number</p>
                          <p className="text-sm font-semibold">{profile.mobile_no || "N/A"}</p>
                        </div>
                      </div>

                      {/* Row 5: Email */}
                      <div className="flex items-center gap-2">
                        <div className="p-2 bg-muted rounded-lg flex-shrink-0">
                          <Mail className="h-5 w-5 text-foreground" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs text-muted-foreground">Email ID</p>
                          <p className="text-sm font-semibold truncate">{profile.email || "N/A"}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Activity Statistics Card */}
              {statistics && statistics.total > 0 && (
                <Card className="shadow-lg border-border/50 bg-background/60 backdrop-blur-xl overflow-hidden h-full flex flex-col">
                  <CardHeader className="pb-0">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-lg bg-purple-500/20">
                        <HugeiconsIcon icon={Activity04Icon} size={24} className="text-purple-600 dark:text-purple-400" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">Activity Statistics</CardTitle>
                        <CardDescription className="text-xs">Summary of user activities</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="flex-1 flex items-center">
                    {/* Statistics Grid - 2 columns with vertical centering */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                      <MetricCard
                        title="Total Activities"
                        value={statistics.total}
                        description="All activities"
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
                          statistics.lastActivity
                            ? format(new Date(statistics.lastActivity), "MMM dd, yyyy")
                            : "N/A"
                        }
                        description="Most recent action"
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

            {/* Status History Section */}
            {role === 'admin' && statusHistory && statusHistory.length > 0 && (
              <Card className="shadow-lg border-border/50 bg-background/60 backdrop-blur-xl">
                <CardHeader className="pb-4">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-amber-500/20">
                      <History className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">Account Status History</CardTitle>
                      <CardDescription className="text-xs">Log of status changes and reasons</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="relative overflow-hidden rounded-xl border bg-background/40">
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
                          <TableRow key={history.id} className="hover:bg-muted/50 transition-colors">
                            <TableCell className="text-xs font-medium">
                              {format(new Date(history.created_at), "MMM dd, yyyy HH:mm")}
                            </TableCell>
                            <TableCell>
                              <Badge className={cn("text-[10px] font-bold uppercase tracking-wider", getStatusBadgeColor(history.new_status))}>
                                {history.new_status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs">
                              {history.reason || <span className="text-muted-foreground italic">No reason provided</span>}
                            </TableCell>
                            <TableCell className="text-xs">
                              <div className="flex flex-col">
                                <span className="font-medium">{history.changed_by_profile?.full_name || 'System'}</span>
                                <span className="text-[10px] text-muted-foreground">{history.changed_by_profile?.email}</span>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Activity Breakdown Section */}
            {statistics && statistics.total > 0 && Object.keys(statistics.byType).length > 0 && (
              <Card className="shadow-lg border-border/50 bg-background/60 backdrop-blur-xl">
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-lg bg-indigo-500/20">
                        <TrendingUp className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">Activity Distribution</CardTitle>
                        <CardDescription className="text-xs">Visual breakdown of actions performed</CardDescription>
                      </div>
                    </div>
                    <Badge variant="secondary" className="text-xs font-semibold">
                      {Object.keys(statistics.byType).length} Activity Types
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3"
                  >
                    {Object.entries(statistics.byType)
                      .sort(([, a], [, b]) => (b as number) - (a as number))
                      .map(([type, count], index) => {
                        const Icon = getActivityIcon(type)
                        const colorClass = getActivityTypeColor(type)
                        return (
                          <motion.div
                            key={type}
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            whileHover={{ y: -2, transition: { duration: 0.2 } }}
                            transition={{ delay: 0.35 + index * 0.05 }}
                            className={cn(
                              "flex flex-col p-3 rounded-xl border transition-all duration-300",
                              "bg-background/40 hover:bg-background/80",
                              "group cursor-default",
                              colorClass.split(' ').find(c => c.startsWith('border-')) || "border-border"
                            )}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div className={cn(
                                "p-1.5 rounded-lg transition-transform duration-300 group-hover:scale-110",
                                colorClass.split(' ').filter(c => c.startsWith('bg-') || c.startsWith('text-')).join(' ')
                              )}>
                                <Icon className="h-4 w-4" />
                              </div>
                              <span className="text-lg font-bold tracking-tight">{count as number}</span>
                            </div>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground truncate">
                              {type.replace(/_/g, ' ')}
                            </p>
                          </motion.div>
                        )
                      })}
                  </motion.div>
                </CardContent>
              </Card>
            )}

            {/* Activity Logs Section */}
            <Card className="shadow-lg">
              <CardHeader className="pb-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="space-y-1">
                    <CardTitle>Activity Logs</CardTitle>
                    <CardDescription className="text-sm">
                      Complete activity history ordered by most recent
                      {statistics && (
                        <span className="ml-2 font-medium">
                          ({statistics.total} total activities)
                        </span>
                      )}
                    </CardDescription>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Popover open={isActivityPopoverOpen} onOpenChange={setIsActivityPopoverOpen}>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className="h-8 border-dashed group pl-0 pr-3 overflow-hidden">
                          <div className="h-full px-2 bg-muted border-r border-dashed flex items-center mr-2">
                            <Filter className="h-3.5 w-3.5 text-muted-foreground" />
                          </div>
                          Activity Type
                          {appliedActivityTypeFilter.length > 0 && (
                            <>
                              <Badge variant="secondary" className="ml-2 rounded-sm px-1 font-normal">
                                {appliedActivityTypeFilter.length}
                              </Badge>
                              <div
                                role="button"
                                tabIndex={0}
                                className="ml-2 rounded-full p-0.5 hover:bg-slate-200 dark:hover:bg-slate-700 opacity-60 hover:opacity-100 transition-all"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setActivityTypeFilter([])
                                  setAppliedActivityTypeFilter([])
                                }}
                              >
                                <X className="h-3 w-3" />
                              </div>
                            </>
                          )}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[200px] p-0" align="start">
                        <div className="p-2 space-y-2">
                          <div className="space-y-2 max-h-60 overflow-y-auto">
                            {activityTypes.length > 0 ? (
                              activityTypes.map((type) => (
                                <div key={type} className="flex items-center space-x-2">
                                  <Checkbox
                                    id={`filter-${type}`}
                                    checked={activityTypeFilter.includes(type)}
                                    onCheckedChange={(checked) => {
                                      if (checked) {
                                        setActivityTypeFilter([...activityTypeFilter, type])
                                      } else {
                                        setActivityTypeFilter(activityTypeFilter.filter(t => t !== type))
                                      }
                                    }}
                                  />
                                  <Label htmlFor={`filter-${type}`} className="text-sm cursor-pointer w-full capitalize">
                                    {type}
                                  </Label>
                                </div>
                              ))
                            ) : (
                              <p className="text-sm text-muted-foreground px-2">No activity types available</p>
                            )}
                          </div>
                          <div className="flex flex-col gap-2 pt-2 border-t">
                            <Button
                              size="sm"
                              className="w-full"
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
                              className="w-full h-auto px-2 text-xs"
                              onClick={() => {
                                setActivityTypeFilter([])
                                setAppliedActivityTypeFilter([])
                                setCurrentPage(1)
                              }}
                              disabled={activityTypeFilter.length === 0 && appliedActivityTypeFilter.length === 0}
                            >
                              Clear selection
                            </Button>
                          </div>
                        </div>
                      </PopoverContent>
                    </Popover>

                    <Popover open={isModulePopoverOpen} onOpenChange={setIsModulePopoverOpen}>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className="h-8 border-dashed group pl-0 pr-3 overflow-hidden">
                          <div className="h-full px-2 bg-muted border-r border-dashed flex items-center mr-2">
                            <Filter className="h-3.5 w-3.5 text-muted-foreground" />
                          </div>
                          Module
                          {appliedModuleFilter.length > 0 && (
                            <>
                              <Badge variant="secondary" className="ml-2 rounded-sm px-1 font-normal">
                                {appliedModuleFilter.length}
                              </Badge>
                              <div
                                role="button"
                                tabIndex={0}
                                className="ml-2 rounded-full p-0.5 hover:bg-slate-200 dark:hover:bg-slate-700 opacity-60 hover:opacity-100 transition-all"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setModuleFilter([])
                                  setAppliedModuleFilter([])
                                }}
                              >
                                <X className="h-3 w-3" />
                              </div>
                            </>
                          )}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[200px] p-0" align="start">
                        <div className="p-2 space-y-2">
                          <div className="space-y-2 max-h-60 overflow-y-auto">
                            {modules.length > 0 ? (
                              modules.map((mod: string) => (
                                <div key={mod} className="flex items-center space-x-2">
                                  <Checkbox
                                    id={`module-${mod}`}
                                    checked={moduleFilter.includes(mod)}
                                    onCheckedChange={(checked) => {
                                      if (checked) {
                                        setModuleFilter([...moduleFilter, mod])
                                      } else {
                                        setModuleFilter(moduleFilter.filter(m => m !== mod))
                                      }
                                    }}
                                  />
                                  <Label htmlFor={`module-${mod}`} className="text-sm cursor-pointer w-full capitalize">
                                    {mod}
                                  </Label>
                                </div>
                              ))
                            ) : (
                              <p className="text-sm text-muted-foreground px-2">No modules available</p>
                            )}
                          </div>
                          <div className="flex flex-col gap-2 pt-2 border-t">
                            <Button
                              size="sm"
                              className="w-full"
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
                              className="w-full h-auto px-2 text-xs"
                              onClick={() => {
                                setModuleFilter([])
                                setAppliedModuleFilter([])
                                setCurrentPage(1)
                              }}
                              disabled={moduleFilter.length === 0 && appliedModuleFilter.length === 0}
                            >
                              Clear selection
                            </Button>
                          </div>
                        </div>
                      </PopoverContent>
                    </Popover>

                    <Popover open={isDatePopoverOpen} onOpenChange={setIsDatePopoverOpen}>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className="h-8 border-dashed group pl-0 pr-3 overflow-hidden">
                          <div className="h-full px-2 bg-muted border-r border-dashed flex items-center mr-2">
                            <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground" />
                          </div>
                          Date Range
                          {appliedDateRange?.from ? (
                            <>
                              <span className="ml-2 font-normal">
                                {appliedDateRange.to ? (
                                  <>
                                    {format(appliedDateRange.from, "LLL dd, y")} -{" "}
                                    {format(appliedDateRange.to, "LLL dd, y")}
                                  </>
                                ) : (
                                  format(appliedDateRange.from, "LLL dd, y")
                                )}
                              </span>
                              <div
                                role="button"
                                tabIndex={0}
                                className="ml-2 rounded-full p-0.5 hover:bg-slate-200 dark:hover:bg-slate-700 opacity-60 hover:opacity-100 transition-all"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setDateRange(undefined)
                                  setAppliedDateRange(undefined)
                                }}
                              >
                                <X className="h-3 w-3" />
                              </div>
                            </>
                          ) : (
                            <span className="ml-2 font-normal">Pick a date</span>
                          )}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <div className="p-2 space-y-2">
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
                            captionLayout="dropdown"
                            fromYear={1960}
                            toYear={2030}
                          />
                          <div className="flex flex-col gap-2 pt-2 border-t">
                            <Button
                              size="sm"
                              className="w-full"
                              onClick={() => {
                                setAppliedDateRange(dateRange)
                                setIsDatePopoverOpen(false)
                                setCurrentPage(1)
                              }}
                            >
                              Apply Filter
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="w-full"
                              onClick={() => {
                                setDateRange(undefined)
                                setAppliedDateRange(undefined)
                                setCurrentPage(1)
                              }}
                              disabled={!dateRange && !appliedDateRange}
                            >
                              Clear date range
                            </Button>
                          </div>
                        </div>
                      </PopoverContent>
                    </Popover>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => {
                        if (!userActivitiesData?.activities) return

                        // Create CSV content
                        const headers = ["Activity Type", "Description", "Date & Time"]
                        const rows = userActivitiesData.activities.map((activity: UserActivity) => [
                          activity.activity_type || "Unknown",
                          activity.description || "No description",
                          activity.created_at ? format(new Date(activity.created_at), "MMM dd, yyyy HH:mm:ss") : "N/A"
                        ])

                        const csvContent = [
                          headers.join(","),
                          ...rows.map(row => row.map(cell => `"${cell}"`).join(","))
                        ].join("\n")

                        // Download CSV
                        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
                        const link = document.createElement("a")
                        const url = URL.createObjectURL(blob)
                        link.setAttribute("href", url)
                        link.setAttribute("download", `user-activity-${profile?.email || 'user'}-${format(new Date(), "yyyy-MM-dd")}.csv`)
                        link.style.visibility = "hidden"
                        document.body.appendChild(link)
                        link.click()
                        document.body.removeChild(link)
                      }}
                      disabled={!userActivitiesData?.activities || userActivitiesData.activities.length === 0}
                      title="Export CSV"
                    >
                      <Download className="h-4 w-4" />
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
                {userActivitiesData?.pagination && userActivitiesData.pagination.total > 0 && (
                  <div className="flex items-center justify-between px-2 mt-8 pt-6 border-t border-border/50">
                    <div className="flex-1 text-sm text-muted-foreground font-medium">
                      Showing {(userActivitiesData.pagination.page - 1) * userActivitiesData.pagination.limit + 1} to {Math.min(userActivitiesData.pagination.page * userActivitiesData.pagination.limit, userActivitiesData.pagination.total)} of {userActivitiesData.pagination.total} activities
                    </div>
                    <div className="flex items-center space-x-6 lg:space-x-8">
                      <div className="flex items-center space-x-2">
                        <p className="text-sm font-medium">Rows per page</p>
                        <Select
                          value={`${pageSize}`}
                          onValueChange={(value) => {
                            setPageSize(Number(value))
                            setCurrentPage(1)
                          }}
                        >
                          <SelectTrigger className="h-8 w-[70px]">
                            <SelectValue placeholder={pageSize} />
                          </SelectTrigger>
                          <SelectContent side="top">
                            {[10, 20, 30, 40, 50].map((size) => (
                              <SelectItem key={size} value={`${size}`}>
                                {size}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex w-[100px] items-center justify-center text-sm font-medium">
                        Page {userActivitiesData.pagination.page} of {userActivitiesData.pagination.totalPages}
                      </div>
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="outline"
                          className="hidden h-8 w-8 p-0 lg:flex transition-all active:scale-95"
                          onClick={() => setCurrentPage(1)}
                          disabled={currentPage === 1 || isFetchingActivities}
                        >
                          <span className="sr-only">Go to first page</span>
                          {isFetchingActivities ? (
                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                          ) : (
                            <ChevronsLeft className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="outline"
                          className="h-8 w-8 p-0 transition-all active:scale-95"
                          onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                          disabled={currentPage === 1 || isFetchingActivities}
                        >
                          <span className="sr-only">Go to previous page</span>
                          {isFetchingActivities ? (
                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                          ) : (
                            <ChevronLeft className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="outline"
                          className="h-8 w-8 p-0 transition-all active:scale-95"
                          onClick={() => setCurrentPage(prev => Math.min(userActivitiesData.pagination.totalPages, prev + 1))}
                          disabled={currentPage === userActivitiesData.pagination.totalPages || isFetchingActivities}
                        >
                          <span className="sr-only">Go to next page</span>
                          {isFetchingActivities ? (
                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="outline"
                          className="hidden h-8 w-8 p-0 lg:flex transition-all active:scale-95"
                          onClick={() => setCurrentPage(userActivitiesData.pagination.totalPages)}
                          disabled={currentPage === userActivitiesData.pagination.totalPages || isFetchingActivities}
                        >
                          <span className="sr-only">Go to last page</span>
                          {isFetchingActivities ? (
                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                          ) : (
                            <ChevronsRight className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading State for User Details */}
      {
        selectedUser && isLoadingProfile && !profile && (
          <Card className="shadow-lg">
            <CardContent className="py-8">
              <div className="space-y-4">
                <Skeleton className="h-8 w-64" />
                <Skeleton className="h-32 w-full" />
              </div>
            </CardContent>
          </Card>
        )
      }

      {/* Empty State */}
      {
        !selectedUser && !isSearching && (
          <Card className="shadow-lg">
            <CardContent className="py-12 text-center">
              <Search className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Search for a User</h3>
              <p className="text-muted-foreground">
                Enter a name, email, or mobile number to view their complete activity history
              </p>
            </CardContent>
          </Card>
        )
      }
    </div >
  )
}
