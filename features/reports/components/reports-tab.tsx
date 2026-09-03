"use client"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import React, { useState, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { DateRange } from "react-day-picker"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { trpc } from "@/lib/trpc/client"
import { cn } from "@/lib/utils"
import {
    Download,
    Users,
    Activity,
    BarChart3,
    FileText,
    FileSpreadsheet,
    Calendar as CalendarIcon,
    Filter,
    Loader2,
    CheckCircle2,
    XCircle,
    Search,
    User,
    ClipboardList,
    Clock,
    Eye,
    ChevronDown,
    AlertCircle
} from "lucide-react"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { Input } from "@/components/ui/input"
import { Calendar } from "@/components/ui/calendar"
import { format as formatDate } from "date-fns"
import { generateCSV, generatePDF, downloadFile } from "@/lib/report-utils"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { CardShell } from "@/features/attendance/CardShell"

const IconFileTypeCsv = FileSpreadsheet
const IconFileTypePdf = FileText

type ExportFormat = 'csv' | 'pdf'
type DownloadStatus = 'idle' | 'loading' | 'success' | 'error'

interface ReportDefinition {
    id: string
    title: string
    description: string
    icon: React.ComponentType<any>
    filters: ('role' | 'dateRange' | 'employee')[]
    fetchData: (
        role: 'admin' | 'moderator',
        filters: {
            roleFilter: string
            dateRange: DateRange | undefined
            selectedEmployee: { id: string; name: string } | undefined
        },
        utils: any
    ) => Promise<{ headers: string[]; rows: string[][] }>
    getFilename: (
        filters: {
            roleFilter: string
            dateRange: DateRange | undefined
            selectedEmployee: { id: string; name: string } | undefined
        },
        format: ExportFormat
    ) => string
    getPdfTitle: (
        filters: {
            roleFilter: string
            dateRange: DateRange | undefined
            selectedEmployee: { id: string; name: string } | undefined
        }
    ) => string
}

// Dynamic report definitions registry
const REPORTS: ReportDefinition[] = [
    {
        id: 'users',
        title: 'Users Report',
        description: 'Audit system user profiles and active roles/designations',
        icon: Users,
        filters: ['role'],
        fetchData: async (role, filters, utils) => {
            const data = role === 'admin'
                ? await utils.admin.reports.searchUsers.fetch({ query: '' })
                : await utils.moderator.reports.searchUsers.fetch({ query: '' })

            if (!data || data.length === 0) {
                throw new Error('No users found')
            }

            const filteredData = filters.roleFilter === 'all'
                ? data
                : data.filter((user: any) => user.role === filters.roleFilter)

            const headers = ['Name', 'Email', 'Mobile', 'Sex', 'Date of Birth', 'Designation', 'Role', 'Status', 'Created At']
            const rows = filteredData.map((user: any) => {
                let designationName = 'N/A'
                if (user.designation) {
                    if (Array.isArray(user.designation)) {
                        designationName = user.designation[0]?.name || 'N/A'
                    } else {
                        designationName = (user.designation as any).name || 'N/A'
                    }
                }

                if (designationName === 'N/A') {
                    if (user.role === 'admin') designationName = 'Administrator'
                    else if (user.role === 'moderator') designationName = 'Moderator'
                    else if (user.role === 'employee') designationName = 'Staff'
                }

                return [
                    `${user.first_name || ''} ${user.middle_name || ''} ${user.last_name || ''}`.trim() || 'N/A',
                    user.email || 'N/A',
                    user.mobile_no || 'N/A',
                    user.sex || 'N/A',
                    user.date_of_birth ? formatDate(new Date(user.date_of_birth), 'dd/MM/yyyy') : 'N/A',
                    designationName,
                    user.role || 'N/A',
                    user.status || 'active',
                    user.created_at ? formatDate(new Date(user.created_at), 'dd/MM/yyyy HH:mm') : 'N/A'
                ]
            })

            return { headers, rows }
        },
        getFilename: (filters, format) => {
            const dateStr = formatDate(new Date(), "yyyy-MM-dd")
            const roleStr = filters.roleFilter !== 'all' ? `-${filters.roleFilter}` : ''
            return `users-report${roleStr}-${dateStr}.${format}`
        },
        getPdfTitle: (filters) => {
            const roleStr = filters.roleFilter !== 'all' ? ` (${filters.roleFilter})` : ''
            return `Users Report${roleStr}`
        }
    },
    {
        id: 'activities',
        title: 'Activities Report',
        description: 'Audit log of actions, authentication, and system events',
        icon: Activity,
        filters: ['dateRange'],
        fetchData: async (role, filters, utils) => {
            const activities = role === 'admin'
                ? await utils.admin.reports.getAllActivities.fetch({
                    startDate: filters.dateRange?.from ? formatDate(filters.dateRange.from, 'yyyy-MM-dd') : undefined,
                    endDate: filters.dateRange?.to ? formatDate(filters.dateRange.to, 'yyyy-MM-dd') : undefined,
                })
                : await utils.moderator.reports.getAllActivities.fetch({
                    startDate: filters.dateRange?.from ? formatDate(filters.dateRange.from, 'yyyy-MM-dd') : undefined,
                    endDate: filters.dateRange?.to ? formatDate(filters.dateRange.to, 'yyyy-MM-dd') : undefined,
                })

            if (!activities || activities.length === 0) {
                throw new Error('No activities found in range')
            }

            const headers = ['Date', 'User', 'Email', 'Role', 'Activity Type', 'Module', 'Description']
            const rows = activities.map((activity: any) => {
                const profile = activity.profile
                const userName = profile
                    ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.email
                    : 'Unknown'

                return [
                    formatDate(new Date(activity.created_at), 'dd/MM/yyyy HH:mm:ss'),
                    userName,
                    profile?.email || 'N/A',
                    profile?.role || 'N/A',
                    activity.activity_type || 'N/A',
                    activity.module || 'N/A',
                    activity.description || 'N/A'
                ]
            })

            return { headers, rows }
        },
        getFilename: (filters, format) => {
            const dateStr = formatDate(new Date(), "yyyy-MM-dd")
            const rangeStr = filters.dateRange
                ? `-${filters.dateRange.from ? formatDate(filters.dateRange.from, "yyyyMMdd") : ''}-to-${filters.dateRange.to ? formatDate(filters.dateRange.to, "yyyyMMdd") : ''}`
                : '-last30days'
            return `activities-report${rangeStr}-${dateStr}.${format}`
        },
        getPdfTitle: (filters) => {
            const rangeStr = filters.dateRange
                ? `(${filters.dateRange.from ? formatDate(filters.dateRange.from, "MMM dd, yyyy") : ''} - ${filters.dateRange.to ? formatDate(filters.dateRange.to, "MMM dd, yyyy") : ''})`
                : '(Last 30 Days)'
            return `Activities Report\nDate Range: ${rangeStr}`
        }
    },
    {
        id: 'statistics',
        title: 'Statistics Summary',
        description: 'High-level business metrics and growth rate trends',
        icon: BarChart3,
        filters: [],
        fetchData: async (role, filters, utils) => {
            const reportsData = role === 'admin'
                ? await utils.admin.reports.getReportsData.fetch({ days: 30 })
                : await utils.moderator.reports.getReportsData.fetch({ days: 30 })

            if (!reportsData) {
                throw new Error('No statistics data found')
            }

            const headers = ['Metric', 'Value']
            const rows = [
                ['Total Users', String(reportsData.stats.totalUsers)],
                ['Active Users (Last 7 Days)', String(reportsData.stats.activeUsers)],
                ['Total Activities', String(reportsData.stats.totalActivities)],
                ['Today\'s Activities', String(reportsData.stats.todayActivities)],
                ['User Growth Rate', `${reportsData.trends.userGrowth.toFixed(2)}%`],
                ['Activity Growth Rate', `${reportsData.trends.activityGrowth.toFixed(2)}%`],
            ]

            if (role === 'admin') {
                rows.splice(1, 0, ['Total Admins', String((reportsData.stats as any).totalAdmins)])
                rows.splice(2, 0, ['Total Regular Users', String((reportsData.stats as any).totalRegularUsers)])

                const activityByRole = (reportsData.charts as any).activityByRole || []
                if (activityByRole.length > 0) {
                    rows.push(['', ''])
                    rows.push(['--- Activity Breakdown ---', ''])
                    activityByRole.forEach((item: any) => {
                        rows.push([`${item.name} (Total)`, String(item.admin + item.user)])
                    })
                }
            } else {
                rows.splice(1, 0, ['Total Moderators', String((reportsData.stats as any).totalModerators)])
                rows.splice(2, 0, ['Total Employees', String((reportsData.stats as any).totalEmployees)])
            }

            return { headers, rows }
        },
        getFilename: (filters, format) => {
            const dateStr = formatDate(new Date(), "yyyy-MM-dd")
            return `statistics-summary-${dateStr}.${format}`
        },
        getPdfTitle: () => 'Statistics Summary'
    },
    {
        id: 'attendance-summary',
        title: 'Attendance Summary',
        description: 'Aggregated employee attendance logs, leaves, and present rates',
        icon: ClipboardList,
        filters: ['dateRange'],
        fetchData: async (role, filters, utils) => {
            if (!filters.dateRange?.from || !filters.dateRange?.to) {
                throw new Error('Date range is required to fetch attendance summary')
            }
            const result = role === 'admin'
                ? await utils.admin.reports.getAttendanceSummaryReport.fetch({
                    startDate: formatDate(filters.dateRange.from, 'yyyy-MM-dd'),
                    endDate: formatDate(filters.dateRange.to, 'yyyy-MM-dd'),
                })
                : await utils.moderator.reports.getAttendanceSummaryReport.fetch({
                    startDate: formatDate(filters.dateRange.from, 'yyyy-MM-dd'),
                    endDate: formatDate(filters.dateRange.to, 'yyyy-MM-dd'),
                })

            if (!result.data || result.data.length === 0) {
                throw new Error('No attendance summaries found in range')
            }

            const headers = ['Employee Name', 'Designation', 'Full Days', 'Half Days', 'Absent', 'Total Leaves', 'Total Present']
            const rows = result.data.map((item: any) => [
                item.employeeName,
                item.employeeDesignation || 'N/A',
                String(item.fullDay),
                String(item.halfDay),
                String(item.absentDay),
                String(item.leaveDay),
                String(item.totalPresentDay)
            ])

            return { headers, rows }
        },
        getFilename: (filters, format) => {
            const rangeStr = filters.dateRange
                ? `${filters.dateRange.from ? formatDate(filters.dateRange.from, "yyyyMMdd") : ''}-to-${filters.dateRange.to ? formatDate(filters.dateRange.to, "yyyyMMdd") : ''}`
                : 'all'
            return `attendance-summary-${rangeStr}.${format}`
        },
        getPdfTitle: (filters) => {
            const rangeStr = filters.dateRange
                ? `(${filters.dateRange.from ? formatDate(filters.dateRange.from, "MMM dd, yyyy") : ''} - ${filters.dateRange.to ? formatDate(filters.dateRange.to, "MMM dd, yyyy") : ''})`
                : ''
            return `Attendance Summary\nDate Range: ${rangeStr}`
        }
    },
    {
        id: 'detailed-attendance',
        title: 'Detailed Attendance',
        description: 'Granular daily logs, clocks in/out, durations, and remarks',
        icon: Clock,
        filters: ['dateRange', 'employee'],
        fetchData: async (role, filters, utils) => {
            if (!filters.dateRange?.from || !filters.dateRange?.to) {
                throw new Error('Date range is required to fetch detailed attendance')
            }
            const result = role === 'admin'
                ? await utils.admin.reports.getDetailedAttendanceReport.fetch({
                    startDate: formatDate(filters.dateRange.from, 'yyyy-MM-dd'),
                    endDate: formatDate(filters.dateRange.to, 'yyyy-MM-dd'),
                    profileId: filters.selectedEmployee?.id,
                })
                : await utils.moderator.reports.getDetailedAttendanceReport.fetch({
                    startDate: formatDate(filters.dateRange.from, 'yyyy-MM-dd'),
                    endDate: formatDate(filters.dateRange.to, 'yyyy-MM-dd'),
                    profileId: filters.selectedEmployee?.id,
                })

            if (!result.data || result.data.length === 0) {
                throw new Error('No detailed attendance records found')
            }

            const headers = ['Date', 'Employee', 'Clock In', 'Clock Out', 'Duration (Hrs)', 'Status', 'Remarks']
            const rows = result.data.map((item: any) => [
                formatDate(new Date(item.date), 'dd/MM/yyyy'),
                item.employeeName,
                item.clockIn || '-',
                item.clockOut || '-',
                item.durationHours ? item.durationHours.toFixed(2) : '-',
                item.status,
                Array.isArray(item.remarks) ? item.remarks.join(', ') : (item.remarks || '')
            ])

            return { headers, rows }
        },
        getFilename: (filters, format) => {
            const rangeStr = filters.dateRange
                ? `${filters.dateRange.from ? formatDate(filters.dateRange.from, "yyyyMMdd") : ''}-to-${filters.dateRange.to ? formatDate(filters.dateRange.to, "yyyyMMdd") : ''}`
                : 'all'
            const employeeStr = filters.selectedEmployee ? `-${filters.selectedEmployee.name.replace(/\s+/g, '_')}` : ''
            return `detailed-attendance${employeeStr}-${rangeStr}.${format}`
        },
        getPdfTitle: (filters) => {
            const rangeStr = filters.dateRange
                ? `(${filters.dateRange.from ? formatDate(filters.dateRange.from, "MMM dd, yyyy") : ''} - ${filters.dateRange.to ? formatDate(filters.dateRange.to, "MMM dd, yyyy") : ''})`
                : ''
            const employeeStr = filters.selectedEmployee ? `\nEmployee: ${filters.selectedEmployee.name}` : ''
            return `Detailed Attendance${employeeStr}\nDate Range: ${rangeStr}`
        }
    }
]

interface ReportsTabProps {
    role?: 'admin' | 'moderator'
}

export function ReportsTab({ role = 'admin' }: ReportsTabProps) {
    // Consolidated State Settings
    const [selectedReportId, setSelectedReportId] = useState<string>('users')
    const [roleFilter, setRoleFilter] = useState<string>('all')
    const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
        const to = new Date()
        const from = new Date()
        from.setDate(to.getDate() - 30)
        return { from, to }
    })
    const [isDatePopoverOpen, setIsDatePopoverOpen] = useState(false)

    // Employee Selection State
    const [selectedEmployee, setSelectedEmployee] = useState<{ id: string; name: string; designation?: string } | undefined>()
    const [employeeSearchQuery, setEmployeeSearchQuery] = useState('')
    const [isEmployeePopoverOpen, setIsEmployeePopoverOpen] = useState(false)
    const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('')

    // Preview / Loading States
    const [previewData, setPreviewData] = useState<{ headers: string[]; rows: string[][] } | null>(null)
    const [previewLoading, setPreviewLoading] = useState(false)
    const [previewError, setPreviewError] = useState<string | null>(null)
    
    // Download States
    const [downloadStatus, setDownloadStatus] = useState<DownloadStatus>('idle')
    const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('csv')

    // Debounce search query
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearchQuery(employeeSearchQuery)
        }, 300)
        return () => clearTimeout(timer)
    }, [employeeSearchQuery])

    // tRPC utilities
    const utils = trpc.useUtils()

    // Fetch Employees for Search
    const adminSearchResults = trpc.admin.reports.searchEmployeesForReport.useQuery(
        { query: debouncedSearchQuery },
        { enabled: role === 'admin' && isEmployeePopoverOpen }
    )
    const moderatorSearchResults = trpc.moderator.reports.searchEmployeesForReport.useQuery(
        { query: debouncedSearchQuery },
        { enabled: role === 'moderator' && isEmployeePopoverOpen }
    )

    const searchResults = role === 'admin' ? adminSearchResults.data : moderatorSearchResults.data
    const isLoadingSearch = role === 'admin' ? adminSearchResults.isLoading : moderatorSearchResults.isLoading

    // Find the currently selected report definition
    const selectedReport = REPORTS.find(r => r.id === selectedReportId) || REPORTS[0]

    // Reset preview data and state when changing filters/reports
    const handleFilterChange = () => {
        setPreviewData(null)
        setPreviewError(null)
    }

    // Reset view whenever options are adjusted to avoid displaying stale data
    useEffect(() => {
        handleFilterChange()
    }, [selectedReportId, roleFilter, dateRange, selectedEmployee])

    // Fetch data for preview
    const handleViewReport = async () => {
        setPreviewLoading(true)
        setPreviewError(null)
        setPreviewData(null)
        try {
            const filters = { roleFilter, dateRange, selectedEmployee }
            const result = await selectedReport.fetchData(role, filters, utils)
            setPreviewData(result)
        } catch (error: any) {
            console.error('Error loading report preview:', error)
            setPreviewError(error.message || 'Failed to load report data.')
        } finally {
            setPreviewLoading(false)
        }
    }

    // Handle report download
    const handleDownloadReport = async (format: ExportFormat) => {
        setDownloadStatus('loading')
        try {
            let data = previewData
            // If data is not yet previewed or has been reset, fetch it on-the-fly
            if (!data) {
                const filters = { roleFilter, dateRange, selectedEmployee }
                data = await selectedReport.fetchData(role, filters, utils)
            }

            const filters = { roleFilter, dateRange, selectedEmployee }
            const filename = selectedReport.getFilename(filters, format)
            const pdfTitle = selectedReport.getPdfTitle(filters)

            if (format === 'csv') {
                const csvContent = generateCSV(data.headers, data.rows)
                downloadFile(csvContent, filename, 'text/csv;charset=utf-8;')
            } else {
                await generatePDF(pdfTitle, data.headers, data.rows, filename)
            }

            setDownloadStatus('success')
            setTimeout(() => setDownloadStatus('idle'), 2000)
        } catch (error) {
            console.error('Download error:', error)
            setDownloadStatus('error')
            setTimeout(() => setDownloadStatus('idle'), 2000)
        }
    }

    // Dynamic icon styling helper
    const getThemeColors = (id: string) => {
        switch (id) {
            case 'users':
                return {
                    text: 'text-blue-500 dark:text-blue-400',
                    bg: 'bg-blue-500/10 dark:bg-blue-500/20',
                    border: 'border-blue-500/30',
                    badgeBg: 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                }
            case 'activities':
                return {
                    text: 'text-green-500 dark:text-green-400',
                    bg: 'bg-green-500/10 dark:bg-green-500/20',
                    border: 'border-green-500/30',
                    badgeBg: 'bg-green-500/10 text-green-600 dark:text-green-400'
                }
            case 'statistics':
                return {
                    text: 'text-purple-500 dark:text-purple-400',
                    bg: 'bg-purple-500/10 dark:bg-purple-500/20',
                    border: 'border-purple-500/30',
                    badgeBg: 'bg-purple-500/10 text-purple-600 dark:text-purple-400'
                }
            case 'attendance-summary':
                return {
                    text: 'text-sky-500 dark:text-sky-400',
                    bg: 'bg-sky-500/10 dark:bg-sky-500/20',
                    border: 'border-sky-500/30',
                    badgeBg: 'bg-sky-500/10 text-sky-600 dark:text-sky-400'
                }
            case 'detailed-attendance':
                return {
                    text: 'text-indigo-500 dark:text-indigo-400',
                    bg: 'bg-indigo-500/10 dark:bg-indigo-500/20',
                    border: 'border-indigo-500/30',
                    badgeBg: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'
                }
            default:
                return {
                    text: 'text-muted-foreground',
                    bg: 'bg-muted/10',
                    border: 'border-muted-foreground/30',
                    badgeBg: 'bg-muted/10 text-muted-foreground'
                }
        }
    }

    const currentColors = getThemeColors(selectedReportId)

    return (
        <div className="flex flex-col gap-5">
            {/* Control Console (Top) */}
            <div className="w-full">
                <CardShell
                    title="Report Console"
                    description="Select a report and configure your parameters"
                    icon={selectedReport.icon}
                    contentClassName="py-0.5 px-3 flex flex-col"
                >
                    <div className="flex flex-col lg:flex-row lg:items-end gap-2 lg:gap-3 py-0">
                        {/* Report Selector */}
                        <div className="flex-1 min-w-[240px] space-y-0.5">
                            <label className="text-[11px] font-medium text-muted-foreground">Select Report</label>
                            <Select value={selectedReportId} onValueChange={setSelectedReportId}>
                                <SelectTrigger className="w-full !h-10 bg-background/50 hover:bg-background/80 transition-all border-muted/50 rounded-xl px-3 focus:ring-1 focus:ring-primary/20">
                                    <SelectValue placeholder="Choose a report..." />
                                </SelectTrigger>
                                <SelectContent className="max-h-[300px] rounded-xl">
                                    {REPORTS.map((report) => {
                                        const rColors = getThemeColors(report.id)
                                        return (
                                            <SelectItem key={report.id} value={report.id} className="py-2 rounded-lg my-0.5">
                                                <div className="flex items-start gap-2.5 max-w-[280px]">
                                                    <div className={cn("p-1.5 rounded-lg mt-0.5 shrink-0", rColors.bg)}>
                                                        <report.icon className={cn("h-4 w-4", rColors.text)} />
                                                    </div>
                                                    <div className="flex flex-col gap-0.5 text-left">
                                                        <span className="font-semibold text-xs text-foreground leading-none">{report.title}</span>
                                                        <span className="text-[10px] text-muted-foreground line-clamp-1">{report.description}</span>
                                                    </div>
                                                </div>
                                            </SelectItem>
                                        )
                                    })}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Filters Container */}
                        <AnimatePresence mode="wait">
                            {selectedReport.filters.length > 0 && (
                                <motion.div
                                    key={selectedReportId}
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: 10 }}
                                    transition={{ duration: 0.15 }}
                                    className="flex flex-col sm:flex-row sm:items-end gap-2 sm:gap-3 flex-[2] min-w-0"
                                >
                                    {/* Role Filter */}
                                    {selectedReport.filters.includes('role') && (
                                        <div className="flex-1 min-w-[150px] space-y-0.5">
                                            <label className="text-[11px] font-medium text-muted-foreground">User Role</label>
                                            <Select value={roleFilter} onValueChange={setRoleFilter}>
                                                <SelectTrigger className="!h-10 relative !pl-11 w-full bg-background/50 border-muted/50 rounded-lg">
                                                    <div className="absolute left-0 top-0 bottom-0 w-9 flex items-center justify-center bg-muted/20 border-r border-muted/30 rounded-l-lg">
                                                        <Filter className="h-3.5 w-3.5 text-muted-foreground" />
                                                    </div>
                                                    <SelectValue placeholder="Filter Role" />
                                                </SelectTrigger>
                                                <SelectContent className="rounded-lg">
                                                    <SelectItem value="all">All Roles</SelectItem>
                                                    {role === 'admin' && <SelectItem value="admin">Admin</SelectItem>}
                                                    <SelectItem value="moderator">Moderator</SelectItem>
                                                    <SelectItem value="employee">Employee</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    )}

                                    {/* Date Range Filter */}
                                    {selectedReport.filters.includes('dateRange') && (
                                        <div className="flex-1 min-w-[200px] space-y-0.5">
                                            <label className="text-[11px] font-medium text-muted-foreground">Date Range</label>
                                            <Popover open={isDatePopoverOpen} onOpenChange={setIsDatePopoverOpen}>
                                                <PopoverTrigger asChild>
                                                    <Button variant="outline" className="!h-10 border-muted/50 w-full justify-start font-normal relative !pl-11 bg-background/50 rounded-lg">
                                                        <div className="absolute left-0 top-0 bottom-0 w-9 flex items-center justify-center bg-muted/20 border-r border-muted/30 rounded-l-lg">
                                                            <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground" />
                                                        </div>
                                                        <span className="text-xs truncate">
                                                            {dateRange?.from ? (
                                                                dateRange.to ? (
                                                                    <>
                                                                        {formatDate(dateRange.from, "MMM dd, yyyy")} - {formatDate(dateRange.to, "MMM dd, yyyy")}
                                                                    </>
                                                                ) : (
                                                                    formatDate(dateRange.from, "MMM dd, yyyy")
                                                                )
                                                            ) : (
                                                                "Select Range"
                                                            )}
                                                        </span>
                                                    </Button>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-auto p-0 rounded-xl" align="start">
                                                    <div className="p-2 space-y-2">
                                                        <Calendar
                                                            initialFocus
                                                            mode="range"
                                                            defaultMonth={dateRange?.from}
                                                            selected={dateRange}
                                                            onSelect={setDateRange}
                                                            numberOfMonths={1}
                                                            captionLayout="dropdown"
                                                            fromYear={1960}
                                                            toYear={2030}
                                                            className="rounded-xl border border-muted/20"
                                                        />
                                                        <div className="flex gap-2 pt-2 border-t border-muted/20">
                                                            <Button
                                                                size="sm"
                                                                className="flex-1 rounded-lg text-xs"
                                                                onClick={() => setIsDatePopoverOpen(false)}
                                                            >
                                                                Apply
                                                            </Button>
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="rounded-lg text-xs"
                                                                onClick={() => {
                                                                    setDateRange(undefined)
                                                                    setIsDatePopoverOpen(false)
                                                                }}
                                                            >
                                                                Clear
                                                            </Button>
                                                        </div>
                                                    </div>
                                                </PopoverContent>
                                            </Popover>
                                        </div>
                                    )}

                                    {/* Employee Selector Filter */}
                                    {selectedReport.filters.includes('employee') && (
                                        <div className="flex-1 min-w-[200px] space-y-0.5">
                                            <label className="text-[11px] font-medium text-muted-foreground">Select Employee (Optional)</label>
                                            <Popover open={isEmployeePopoverOpen} onOpenChange={setIsEmployeePopoverOpen}>
                                                <PopoverTrigger asChild>
                                                    <Button 
                                                        variant="outline" 
                                                        role="combobox" 
                                                        aria-expanded={isEmployeePopoverOpen} 
                                                        className="!h-10 w-full justify-between relative bg-background/50 border-muted/50 rounded-lg pr-3 shrink-0"
                                                        style={{ paddingLeft: '48px' }}
                                                    >
                                                        <div className="absolute left-0 top-0 bottom-0 w-9 flex items-center justify-center bg-muted/20 border-r border-muted/30 rounded-l-lg">
                                                            {isLoadingSearch ? (
                                                                <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                                                            ) : (
                                                                <User className="h-3.5 w-3.5 text-muted-foreground" />
                                                            )}
                                                        </div>
                                                        <span className="truncate text-left text-xs flex-1">
                                                            {selectedEmployee ? `${selectedEmployee.name}` : "All Employees"}
                                                        </span>
                                                        <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-50 ml-1" />
                                                    </Button>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-[300px] p-0 rounded-xl" align="start">
                                                    <div className="p-2 border-b border-muted/20">
                                                        <div className="flex items-center gap-2 px-2 pb-1">
                                                            <Search className="h-3.5 w-3.5 text-muted-foreground" />
                                                            <Input
                                                                placeholder="Search by name..."
                                                                value={employeeSearchQuery}
                                                                onChange={(e) => setEmployeeSearchQuery(e.target.value)}
                                                                className="h-8 border-none focus-visible:ring-0 shadow-none bg-transparent text-xs p-0"
                                                                autoFocus
                                                            />
                                                        </div>
                                                    </div>
                                                    <div className="max-h-[220px] overflow-y-auto p-1 space-y-0.5">
                                                        <div
                                                            className={cn(
                                                                "relative flex cursor-pointer select-none items-center rounded-lg px-2.5 py-2 text-xs outline-none hover:bg-accent hover:text-accent-foreground transition-colors",
                                                                !selectedEmployee && "bg-accent/40 font-semibold"
                                                            )}
                                                            onClick={() => {
                                                                setSelectedEmployee(undefined)
                                                                setIsEmployeePopoverOpen(false)
                                                            }}
                                                        >
                                                            <span className="ml-1">All Employees</span>
                                                        </div>

                                                        {searchResults?.map((employee: any) => (
                                                            <div
                                                                key={employee.id}
                                                                className={cn(
                                                                    "relative flex cursor-pointer select-none items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs outline-none hover:bg-accent hover:text-accent-foreground transition-colors",
                                                                    selectedEmployee?.id === employee.id && "bg-accent text-accent-foreground font-semibold"
                                                                )}
                                                                onClick={() => {
                                                                    setSelectedEmployee({
                                                                        id: employee.id,
                                                                        name: `${employee.first_name} ${employee.last_name}`,
                                                                        designation: employee.designation
                                                                    })
                                                                    setIsEmployeePopoverOpen(false)
                                                                }}
                                                            >
                                                                <Avatar className="h-6 w-6">
                                                                    <AvatarImage src={employee.avatar} alt={employee.first_name} />
                                                                    <AvatarFallback className="text-[10px]">{employee.first_name?.[0]}{employee.last_name?.[0]}</AvatarFallback>
                                                                </Avatar>
                                                                <div className="flex flex-col flex-1 overflow-hidden">
                                                                    <span className="truncate">{employee.first_name} {employee.last_name}</span>
                                                                    <span className="text-[9px] text-muted-foreground truncate">{employee.designation || 'Staff'}</span>
                                                                </div>
                                                                {selectedEmployee?.id === employee.id && (
                                                                    <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />
                                                                )}
                                                            </div>
                                                        ))}
                                                        {searchResults && searchResults.length === 0 && (
                                                            <div className="py-4 text-center text-xs text-muted-foreground">
                                                                No employees found.
                                                            </div>
                                                        )}
                                                    </div>
                                                </PopoverContent>
                                            </Popover>
                                        </div>
                                    )}
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Action Buttons */}
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-2 sm:gap-3 shrink-0 pt-0 w-full lg:w-auto">
                            <div className="w-full lg:w-auto space-y-0.5">
                                <span className="hidden lg:block text-[11px] font-medium text-transparent">Action</span>
                                <Button
                                    onClick={handleViewReport}
                                    disabled={previewLoading || (selectedReport.filters.includes('dateRange') && !dateRange)}
                                    className="w-full !h-10 bg-primary hover:bg-primary/95 text-primary-foreground font-medium rounded-xl shadow-md transition-all flex items-center justify-center gap-2 px-4 shrink-0 text-xs"
                                >
                                    {previewLoading ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <Eye className="h-4 w-4" />
                                    )}
                                    Preview
                                </Button>
                            </div>

                            <div className="flex items-center gap-2 w-full lg:w-auto">
                                <div className="space-y-0.5 flex-1 sm:flex-initial">
                                    <span className="hidden lg:block text-[11px] font-medium text-transparent">Format</span>
                                    <Select value={selectedFormat} onValueChange={(v) => setSelectedFormat(v as ExportFormat)}>
                                        <SelectTrigger className="w-full sm:w-[85px] !h-10 border-muted/50 rounded-xl bg-background/50 hover:bg-background/80 transition-colors px-2">
                                            <div className="flex items-center gap-1.5 justify-center">
                                                {selectedFormat === 'csv' ? (
                                                    <IconFileTypeCsv className="h-4 w-4 text-green-600 dark:text-green-500 shrink-0" />
                                                ) : (
                                                    <IconFileTypePdf className="h-4 w-4 text-red-600 dark:text-red-500 shrink-0" />
                                                )}
                                                <span className="text-[11px] font-bold uppercase">{selectedFormat}</span>
                                            </div>
                                        </SelectTrigger>
                                        <SelectContent className="rounded-xl">
                                            <SelectItem value="csv" className="rounded-lg text-xs">
                                                <div className="flex items-center gap-2">
                                                    <IconFileTypeCsv className="h-4 w-4 text-green-600 dark:text-green-500" />
                                                    CSV
                                                </div>
                                            </SelectItem>
                                            <SelectItem value="pdf" className="rounded-lg text-xs">
                                                <div className="flex items-center gap-2">
                                                    <IconFileTypePdf className="h-4 w-4 text-red-600 dark:text-red-500" />
                                                    PDF
                                                </div>
                                            </SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-0.5 flex-initial">
                                    <span className="hidden lg:block text-[11px] font-medium text-transparent">Download</span>
                                    <Button
                                        onClick={() => handleDownloadReport(selectedFormat)}
                                        disabled={downloadStatus === 'loading' || (selectedReport.filters.includes('dateRange') && !dateRange)}
                                        variant="outline"
                                        size="icon"
                                        className={cn(
                                            "!h-10 !w-10 border-muted/50 rounded-xl transition-all relative flex items-center justify-center shrink-0",
                                            downloadStatus === 'success' && "bg-green-600 hover:bg-green-700 text-white border-green-600",
                                            downloadStatus === 'error' && "bg-red-600 hover:bg-red-700 text-white border-red-600"
                                        )}
                                        title="Download report"
                                    >
                                        <AnimatePresence mode="wait">
                                            <motion.div
                                                key={downloadStatus}
                                                initial={{ opacity: 0, scale: 0.8 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                exit={{ opacity: 0, scale: 0.8 }}
                                                transition={{ duration: 0.15 }}
                                                className="flex items-center justify-center"
                                            >
                                                {downloadStatus === 'loading' ? (
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                ) : downloadStatus === 'success' ? (
                                                    <CheckCircle2 className="h-4 w-4" />
                                                ) : downloadStatus === 'error' ? (
                                                    <XCircle className="h-4 w-4" />
                                                ) : (
                                                    <Download className="h-4 w-4" />
                                                )}
                                            </motion.div>
                                        </AnimatePresence>
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                </CardShell>
            </div>

            {/* Preview Panel (Bottom) */}
            <div className="w-full">
                <CardShell
                    title="Data Preview"
                    description={previewData ? `${selectedReport.title} active view` : 'Select a report to see a live representation below'}
                    icon={Eye}
                    contentClassName="p-2.5 flex flex-col"
                    headerActions={previewData ? (
                        <Badge className={cn("text-[10px] font-normal px-2 py-0.5 pointer-events-none rounded-full shrink-0", currentColors.badgeBg)}>
                            {previewData.rows.length} {previewData.rows.length === 1 ? 'record' : 'records'}
                        </Badge>
                    ) : (
                        <Badge variant="outline" className="text-[10px] font-mono border-muted/60 text-muted-foreground shrink-0">
                            SANDBOX
                        </Badge>
                    )}
                >
                    <div className="py-0">
                        <AnimatePresence mode="wait">
                            {previewLoading && (
                                <motion.div
                                    key="loading"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    className="w-full min-h-[300px] flex flex-col items-center justify-center space-y-3 p-6"
                                >
                                    <div className="flex flex-col items-center gap-3">
                                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                        <div className="text-center">
                                            <p className="text-xs font-semibold text-foreground">Fetching report records...</p>
                                            <p className="text-[10px] text-muted-foreground">Compiling DB tables and formatting results</p>
                                        </div>
                                    </div>
                                </motion.div>
                            )}

                            {previewError && (
                                <motion.div
                                    key="error"
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    className="w-full min-h-[300px] flex flex-col items-center justify-center p-8 text-center space-y-3"
                                >
                                    <div className="p-3 rounded-full bg-red-500/10 text-red-600 dark:text-red-500">
                                        <AlertCircle className="h-6 w-6" />
                                    </div>
                                    <div className="max-w-xs">
                                        <p className="text-xs font-semibold text-foreground">Preview Load Failed</p>
                                        <p className="text-[11px] text-muted-foreground mt-1">{previewError}</p>
                                    </div>
                                    <Button size="sm" variant="outline" className="h-8 rounded-lg text-xs" onClick={handleViewReport}>
                                        Try Again
                                    </Button>
                                </motion.div>
                            )}

                            {!previewData && !previewLoading && !previewError && (
                                <motion.div
                                    key="empty-state"
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    className="w-full min-h-[300px] flex flex-col items-center justify-center p-8 text-center"
                                >
                                    <div className="relative mb-4">
                                        <div className={cn("p-4 rounded-2xl relative transition-all duration-500", currentColors.bg)}>
                                            <selectedReport.icon className={cn("h-8 w-8 animate-pulse", currentColors.text)} />
                                        </div>
                                    </div>
                                    <div className="max-w-sm">
                                        <h3 className="text-xs font-bold text-foreground">Interactive Report Sandbox</h3>
                                        <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
                                            Configure the console on the left, then click <strong>Preview</strong> to load database values directly in the console before committing to export.
                                        </p>
                                    </div>
                                </motion.div>
                            )}

                            {previewData && !previewLoading && (
                                <motion.div
                                    key="table-content"
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                    className="w-full flex flex-col min-h-0 space-y-4"
                                >
                                    {/* Scrollable Container with Sticky Table Headers */}
                                    <div className="relative rounded-xl border border-muted/50 overflow-hidden bg-background/30 backdrop-blur-sm shadow-inner max-h-[600px] overflow-y-auto overflow-x-auto">
                                        <Table className="min-w-[700px] border-collapse relative">
                                            <TableHeader className="sticky top-0 bg-background/90 dark:bg-background/95 backdrop-blur-md z-20 shadow-sm border-b border-muted/30">
                                                <TableRow className="hover:bg-transparent border-none">
                                                    {previewData.headers.map((header, idx) => (
                                                        <TableHead key={idx} className="h-10 text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-4">
                                                            {header}
                                                        </TableHead>
                                                    ))}
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {previewData.rows.map((row, rowIdx) => (
                                                    <TableRow key={rowIdx} className="hover:bg-muted/20 border-b border-muted/20 transition-all">
                                                        {row.map((cell, cellIdx) => (
                                                            <TableCell key={cellIdx} className="text-xs px-4 py-2.5 font-medium max-w-[200px] truncate text-foreground/80">
                                                                {cell === '' ? '-' : cell}
                                                            </TableCell>
                                                        ))}
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>

                                    {/* Pagination Info & Hints */}
                                    <div className="flex items-center justify-between text-[10px] text-muted-foreground px-1">
                                        <div className="flex items-center gap-1.5">
                                            <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                                            <span>Displaying all {previewData.rows.length} rows</span>
                                        </div>
                                        <span>Scroll horizontally to see all columns if needed</span>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </CardShell>
            </div>
        </div>
    )
}
