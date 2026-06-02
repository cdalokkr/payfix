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
import { CheckCircle2, Clock, XCircle } from "lucide-react"

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
                const record = row.original;
                
                // Determine dayType and verificationState
                let verificationState: 'pending' | 'verified' | 'rejected' = 'pending';
                let dayType: 'Present' | 'Leave' | 'Absent' | 'Weekly Off' | 'Holiday' | 'Extra Day' | 'Half Day' = 'Absent';

                const status = record.status as string;

                if (status === 'verified' || status === 'rejected' || status === 'pending') {
                    verificationState = status;
                    
                    if (record.check_in || record.check_out) {
                        if (record.is_extra_day) {
                            dayType = 'Extra Day';
                        } else if (record.is_half_day) {
                            dayType = 'Half Day';
                        } else {
                            dayType = 'Present';
                        }
                    } else {
                        const remarks = (record.remarks || '').toLowerCase();
                        if (remarks.includes('leave')) {
                            dayType = 'Leave';
                        } else if (remarks.includes('weekly off') || remarks.includes('weekly_off')) {
                            dayType = 'Weekly Off';
                        } else if (remarks.includes('holiday')) {
                            dayType = 'Holiday';
                        } else {
                            dayType = 'Absent';
                        }
                    }
                } else {
                    // Virtual records
                    verificationState = 'pending';
                    if (status === 'leave') {
                        dayType = 'Leave';
                    } else if (status === 'weekly_off') {
                        dayType = 'Weekly Off';
                    } else if (status === 'holiday') {
                        dayType = 'Holiday';
                    } else {
                        dayType = 'Absent';
                    }
                }

                const dayTypeStyles: Record<string, string> = {
                    'Present': "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/30",
                    'Leave': "bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-900/30",
                    'Weekly Off': "bg-slate-50 dark:bg-slate-900/30 text-slate-700 dark:text-slate-400 border-slate-200 dark:border-slate-800/30",
                    'Holiday': "bg-sky-50 dark:bg-sky-950/30 text-sky-700 dark:text-sky-400 border-sky-200 dark:border-sky-900/30",
                    'Extra Day': "bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-900/30",
                    'Half Day': "bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-900/30",
                    'Absent': "bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-450 border-rose-200 dark:border-rose-900/30",
                };

                return (
                    <div className="flex flex-col gap-1.5 items-start">
                        {/* Day Type Badge */}
                        <Badge
                            variant="outline"
                            className={cn(
                                "font-extrabold text-[9px] tracking-tight px-1.5 h-4.5 rounded-md uppercase leading-none border shadow-none",
                                dayTypeStyles[dayType]
                            )}
                        >
                            {dayType}
                        </Badge>
                        
                        {/* Verification Status Badge */}
                        <div className={cn(
                            "flex items-center gap-1 text-[8px] font-bold px-1.5 py-0.5 rounded-full border",
                            verificationState === 'verified' && "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20",
                            verificationState === 'pending' && "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20",
                            verificationState === 'rejected' && "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20"
                        )}>
                            {verificationState === 'verified' && <CheckCircle2 className="size-2.5 text-emerald-500" />}
                            {verificationState === 'pending' && <Clock className="size-2.5 text-amber-500 animate-pulse" />}
                            {verificationState === 'rejected' && <XCircle className="size-2.5 text-rose-500" />}
                            <span className="capitalize">{verificationState === 'verified' ? 'verified' : verificationState}</span>
                        </div>
                    </div>
                )
            },
            size: 90,
        },
        {
            id: "actions",
            header: "Actions",
            cell: ({ row }) => {
                const record = row.original
                const showApprove = record.status !== 'verified'
                const showReject = record.status !== 'rejected'
 
                return (
                    <div className="flex items-center justify-end gap-1">
                        <TooltipProvider>
                            {showApprove && (
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
                            )}
                            {showReject && (
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
