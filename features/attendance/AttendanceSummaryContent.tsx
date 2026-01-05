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
            header: "In",
            cell: ({ row }) => row.getValue("check_in")
                ? format(new Date(row.getValue("check_in")), "hh:mm a")
                : "-",
        },
        {
            accessorKey: "check_out",
            header: "Out",
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
                            "capitalize font-black text-[9px] px-1.5 h-3.5",
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
            id: "attendance_type",
            header: "Type",
            cell: ({ row }) => {
                const isHalfDay = row.original.is_half_day
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
