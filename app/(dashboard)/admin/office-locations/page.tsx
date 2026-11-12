'use client';

import React from 'react';
import { DashboardPageLayout } from "@/components/dashboard/dashboard-page-layout";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { AdminOfficeHub } from "@/features/settings/AdminOfficeHub";

export default function OfficeLocationsPage() {
    return (
        <div className="min-h-screen bg-background">
            <DashboardPageLayout
                heading="Office Locations & Holidays"
                description="Configure office branch geofencing, daily operating hours, weekly off-days, and annual holiday closures."
            >
                <div className="space-y-6">
                    <ErrorBoundary level="section">
                        <AdminOfficeHub />
                    </ErrorBoundary>
                </div>
            </DashboardPageLayout>
        </div>
    );
}
