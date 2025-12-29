"use client"

import React from 'react'
import { motion, AnimatePresence } from "framer-motion"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import {
    LogIn,
    LogOut,
    UserPlus,
    UserRoundPen,
    LockKeyhole,
    Eye,
    Trash2,
    Settings,
    Download,
    Activity,
    Clock,
    AlertCircle
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"

export interface UserActivity {
    id: string
    user_id: string
    activity_type: string
    description: string | null
    created_at: string | null
    module?: string | null
    profiles?: {
        email: string
        full_name: string | null
        role: string
    }
}

interface ActivityLogFeedProps {
    activities: UserActivity[]
    isLoading?: boolean
    emptyMessage?: string
    maxItems?: number
    className?: string
    innerClassName?: string
    skeletonCount?: number
}

// Helper function to get activity type color
export const getActivityTypeColor = (type: string): string => {
    const typeColors: Record<string, string> = {
        login: "bg-green-500/20 text-green-700 dark:text-green-400 border-green-500/30",
        logout: "bg-slate-500/20 text-slate-700 dark:text-slate-400 border-slate-500/30",
        create: "bg-blue-500/20 text-blue-700 dark:text-blue-400 border-blue-500/30",
        add: "bg-blue-500/20 text-blue-700 dark:text-blue-400 border-blue-500/30",
        update: "bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-500/30",
        edit: "bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-500/30",
        delete: "bg-red-500/20 text-red-700 dark:text-red-400 border-red-500/30",
        remove: "bg-red-500/20 text-red-700 dark:text-red-400 border-red-500/30",
        view: "bg-violet-500/20 text-violet-700 dark:text-violet-400 border-violet-500/30",
        export: "bg-cyan-500/20 text-cyan-700 dark:text-cyan-400 border-cyan-500/30",
        import: "bg-indigo-500/20 text-indigo-700 dark:text-indigo-400 border-indigo-500/30",
        password: "bg-orange-500/20 text-orange-700 dark:text-orange-400 border-orange-500/30",
        data_create: "bg-blue-500/20 text-blue-700 dark:text-blue-400 border-blue-500/30",
        data_edit: "bg-purple-500/20 text-purple-700 dark:text-purple-400 border-purple-500/30",
        data_delete: "bg-red-500/20 text-red-700 dark:text-red-400 border-red-500/30",
    }
    const lowerType = type?.toLowerCase() || ""
    // Check for exact matches first
    if (typeColors[lowerType]) return typeColors[lowerType]

    // Check for partial matches
    for (const [key, value] of Object.entries(typeColors)) {
        if (lowerType.includes(key)) return value
    }
    return "bg-gray-500/20 text-gray-700 dark:text-gray-400 border-gray-500/30"
}

// Helper function to get activity icon
export const getActivityIcon = (type: string) => {
    const t = type.toLowerCase()
    if (t.includes('login')) return LogIn
    if (t.includes('logout')) return LogOut
    if (t.includes('create') || t.includes('add')) return UserPlus
    if (t.includes('profile_update')) return UserRoundPen
    if (t.includes('password')) return LockKeyhole
    if (t.includes('view')) return Eye
    if (t.includes('delete') || t.includes('remove') || t.includes('data_delete')) return Trash2
    if (t.includes('edit') || t.includes('update') || t.includes('data_edit')) return Settings
    if (t.includes('data_create')) return UserPlus
    if (t.includes('export')) return Download
    if (t.includes('import')) return Activity
    return Activity
}

export function ActivityLogFeed({
    activities,
    isLoading = false,
    emptyMessage = "No activities found",
    maxItems,
    className,
    innerClassName,
    skeletonCount = 10
}: ActivityLogFeedProps) {

    const displayActivities = maxItems ? activities.slice(0, maxItems) : activities

    if (isLoading) {
        return (
            <div className={cn("space-y-3", className)}>
                {[...Array(skeletonCount)].map((_, i) => (
                    <div
                        key={i}
                        className="flex items-start space-x-4 p-4 rounded-xl bg-muted/20 border border-border/40 animate-pulse"
                        style={{ animationDelay: `${i * 100}ms` }}
                    >
                        {/* Icon Skeleton */}
                        <div className="mt-0.5 p-2 rounded-lg bg-muted/50 flex-shrink-0">
                            <div className="h-5 w-5 rounded bg-muted-foreground/10" />
                        </div>

                        <div className="flex-1 space-y-3 min-w-0">
                            {/* Header row skeleton */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                    <Skeleton className="h-5 w-24 rounded-full" />
                                    <Skeleton className="h-4 w-32" />
                                </div>
                                <Skeleton className="h-4 w-28 rounded-full" />
                            </div>

                            {/* Description skeleton */}
                            <div className="space-y-2">
                                <Skeleton className="h-4 w-full" />
                                <Skeleton className="h-4 w-2/3" />
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        )
    }

    if (displayActivities.length === 0) {
        return (
            <div className={cn("flex flex-col items-center justify-center py-12 text-center space-y-3", className)}>
                <div className="p-4 rounded-full bg-muted/20">
                    <AlertCircle className="h-8 w-8 text-muted-foreground/40" />
                </div>
                <div>
                    <p className="text-sm font-medium text-muted-foreground">{emptyMessage}</p>
                    <p className="text-xs text-muted-foreground/60 px-4 max-w-xs mx-auto">
                        No activity records match your current criteria.
                    </p>
                </div>
            </div>
        )
    }

    return (
        <div className={cn("space-y-3", className)}>
            <AnimatePresence mode="popLayout">
                {displayActivities.map((activity, index) => {
                    const Icon = getActivityIcon(activity.activity_type)
                    const colorClass = getActivityTypeColor(activity.activity_type)

                    return (
                        <motion.div
                            key={activity.id}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                            transition={{ delay: Math.min(index * 0.05, 0.5), duration: 0.3 }}
                            className={cn(
                                "flex items-start gap-4 p-4 rounded-xl border transition-all duration-300",
                                "bg-background/40 hover:bg-background/80 group hover:shadow-md",
                                colorClass.split(' ').find(c => c.startsWith('border-')) || "border-border",
                                innerClassName
                            )}
                        >
                            <div className={cn(
                                "mt-0.5 p-2 rounded-lg shadow-sm transition-transform duration-300 group-hover:scale-110 flex-shrink-0",
                                colorClass.split(' ').filter(c => c.startsWith('bg-') || c.startsWith('text-')).join(' ')
                            )}>
                                <Icon className="h-5 w-5" />
                            </div>

                            <div className="flex-1 min-w-0">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <Badge
                                            className={cn(
                                                "w-fit capitalize font-bold text-[10px] tracking-widest px-2 py-0.5",
                                                colorClass
                                            )}
                                        >
                                            {activity.activity_type.replace(/_/g, ' ')}
                                        </Badge>
                                        {activity.profiles?.full_name && (
                                            <span className="text-[11px] font-bold text-muted-foreground bg-muted/30 px-2 py-0.5 rounded-full">
                                                {activity.profiles.full_name}
                                            </span>
                                        )}
                                        {activity.module && (
                                            <span className="text-[10px] font-semibold text-primary/60 bg-primary/5 border border-primary/10 px-2 py-0.5 rounded-md uppercase tracking-tight">
                                                {activity.module}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center text-[11px] text-muted-foreground font-medium bg-muted/50 px-2 py-0.5 rounded-full w-fit">
                                        <Clock className="h-3 w-3 mr-1" />
                                        {activity.created_at ? format(new Date(activity.created_at), "MMM dd, yyyy HH:mm:ss") : "N/A"}
                                    </div>
                                </div>
                                <p className="text-sm font-medium leading-relaxed tracking-tight text-foreground/90 break-words">
                                    {activity.description || "No description provided"}
                                </p>
                            </div>
                        </motion.div>
                    )
                })}
            </AnimatePresence>
        </div>
    )
}
