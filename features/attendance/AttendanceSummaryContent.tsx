"use client"

import { format, getDay, startOfMonth, endOfMonth, eachDayOfInterval, parseISO, isWithinInterval } from "date-fns"
import { DataTable } from "@/components/ui/data-table"
import { ColumnDef } from "@tanstack/react-table"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { useEffect, useMemo, useState } from "react"
import { CalendarDays, Clock, ArrowRight, ChevronLeft, ChevronRight } from "lucide-react"
import { useIsMobile } from "@/hooks/use-mobile"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"

interface DailyWorkingHours {
    [key: string]: {
        checkIn: string
        checkOut: string
    }
}

interface OfficeSettings {
    default_check_in: string
    default_check_out: string
    off_days: number[] | null
    daily_working_hours?: DailyWorkingHours | unknown
}

interface AttendanceSummaryContentProps {
    attendance?: any[]
    isLoading: boolean
    settings?: OfficeSettings | null
    closures?: any[]
    leaves?: any[]
    currentMonth: Date
}

// Helper to calculate scheduled hours from time strings
function calculateScheduledHours(checkIn: string, checkOut: string): number {
    const [inH, inM] = checkIn.split(':').map(Number)
    const [outH, outM] = checkOut.split(':').map(Number)
    const inMinutes = inH * 60 + inM
    const outMinutes = outH * 60 + outM
    return (outMinutes - inMinutes) / 60
}

const SUMMARY_PAGE_SIZE = 16

function SummaryPagination({
    page,
    pageCount,
    total,
    onPageChange,
}: {
    page: number
    pageCount: number
    total: number
    onPageChange: (page: number) => void
}) {
    if (pageCount <= 1) return null

    const start = page * SUMMARY_PAGE_SIZE + 1
    const end = Math.min((page + 1) * SUMMARY_PAGE_SIZE, total)

    return (
        <div className="flex items-center justify-between gap-3 border-t border-border/40 px-2 pt-3 text-xs">
            <span className="text-muted-foreground">
                Showing {start}-{end} of {total} days
            </span>
            <div className="flex items-center gap-2">
                <span className="font-semibold text-muted-foreground">
                    Page {page + 1} of {pageCount}
                </span>
                <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="size-7"
                    onClick={() => onPageChange(Math.max(0, page - 1))}
                    disabled={page === 0}
                    aria-label="Previous attendance summary page"
                >
                    <ChevronLeft className="size-3.5" />
                </Button>
                <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="size-7"
                    onClick={() => onPageChange(Math.min(pageCount - 1, page + 1))}
                    disabled={page === pageCount - 1}
                    aria-label="Next attendance summary page"
                >
                    <ChevronRight className="size-3.5" />
                </Button>
            </div>
        </div>
    )
}

export function AttendanceSummaryContent({
    attendance,
    isLoading,
    settings,
    closures = [],
    leaves = [],
    currentMonth
}: AttendanceSummaryContentProps) {
    // Calculate scheduled hours for each day of the week
    const scheduledHoursMap = useMemo(() => {
        const map: Record<number, number> = {}
        if (!settings) return map

        const defaultScheduledHours = calculateScheduledHours(
            settings.default_check_in,
            settings.default_check_out
        )

        // Set default for all days
        for (let i = 0; i < 7; i++) {
            map[i] = defaultScheduledHours
        }

        // Override with daily specific hours if available
        if (settings.daily_working_hours) {
            const dailyHours = settings.daily_working_hours as DailyWorkingHours
            Object.entries(dailyHours).forEach(([dayStr, times]) => {
                const day = parseInt(dayStr, 10)
                if (!isNaN(day) && times?.checkIn && times?.checkOut) {
                    map[day] = calculateScheduledHours(times.checkIn, times.checkOut)
                }
            })
        }

        return map
    }, [settings])

    // Compile records for the entire month
    const compiledRecords = useMemo(() => {
        if (!currentMonth) return []
        
        const monthStart = startOfMonth(currentMonth)
        const monthEnd = endOfMonth(currentMonth)
        
        const daysList = eachDayOfInterval({
            start: monthStart,
            end: monthEnd
        }).reverse()

        // Map database attendance records by localized date string for immediate lookup
        const recordMap = new Map<string, any>()
        attendance?.forEach(r => {
            const dateStr = typeof r.date === 'string' ? r.date.split('T')[0] : format(new Date(r.date), 'yyyy-MM-dd')
            recordMap.set(dateStr, r)
        })

        return daysList.map(day => {
            const dateStr = format(day, 'yyyy-MM-dd')
            
            // Check if there is a DB record
            const record = recordMap.get(dateStr)
            if (record) {
                return {
                    ...record,
                    type: 'attendance',
                    date: dateStr
                }
            }

            const dayOfWeek = day.getDay()
            const isOffDay = settings?.off_days?.includes(dayOfWeek)

            const holiday = closures?.find(c => c.date === dateStr)
            if (holiday) {
                return {
                    date: dateStr,
                    type: 'holiday',
                    status: 'holiday',
                    holidayName: holiday.reason || 'Holiday',
                    check_in: null,
                    check_out: null,
                    working_hours: 0,
                    is_half_day: false
                }
            }

            const leave = leaves?.find(l => {
                const start = parseISO(l.start_date)
                const end = parseISO(l.end_date)
                return isWithinInterval(day, { start, end })
            })
            if (leave) {
                return {
                    date: dateStr,
                    type: 'leave',
                    status: 'leave',
                    leaveType: leave.leave_type || 'Leave',
                    check_in: null,
                    check_out: null,
                    working_hours: 0,
                    is_half_day: leave.is_half_day || false
                }
            }

            if (isOffDay) {
                return {
                    date: dateStr,
                    type: 'offDay',
                    status: 'offDay',
                    check_in: null,
                    check_out: null,
                    working_hours: 0,
                    is_half_day: false
                }
            }

            const todayStr = format(new Date(), 'yyyy-MM-dd')
            const isPast = dateStr < todayStr

            if (isPast) {
                return {
                    date: dateStr,
                    type: 'absent',
                    status: 'absent',
                    check_in: null,
                    check_out: null,
                    working_hours: 0,
                    is_half_day: false
                }
            }

            // Future date
            return {
                date: dateStr,
                type: 'future',
                status: 'future',
                check_in: null,
                check_out: null,
                working_hours: 0,
                is_half_day: false
            }
        })
    }, [attendance, currentMonth, settings, closures, leaves])

    const [summaryPage, setSummaryPage] = useState(0)
    const summaryPageCount = Math.max(1, Math.ceil(compiledRecords.length / SUMMARY_PAGE_SIZE))
    const activeSummaryPage = Math.min(summaryPage, summaryPageCount - 1)
    const paginatedRecords = useMemo(
        () => compiledRecords.slice(
            activeSummaryPage * SUMMARY_PAGE_SIZE,
            (activeSummaryPage + 1) * SUMMARY_PAGE_SIZE
        ),
        [activeSummaryPage, compiledRecords]
    )

    useEffect(() => {
        setSummaryPage(0)
    }, [currentMonth])

    const columns: ColumnDef<any>[] = [
        {
            accessorKey: "date",
            header: "Date",
            cell: ({ row }) => {
                const dStr = row.getValue("date") as string
                const parts = dStr.split('-').map(Number)
                if (parts.length === 3) {
                    const localDate = new Date(parts[0], parts[1] - 1, parts[2])
                    return format(localDate, "MMM dd, yyyy")
                }
                return format(new Date(dStr), "MMM dd, yyyy")
            },
        },
        {
            accessorKey: "check_in",
            header: "In",
            cell: ({ row }) => {
                const val = row.getValue("check_in")
                if (!val) {
                    const type = row.original.type
                    if (type === 'holiday') return <span className="text-blue-500/70 font-bold text-[9px] tracking-wide uppercase">Holiday</span>
                    if (type === 'leave') return <span className="text-orange-500/70 font-bold text-[9px] tracking-wide uppercase">Leave</span>
                    if (type === 'offDay') return <span className="text-slate-450 font-black text-[9px] tracking-wide uppercase">Weekly Off</span>
                    if (type === 'absent') return <span className="text-rose-500/70 font-bold text-[9px] tracking-wide uppercase">Absent</span>
                    return "-"
                }
                return format(new Date(val as string), "hh:mm a")
            },
        },
        {
            accessorKey: "check_out",
            header: "Out",
            cell: ({ row }) => {
                const val = row.getValue("check_out")
                if (!val) {
                    const type = row.original.type
                    if (type === 'holiday') return <span className="text-blue-500/70 font-bold text-[9px] tracking-wide uppercase">Holiday</span>
                    if (type === 'leave') return <span className="text-orange-500/70 font-bold text-[9px] tracking-wide uppercase">Leave</span>
                    if (type === 'offDay') return <span className="text-slate-450 font-black text-[9px] tracking-wide uppercase">Weekly Off</span>
                    if (type === 'absent') return <span className="text-rose-500/70 font-bold text-[9px] tracking-wide uppercase">Absent</span>
                    return "-"
                }
                return format(new Date(val as string), "hh:mm a")
            },
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
                            "capitalize font-black text-[9px] px-1.5 h-3.5 whitespace-nowrap",
                            status === 'verified' && "bg-green-500/10 text-green-700 border-green-500/20",
                            status === 'pending' && "bg-amber-500/10 text-amber-700 border-amber-500/20",
                            status === 'rejected' && "bg-red-500/10 text-red-700 border-red-500/20",
                            status === 'holiday' && "bg-blue-500/10 text-blue-700 border-blue-500/20",
                            status === 'leave' && "bg-orange-500/10 text-orange-700 border-orange-500/20",
                            status === 'offDay' && "bg-slate-500/10 text-slate-700 border-slate-500/20",
                            status === 'absent' && "bg-red-500/10 text-red-700 border-red-500/20",
                            status === 'future' && "bg-muted text-muted-foreground/60 border-muted"
                        )}
                    >
                        {status === 'offDay' ? 'Weekly Off' : status === 'future' ? '-' : status}
                    </Badge>
                )
            },
        },
        {
            id: "attendance_type",
            header: "Type",
            cell: ({ row }) => {
                const type = row.original.type
                const isHalfDay = row.original.is_half_day
                
                if (type !== 'attendance' && type !== 'leave') return "-"
                if (type === 'leave') {
                    return (
                        <Badge variant="outline" className="text-[9px] h-3.5 bg-orange-500/5 border-orange-500/20 text-orange-600 font-bold px-1.5 whitespace-nowrap">
                            {isHalfDay ? "Half Day Leave" : "Full Day Leave"}
                        </Badge>
                    )
                }
                
                return isHalfDay ? (
                    <Badge variant="outline" className="text-[9px] h-3.5 bg-amber-500/5 border-amber-500/20 text-amber-600 font-bold px-1.5 whitespace-nowrap">
                        Half Day
                    </Badge>
                ) : (
                    <Badge variant="outline" className="text-[9px] h-3.5 bg-blue-500/5 border-blue-500/20 text-blue-600 font-bold px-1.5 whitespace-nowrap">
                        Full Day
                    </Badge>
                )
            },
        },
        {
            id: "total_hours",
            header: "Total",
            cell: ({ row }) => {
                const workingHours = row.original.working_hours as number
                return (
                    <span className="font-bold tabular-nums text-foreground">
                        {workingHours ? `${Number(workingHours).toFixed(1)}h` : "-"}
                    </span>
                )
            },
        },
        {
            accessorKey: "working_hours",
            header: "Extra",
            cell: ({ row }) => {
                const workingHours = row.getValue("working_hours") as number
                const dateStr = row.getValue("date") as string

                if (!workingHours) return "-"

                const dayOfWeek = getDay(new Date(dateStr))
                const scheduledHours = scheduledHoursMap[dayOfWeek] ?? 9
                const extraHours = workingHours - scheduledHours

                // Rule: Don't show negative extra hours
                const displayExtra = Math.max(0, extraHours)

                if (displayExtra === 0) return <span className="text-muted-foreground/40 font-medium">0.0h</span>

                return (
                    <span className="font-bold tabular-nums text-green-600">
                        +{displayExtra.toFixed(1)}h
                    </span>
                )
            },
        }
    ]

    const isMobile = useIsMobile()

    if (isMobile) {
        if (isLoading) {
            return (
                <div className="space-y-4 px-4 py-2">
                    {[1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-24 w-full rounded-xl" />
                    ))}
                </div>
            )
        }

        if (compiledRecords.length === 0) {
            return (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <CalendarDays className="size-12 opacity-10 mb-4" />
                    <p className="text-sm font-medium">No records for this month</p>
                </div>
            )
        }

        return (
            <div className="space-y-3 px-1 py-1">
                {paginatedRecords.map((record, idx) => {
                    const status = record.status as string
                    const isHalfDay = record.is_half_day
                    const workingHours = record.working_hours as number
                    const dayOfWeek = getDay(new Date(record.date))
                    const scheduledHours = scheduledHoursMap[dayOfWeek] ?? 9
                    const extraHours = Math.max(0, workingHours - scheduledHours)

                    return (
                        <div key={idx} className="flex flex-col bg-background/40 p-4 rounded-xl border border-border/50 shadow-sm transition-all active:scale-[0.98]">
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex flex-col">
                                    <span className="text-sm font-bold tracking-tight">
                                        {format(new Date(record.date), "EEEE, MMM dd")}
                                    </span>
                                    <div className="flex items-center gap-2 mt-1">
                                        <Badge
                                            variant="secondary"
                                            className={cn(
                                                "capitalize font-black text-[9px] px-1.5 h-3.5 whitespace-nowrap",
                                                status === 'verified' && "bg-green-500/10 text-green-700 border-green-500/20",
                                                status === 'pending' && "bg-amber-500/10 text-amber-700 border-amber-500/20",
                                                status === 'rejected' && "bg-red-500/10 text-red-700 border-red-500/20",
                                                status === 'holiday' && "bg-blue-500/10 text-blue-700 border-blue-500/20",
                                                status === 'leave' && "bg-orange-500/10 text-orange-700 border-orange-500/20",
                                                status === 'offDay' && "bg-slate-500/10 text-slate-700 border-slate-500/20",
                                                status === 'absent' && "bg-red-500/10 text-red-700 border-red-500/20",
                                                status === 'future' && "bg-muted text-muted-foreground/60 border-muted"
                                            )}
                                        >
                                            {status === 'offDay' ? 'Weekly Off' : status === 'future' ? '-' : status}
                                        </Badge>
                                        {(status === 'verified' || status === 'pending' || status === 'rejected' || status === 'leave') && (
                                            <Badge variant="outline" className={cn(
                                                "text-[9px] h-3.5 font-bold px-1.5 whitespace-nowrap",
                                                status === 'leave' 
                                                    ? "bg-orange-500/5 border-orange-500/20 text-orange-600"
                                                    : isHalfDay ? "bg-amber-500/5 border-amber-500/20 text-amber-600" : "bg-blue-500/5 border-blue-500/20 text-blue-600"
                                            )}>
                                                {status === 'leave' ? (isHalfDay ? "Half Day Leave" : "Full Day Leave") : isHalfDay ? "Half Day" : "Full Day"}
                                            </Badge>
                                        )}
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-lg font-black tracking-tight text-foreground">
                                        {workingHours ? `${workingHours.toFixed(1)}h` : "-"}
                                    </div>
                                    {extraHours > 0 && (
                                        <div className="text-[10px] font-bold text-green-600">
                                            +{extraHours.toFixed(1)}h extra
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 py-2 border-t border-border/30 mt-1">
                                <div className="flex items-center gap-2">
                                    <div className="p-1.5 rounded-md bg-muted/50">
                                        <Clock className="size-3 text-muted-foreground" />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Check In</span>
                                        <span className="text-xs font-semibold tabular-nums">
                                            {record.check_in ? format(new Date(record.check_in), "hh:mm a") : (
                                                record.type === 'holiday' ? "HOLIDAY" :
                                                record.type === 'leave' ? "LEAVE" :
                                                record.type === 'offDay' ? "OFF DAY" :
                                                record.type === 'absent' ? "ABSENT" : "--:-- --"
                                            )}
                                        </span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="p-1.5 rounded-md bg-muted/50">
                                        <ArrowRight className="size-3 text-muted-foreground" />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Check Out</span>
                                        <span className="text-xs font-semibold tabular-nums">
                                            {record.check_out ? format(new Date(record.check_out), "hh:mm a") : (
                                                record.type === 'holiday' ? "HOLIDAY" :
                                                record.type === 'leave' ? "LEAVE" :
                                                record.type === 'offDay' ? "OFF DAY" :
                                                record.type === 'absent' ? "ABSENT" : "--:-- --"
                                            )}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )
                })}
                <SummaryPagination
                    page={activeSummaryPage}
                    pageCount={summaryPageCount}
                    total={compiledRecords.length}
                    onPageChange={setSummaryPage}
                />
            </div>
        )
    }

    return (
        <div className="flex min-h-full w-full flex-col overflow-hidden [&_th]:px-2 [&_td]:px-2 [&_th:first-child]:pl-4 [&_td:first-child]:pl-4 [&_th:last-child]:pr-4 [&_td:last-child]:pr-4 [&_td]:text-xs [&_th]:text-[10px] [&_th]:uppercase [&_th]:tracking-wider">
            <DataTable
                columns={columns}
                data={paginatedRecords}
                isLoading={isLoading}
                hidePagination={true}
                emptyIcon={<CalendarDays className="size-10 text-muted-foreground/20" />}
                emptyMessage="No attendance records for this month"
            />
            <SummaryPagination
                page={activeSummaryPage}
                pageCount={summaryPageCount}
                total={compiledRecords.length}
                onPageChange={setSummaryPage}
            />
        </div>
    )
}
