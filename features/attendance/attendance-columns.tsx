"use client"

import { ColumnDef } from "@tanstack/react-table"
import { Badge } from "@/components/ui/badge"
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header"
import { ProfileInfoCell } from "@/components/dashboard/profile-info-cell"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { ActionButton, EditButton } from "@/components/ui/action-button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Checkbox } from "@/components/ui/checkbox"

interface AttendanceColumnsProps {
    onVerify: (record: any) => void
    onReject: (record: any) => void
    onEdit: (record: any) => void
    isVerifying?: boolean
    scheduledHoursMap?: Record<number, number>
}

export function createAttendanceColumns({
    onVerify,
    onReject,
    onEdit,
    isVerifying,
    scheduledHoursMap = {}
}: AttendanceColumnsProps): ColumnDef<any>[] {
    return [
        {
            id: "select",
            header: ({ table }) => (
                <Checkbox
                    checked={
                        table.getIsAllPageRowsSelected() ||
                        (table.getIsSomePageRowsSelected() && "indeterminate")
                    }
                    onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
                    aria-label="Select all"
                    className="h-4.5 w-4.5 rounded-sm border border-muted-foreground/50 data-[state=checked]:border-primary"
                />
            ),
            cell: ({ row }) => (
                <Checkbox
                    checked={row.getIsSelected()}
                    onCheckedChange={(value) => row.toggleSelected(!!value)}
                    aria-label="Select row"
                    className="h-4.5 w-4.5 rounded-sm border border-muted-foreground/50 data-[state=checked]:border-primary"
                />
            ),
            size: 30,
        },
        {
            accessorKey: "profile.full_name",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Employee" />
            ),
            cell: ({ row }) => <ProfileInfoCell profile={row.original.profile} className="max-w-[180px]" />,
            size: 200,
        },
        {
            accessorKey: "profile.email",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Email ID" />
            ),
            cell: ({ row }) => <span className="text-xs text-muted-foreground font-medium truncate block">{row.original.profile?.email || 'N/A'}</span>,
            size: 220,
        },
        {
            accessorKey: "date",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Date" />
            ),
            cell: ({ row }) => {
                const date = new Date(row.getValue("date"))
                return (
                    <div className="flex flex-col text-xs leading-tight">
                        <span className="font-bold">{format(date, 'MMM dd, yy')}</span>
                        <span className="text-[9px] text-muted-foreground font-medium">{format(date, 'EEE')}</span>
                    </div>
                )
            },
            size: 70,
        },
        {
            accessorKey: "check_in",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="In" />
            ),
            cell: ({ row }) => {
                const val = row.getValue("check_in")
                return val ? (
                    <div className="text-emerald-600 dark:text-emerald-400 font-bold text-[11px]">
                        {format(new Date(val as string), 'hh:mm a')}
                    </div>
                ) : <span className="text-muted-foreground/30 text-[10px]">--:--</span>
            },
            size: 55,
        },
        {
            accessorKey: "check_out",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Out" />
            ),
            cell: ({ row }) => {
                const val = row.getValue("check_out")
                return val ? (
                    <div className="text-amber-600 dark:text-amber-400 font-bold text-[11px]">
                        {format(new Date(val as string), 'hh:mm a')}
                    </div>
                ) : <span className="text-muted-foreground/30 text-[10px]">--:--</span>
            },
            size: 55,
        },
        {
            accessorKey: "working_hours",
            header: "Total",
            cell: ({ row }) => {
                const hours = row.getValue("working_hours") as number
                return hours ? (
                    <Badge variant="secondary" className="font-black tabular-nums bg-primary/5 text-primary border-primary/10 h-5 px-1.5 text-[10px]">
                        {hours.toFixed(1)}h
                    </Badge>
                ) : <span className="text-muted-foreground/30 text-[10px]">--</span>
            },
            size: 40,
        },
        {
            id: "extra_hours",
            header: "Extra",
            cell: ({ row }) => {
                const workingHours = row.original.working_hours as number
                const dateStr = row.original.date as string
 
                if (!workingHours) return <span className="text-muted-foreground/30 text-[10px]">--</span>
 
                const dayOfWeek = new Date(dateStr).getDay()
                const scheduledHours = scheduledHoursMap[dayOfWeek] ?? 9
                const extraHours = workingHours - scheduledHours
 
                if (extraHours <= 0) return <span className="text-muted-foreground/30 text-[10px]">--</span>
 
                const displayValue = `+${extraHours.toFixed(1)}h`
 
                return (
                    <span className="font-black tabular-nums text-[10px] text-emerald-600">
                        {displayValue}
                    </span>
                )
            },
            size: 40,
        },
        {
            accessorKey: "status",
            header: "Status",
            cell: ({ row }) => {
                const status = row.getValue("status") as string
                const isHalfDay = row.original.is_half_day
                return (
                    <div className="flex flex-col gap-1">
                        <Badge
                            variant="secondary"
                            className={cn(
                                "capitalize font-black text-[9px] tracking-tight px-1.5 h-4 border-none",
                                status === 'verified' && "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
                                status === 'pending' && "bg-amber-500/15 text-amber-700 dark:text-amber-400",
                                status === 'rejected' && "bg-rose-500/15 text-rose-700 dark:text-rose-400"
                            )}
                        >
                            {status}
                        </Badge>
                        {isHalfDay && (
                            <Badge variant="outline" className="text-[8px] h-3.5 bg-indigo-500/5 border-indigo-500/20 text-indigo-600 font-bold uppercase px-1 leading-none">
                                Half Day
                            </Badge>
                        )}
                    </div>
                )
            },
            size: 60,
        },
        {
            id: "actions",
            header: "Actions",
            cell: ({ row }) => {
                const record = row.original
                const isPending = record.status === 'pending'
 
                return (
                    <div className="flex items-center justify-end gap-1">
                        <TooltipProvider>
                            {isPending && (
                                <>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <ActionButton
                                                action="verify"
                                                variant="icon-only"
                                                size="sm"
                                                onClick={() => onVerify(record)}
                                                loading={isVerifying}
                                                className="h-7 w-7"
                                            />
                                        </TooltipTrigger>
                                        <TooltipContent>Approve</TooltipContent>
                                    </Tooltip>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <ActionButton
                                                action="reject"
                                                variant="icon-only"
                                                size="sm"
                                                onClick={() => onReject(record)}
                                                loading={isVerifying}
                                                className="h-7 w-7"
                                            />
                                        </TooltipTrigger>
                                        <TooltipContent>Reject</TooltipContent>
                                    </Tooltip>
                                </>
                            )}
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <EditButton
                                        variant="icon-only"
                                        size="sm"
                                        onClick={() => onEdit(record)}
                                        className="h-7 w-7"
                                    />
                                </TooltipTrigger>
                                <TooltipContent>Edit</TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    </div>
                )
            },
            size: 75,
        },
    ]
}
