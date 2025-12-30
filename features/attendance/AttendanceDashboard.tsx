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

export function AttendanceDashboard() {
    const today = new Date()
    const [currentMonth, setCurrentMonth] = useState(startOfMonth(today))
    const [selectedDate, setSelectedDate] = useState<Date | undefined>(today)

    const monthStart = startOfMonth(currentMonth)
    const monthEnd = endOfMonth(currentMonth)

    const { data: attendance, isLoading: isAttendanceLoading } = trpc.attendance.getAttendance.useQuery({
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

        days.forEach(day => {
            const dateStr = format(day, 'yyyy-MM-dd')
            const record = attendanceMap[dateStr]
            const isOffDay = settings?.off_days?.includes(day.getDay())

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
                if (record.status === 'verified') {
                    present++
                } else if (record.check_in && record.check_out) {
                    marked++
                } else if (record.check_in && !record.check_out) {
                    noOfficeOut++
                }
            } else if (day < today && !isOffDay) {
                absent++
            }
        })

        return { marked, present, absent, leave, holiday, noOfficeOut }
    }, [attendanceMap, leaves, closures, settings, monthStart, monthEnd, today])

    return (
        <div className="space-y-8">
            {/* Monthly Statistics Overview */}
            <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
                {[
                    { label: "Marked Days", value: stats.marked, icon: CalendarDotsIcon, color: "text-primary", bg: "bg-primary/10", border: "border-primary/20" },
                    { label: "Present Days", value: stats.present, icon: CalendarCheckIcon, color: "text-green-600", bg: "bg-green-500/10", border: "border-green-500/20" },
                    { label: "Absent Days", value: stats.absent, icon: CalendarXIcon, color: "text-red-600", bg: "bg-red-500/10", border: "border-red-500/20" },
                    { label: "Leave Days", value: stats.leave, icon: CalendarMinusIcon, color: "text-orange-600", bg: "bg-orange-500/10", border: "border-orange-500/20" },
                    { label: "No Office Out", value: stats.noOfficeOut, icon: ClockUserIcon, color: "text-purple-600", bg: "bg-purple-500/10", border: "border-purple-500/20" },
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
                                    <Icon size={32} weight="duotone" />
                                </div>
                                {isAttendanceLoading ? (
                                    <Skeleton className="h-8 w-10" />
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
                        />
                    </div>
                </CardShell>
            </div>
        </div>
    )
}
