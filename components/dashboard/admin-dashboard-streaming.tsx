'use client'

import React from 'react'
import { ErrorBoundary } from '@/components/ui/error-boundary'
import { AdminOverview } from '@/components/dashboard/admin-overview'
import { DashboardPageLayout } from '@/components/dashboard/dashboard-page-layout'

// Streaming wrapper component for admin dashboard
export function AdminDashboardStreaming({ initialData }: { initialData?: any }) {
  return (
    <ErrorBoundary level="page" onError={(error, errorInfo) => {
      console.error('Admin Dashboard Error:', error, errorInfo)
    }}>
      <div className="min-h-screen bg-background">
        <DashboardPageLayout
          heading="Admin Dashboard"
          description="Overview of your application metrics and activities"
        >
          <ErrorBoundary level="section">
            <AdminOverview initialData={initialData} />
          </ErrorBoundary>
        </DashboardPageLayout>
      </div>
    </ErrorBoundary>
  )
}

// Tier-based streaming components for progressive loading
export function CriticalDataStreaming() {
  return (
    <ErrorBoundary level="section">
      <AdminOverview onLoadingChange={(loading) => {
        // Track critical data loading state
        console.log('Critical data loading:', loading)
      }} />
    </ErrorBoundary>
  )
}

export default AdminDashboardStreaming