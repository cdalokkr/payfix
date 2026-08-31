/**
 * Real-Time Notifications Component
 * 
 * Displays role-based notifications with visual feedback and smart filtering.
 * Integrates with the enhanced event broadcasting system for optimal performance.
 */

'use client'

import React, { useEffect, useState, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { RealtimeChannel } from '@supabase/supabase-js'
import {
    type AnyRealtimeEvent,
    type EventCategory,
    type UserRole,
    type EventPriority
} from '@/lib/events/event-types'

// ============================================
// NOTIFICATION INTERFACES
// ============================================

export interface NotificationItem {
    id: string
    category: EventCategory
    title: string
    message: string
    type: 'info' | 'warning' | 'error' | 'success'
    priority: EventPriority
    timestamp: string
    read: boolean
    metadata?: Record<string, any>
    actionUrl?: string
    expiresAt?: string
}

export interface NotificationConfig {
    /** Maximum number of notifications to display */
    maxNotifications: number
    /** Auto-dismiss timeout in milliseconds */
    autoDismissTimeout: number
    /** Whether to show priority indicators */
    showPriorityIndicators: boolean
    /** Whether to enable sound notifications */
    enableSounds: boolean
    /** Notification position */
    position: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left'
    /** Theme customization */
    theme: 'light' | 'dark' | 'system'
}

// ============================================
// DEFAULT CONFIGURATION
// ============================================

const DEFAULT_CONFIG: NotificationConfig = {
    maxNotifications: 10,
    autoDismissTimeout: 5000,
    showPriorityIndicators: true,
    enableSounds: false,
    position: 'top-right',
    theme: 'system'
}

// ============================================
// NOTIFICATION PRIORITY STYLING
// ============================================

const PRIORITY_STYLES = {
    'ultra-critical': {
        bgColor: 'bg-red-50 dark:bg-red-900/20',
        borderColor: 'border-red-200 dark:border-red-800',
        iconColor: 'text-red-600 dark:text-red-400',
        textColor: 'text-red-800 dark:text-red-200',
        pulse: true
    },
    'critical': {
        bgColor: 'bg-orange-50 dark:bg-orange-900/20',
        borderColor: 'border-orange-200 dark:border-orange-800',
        iconColor: 'text-orange-600 dark:text-orange-400',
        textColor: 'text-orange-800 dark:text-orange-200',
        pulse: false
    },
    'secondary': {
        bgColor: 'bg-blue-50 dark:bg-blue-900/20',
        borderColor: 'border-blue-200 dark:border-blue-800',
        iconColor: 'text-blue-600 dark:text-blue-400',
        textColor: 'text-blue-800 dark:text-blue-200',
        pulse: false
    },
    'detailed': {
        bgColor: 'bg-gray-50 dark:bg-gray-900/20',
        borderColor: 'border-gray-200 dark:border-gray-800',
        iconColor: 'text-gray-600 dark:text-gray-400',
        textColor: 'text-gray-800 dark:text-gray-200',
        pulse: false
    }
}

// ============================================
// NOTIFICATION TYPE ICONS
// ============================================

const getNotificationIcon = (category: EventCategory, type: NotificationItem['type']) => {
    const iconClasses = 'w-5 h-5'

    switch (category) {
        case 'user_created':
            return (
                <svg className={`${iconClasses}`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M18 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0ZM3 19.235v-.11a6.375 6.375 0 0 1 12.75 0v.109A12.318 12.318 0 0 1 9.374 21c-2.331 0-4.512-.645-6.374-1.766Z" />
                </svg>
            )

        case 'user_activity':
            return (
                <svg className={`${iconClasses}`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                </svg>
            )

        case 'admin_action':
            return (
                <svg className={`${iconClasses}`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.623 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
                </svg>
            )

        case 'system_notification':
            return (
                <svg className={`${iconClasses}`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
                </svg>
            )

        default:
            return (
                <svg className={`${iconClasses}`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
                </svg>
            )
    }
}

// ============================================
// NOTIFICATION COMPONENT
// ============================================

interface NotificationProps {
    notification: NotificationItem
    onDismiss: (id: string) => void
    onMarkAsRead: (id: string) => void
    config: NotificationConfig
}

const NotificationItem: React.FC<NotificationProps> = ({
    notification,
    onDismiss,
    onMarkAsRead,
    config
}) => {
    const [isVisible, setIsVisible] = useState(false)
    const [isExiting, setIsExiting] = useState(false)

    const priorityStyle = PRIORITY_STYLES[notification.priority]
    const Icon = getNotificationIcon(notification.category, notification.type)

    const handleDismiss = useCallback(() => {
        setIsExiting(true)
        setTimeout(() => {
            onDismiss(notification.id)
        }, 200) // Match exit animation duration
    }, [notification.id, onDismiss])

    // Auto-dismiss functionality
    useEffect(() => {
        if (config.autoDismissTimeout > 0 && !notification.read) {
            const timer = setTimeout(() => {
                handleDismiss()
            }, config.autoDismissTimeout)

            return () => clearTimeout(timer)
        }
    }, [config.autoDismissTimeout, notification.read, notification.id, handleDismiss])

    // Entrance animation
    useEffect(() => {
        const timer = setTimeout(() => setIsVisible(true), 10)
        return () => clearTimeout(timer)
    }, [])

    const handleMarkAsRead = useCallback(() => {
        if (!notification.read) {
            onMarkAsRead(notification.id)
        }
    }, [notification.read, notification.id, onMarkAsRead])

    const formatTimestamp = (timestamp: string) => {
        const date = new Date(timestamp)
        const now = new Date()
        const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60))

        if (diffInMinutes < 1) return 'Just now'
        if (diffInMinutes < 60) return `${diffInMinutes}m ago`
        if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`
        return date.toLocaleDateString()
    }

    const positionClasses = {
        'top-right': 'top-4 right-4',
        'top-left': 'top-4 left-4',
        'bottom-right': 'bottom-4 right-4',
        'bottom-left': 'bottom-4 left-4'
    }

    return (
        <div
            className={`
        ${positionClasses[config.position]}
        fixed z-50 w-96 max-w-sm
        transform transition-all duration-200 ease-in-out
        ${isVisible && !isExiting ? 'translate-x-0 opacity-100' :
                    isExiting ? 'translate-x-full opacity-0' : 'translate-x-full opacity-0'}
        ${priorityStyle.pulse ? 'animate-pulse' : ''}
      `}
        >
            <div
                className={`
          ${priorityStyle.bgColor} ${priorityStyle.borderColor}
          border rounded-lg shadow-lg backdrop-blur-sm
          p-4 cursor-pointer
          hover:shadow-xl transition-shadow duration-200
          ${notification.read ? 'opacity-75' : ''}
        `}
                onClick={handleMarkAsRead}
            >
                <div className="flex items-start space-x-3">
                    {/* Priority Indicator */}
                    {config.showPriorityIndicators && (
                        <div className={`w-1 h-12 rounded-full ${priorityStyle.bgColor.replace('bg-', 'bg-')} flex-shrink-0`} />
                    )}

                    {/* Icon */}
                    <div className={`${priorityStyle.iconColor} flex-shrink-0 mt-1`}>
                        {Icon}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between">
                            <h4 className={`${priorityStyle.textColor} text-sm font-semibold truncate pr-2`}>
                                {notification.title}
                            </h4>

                            <button
                                onClick={(e) => {
                                    e.stopPropagation()
                                    handleDismiss()
                                }}
                                className={`${priorityStyle.textColor} hover:opacity-70 transition-opacity flex-shrink-0`}
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        <p className={`${priorityStyle.textColor} text-sm mt-1 opacity-90`}>
                            {notification.message}
                        </p>

                        <div className="flex items-center justify-between mt-2">
                            <span className={`${priorityStyle.textColor} text-xs opacity-70`}>
                                {formatTimestamp(notification.timestamp)}
                            </span>

                            {notification.actionUrl && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        window.open(notification.actionUrl, '_blank')
                                    }}
                                    className={`${priorityStyle.textColor} text-xs font-medium hover:underline`}
                                >
                                    View Details
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

// ============================================
// MAIN NOTIFICATIONS COMPONENT
// ============================================

interface RealTimeNotificationsProps {
    /** User role for filtering notifications */
    userRole: UserRole
    /** User ID for personalized notifications */
    userId: string
    /** Optional configuration overrides */
    config?: Partial<NotificationConfig>
    /** Callback when notification is dismissed */
    onDismiss?: (notification: NotificationItem) => void
    /** Callback when notification is marked as read */
    onMarkAsRead?: (notification: NotificationItem) => void
}

export const RealTimeNotifications: React.FC<RealTimeNotificationsProps> = ({
    userRole,
    userId,
    config = {},
    onDismiss,
    onMarkAsRead
}) => {
    const [notifications, setNotifications] = useState<NotificationItem[]>([])
    const [channels, setChannels] = useState<Map<string, RealtimeChannel>>(new Map())

    const finalConfig = useMemo(() => ({ ...DEFAULT_CONFIG, ...config }), [config])
    const supabase = createClient()

    // Convert real-time event to notification
    const createNotificationFromEvent = useCallback((event: AnyRealtimeEvent): NotificationItem => {
        const { metadata, payload } = event

        // Extract notification content based on event category
        let title = ''
        let message = ''
        let type: NotificationItem['type'] = 'info'

        switch (metadata.category) {
            case 'user_created':
                title = 'New User Created'
                message = `${payload.data.fullName} (${payload.data.email}) has joined the platform`
                type = 'success'
                break

            case 'user_activity':
                title = 'User Activity'
                message = payload.data.description || `${payload.data.userName} performed ${payload.data.action}`
                type = 'info'
                break

            case 'admin_action':
                title = 'Admin Action'
                message = `${payload.data.adminName} ${payload.data.description}`
                type = payload.data.actionType === 'warning' ? 'warning' : 'info'
                break

            case 'system_notification':
                title = payload.data.title || 'System Notification'
                message = payload.data.message
                type = payload.data.type || 'info'
                break
        }

        return {
            id: metadata.eventId,
            category: metadata.category,
            title,
            message,
            type,
            priority: metadata.priority,
            timestamp: metadata.timestamp,
            read: false,
            metadata: metadata.metadata,
            actionUrl: payload.data.actionUrl,
            expiresAt: payload.data.expiresAt
        }
    }, [])

    // Filter notifications based on user role
    const getFilteredNotifications = useCallback((event: AnyRealtimeEvent): boolean => {
        return event.metadata.targetRoles.includes(userRole)
    }, [userRole])

    // Set up real-time subscriptions
    useEffect(() => {
        const newChannels = new Map<string, RealtimeChannel>()

        const setupSubscriptions = async () => {
            // Subscribe to role-specific channels based on user role
            const channelsToSubscribe = [
                // Always subscribe to user activity for relevant users
                ...(userRole === 'admin' || userRole === 'user' ? ['dashboard-activity'] : []),

                // Admin-specific channels
                ...(userRole === 'admin' ? [
                    'dashboard-admin-shared',
                    'dashboard-admin-actions',
                    'notifications-admin'
                ] : []),

                // System notifications for all users
                'dashboard-system',
                'notifications-system'
            ]

            for (const channelName of channelsToSubscribe) {
                try {
                    const channel = supabase.channel(channelName)

                    channel.on('broadcast', { event: 'realtime-event' }, (payload) => {
                        const event = payload.payload as AnyRealtimeEvent

                        // Filter events based on user role
                        if (!getFilteredNotifications(event)) {
                            return
                        }

                        // Create notification from event
                        const notification = createNotificationFromEvent(event)

                        // Add notification to state
                        setNotifications(prev => {
                            // Remove existing notification with same ID
                            const filtered = prev.filter(n => n.id !== notification.id)

                            // Add new notification at the beginning
                            const updated = [notification, ...filtered]

                            // Limit to max notifications
                            return updated.slice(0, finalConfig.maxNotifications)
                        })

                        // Play sound if enabled
                        if (finalConfig.enableSounds) {
                            // Add sound notification logic here
                            console.log('🔊 Notification sound:', notification.type)
                        }
                    })

                    channel.on('broadcast', { event: 'realtime-events' }, (payload) => {
                        const { events } = payload.payload as { events: AnyRealtimeEvent[] }

                        // Process batch events
                        events.forEach((event: AnyRealtimeEvent) => {
                            if (!getFilteredNotifications(event)) {
                                return
                            }

                            const notification = createNotificationFromEvent(event)

                            setNotifications(prev => {
                                const filtered = prev.filter(n => n.id !== notification.id)
                                const updated = [notification, ...filtered]
                                return updated.slice(0, finalConfig.maxNotifications)
                            })
                        })
                    })

                    // Subscribe to channel
                    await channel.subscribe()
                    newChannels.set(channelName, channel)

                    console.log(`[NOTIFICATIONS] Subscribed to channel: ${channelName}`)
                } catch (error) {
                    console.error(`[NOTIFICATIONS] Failed to subscribe to channel ${channelName}:`, error)
                }
            }

            setChannels(newChannels)
        }

        setupSubscriptions()

        // Cleanup subscriptions on unmount
        return () => {
            newChannels.forEach((channel: RealtimeChannel) => {
                try {
                    supabase.removeChannel(channel)
                } catch (error) {
                    console.error('Error removing channel:', error)
                }
            })
            setChannels(new Map())
        }
    }, [userRole, userId, getFilteredNotifications, createNotificationFromEvent, finalConfig.maxNotifications, finalConfig.enableSounds, supabase])

    // Handle notification dismissal
    const handleDismiss = useCallback((notificationId: string) => {
        setNotifications(prev => prev.filter(n => n.id !== notificationId))

        const notification = notifications.find(n => n.id === notificationId)
        if (notification && onDismiss) {
            onDismiss(notification)
        }
    }, [notifications, onDismiss])

    // Handle marking notification as read
    const handleMarkAsRead = useCallback((notificationId: string) => {
        setNotifications(prev =>
            prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
        )

        const notification = notifications.find(n => n.id === notificationId)
        if (notification && onMarkAsRead) {
            onMarkAsRead({ ...notification, read: true })
        }
    }, [notifications, onMarkAsRead])

    // Clear all notifications
    const clearAll = useCallback(() => {
        setNotifications([])
    }, [])

    // Don't render if no notifications and not in development
    if (notifications.length === 0) {
        return null
    }

    return (
        <>
            {notifications.map(notification => (
                <NotificationItem
                    key={notification.id}
                    notification={notification}
                    onDismiss={handleDismiss}
                    onMarkAsRead={handleMarkAsRead}
                    config={finalConfig}
                />
            ))}

            {/* Clear All Button - shown when there are multiple notifications */}
            {notifications.length > 1 && (
                <div className={`fixed ${finalConfig.position === 'top-right' || finalConfig.position === 'bottom-right' ? 'right-4' : 'left-4'} z-40`}>
                    <button
                        onClick={clearAll}
                        className="bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 px-3 py-1 rounded-full text-xs font-medium hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors"
                    >
                        Clear All ({notifications.length})
                    </button>
                </div>
            )}
        </>
    )
}

// ============================================
// HOOK FOR NOTIFICATION STATE
// ============================================

export const useNotifications = (userRole: UserRole, userId: string, config?: Partial<NotificationConfig>) => {
    const [notifications, setNotifications] = useState<NotificationItem[]>([])
    const [unreadCount, setUnreadCount] = useState(0)

    // Update unread count whenever notifications change
    useEffect(() => {
        const unread = notifications.filter(n => !n.read).length
        setUnreadCount(unread)
    }, [notifications])

    const dismissNotification = useCallback((notificationId: string) => {
        setNotifications(prev => prev.filter(n => n.id !== notificationId))
    }, [])

    const markAsRead = useCallback((notificationId: string) => {
        setNotifications(prev =>
            prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
        )
    }, [])

    const clearAll = useCallback(() => {
        setNotifications([])
    }, [])

    const addNotification = useCallback((notification: Omit<NotificationItem, 'id' | 'timestamp' | 'read'>) => {
        const newNotification: NotificationItem = {
            ...notification,
            id: `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            timestamp: new Date().toISOString(),
            read: false
        }

        setNotifications(prev => [newNotification, ...prev])
    }, [])

    return {
        notifications,
        unreadCount,
        dismissNotification,
        markAsRead,
        clearAll,
        addNotification
    }
}

export default RealTimeNotifications