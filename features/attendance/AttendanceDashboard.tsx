"use client"

import { trpc } from "@/lib/trpc/client"
import { format, startOfMonth, endOfMonth, eachDayOfInterval, parseISO, isWithinInterval, getDay } from "date-fns"
import { useMemo, useState } from "react"
import { motion } from "framer-motion"
import { Timer as ClockUserIcon, CalendarDays as CalendarDotsIcon, CalendarCheck as CalendarCheckIcon, CalendarX2 as CalendarXIcon, CalendarMinus as CalendarMinusIcon, CalendarOff as CalendarSlashIcon, Calendar as CalendarIcon, Briefcase as BriefcaseIcon, Download as DownloadSimple, FileSpreadsheet as IconFileTypeCsv, FileText as IconFileTypePdf } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { CardShell } from "./CardShell"
import { AttendanceCalendarContent } from "./AttendanceCalendarContent"
import { AttendanceSummaryContent } from "./AttendanceSummaryContent"
import { CompactMetricCard } from "@/components/dashboard/compact-metric-card"
import { useUserRealtimeDashboard } from "@/hooks/use-realtime-dashboard-data"
import { useIsMobile } from "@/hooks/use-mobile"
import { useProfile } from "@/lib/context/profile-context"

import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

// Helper to calculate scheduled hours from time strings
function calculateScheduledHours(checkIn: string, checkOut: string): number {
    const [inH, inM] = checkIn.split(':').map(Number)
    const [outH, outM] = checkOut.split(':').map(Number)
    const inMinutes = inH * 60 + inM
    const outMinutes = outH * 60 + outM
    return (outMinutes - inMinutes) / 60
}

export function AttendanceDashboard() {
    const { profile, isLoading: profileLoading, isInitializing: profileInitializing } = useProfile()
    const isMobile = useIsMobile()
    const utils = trpc.useUtils()
    const [isDownloading, setIsDownloading] = useState(false)

    // Enable real-time updates for the employee
    useUserRealtimeDashboard(
        profile?.id || '',
        undefined,
        'employee'
    )

    const today = useMemo(() => new Date(), [])
    const [currentMonth, setCurrentMonth] = useState(startOfMonth(today))
    const [selectedDate, setSelectedDate] = useState<Date | undefined>(today)

    const monthStart = startOfMonth(currentMonth)
    const monthEnd = endOfMonth(currentMonth)

    // Employee attendance is authorized from the server-side session. Do not
    // wait for the client profile cache before starting the first current-month
    // request; that cache can lag behind the authenticated tRPC context.
    const {
        data: attendance,
        isLoading: isAttendanceLoading,
        isError: isAttendanceError,
        error: attendanceError,
        refetch: refetchAttendance,
    } = trpc.attendance.getAttendance.useQuery({
        profileId: profile?.id,
        startDate: format(monthStart, 'yyyy-MM-dd'),
        endDate: format(monthEnd, 'yyyy-MM-dd')
    }, {
        enabled: true,
        retry: 3,
        retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 8000),
        refetchOnMount: 'always',
        refetchOnReconnect: 'always',
    })

    const { data: leaves, isLoading: isLeavesLoading } = trpc.attendance.getLeaves.useQuery({
        profileId: profile?.id,
        status: 'approved'
    }, {
        enabled: true,
    })

    const { data: closures, isLoading: isClosuresLoading } = trpc.attendance.getOfficeClosures.useQuery(undefined, {
        enabled: true,
    })
    const { data: settings, isLoading: isSettingsLoading } = trpc.attendance.getOfficeSettings.useQuery(undefined, {
        enabled: true,
    })

    // Only block the page during the first request. Background refetches
    // should keep the calendar, summary, and empty state visible.
    const isAttendanceDataLoading = profileLoading
        || profileInitializing
        || isAttendanceLoading
        || isLeavesLoading
        || isClosuresLoading
        || isSettingsLoading

    const attendanceMap = useMemo(() => {
        const map: Record<string, any> = {}
        attendance?.forEach(record => {
            const dateStr = record.date.split('T')[0]
            map[dateStr] = record
        })
        return map
    }, [attendance])

    const stats = useMemo(() => {
        const days = eachDayOfInterval({ start: monthStart, end: monthEnd })
        let marked = 0
        let present = 0
        let absent = 0
        let leave = 0
        let holiday = 0
        let noOfficeOut = 0
        let halfDay = 0
        let fullDay = 0
        let totalExtraHours = 0

        // Pre-calculate scheduled hours map
        const defaultScheduledHours = settings ? calculateScheduledHours(settings.default_check_in, settings.default_check_out) : 9

        days.forEach(day => {
            const dateStr = format(day, 'yyyy-MM-dd')
            const record = attendanceMap[dateStr]
            const dayOfWeek = day.getDay()
            const isOffDay = settings?.off_days?.includes(dayOfWeek)

            const isHoliday = closures?.some(c => c.date === dateStr)
            if (isHoliday) {
                holiday++
                return
            }

            const isLeave = leaves?.some(l => {
                const start = parseISO(l.start_date)
                const end = parseISO(l.end_date)
                return isWithinInterval(day, { start, end })
            })
            if (isLeave) {
                leave++
                return
            }

            if (record) {
                if (record.is_half_day) {
                    halfDay++
                }

                if (record.status === 'verified') {
                    present++
                    if (!record.is_half_day) {
                        fullDay++
                    }
                } else if (record.check_in && record.check_out) {
                    marked++
                } else if (record.check_in && !record.check_out) {
                    noOfficeOut++
                }

                // Calculate extra hours for Total Extra Hrs card
                if (record.working_hours && settings) {
                    const scheduled = defaultScheduledHours // Simple version for stats
                    const extra = (record.working_hours as number) - scheduled
                    if (extra > 0) {
                        totalExtraHours += extra
                    }
                }
            } else if (day < today && !isOffDay) {
                absent++
            }
        })

        return { marked, present, absent, leave, holiday, noOfficeOut, halfDay, fullDay, totalExtraHours }
    }, [attendanceMap, leaves, closures, settings, monthStart, monthEnd, today])

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
    const generatePDF = async (title: string, headers: string[], rows: string[][], filename: string) => {
        const [{ jsPDF }, { default: autoTable }] = await Promise.all([
            import('jspdf'),
            import('jspdf-autotable'),
        ])
        const doc = new jsPDF()

        // Title
        doc.setFontSize(18)
        doc.setTextColor(51, 51, 51)
        doc.text(title, 14, 22)

        // Date
        doc.setFontSize(10)
        doc.setTextColor(128, 128, 128)
        doc.text(`Generated on: ${format(new Date(), "MMM dd, yyyy 'at' HH:mm:ss")}`, 14, 30)

        // Table
        autoTable(doc, {
            head: [headers],
            body: rows,
            startY: 40,
            styles: { fontSize: 9, cellPadding: 3 },
            headStyles: { fillColor: [79, 70, 229], textColor: 255, fontStyle: 'bold' },
            alternateRowStyles: { fillColor: [249, 250, 251] },
        })

        doc.save(filename)
    }

    const handleDownloadReport = async (formatType: 'csv' | 'pdf') => {
        setIsDownloading(true)
        try {
            const startDate = startOfMonth(currentMonth)
            const endDate = endOfMonth(currentMonth)

            const result = await utils.attendance.getMyAttendanceReport.fetch({
                startDate: format(startDate, 'yyyy-MM-dd'),
                endDate: format(endDate, 'yyyy-MM-dd'),
            })

            if (!result.data || result.data.length === 0) {
                // Show toast or error? For now just log
                console.warn("No data to download")
                setIsDownloading(false)
                return
            }

            const headers = ['Date', 'Clock In', 'Clock Out', 'Duration (Hrs)', 'Status', 'Remarks']
            const rows = result.data.map((item: any) => [
                format(new Date(item.date), 'dd/MM/yyyy'),
                item.clockIn ? format(new Date(item.clockIn), 'HH:mm') : '-',
                item.clockOut ? format(new Date(item.clockOut), 'HH:mm') : '-',
                item.durationHours ? item.durationHours.toFixed(2) : '-',
                item.status,
                Array.isArray(item.remarks) ? item.remarks.join(', ') : (item.remarks || '')
            ])

            const monthStr = format(currentMonth, 'MMMM-yyyy')
            const filename = `my-attendance-${monthStr}`

            if (formatType === 'csv') {
                const csvContent = generateCSV(headers, rows)
                downloadFile(csvContent, `${filename}.csv`, 'text/csv;charset=utf-8;')
            } else {
                await generatePDF(
                    `My Attendance Report - ${format(currentMonth, 'MMMM yyyy')}`,
                    headers,
                    rows,
                    `${filename}.pdf`
                )
            }
        } catch (error) {
            console.error("Download failed", error)
        } finally {
            setIsDownloading(false)
        }
    }

    return (
        <div className="space-y-8">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Attendance Dashboard</h2>
                    <p className="text-muted-foreground">Manage your daily attendance and leave requests</p>
                </div>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" disabled={isDownloading}>
                            <DownloadSimple className="mr-2 h-4 w-4" />
                            {isDownloading ? "Generating..." : "Download Report"}
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleDownloadReport('csv')}>
                            <IconFileTypeCsv className="mr-2 h-4 w-4 text-green-600" />
                            <span>Download CSV</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDownloadReport('pdf')}>
                            <IconFileTypePdf className="mr-2 h-4 w-4 text-red-600" />
                            <span>Download PDF</span>
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            {/* Monthly Statistics Overview - Row 1: Base Metrics */}
            <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
                {[
                    { label: "Marked Days", value: stats.marked, icon: CalendarDotsIcon, theme: "primary" as const },
                    { label: "Present Days", value: stats.present, icon: CalendarCheckIcon, theme: "green" as const },
                    { label: "Absent Days", value: stats.absent, icon: CalendarXIcon, theme: "red" as const },
                    { label: "Leave Days", value: stats.leave, icon: CalendarMinusIcon, theme: "orange" as const },
                    { label: "Office In", value: stats.noOfficeOut, icon: ClockUserIcon, theme: "purple" as const },
                    { label: "Holidays", value: stats.holiday, icon: CalendarSlashIcon, theme: "blue" as const }
                ].map((stat, i) => (
                    <CompactMetricCard
                        key={i}
                        label={stat.label}
                        value={stat.value}
                        icon={stat.icon}
                        theme={stat.theme}
                        delay={0.1 + i * 0.05}
                         loading={isAttendanceDataLoading}
                    />
                ))}
            </div>

            {/* Monthly Statistics Overview - Row 2: Detailed Metrics */}
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                {[
                    { label: "Total Full Day", value: stats.fullDay, icon: CalendarCheckIcon, theme: "emerald" as const },
                    { label: "Total Half Day", value: stats.halfDay, icon: CalendarMinusIcon, theme: "orange" as const },
                    { label: "Total Extra Hrs", value: `${stats.totalExtraHours.toFixed(1)}h`, icon: ClockUserIcon, theme: "amber" as const },
                ].map((stat, i) => (
                    <CompactMetricCard
                        key={i}
                        label={stat.label}
                        value={stat.value}
                        icon={stat.icon}
                        theme={stat.theme}
                        delay={0.4 + i * 0.1}
                         loading={isAttendanceDataLoading}
                    />
                ))}
            </div>

            {isAttendanceError && (
                <div
                    role="alert"
                    className="flex flex-col gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive sm:flex-row sm:items-center sm:justify-between"
                >
                    <span>
                        {attendanceError?.message || "Attendance data could not be loaded."}
                    </span>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => void refetchAttendance()}
                    >
                        Retry
                    </Button>
                </div>
            )}

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-stretch">
                <CardShell
                    title="Monthly Calendar"
                    description={`Visual report for ${format(currentMonth, 'MMMM yyyy')}`}
                    icon={CalendarIcon}
                    className="xl:col-span-6"
                    isInnerCard={true}
                >
                    <AttendanceCalendarContent
                        currentMonth={currentMonth}
                        setCurrentMonth={setCurrentMonth}
                        attendanceMap={attendanceMap}
                        attendance={attendance}
                        settings={settings}
                        closures={closures}
                        leaves={leaves}
                        selectedDate={selectedDate}
                        setSelectedDate={setSelectedDate}
                        today={today}
                        monthStart={monthStart}
                    />
                </CardShell>

                <CardShell
                    title="Attendance Summary"
                    description={`Detailed logs for ${format(currentMonth, 'MMMM yyyy')}`}
                    icon={BriefcaseIcon}
                    className="xl:col-span-6"
                    contentClassName="p-0 flex-1 overflow-auto max-h-[750px] scrollbar-thin scrollbar-thumb-primary/20"
                >
                    <div className="px-4 py-2">
                        <AttendanceSummaryContent
                            attendance={attendance}
                             isLoading={isAttendanceDataLoading}
                            settings={settings}
                            closures={closures}
                            leaves={leaves}
                            currentMonth={currentMonth}
                        />
                    </div>
                </CardShell>
            </div>
        </div>
    )
}
