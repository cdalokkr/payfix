"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { trpc } from "@/lib/trpc/client"
import { Clock } from "lucide-react"
import { format, startOfMonth, endOfMonth, isSameDay } from "date-fns"
import { Calendar as ShadcnCalendar, CalendarDayButton } from "@/components/ui/calendar"
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
import { ClockUser as ClockUserIcon, CalendarDots as CalendarDotsIcon, CalendarCheck as CalendarCheckIcon, CalendarX as CalendarXIcon, CalendarMinus as CalendarMinusIcon, CalendarSlash as CalendarSlashIcon, Calendar as CalendarIcon, Briefcase as BriefcaseIcon } from "@phosphor-icons/react"
import { Skeleton } from "@/components/ui/skeleton"

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
        let noOfficeOut = 0

        days.forEach(day => {
            const dateStr = format(day, 'yyyy-MM-dd')
            const record = attendanceMap[dateStr]
            const isOffDay = settings?.off_days?.includes(day.getDay())

            // Check for holiday
            const isHoliday = closures?.some(c => c.date === dateStr)
            if (isHoliday) {
                holiday++
                return
            }

            // Check for leave
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
                // Fallback for present count if it's just a check-in but we want to count it as "something"
                // But as per user: "marked in/out is till then it's not verified"
                // and "present day date background color is green as per legend. as status is verified means present"
            } else if (day < today && !isOffDay) {
                absent++
            }
        })

        return { marked, present, absent, leave, holiday, noOfficeOut }
    }, [attendanceMap, leaves, closures, settings, monthStart, monthEnd, today])

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
                <Card className="xl:col-span-6 shadow-xl border-primary/10 overflow-hidden flex flex-col h-full bg-background/50 backdrop-blur-sm pt-0 hover:bg-background/80 transition-colors group cursor-default hover:border-primary/20 ">
                    <CardHeader className="border-b border-muted/20 bg-muted/50 transition-colors p-0 overflow-hidden group-hover:bg-muted/80">
                        <div className="px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 group/header cursor-default">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 rounded-xl bg-primary/10 text-primary shadow-sm">
                                    <CalendarIcon className="h-6 w-6" />
                                </div>
                                <div>
                                    <CardTitle className="text-lg font-bold">Monthly Calendar</CardTitle>
                                    <CardDescription>Visual report for {format(currentMonth, 'MMMM yyyy')}</CardDescription>
                                </div>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-4 flex flex-1 justify-center min-h-[500px]">
                        <Card className="w-full p-4 md:p-6 bg-background/40 backdrop-blur-md border border-primary/5 shadow-inner rounded-3xl flex flex-col items-center justify-center overflow-hidden transition-all duration-500 hover:bg-background/60 group/innercard">
                            <TooltipProvider>
                                <ShadcnCalendar
                                    mode="single"
                                    month={currentMonth}
                                    onMonthChange={setCurrentMonth}
                                    selected={selectedDate}
                                    onSelect={setSelectedDate}
                                    captionLayout="dropdown"
                                    className="p-0 border-0 w-fit h-fit [--cell-size:2rem] md:[--cell-size:3.5rem] lg:[--cell-size:3.25rem] xl:[--cell-size:3.25rem]"
                                    classNames={{
                                        root: "w-fit h-fit flex flex-col items-center",
                                        months: "w-fit h-fit flex flex-col items-center",
                                        month: "w-fit h-fit flex flex-col space-y-0 items-center",
                                        caption: "flex justify-center relative items-center mb-4",
                                        nav: "hidden",
                                        table: "w-fit border-separate border-spacing-0 flex flex-col items-center",
                                        tbody: "w-fit flex flex-col gap-4",
                                        head_row: "flex w-fit mb-4",
                                        weekday: "w-(--cell-size) mx-1.5 flex-none flex justify-center items-center font-bold text-[12px] uppercase tracking-widest text-muted-foreground",
                                        row: "flex w-fit",
                                        day: "w-(--cell-size) mx-1.5 flex-none flex items-center justify-center p-0",
                                        dropdowns: "w-full flex items-center text-sm font-medium justify-center gap-1.5 [&_[data-slot=select-trigger]]:border [&_[data-slot=select-trigger]]:border-muted/50",
                                    }}
                                    formatters={{
                                        formatMonthDropdown: (date) => {
                                            return date.toLocaleString("default", { month: "long" })
                                        },
                                        formatWeekdayName: (date) => {
                                            return format(date, "EEE").toUpperCase()
                                        },
                                    }}
                                    modifiers={{
                                        present: (date) => !!attendanceMap[format(date, 'yyyy-MM-dd')]?.check_in,
                                        absent: (date) => !attendanceMap[format(date, 'yyyy-MM-dd')] && date < today && date >= monthStart && !settings?.off_days?.includes(date.getDay()),
                                        marked: (date) => !!(attendanceMap[format(date, 'yyyy-MM-dd')]?.check_in && attendanceMap[format(date, 'yyyy-MM-dd')]?.check_out),
                                        holiday: (date) => !!closures?.some(c => c.date === format(date, 'yyyy-MM-dd')),
                                        leave: (date) => !!leaves?.some(l => isWithinInterval(date, { start: parseISO(l.start_date), end: parseISO(l.endDate) })),
                                        offDay: (date) => !!settings?.off_days?.includes(date.getDay()),
                                    }}
                                    components={{
                                        Weekday: ({ children, className, ...props }: any) => {
                                            // Extract the weekday index from props (RDP 9 passes the date for the weekday)
                                            // If date is not available, we skip dynamic styling for headers to avoid errors
                                            const weekdayDate = (props as any).date as Date | undefined
                                            const isOffDay = weekdayDate ? settings?.off_days?.includes(weekdayDate.getDay()) : false

                                            return (
                                                <th
                                                    className={cn(
                                                        className,
                                                        "text-[12px] font-bold uppercase tracking-widest py-3",
                                                        isOffDay && "bg-muted/20 text-muted-foreground rounded-lg border border-muted/30 shadow-sm"
                                                    )}
                                                    {...props}
                                                >
                                                    {children}
                                                </th>
                                            )
                                        },
                                        DayButton: ({ day, modifiers, children, ...props }: any) => {
                                            const isCurrentMonth = day.date.getMonth() === currentMonth.getMonth()
                                            if (!isCurrentMonth) return <div className="flex-1" />

                                            const isToday = modifiers.today
                                            const isSelected = modifiers.selected
                                            const isOffDay = modifiers.offDay

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
                                                                "size-(--cell-size) mx-auto p-0 rounded-2xl transition-all duration-500 relative overflow-visible flex flex-col items-center justify-center border-2 group/daybutton",
                                                                isSelected
                                                                    ? "border-primary shadow-xl shadow-primary/40 z-20 bg-primary"
                                                                    : record?.status === 'verified'
                                                                        ? "border-green-500/50 bg-green-500/10 text-green-700 hover:bg-green-500/20 hover:border-green-500/70 z-10"
                                                                        : record?.check_in && record?.check_out
                                                                            ? "border-primary/50 bg-primary/10 text-primary hover:bg-primary/20 hover:border-primary/70 z-10"
                                                                            : record?.check_in
                                                                                ? "border-green-500/50 bg-green-500/10 text-green-700 hover:bg-green-500/20 hover:border-green-500/70"
                                                                                : modifiers.leave
                                                                                    ? "border-orange-500/50 bg-orange-500/10 text-orange-700 hover:bg-orange-500/20 hover:border-orange-500/70"
                                                                                    : modifiers.holiday
                                                                                        ? "border-blue-500/50 bg-blue-500/10 text-blue-700 hover:bg-blue-500/20 hover:border-blue-500/70"
                                                                                        : modifiers.offDay
                                                                                            ? "border-transparent bg-muted/40 text-muted-foreground hover:bg-muted/50 hover:text-foreground hover:border-muted-foreground/30"
                                                                                            : modifiers.absent
                                                                                                ? "border-red-500/30 bg-red-500/10 text-red-700 hover:bg-red-500/20 hover:border-red-500/50"
                                                                                                : isToday
                                                                                                    ? "border-primary bg-primary/20 text-primary z-10 shadow-lg shadow-primary/5"
                                                                                                    : "bg-muted/20 border-muted/20 hover:bg-muted/30 hover:border-muted/40"
                                                            )}
                                                        >
                                                            <motion.div
                                                                className="w-full h-full flex flex-col items-center justify-center relative z-10"
                                                                whileHover={{ y: -4, scale: 1.04 }}
                                                                whileTap={{ scale: 0.96 }}
                                                                transition={{ type: "spring", stiffness: 400, damping: 20 }}
                                                            >
                                                                <span className={cn(
                                                                    "text-base font-bold transition-colors duration-300",
                                                                    isSelected ? "text-primary-foreground" : (isToday ? "text-primary" : "text-foreground"),
                                                                    isOffDay && !isToday && !isSelected && "text-muted-foreground group-hover/daybutton:text-foreground"
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
                                                                {isOffDay && (
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
                                                                    <span className="font-semibold tabular-nums text-foreground">
                                                                        {record.check_in ? format(new Date(record.check_in), "hh:mm a") : "-"}
                                                                    </span>
                                                                </div>
                                                                <div className="flex items-center gap-2 whitespace-nowrap">
                                                                    <div className="h-1.5 w-1.5 rounded-full bg-primary flex-shrink-0" />
                                                                    <span className="font-semibold text-muted-foreground">Out :</span>
                                                                    <span className="font-semibold tabular-nums text-foreground">
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
                        </Card>
                    </CardContent>
                    <div className="px-6 py-4 bg-muted/20 border-t grid grid-cols-2 lg:grid-cols-3 gap-3 text-[10px] font-black uppercase text-center">
                        <div className="flex items-center gap-2 text-primary bg-primary/10 p-1.5 rounded-lg border border-primary/20 shadow-sm"><div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" /> Marked (Pending)</div>
                        <div className="flex items-center gap-2 text-green-700 bg-green-500/10 p-1.5 rounded-lg border border-green-500/20 shadow-sm"><div className="h-1.5 w-1.5 rounded-full bg-green-500" /> Present (Verified)</div>
                        <div className="flex items-center gap-2 text-orange-700 bg-orange-500/10 p-1.5 rounded-lg border border-orange-500/20 shadow-sm"><div className="h-1.5 w-1.5 rounded-full bg-orange-500" /> Leave (Approved)</div>
                        <div className="flex items-center gap-2 text-red-700 bg-red-500/10 p-1.5 rounded-lg border border-red-500/20 shadow-sm"><div className="h-1.5 w-1.5 rounded-full bg-red-500" /> Absent (Missed)</div>
                        <div className="flex items-center gap-2 text-blue-700 bg-blue-500/10 p-1.5 rounded-lg border border-blue-500/20 shadow-sm"><div className="h-1.5 w-1.5 rounded-full bg-blue-500" /> Holidays</div>
                        <div className="flex items-center gap-2 text-muted-foreground bg-muted/40 p-1.5 rounded-lg border border-muted/30 shadow-sm"><div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/30" /> Weekly Off</div>
                    </div>
                </Card>

                <Card className="xl:col-span-6 shadow-xl border-primary/10 flex flex-col h-full bg-background/10 backdrop-blur-sm pt-0 hover:bg-background/80 transition-colors group cursor-default hover:border-primary/20 hover:shadow-xl">
                    <CardHeader className="border-b border-muted/20 bg-muted/50 transition-colors p-0 overflow-hidden group-hover:bg-muted/80">
                        <div className="px-6 py-4 flex items-center gap-3 group/header cursor-default">
                            <div className="p-2.5 rounded-xl bg-orange-500/10 text-orange-600 shadow-sm">
                                <BriefcaseIcon className="h-6 w-6" />
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
