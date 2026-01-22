"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from "@/components/ui/dialog"
import { trpc } from "@/lib/trpc/client"
import { toast } from "sonner"
import {
    IconCheck,
    IconX,
    IconCamera,
    IconLoader2,
    IconArrowRight
} from "@tabler/icons-react"
import { formatDistanceToNow } from "date-fns"
import { DashboardPageLayout } from "@/components/dashboard/dashboard-page-layout"
import { motion, AnimatePresence } from "framer-motion"

export function PhotoApprovalsView() {
    const [selectedRequest, setSelectedRequest] = useState<any>(null)
    const [rejectionReason, setRejectionReason] = useState("")
    const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false)

    const { data: pendingRequests, isLoading, refetch } = trpc.profile.getPendingPhotoRequests.useQuery()
    const reviewMutation = trpc.profile.reviewPhotoRequest.useMutation({
        onSuccess: (data) => {
            toast.success(`Photo ${data.action === 'approve' ? 'approved' : 'rejected'} successfully!`)
            refetch()
            setSelectedRequest(null)
            setIsRejectDialogOpen(false)
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

    const openRejectDialog = (request: any) => {
        setSelectedRequest(request)
        setIsRejectDialogOpen(true)
    }

    if (isLoading) {
        return (
            <DashboardPageLayout
                heading="Photo Approvals"
                description="Review and approve employee profile photo updates"
            >
                <div className="flex items-center justify-center min-h-[400px]">
                    <div className="flex flex-col items-center gap-4">
                        <IconLoader2 className="w-10 h-10 animate-spin text-primary" />
                        <p className="text-muted-foreground animate-pulse">Loading requests...</p>
                    </div>
                </div>
            </DashboardPageLayout>
        )
    }

    return (
        <DashboardPageLayout
            heading="Photo Approvals"
            description="Review and approve employee profile photo updates"
            headerAction={
                <Badge variant="outline" className="px-3 py-1 bg-primary/5 text-primary border-primary/20">
                    {pendingRequests?.length || 0} Pending Requests
                </Badge>
            }
        >
            <AnimatePresence mode="wait">
                {!pendingRequests?.length ? (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                    >
                        <Card className="border-dashed bg-muted/30">
                            <CardContent className="flex flex-col items-center justify-center py-20">
                                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                                    <IconCamera className="w-8 h-8 text-muted-foreground/50" />
                                </div>
                                <p className="text-xl font-semibold text-muted-foreground">All caught up!</p>
                                <p className="text-sm text-muted-foreground/60 max-w-[250px] text-center mt-2">
                                    There are no pending photo update requests at the moment.
                                </p>
                            </CardContent>
                        </Card>
                    </motion.div>
                ) : (
                    <motion.div
                        className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
                        initial="hidden"
                        animate="show"
                        variants={{
                            hidden: { opacity: 0 },
                            show: {
                                opacity: 1,
                                transition: {
                                    staggerChildren: 0.05
                                }
                            }
                        }}
                    >
                        {pendingRequests.map((request: any) => (
                            <motion.div
                                key={request.id}
                                variants={{
                                    hidden: { opacity: 0, y: 20 },
                                    show: { opacity: 1, y: 0 }
                                }}
                            >
                                <Card className="overflow-hidden h-full flex flex-col hover:shadow-xl transition-all duration-300 border-primary/10 group">
                                    <CardHeader className="pb-4 border-b bg-muted/20">
                                        <div className="flex items-center gap-3">
                                            <Avatar className="h-10 w-10 ring-2 ring-background shadow-sm">
                                                <AvatarImage src={request.profile?.avatar_url || ''} />
                                                <AvatarFallback className="bg-primary/10 text-primary font-bold">
                                                    {request.profile?.full_name?.[0] || '?'}
                                                </AvatarFallback>
                                            </Avatar>
                                            <div className="flex-1 min-w-0">
                                                <CardTitle className="text-sm font-bold truncate">
                                                    {request.profile?.full_name || 'Unknown'}
                                                </CardTitle>
                                                <p className="text-[11px] text-muted-foreground truncate font-medium">
                                                    {request.profile?.email}
                                                </p>
                                            </div>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="p-5 flex-1 flex flex-col space-y-5">
                                        {/* Photo Comparison */}
                                        <div className="flex items-center justify-between gap-4">
                                            <div className="flex-1 text-center">
                                                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 mb-2">Original</p>
                                                <div className="aspect-square rounded-2xl overflow-hidden bg-muted border-2 border-muted shadow-inner relative group-hover:scale-[1.02] transition-transform duration-300">
                                                    {request.profile?.avatar_url ? (
                                                        <img
                                                            src={request.profile.avatar_url}
                                                            alt="Current"
                                                            className="w-full h-full object-cover"
                                                        />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center">
                                                            <span className="text-2xl text-muted-foreground/30 font-bold">N/A</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="flex flex-col items-center justify-center gap-1">
                                                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                                                    <IconArrowRight className="w-5 h-5 text-primary" />
                                                </div>
                                            </div>

                                            <div className="flex-1 text-center">
                                                <p className="text-[10px] font-bold uppercase tracking-wider text-primary/70 mb-2">Updated</p>
                                                <div className="aspect-square rounded-2xl overflow-hidden bg-primary/5 border-2 border-primary/30 shadow-md relative group-hover:scale-[1.05] transition-transform duration-300">
                                                    <img
                                                        src={request.pending_photo_url}
                                                        alt="New"
                                                        className="w-full h-full object-cover"
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        <div className="bg-muted/30 rounded-lg p-3 text-center">
                                            <p className="text-[11px] text-muted-foreground flex items-center justify-center gap-1.5">
                                                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                                                Requested {formatDistanceToNow(new Date(request.created_at), { addSuffix: true })}
                                            </p>
                                        </div>

                                        {/* Action Buttons */}
                                        <div className="flex gap-3 pt-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="flex-1 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 hover:border-red-300 font-semibold"
                                                onClick={() => openRejectDialog(request)}
                                                disabled={reviewMutation.isPending}
                                            >
                                                <IconX className="w-4 h-4 mr-1.5" />
                                                Reject
                                            </Button>
                                            <Button
                                                size="sm"
                                                className="flex-1 bg-green-600 hover:bg-green-700 shadow-md shadow-green-600/20 font-semibold"
                                                onClick={() => handleApprove(request.id)}
                                                disabled={reviewMutation.isPending}
                                            >
                                                {reviewMutation.isPending ? (
                                                    <IconLoader2 className="w-4 h-4 mr-1.5 animate-spin" />
                                                ) : (
                                                    <IconCheck className="w-4 h-4 mr-1.5" />
                                                )}
                                                Approve
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            </motion.div>
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Reject Dialog */}
            <Dialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-red-600">
                            <IconX className="w-5 h-5" />
                            Reject Photo Update
                        </DialogTitle>
                        <DialogDescription className="pt-2">
                            Please provide a reason for rejecting <strong>{selectedRequest?.profile?.full_name}</strong>'s photo update.
                            The employee will be notified and can submit a new photo.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-6">
                        <Input
                            placeholder="e.g., Photo is too blurry or not professional"
                            value={rejectionReason}
                            onChange={(e) => setRejectionReason(e.target.value)}
                            className="focus-visible:ring-red-500"
                        />
                    </div>
                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button variant="ghost" onClick={() => setIsRejectDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleReject}
                            disabled={reviewMutation.isPending || !rejectionReason.trim()}
                            className="bg-red-600 hover:bg-red-700"
                        >
                            {reviewMutation.isPending ? (
                                <IconLoader2 className="w-4 h-4 mr-2 animate-spin" />
                            ) : null}
                            Reject Photo
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </DashboardPageLayout>
    )
}
