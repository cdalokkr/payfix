"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { UserAvatar } from "@/components/user-avatar"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { LogoutModal } from "@/components/ui/logout-modal"
import { trpc } from "@/lib/trpc/client"
import {
    Bell as IconBell,
    MoreVertical as IconDotsVertical,
    User as IconUser,
    Lock as IconLock,
    LogOut as IconLogout,
    Clock as IconClock,
    AlertTriangle as IconAlertTriangle
} from "lucide-react"

import { ProfilePhotoCapture } from "@/features/mobile/profile-photo-capture"

interface MobileHeaderProps {
    profile: {
        id: string
        full_name: string | null
        avatar_url: string | null
        email: string
    }
}

export function MobileHeader({ profile }: MobileHeaderProps) {
    const router = useRouter()
    const utils = trpc.useUtils()
    const [isConfirmOpen, setIsConfirmOpen] = useState(false)
    const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false)
    const [isPendingDialogOpen, setIsPendingDialogOpen] = useState(false)
    const [isPhotoCaptureOpen, setIsPhotoCaptureOpen] = useState(false)

    // Dynamically bind to active user profile query so switching accounts always shows correct identity
    const { data: dynamicProfile } = trpc.profile.get.useQuery(undefined, {
        initialData: profile as any,
        staleTime: 60000,
    })
    const activeProfile = dynamicProfile || profile

    // Query for pending photo request
    const { data: pendingRequest } = trpc.profile.getMyPendingPhotoRequest.useQuery()

    const getInitials = () => {
        if (activeProfile.full_name) {
            return activeProfile.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
        }
        return (activeProfile.email || 'U')[0].toUpperCase()
    }

    const firstName = activeProfile.full_name?.split(' ')[0] || 'User'

    // Handle avatar click - open popup dialog modal directly without page reload or navigation
    const handleAvatarClick = () => {
        if (pendingRequest) {
            setIsPendingDialogOpen(true)
        } else {
            setIsPhotoCaptureOpen(true)
        }
    }


    return (
        <>
            {/* Glass-morphism sticky header */}
            <header className="fixed top-0 left-0 right-0 z-50">
                {/* Blur background */}
                <div className="absolute inset-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200/50 dark:border-slate-700/50" />

                {/* Status bar spacer for PWA */}
                <div className="h-[env(safe-area-inset-top)] bg-transparent" />

                {/* Header content */}
                <div className="relative max-w-md mx-auto px-4 h-14 flex items-center justify-between">
                    {/* Left: Avatar & Greeting - check pending before photo update */}
                    <button onClick={handleAvatarClick} className="flex items-center gap-3 group text-left cursor-pointer">
                        <div className="relative">
                            <div className="h-9 w-9 rounded-full ring-2 ring-primary/20 group-hover:ring-primary/40 transition-all overflow-hidden">
                                <UserAvatar src={activeProfile.avatar_url} alt={activeProfile.full_name || ''} initials={getInitials()} className="h-9 w-9" />
                            </div>
                            {/* Pending indicator if request exists */}
                            {pendingRequest ? (
                                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-amber-500 rounded-full ring-2 ring-white dark:ring-slate-900 animate-pulse" />
                            ) : (
                                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full ring-2 ring-white dark:ring-slate-900" />
                            )}
                        </div>
                        <div className="flex flex-col">
                            <span className="text-xs text-muted-foreground leading-none">Welcome back</span>
                            <span className="text-sm font-semibold text-foreground leading-tight">{firstName}</span>
                        </div>
                    </button>

                    {/* Right: Actions */}
                    <div className="flex items-center gap-1">
                        {/* Notifications */}
                        <Button
                            variant="ghost"
                            size="icon"
                            className="relative h-9 w-9 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                            <IconBell className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                            {/* Notification badge */}
                            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
                        </Button>

                        {/* Menu Popover */}
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-9 w-9 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
                                >
                                    <IconDotsVertical className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48 rounded-xl">
                                <DropdownMenuItem
                                    onClick={() => router.push('/mobile/profile')}
                                    className="cursor-pointer"
                                >
                                    <IconUser className="w-4 h-4 mr-2" />
                                    Update Profile
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    onClick={() => router.push('/mobile/change-password')}
                                    className="cursor-pointer"
                                >
                                    <IconLock className="w-4 h-4 mr-2" />
                                    Change Password
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                    onClick={() => setIsConfirmOpen(true)}
                                    className="cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-950/30"
                                >
                                    <IconLogout className="w-4 h-4 mr-2" />
                                    Sign Out
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>
            </header>

            {/* Pending Photo Warning Dialog */}
            <Dialog open={isPendingDialogOpen} onOpenChange={setIsPendingDialogOpen}>
                <DialogContent className="max-w-xs mx-auto rounded-3xl">
                    <DialogHeader className="text-center">
                        <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                            <IconClock className="w-8 h-8 text-amber-600" />
                        </div>
                        <DialogTitle>Photo Update Pending</DialogTitle>
                        <DialogDescription className="text-center">
                            Your previous photo update request is still awaiting admin approval. You cannot submit a new photo until it's reviewed.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="sm:justify-center">
                        <Button
                            onClick={() => setIsPendingDialogOpen(false)}
                            className="w-full rounded-xl"
                        >
                            Got it
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Confirmation Dialog */}
            <Dialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
                <DialogContent className="max-w-xs mx-auto rounded-3xl">
                    <DialogHeader>
                        <DialogTitle>Sign Out?</DialogTitle>
                        <DialogDescription>
                            You will need to sign in again to access your account.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="flex-row gap-3 sm:gap-3">
                        <Button
                            variant="outline"
                            onClick={() => setIsConfirmOpen(false)}
                            className="flex-1 rounded-xl"
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={() => {
                                setIsConfirmOpen(false)
                                setIsLogoutModalOpen(true)
                            }}
                            className="flex-1 rounded-xl"
                        >
                            Sign Out
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Logout Progress Modal */}
            <LogoutModal
                isOpen={isLogoutModalOpen}
                onOpenChange={setIsLogoutModalOpen}
            />

            {/* Seamless Profile Selfie Capture Popup Modal (Zero Page Reload / Refresh) */}
            <Dialog open={isPhotoCaptureOpen} onOpenChange={(open) => !open && setIsPhotoCaptureOpen(false)}>
                <DialogContent className="max-w-md w-[95vw] p-0 bg-slate-950 border-slate-800 text-slate-100 overflow-hidden rounded-3xl z-[70] max-h-[92vh] overflow-y-auto [&>button]:hidden">

                    <ProfilePhotoCapture
                        profileId={activeProfile.id}
                        profileData={{
                            fullName: activeProfile.full_name || 'User',
                            email: activeProfile.email,
                            role: 'employee',
                            avatarUrl: activeProfile.avatar_url,
                            avatarStatus: activeProfile.avatar_url ? 'custom' : 'default'
                        }}

                        onSuccess={() => {
                            setIsPhotoCaptureOpen(false)
                            utils.profile.invalidate()
                            utils.attendance.invalidate()
                        }}
                    />
                </DialogContent>
            </Dialog>
        </>
    )
}

