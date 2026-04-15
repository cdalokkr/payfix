'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { format, isValid } from 'date-fns'
import {
    Activity,
    LogIn,
    LogOut,
    UserPlus,
    UserRoundPen,
    Eye,
    Trash2,
    Settings,
    AlertCircle,
    LockKeyhole
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Activity as ActivityType } from '@/types'

interface RecentActivitiesProps {
    activities: (ActivityType & { profiles?: { email: string; full_name: string; role: string } })[] | any[]
    loading: boolean
    showRoleHighlight?: boolean
    className?: string
}

const getActivityIcon = (type: string) => {
    const t = type.toLowerCase()
    if (t.includes('login')) return LogIn
    if (t.includes('logout')) return LogOut
    if (t.includes('create') || t.includes('add')) return UserPlus
    if (t.includes('profile_update')) return UserRoundPen
    if (t.includes('password')) return LockKeyhole
    if (t.includes('view')) return Eye
    if (t.includes('delete') || t.includes('remove')) return Trash2
    if (t.includes('edit') || t.includes('update')) return Settings
    return Activity
}

export function RecentActivities({
    activities,
    loading,
    showRoleHighlight = false,
    className
}: RecentActivitiesProps) {

    if (loading) {
        return (
            <div className={cn("space-y-3", className)}>
                {[...Array(5)].map((_, i) => (
                    <div key={i} className="flex items-center space-x-3 p-3 rounded-xl bg-muted/30 animate-pulse border border-transparent">
                        <div className="h-9 w-9 bg-muted/50 rounded-lg" />
                        <div className="flex-1 space-y-2">
                            <div className="h-4 bg-muted/50 rounded w-3/4" />
                            <div className="h-3 bg-muted/40 rounded w-1/4" />
                        </div>
                    </div>
                ))}
            </div>
        )
    }

    if (!activities || activities.length === 0) {
        return (
            <div className={cn("flex flex-col items-center justify-center py-10 text-center space-y-3", className)}>
                <div className="p-4 rounded-full bg-muted/20">
                    <AlertCircle className="h-8 w-8 text-muted-foreground/40" />
                </div>
                <div>
                    <p className="text-sm font-medium text-muted-foreground">No recent activities</p>
                    <p className="text-xs text-muted-foreground/60">Activities will appear here once they occur.</p>
                </div>
            </div>
        )
    }

    // Sort activities by date decending
    const sortedActivities = [...activities].sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    ).slice(0, 10)

    return (
        <div className={cn("space-y-2 border border-border/50 rounded-2xl p-3 bg-background/50", className)}>
            {sortedActivities.map((activity, index) => {
                const Icon = getActivityIcon(activity.activity_type)
                const role = activity.profiles?.role || 'user'
                const isAdmin = role === 'admin'

                // Use highlighting logic if enabled (primarily for Admin view)
                const isHighlighted = showRoleHighlight && isAdmin

                return (
                    <motion.div
                        key={activity.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05, duration: 0.3 }}
                        className={cn(
                            "flex items-center space-x-3 p-2.5 rounded-xl transition-all duration-300 border border-transparent",
                            "group hover:shadow-sm",
                            isHighlighted
                                ? "bg-primary/5 dark:bg-primary/10 hover:bg-primary/10 dark:hover:bg-primary/20 hover:border-primary/20 dark:hover:border-primary/30"
                                : "bg-muted/30 hover:bg-muted/60 hover:border-border/50"
                        )}
                    >
                        <div className={cn(
                            "p-2 rounded-lg shadow-sm bg-background text-primary transition-transform duration-300 group-hover:scale-110"
                        )}>
                            <Icon className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0 pt-0.5">
                            <p className="text-sm font-medium leading-relaxed tracking-tight">
                                {activity.description || activity.activity_type}
                            </p>
                            <p className="text-[11px] text-muted-foreground/70 mt-1 font-medium tracking-wide flex items-center gap-1.5">
                                <span className="inline-block w-1 h-1 rounded-full bg-muted-foreground/30" />
                                {activity.created_at && isValid(new Date(activity.created_at)) ? format(new Date(activity.created_at), "dd/MM/yyyy HH:mm:ss") : "N/A"}
                            </p>
                        </div>
                    </motion.div>
                )
            })}
        </div>
    )
}
