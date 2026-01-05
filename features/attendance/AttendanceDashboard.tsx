"use client"

import { trpc } from "@/lib/trpc/client"
import { format, startOfMonth, endOfMonth, eachDayOfInterval, parseISO, isWithinInterval } from "date-fns"
import { useMemo, useState } from "react"
import { motion } from "framer-motion"
import { ClockUser as ClockUserIcon, CalendarDots as CalendarDotsIcon, CalendarCheck as CalendarCheckIcon, CalendarX as CalendarXIcon, CalendarMinus as CalendarMinusIcon, CalendarSlash as CalendarSlashIcon } from "@phosphor-icons/react"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { CardShell } from "./CardShell"
import { AttendanceCalendarContent } from "./AttendanceCalendarContent"
import { AttendanceSummaryContent } from "./AttendanceSummaryContent"
import { Calendar as CalendarIcon, Briefcase as BriefcaseIcon } from "@phosphor-icons/react"
import { useUserRealtimeDashboard } from "@/hooks/use-realtime-dashboard-data"
import { getDay } from "date-fns"
import { useIsMobile } from "@/hooks/use-mobile"

// Helper to calculate scheduled hours from time strings
function calculateScheduledHours(checkIn: string, checkOut: string): number {
    const [inH, inM] = checkIn.split(':').map(Number)
    const [outH, outM] = checkOut.split(':').map(Number)
    const inMinutes = inH * 60 + inM
    const outMinutes = outH * 60 + outM
    return (outMinutes - inMinutes) / 60
}

export function AttendanceDashboard() {
    const { data: profile } = trpc.profile.get.useQuery()
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
                const end = parseISO(l.endDate)
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
                    { label: "Marked Days", value: stats.marked, icon: CalendarDotsIcon, color: "text-primary", bg: "bg-primary/10", border: "border-primary/20" },
                    { label: "Present Days", value: stats.present, icon: CalendarCheckIcon, color: "text-green-600", bg: "bg-green-500/10", border: "border-green-500/20" },
                    { label: "Absent Days", value: stats.absent, icon: CalendarXIcon, color: "text-red-600", bg: "bg-red-500/10", border: "border-red-500/20" },
                    { label: "Leave Days", value: stats.leave, icon: CalendarMinusIcon, color: "text-orange-600", bg: "bg-orange-500/10", border: "border-orange-500/20" },
                    { label: "Office In", value: stats.noOfficeOut, icon: ClockUserIcon, color: "text-purple-600", bg: "bg-purple-500/10", border: "border-purple-500/20" },
                    { label: "Holidays", value: stats.holiday, icon: CalendarSlashIcon, color: "text-blue-600", bg: "bg-blue-500/10", border: "border-blue-500/20" }
                ].map((stat, i) => {
                    const Icon = stat.icon;
                    return (
                        <motion.div
                            key={i}
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            whileHover={{ y: -2, transition: { duration: 0.2 } }}
                            transition={{ delay: 0.1 + i * 0.05 }}
                            className={cn(
                                "flex flex-col p-3 rounded-xl border transition-all duration-300",
                                "bg-background/40 hover:bg-background/80",
                                "group cursor-default shadow-sm",
                                stat.border
                            )}
                        >
                            <div className="flex items-center justify-between mb-2">
                                <div className={cn(
                                    "p-1.5 rounded-lg transition-transform duration-300 group-hover:scale-110",
                                    stat.bg,
                                    stat.color
                                )}>
                                    <Icon size={28} weight="duotone" />
                                </div>
                                {isAttendanceLoading || isAttendanceFetching ? (
                                    <div className="h-8 w-12 bg-muted/30 rounded-md animate-pulse self-center" />
                                ) : (
                                    <span className={cn("text-2xl font-black tabular-nums tracking-tight", stat.color)}>{stat.value}</span>
                                )}
                            </div>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground truncate">
                                {stat.label}
                            </p>
                        </motion.div>
                    )
                })}
            </div>

            {/* Monthly Statistics Overview - Row 2: Detailed Metrics */}
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                {[
                    { label: "Total Full Day", value: stats.fullDay, icon: CalendarCheckIcon, color: "text-emerald-600", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
                    { label: "Total Half Day", value: stats.halfDay, icon: CalendarMinusIcon, color: "text-orange-600", bg: "bg-orange-500/10", border: "border-orange-500/20" },
                    { label: "Total Extra Hrs", value: `${stats.totalExtraHours.toFixed(1)}h`, icon: ClockUserIcon, color: "text-amber-600", bg: "bg-amber-500/10", border: "border-amber-500/20" },
                ].map((stat, i) => {
                    const Icon = stat.icon;
                    return (
                        <motion.div
                            key={i}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            whileHover={{ y: -2, transition: { duration: 0.2 } }}
                            transition={{ delay: 0.4 + i * 0.1 }}
                            className={cn(
                                "flex flex-col p-3 rounded-xl border transition-all duration-300",
                                "bg-background/40 hover:bg-background/80",
                                "group cursor-default shadow-sm",
                                stat.border
                            )}
                        >
                            <div className="flex items-center justify-between mb-2">
                                <div className={cn(
                                    "p-1.5 rounded-lg transition-transform duration-300 group-hover:scale-110",
                                    stat.bg,
                                    stat.color
                                )}>
                                    <Icon size={28} weight="duotone" />
                                </div>
                                {isAttendanceLoading || isAttendanceFetching ? (
                                    <div className="h-8 w-12 bg-muted/30 rounded-md animate-pulse self-center" />
                                ) : (
                                    <span className={cn("text-2xl font-black tabular-nums tracking-tight", stat.color)}>{stat.value}</span>
                                )}
                            </div>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground truncate">
                                {stat.label}
                            </p>
                        </motion.div>
                    )
                })}
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
                <CardShell
                    title="Monthly Calendar"
                    description={`Visual report for ${format(currentMonth, 'MMMM yyyy')}`}
                    icon={CalendarIcon}
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
