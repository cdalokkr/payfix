'use client'

import React, { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import {
    LogOut,
    User,
} from "lucide-react"

import { Profile } from "@/types"
import {
    Avatar,
    AvatarFallback,
    AvatarImage,
} from "@/components/ui/avatar"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { LogoutModal } from "@/components/ui/logout-modal"

interface UserNavProps {
    user: Profile | null
}

function UserNavComponent({ user }: UserNavProps) {
    const router = useRouter()
    const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false)
    const [isProgressModalOpen, setIsProgressModalOpen] = useState(false)

    // No mutation needed here, it's handled in LogoutModal
    // But we need to handle the click from the confirmation dialog
    const handleLogout = () => {
        setIsLogoutModalOpen(false)
        setIsProgressModalOpen(true)
    }

    // Get user initials - memoized to prevent recalculation on every render
    const initials = useMemo(() => {
        if (!user) return 'U'
        if (user.full_name) {
            return user.full_name
                .split(' ')
                .map(n => n[0])
                .join('')
                .toUpperCase()
                .slice(0, 2)
        }
        if (user.first_name) {
            return user.first_name[0].toUpperCase()
        }
        return user.email?.[0].toUpperCase() || 'U'
    }, [user])

    const displayName = useMemo(() => user?.full_name || user?.first_name || 'User', [user])
    const displayEmail = useMemo(() => user?.email || '', [user])
    const profileUrl = user?.role ? `/${user.role}/profile` : '/login'

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <div
                        className="relative h-8 w-8 rounded-full hover:bg-muted hover:ring-2 hover:ring-primary transition-all outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        suppressHydrationWarning
                    >
                        <Avatar className="h-8 w-8">
                            <AvatarImage src={user?.avatar_url || ''} alt={displayName} />
                            <AvatarFallback className="bg-primary/10 text-primary font-semibold">{initials}</AvatarFallback>
                        </Avatar>
                    </div>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end">
                    <div className="flex items-center justify-start gap-2 p-2">
                        <Avatar className="h-8 w-8">
                            <AvatarImage src={user?.avatar_url || ''} alt={displayName} />
                            <AvatarFallback className="bg-primary/10 text-primary font-semibold">{initials}</AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col space-y-1 leading-none">
                            {displayName && <p className="font-medium text-sm">{displayName}</p>}
                            {displayEmail && (
                                <p className="w-[150px] truncate text-xs text-muted-foreground font-normal">
                                    {displayEmail}
                                </p>
                            )}
                            <div className="flex items-center mt-1">
                                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-tight truncate">
                                    ( {user?.role || 'user'} - <span className="text-indigo-500 dark:text-indigo-400 font-bold">{user?.designation?.name || (user?.role === 'admin' ? 'Administrator' : 'Staff')}</span> )
                                </p>
                            </div>
                        </div>
                    </div>
                    <DropdownMenuSeparator />
                    <DropdownMenuGroup>
                        <DropdownMenuItem onClick={() => router.push(profileUrl)} className="cursor-pointer">
                            <User className="mr-2 h-4 w-4" />
                            <span>Profile</span>
                        </DropdownMenuItem>
                    </DropdownMenuGroup>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setIsLogoutModalOpen(true)} className="text-red-600 focus:text-red-600 cursor-pointer">
                        <LogOut className="mr-2 h-4 w-4" />
                        <span>Log out</span>
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            {/* Logout Confirmation Dialog */}
            <Dialog open={isLogoutModalOpen} onOpenChange={setIsLogoutModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Confirm Logout</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to log out? You will need to sign in again to access your account.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsLogoutModalOpen(false)}>
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleLogout}
                        >
                            Log out
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Final Progress Logout Modal */}
            <LogoutModal
                isOpen={isProgressModalOpen}
                onOpenChange={setIsProgressModalOpen}
            />
        </>
    )
}

// Memoize to prevent re-renders when user prop hasn't changed
// Custom comparison to avoid re-rendering when user object reference changes but values are the same
export const UserNav = React.memo(UserNavComponent, (prevProps, nextProps) => {
    // Only re-render if user ID or avatar changes (the most common updates)
    return prevProps.user?.id === nextProps.user?.id &&
        prevProps.user?.avatar_url === nextProps.user?.avatar_url &&
        prevProps.user?.full_name === nextProps.user?.full_name
})
