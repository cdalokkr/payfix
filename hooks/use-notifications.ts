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

        try {
            console.log('[NOTIFICATIONS] Creating new subscription for userId:', userId)

            // Subscribe to notifications for this user
            const subscription = supabase
                .channel(`notifications-changes-${userId}`) // Unique channel name per user
                .on(
                    'postgres_changes',
                    {
                        event: '*',
                        schema: 'public',
                        table: 'notifications',
                        filter: `user_id=eq.${userId}`
                    },
                    (payload) => {
                        console.log('[NOTIFICATIONS] Real-time event:', payload.eventType)

                        // Show toast for new notifications
                        if (payload.eventType === 'INSERT' && payload.new) {
                            const notification = payload.new as Notification

                            // Dispatch custom event for toast notification
                            window.dispatchEvent(new CustomEvent('new-notification', {
                                detail: {
                                    title: notification.title,
                                    message: notification.message,
                                    type: notification.type,
                                    link: notification.link
                                }
                            }))
                        }

                        // Invalidate queries to force refetch (await to ensure completion)
                        Promise.all([
                            utils.notification.getAll.invalidate(),
                            utils.notification.getUnreadCount.invalidate()
                        ]).then(() => {
                            console.log('[NOTIFICATIONS] Queries invalidated successfully')
                        })
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
                setIsSubscribed(false)
            }
        } catch (error) {
            console.error('[NOTIFICATIONS] Error setting up subscription:', error)
        }
    }, [userId, utils]) // Re-subscribe only when userId actually changes

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
