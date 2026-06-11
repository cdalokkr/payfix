"use client"

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { OfflineSyncService } from '@/lib/services/offline-sync.service'

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

        // Only register service worker on mobile devices, standalone PWA, or mobile viewports
        const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|mobile/i.test(navigator.userAgent)
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true
        const isMobileViewport = window.innerWidth < 768

        if (!isMobileDevice && !isStandalone && !isMobileViewport) {
            console.log('[PWA] Skipping service worker registration on desktop/laptop browser')
            // Clean up any existing service worker registrations on desktop
            navigator.serviceWorker.getRegistrations().then((registrations) => {
                for (const registration of registrations) {
                    registration.unregister().then((success) => {
                        if (success) {
                            console.log('[PWA] Unregistered existing service worker on desktop browser')
                        }
                    })
                }
            })
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
        // Register cross-browser fallback IndexedDB background sync
        OfflineSyncService.registerBackgroundSync()

        // Sync any cached punches immediately on load if online
        if (navigator.onLine) {
            OfflineSyncService.syncQueuedPunches().catch((err) => {
                console.error('[PWA-REGISTER] Initial sync failed:', err)
            })
        }

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
