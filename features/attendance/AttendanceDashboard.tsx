"use client"

import { trpc } from "@/lib/trpc/client"
import { format, startOfMonth, endOfMonth, eachDayOfInterval, parseISO, isWithinInterval } from "date-fns"
import { useMemo, useState } from "react"
import { motion } from "framer-motion"
import { ClockUser as ClockUserIcon, CalendarDots as CalendarDotsIcon, CalendarCheck as CalendarCheckIcon, CalendarX as CalendarXIcon, CalendarMinus as CalendarMinusIcon, CalendarSlash as CalendarSlashIcon, Calendar as CalendarIcon, Briefcase as BriefcaseIcon } from "@phosphor-icons/react"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { CardShell } from "./CardShell"
import { AttendanceCalendarContent } from "./AttendanceCalendarContent"
import { AttendanceSummaryContent } from "./AttendanceSummaryContent"
import { CompactMetricCard } from "@/components/dashboard/compact-metric-card"
import { useUserRealtimeDashboard } from "@/hooks/use-realtime-dashboard-data"
import { getDay } from "date-fns"
import { useIsMobile } from "@/hooks/use-mobile"
import { useProfile } from "@/lib/context/profile-context"

// Helper to calculate scheduled hours from time strings
function calculateScheduledHours(checkIn: string, checkOut: string): number {
    const [inH, inM] = checkIn.split(':').map(Number)
    const [outH, outM] = checkOut.split(':').map(Number)
    const inMinutes = inH * 60 + inM
    const outMinutes = outH * 60 + outM
    return (outMinutes - inMinutes) / 60
}

export function AttendanceDashboard() {
    const { profile } = useProfile()
    const isMobile = useIsMobile()

    // Enable real-time updates for the employee
    useUserRealtimeDashboard(
        profile?.id || '',
        undefined,
        'employee'
    )

    const today = new Date()
    const [currentMonth, setCurrentMonth] = useState(startOfMonth(today))
    const [selectedDate, setSelectedDate] = useState<Date | undefined>(today)

    const monthStart = startOfMonth(currentMonth)
    const monthEnd = endOfMonth(currentMonth)

    const { data: attendance, isLoading: isAttendanceLoading, isFetching: isAttendanceFetching } = trpc.attendance.getAttendance.useQuery({
        startDate: format(monthStart, 'yyyy-MM-dd'),
        endDate: format(monthEnd, 'yyyy-MM-dd')
    })

    const { data: leaves } = trpc.attendance.getLeaves.useQuery({
        status: 'approved'
    })

    const { data: closures } = trpc.attendance.getOfficeClosures.useQuery()
    const { data: settings } = trpc.attendance.getOfficeSettings.useQuery()

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

    return (
        <div className="space-y-8">
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
                        loading={isAttendanceLoading || isAttendanceFetching}
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
                        loading={isAttendanceLoading || isAttendanceFetching}
                    />
                ))}
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
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
                            isLoading={isAttendanceLoading}
                            settings={settings}
                        />
                    </div>
                </CardShell>
            </div>
        </div>
    )
}
