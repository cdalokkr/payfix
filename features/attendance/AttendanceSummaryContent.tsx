"use client"

import { format, getDay } from "date-fns"
import { DataTable } from "@/components/ui/data-table"
import { ColumnDef } from "@tanstack/react-table"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { useMemo } from "react"
import { CalendarDays } from "lucide-react"

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
}

// Helper to calculate scheduled hours from time strings
function calculateScheduledHours(checkIn: string, checkOut: string): number {
    const [inH, inM] = checkIn.split(':').map(Number)
    const [outH, outM] = checkOut.split(':').map(Number)
    const inMinutes = inH * 60 + inM
    const outMinutes = outH * 60 + outM
    return (outMinutes - inMinutes) / 60
}

export function AttendanceSummaryContent({
    attendance,
    isLoading,
    settings
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
                    <div className="flex flex-col gap-1">
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
                        {row.original.is_half_day && (
                            <Badge variant="outline" className="text-[9px] h-3.5 bg-amber-500/5 border-amber-500/20 text-amber-600 font-medium px-1.5">
                                Half Day
                            </Badge>
                        )}
                    </div>
                )
            },
        },
        {
            id: "total_hours",
            header: "Total Hrs",
            cell: ({ row }) => {
                const workingHours = row.original.working_hours as number
                return (
                    <span className="font-medium tabular-nums text-foreground">
                        {workingHours ? `${Number(workingHours).toFixed(1)}h` : "-"}
                    </span>
                )
            },
        },
        {
            accessorKey: "working_hours",
            header: "Extra Hrs",
            cell: ({ row }) => {
                const workingHours = row.getValue("working_hours") as number
                const dateStr = row.getValue("date") as string

                if (!workingHours) return "-"

                const dayOfWeek = getDay(new Date(dateStr))
                const scheduledHours = scheduledHoursMap[dayOfWeek] ?? 9 // Default 9 hours if not set
                const extraHours = workingHours - scheduledHours

                const isPositive = extraHours > 0
                const isNegative = extraHours < 0
                const displayValue = isPositive
                    ? `+${extraHours.toFixed(1)}h`
                    : `${extraHours.toFixed(1)}h`

                return (
                    <span className={cn(
                        "font-medium tabular-nums",
                        isPositive && "text-green-600",
                        isNegative && "text-red-600",
                        !isPositive && !isNegative && "text-muted-foreground"
                    )}>
                        {displayValue}
                    </span>
                )
            },
        }
    ]

    return (
        <div className="w-full overflow-hidden [&_th]:px-2 [&_td]:px-2 [&_th:first-child]:pl-4 [&_td:first-child]:pl-4 [&_th:last-child]:pr-4 [&_td:last-child]:pr-4 [&_td]:text-xs [&_th]:text-[10px] [&_th]:uppercase [&_th]:tracking-wider">
            <DataTable
                columns={columns}
                data={attendance || []}
                isLoading={isLoading}
                hidePagination={true}
                emptyIcon={<CalendarDays className="size-10 text-muted-foreground/20" />}
                emptyMessage="No attendance records for this month"
            />
        </div>
    )
}
