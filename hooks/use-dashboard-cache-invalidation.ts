'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { trpc } from '@/lib/trpc/client'

/**
 * Dashboard Cache Invalidation Hook
 * 
 * Uses Supabase real-time subscriptions to invalidate dashboard cache
 * when relevant data changes (profiles, activities).
 * 
 * This ensures cached dashboard data stays fresh while maintaining
 * 10-minute cache TTL for performance.
 */
export function useDashboardCacheInvalidation(disabled = false) {
    const utils = trpc.useUtils()

    useEffect(() => {
        if (disabled) return

        const supabase = createClient()

        // Subscribe to profiles table changes (new users, role changes)
        const profilesChannel = supabase
            .channel('dashboard-profiles-invalidation')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'profiles'
                },
                () => {
                    console.log('[DASHBOARD-CACHE] Profiles changed, invalidating dashboard cache...')
                    // Invalidate admin dashboard queries
                    utils.admin.dashboard.getUnifiedDashboardData.invalidate()
                }
            )
            .subscribe()

        // Subscribe to activities table changes (new activities)
        const activitiesChannel = supabase
            .channel('dashboard-activities-invalidation')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'activities'
                },
                () => {
                    console.log('[DASHBOARD-CACHE] New activity detected, invalidating dashboard cache...')
                    // Invalidate admin dashboard queries
                    utils.admin.dashboard.getUnifiedDashboardData.invalidate()
                }
            )
            .subscribe()

        // Cleanup subscriptions on unmount
        return () => {
            profilesChannel.unsubscribe()
            activitiesChannel.unsubscribe()
        }
    }, [utils, disabled])
}
