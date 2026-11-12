'use client';

import React from 'react';
import { DashboardPageLayout } from "@/components/dashboard/dashboard-page-layout";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Cpu, Monitor } from "lucide-react";
import { BiometricDevicesManager } from "@/features/settings/BiometricDevicesManager";
import { AdminKioskDevices } from "@/features/settings/AdminKioskDevices";

export default function DevicesPage() {
    return (
        <div className="min-h-screen bg-background">
            <DashboardPageLayout
                heading="Biometric & Kiosk Devices"
                description="Manage hardware fingerprint/facial biometric machines and express selfie kiosk tablets."
            >
                <Tabs defaultValue="biometric" className="w-full space-y-6">
                    <TabsList className="w-full max-w-md justify-start overflow-x-auto p-1 bg-muted/70 rounded-xl border border-border h-auto gap-1">
                        <TabsTrigger value="biometric" className="py-2.5 px-4 font-semibold data-[state=active]:bg-card data-[state=active]:shadow-sm">
                            <Cpu className="h-4 w-4 mr-2 text-emerald-600 dark:text-emerald-400" />
                            eSSL Biometric Devices
                        </TabsTrigger>
                        <TabsTrigger value="kiosk" className="py-2.5 px-4 font-semibold data-[state=active]:bg-card data-[state=active]:shadow-sm">
                            <Monitor className="h-4 w-4 mr-2 text-sky-600 dark:text-sky-400" />
                            Express Selfie Kiosk
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="biometric" className="space-y-6 focus-visible:outline-none">
                        <ErrorBoundary level="section">
                            <BiometricDevicesManager />
                        </ErrorBoundary>
                    </TabsContent>

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
