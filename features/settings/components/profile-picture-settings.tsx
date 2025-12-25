"use client"

import { useState, useRef } from "react"
import { Profile } from "@/types"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ActionButton } from "@/components/ui/action-button"
import { UserAvatarProfile } from "@/components/user-avatar-profile"
import { Camera } from "lucide-react"
import { toast } from "sonner"
import { getDefaultAvatarUrl } from "@/lib/utils/avatar-helper"
import { trpc } from "@/lib/trpc/client"
import { useDashboardPrefetch } from "@/hooks/use-dashboard-prefetch"
import { broadcastCacheInvalidation } from "@/lib/prefetch-status"

import CreateUserButton, { AsyncState } from "@/components/ui/create-user-button"

interface ProfilePictureSettingsProps {
    user: Profile
}

export function ProfilePictureSettings({ user }: ProfilePictureSettingsProps) {
    const [avatarUrl, setAvatarUrl] = useState<string | null>(user.avatar_url || getDefaultAvatarUrl(user.sex))
    const [pendingAvatarUrl, setPendingAvatarUrl] = useState<string | null>(null)

    const [saveStatus, setSaveStatus] = useState<AsyncState>('idle')
    const fileInputRef = useRef<HTMLInputElement>(null)

    const utils = trpc.useUtils()

    // Dashboard prefetch hook for cache management
    const { prefetch: prefetchDashboard, clearPrefetch } = useDashboardPrefetch()

    // Server-side cache invalidation mutation
    const invalidateServerCacheMutation = trpc.profile.invalidateCache.useMutation({

        onSuccess: (result) => {
            console.log(`[ProfilePicture] 🗑️ Server cache invalidated: ${result.invalidatedCount} entries cleared`)
        },
        onError: (error) => {
            console.warn('[ProfilePicture] ⚠️ Server cache invalidation failed:', error.message)
            // Continue anyway - client-side invalidation will still work
        }
    })

    // Invalidate dashboard cache (both server and client side) - TRULY NON-BLOCKING
    const invalidateDashboardCache = () => {
        console.log('[ProfilePicture] 🎯 Starting dashboard cache invalidation (non-blocking)...')

        // Step 1: Invalidate client-side tRPC cache immediately (synchronous, fast)
        // We use both admin and profile context cautiously
        if (user.role === 'admin') {
            utils.admin.dashboard.getUnifiedDashboardData.invalidate()
            utils.admin.dashboard.getComprehensiveDashboardData.invalidate().catch(() => { })
        } else {
            // For other roles, they still use getUnifiedDashboardData
            utils.admin.dashboard.getUnifiedDashboardData.invalidate()
        }
        console.log('[ProfilePicture] 🔄 Client-side dashboard cache invalidated')


        // Step 2: Invalidate server-side cache (fire and forget - truly non-blocking)
        invalidateServerCacheMutation.mutate({
            reason: 'profile-picture-update'
        })
        // Note: We don't await or use .then() here - it's truly fire and forget
    }

    // Prefetch dashboard data using SAME cache key as dashboard load (speed priority)
    // This ensures the prefetched data is used when dashboard loads
    const prefetchDashboardData = () => {
        console.log('[ProfilePicture] [PREFETCH] Starting dashboard data prefetch (non-blocking)...')

        // Clear existing prefetch status
        clearPrefetch()

        // Broadcast cache invalidation to other tabs
        broadcastCacheInvalidation()

        // IMPORTANT: Use forceFresh=false to match dashboard load cache key (speed priority)
        // This ensures prefetched data is used by the dashboard query
        prefetchDashboard({ forceFresh: false, blocking: false })
            .then(() => {
                console.log('[ProfilePicture] [PREFETCH] ✅ Dashboard data prefetched (ready for navigation)')
            })
            .catch((error) => {
                // Prefetch failure is not critical - dashboard will fetch on mount anyway
                console.warn('[ProfilePicture] [PREFETCH] ⚠️ Prefetch failed (non-critical):', error)
            })
    }

    // Mutation for updating profile picture
    const updateProfilePictureMutation = trpc.profile.updateProfilePicture.useMutation({

        onSuccess: (data) => {
            // OPTIMISTIC UI UPDATE: Update UI immediately using mutation response
            // This provides instant feedback without waiting for additional fetches

            // Step 1: Update avatar URL immediately from mutation response (optimistic)
            if (data?.avatar_url) {
                setAvatarUrl(data.avatar_url)
                console.log('[ProfilePicture] ✅ Avatar updated optimistically:', data.avatar_url)
            }

            // Step 2: Invalidate caches (non-blocking, fire and forget)
            invalidateDashboardCache()
            utils.profile.get.invalidate()

            // Step 3: Prefetch dashboard data in background (non-blocking)
            // Uses same cache key as dashboard load for instant data availability
            prefetchDashboardData()

            // Step 4: Show success immediately
            toast.success("Profile picture saved successfully")
            setPendingAvatarUrl(null)
            setSaveStatus('success')

            // Step 5: Background sync (non-blocking) - updates if mutation response was incomplete
            utils.profile.get.fetch()
                .then((updatedProfile) => {
                    if (updatedProfile?.avatar_url && updatedProfile.avatar_url !== data?.avatar_url) {
                        setAvatarUrl(updatedProfile.avatar_url)
                        console.log('[ProfilePicture] Avatar synced from background:', updatedProfile.avatar_url)
                    }
                })
                .catch((error) => {
                    console.warn('[ProfilePicture] Background sync failed (non-critical):', error)
                })

            // Reset to idle after delay
            setTimeout(() => {
                setSaveStatus('idle')
            }, 3000)
        },
        onError: (error) => {
            toast.error(error.message || "Failed to save profile picture")
            setSaveStatus('error')

            // Reset to idle after delay
            setTimeout(() => {
                setSaveStatus('idle')
            }, 3000)
        }
    })

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        // Validate file type
        if (!file.type.startsWith('image/')) {
            toast.error("Please select an image file")
            return
        }

        // Validate file size (max 5MB)
        const maxSize = 5 * 1024 * 1024 // 5MB
        if (file.size > maxSize) {
            toast.error("Image size must be less than 5MB")
            return
        }

        // Create local preview URL (no upload yet - just preview)
        const objectUrl = URL.createObjectURL(file)
        setAvatarUrl(objectUrl)
        setPendingAvatarUrl(objectUrl)

        toast.success("Photo selected - click Save Photo to upload and save")
    }

    const handleSavePhoto = async () => {
        if (!pendingAvatarUrl) return

        // Get the file from the input
        const file = fileInputRef.current?.files?.[0]
        if (!file) {
            toast.error("No file selected")
            return
        }

        // setIsSaving(true) removed
        // We rely on saveStatus for the button state
        setSaveStatus('loading')
        try {
            // Upload to public folder via API route
            const formData = new FormData()
            formData.append('file', file)
            formData.append('userId', user.id)

            console.log('[ProfilePicture] Uploading file to public folder...')
            const response = await fetch('/api/upload-avatar', {
                method: 'POST',
                body: formData
            })

            if (!response.ok) {
                const error = await response.json()
                throw new Error(error.error || 'Upload failed')
            }

            const { path: publicPath } = await response.json()
            console.log('[ProfilePicture] File uploaded, path:', publicPath)

            // Update profile with public folder path
            await updateProfilePictureMutation.mutateAsync({
                userId: user.id,
                avatarUrl: publicPath
            })

            // Clear the file input
            if (fileInputRef.current) {
                fileInputRef.current.value = ''
            }
        } catch (error: unknown) {
            console.error('[ProfilePicture] Save error:', error)
            const errorMessage = error instanceof Error ? error.message : 'Failed to save photo'
            toast.error(errorMessage)
            setSaveStatus('error')
            setTimeout(() => {
                setSaveStatus('idle')
            }, 3000)
        } finally {
            // No cleanup needed
        }
    }

    const hasPendingChanges = pendingAvatarUrl !== null

    return (
        <Card className="relative overflow-hidden border-2 border-border/60 hover:border-primary/30 transition-all duration-300 w-full">
            <div className="absolute inset-0 bg-gradient-to-br from-accent/5 via-transparent to-primary/5 pointer-events-none" />
            <CardHeader className="relative">
                <CardTitle className="text-lg">Profile Picture</CardTitle>
                <CardDescription>
                    Update your profile photo
                </CardDescription>
            </CardHeader>
            <CardContent className="relative flex flex-col items-center gap-6">
                <div className="rounded-lg border border-border p-4">
                    <div className="relative group">
                        <div className="absolute -inset-1 bg-linear-to-r from-primary to-accent rounded-full opacity-75 blur group-hover:opacity-100 transition duration-300" />
                        <div className="relative">
                            <UserAvatarProfile
                                key={avatarUrl || user.avatar_url}
                                user={{ ...user, avatar_url: avatarUrl }}
                                className="h-32 w-32 border-4 border-background"
                                placeholderBlur={12}
                                placeholderScale={1.08}
                                fadeDurationMs={350}
                            />
                            <div
                                className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                                onClick={() => fileInputRef.current?.click()}
                            >
                                <Camera className="h-10 w-10 text-white" />
                            </div>
                        </div>
                        <input
                            type="file"
                            ref={fileInputRef}
                            className="hidden"
                            accept="image/*"
                            onChange={handleFileChange}
                        />
                    </div>
                </div>
                <div className="flex flex-col gap-3 w-full max-w-xs">
                    <ActionButton
                        action="dashboard-blue"
                        size="lg"
                        className="w-full"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={saveStatus === 'loading'}
                        icon={Camera}
                    >
                        Change Photo
                    </ActionButton>
                    <CreateUserButton
                        size="lg"
                        className="w-full"
                        onClick={handleSavePhoto}
                        asyncState={saveStatus}
                        disabled={!hasPendingChanges}
                        mode="edit"
                        loadingText="Saving Photo..."
                        successText="Photo Saved!"
                        errorText="Failed to Save"
                    >
                        Save Photo
                    </CreateUserButton>
                </div>
            </CardContent>
        </Card>
    )
}
