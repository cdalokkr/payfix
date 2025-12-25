'use client'

import { PageErrorBoundary } from '@/components/ui/error-boundary'
import { UserDashboardStreaming } from '@/components/dashboard/user-dashboard-streaming'
import EmployeeDashboard from '@/components/dashboard/employee-dashboard'
import { trpc } from '@/lib/trpc/client'
import { Loader2 } from 'lucide-react'

export default function UserDashboardPage() {
  const { data: profile, isLoading, error } = trpc.profile.get.useQuery(undefined, {
    staleTime: 60 * 1000, // 1 minute
    retry: 2,
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error || !profile) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">
          {error?.message || 'Profile not found'}
        </p>
      </div>
    )
  }

  // Employee Dashboard
  if (profile.role === 'employee') {
    return (
      <PageErrorBoundary>
        <EmployeeDashboard />
      </PageErrorBoundary>
    )
  }

  // Moderator / Standard User Dashboard (Backoffice)
  return (
    <PageErrorBoundary>
      <UserDashboardStreaming />
    </PageErrorBoundary>
  )
}