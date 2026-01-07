'use client'

import React from 'react'
import { ErrorBoundary } from '@/components/ui/error-boundary'
import { UserOverview } from '@/components/dashboard/user-overview'
import { DashboardPageLayout } from '@/components/dashboard/dashboard-page-layout'
import { useProfile } from '@/lib/context/profile-context'

import { Skeleton } from '@/components/ui/skeleton'

// Streaming wrapper component for user dashboard
export function UserDashboardStreaming() {
    const { profile, isLoading } = useProfile()

    if (isLoading) {
        return (
            <DashboardPageLayout>
                <div className="space-y-6">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <Skeleton className="h-48 rounded-xl" />
                        <Skeleton className="h-48 rounded-xl" />
                    </div>
                    <Skeleton className="h-64 rounded-xl" />
                </div>
            </DashboardPageLayout>
        )
    }

    return (
        <ErrorBoundary level="page" onError={(error, errorInfo) => {
            console.error('User Dashboard Error:', error, errorInfo)
        }}>
            <div className="min-h-screen bg-background">
                <DashboardPageLayout
                    heading="Moderator Dashboard"
                    description="Overview of your profile and recent activities"
                >
                    <ErrorBoundary level="section">
                        <UserOverview
                            profile={profile}
                            onLoadingChange={(loading) => {
                                // Determine if we should show global loading state
                                // For now just log it or ignore if handled locally
                                // console.log('User dashboard loading:', loading)
                            }}
                        />
                    </ErrorBoundary>
                </DashboardPageLayout>
            </div>
        </ErrorBoundary>
    )
}

export default UserDashboardStreaming
