'use client'

import React, { useState, useEffect } from 'react'
import { Bell } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover'
import { Badge } from '@/components/ui/badge'
import { useNotifications } from '@/hooks/use-notifications'
import { cn } from '@/lib/utils'
import { formatDistanceToNow } from 'date-fns'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'

function NotificationBellComponent() {
    const [open, setOpen] = useState(false)
    const { notifications, unreadCount, markAsRead, markAllAsRead, isLoading, isSubscribed } = useNotifications()

    const handleNotificationClick = (notification: typeof notifications[0]) => {
        if (!notification.is_read) {
            markAsRead(notification.id)
        }
        if (notification.link) {
            setOpen(false)
        }
    }

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <div suppressHydrationWarning>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="relative h-9 w-9 hover:bg-accent/50"
                    >
                        <Bell className="h-5 w-5" />
                        <AnimatePresence>
                            {unreadCount > 0 && (
                                <motion.div
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    exit={{ scale: 0 }}
                                    className="absolute -top-1 -right-1"
                                >
                                    <Badge
                                        variant="destructive"
                                        className="h-5 min-w-5 px-1 flex items-center justify-center text-xs font-semibold"
                                    >
                                        {unreadCount > 99 ? '99+' : unreadCount}
                                    </Badge>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </Button>
                </div>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0" align="end">
                <div className="flex items-center justify-between p-4 border-b">
                    <h3 className="font-semibold">Notifications</h3>
                    {unreadCount > 0 && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => markAllAsRead()}
                            className="h-auto p-1 text-xs hover:bg-transparent hover:text-primary"
                        >
                            Mark all read
                        </Button>
                    )}
                </div>
                <div className="max-h-[400px] overflow-y-auto">
                    {isLoading ? (
                        <div className="p-4 text-center text-sm text-muted-foreground">
                            Loading notifications...
                        </div>
                    ) : notifications.length === 0 ? (
                        <div className="p-8 text-center">
                            <Bell className="h-12 w-12 mx-auto text-muted-foreground/50 mb-2" />
                            <p className="text-sm text-muted-foreground">No notifications yet</p>
                        </div>
                    ) : (
                        <div className="divide-y">
                            {notifications.map((notification) => {
                                return (
                                    <div
                                        key={notification.id}
                                        className={cn(
                                            'p-4 transition-colors',
                                            !notification.is_read && 'bg-accent/20'
                                        )}
                                    >
                                        <div className="flex items-start gap-3">
                                            <div className={cn(
                                                'h-2 w-2 rounded-full mt-2 flex-shrink-0',
                                                !notification.is_read ? 'bg-primary' : 'bg-transparent'
                                            )} />
                                            <div className="flex-1 min-w-0">
                                                <p className={cn(
                                                    'text-sm mb-1',
                                                    !notification.is_read && 'font-semibold'
                                                )}>
                                                    {notification.title}
                                                </p>
                                                <p className="text-xs text-muted-foreground line-clamp-2">
                                                    {notification.message}
                                                </p>
                                                <p className="text-xs text-muted-foreground/70 mt-1">
                                                    {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                                                </p>
                                                {/* Action buttons */}
                                                <div className="flex items-center gap-2 mt-2">
                                                    {notification.link && (
                                                        <Link
                                                            href={notification.link}
                                                            onClick={() => {
                                                                if (!notification.is_read) {
                                                                    markAsRead(notification.id)
                                                                }
                                                                setOpen(false)
                                                            }}
                                                            className="text-xs text-primary hover:underline font-medium"
                                                        >
                                                            View
                                                        </Link>
                                                    )}
                                                    {!notification.is_read && (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation()
                                                                markAsRead(notification.id)
                                                            }}
                                                            className="text-xs text-muted-foreground hover:text-foreground"
                                                        >
                                                            Mark as read
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>

            </PopoverContent>
        </Popover>
    )
}

// Memoize to prevent re-renders
export const NotificationBell = React.memo(NotificationBellComponent)
