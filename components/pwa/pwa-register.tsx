"use client"

import { useEffect, useState } from 'react'
import { toast } from 'sonner'

/**
 * PWA Register Component
 * Handles service worker registration and update prompts
 */
export function PWARegister() {
    const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null)
    const [showUpdatePrompt, setShowUpdatePrompt] = useState(false)

    useEffect(() => {
        // Only run in browser
        if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
            return
        }

        const registerServiceWorker = async () => {
            try {
                const registration = await navigator.serviceWorker.register('/sw.js', {
                    scope: '/',
                })

                console.log('[PWA] Service worker registered:', registration.scope)

                // Check for updates
                registration.addEventListener('updatefound', () => {
                    const newWorker = registration.installing
                    if (!newWorker) return

                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            // New content available, show update prompt
                            setWaitingWorker(newWorker)
                            setShowUpdatePrompt(true)
                            toast.info('New version available! Click to update.', {
                                duration: Infinity,
                                action: {
                                    label: 'Update',
                                    onClick: () => {
                                        newWorker.postMessage({ type: 'SKIP_WAITING' })
                                        window.location.reload()
                                    },
                                },
                            })
                        }
                    })
                })

                // Handle controller change
                let refreshing = false
                navigator.serviceWorker.addEventListener('controllerchange', () => {
                    if (refreshing) return
                    refreshing = true
                    window.location.reload()
                })
            } catch (error) {
                console.error('[PWA] Service worker registration failed:', error)
            }
        }

        registerServiceWorker()

        // Listen for messages from service worker
        navigator.serviceWorker.addEventListener('message', (event) => {
            if (event.data?.type === 'SYNC_COMPLETE') {
                toast.success('Offline data synced successfully!')
            }
        })
    }, [])

    // Handle online/offline status
    useEffect(() => {
        const handleOnline = () => {
            toast.success('You are back online!')
            // Trigger sync
            if ('serviceWorker' in navigator && 'sync' in window) {
                navigator.serviceWorker.ready.then((registration) => {
                    // @ts-ignore - Background Sync API
                    registration.sync?.register('sync-attendance')
                })
            }
        }

        const handleOffline = () => {
            toast.warning('You are offline. Some features may be limited.')
        }

        window.addEventListener('online', handleOnline)
        window.addEventListener('offline', handleOffline)

        return () => {
            window.removeEventListener('online', handleOnline)
            window.removeEventListener('offline', handleOffline)
        }
    }, [])

    return null // This component doesn't render anything
}

export default PWARegister
