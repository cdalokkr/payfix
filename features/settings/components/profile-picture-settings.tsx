"use client"

import { Profile } from "@/types"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ActionButton } from "@/components/ui/action-button"
import { UserAvatarProfile } from "@/components/user-avatar-profile"
import { Camera } from "lucide-react"
import { useRouter } from "next/navigation"
import { getDefaultAvatarUrl } from "@/lib/utils/avatar-helper"

interface ProfilePictureSettingsProps {
    user: Profile
}

export function ProfilePictureSettings({ user }: ProfilePictureSettingsProps) {
    const router = useRouter()
    const avatarUrl = user.avatar_url || getDefaultAvatarUrl(user.sex)

    const openLiveEnrollment = () => {
        router.push('/mobile/update-photo')
    }

    return (
        <Card className="relative overflow-hidden border-2 border-border/60 hover:border-primary/30 transition-all duration-300 w-full">
            <div className="absolute inset-0 bg-gradient-to-br from-accent/5 via-transparent to-primary/5 pointer-events-none" />
            <CardHeader className="relative">
                <CardTitle className="text-lg">Profile Picture</CardTitle>
                <CardDescription>
                    Use a live camera capture for attendance verification
                </CardDescription>
            </CardHeader>
            <CardContent className="relative flex flex-col items-center gap-6">
                <div className="rounded-lg border border-border p-4">
                    <UserAvatarProfile
                        user={{ ...user, avatar_url: avatarUrl }}
                        className="h-32 w-32 border-4 border-background"
                        placeholderBlur={12}
                        placeholderScale={1.08}
                        fadeDurationMs={350}
                    />
                </div>
                <div className="flex w-full max-w-xs flex-col gap-3">
                    <ActionButton
                        action="dashboard-blue"
                        size="lg"
                        className="w-full"
                        onClick={openLiveEnrollment}
                        icon={Camera}
                    >
                        Open Live Camera
                    </ActionButton>
                    <p className="text-center text-xs text-muted-foreground">
                        Three natural frames, server liveness validation, and admin approval are required.
                    </p>
                </div>
            </CardContent>
        </Card>
    )
}
