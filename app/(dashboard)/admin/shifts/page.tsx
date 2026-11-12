'use client';

import React from 'react';
import { DashboardPageLayout } from "@/components/dashboard/dashboard-page-layout";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import ShiftManagementHub from "@/features/shifts/ShiftManagementHub";

export default function ShiftsPage() {
    return (
        <div className="min-h-screen bg-background">
            <DashboardPageLayout
                heading="Shift Management & Rotation"
                description="Configure office branch shifts, duty hour rules, multi-shift allocations, and rotation cycles."
            >
                <div className="space-y-6">
                    <ErrorBoundary level="section">
                        <ShiftManagementHub />
                    </ErrorBoundary>
                </div>
            </DashboardPageLayout>
        </div>
    );
}
