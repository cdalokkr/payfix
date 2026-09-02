'use client'

import React from 'react'
import { NextErrorBoundary } from '@/components/ui/next-error-boundary'
import { AdminOverview } from '@/components/dashboard/admin-overview'
import { DashboardPageLayout } from '@/components/dashboard/dashboard-page-layout'

// Streaming wrapper component for admin dashboard
export function AdminDashboardStreaming({ initialData }: { initialData?: any }) {
  return (
    <NextErrorBoundary title="Admin dashboard could not load">
      <div className="min-h-screen bg-background">
        <DashboardPageLayout
          heading="Admin Dashboard"
          description="Overview of your application metrics and activities"
        >
          <NextErrorBoundary title="Dashboard overview could not load">
            <AdminOverview initialData={initialData} />
          </NextErrorBoundary>
        </DashboardPageLayout>
      </div>
    </NextErrorBoundary>
  )
}

// Tier-based streaming components for progressive loading
export function CriticalDataStreaming() {
  return (
    <NextErrorBoundary title="Critical dashboard data could not load">
      <AdminOverview onLoadingChange={(loading) => {
        // Track critical data loading state
        console.log('Critical data loading:', loading)
      }} />
    </NextErrorBoundary>
  )
}

export default AdminDashboardStreaming