"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { trpc } from "@/lib/trpc/client"
import { format } from "date-fns"
import { Check, X, Search, Plane, MessageSquare, Loader2, Calendar, Clock, CheckCircle2, XCircle } from "lucide-react"
import { toast } from "sonner"
import { ModernDialog, ModernDialogContent, ModernDialogHeader, ModernDialogTitle, ModernDialogDescription } from "@/components/ui/modern-dialog"
import { Label } from "@/components/ui/label"
import { MetricCard } from "@/components/dashboard/metric-card"
import { Textarea } from "@/components/ui/textarea"

export function AdminLeaveApproval() {
    const [searchTerm, setSearchTerm] = useState("")
    const [isRejectOpen, setIsRejectOpen] = useState(false)
    const [rejectionReason, setRejectionReason] = useState("")
    const [isApproveOpen, setIsApproveOpen] = useState(false)
    const [selectedLeave, setSelectedLeave] = useState<any>(null)

    const utils = trpc.useUtils()
    const { data: leaves, isLoading } = trpc.attendance.getLeaves.useQuery({ status: 'all' })

    const updateStatusMutation = trpc.attendance.approveLeave.useMutation({
        onSuccess: (data) => {
            toast.success(`Leave ${data.status} successfully`)
            setIsRejectOpen(false)
            setIsApproveOpen(false)
            setRejectionReason("")
            setSelectedLeave(null)
            utils.attendance.getLeaves.invalidate()
        },
        onError: (error) => toast.error(error.message)
    })

    const filteredLeaves = leaves?.filter(leave =>
        leave.profile?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        leave.profile?.email?.toLowerCase().includes(searchTerm.toLowerCase())
    )

    const handleApproveClick = (leave: any) => {
        setSelectedLeave(leave)
        setIsApproveOpen(true)
    }

    const handleRejectClick = (leave: any) => {
        setSelectedLeave(leave)
        setIsRejectOpen(true)
    }

    const stats = {
        total: filteredLeaves?.length || 0,
        pending: filteredLeaves?.filter(l => l.status === 'pending').length || 0,
        approved: filteredLeaves?.filter(l => l.status === 'approved').length || 0,
        rejected: filteredLeaves?.filter(l => l.status === 'rejected').length || 0,
    }

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard
                    title="Total Requests"
                    value={stats.total.toString()}
                    icon={<Plane />}
                    iconBgColor="bg-blue-500/20"
                    iconColor="text-blue-700 dark:text-blue-400"
                    borderColor="border-blue-200/50 dark:border-blue-900/50"
                    cardBgColor="bg-blue-50/50 dark:bg-blue-900/5"
                    delay={0.1}
                />
                <MetricCard
                    title="Pending"
                    value={stats.pending.toString()}
                    icon={<Clock />}
                    iconBgColor="bg-amber-500/20"
                    iconColor="text-amber-700 dark:text-amber-400"
                    borderColor="border-amber-200/50 dark:border-amber-900/50"
                    cardBgColor="bg-amber-50/50 dark:bg-amber-900/5"
                    delay={0.2}
                />
                <MetricCard
                    title="Approved"
                    value={stats.approved.toString()}
                    icon={<CheckCircle2 />}
                    iconBgColor="bg-emerald-500/20"
                    iconColor="text-emerald-700 dark:text-emerald-400"
                    borderColor="border-emerald-200/50 dark:border-emerald-900/50"
                    cardBgColor="bg-emerald-50/50 dark:bg-emerald-900/5"
                    delay={0.3}
                />
                <MetricCard
                    title="Rejected"
                    value={stats.rejected.toString()}
                    icon={<XCircle />}
                    iconBgColor="bg-rose-500/20"
                    iconColor="text-rose-700 dark:text-rose-400"
                    borderColor="border-rose-200/50 dark:border-rose-900/50"
                    cardBgColor="bg-rose-50/50 dark:bg-rose-900/5"
                    delay={0.4}
                />
            </div>

            <Card className="border-none shadow-md overflow-hidden bg-card/50 backdrop-blur-sm">
                <CardHeader className="bg-muted/30 pb-6 border-b">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <CardTitle className="text-xl font-bold">Leave Management</CardTitle>
                            <CardDescription>Review and manage employee leave requests</CardDescription>
                        </div>
                        <div className="relative w-full md:w-72">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search employee..."
                                className="pl-10 h-10 bg-background/50 border-muted-foreground/20 focus:border-primary transition-all"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Employee</TableHead>
                                    <TableHead>Type</TableHead>
                                    <TableHead>Start Date</TableHead>
                                    <TableHead>End Date</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Reason</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredLeaves?.map((leave) => (
                                    <TableRow key={leave.id}>
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span className="font-medium">{leave.profile?.full_name || 'N/A'}</span>
                                                <span className="text-xs text-muted-foreground">{leave.profile?.email}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                {leave.leave_type || 'N/A'}
                                                {leave.is_half_day && (
                                                    <Badge variant="outline" className="text-[10px] h-4 bg-primary/5 border-primary/20 text-primary">
                                                        Half Day ({leave.half_day_period})
                                                    </Badge>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell>{format(new Date(leave.start_date), 'MMM dd, yyyy')}</TableCell>
                                        <TableCell>{format(new Date(leave.endDate), 'MMM dd, yyyy')}</TableCell>
                                        <TableCell>
                                            <Badge variant={
                                                leave.status === 'approved' ? 'success' as any :
                                                    leave.status === 'rejected' ? 'destructive' : 'secondary'
                                            }>
                                                {leave.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="max-w-[200px] truncate">{leave.reason}</TableCell>
                                        <TableCell className="text-right">
                                            {leave.status === 'pending' && (
                                                <div className="flex justify-end gap-2">
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        className="text-green-600 hover:text-green-700 hover:bg-green-50"
                                                        onClick={() => handleApproveClick(leave)}
                                                    >
                                                        <Check className="h-4 w-4 mr-1" /> Approve
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                                        onClick={() => handleRejectClick(leave)}
                                                    >
                                                        <X className="h-4 w-4 mr-1" /> Reject
                                                    </Button>
                                                </div>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {(!filteredLeaves || filteredLeaves.length === 0) && (
                                    <TableRow>
                                        <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                                            No leave requests found.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            {/* Approve Leave Dialog */}
            <ModernDialog open={isApproveOpen} onOpenChange={setIsApproveOpen}>
                <ModernDialogContent size="sm">
                    <ModernDialogHeader>
                        <ModernDialogTitle>Approve Leave Request</ModernDialogTitle>
                        <ModernDialogDescription>Are you sure you want to approve this leave request?</ModernDialogDescription>
                    </ModernDialogHeader>
                    <div className="flex justify-end gap-3 pt-6 border-t mt-6">
                        <Button variant="ghost" onClick={() => setIsApproveOpen(false)}>Cancel</Button>
                        <Button
                            onClick={() => {
                                if (selectedLeave) {
                                    updateStatusMutation.mutate({ id: selectedLeave.id, status: 'approved', remarks: "" })
                                }
                            }}
                            disabled={updateStatusMutation.isPending}
                            className="px-6 font-bold shadow-lg shadow-green-500/10 transition-all hover:scale-105"
                        >
                            {updateStatusMutation.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
                            Confirm Approval
                        </Button>
                    </div>
                </ModernDialogContent>
            </ModernDialog>

            {/* Rejection Reason Dialog */}
            <ModernDialog open={isRejectOpen} onOpenChange={setIsRejectOpen}>
                <ModernDialogContent size="md">
                    <ModernDialogHeader>
                        <ModernDialogTitle>Reject Leave Request</ModernDialogTitle>
                        <ModernDialogDescription>Please provide a reason for rejecting this leave request.</ModernDialogDescription>
                    </ModernDialogHeader>
                    <div className="space-y-4 pt-4">
                        <Textarea
                            placeholder="Reason for rejection..."
                            value={rejectionReason}
                            onChange={(e) => setRejectionReason(e.target.value)}
                            rows={4}
                            className="bg-background resize-none"
                        />
                        <div className="flex justify-end gap-3 pt-6 border-t mt-6">
                            <Button variant="ghost" onClick={() => setIsRejectOpen(false)}>Cancel</Button>
                            <Button
                                variant="destructive"
                                onClick={() => {
                                    if (selectedLeave) {
                                        updateStatusMutation.mutate({ id: selectedLeave.id, status: 'rejected', remarks: rejectionReason })
                                    }
                                }}
                                disabled={!rejectionReason || updateStatusMutation.isPending}
                                className="px-6 font-bold shadow-lg shadow-rose-500/10 transition-all hover:scale-105"
                            >
                                {updateStatusMutation.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
                                Confirm Rejection
                            </Button>
                        </div>
                    </div>
                </ModernDialogContent>
            </ModernDialog>
        </div>
    )
}
