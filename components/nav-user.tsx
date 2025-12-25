"use client"

import { useState } from "react"
import {
    LogOut,
} from "lucide-react"

import { Profile } from "@/types"
import {
    Avatar,
    AvatarFallback,
    AvatarImage,
} from "@/components/ui/avatar"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import {
    SidebarMenu,
    SidebarMenuItem,
    useSidebar,
} from "@/components/ui/sidebar"
import { LogoutModal } from "@/components/ui/logout-modal"

interface NavUserProps {
    user: Profile | null
}

export function NavUser({ user }: NavUserProps) {
    const { isMobile } = useSidebar()
    const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false)
    const [isConfirmOpen, setIsConfirmOpen] = useState(false)

    // Get user initials
    const getInitials = () => {
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
    }

    const displayName = user?.full_name || user?.first_name || 'User'
    const displayEmail = user?.email || ''

    return (
        <>
            <SidebarMenu>
                <SidebarMenuItem>
                    <div
                        className="group/footer-item flex h-14 w-full items-center gap-3 rounded-xl pl-[12px] pr-3 py-3 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground cursor-pointer transition-all duration-150 group-data-[state=collapsed]:p-0 group-data-[state=collapsed]:h-10 group-data-[state=collapsed]:w-10 group-data-[state=collapsed]:justify-center group-data-[state=collapsed]:mx-auto"
                        onClick={() => setIsConfirmOpen(true)}
                    >
                        <Avatar className="h-8 w-8 rounded-full after:rounded-full shrink-0 transition-all group-hover/footer-item:ring-2 group-hover/footer-item:ring-primary group-hover/footer-item:ring-offset-1 group-hover/footer-item:ring-offset-sidebar">
                            <AvatarImage src={user?.avatar_url || ''} alt={displayName} className="rounded-full" />
                            <AvatarFallback className="rounded-full bg-primary/10 text-primary font-semibold text-sm">
                                {getInitials()}</AvatarFallback>
                        </Avatar>
                        <div className="grid flex-1 text-left text-sm leading-tight transition-all duration-200 group-data-[collapsible=icon]:w-0 group-data-[collapsible=icon]:opacity-0 group-data-[collapsible=icon]:flex-none overflow-hidden group-data-[collapsible=icon]:hidden">

                            <span className="truncate font-semibold">{displayName}</span>
                            <span className="truncate text-xs text-muted-foreground mb-0.5">{displayEmail}</span>
                            <div className="flex items-center transition-all duration-200 group-data-[collapsible=icon]:hidden">
                                <span className="text-[10px] text-indigo-500 dark:text-indigo-400 font-bold uppercase tracking-tight truncate">
                                    {user?.designation?.name || (user?.role === 'admin' ? 'Administrator' : 'Staff')}
                                </span>
                            </div>
                        </div>
                        <div className="ml-auto flex size-8 items-center justify-center rounded-lg transition-all duration-200 group-data-[collapsible=icon]:hidden">
                            <LogOut className="size-4 text-muted-foreground transition-colors group-hover/footer-item:text-red-500" />
                        </div>

                    </div>
                </SidebarMenuItem>
            </SidebarMenu>

            {/* Initial Confirmation Dialog */}
            <Dialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Confirm Logout</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to log out? You will need to sign in again to access your account.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsConfirmOpen(false)}>
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={() => {
                                setIsConfirmOpen(false)
                                setIsLogoutModalOpen(true)
                            }}
                        >
                            Sign out
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Final Progress Logout Modal */}
            <LogoutModal
                isOpen={isLogoutModalOpen}
                onOpenChange={setIsLogoutModalOpen}
            />
        </>
    )
}
