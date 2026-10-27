"use client"

import { ColumnDef } from "@tanstack/react-table"
import { Badge } from "@/components/ui/badge"
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header"
import { ProfileInfoCell } from "@/components/dashboard/profile-info-cell"
import { format } from "date-fns"
import { calculateAttendanceExtraHours } from "@/lib/utils/attendance-extra-hours"
import { cn } from "@/lib/utils"
import { ActionButton, EditButton } from "@/components/ui/action-button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Checkbox } from "@/components/ui/checkbox"
import { CheckCircle2, Clock, XCircle, UserCheck, UserX } from "lucide-react"

export type DayType = 
    | 'Present' 
    | 'On Leave' 
    | 'Absent' 
    | 'Weekly Off' 
    | 'Holiday' 
    | 'Extra Day' 
    | 'Half Day' 
    | 'Not marked' 
    | 'Marked In' 
    | 'Marked Out' 
    | 'Applied Leave';

export function getRecordDayType(record: any): DayType {
    const status = record.status as string; // 'verified', 'rejected', 'pending', 'absent', or virtual status
    const hasCheckIn = !!record.check_in;
    const hasCheckOut = !!record.check_out;
    const remarks = (record.remarks || '').toLowerCase();

    // 1. Explicit Absent check takes precedence if status is absent or remarks indicate absent
    if (status === 'absent' || remarks.startsWith('absent') || (remarks.includes('absent') && !hasCheckIn && !hasCheckOut)) {
        return 'Absent';
    }

    // 2. Strict Check: If record has check-in or check-out, it CANNOT be "On Leave"
    if (hasCheckIn || hasCheckOut) {
        if (record.is_half_day) return 'Half Day';
        if (record.is_extra_day) return 'Extra Day';
        if (hasCheckIn && hasCheckOut) return 'Present';
        if (hasCheckIn && !hasCheckOut) return 'Marked In';
        if (!hasCheckIn && hasCheckOut) return 'Marked Out';
    }

    // 3. Status-based mapping for non-punch records
    if (status === 'leave') return 'On Leave';
    if (status === 'applied_leave') return 'Applied Leave';
    if (status === 'half_day') return 'Half Day';
    if (status === 'weekly_off') return 'Weekly Off';
    if (status === 'holiday') return 'Holiday';
    if (status === 'extra_day') return 'Extra Day';
    if (status === 'present') return 'Present';

    // 4. Remarks-based fallbacks for manual inputs/imported records without times
    if (remarks.includes('leave')) return 'On Leave';
    if (remarks.includes('weekly off') || remarks.includes('weekend')) return 'Weekly Off';
    if (remarks.includes('holiday')) return 'Holiday';

    // 5. Default state for pending/unmarked records
    return 'Not marked';
}

interface AttendanceColumnsProps {
    onVerify: (record: any) => void
    onReject: (record: any) => void
    onEdit: (record: any) => void
    onViewSessions?: (record: any) => void
    isVerifying?: boolean
    scheduledHoursMap?: Record<number, number>
}

export function createAttendanceColumns({
    onVerify,
    onReject,
    onEdit,
    onViewSessions,
    isVerifying = false,
    scheduledHoursMap = {}
}: AttendanceColumnsProps): ColumnDef<any>[] {
    return [
        {
            id: "select",
            header: ({ table }) => (
                <Checkbox
                    checked={table.getIsAllPageRowsSelected()}
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
                <DataTableColumnHeader column={column} title="Employee Details" />
            ),
            cell: ({ row }) => (
                <ProfileInfoCell 
                    profile={row.original.profile} 
                    showEmail={true} 
                    className="max-w-[240px]" 
                />
            ),
            size: 220,
        },
        {
            accessorKey: "date",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Date" />
            ),
            cell: ({ row }) => {
                const dateVal = row.getValue("date") as string
                const date = dateVal ? new Date(dateVal.includes('T') ? dateVal : `${dateVal}T00:00:00`) : new Date()
                return (
                    <div className="flex flex-col text-xs leading-tight min-w-[70px]">
                        <span className="font-bold text-foreground tabular-nums whitespace-nowrap">
                            {format(date, 'dd-MMM-yyyy')}
                        </span>
                        <span className="text-[9px] text-muted-foreground font-medium">
                            {format(date, 'EEE')}
                        </span>
                    </div>
                )
            },
            size: 65,
        },
        {
            id: "punch_times",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Punch In / Out" />
            ),
            cell: ({ row }) => {
                const record = row.original
                const firstIn = record.first_check_in || record.check_in
                const isCurrentlyIn = record.current_session_status === 'checked_in'
                const lastOut = record.last_check_out || record.check_out

                const inStr = firstIn ? format(new Date(firstIn as string), 'hh:mm a') : '--:--'
                const outStr = lastOut ? format(new Date(lastOut as string), 'hh:mm a') : '--:--'

                return (
                    <div className="flex flex-col gap-1 text-[11px] leading-tight min-w-[105px]">
                        {/* First In */}
                        <div className="flex items-center gap-1.5 font-bold">
                            <span className="w-7 shrink-0 text-center text-[8px] font-black uppercase py-0.5 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
                                In
                            </span>
                            <span className={firstIn ? "text-emerald-700 dark:text-emerald-400" : "text-muted-foreground/30 font-normal"}>
                                {inStr}
                            </span>
                        </div>

                        {/* Last Out / In Office */}
                        <div className="flex items-center gap-1.5 font-bold">
                            <span className="w-7 shrink-0 text-center text-[8px] font-black uppercase py-0.5 rounded bg-amber-500/10 text-amber-700 dark:text-amber-400">
                                Out
                            </span>
                            {isCurrentlyIn ? (
                                <div className="flex items-center gap-1 text-sky-600 dark:text-sky-400 font-extrabold text-[10px]">
                                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping inline-block" />
                                    <span>In Office</span>
                                </div>
                            ) : (
                                <span className={lastOut ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground/30 font-normal"}>
                                    {outStr}
                                </span>
                            )}
                        </div>
                    </div>
                )
            },
            size: 85,
        },
        {
            id: "work_hours",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Work Hours" />
            ),
            cell: ({ row }) => {
                const record = row.original
                const hours = record.working_hours ? Number(record.working_hours) : null
                const totalSessions = record.sessions?.length || (record.total_sessions as number | undefined) || 0
                const dateStr = record.date as string
                const dayOfWeek = dateStr ? new Date(dateStr).getDay() : 1
                const scheduledHours = scheduledHoursMap[dayOfWeek] ?? 9

                // Calculate extra hours using individual office location timing and buffer rule
                const extraCalc = calculateAttendanceExtraHours({
                    checkIn: record.first_in || record.check_in,
                    checkOut: record.last_out || record.check_out,
                    officeTiming: (record as any).location,
                    date: dateStr,
                })
                const extraHours = extraCalc.extraHours

                return (
                    <div className="flex flex-col gap-0.5 leading-tight min-w-[85px]">
                        {/* Line 1: Total Working Hours & Clickable Session Pill (2 decimals matching session drawer) */}
                        <div className="flex items-center gap-1.5">
                            {hours !== null ? (
                                <>
                                    <span className="font-semibold text-xs text-foreground tabular-nums">
                                        {hours.toFixed(2)}h
                                    </span>
                                    {totalSessions > 1 && (
                                        <button
                                            type="button"
                                            onClick={() => onViewSessions?.(record)}
                                            className="text-[9px] font-bold text-primary bg-primary/10 hover:bg-primary/20 px-1.5 py-0.2 rounded-full cursor-pointer transition-colors border border-primary/20"
                                            title={`${totalSessions} Sessions - Click to view drawer`}
                                        >
                                            {totalSessions}s
                                        </button>
                                    )}
                                </>
                            ) : (
                                <span className="text-muted-foreground/30 text-[11px]">--</span>
                            )}
                        </div>

                        {/* Line 2: Extra Hours or Scheduled Reference */}
                        {extraHours > 0 ? (
                            <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
                                +{extraHours.toFixed(2)}h extra
                            </span>
                        ) : hours !== null ? (
                            <span className="text-[9px] text-muted-foreground/60 font-medium">
                                Sched: {scheduledHours}h
                            </span>
                        ) : null}
                    </div>
                )
            },
            size: 80,
        },
        {
            accessorKey: "status",
            header: "Status",
            cell: ({ row }) => {
                const record = row.original;
                const status = record.status as string;
                const dayType = getRecordDayType(record);
                
                const verificationState: 'pending' | 'verified' | 'rejected' = 
                    status === 'verified' || status === 'absent' ? 'verified' : 
                    status === 'rejected' ? 'rejected' : 'pending';

                const dayTypeStyles: Record<string, string> = {
                    'Present': "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/30",
                    'On Leave': "bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-900/30",
                    'Weekly Off': "bg-slate-50 dark:bg-slate-900/30 text-slate-700 dark:text-slate-400 border-slate-200 dark:border-slate-800/30",
                    'Holiday': "bg-sky-50 dark:bg-sky-950/30 text-sky-700 dark:text-sky-400 border-sky-200 dark:border-sky-900/30",
                    'Extra Day': "bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-900/30",
                    'Half Day': "bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-900/30",
                    'Absent': "bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-450 border-rose-200 dark:border-rose-900/30",
                    'Not marked': "bg-zinc-105 dark:bg-zinc-900/40 text-zinc-650 dark:text-zinc-400 border-zinc-200/50 dark:border-zinc-800/40",
                    'Marked In': "bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-900/30",
                    'Marked Out': "bg-teal-50 dark:bg-teal-950/30 text-teal-700 dark:text-teal-400 border-teal-200 dark:border-teal-900/30",
                    'Applied Leave': "bg-yellow-50 dark:bg-yellow-950/30 text-yellow-800 dark:text-yellow-400 border-yellow-200 dark:border-yellow-900/30",
                };

                return (
                    <div className="flex flex-row flex-wrap gap-1.5 items-center">
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
                            verificationState === 'pending' && "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20",
                            verificationState === 'rejected' && "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20"
                        )}>
                            {verificationState === 'verified' && <CheckCircle2 className="size-2.5 text-emerald-500" />}
                            {verificationState === 'pending' && <Clock className="size-2.5 text-blue-500 animate-pulse" />}
                            {verificationState === 'rejected' && <XCircle className="size-2.5 text-rose-500" />}
                            <span className="capitalize">{verificationState === 'verified' ? 'verified' : verificationState}</span>
                        </div>
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
                const hasUnverifiedSessions = record.sessions?.some((s: any) => s.status !== 'verified' && s.status !== 'rejected');
                const isFullyVerified = record.status === 'verified' && !hasUnverifiedSessions;
                const showApprove = true;
                const showReject = record.status !== 'rejected'
 
                return (
                    <div className="flex items-center justify-end gap-1">
                        <TooltipProvider>
                            {showApprove && (
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <ActionButton
                                            action={isFullyVerified ? "deactivate" : "activate"}
                                            icon={isFullyVerified ? UserX : UserCheck}
                                            variant="icon-only"
                                            size="sm"
                                            onClick={() => onVerify(record)}
                                            loading={isVerifying}
                                            className="h-7 w-7"
                                        />
                                    </TooltipTrigger>
                                    <TooltipContent>{hasUnverifiedSessions ? 'Verify Pending Sessions' : isFullyVerified ? 'Verified (Click to Review / Re-verify)' : 'Approve & Verify All Sessions'}</TooltipContent>
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
                                    <ActionButton
                                        action="view"
                                        icon={Clock}
                                        variant="icon-only"
                                        size="sm"
                                        onClick={() => onViewSessions?.(record)}
                                        className="h-7 w-7"
                                    />
                                </TooltipTrigger>
                                <TooltipContent>View Sessions Drawer</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <EditButton
                                        variant="icon-only"
                                        size="sm"
                                        onClick={() => onEdit(record)}
                                        className="h-7 w-7"
                                    />
                                </TooltipTrigger>
                                <TooltipContent>Edit Day Status</TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    </div>
                )
            },
            size: 55,
        },
    ]
}
