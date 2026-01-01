"use client"

import { Profile } from "@/types"
import { UserAvatarProfile } from "@/components/user-avatar-profile"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

interface ProfileInfoCellProps {
    profile: Profile | any
    showRole?: boolean
    showDesignation?: boolean
    className?: string
}

export function ProfileInfoCell({
    profile,
    showRole = true,
    showDesignation = true,
    className
}: ProfileInfoCellProps) {
    if (!profile) return <span className="text-muted-foreground italic">No Profile</span>

    return (
        <div className={cn("flex items-center gap-2 py-0.5", className)}>
            <UserAvatarProfile
                user={profile}
                className="h-8 w-8 border border-background shadow-sm shrink-0"
            />
            <div className="flex flex-col min-w-0">
                <span className="font-bold text-[13px] leading-tight truncate">
                    {profile.full_name || 'N/A'}
                </span>
                <div className="flex flex-wrap items-center gap-1 mt-0.5">
                    {showDesignation && profile.designation?.name && (
                        <Badge
                            variant="secondary"
                            className="text-[8px] h-3 px-1 font-bold uppercase tracking-wider border-none bg-primary/10 text-primary"
                        >
                            {profile.designation.name}
                        </Badge>
                    )}
                    {showRole && (
                        <span className="text-[9px] text-muted-foreground font-medium truncate max-w-[100px] capitalize">
                            {profile.role || 'employee'}
                        </span>
                    )}
                </div>
            </div>
        </div>
    )
}
