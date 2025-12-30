"use client"

import { format } from "date-fns"
import { DataTable } from "@/components/ui/data-table"
import { ColumnDef } from "@tanstack/react-table"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

interface AttendanceSummaryContentProps {
    attendance?: any[]
    isLoading: boolean
}

export function AttendanceSummaryContent({
    attendance,
    isLoading
}: AttendanceSummaryContentProps) {
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
        <div className="w-full">
            <DataTable
                columns={columns}
                data={attendance || []}
                isLoading={isLoading}
                hidePagination={true}
            />
        </div>
    )
}
