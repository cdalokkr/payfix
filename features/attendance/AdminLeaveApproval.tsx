"use client"

/* Approval previews use dynamic user-uploaded URLs that next/image cannot optimize. */
/* eslint-disable @next/next/no-img-element */

import React, { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { trpc } from "@/lib/trpc/client"
import { format, differenceInCalendarDays } from "date-fns"
import { Check, X, Search, Plane, Loader2, Calendar as CalendarIcon, Clock, CheckCircle2, XCircle, ChevronsUpDown, FileText } from "lucide-react"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { CompactMetricCard } from "@/components/dashboard/compact-metric-card"
import { Textarea } from "@/components/ui/textarea"
import { DataTable } from "@/components/ui/data-table"
import { ProfileInfoCell } from "@/components/dashboard/profile-info-cell"
import { DateRange } from "react-day-picker"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { CardShell } from "./CardShell"
import { ActionButton } from "@/components/ui/action-button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

export function AdminLeaveApproval() {
    const [employeeFilter, setEmployeeFilter] = useState('all')
    const [searchQuery, setSearchQuery] = useState("")
    const [statusFilter, setStatusFilter] = useState('all')
    const [dateFilter, setDateFilter] = useState<DateRange | undefined>(undefined)
    
    const [isRejectOpen, setIsRejectOpen] = useState(false)
    const [rejectionReason, setRejectionReason] = useState("")
    const [isApproveOpen, setIsApproveOpen] = useState(false)
    const [selectedLeave, setSelectedLeave] = useState<any>(null)

    const utils = trpc.useUtils()
    const { data: leaves = [], isLoading, isFetching } = trpc.attendance.getLeaves.useQuery({ status: 'all' })

    const updateStatusMutation = trpc.attendance.approveLeave.useMutation({
        onSuccess: (data) => {
            toast.success(`Leave ${data.status} successfully`)
            setIsRejectOpen(false)
            setIsApproveOpen(false)
            setRejectionReason("")
            setSelectedLeave(null)
            utils.attendance.getLeaves.invalidate()
            utils.attendance.getAttendance.invalidate()
        },
        onError: (error) => toast.error(error.message)
    })

    const handleApproveClick = (leave: any) => {
        setSelectedLeave(leave)
        setIsApproveOpen(true)
    }

    const handleRejectClick = (leave: any) => {
        setSelectedLeave(leave)
        setIsRejectOpen(true)
    }

    // Filter leaves on client side
    const filteredLeaves = useMemo(() => {
        return leaves.filter((leave: any) => {
            // Employee Filter
            if (employeeFilter !== 'all' && leave.profile_id !== employeeFilter) {
                return false
            }
            
            // Status Filter
            if (statusFilter !== 'all' && leave.status !== statusFilter) {
                return false
            }
            
            // Date Filter (Overlap check)
            if (dateFilter?.from) {
                const fromDate = dateFilter.from
                const toDate = dateFilter.to || dateFilter.from
                const leaveStart = new Date(leave.start_date)
                const leaveEnd = new Date(leave.end_date)
                
                // Format dates to YYYY-MM-DD for accurate comparison (avoiding timezone shifts)
                const leaveStartStr = format(leaveStart, 'yyyy-MM-dd')
                const leaveEndStr = format(leaveEnd, 'yyyy-MM-dd')
                const fromDateStr = format(fromDate, 'yyyy-MM-dd')
                const toDateStr = format(toDate, 'yyyy-MM-dd')

                if (leaveStartStr > toDateStr || leaveEndStr < fromDateStr) {
                    return false
                }
            }
            
            // Search Query
            if (searchQuery) {
                const query = searchQuery.toLowerCase()
                const nameMatch = leave.profile?.full_name?.toLowerCase().includes(query)
                const emailMatch = leave.profile?.email?.toLowerCase().includes(query)
                const typeMatch = leave.leave_type?.toLowerCase().includes(query)
                const reasonMatch = leave.reason?.toLowerCase().includes(query)
                if (!nameMatch && !emailMatch && !typeMatch && !reasonMatch) {
                    return false
                }
            }
            
            return true
        })
    }, [leaves, employeeFilter, statusFilter, dateFilter, searchQuery])

    // Get unique list of employees from leaves list dynamically
    const uniqueEmployees = useMemo(() => {
        const map = new Map<string, any>()
        leaves.forEach((leave: any) => {
            if (leave.profile) {
                map.set(leave.profile.id, leave.profile)
            }
        })
        return Array.from(map.values())
    }, [leaves])

    // Calculate metrics based on the filtered results
    const stats = useMemo(() => {
        let pending = 0
        let approved = 0
        let rejected = 0
        
        filteredLeaves.forEach((l: any) => {
            if (l.status === 'pending') pending++
            else if (l.status === 'approved') approved++
            else if (l.status === 'rejected') rejected++
        })

        return {
            total: filteredLeaves.length,
            pending,
            approved,
            rejected
        }
    }, [filteredLeaves])

    const columns = useMemo(() => [
        {
            accessorKey: "profile.full_name",
            header: "Employee",
            cell: ({ row }: any) => <ProfileInfoCell profile={row.original.profile} className="max-w-[180px]" />,
            size: 200,
        },
        {
            accessorKey: "leave_type",
            header: "Leave Type",
            cell: ({ row }: any) => {
                const leave = row.original
                return (
                    <div className="flex flex-col items-start gap-1">
                        <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-wider bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                            {leave.leave_type || 'N/A'}
                        </Badge>
                        {leave.is_half_day && (
                            <Badge variant="outline" className="text-[9px] h-4 bg-primary/5 border-primary/20 text-primary uppercase font-extrabold tracking-tight">
                                Half ({leave.half_day_period})
                            </Badge>
                        )}
                    </div>
                )
            },
            size: 110,
        },
        {
            accessorKey: "start_date",
            header: "Start Date",
            cell: ({ row }: any) => format(new Date(row.getValue("start_date")), 'MMM dd, yyyy'),
            size: 100,
        },
        {
            accessorKey: "end_date",
            header: "End Date",
            cell: ({ row }: any) => format(new Date(row.getValue("end_date")), 'MMM dd, yyyy'),
            size: 100,
        },
        {
            accessorKey: "status",
            header: "Status",
            cell: ({ row }: any) => {
                const status = row.getValue("status") as string
                return (
                    <Badge variant={
                        status === 'approved' ? 'success' as any :
                        status === 'rejected' ? 'destructive' : 'secondary'
                    } className="capitalize font-bold text-[9px] tracking-tight">
                        {status}
                    </Badge>
                )
            },
            size: 80,
        },
        {
            accessorKey: "reason",
            header: "Reason",
            cell: ({ row }: any) => {
                const reason = row.getValue("reason") as string
                return (
                    <div className="max-w-[280px] md:max-w-[350px] whitespace-normal break-words font-medium text-xs text-muted-foreground leading-normal">
                        {reason || '—'}
                    </div>
                )
            },
            size: 250,
        },
        {
            id: "actions",
            header: () => <div className="text-right">Actions</div>,
            cell: ({ row }: any) => {
                const leave = row.original
                if (leave.status !== 'pending') return null
                return (
                    <div className="flex justify-end gap-1">
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <ActionButton
                                        action="verify"
                                        variant="icon-only"
                                        size="sm"
                                        onClick={() => handleApproveClick(leave)}
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
                                        onClick={() => handleRejectClick(leave)}
                                        className="h-7 w-7"
                                    />
                                </TooltipTrigger>
                                <TooltipContent>Reject</TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    </div>
                )
            },
            size: 90,
        }
    ], [])

    return (
        <div className="space-y-6">
            {/* compact metrics cards with matching symmetry */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <CompactMetricCard
                    label="Pending Requests"
                    value={stats.pending}
                    icon={Clock}
                    theme="amber"
                    delay={0.1}
                    loading={isLoading || isFetching}
                />
                <CompactMetricCard
                    label="Approved Leaves"
                    value={stats.approved}
                    icon={CheckCircle2}
                    theme="green"
                    delay={0.2}
                    loading={isLoading || isFetching}
                />
                <CompactMetricCard
                    label="Rejected Leaves"
                    value={stats.rejected}
                    icon={XCircle}
                    theme="rose"
                    delay={0.3}
                    loading={isLoading || isFetching}
                />
                <CompactMetricCard
                    label="Total Requests"
                    value={stats.total}
                    icon={Plane}
                    theme="blue"
                    delay={0.4}
                    loading={isLoading || isFetching}
                />
            </div>

            {/* main list card */}
            <CardShell
                title="Leave Requests"
                description="Review and manage employee leave requests"
                icon={FileText}
                contentClassName="min-h-0 p-6 pt-2 h-full overflow-auto"
            >
                <DataTable
                    columns={columns}
                    data={filteredLeaves}
                    isLoading={isLoading}
                    className="[&_td]:py-1.5 [&_th]:py-1.5 [&_td]:px-2.5 [&_th]:px-2.5"
                    toolbar={(table) => (
                        <LeaveTableToolbar
                            table={table}
                            employeeFilter={employeeFilter}
                            onEmployeeFilterChange={(val: any) => {
                                setEmployeeFilter(val)
                            }}
                            uniqueEmployees={uniqueEmployees}
                            statusFilter={statusFilter}
                            onStatusFilterChange={(val: any) => {
                                setStatusFilter(val)
                            }}
                            dateFilter={dateFilter}
                            onDateFilterChange={setDateFilter}
                            isLoading={isLoading}
                        />
                    )}
                />
            </CardShell>

            {/* Approve Leave Dialog */}
            <Dialog 
                open={isApproveOpen} 
                onOpenChange={(open) => {
                    if (updateStatusMutation.isPending) return
                    setIsApproveOpen(open)
                }}
            >
                <DialogContent className="max-w-[500px] w-[95vw] sm:w-full p-0 overflow-hidden rounded-2xl shadow-2xl border border-slate-200/60 dark:border-slate-800/60 bg-white dark:bg-slate-950">
                    <DialogHeader className="px-4 pt-4 pb-3 border-b border-slate-100 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-900/30">
                        <DialogTitle className="text-base font-bold flex items-center gap-2">
                            <div className="p-1.5 rounded-xl shadow-sm bg-emerald-500/10 text-emerald-600 dark:text-emerald-500">
                                <CheckCircle2 className="w-4 h-4" />
                            </div>
                            Approve Leave Request
                        </DialogTitle>
                        <DialogDescription className="text-xs font-medium text-muted-foreground ml-9 mt-0.5">
                            Please review the leave details below to proceed.
                        </DialogDescription>
                    </DialogHeader>

                    {selectedLeave && (
                        <div className="px-4 py-3.5 space-y-3">
                            {/* Employee Card */}
                            <div className="flex items-center gap-3 p-2 rounded-xl bg-gradient-to-r from-slate-50 to-white dark:from-slate-900/80 dark:to-slate-900/40 border border-slate-200/60 dark:border-slate-800/80 shadow-sm transition-all hover:shadow-md">
                                <ProfileInfoCell profile={selectedLeave.profile} />
                            </div>

                            {/* Leave details grid */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                                <div className="p-2.5 rounded-xl border border-slate-200/60 dark:border-slate-800/60 bg-white/50 dark:bg-slate-950/50 backdrop-blur-sm shadow-[0_2px_10px_-3px_rgba(6,81,237,0.05)] flex flex-col justify-center transition-all hover:bg-slate-50 dark:hover:bg-slate-900">
                                    <span className="text-[10px] font-semibold tracking-wider uppercase text-muted-foreground mb-0.5">Leave Type</span>
                                    <div className="flex flex-col items-start gap-0.5">
                                        <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-wider bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-1.5 py-0">
                                            {selectedLeave.leave_type || 'N/A'}
                                        </Badge>
                                        {selectedLeave.is_half_day && (
                                            <Badge variant="outline" className="text-[9px] h-4 bg-primary/5 border-primary/20 text-primary uppercase font-extrabold tracking-tight px-1 py-0 mt-0.5">
                                                Half ({selectedLeave.half_day_period})
                                            </Badge>
                                        )}
                                    </div>
                                </div>
                                <div className="p-2.5 rounded-xl border border-slate-200/60 dark:border-slate-800/60 bg-white/50 dark:bg-slate-950/50 backdrop-blur-sm shadow-[0_2px_10px_-3px_rgba(6,81,237,0.05)] flex flex-col justify-center transition-all hover:bg-slate-50 dark:hover:bg-slate-900">
                                    <span className="text-[10px] font-semibold tracking-wider uppercase text-muted-foreground mb-0.5">Duration</span>
                                    <span className="font-black text-primary text-sm">
                                        {selectedLeave.is_half_day ? '0.5 Day' : `${differenceInCalendarDays(new Date(selectedLeave.end_date), new Date(selectedLeave.start_date)) + 1} Days`}
                                    </span>
                                </div>
                                <div className="p-2.5 rounded-xl border border-slate-200/60 dark:border-slate-800/60 bg-white/50 dark:bg-slate-950/50 backdrop-blur-sm shadow-[0_2px_10px_-3px_rgba(6,81,237,0.05)] flex flex-col justify-center transition-all hover:bg-slate-50 dark:hover:bg-slate-900">
                                    <span className="text-[10px] font-semibold tracking-wider uppercase text-muted-foreground mb-0.5">Start Date</span>
                                    <span className="font-bold text-slate-800 dark:text-slate-200 text-[13px]">
                                        {format(new Date(selectedLeave.start_date), 'MMM dd, yyyy')}
                                    </span>
                                </div>
                                <div className="p-2.5 rounded-xl border border-slate-200/60 dark:border-slate-800/60 bg-white/50 dark:bg-slate-950/50 backdrop-blur-sm shadow-[0_2px_10px_-3px_rgba(6,81,237,0.05)] flex flex-col justify-center transition-all hover:bg-slate-50 dark:hover:bg-slate-900">
                                    <span className="text-[10px] font-semibold tracking-wider uppercase text-muted-foreground mb-0.5">End Date</span>
                                    <span className="font-bold text-slate-800 dark:text-slate-200 text-[13px]">
                                        {format(new Date(selectedLeave.end_date), 'MMM dd, yyyy')}
                                    </span>
                                </div>
                            </div>

                            {/* Reason */}
                            {selectedLeave.reason && (
                                <div className="p-2.5 rounded-xl bg-orange-500/10 border border-orange-500/20 shadow-sm transition-all hover:shadow-md">
                                    <span className="text-[10px] font-bold tracking-wider uppercase text-orange-600 dark:text-orange-500 block mb-1">Reason for Leave</span>
                                    <span className="text-slate-700 dark:text-slate-200 font-medium text-xs font-normal">
                                        {selectedLeave.reason}
                                    </span>
                                </div>
                            )}

                            {/* Show processing status if pending */}
                            {updateStatusMutation.isPending && (
                                <div className="flex flex-col items-center justify-center py-2 space-y-2">
                                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                                    <span className="text-[10px] font-semibold text-muted-foreground animate-pulse">
                                        Approving request...
                                    </span>
                                </div>
                            )}
                        </div>
                    )}

                    <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-900/30 flex flex-col-reverse sm:flex-row justify-end gap-2 rounded-b-2xl">
                        <Button 
                            className="w-full sm:w-auto h-8 text-xs font-medium"
                            variant="outline" 
                            disabled={updateStatusMutation.isPending}
                            onClick={() => setIsApproveOpen(false)}
                        >
                            Cancel
                        </Button>
                        <Button 
                            className="w-full sm:w-auto h-8 text-xs font-bold shadow-md"
                            variant="default"
                            disabled={updateStatusMutation.isPending}
                            onClick={() => {
                                if (selectedLeave) {
                                    updateStatusMutation.mutate({ id: selectedLeave.id, status: 'approved', remarks: "" })
                                }
                            }}
                        >
                            {updateStatusMutation.isPending && <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />}
                            Approve Leave
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Rejection Reason Dialog */}
            <Dialog 
                open={isRejectOpen} 
                onOpenChange={(open) => {
                    if (updateStatusMutation.isPending) return
                    setIsRejectOpen(open)
                }}
            >
                <DialogContent className="max-w-[500px] w-[95vw] sm:w-full p-0 overflow-hidden rounded-2xl shadow-2xl border border-slate-200/60 dark:border-slate-800/60 bg-white dark:bg-slate-950">
                    <DialogHeader className="px-4 pt-4 pb-3 border-b border-slate-100 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-900/30">
                        <DialogTitle className="text-base font-bold flex items-center gap-2">
                            <div className="p-1.5 rounded-xl shadow-sm bg-rose-500/10 text-rose-600 dark:text-rose-500">
                                <XCircle className="w-4 h-4" />
                            </div>
                            Reject Leave Request
                        </DialogTitle>
                        <DialogDescription className="text-xs font-medium text-muted-foreground ml-9 mt-0.5">
                            Please provide a reason for rejecting this leave request.
                        </DialogDescription>
                    </DialogHeader>

                    {selectedLeave && (
                        <div className="px-4 py-3.5 space-y-3.5">
                            {/* Employee Card */}
                            <div className="flex items-center gap-3 p-2 rounded-xl bg-gradient-to-r from-slate-50 to-white dark:from-slate-900/80 dark:to-slate-900/40 border border-slate-200/60 dark:border-slate-800/80 shadow-sm transition-all hover:shadow-md">
                                <ProfileInfoCell profile={selectedLeave.profile} />
                            </div>

                            {/* Leave details grid */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                                <div className="p-2.5 rounded-xl border border-slate-200/60 dark:border-slate-800/60 bg-white/50 dark:bg-slate-950/50 backdrop-blur-sm shadow-[0_2px_10px_-3px_rgba(6,81,237,0.05)] flex flex-col justify-center transition-all hover:bg-slate-50 dark:hover:bg-slate-900">
                                    <span className="text-[10px] font-semibold tracking-wider uppercase text-muted-foreground mb-0.5">Leave Type</span>
                                    <div className="flex flex-col items-start gap-0.5">
                                        <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-wider bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-1.5 py-0">
                                            {selectedLeave.leave_type || 'N/A'}
                                        </Badge>
                                        {selectedLeave.is_half_day && (
                                            <Badge variant="outline" className="text-[9px] h-4 bg-primary/5 border-primary/20 text-primary uppercase font-extrabold tracking-tight px-1 py-0 mt-0.5">
                                                Half ({selectedLeave.half_day_period})
                                            </Badge>
                                        )}
                                    </div>
                                </div>
                                <div className="p-2.5 rounded-xl border border-slate-200/60 dark:border-slate-800/60 bg-white/50 dark:bg-slate-950/50 backdrop-blur-sm shadow-[0_2px_10px_-3px_rgba(6,81,237,0.05)] flex flex-col justify-center transition-all hover:bg-slate-50 dark:hover:bg-slate-900">
                                    <span className="text-[10px] font-semibold tracking-wider uppercase text-muted-foreground mb-0.5">Duration</span>
                                    <span className="font-black text-primary text-sm">
                                        {selectedLeave.is_half_day ? '0.5 Day' : `${differenceInCalendarDays(new Date(selectedLeave.end_date), new Date(selectedLeave.start_date)) + 1} Days`}
                                    </span>
                                </div>
                                <div className="p-2.5 rounded-xl border border-slate-200/60 dark:border-slate-800/60 bg-white/50 dark:bg-slate-950/50 backdrop-blur-sm shadow-[0_2px_10px_-3px_rgba(6,81,237,0.05)] flex flex-col justify-center transition-all hover:bg-slate-50 dark:hover:bg-slate-900">
                                    <span className="text-[10px] font-semibold tracking-wider uppercase text-muted-foreground mb-0.5">Start Date</span>
                                    <span className="font-bold text-slate-800 dark:text-slate-200 text-[13px]">
                                        {format(new Date(selectedLeave.start_date), 'MMM dd, yyyy')}
                                    </span>
                                </div>
                                <div className="p-2.5 rounded-xl border border-slate-200/60 dark:border-slate-800/60 bg-white/50 dark:bg-slate-950/50 backdrop-blur-sm shadow-[0_2px_10px_-3px_rgba(6,81,237,0.05)] flex flex-col justify-center transition-all hover:bg-slate-50 dark:hover:bg-slate-900">
                                    <span className="text-[10px] font-semibold tracking-wider uppercase text-muted-foreground mb-0.5">End Date</span>
                                    <span className="font-bold text-slate-800 dark:text-slate-200 text-[13px]">
                                        {format(new Date(selectedLeave.end_date), 'MMM dd, yyyy')}
                                    </span>
                                </div>
                            </div>

                            {/* Reason */}
                            {selectedLeave.reason && (
                                <div className="p-2.5 rounded-xl bg-orange-500/10 border border-orange-500/20 shadow-sm transition-all hover:shadow-md">
                                    <span className="text-[10px] font-bold tracking-wider uppercase text-orange-600 dark:text-orange-500 block mb-1">Reason for Leave</span>
                                    <span className="text-slate-700 dark:text-slate-200 font-medium text-xs font-normal">
                                        {selectedLeave.reason}
                                    </span>
                                </div>
                            )}

                            {/* Rejection Reason Form Field */}
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold tracking-wider uppercase text-muted-foreground block">Reason for Rejection</label>
                                <Textarea
                                    placeholder="Please provide the reason for rejecting this leave request..."
                                    value={rejectionReason}
                                    onChange={(e) => setRejectionReason(e.target.value)}
                                    rows={3}
                                    className="bg-background border border-slate-200 dark:border-slate-800/80 rounded-xl resize-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-0 transition-all text-xs"
                                />
                            </div>

                            {/* Show processing status if pending */}
                            {updateStatusMutation.isPending && (
                                <div className="flex flex-col items-center justify-center py-2 space-y-2">
                                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                                    <span className="text-[10px] font-semibold text-muted-foreground animate-pulse">
                                        Rejecting request...
                                    </span>
                                </div>
                            )}
                        </div>
                    )}

                    <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-900/30 flex flex-col-reverse sm:flex-row justify-end gap-2 rounded-b-2xl">
                        <Button 
                            className="w-full sm:w-auto h-8 text-xs font-medium"
                            variant="outline" 
                            disabled={updateStatusMutation.isPending}
                            onClick={() => setIsRejectOpen(false)}
                        >
                            Cancel
                        </Button>
                        <Button 
                            className="w-full sm:w-auto h-8 text-xs font-bold shadow-md"
                            variant="destructive"
                            disabled={!rejectionReason || updateStatusMutation.isPending}
                            onClick={() => {
                                if (selectedLeave) {
                                    updateStatusMutation.mutate({ id: selectedLeave.id, status: 'rejected', remarks: rejectionReason })
                                }
                            }}
                        >
                            {updateStatusMutation.isPending && <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />}
                            Confirm Reject
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}

function LeaveTableToolbar({
    employeeFilter,
    onEmployeeFilterChange,
    uniqueEmployees,
    statusFilter,
    onStatusFilterChange,
    dateFilter,
    onDateFilterChange,
    isLoading
}: any) {
    const [employeeComboboxOpen, setEmployeeComboboxOpen] = useState(false)
    const [employeeSearchVal, setEmployeeSearchVal] = useState("")

    return (
        <div className="flex flex-col gap-3.5 p-1 mb-4 border-b border-slate-100 dark:border-slate-900 pb-4">
            <div className="flex flex-col sm:flex-row gap-5 items-stretch sm:items-center flex-wrap">
                
                {/* Employee Filter */}
                <div className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">Select Employee:</span>
                    <div className="relative w-full sm:w-[220px]">
                        <Popover open={employeeComboboxOpen} onOpenChange={setEmployeeComboboxOpen}>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="outline"
                                    role="combobox"
                                    disabled={isLoading}
                                    className={cn(
                                        "w-full h-9 rounded-xl border-slate-200 dark:border-slate-800 justify-between px-3 font-normal bg-transparent hover:bg-transparent text-left flex items-center shadow-none text-slate-700 dark:text-slate-250",
                                        employeeFilter !== 'all' && "border-indigo-500/50 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 font-semibold"
                                    )}
                                >
                                    {employeeFilter === 'all' ? (
                                        <span className="text-[11px] font-semibold">All Employees</span>
                                    ) : (() => {
                                        const selectedEmp = uniqueEmployees.find((e: any) => e.id === employeeFilter)
                                        if (!selectedEmp) return <span className="text-[11px]">Select Employee...</span>
                                        return (
                                            <div className="flex items-center gap-2 overflow-hidden">
                                                <div className="h-5 w-5 rounded-full overflow-hidden bg-muted flex items-center justify-center text-[8px] font-bold text-muted-foreground shrink-0">
                                                    {selectedEmp.avatar_url ? (
                                                        <img src={selectedEmp.avatar_url} alt="" className="h-full w-full object-cover" />
                                                    ) : (
                                                        <span>{selectedEmp.full_name?.split(' ').map((n: any) => n[0]).join('').slice(0, 2).toUpperCase()}</span>
                                                    )}
                                                </div>
                                                <span className="text-[11px] font-semibold truncate">
                                                    {selectedEmp.full_name}
                                                </span>
                                            </div>
                                        )
                                    })()}
                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="p-0 w-[240px] sm:w-[280px] max-h-80 flex flex-col rounded-xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl overflow-hidden" align="start">
                                <div className="p-2 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
                                    <Search className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
                                    <Input
                                        placeholder="Type to filter..."
                                        value={employeeSearchVal}
                                        onChange={(e) => setEmployeeSearchVal(e.target.value)}
                                        className="h-8 py-1 text-xs border-0 focus-visible:ring-0 focus-visible:ring-offset-0 px-0 bg-transparent placeholder:text-muted-foreground/50 shadow-none focus-visible:ring-transparent"
                                    />
                                </div>
                                <div className="overflow-y-auto py-1 flex-1 max-h-60 min-h-[100px] divide-y divide-slate-50 dark:divide-slate-850">
                                    <button
                                        onClick={() => {
                                            onEmployeeFilterChange('all')
                                            setEmployeeComboboxOpen(false)
                                            setEmployeeSearchVal("")
                                        }}
                                        className={cn(
                                            "w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-slate-700 dark:text-slate-200",
                                            employeeFilter === 'all' && "bg-slate-55 dark:bg-slate-800 font-semibold"
                                        )}
                                    >
                                        <span className="text-[11px] font-medium">All Employees</span>
                                        {employeeFilter === 'all' && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                                    </button>
                                    {(() => {
                                        const filtered = uniqueEmployees.filter((emp: any) => 
                                            emp.full_name?.toLowerCase().includes(employeeSearchVal.toLowerCase()) ||
                                            emp.email?.toLowerCase().includes(employeeSearchVal.toLowerCase())
                                        )
                                        if (filtered.length === 0) {
                                            return <div className="px-3 py-6 text-[11px] text-center text-muted-foreground">No employees found</div>
                                        }
                                        return filtered.map((emp: any) => {
                                            const isSelected = employeeFilter === emp.id
                                            return (
                                                <button
                                                    key={emp.id}
                                                    onClick={() => {
                                                        onEmployeeFilterChange(emp.id)
                                                        setEmployeeComboboxOpen(false)
                                                        setEmployeeSearchVal("")
                                                    }}
                                                    className={cn(
                                                        "w-full text-left px-3 py-2 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors",
                                                        isSelected && "bg-slate-50 dark:bg-slate-800"
                                                    )}
                                                >
                                                    <div className="flex items-center gap-2 py-0.5 overflow-hidden">
                                                        <div className="h-5 w-5 rounded-full overflow-hidden bg-muted flex items-center justify-center text-[8px] font-bold text-muted-foreground shrink-0">
                                                            {emp.avatar_url ? (
                                                                <img src={emp.avatar_url} alt="" className="h-full w-full object-cover" />
                                                            ) : (
                                                                <span>{emp.full_name?.split(' ').map((n: any) => n[0]).join('').slice(0, 2).toUpperCase()}</span>
                                                            )}
                                                        </div>
                                                        <span className="text-[11px] font-semibold text-slate-850 dark:text-slate-200 truncate">
                                                            {emp.full_name}
                                                        </span>
                                                    </div>
                                                    {isSelected && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                                                </button>
                                            )
                                        })
                                    })()}
                                </div>
                            </PopoverContent>
                        </Popover>
                    </div>
                </div>

                {/* Date Filter */}
                <div className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">Leave Date Range:</span>
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button
                                variant="outline"
                                className={cn(
                                    "w-[240px] h-9 rounded-xl justify-start text-left font-normal border-slate-200 dark:border-slate-800 bg-transparent text-slate-700 dark:text-slate-200",
                                    !dateFilter ? "text-muted-foreground" : "",
                                    dateFilter && "border-indigo-500/50 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 font-semibold"
                                )}
                                disabled={isLoading}
                            >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {dateFilter?.from ? (
                                    dateFilter.to ? (
                                        <>{format(dateFilter.from, "LLL dd, y")} - {format(dateFilter.to, "LLL dd, y")}</>
                                    ) : (
                                        format(dateFilter.from, "LLL dd, y")
                                    )
                                ) : (
                                    <span>Pick a date range</span>
                                )}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="end">
                            <div className="p-2 border-b flex gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => onDateFilterChange(undefined)}
                                    className="flex-1 text-xs"
                                >
                                    Clear
                                </Button>
                            </div>
                            <Calendar
                                initialFocus
                                mode="range"
                                defaultMonth={dateFilter?.from}
                                selected={dateFilter}
                                onSelect={onDateFilterChange}
                                numberOfMonths={1}
                            />
                        </PopoverContent>
                    </Popover>
                </div>

                {/* Status Selection */}
                <div className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">Status:</span>
                    <Select
                        value={statusFilter}
                        onValueChange={onStatusFilterChange}
                        disabled={isLoading}
                    >
                        <SelectTrigger className={cn(
                            "w-36 h-9 rounded-xl border-slate-200 dark:border-slate-800 transition-colors bg-transparent text-xs",
                            statusFilter !== 'all' && "border-indigo-500/50 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 font-semibold"
                        )}>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All</SelectItem>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="approved">Approved</SelectItem>
                            <SelectItem value="rejected">Rejected</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>
        </div>
    )
}
