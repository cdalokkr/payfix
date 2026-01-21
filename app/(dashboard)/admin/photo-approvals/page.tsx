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

export default function PhotoApprovalsPage() {
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
            <div className="flex items-center justify-center min-h-[400px]">
                <IconLoader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Photo Approvals</h1>
                    <p className="text-muted-foreground">Review and approve employee profile photo updates</p>
                </div>
                <Badge variant="secondary" className="text-sm">
                    {pendingRequests?.length || 0} Pending
                </Badge>
            </div>

            {!pendingRequests?.length ? (
                <Card className="border-dashed">
                    <CardContent className="flex flex-col items-center justify-center py-12">
                        <IconCamera className="w-12 h-12 text-muted-foreground/50 mb-4" />
                        <p className="text-lg font-medium text-muted-foreground">No pending photo requests</p>
                        <p className="text-sm text-muted-foreground/70">All photo update requests have been reviewed</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {pendingRequests.map((request: any) => (
                        <Card key={request.id} className="overflow-hidden">
                            <CardHeader className="pb-3">
                                <div className="flex items-center gap-3">
                                    <Avatar className="h-10 w-10">
                                        <AvatarImage src={request.profile?.avatar_url || ''} />
                                        <AvatarFallback>
                                            {request.profile?.full_name?.[0] || '?'}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className="flex-1 min-w-0">
                                        <CardTitle className="text-sm font-medium truncate">
                                            {request.profile?.full_name || 'Unknown'}
                                        </CardTitle>
                                        <p className="text-xs text-muted-foreground truncate">
                                            {request.profile?.email}
                                        </p>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {/* Photo Comparison */}
                                <div className="flex items-center gap-3">
                                    <div className="text-center flex-1">
                                        <p className="text-[10px] font-bold uppercase text-muted-foreground mb-2">Current</p>
                                        <div className="aspect-square rounded-xl overflow-hidden bg-muted border">
                                            {request.profile?.avatar_url ? (
                                                <img
                                                    src={request.profile.avatar_url}
                                                    alt="Current"
                                                    className="w-full h-full object-cover"
                                                />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center">
                                                    <span className="text-2xl text-muted-foreground">?</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <IconArrowRight className="w-5 h-5 text-muted-foreground shrink-0" />
                                    <div className="text-center flex-1">
                                        <p className="text-[10px] font-bold uppercase text-muted-foreground mb-2">New</p>
                                        <div className="aspect-square rounded-xl overflow-hidden bg-muted border-2 border-primary/30">
                                            <img
                                                src={request.pending_photo_url}
                                                alt="New"
                                                className="w-full h-full object-cover"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <p className="text-xs text-center text-muted-foreground">
                                    Requested {formatDistanceToNow(new Date(request.created_at), { addSuffix: true })}
                                </p>

                                {/* Action Buttons */}
                                <div className="flex gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="flex-1 text-red-600 hover:text-red-600 hover:bg-red-50"
                                        onClick={() => openRejectDialog(request)}
                                        disabled={reviewMutation.isPending}
                                    >
                                        <IconX className="w-4 h-4 mr-1" />
                                        Reject
                                    </Button>
                                    <Button
                                        size="sm"
                                        className="flex-1 bg-green-600 hover:bg-green-700"
                                        onClick={() => handleApprove(request.id)}
                                        disabled={reviewMutation.isPending}
                                    >
                                        {reviewMutation.isPending ? (
                                            <IconLoader2 className="w-4 h-4 mr-1 animate-spin" />
                                        ) : (
                                            <IconCheck className="w-4 h-4 mr-1" />
                                        )}
                                        Approve
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* Reject Dialog */}
            <Dialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Reject Photo Update</DialogTitle>
                        <DialogDescription>
                            Provide a reason for rejecting this photo update. The employee will be notified and can submit a new photo.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <Input
                            placeholder="Reason for rejection (optional)"
                            value={rejectionReason}
                            onChange={(e) => setRejectionReason(e.target.value)}
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsRejectDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleReject}
                            disabled={reviewMutation.isPending}
                        >
                            {reviewMutation.isPending ? (
                                <IconLoader2 className="w-4 h-4 mr-2 animate-spin" />
                            ) : null}
                            Reject Photo
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
