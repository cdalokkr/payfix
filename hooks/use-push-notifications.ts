"use client"

import { useState, useEffect, useCallback } from 'react'
import { trpc } from '@/lib/trpc/client'
import { toast } from 'sonner'

interface UsePushNotificationsReturn {
    isSupported: boolean
    isSubscribed: boolean
    isLoading: boolean
    subscribe: () => Promise<boolean>
    unsubscribe: () => Promise<boolean>
    sendTest: () => Promise<void>
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
    const base64 = (base64String + padding)
        .replace(/-/g, '+')
        .replace(/_/g, '/')

    const rawData = window.atob(base64)
    const outputArray = new Uint8Array(rawData.length)

    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i)
    }
    return outputArray
}

export function usePushNotifications(): UsePushNotificationsReturn {
    const [isSupported, setIsSupported] = useState(false)
    const [isSubscribed, setIsSubscribed] = useState(false)
    const [isLoading, setIsLoading] = useState(true)

    const { data: vapidKey } = trpc.push.getVapidKey.useQuery(undefined, {
        staleTime: Infinity,
    })

    const subscribeMutation = trpc.push.subscribe.useMutation()
    const unsubscribeMutation = trpc.push.unsubscribe.useMutation()
    const sendTestMutation = trpc.push.sendTest.useMutation()

    // Check if push is supported
    useEffect(() => {
        const checkSupport = () => {
            if (!('serviceWorker' in navigator)) {
                console.log('Service Worker not supported')
                setIsSupported(false)
                setIsLoading(false)
                return
            }

            if (!('PushManager' in window)) {
                console.log('Push notifications not supported')
                setIsSupported(false)
                setIsLoading(false)
                return
            }

            setIsSupported(true)
        }

        checkSupport()
    }, [])

    // Check current subscription status
    useEffect(() => {
        if (!isSupported) return

        const checkSubscription = async () => {
            try {
                const registration = await navigator.serviceWorker.ready
                const subscription = await registration.pushManager.getSubscription()
                setIsSubscribed(!!subscription)
            } catch (error) {
                console.error('Error checking subscription:', error)
            } finally {
                setIsLoading(false)
            }
        }

        checkSubscription()
    }, [isSupported])

    // Subscribe to push notifications
    const subscribe = useCallback(async (): Promise<boolean> => {
        if (!isSupported || !vapidKey?.key) {
            toast.error('Push notifications not supported')
            return false
        }

        setIsLoading(true)

        try {
            // Request notification permission
            const permission = await Notification.requestPermission()
            if (permission !== 'granted') {
                toast.error('Notification permission denied')
                setIsLoading(false)
                return false
            }

            // Register service worker if not already registered
            let registration = await navigator.serviceWorker.getRegistration()
            if (!registration) {
                registration = await navigator.serviceWorker.register('/sw.js')
                await navigator.serviceWorker.ready
            }

            // Subscribe to push
            const applicationServerKey = urlBase64ToUint8Array(vapidKey.key)
            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: applicationServerKey.buffer as ArrayBuffer,
            })

            const subscriptionJSON = subscription.toJSON()
            if (!subscriptionJSON.endpoint || !subscriptionJSON.keys) {
                throw new Error('Invalid subscription')
            }

            // Save to server
            await subscribeMutation.mutateAsync({
                endpoint: subscriptionJSON.endpoint,
                keys: {
                    p256dh: subscriptionJSON.keys.p256dh!,
                    auth: subscriptionJSON.keys.auth!,
                },
                userAgent: navigator.userAgent,
            })

            setIsSubscribed(true)
            toast.success('Push notifications enabled!')
            return true
        } catch (error) {
            console.error('Failed to subscribe:', error)
            toast.error('Failed to enable push notifications')
            return false
        } finally {
            setIsLoading(false)
        }
    }, [isSupported, vapidKey, subscribeMutation])

    // Unsubscribe from push notifications
    const unsubscribe = useCallback(async (): Promise<boolean> => {
        if (!isSupported) return false

        setIsLoading(true)

        try {
            const registration = await navigator.serviceWorker.ready
            const subscription = await registration.pushManager.getSubscription()

            if (subscription) {
                // Unsubscribe from push manager
                await subscription.unsubscribe()

                // Remove from server
                await unsubscribeMutation.mutateAsync({
                    endpoint: subscription.endpoint,
                })
            }

            setIsSubscribed(false)
            toast.success('Push notifications disabled')
            return true
        } catch (error) {
            console.error('Failed to unsubscribe:', error)
            toast.error('Failed to disable push notifications')
            return false
        } finally {
            setIsLoading(false)
        }
    }, [isSupported, unsubscribeMutation])

    // Send test notification
    const sendTest = useCallback(async (): Promise<void> => {
        if (!isSubscribed) {
            toast.error('Please enable push notifications first')
            return
        }

        try {
            await sendTestMutation.mutateAsync()
            toast.success('Test notification sent!')
        } catch (error) {
            console.error('Failed to send test:', error)
            toast.error('Failed to send test notification')
        }
    }, [isSubscribed, sendTestMutation])

    return {
        isSupported,
        isSubscribed,
        isLoading,
        subscribe,
        unsubscribe,
        sendTest,
    }
}

export default usePushNotifications
