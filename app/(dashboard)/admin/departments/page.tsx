'use client';

import React, { Suspense } from 'react';
import { DashboardPageLayout } from "@/components/dashboard/dashboard-page-layout";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import UnifiedOrganizationManagement from "@/features/organization/UnifiedOrganizationManagement";

export default function DepartmentsPage() {
    return (
        <div className="min-h-screen bg-background">
            <DashboardPageLayout
                heading="Organization Structure"
                description="Manage organizational departments, designations, assigned managers, and shift duty rosters."
            >
                <div className="space-y-6">
                    <ErrorBoundary level="section">
                        <Suspense fallback={<div className="h-48 flex items-center justify-center text-muted-foreground animate-pulse">Loading Organization Structure...</div>}>
                            <UnifiedOrganizationManagement defaultTab="departments" />
                        </Suspense>
                    </ErrorBoundary>
                </div>
            </DashboardPageLayout>
        </div>
    );
}
