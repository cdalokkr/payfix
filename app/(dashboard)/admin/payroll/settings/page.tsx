'use client';

import React from 'react';
import { DashboardPageLayout } from "@/components/dashboard/dashboard-page-layout";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Cpu, Building2, Monitor } from "lucide-react";

import { AdminOfficeHub } from "@/features/settings/AdminOfficeHub";
import { BiometricDevicesManager } from "@/features/settings/BiometricDevicesManager";
import { AdminKioskDevices } from "@/features/settings/AdminKioskDevices";

export default function AdminSettingsPage() {
    return (
        <div className="min-h-screen bg-background">
            <DashboardPageLayout
                heading="Payroll & Attendance Settings"
                description="Manage office branches, shift timings, weekly schedules, regional & national holidays, biometric devices, and express selfie kiosks"
            >
                <Tabs defaultValue="locations" className="w-full space-y-6">
                    {/* Modern Settings Navigation Tabs */}
                    <TabsList className="w-full justify-start overflow-x-auto p-1 bg-muted/70 rounded-xl border border-border h-auto gap-1">
                        <TabsTrigger value="locations" className="py-2.5 px-4 font-semibold data-[state=active]:bg-card data-[state=active]:shadow-sm">
                            <Building2 className="h-4 w-4 mr-2 text-indigo-600 dark:text-indigo-400" />
                            Office Locations, Schedules & Holidays
                        </TabsTrigger>
                        <TabsTrigger value="biometric" className="py-2.5 px-4 font-semibold data-[state=active]:bg-card data-[state=active]:shadow-sm">
                            <Cpu className="h-4 w-4 mr-2 text-emerald-600 dark:text-emerald-400" />
                            eSSL Biometric Devices
                        </TabsTrigger>
                        <TabsTrigger value="kiosk" className="py-2.5 px-4 font-semibold data-[state=active]:bg-card data-[state=active]:shadow-sm">
                            <Monitor className="h-4 w-4 mr-2 text-sky-600 dark:text-sky-400" />
                            Express Selfie Kiosk
                        </TabsTrigger>
                    </TabsList>

                    {/* Tab 1: Unified Office Hub (Locations, Timings, Schedules, Absent Rule, Holidays) */}
                    <TabsContent value="locations" className="space-y-6 focus-visible:outline-none">
                        <ErrorBoundary level="section">
                            <AdminOfficeHub />
                        </ErrorBoundary>
                    </TabsContent>

                    {/* Tab 2: Universal eSSL Biometric Devices */}
                    <TabsContent value="biometric" className="space-y-6 focus-visible:outline-none">
                        <ErrorBoundary level="section">
                            <BiometricDevicesManager />
                        </ErrorBoundary>
                    </TabsContent>

                    {/* Tab 3: Express Selfie Kiosk Terminal Setup */}
                    <TabsContent value="kiosk" className="space-y-6 focus-visible:outline-none">
                        <ErrorBoundary fallback={<div className="p-4 text-sm text-red-500">Error loading kiosk terminal settings</div>}>
                            <AdminKioskDevices />
                        </ErrorBoundary>
                    </TabsContent>
                </Tabs>
            </DashboardPageLayout>
        </div>
    );
}
