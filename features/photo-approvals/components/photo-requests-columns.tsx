"use client"

import { ColumnDef } from "@tanstack/react-table"
import { Badge } from "@/components/ui/badge"
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header"
import { formatDistanceToNow } from "date-fns"
import { UserAvatarProfile } from "@/components/user-avatar-profile"
import { Button } from "@/components/ui/button"
import { IconEye, IconCheck, IconX } from "@tabler/icons-react"
import { cn } from "@/lib/utils"

export interface PhotoRequest {
    id: string
    profile_id: string
    pending_photo_url: string
    status: string
    reviewed_by: string | null
    reviewed_at: string | Date | null
    rejection_reason: string | null
    created_at: string | Date | null
    profile: {
        id: string
        full_name: string | null
        email: string
        avatar_url: string | null
        sex: string | null
    }
    reviewer: {
        id: string
        full_name: string | null
        email: string
    } | null
}

export function createPhotoRequestColumns(
    onReview: (request: PhotoRequest) => void
): ColumnDef<PhotoRequest>[] {
    return [
        {
            accessorKey: "profile.full_name",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Employee" />
            ),
            cell: ({ row }) => {
                const request = row.original
                return (
                    <div className="flex items-center gap-3">
                        <UserAvatarProfile
                            user={request.profile as any}
                            className="h-9 w-9 ring-2 ring-background shadow-sm"
                        />
                        <div className="flex flex-col">
                            <span className="font-bold text-sm tracking-tight text-foreground/90">
                                {request.profile.full_name || "Unknown"}
                            </span>
                            <span className="text-[11px] text-muted-foreground font-medium">
                                {request.profile.email}
                            </span>
                        </div>
                    </div>
                )
            },
        },
        {
            accessorKey: "status",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Status" />
            ),
            cell: ({ row }) => {
                const status = row.getValue("status") as string
                return (
                    <Badge
                        variant="outline"
                        className={cn(
                            "px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                            status === "pending" && "bg-amber-500/10 text-amber-600 border-amber-500/20",
                            status === "approved" && "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
                            status === "rejected" && "bg-rose-500/10 text-rose-600 border-rose-500/20"
                        )}
                    >
                        {status}
                    </Badge>
                )
            },
        },
        {
            accessorKey: "created_at",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Requested" />
            ),
            cell: ({ row }) => {
                const date = row.getValue("created_at") as string | Date | null
                if (!date) return <span className="text-[10px] font-bold text-muted-foreground/40 uppercase tracking-widest italic">—</span>
                return (
                    <div className="text-xs font-medium text-muted-foreground whitespace-nowrap">
                        {formatDistanceToNow(new Date(date), { addSuffix: true })}
                    </div>
                )
            },
        },
        {
            accessorKey: "reviewer.full_name",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Reviewed By" />
            ),
            cell: ({ row }) => {
                const reviewer = row.original.reviewer
                if (!reviewer) return <span className="text-[10px] font-bold text-muted-foreground/40 uppercase tracking-widest italic">—</span>
                return (
                    <div className="flex flex-col">
                        <span className="text-xs font-semibold text-foreground/80">{reviewer.full_name || "Unknown"}</span>
                        <span className="text-[10px] text-muted-foreground">{reviewer.email}</span>
                    </div>
                )
            },
        },
        {
            id: "actions",
            cell: ({ row }) => {
                const request = row.original
                return (
                    <div className="flex justify-end">
                        <Button
                            variant="ghost"
                            size="sm"
                            className={cn(
                                "h-8 gap-1.5 font-bold text-[11px] uppercase tracking-wider",
                                request.status === "pending"
                                    ? "text-primary hover:bg-primary/10"
                                    : "text-muted-foreground hover:bg-muted"
                            )}
                            onClick={() => onReview(request)}
                        >
                            <IconEye className="h-3.5 w-3.5" />
                            {request.status === "pending" ? "Review" : "View"}
                        </Button>
                    </div>
                )
            },
        },
    ]
}
