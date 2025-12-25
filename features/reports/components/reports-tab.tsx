"use client"

import React, { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { trpc } from "@/lib/trpc/client"
import { cn } from "@/lib/utils"
import { Download, Users, Activity, BarChart3, FileText, FileSpreadsheet, Calendar as CalendarIcon, Filter, Loader2, CheckCircle2, XCircle } from "lucide-react"
import { IconFileTypeCsv, IconFileTypePdf } from '@tabler/icons-react'
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
import { Calendar } from "@/components/ui/calendar"
import { format as formatDate } from "date-fns"
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

type ExportFormat = 'csv' | 'pdf'
type DownloadStatus = 'idle' | 'loading' | 'success' | 'error'

interface ReportCardProps {
    title: string
    description: string
    icon: React.ReactNode
    iconBgColor: string
    iconColor: string
    borderColor: string
    onDownload: (format: ExportFormat) => Promise<void>
    downloadStatus: DownloadStatus
    children?: React.ReactNode
}

function ReportCard({
    title,
    description,
    icon,
    iconBgColor,
    iconColor,
    borderColor,
    onDownload,
    downloadStatus,
    children
}: ReportCardProps) {
    const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('csv')

    const handleDownload = async () => {
        await onDownload(selectedFormat)
    }

    return (
        <Card className={cn(
            "relative overflow-hidden shadow-lg transition-all duration-300 hover:shadow-xl",
            borderColor
        )}>
            <CardHeader className="p-4 pb-2">
                <div className="flex items-center gap-2">
                    <div className={cn(
                        "p-2 rounded-lg",
                        iconBgColor
                    )}>
                        <span className={iconColor}>
                            {icon}
                        </span>
                    </div>
                    <div>
                        <CardTitle className="text-lg font-semibold">{title}</CardTitle>
                        <CardDescription className="text-xs">{description}</CardDescription>
                    </div>
                </div>
            </CardHeader>

            <CardContent className="p-4 pt-0">
                <div className="flex items-center gap-2">
                    {/* Filters Section */}
                    {children && (
                        <div className="flex-1">
                            {children}
                        </div>
                    )}

                    <div className={cn("flex items-center gap-2", !children && "ml-auto")}>
                        {/* Format Selector */}
                        <Select value={selectedFormat} onValueChange={(v) => setSelectedFormat(v as ExportFormat)}>
                            <SelectTrigger className="w-[100px] h-9">
                                <div className="flex items-center gap-2">
                                    {selectedFormat === 'csv' ? (
                                        <IconFileTypeCsv className="h-4 w-4 text-green-600" />
                                    ) : (
                                        <IconFileTypePdf className="h-4 w-4 text-red-600" />
                                    )}
                                    <span className="text-xs font-medium">{selectedFormat.toUpperCase()}</span>
                                </div>
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="csv">
                                    <div className="flex items-center gap-2">
                                        <IconFileTypeCsv className="h-4 w-4 text-green-600" />
                                        CSV
                                    </div>
                                </SelectItem>
                                <SelectItem value="pdf">
                                    <div className="flex items-center gap-2">
                                        <IconFileTypePdf className="h-4 w-4 text-red-600" />
                                        PDF
                                    </div>
                                </SelectItem>
                            </SelectContent>
                        </Select>

                        {/* Download Button */}
                        <Button
                            onClick={handleDownload}
                            disabled={downloadStatus === 'loading'}
                            size="icon"
                            variant="outline"
                            className={cn(
                                "h-9 w-9 transition-all duration-300 relative items-center justify-center",
                                downloadStatus === 'success' && "bg-green-600 hover:bg-green-700 text-primary-foreground border-green-600",
                                downloadStatus === 'error' && "bg-red-600 hover:bg-red-700 text-primary-foreground border-red-600"
                            )}
                            title={`Download ${selectedFormat.toUpperCase()}`}
                        >
                            <AnimatePresence mode="wait">
                                <motion.div
                                    key={downloadStatus}
                                    initial={{ opacity: 0, scale: 0.8, rotate: -45 }}
                                    animate={{ opacity: 1, scale: 1, rotate: 0 }}
                                    exit={{ opacity: 0, scale: 0.8, rotate: 45 }}
                                    transition={{ duration: 0.2, ease: "easeOut" }}
                                    className="flex items-center justify-center"
                                >
                                    {downloadStatus === 'loading' ? (
                                        <motion.div
                                            animate={{ rotate: 360 }}
                                            transition={{
                                                duration: 1,
                                                repeat: Infinity,
                                                ease: "linear",
                                                repeatType: "loop"
                                            }}
                                            className="flex items-center justify-center"
                                        >
                                            <Loader2 className="h-4 w-4" />
                                        </motion.div>
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
            </CardContent>
        </Card>
    )
}

interface ReportsTabProps {
    role?: 'admin' | 'moderator'
}

export function ReportsTab({ role = 'admin' }: ReportsTabProps) {
    // Download statuses
    const [usersDownloadStatus, setUsersDownloadStatus] = useState<DownloadStatus>('idle')
    const [activitiesDownloadStatus, setActivitiesDownloadStatus] = useState<DownloadStatus>('idle')
    const [statisticsDownloadStatus, setStatisticsDownloadStatus] = useState<DownloadStatus>('idle')

    // Filters
    const [roleFilter, setRoleFilter] = useState<string>('all')
    const [dateRange, setDateRange] = useState<{ from: Date; to: Date } | undefined>()
    const [isDatePopoverOpen, setIsDatePopoverOpen] = useState(false)

    // tRPC mutations for fetching data
    const utils = trpc.useUtils()

    // Helper: Generate CSV content
    const generateCSV = (headers: string[], rows: string[][]): string => {
        const csvContent = [
            headers.join(","),
            ...rows.map(row => row.map(cell => `"${(cell || '').replace(/"/g, '""')}"`).join(","))
        ].join("\n")
        return csvContent
    }

    // Helper: Download file
    const downloadFile = (content: string | Blob, filename: string, mimeType: string) => {
        const blob = content instanceof Blob ? content : new Blob([content], { type: mimeType })
        const link = document.createElement("a")
        const url = URL.createObjectURL(blob)
        link.setAttribute("href", url)
        link.setAttribute("download", filename)
        link.style.visibility = "hidden"
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)
    }

    // Helper: Generate PDF
    const generatePDF = (title: string, headers: string[], rows: string[][], filename: string) => {
        const doc = new jsPDF()

        // Title
        doc.setFontSize(18)
        doc.setTextColor(51, 51, 51)
        doc.text(title, 14, 22)

        // Date
        doc.setFontSize(10)
        doc.setTextColor(128, 128, 128)
        doc.text(`Generated on: ${formatDate(new Date(), "MMM dd, yyyy 'at' HH:mm:ss")}`, 14, 30)

        // Table
        autoTable(doc, {
            head: [headers],
            body: rows,
            startY: 40,
            styles: {
                fontSize: 9,
                cellPadding: 3,
            },
            headStyles: {
                fillColor: [79, 70, 229], // Indigo
                textColor: 255,
                fontStyle: 'bold',
            },
            alternateRowStyles: {
                fillColor: [249, 250, 251],
            },
        })

        doc.save(filename)
    }

    // Download Users Report
    const handleUsersDownload = useCallback(async (format: ExportFormat) => {
        setUsersDownloadStatus('loading')
        try {
            // Fetch all users via tRPC based on role
            const data = role === 'admin'
                ? await utils.admin.reports.searchUsers.fetch({ query: '' })
                : await utils.moderator.reports.searchUsers.fetch({ query: '' })

            if (!data || data.length === 0) {
                throw new Error('No users found')
            }

            // Filter by role if not 'all'
            const filteredData = roleFilter === 'all'
                ? data
                : data.filter(user => user.role === roleFilter)

            const headers = ['Name', 'Email', 'Mobile', 'Sex', 'Date of Birth', 'Designation', 'Role', 'Status', 'Created At']
            const rows = filteredData.map(user => {
                // Get designation name with fallbacks
                let designationName = 'N/A'
                if (user.designation) {
                    if (Array.isArray(user.designation)) {
                        designationName = user.designation[0]?.name || 'N/A'
                    } else {
                        designationName = (user.designation as any).name || 'N/A'
                    }
                }

                // Role-based fallbacks for missing designation
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

            const dateStr = formatDate(new Date(), "yyyy-MM-dd")
            const roleStr = roleFilter !== 'all' ? `-${roleFilter}` : ''

            if (format === 'csv') {
                const csvContent = generateCSV(headers, rows)
                downloadFile(csvContent, `users-report${roleStr}-${dateStr}.csv`, 'text/csv;charset=utf-8;')
            } else {
                generatePDF(`Users Report${roleFilter !== 'all' ? ` (${roleFilter})` : ''}`, headers, rows, `users-report${roleStr}-${dateStr}.pdf`)
            }

            setUsersDownloadStatus('success')
            setTimeout(() => setUsersDownloadStatus('idle'), 2000)
        } catch (error) {
            console.error('Users download error:', error)
            setUsersDownloadStatus('error')
            setTimeout(() => setUsersDownloadStatus('idle'), 2000)
        }
    }, [role, roleFilter, utils])

    const handleActivitiesDownload = useCallback(async (format: ExportFormat) => {
        setActivitiesDownloadStatus('loading')
        try {
            // Fetch all activities via the new getAllActivities procedure
            const activities = role === 'admin'
                ? await utils.admin.reports.getAllActivities.fetch({
                    startDate: dateRange?.from.toISOString(),
                    endDate: dateRange?.to.toISOString(),
                })
                : await utils.moderator.reports.getAllActivities.fetch({
                    startDate: dateRange?.from.toISOString(),
                    endDate: dateRange?.to.toISOString(),
                })

            if (!activities || activities.length === 0) {
                throw new Error('No activity data found')
            }

            // Headers for detailed activity log
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

            const dateStr = formatDate(new Date(), "yyyy-MM-dd")
            const rangeStr = dateRange
                ? `-${formatDate(dateRange.from, "yyyyMMdd")}-to-${formatDate(dateRange.to, "yyyyMMdd")}`
                : '-last30days'

            if (format === 'csv') {
                const csvContent = generateCSV(headers, rows)
                downloadFile(csvContent, `activities-report${rangeStr}-${dateStr}.csv`, 'text/csv;charset=utf-8;')
            } else {
                generatePDF(
                    `Activities Report${dateRange ? ` (${formatDate(dateRange.from, "MMM dd")} - ${formatDate(dateRange.to, "MMM dd, yyyy")})` : ' (Last 30 Days)'}`,
                    headers,
                    rows,
                    `activities-report${rangeStr}-${dateStr}.pdf`
                )
            }

            setActivitiesDownloadStatus('success')
            setTimeout(() => setActivitiesDownloadStatus('idle'), 2000)
        } catch (error) {
            console.error('Activities download error:', error)
            setActivitiesDownloadStatus('error')
            setTimeout(() => setActivitiesDownloadStatus('idle'), 2000)
        }
    }, [role, dateRange, utils])

    // Download Statistics Summary
    const handleStatisticsDownload = useCallback(async (format: ExportFormat) => {
        setStatisticsDownloadStatus('loading')
        try {
            const reportsData = role === 'admin'
                ? await utils.admin.reports.getReportsData.fetch({ days: 30 })
                : await utils.moderator.reports.getReportsData.fetch({ days: 30 })

            if (!reportsData) {
                throw new Error('No data found')
            }

            const headers = ['Metric', 'Value']
            const rows = [
                ['Total Users', String(reportsData.stats.totalUsers)],
                ['Active Users (Last 7 Days)', String(reportsData.stats.activeUsers)],
                ['Total Activities', String(reportsData.stats.totalActivities)],
                ['Today\'s Activities', String(reportsData.stats.todayActivities)],
                ['User Growth %', `${reportsData.trends.userGrowth.toFixed(2)}%`],
                ['Activity Growth %', `${reportsData.trends.activityGrowth.toFixed(2)}%`],
            ]

            if (role === 'admin') {
                rows.splice(1, 0, ['Total Admins', String((reportsData.stats as any).totalAdmins)])
                rows.splice(2, 0, ['Total Regular Users', String((reportsData.stats as any).totalRegularUsers)])

                // Add activity type breakdown for admin
                const activityByRole = (reportsData.charts as any).activityByRole || []
                if (activityByRole.length > 0) {
                    rows.push(['', '']) // Empty row
                    rows.push(['--- Activity Breakdown ---', ''])
                    activityByRole.forEach((item: any) => {
                        rows.push([`${item.name} (Total)`, String(item.admin + item.user)])
                    })
                }
            } else {
                rows.splice(1, 0, ['Total Moderators', String((reportsData.stats as any).totalModerators)])
                rows.splice(2, 0, ['Total Employees', String((reportsData.stats as any).totalEmployees)])
            }

            const dateStr = formatDate(new Date(), "yyyy-MM-dd")

            if (format === 'csv') {
                const csvContent = generateCSV(headers, rows)
                downloadFile(csvContent, `statistics-summary-${dateStr}.csv`, 'text/csv;charset=utf-8;')
            } else {
                generatePDF('Statistics Summary', headers, rows, `statistics-summary-${dateStr}.pdf`)
            }

            setStatisticsDownloadStatus('success')
            setTimeout(() => setStatisticsDownloadStatus('idle'), 2000)
        } catch (error) {
            console.error('Statistics download error:', error)
            setStatisticsDownloadStatus('error')
            setTimeout(() => setStatisticsDownloadStatus('idle'), 2000)
        }
    }, [role, utils])

    return (
        <div className="space-y-6">
            <Card className="shadow-lg">
                <CardHeader className="p-4 pb-2">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="p-2 rounded-lg bg-blue-500/20">
                                <Download className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                            </div>
                            <div>
                                <CardTitle className="text-lg">Download {role === 'admin' ? 'System' : ''} Reports</CardTitle>
                                <CardDescription className="text-xs">Generate and download data exports in CSV or PDF format</CardDescription>
                            </div>
                        </div>
                        <Badge variant="secondary" className="text-xs">
                            {formatDate(new Date(), "MMM dd, yyyy")}
                        </Badge>
                    </div>
                </CardHeader>

                <CardContent className="p-4 space-y-4">
                    {/* Report Cards Grid */}
                    <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                        {/* Users Report */}
                        <ReportCard
                            title="Users Report"
                            description={role === 'admin' ? "Export all user profiles" : "Export non-admin user profiles"}
                            icon={<Users className="h-5 w-5" />}
                            iconBgColor="bg-blue-500/20"
                            iconColor="text-blue-700 dark:text-blue-400"
                            borderColor="border-blue-200 dark:border-blue-800"
                            onDownload={handleUsersDownload}
                            downloadStatus={usersDownloadStatus}
                        >
                            {/* Role Filter */}
                            <Select value={roleFilter} onValueChange={setRoleFilter}>
                                <SelectTrigger className="h-9 relative pl-10 w-full">
                                    <div className="absolute left-0 top-0 bottom-0 w-9 flex items-center justify-center bg-muted/50 border-r rounded-l-md">
                                        <Filter className="h-4 w-4 text-muted-foreground" />
                                    </div>
                                    <SelectValue placeholder="Filter Role" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Roles</SelectItem>
                                    {role === 'admin' && <SelectItem value="admin">Admin</SelectItem>}
                                    <SelectItem value="moderator">Moderator</SelectItem>
                                    <SelectItem value="employee">Employee</SelectItem>
                                </SelectContent>
                            </Select>
                        </ReportCard>

                        {/* Activities Report */}
                        <ReportCard
                            title="Activities Report"
                            description="Export activity logs summary"
                            icon={<Activity className="h-5 w-5" />}
                            iconBgColor="bg-green-500/20"
                            iconColor="text-green-700 dark:text-green-400"
                            borderColor="border-green-200 dark:border-green-800"
                            onDownload={handleActivitiesDownload}
                            downloadStatus={activitiesDownloadStatus}
                        >
                            {/* Date Range Filter */}
                            <Popover open={isDatePopoverOpen} onOpenChange={setIsDatePopoverOpen}>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" size="sm" className="h-9 border-dashed w-full justify-start font-normal relative pl-10">
                                        <div className="absolute left-0 top-0 bottom-0 w-9 flex items-center justify-center bg-muted/50 border-r rounded-l-md">
                                            <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                                        </div>
                                        {dateRange?.from ? (
                                            dateRange.to ? (
                                                <>
                                                    {formatDate(dateRange.from, "LLL dd")} - {formatDate(dateRange.to, "LLL dd")}
                                                </>
                                            ) : (
                                                formatDate(dateRange.from, "LLL dd, y")
                                            )
                                        ) : (
                                            "Last 30 days"
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
                                            numberOfMonths={2}
                                        />
                                        <div className="flex gap-2 pt-2 border-t">
                                            <Button
                                                size="sm"
                                                className="flex-1"
                                                onClick={() => setIsDatePopoverOpen(false)}
                                            >
                                                Apply
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
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
                        </ReportCard>

                        {/* Statistics Summary */}
                        <ReportCard
                            title="Statistics Summary"
                            description="Export key metrics and trends"
                            icon={<BarChart3 className="h-5 w-5" />}
                            iconBgColor="bg-purple-500/20"
                            iconColor="text-purple-700 dark:text-purple-400"
                            borderColor="border-purple-200 dark:border-purple-800"
                            onDownload={handleStatisticsDownload}
                            downloadStatus={statisticsDownloadStatus}
                        />
                    </div>

                    {/* Info Card */}
                    <Card className="bg-muted/50 border-dashed shadow-none">
                        <CardContent className="pt-6">
                            <div className="flex items-start gap-4">
                                <div className="p-2 rounded-lg bg-amber-500/20">
                                    <FileText className="h-5 w-5 text-amber-700 dark:text-amber-400" />
                                </div>
                                <div className="space-y-1">
                                    <p className="font-medium">Report Formats</p>
                                    <p className="text-sm text-muted-foreground">
                                        <strong>CSV</strong> - Comma-separated values compatible with Excel, Google Sheets, and other spreadsheet applications.
                                    </p>
                                    <p className="text-sm text-muted-foreground">
                                        <strong>PDF</strong> - Portable document format suitable for printing and sharing.
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </CardContent>
            </Card>
        </div>
    )
}
