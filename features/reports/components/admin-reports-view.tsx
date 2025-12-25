"use client"

import React from 'react'
import { DashboardPageLayout } from "@/components/dashboard/dashboard-page-layout"
import { ReportsTab } from "./reports-tab"

export function AdminReportsView() {
  return (
    <DashboardPageLayout
      heading="Reports"
      description="Generate and download data exports in CSV or PDF format"
    >
      <ReportsTab role="admin" />
    </DashboardPageLayout>
  )
}
