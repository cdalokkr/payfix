'use client'

import { useEffect } from 'react'
import { toast as sonnerToast } from 'sonner'
import { Bell, CheckCircle, AlertCircle, Info } from 'lucide-react'
import { useRouter } from 'next/navigation'

/**
 * NotificationToastListener
 * 
 * Listens for 'new-notification' custom events dispatched by use-notifications.ts
 * and shows a sonner toast to the user with the notification content.
 * 
 * This component should be mounted in the dashboard layout to ensure it's active
 * on all dashboard pages.
 */
export function NotificationToastListener() {
    const router = useRouter()

    useEffect(() => {
        const handleNewNotification = (event: CustomEvent<{
            title: string
            message: string
            type?: 'info' | 'success' | 'warning' | 'error'
            link?: string
        }>) => {
            const { title, message, type = 'info', link } = event.detail

            console.log('[NOTIFICATION-TOAST] Received new notification:', { title, type })

            // Choose icon based on type
            const icons = {
                success: <CheckCircle className="h-5 w-5 text-green-500" />,
                error: <AlertCircle className="h-5 w-5 text-red-500" />,
                warning: <AlertCircle className="h-5 w-5 text-yellow-500" />,
                info: <Bell className="h-5 w-5 text-blue-500" />,
            }

            // Show sonner toast with proper styling
            sonnerToast(title, {
                description: message,
                icon: icons[type] || icons.info,
                duration: 6000,
                action: link ? {
                    label: 'View',
                    onClick: () => {
                        router.push(link)
                    }
                } : undefined,
                className: 'notification-toast',
            })
        }

        // Add event listener
        window.addEventListener('new-notification', handleNewNotification as EventListener)

        console.log('[NOTIFICATION-TOAST] Listener mounted')

        // Cleanup on unmount
        return () => {
            window.removeEventListener('new-notification', handleNewNotification as EventListener)
            console.log('[NOTIFICATION-TOAST] Listener unmounted')
        }
    }, [router])

    // This component doesn't render anything visible
    return null
}

export default NotificationToastListener
