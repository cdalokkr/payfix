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
                        <Card className="border-border bg-card shadow-sm">
                            <CardHeader>
                                <div className="flex items-start justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2.5 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400">
                                            <Monitor className="h-5 w-5" />
                                        </div>
                                        <div>
                                            <CardTitle className="text-xl font-bold text-foreground">
                                                Express Selfie Kiosk Setup
                                            </CardTitle>
                                            <CardDescription className="text-muted-foreground mt-0.5">
                                                Mount any Tablet, iPad, or Smartphone at your office entrance for Always-On face recognition attendance.
                                            </CardDescription>
                                        </div>
                                    </div>
                                    <Badge variant="outline" className="border-sky-500/40 text-sky-600 dark:text-sky-400 font-semibold px-3 py-1">
                                        Offline First (&lt;300ms)
                                    </Badge>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="p-4 rounded-xl bg-card border border-border space-y-3">
                                    <h4 className="font-bold text-sm text-foreground">Kiosk Terminal URL</h4>
                                    <div className="flex items-center gap-3">
                                        <code className="flex-1 p-3 rounded-lg bg-muted text-sky-700 dark:text-sky-400 font-mono text-sm border border-border font-bold">
                                            {kioskUrl}
                                        </code>
                                        <Button asChild size="lg" className="bg-sky-600 hover:bg-sky-700 text-white font-bold">
                                            <Link href="/kiosk" target="_blank">
                                                Launch Kiosk Terminal <ExternalLink className="h-4 w-4 ml-2" />
                                            </Link>
                                        </Button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                                    <div className="p-4 rounded-xl bg-card border border-border space-y-1">
                                        <div className="flex items-center gap-2 font-bold text-foreground">
                                            <ShieldCheck className="h-4 w-4 text-emerald-500" /> Local Vector Cache
                                        </div>
                                        <p className="text-xs text-muted-foreground">
                                            Automatically downloads face vectors for ALL active employees into local IndexedDB.
                                        </p>
                                    </div>

                                    <div className="p-4 rounded-xl bg-card border border-border space-y-1">
                                        <div className="flex items-center gap-2 font-bold text-foreground">
                                            <Zap className="h-4 w-4 text-amber-500" /> Offline Resiliency
                                        </div>
                                        <p className="text-xs text-muted-foreground">
                                            Works 100% offline during network outages; stores punches in local queue and auto-syncs when online.
                                        </p>
                                    </div>

                                    <div className="p-4 rounded-xl bg-card border border-border space-y-1">
                                        <div className="flex items-center gap-2 font-bold text-foreground">
                                            <Clock className="h-4 w-4 text-sky-500" /> Multi-Session Integration
                                        </div>
                                        <p className="text-xs text-muted-foreground">
                                            Smartly toggles Check-In and Check-Out sessions for employees throughout the day.
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </DashboardPageLayout>
        </div>
    );
}


