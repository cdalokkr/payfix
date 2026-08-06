'use client';

import React from 'react';
import { DashboardPageLayout } from "@/components/dashboard/dashboard-page-layout";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Cpu, Clock, MapPin, Monitor, ExternalLink, Zap, ShieldCheck } from "lucide-react";
import Link from 'next/link';

import { AdminOfficeSettings } from "@/features/attendance/AdminOfficeSettings";
import { AdminOfficeLocations } from "@/features/settings/AdminOfficeLocations";
import { BiometricDevicesManager } from "@/features/settings/BiometricDevicesManager";
import { AdminKioskDevices } from "@/features/settings/AdminKioskDevices";


export default function AdminSettingsPage() {
    const kioskUrl = typeof window !== 'undefined' ? `${window.location.origin}/kiosk` : '/kiosk';

    return (
        <div className="min-h-screen bg-background">
            <DashboardPageLayout
                heading="Payroll & Attendance Settings"
                description="Configure eSSL biometric machines, entrance kiosk terminals, geofence office locations, and working shift timings"
            >
                <Tabs defaultValue="biometric" className="w-full space-y-6">
                    {/* Modern Settings Navigation Tabs */}
                    <TabsList className="w-full justify-start overflow-x-auto p-1 bg-muted/70 rounded-xl border border-border h-auto gap-1">
                        <TabsTrigger value="biometric" className="py-2.5 px-4 font-semibold data-[state=active]:bg-card data-[state=active]:shadow-sm">
                            <Cpu className="h-4 w-4 mr-2 text-emerald-600 dark:text-emerald-400" />
                            eSSL Biometric Devices
                        </TabsTrigger>
                        <TabsTrigger value="timings" className="py-2.5 px-4 font-semibold data-[state=active]:bg-card data-[state=active]:shadow-sm">
                            <Clock className="h-4 w-4 mr-2 text-indigo-600 dark:text-indigo-400" />
                            Shift Timings & Off-Days
                        </TabsTrigger>
                        <TabsTrigger value="locations" className="py-2.5 px-4 font-semibold data-[state=active]:bg-card data-[state=active]:shadow-sm">
                            <MapPin className="h-4 w-4 mr-2 text-amber-600 dark:text-amber-400" />
                            Office Geofence Locations
                        </TabsTrigger>
                        <TabsTrigger value="kiosk" className="py-2.5 px-4 font-semibold data-[state=active]:bg-card data-[state=active]:shadow-sm">
                            <Monitor className="h-4 w-4 mr-2 text-sky-600 dark:text-sky-400" />
                            Express Selfie Kiosk
                        </TabsTrigger>
                    </TabsList>

                    {/* Tab 1: Universal eSSL Biometric Devices */}
                    <TabsContent value="biometric" className="space-y-6 focus-visible:outline-none">
                        <ErrorBoundary level="section">
                            <BiometricDevicesManager />
                        </ErrorBoundary>
                    </TabsContent>

                    {/* Tab 2: Shift Timings & Working Days */}
                    <TabsContent value="timings" className="space-y-6 focus-visible:outline-none">
                        <ErrorBoundary level="section">
                            <AdminOfficeSettings />
                        </ErrorBoundary>
                    </TabsContent>

                    {/* Tab 3: Office Geofence Locations */}
                    <TabsContent value="locations" className="space-y-6 focus-visible:outline-none">
                        <ErrorBoundary level="section">
                            <AdminOfficeLocations />
                        </ErrorBoundary>
                    </TabsContent>

                    {/* Tab 4: Express Selfie Kiosk Terminal Setup */}
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


