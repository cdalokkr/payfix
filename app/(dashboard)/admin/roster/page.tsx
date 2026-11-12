'use client';

import React from 'react';
import { DashboardPageLayout } from "@/components/dashboard/dashboard-page-layout";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import DepartmentRosterBoard from "@/features/shifts/DepartmentRosterBoard";

export default function RosterPage() {
    return (
        <div className="min-h-screen bg-background">
            <DashboardPageLayout
                heading="Department Duty Roster Board"
                description="Weekly duty board for department shift allocation, urgent absence, and manager operations."
            >
                <div className="space-y-6">
                    <ErrorBoundary level="section">
                        <DepartmentRosterBoard />
                    </ErrorBoundary>
                </div>
            </DashboardPageLayout>
        </div>
    );
}
