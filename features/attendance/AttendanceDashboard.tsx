"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { trpc } from "@/lib/trpc/client"
import { CalendarCheck, Clock, Briefcase } from "lucide-react"
import { format, startOfMonth, endOfMonth, isSameDay } from "date-fns"
import { Calendar, CalendarDayButton } from "@/components/ui/calendar"
import { DataTable } from "@/components/ui/data-table"
import { ColumnDef } from "@tanstack/react-table"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { useMemo, useState } from "react"
import { eachDayOfInterval, isSunday, isWithinInterval, parseISO, addMonths, subMonths, setMonth, setYear } from "date-fns"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { motion } from "framer-motion"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

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

    const attendanceMap = useMemo(() => {
        const map: Record<string, any> = {}
        attendance?.forEach(record => {
            // Robustly extract the date part (YYYY-MM-DD) from the record
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

        days.forEach(day => {
            const dateStr = format(day, 'yyyy-MM-dd')
            const record = attendanceMap[dateStr]

            // Check for holiday
            const isHoliday = closures?.some(c => c.date === dateStr)
            if (isHoliday) {
                holiday++
                return
            }

            // Check for leave
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
                if (record.check_in) present++
                if (record.check_in && record.check_out) marked++
            } else if (day < today && !isSunday(day)) {
                absent++
            }
        })

        return { marked, present, absent, leave, holiday }
    }, [attendanceMap, leaves, closures, monthStart, monthEnd, today])

    const columns: ColumnDef<any>[] = [
        {
            accessorKey: "date",
            header: "Date",
            cell: ({ row }) => format(new Date(row.getValue("date")), "MMM dd, yyyy"),
        },
        {
            accessorKey: "check_in",
            header: "Time In",
            cell: ({ row }) => row.getValue("check_in")
                ? format(new Date(row.getValue("check_in")), "hh:mm a")
                : "-",
        },
        {
            accessorKey: "check_out",
            header: "Time Out",
            cell: ({ row }) => row.getValue("check_out")
                ? format(new Date(row.getValue("check_out")), "hh:mm a")
                : "-",
        },
        {
            accessorKey: "status",
            header: "Status",
            cell: ({ row }) => {
                const status = row.getValue("status") as string
                return (
                    <Badge
                        variant="secondary"
                        className={cn(
                            "capitalize font-bold text-[10px]",
                            status === 'verified' && "bg-green-500/10 text-green-700 border-green-500/20",
                            status === 'pending' && "bg-amber-500/10 text-amber-700 border-amber-500/20",
                            status === 'rejected' && "bg-red-500/10 text-red-700 border-red-500/20"
                        )}
                    >
                        {status}
                    </Badge>
                )
            },
        },
        {
            accessorKey: "working_hours",
            header: "Hours",
            cell: ({ row }) => {
                const hours = row.getValue("working_hours") as number
                return hours ? `${hours.toFixed(1)}h` : "-"
            },
        }
    ]

    return (
        <div className="space-y-8">
            {/* Monthly Statistics Overview */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                {[
                    { label: "Marked Days", value: stats.marked, color: "text-primary", bg: "bg-primary/10", border: "border-primary/20" },
                    { label: "Present Days", value: stats.present, color: "text-green-600", bg: "bg-green-500/10", border: "border-green-500/20" },
                    { label: "Absent Days", value: stats.absent, color: "text-red-600", bg: "bg-red-500/10", border: "border-red-500/20" },
                    { label: "Leave Days", value: stats.leave, color: "text-orange-600", bg: "bg-orange-500/10", border: "border-orange-500/20" },
                    { label: "Holidays", value: stats.holiday, color: "text-blue-600", bg: "bg-blue-500/10", border: "border-blue-500/20" }
                ].map((stat, i) => (
                    <Card key={i} className={cn("border shadow-sm overflow-hidden", stat.border)}>
                        <div className={cn("px-4 py-3 flex flex-col gap-1", stat.bg)}>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80">{stat.label}</p>
                            <p className={cn("text-2xl font-black tabular-nums", stat.color)}>{stat.value}</p>
                        </div>
                    </Card>
                ))}
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
                <Card className="xl:col-span-6 shadow-xl border-primary/10 overflow-hidden flex flex-col h-full bg-background/50 backdrop-blur-sm">
                    <CardHeader className="border-b bg-muted/30 pb-4">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 rounded-xl bg-primary/10 text-primary shadow-sm">
                                    <CalendarCheck className="h-5 w-5" />
                                </div>
                                <div>
                                    <CardTitle className="text-lg font-bold">Monthly Calendar</CardTitle>
                                    <CardDescription>Visual report for {format(currentMonth, 'MMMM yyyy')}</CardDescription>
                                </div>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0 flex flex-1 justify-center min-h-[500px]">
                        <div className="w-full px-4 py-2">
                            <TooltipProvider>
                                <Calendar
                                    mode="single"
                                    month={currentMonth}
                                    onMonthChange={setCurrentMonth}
                                    selected={selectedDate}
                                    onSelect={setSelectedDate}
                                    captionLayout="dropdown"
                                    className="p-0 border-0 w-full h-full [--cell-size:3rem] md:[--cell-size:3.5rem] lg:[--cell-size:3.25rem] xl:[--cell-size:3.25rem]"
                                    classNames={{
                                        root: "w-full h-full flex flex-col",
                                        months: "w-full h-full flex flex-col",
                                        month: "w-full h-full flex flex-col space-y-0",
                                        caption: "flex justify-center relative items-center mb-1",
                                        nav: "hidden",
                                        table: "w-full h-full border-collapse flex-1 flex flex-col",
                                        tbody: "flex flex-col gap-3 flex-1",
                                        head_row: "flex w-full mb-2 px-1",
                                        row: "flex w-full flex-1 px-1 gap-3",
                                        day: "p-0.5 flex-1 aspect-square",
                                    }}
                                    formatters={{
                                        formatMonthDropdown: (date) => {
                                            return date.toLocaleString("default", { month: "long" })
                                        },
                                    }}
                                    modifiers={{
                                        present: (date) => !!attendanceMap[format(date, 'yyyy-MM-dd')]?.check_in,
                                        absent: (date) => !attendanceMap[format(date, 'yyyy-MM-dd')] && date < today && date >= monthStart && !isSunday(date),
                                        marked: (date) => !!(attendanceMap[format(date, 'yyyy-MM-dd')]?.check_in && attendanceMap[format(date, 'yyyy-MM-dd')]?.check_out),
                                        holiday: (date) => !!closures?.some(c => c.date === format(date, 'yyyy-MM-dd')),
                                        leave: (date) => !!leaves?.some(l => isWithinInterval(date, { start: parseISO(l.start_date), end: parseISO(l.end_date) })),
                                        sunday: (date) => isSunday(date),
                                    }}
                                    components={{
                                        DayButton: ({ day, modifiers, children, ...props }: any) => {
                                            const isCurrentMonth = day.date.getMonth() === currentMonth.getMonth()
                                            if (!isCurrentMonth) return <div className="flex-1" />

                                            const isToday = modifiers.today
                                            const isSelected = modifiers.selected
                                            const isSunday = modifiers.sunday

                                            // Use direct array find for maximum reliability
                                            const record = attendance?.find(r => {
                                                const recordDate = new Date(r.date)
                                                return recordDate.getFullYear() === day.date.getFullYear() &&
                                                    recordDate.getMonth() === day.date.getMonth() &&
                                                    recordDate.getDate() === day.date.getDate()
                                            })

                                            // Format times with robust error handling
                                            let timeIn: string | null = null
                                            let timeOut: string | null = null

                                            try {
                                                if (record?.check_in) {
                                                    const checkInDate = new Date(record.check_in)
                                                    if (!isNaN(checkInDate.getTime())) {
                                                        timeIn = format(checkInDate, "hh:mm a")
                                                    } else {
                                                        // Fallback: show raw value if parsing fails
                                                        timeIn = String(record.check_in)
                                                    }
                                                }
                                            } catch (e) {
                                                timeIn = record?.check_in ? String(record.check_in) : null
                                            }

                                            try {
                                                if (record?.check_out) {
                                                    const checkOutDate = new Date(record.check_out)
                                                    if (!isNaN(checkOutDate.getTime())) {
                                                        timeOut = format(checkOutDate, "hh:mm a")
                                                    } else {
                                                        timeOut = String(record.check_out)
                                                    }
                                                }
                                            } catch (e) {
                                                timeOut = record?.check_out ? String(record.check_out) : null
                                            }

                                            return (
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <CalendarDayButton
                                                            day={day}
                                                            modifiers={modifiers}
                                                            {...props}
                                                            className={cn(
                                                                "w-full h-full min-h-(--cell-size) p-0 rounded-2xl transition-all duration-500 relative overflow-visible flex flex-col items-center justify-center border-2 group/daybutton",
                                                                isSelected
                                                                    ? "border-primary shadow-xl shadow-primary/40 z-20 bg-primary"
                                                                    : isToday
                                                                        ? "border-primary bg-primary/10 text-primary z-10 shadow-lg shadow-primary/5"
                                                                        : record?.check_in && record?.check_out
                                                                            ? "border-primary/40 bg-primary/5 text-primary hover:bg-primary/10 hover:border-primary/60"
                                                                            : record?.check_in
                                                                                ? "border-green-500/40 bg-green-500/5 text-green-700 hover:bg-green-500/10 hover:border-green-500/60"
                                                                                : modifiers.leave
                                                                                    ? "border-purple-500/40 bg-purple-500/5 text-purple-700 hover:bg-purple-500/10 hover:border-purple-500/60"
                                                                                    : modifiers.holiday
                                                                                        ? "border-orange-500/40 bg-orange-500/5 text-orange-700 hover:bg-orange-500/10 hover:border-orange-500/60"
                                                                                        : isSunday
                                                                                            ? "border-transparent bg-muted/20 text-muted-foreground hover:bg-muted/30 hover:text-foreground hover:border-muted-foreground/20"
                                                                                            : (day.date < today && day.date >= monthStart)
                                                                                                ? "border-red-500/10 bg-red-500/5 text-red-700/60 hover:bg-red-500/10 hover:border-red-500/30"
                                                                                                : "border-muted/20 hover:bg-muted/5 hover:border-muted/40"
                                                            )}
                                                        >
                                                            <motion.div
                                                                className="w-full h-full flex flex-col items-center justify-center relative z-10"
                                                                whileHover={{ y: -4, scale: 1.04 }}
                                                                whileTap={{ scale: 0.96 }}
                                                                transition={{ type: "spring", stiffness: 400, damping: 20 }}
                                                            >
                                                                <span className={cn(
                                                                    "text-2xl font-black transition-colors duration-300",
                                                                    isSelected ? "text-primary-foreground" : (isToday ? "text-primary" : "text-foreground"),
                                                                    isSunday && !isToday && !isSelected && "text-muted-foreground group-hover/daybutton:text-foreground"
                                                                )}>
                                                                    {day.date.getDate()}
                                                                </span>
                                                                {record?.check_in && (
                                                                    <div className="mt-1 flex gap-1">
                                                                        <div className={cn(
                                                                            "h-1.5 w-1.5 rounded-full bg-current opacity-60",
                                                                            !record.check_out && "animate-pulse"
                                                                        )} />
                                                                        {record.check_out && <div className="h-1.5 w-1.5 rounded-full bg-current opacity-60" />}
                                                                    </div>
                                                                )}
                                                                {isSunday && (
                                                                    <div className="absolute inset-0 bg-[radial-gradient(#e5e7eb_2px,transparent_2px)] [background-size:12px_12px] opacity-10 pointer-events-none group-hover/daybutton:opacity-30 transition-opacity" />
                                                                )}

                                                                {/* Today Indicator Pulsing Ring */}
                                                                {isToday && (
                                                                    <div className={cn(
                                                                        "absolute inset-0 rounded-2xl ring-2 ring-primary ring-offset-2 ring-offset-background animate-pulse -z-10",
                                                                        isSelected ? "opacity-100" : "opacity-50"
                                                                    )} />
                                                                )}

                                                                {/* Hover Glow Effect */}
                                                                <div className="absolute inset-0 rounded-2xl bg-primary opacity-0 group-hover/daybutton:opacity-[0.05] transition-opacity pointer-events-none" />
                                                            </motion.div>
                                                        </CalendarDayButton>
                                                    </TooltipTrigger>

                                                    {record && (
                                                        <TooltipContent
                                                            className="bg-background/95 backdrop-blur-md border shadow-2xl p-2.5 rounded-lg animate-in fade-in zoom-in duration-200 z-[100]"
                                                            side="top"
                                                            sideOffset={6}
                                                        >
                                                            <div className="flex flex-col gap-1.5 text-xs">
                                                                <div className="flex items-center gap-2 whitespace-nowrap">
                                                                    <div className="h-1.5 w-1.5 rounded-full bg-green-500 flex-shrink-0" />
                                                                    <span className="font-semibold text-muted-foreground">In :</span>
                                                                    <span className="font-black tabular-nums text-foreground">
                                                                        {record.check_in ? format(new Date(record.check_in), "hh:mm a") : "-"}
                                                                    </span>
                                                                </div>
                                                                <div className="flex items-center gap-2 whitespace-nowrap">
                                                                    <div className="h-1.5 w-1.5 rounded-full bg-primary flex-shrink-0" />
                                                                    <span className="font-semibold text-muted-foreground">Out:</span>
                                                                    <span className="font-black tabular-nums text-foreground">
                                                                        {record.check_out ? format(new Date(record.check_out), "hh:mm a") : "-"}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </TooltipContent>
                                                    )}
                                                </Tooltip>
                                            )
                                        }
                                    }}
                                />
                            </TooltipProvider>
                        </div>
                    </CardContent>
                    <div className="px-6 py-4 bg-muted/20 border-t grid grid-cols-2 lg:grid-cols-3 gap-3 text-[9px] font-black uppercase tracking-tighter text-center">
                        <div className="flex items-center gap-2 text-primary bg-primary/5 p-1.5 rounded-lg border border-primary/10 shadow-sm"><div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" /> Marked (In/Out)</div>
                        <div className="flex items-center gap-2 text-green-700 bg-green-500/5 p-1.5 rounded-lg border border-green-500/10 shadow-sm"><div className="h-1.5 w-1.5 rounded-full bg-green-500" /> Present (Check-in)</div>
                        <div className="flex items-center gap-2 text-purple-700 bg-purple-500/5 p-1.5 rounded-lg border border-purple-500/10 shadow-sm"><div className="h-1.5 w-1.5 rounded-full bg-purple-500" /> Leave (Approved)</div>
                        <div className="flex items-center gap-2 text-red-700 bg-red-500/5 p-1.5 rounded-lg border border-red-500/10 shadow-sm"><div className="h-1.5 w-1.5 rounded-full bg-red-500" /> Absent (Missed)</div>
                        <div className="flex items-center gap-2 text-orange-700 bg-orange-500/5 p-1.5 rounded-lg border border-orange-500/10 shadow-sm"><div className="h-1.5 w-1.5 rounded-full bg-orange-500" /> Office Closure</div>
                        <div className="flex items-center gap-2 text-muted-foreground bg-muted/20 p-1.5 rounded-lg border border-muted/30 shadow-sm"><div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/30" /> Weekly Sunday</div>
                    </div>
                </Card>

                <Card className="xl:col-span-6 shadow-xl border-primary/10 flex flex-col h-full bg-background/50 backdrop-blur-sm">
                    <CardHeader className="border-b bg-muted/30 pb-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 rounded-xl bg-orange-500/10 text-orange-600 shadow-sm">
                                <Briefcase className="h-5 w-5" />
                            </div>
                            <div>
                                <CardTitle className="text-lg font-bold">Attendance Summary</CardTitle>
                                <CardDescription>Detailed logs for {format(currentMonth, 'MMMM yyyy')}</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0 flex-1 overflow-auto max-h-[750px] scrollbar-thin scrollbar-thumb-primary/20">
                        <div className="px-4 py-2">
                            <DataTable
                                columns={columns}
                                data={attendance || []}
                                isLoading={isAttendanceLoading}
                                hidePagination={true}
                            />
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )


}
