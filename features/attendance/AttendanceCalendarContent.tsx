"use client"

import { format, parseISO, isWithinInterval } from "date-fns"
import { Calendar as ShadcnCalendar, CalendarDayButton } from "@/components/ui/calendar"
import { cn } from "@/lib/utils"
import { motion } from "framer-motion"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Loader2 } from "lucide-react"

interface AttendanceCalendarContentProps {
    currentMonth: Date
    setCurrentMonth: (date: Date) => void
    attendanceMap: Record<string, any>
    attendance?: any[]
    settings?: any
    closures?: any[]
    leaves?: any[]
    selectedDate: Date | undefined
    setSelectedDate: (date: Date | undefined) => void
    today: Date
    monthStart: Date
    isLoading?: boolean
}

export function AttendanceCalendarContent({
    currentMonth,
    setCurrentMonth,
    attendanceMap,
    attendance,
    settings,
    closures,
    leaves,
    selectedDate,
    setSelectedDate,
    today,
    monthStart,
    isLoading
}: AttendanceCalendarContentProps) {
    return (
        <div className="flex flex-col w-full h-full relative">
            {isLoading && (
                <div className="absolute inset-0 bg-background/50 backdrop-blur-xs flex items-center justify-center z-30 rounded-2xl animate-in fade-in duration-200">
                    <Loader2 className="size-10 animate-spin text-primary" />
                </div>
            )}
            <TooltipProvider>
                <ShadcnCalendar
                    mode="single"
                    month={currentMonth}
                    onMonthChange={setCurrentMonth}
                    selected={selectedDate}
                    onSelect={setSelectedDate}
                    captionLayout="dropdown"
                    showOutsideDays={false}
                    className="p-0 border-0 w-fit h-fit mx-auto [--cell-size:2.5rem] sm:[--cell-size:3rem] md:[--cell-size:3.5rem] lg:[--cell-size:3.25rem] xl:[--cell-size:3.25rem]"
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
                        present: (date) => date.getMonth() === currentMonth.getMonth() && date.getFullYear() === currentMonth.getFullYear() && !!attendanceMap[format(date, 'yyyy-MM-dd')]?.check_in,
                        absent: (date) => date.getMonth() === currentMonth.getMonth() && date.getFullYear() === currentMonth.getFullYear() && !attendanceMap[format(date, 'yyyy-MM-dd')] && date < today && date >= monthStart && !settings?.off_days?.includes(date.getDay()),
                        marked: (date) => date.getMonth() === currentMonth.getMonth() && date.getFullYear() === currentMonth.getFullYear() && !!(attendanceMap[format(date, 'yyyy-MM-dd')]?.check_in && attendanceMap[format(date, 'yyyy-MM-dd')]?.check_out),
                        holiday: (date) => date.getMonth() === currentMonth.getMonth() && date.getFullYear() === currentMonth.getFullYear() && !!closures?.some(c => c.date === format(date, 'yyyy-MM-dd')),
                        leave: (date) => date.getMonth() === currentMonth.getMonth() && date.getFullYear() === currentMonth.getFullYear() && !!leaves?.some(l => isWithinInterval(date, { start: parseISO(l.start_date), end: parseISO(l.end_date) })),
                        offDay: (date) => date.getMonth() === currentMonth.getMonth() && date.getFullYear() === currentMonth.getFullYear() && !!settings?.off_days?.includes(date.getDay()),
                    }}
                    components={{
                        Weekday: ({ children, className, ...props }: any) => {
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
                            const isCurrentMonth = day.date.getMonth() === currentMonth.getMonth() &&
                                day.date.getFullYear() === currentMonth.getFullYear()

                            if (!isCurrentMonth) {
                                return <div className="size-(--cell-size)" />
                            }

                            const isToday = modifiers.today
                            const isSelected = modifiers.selected
                            const isOffDay = modifiers.offDay

                            const record = attendance?.find(r => {
                                const recordDate = new Date(r.date)
                                return recordDate.getFullYear() === day.date.getFullYear() &&
                                    recordDate.getMonth() === day.date.getMonth() &&
                                    recordDate.getDate() === day.date.getDate()
                            })

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
                                                        : record?.status === 'rejected'
                                                            ? "border-rose-500/50 bg-rose-500/15 text-rose-700 hover:bg-rose-500/25 hover:border-rose-500/70 z-10 line-through decoration-rose-500 decoration-2"
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

                                                {isToday && (
                                                    <div className={cn(
                                                        "absolute inset-0 rounded-2xl ring-2 ring-primary ring-offset-2 ring-offset-background animate-pulse -z-10",
                                                        isSelected ? "opacity-100" : "opacity-50"
                                                    )} />
                                                )}

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

            <div className="mt-8 px-4 py-4 bg-muted/20 border-y rounded-xl grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 text-[10px] font-black uppercase text-center">
                <div className="flex items-center gap-2 text-primary bg-primary/10 p-1.5 rounded-lg border border-primary/20 shadow-sm"><div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" /> Marked (Pending)</div>
                <div className="flex items-center gap-2 text-green-700 bg-green-500/10 p-1.5 rounded-lg border border-green-500/20 shadow-sm"><div className="h-1.5 w-1.5 rounded-full bg-green-500" /> Present (Verified)</div>
                <div className="flex items-center gap-2 text-rose-750 bg-rose-500/15 p-1.5 rounded-lg border border-rose-500/35 shadow-sm line-through decoration-rose-500"><div className="h-1.5 w-1.5 rounded-full bg-rose-500" /> Rejected</div>
                <div className="flex items-center gap-2 text-orange-700 bg-orange-500/10 p-1.5 rounded-lg border border-orange-500/20 shadow-sm"><div className="h-1.5 w-1.5 rounded-full bg-orange-500" /> Leave (Approved)</div>
                <div className="flex items-center gap-2 text-red-700 bg-red-500/10 p-1.5 rounded-lg border border-red-500/20 shadow-sm"><div className="h-1.5 w-1.5 rounded-full bg-red-500" /> Absent (Missed)</div>
                <div className="flex items-center gap-2 text-blue-700 bg-blue-500/10 p-1.5 rounded-lg border border-blue-500/20 shadow-sm"><div className="h-1.5 w-1.5 rounded-full bg-blue-500" /> Holidays</div>
                <div className="flex items-center gap-2 text-muted-foreground bg-muted/40 p-1.5 rounded-lg border border-muted/30 shadow-sm"><div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/30" /> Weekly Off</div>
            </div>
        </div>
    )
}
