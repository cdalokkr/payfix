'use client';

import React from 'react';
import { DashboardPageLayout } from "@/components/dashboard/dashboard-page-layout";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Cpu, Building2, Monitor, Clock, Users, CalendarDays } from "lucide-react";

import { AdminOfficeHub } from "@/features/settings/AdminOfficeHub";
import { BiometricDevicesManager } from "@/features/settings/BiometricDevicesManager";
import { AdminKioskDevices } from "@/features/settings/AdminKioskDevices";
import DepartmentManagement from "@/features/departments/DepartmentManagement";
import ShiftManagementHub from "@/features/shifts/ShiftManagementHub";
import DepartmentRosterBoard from "@/features/shifts/DepartmentRosterBoard";

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
                            Office Locations & Holidays
                        </TabsTrigger>
                        <TabsTrigger value="departments" className="py-2.5 px-4 font-semibold data-[state=active]:bg-card data-[state=active]:shadow-sm">
                            <Users className="h-4 w-4 mr-2 text-blue-600 dark:text-blue-400" />
                            Departments
                        </TabsTrigger>
                        <TabsTrigger value="shifts" className="py-2.5 px-4 font-semibold data-[state=active]:bg-card data-[state=active]:shadow-sm">
                            <Clock className="h-4 w-4 mr-2 text-amber-600 dark:text-amber-400" />
                            Shift Management & Rotation
                        </TabsTrigger>
                        <TabsTrigger value="roster" className="py-2.5 px-4 font-semibold data-[state=active]:bg-card data-[state=active]:shadow-sm">
                            <CalendarDays className="h-4 w-4 mr-2 text-purple-600 dark:text-purple-400" />
                            Department Roster Board
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

                    {/* Tab 2: Departments Management */}
                    <TabsContent value="departments" className="space-y-6 focus-visible:outline-none">
                        <ErrorBoundary level="section">
                            <DepartmentManagement />
                        </ErrorBoundary>
                    </TabsContent>

                    {/* Tab 3: Shift Management & Rotations Hub */}
                    <TabsContent value="shifts" className="space-y-6 focus-visible:outline-none">
                        <ErrorBoundary level="section">
                            <ShiftManagementHub />
                        </ErrorBoundary>
                    </TabsContent>

                    {/* Tab 4: Department Roster Board */}
                    <TabsContent value="roster" className="space-y-6 focus-visible:outline-none">
                        <ErrorBoundary level="section">
                            <DepartmentRosterBoard />
                        </ErrorBoundary>
                    </TabsContent>

                    {/* Tab 5: Universal eSSL Biometric Devices */}
                    <TabsContent value="biometric" className="space-y-6 focus-visible:outline-none">
                        <ErrorBoundary level="section">
                            <BiometricDevicesManager />
                        </ErrorBoundary>
                    </TabsContent>

                    {/* Tab 6: Express Selfie Kiosk Terminal Setup */}
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
