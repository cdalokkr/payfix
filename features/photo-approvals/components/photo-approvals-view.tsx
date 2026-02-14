"use client"

import { useState, useMemo } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetFooter,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet"
import { trpc } from "@/lib/trpc/client"
import { toast } from "sonner"
import {
    Check as IconCheck,
    X as IconX,
    Loader2 as IconLoader2,
    ArrowRight as IconArrowRight,
    ScanFace as IconScan,
    Clock as IconClock,
    CheckCircle2 as IconCircleCheck,
    XCircle as IconCircleX,
    RefreshCw as IconRefresh
} from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { DashboardPageLayout } from "@/components/dashboard/dashboard-page-layout"
import { CompactMetricCard } from "@/components/dashboard/compact-metric-card"
import { DataTable } from "@/components/ui/data-table"
import { createPhotoRequestColumns, PhotoRequest } from "./photo-requests-columns"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"

export function PhotoApprovalsView() {
    const [selectedRequest, setSelectedRequest] = useState<PhotoRequest | null>(null)
    const [rejectionReason, setRejectionReason] = useState("")
    const [isSheetOpen, setIsSheetOpen] = useState(false)

    const utils = trpc.useUtils()

    const { data: requests = [], isLoading: isTableLoading } = trpc.profile.getAllPhotoRequests.useQuery()
    const { data: stats, isLoading: isStatsLoading } = trpc.profile.getPhotoRequestStats.useQuery()

    const reviewMutation = trpc.profile.reviewPhotoRequest.useMutation({
        onSuccess: (data) => {
            toast.success(`Photo ${data.action === 'approve' ? 'approved' : 'rejected'} successfully!`)
            utils.profile.getAllPhotoRequests.invalidate()
            utils.profile.getPhotoRequestStats.invalidate()
            setIsSheetOpen(false)
            setSelectedRequest(null)
            setRejectionReason("")
        },
        onError: (error) => {
            toast.error(error.message)
        }
    })

    const handleApprove = (requestId: string) => {
        reviewMutation.mutate({ requestId, action: 'approve' })
    }

    const handleReject = () => {
        if (!selectedRequest) return
        reviewMutation.mutate({
            requestId: selectedRequest.id,
            action: 'reject',
            rejectionReason: rejectionReason || 'Photo not suitable'
        })
    }

    const handleReview = (request: PhotoRequest) => {
        setSelectedRequest(request)
        setIsSheetOpen(true)
    }

    const columns = useMemo(() => createPhotoRequestColumns(handleReview), [])

    return (
        <DashboardPageLayout
            heading="Photo Approvals"
            description="Manage and review employee profile photo update requests"
        >
            <div className="space-y-8">
                {/* Stats Grid */}
                <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
                    <CompactMetricCard
                        label="Pending"
                        value={stats?.pending || 0}
                        theme="amber"
                        icon={IconClock}
                        loading={isStatsLoading}
                        delay={0.1}
                    />
                    <CompactMetricCard
                        label="Approved"
                        value={stats?.approved || 0}
                        theme="emerald"
                        icon={IconCircleCheck}
                        loading={isStatsLoading}
                        delay={0.2}
                    />
                    <CompactMetricCard
                        label="Rejected"
                        value={stats?.rejected || 0}
                        theme="rose"
                        icon={IconCircleX}
                        loading={isStatsLoading}
                        delay={0.3}
                    />
                    <CompactMetricCard
                        label="Total History"
                        value={stats?.total || 0}
                        theme="primary"
                        icon={IconRefresh}
                        loading={isStatsLoading}
                        delay={0.4}
                    />
                </div>

                {/* Main Table */}
                <Card className="border-none shadow-xl bg-background/50 backdrop-blur-sm overflow-hidden ring-1 ring-primary/5">
                    <div className="p-6">
                        <DataTable
                            columns={columns}
                            data={requests}
                            isLoading={isTableLoading}
                            emptyMessage="No photo requests found in history"
                        />
                    </div>
                </Card>
            </div>

            {/* Review Sheet */}
            <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
                <SheetContent className="sm:max-w-md flex flex-col h-full bg-background/95 backdrop-blur-xl border-l border-primary/10">
                    <SheetHeader className="pb-6 border-b border-primary/5">
                        <SheetTitle className="flex items-center gap-2.5 text-xl font-black tracking-tight">
                            <IconScan className="w-6 h-6 text-primary" />
                            Review Photo Update
                        </SheetTitle>
                        <SheetDescription className="font-medium text-muted-foreground/80 pt-1">
                            Review the profile photo update request for <strong>{selectedRequest?.profile?.full_name}</strong>.
                        </SheetDescription>
                    </SheetHeader>

                    {selectedRequest && (
                        <div className="flex-1 overflow-y-auto py-8 space-y-10 custom-scrollbar">
                            {/* Employee Info Header */}
                            <div className="flex items-center gap-4 p-4 rounded-2xl bg-primary/5 border border-primary/10 mx-auto w-full max-w-[90%]">
                                <Avatar className="h-12 w-12 ring-2 ring-white shadow-md">
                                    <AvatarImage src={selectedRequest.profile.avatar_url || ""} />
                                    <AvatarFallback className="bg-primary/10 text-primary font-black uppercase">
                                        {selectedRequest.profile.full_name?.[0]}
                                    </AvatarFallback>
                                </Avatar>
                                <div className="flex flex-col">
                                    <h4 className="font-black text-sm tracking-tight">{selectedRequest.profile.full_name}</h4>
                                    <p className="text-[11px] font-bold text-muted-foreground/80 uppercase tracking-widest leading-none mt-0.5">
                                        {selectedRequest.profile.email}
                                    </p>
                                </div>
                            </div>

                            {/* Comparison View */}
                            <div className="space-y-8">
                                <div className="grid grid-cols-1 gap-10">
                                    {/* Original Photo */}
                                    <div className="space-y-3 px-6">
                                        <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/50">
                                            <span>Original Photo</span>
                                            <Badge variant="outline" className="text-[9px] font-black h-4 px-1 border-muted-foreground/20">Current</Badge>
                                        </div>
                                        <div className="aspect-square w-full max-w-[200px] mx-auto rounded-[2rem] overflow-hidden bg-muted border-4 border-white shadow-2xl relative ring-1 ring-black/5">
                                            {selectedRequest.profile.avatar_url ? (
                                                <img
                                                    src={selectedRequest.profile.avatar_url}
                                                    alt="Current"
                                                    className="w-full h-full object-cover"
                                                />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center bg-muted/50">
                                                    <span className="text-3xl font-black text-muted-foreground/20 italic">NULL</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Directional Icon */}
                                    <div className="flex items-center justify-center p-2 opacity-50">
                                        <div className="h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent flex-1" />
                                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mx-4 shadow-inner ring-1 ring-primary/20">
                                            <IconArrowRight className="w-6 h-6 text-primary animate-pulse-slow" />
                                        </div>
                                        <div className="h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent flex-1" />
                                    </div>

                                    {/* Requested Photo */}
                                    <div className="space-y-3 px-6">
                                        <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-[0.2em] text-primary">
                                            <span>Requested Photo</span>
                                            <Badge className="text-[9px] font-black h-4 px-1 bg-primary text-primary-foreground shadow-lg shadow-primary/20">Pending</Badge>
                                        </div>
                                        <div className="aspect-square w-full max-w-[240px] mx-auto rounded-[2.5rem] overflow-hidden bg-primary/5 border-4 border-white shadow-2xl relative ring-2 ring-primary/20">
                                            <img
                                                src={selectedRequest.pending_photo_url}
                                                alt="New"
                                                className="w-full h-full object-cover"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Request Metadata */}
                                <div className="px-6">
                                    <div className="p-4 rounded-xl bg-muted/30 border border-muted-foreground/5 text-center">
                                        <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest flex items-center justify-center gap-2">
                                            <IconClock size={12} className="text-amber-500" />
                                            Requested {selectedRequest.created_at ? formatDistanceToNow(new Date(selectedRequest.created_at), { addSuffix: true }) : 'Unknown'}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Input for Rejection */}
                            {selectedRequest.status === 'pending' && (
                                <div className="px-6 space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground pl-1">
                                        Feedback or Rejection Reason
                                    </label>
                                    <Input
                                        placeholder="Add a reason for rejection..."
                                        value={rejectionReason}
                                        onChange={(e) => setRejectionReason(e.target.value)}
                                        className="h-10 text-sm bg-muted/20 border-primary/10 focus-visible:ring-primary/30 rounded-lg font-medium"
                                    />
                                </div>
                            )}

                            {/* Review History Indicator */}
                            {selectedRequest.status !== 'pending' && (
                                <div className="px-6">
                                    <div className={cn(
                                        "p-5 rounded-2xl border flex flex-col gap-2 items-center text-center shadow-inner",
                                        selectedRequest.status === 'approved' ? "bg-emerald-50/50 border-emerald-100/50" : "bg-rose-50/50 border-rose-100/50"
                                    )}>
                                        <div className={cn(
                                            "w-10 h-10 rounded-full flex items-center justify-center mb-1",
                                            selectedRequest.status === 'approved' ? "bg-emerald-500 text-white" : "bg-rose-500 text-white"
                                        )}>
                                            {selectedRequest.status === 'approved' ? <IconCheck size={20} /> : <IconX size={20} />}
                                        </div>
                                        <h5 className={cn(
                                            "font-black text-xs uppercase tracking-widest",
                                            selectedRequest.status === 'approved' ? "text-emerald-700" : "text-rose-700"
                                        )}>
                                            Successfully {selectedRequest.status}
                                        </h5>
                                        {selectedRequest.rejection_reason && (
                                            <p className="text-[11px] font-medium text-rose-800/60 max-w-[200px]">
                                                "{selectedRequest.rejection_reason}"
                                            </p>
                                        )}
                                        <div className="h-px w-full bg-black/5 my-1" />
                                        <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-tighter">
                                            Reviewed by {selectedRequest.reviewer?.full_name}
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    <SheetFooter className="mt-auto pt-6 border-t border-primary/5 px-0 pb-2">
                        {selectedRequest?.status === 'pending' ? (
                            <div className="grid grid-cols-2 gap-3 w-full">
                                <Button
                                    variant="outline"
                                    className="h-12 border-rose-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700 font-bold uppercase tracking-widest text-[10px] rounded-xl transition-all"
                                    onClick={handleReject}
                                    disabled={reviewMutation.isPending || !rejectionReason.trim()}
                                >
                                    {reviewMutation.isPending && reviewMutation.variables?.action === 'reject' ? (
                                        <IconLoader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <IconX className="w-4 h-4 mr-1.5" />
                                    )}
                                    Reject
                                </Button>
                                <Button
                                    className="h-12 bg-emerald-600 hover:bg-emerald-700 text-white shadow-xl shadow-emerald-600/20 font-bold uppercase tracking-widest text-[10px] rounded-xl transition-all"
                                    onClick={() => handleApprove(selectedRequest.id)}
                                    disabled={reviewMutation.isPending}
                                >
                                    {reviewMutation.isPending && reviewMutation.variables?.action === 'approve' ? (
                                        <IconLoader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <IconCheck className="w-4 h-4 mr-1.5" />
                                    )}
                                    Approve
                                </Button>
                            </div>
                        ) : (
                            <Button
                                variant="outline"
                                className="w-full h-12 font-bold uppercase tracking-widest text-[10px] text-muted-foreground hover:text-foreground rounded-xl"
                                onClick={() => setIsSheetOpen(false)}
                            >
                                Close View
                            </Button>
                        )}
                    </SheetFooter>
                </SheetContent>
            </Sheet>
        </DashboardPageLayout>
    )
}
