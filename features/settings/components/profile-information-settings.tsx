"use client"

import { useState } from "react"
import { Profile } from "@/types"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ActionButton } from "@/components/ui/action-button"
import { Edit, User, Mail, Calendar } from "lucide-react"
import { toast } from "sonner"
import { ModernAddUserForm } from "@/features/users/components/ModernAddUserForm"
import { cn } from "@/lib/utils"
import { trpc } from "@/lib/trpc/client"
import { useDashboardPrefetch } from "@/hooks/use-dashboard-prefetch"
import { broadcastCacheInvalidation } from "@/lib/prefetch-status"

interface ProfileInformationSettingsProps {
    user: Profile
}

export function ProfileInformationSettings({ user }: ProfileInformationSettingsProps) {
    const [isEditFormOpen, setIsEditFormOpen] = useState(false)
    const utils = trpc.useUtils()

    // Dashboard prefetch hook for cache management
    const { prefetch: prefetchDashboard, clearPrefetch } = useDashboardPrefetch()

    // Server-side cache invalidation mutation
    const invalidateServerCacheMutation = trpc.profile.invalidateCache.useMutation({

        onSuccess: (result) => {
            console.log(`[ProfileInfo] 🗑️ Server cache invalidated: ${result.invalidatedCount} entries cleared`)
        },
        onError: (error) => {
            console.warn('[ProfileInfo] ⚠️ Server cache invalidation failed:', error.message)
        }
    })

    // Invalidate dashboard cache (both server and client side) - TRULY NON-BLOCKING
    const invalidateDashboardCache = () => {
        console.log('[ProfileInfo] 🎯 Starting dashboard cache invalidation (non-blocking)...')

        // Invalidate client-side tRPC cache immediately (synchronous, fast)
        utils.admin.dashboard.getUnifiedDashboardData.invalidate()
        console.log('[ProfileInfo] 🔄 Client-side dashboard cache invalidated')


        // Step 2: Invalidate server-side cache (fire and forget - truly non-blocking)
        invalidateServerCacheMutation.mutate({
            reason: 'profile-information-update'
        })
    }

    // Prefetch dashboard data using SAME cache key as dashboard load (speed priority)
    const prefetchDashboardData = () => {
        console.log('[ProfileInfo] [PREFETCH] Starting dashboard data prefetch (non-blocking)...')

        // Clear existing prefetch status
        clearPrefetch()

        // Broadcast cache invalidation to other tabs
        broadcastCacheInvalidation()

        // IMPORTANT: Use forceFresh=false to match dashboard load cache key (speed priority)
        prefetchDashboard({ forceFresh: false, blocking: false })
            .then(() => {
                console.log('[ProfileInfo] [PREFETCH] ✅ Dashboard data prefetched (ready for navigation)')
            })
            .catch((error) => {
                console.warn('[ProfileInfo] [PREFETCH] ⚠️ Prefetch failed (non-critical):', error)
            })
    }

    // Format date for display
    const formatDate = (dateString: string | null | undefined) => {
        if (!dateString) return "Not set"
        try {
            const date = new Date(dateString)
            return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
        } catch {
            return "Invalid date"
        }
    }

    return (
        <>
            <Card className="relative overflow-hidden border-2 border-border/60 hover:border-primary/30 transition-all duration-300 w-full">
                <div className="absolute inset-0 bg-gradient-to-br from-accent/5 via-transparent to-primary/5 pointer-events-none" />
                <CardHeader className="relative">
                    <CardTitle className="text-lg">Profile Information</CardTitle>
                    <CardDescription>
                        View and manage your personal details
                    </CardDescription>
                </CardHeader>
                <CardContent className="relative space-y-6 flex flex-col items-center">
                    {/* User Details */}
                    <div className="rounded-lg border border-border p-4 w-full max-w-xs">
                        <div className="space-y-4">
                            <div className="flex items-start gap-3">
                                <User className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Full Name</p>
                                    <p className="text-sm font-semibold text-foreground truncate">{user.full_name || "Not set"}</p>
                                </div>
                            </div>

                            <div className="flex items-start gap-3">
                                <Mail className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Email</p>
                                    <p className="text-sm font-semibold text-foreground truncate">{user.email}</p>
                                </div>
                            </div>

                            {user.date_of_birth && (
                                <div className="flex items-start gap-3">
                                    <Calendar className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Date of Birth</p>
                                        <p className="text-sm font-semibold text-foreground">{formatDate(user.date_of_birth)}</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Edit Profile Button */}
                    <div className="w-full max-w-xs">
                        <ActionButton
                            action="dashboard-blue"
                            size="lg"
                            className="w-full"
                            onClick={() => setIsEditFormOpen(true)}
                            icon={Edit}
                        >
                            Edit Profile Data
                        </ActionButton>
                    </div>
                </CardContent>
            </Card>

            {/* Edit Profile Form Sheet */}
            {isEditFormOpen && (
                <ModernAddUserForm
                    open={isEditFormOpen}
                    onOpenChange={setIsEditFormOpen}
                    editingUser={user}
                    useSheet={true}
                    isProfileMode={true}
                    onSuccess={() => {
                        // OPTIMISTIC UI UPDATE: Close form and show success immediately
                        setIsEditFormOpen(false)
                        toast.success("Profile updated successfully")

                        // Step 1: Invalidate caches (non-blocking, fire and forget)
                        invalidateDashboardCache()
                        utils.profile.get.invalidate()

                        // Step 2: Prefetch dashboard data in background (non-blocking)
                        // Uses same cache key as dashboard load for instant data availability
                        prefetchDashboardData()

                        // Step 3: Background sync (non-blocking) - updates profile data
                        utils.profile.get.fetch()
                            .then(() => {
                                console.log('[ProfileInfo] ✅ Profile synced from background')
                            })
                            .catch((error) => {
                                console.warn('[ProfileInfo] Background sync failed (non-critical):', error)
                            })
                    }}
                />
            )}
        </>
    )
}
