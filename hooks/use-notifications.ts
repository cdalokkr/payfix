import { useState, useEffect, useRef } from 'react'
import { trpc } from '@/lib/trpc/client'
import { createClient } from '@/lib/supabase/client'
import type { Notification } from '@/types'
import { useProfile } from '@/lib/context/profile-context'

/**
 * useNotifications Hook
 * 
 * Handles real-time notification management with Supabase subscriptions.
 * Features:
 * - Real-time Supabase postgres_changes subscription
 * - Toast notification dispatching via custom events
 * - Automatic query invalidation on updates
 * - Mark as read functionality
 * - Real-time badge updates
 */
export function useNotifications() {
    const utils = trpc.useUtils()
    const [isSubscribed, setIsSubscribed] = useState(false)
    const subscriptionRef = useRef<any>(null)
    const previousUserIdRef = useRef<string | undefined>(undefined)
    // Refs to store latest refetch functions to avoid stale closures in subscription callback
    const refetchRef = useRef<(() => Promise<any>) | null>(null)
    const refetchCountRef = useRef<(() => Promise<any>) | null>(null)

    // Get profile from context (shared across all components)
    const { profile } = useProfile()
    const userId = profile?.user_id

    // Fetch notifications - with 2-minute caching for performance
    const { data: notifications = [], isLoading, refetch } = trpc.notification.getAll.useQuery(
        { limit: 20 },
        {
            staleTime: 2 * 60 * 1000, // Cache for 2 minutes
            gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
            refetchOnMount: false, // Use cache if available
            refetchOnWindowFocus: false, // Don't refetch on tab focus
        }
    )

    // Fetch unread count - cached for 2 minutes
    const { data: unreadCount = 0, refetch: refetchCount } = trpc.notification.getUnreadCount.useQuery(
        undefined,
        {
            staleTime: 2 * 60 * 1000, // Cache for 2 minutes
            gcTime: 5 * 60 * 1000,
            refetchOnMount: false,
            refetchOnWindowFocus: false,
        }
    )

    // Keep refs updated with latest refetch functions
    useEffect(() => {
        refetchRef.current = refetch
        refetchCountRef.current = refetchCount
    }, [refetch, refetchCount])

    // Mark as read mutation
    const markAsReadMutation = trpc.notification.markAsRead.useMutation({
        onSuccess: () => {
            refetch()
            refetchCount()
        }
    })

    // Mark all as read mutation
    const markAllAsReadMutation = trpc.notification.markAllAsRead.useMutation({
        onSuccess: () => {
            refetch()
            refetchCount()
        }
    })

    // Real-time subscription
    useEffect(() => {
        // Only subscribe when we have a user ID
        if (!userId) {
            // Clean up existing subscription if userId is no longer available
            if (subscriptionRef.current) {
                console.log('[NOTIFICATIONS] Cleaning up subscription - no userId')
                subscriptionRef.current.unsubscribe()
                subscriptionRef.current = null
                setIsSubscribed(false)
            }
            return
        }

        // Check if userId has actually changed
        if (previousUserIdRef.current === userId) {
            // UserId hasn't changed, don't re-subscribe
            return
        }

        // Update previous userId ref
        previousUserIdRef.current = userId

        // Clean up previous subscription if it exists
        if (subscriptionRef.current) {
            console.log('[NOTIFICATIONS] Cleaning up previous subscription before creating new one')
            subscriptionRef.current.unsubscribe()
            subscriptionRef.current = null
        }

        const supabase = createClient()

        // Handler function to process notification events
        function handleNotificationEvent(notification?: { title?: string; message?: string; type?: string; link?: string }) {
            // Dispatch custom event for toast notification (bell icon toast)
            if (notification) {
                window.dispatchEvent(new CustomEvent('new-notification', {
                    detail: {
                        title: notification.title,
                        message: notification.message,
                        type: notification.type,
                        link: notification.link
                    }
                }))
            }

            // Refetch queries immediately to update bell icon badge
            // Use refs to get latest refetch functions (avoids stale closure)
            if (refetchRef.current) {
                refetchRef.current().then(() => {
                    console.log('[NOTIFICATIONS] Notifications refetched successfully')
                })
            }
            if (refetchCountRef.current) {
                refetchCountRef.current().then(() => {
                    console.log('[NOTIFICATIONS] Unread count refetched successfully')
                })
            }
        }

        try {
            console.log('[NOTIFICATIONS] Creating subscriptions for userId:', userId)

            // Subscribe to the dashboard-user channel for broadcast events
            // This is the primary channel that broadcastServerEvent sends to
            const subscription = supabase
                .channel(`dashboard-user-${userId}`)
                .on(
                    'broadcast',
                    { event: 'realtime-event' },
                    (payload) => {
                        console.log('[NOTIFICATIONS] Broadcast event received:', payload)
                        const data = payload.payload
                        // Check if this is a new_notification event
                        if (data?.metadata?.category === 'new_notification') {
                            console.log('[NOTIFICATIONS] Processing new_notification broadcast')
                            const notificationData = data.payload
                            handleNotificationEvent({
                                title: notificationData?.title,
                                message: notificationData?.message,
                                type: notificationData?.type,
                                link: notificationData?.link
                            })
                        }
                    }
                )
                // Also try postgres_changes as a fallback (may not work due to RLS)
                .on(
                    'postgres_changes',
                    {
                        event: 'INSERT',
                        schema: 'public',
                        table: 'notifications',
                        filter: `user_id=eq.${userId}`
                    },
                    (payload) => {
                        console.log('[NOTIFICATIONS] postgres_changes event:', payload.eventType)
                        const newNotification = payload.new as { title?: string; message?: string; type?: string; link?: string }
                        handleNotificationEvent(newNotification)
                    }
                )
                .subscribe((status) => {
                    console.log('[NOTIFICATIONS] Subscription status:', status)
                    if (status === 'SUBSCRIBED') {
                        setIsSubscribed(true)
                    } else if (status === 'CHANNEL_ERROR') {
                        setIsSubscribed(false)
                    }
                })

            subscriptionRef.current = subscription

            // Cleanup
            return () => {
                console.log('[NOTIFICATIONS] Cleaning up subscription on unmount')
                if (subscriptionRef.current) {
                    subscriptionRef.current.unsubscribe()
                    subscriptionRef.current = null
                }
                // Reset previousUserIdRef so subscription is recreated on remount (React Strict Mode)
                previousUserIdRef.current = undefined
                setIsSubscribed(false)
            }
        } catch (error) {
            console.error('[NOTIFICATIONS] Error setting up subscription:', error)
        }
    }, [userId]) // Re-subscribe only when userId actually changes

    return {
        notifications: notifications as Notification[],
        unreadCount,
        isLoading,
        isSubscribed,
        markAsRead: (notificationId: string) => markAsReadMutation.mutate({ notificationId }),
        markAllAsRead: () => markAllAsReadMutation.mutate(),
        refetch
    }
}
