"use client"

import React from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { MapPin as IconMapPin, Camera as IconCamera, AlertTriangle as IconAlertTriangle, RefreshCw as IconRefresh, Lock as IconLock } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { usePermissionCheck, type PermissionStatus } from "@/hooks/use-permission-check"
import { usePwaCheck } from "@/hooks/use-pwa-check"

interface PermissionGuardProps {
    children: React.ReactNode
    showOnlyIfDenied?: boolean
}

export function PermissionGuard({ children, showOnlyIfDenied = false }: PermissionGuardProps) {
    const { isPwa, isReady } = usePwaCheck()
    const {
        locationStatus,
        cameraStatus,
        isChecking,
        allGranted,
        requestPermissions
    } = usePermissionCheck()

    // CRITICAL: Don't block during initial render or PWA status check
    // Show children immediately while we determine if this is a PWA
    if (!isReady) {
        return <>{children}</>
    }

    // Bypass if not PWA - only enforce permissions in installed PWA mode
    if (!isPwa) {
        return <>{children}</>
    }

    if (allGranted) {
        return <>{children}</>
    }

    // If we only want to block if explicitly denied
    if (showOnlyIfDenied && locationStatus !== 'denied' && cameraStatus !== 'denied') {
        return <>{children}</>
    }

    return (
        <AnimatePresence>
            {!allGranted && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[100] bg-background/80 backdrop-blur-md flex flex-col items-center justify-center p-4 overflow-y-auto"
                >
                    {/* App Branding */}
                    <motion.div
                        initial={{ y: -20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        className="mb-8 flex flex-col items-center gap-3"
                    >
                        <div className="w-20 h-20 bg-white rounded-[1.5rem] flex items-center justify-center shadow-2xl border-4 border-white overflow-hidden">
                            <img
                                src="/icons/icon-192x192.png"
                                alt="PayFix Logo"
                                className="w-full h-full object-cover"
                            />
                        </div>
                        <div className="text-center">
                            <h1 className="text-2xl font-black tracking-tight leading-none text-gray-900">PayFix</h1>
                            <p className="text-[10px] text-blue-600 font-bold uppercase tracking-[0.2em] mt-2">Mobile Attendance</p>
                        </div>
                    </motion.div>

                    <motion.div
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.9, opacity: 0 }}
                    >
                        <Card className="w-full max-w-sm border-2 border-primary/20 shadow-2xl rounded-[2.5rem] overflow-hidden">
                            <CardHeader className="text-center pt-8">
                                <div className="mx-auto w-20 h-20 rounded-[2rem] bg-primary/10 flex items-center justify-center mb-6 relative">
                                    <IconLock className="w-10 h-10 text-primary" />
                                    <motion.div
                                        animate={{ scale: [1, 1.2, 1] }}
                                        transition={{ repeat: Infinity, duration: 2 }}
                                        className="absolute -top-1 -right-1 w-4 h-4 bg-primary rounded-full border-4 border-white"
                                    />
                                </div>
                                <CardTitle className="text-2xl font-black tracking-tight">Access Required</CardTitle>
                                <CardDescription className="px-4 font-medium">
                                    PayFix needs camera and location access for secure attendance.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6 pb-8">
                                <div className="space-y-3">
                                    {/* Location Status */}
                                    <div className="flex items-center justify-between p-4 rounded-2xl bg-muted/50 border border-transparent hover:border-primary/10 transition-colors">
                                        <div className="flex items-center gap-4">
                                            <div className={`p-2.5 rounded-xl ${locationStatus === 'granted' ? 'bg-green-500/10 text-green-600' : 'bg-amber-500/10 text-amber-600'}`}>
                                                <IconMapPin className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold">Location</p>
                                                <p className="text-[10px] text-muted-foreground uppercase font-black opacity-60">GEOTAG VERIFICATION</p>
                                            </div>
                                        </div>
                                        <StatusBadge status={locationStatus} />
                                    </div>

                                    {/* Camera Status */}
                                    <div className="flex items-center justify-between p-4 rounded-2xl bg-muted/50 border border-transparent hover:border-primary/10 transition-colors">
                                        <div className="flex items-center gap-4">
                                            <div className={`p-2.5 rounded-xl ${cameraStatus === 'granted' ? 'bg-green-500/10 text-green-600' : 'bg-amber-500/10 text-amber-600'}`}>
                                                <IconCamera className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold">Camera</p>
                                                <p className="text-[10px] text-muted-foreground uppercase font-black opacity-60">FACE ID CHECK</p>
                                            </div>
                                        </div>
                                        <StatusBadge status={cameraStatus} />
                                    </div>
                                </div>

                                {locationStatus === 'denied' || cameraStatus === 'denied' ? (
                                    <div className="p-4 rounded-2xl bg-destructive/10 border border-destructive/20 flex gap-3 text-destructive animate-pulse">
                                        <IconAlertTriangle className="w-5 h-5 shrink-0" />
                                        <p className="text-xs font-bold leading-normal uppercase">
                                            Permissions blocked by browser. Please enable in settings and refresh.
                                        </p>
                                    </div>
                                ) : null}

                                <div className="space-y-3 pt-2">
                                    <Button
                                        onClick={requestPermissions}
                                        className="w-full h-14 text-md font-black gap-2 shadow-xl shadow-primary/20 rounded-2xl transition-all active:scale-95"
                                        disabled={isChecking}
                                    >
                                        {isChecking ? (
                                            <IconRefresh className="w-5 h-5 animate-spin" />
                                        ) : (
                                            "Grant Access Now"
                                        )}
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    )
}

function StatusBadge({ status }: { status: PermissionStatus }) {
    switch (status) {
        case 'granted':
            return <span className="text-xs font-bold text-green-600 bg-green-500/10 px-2 py-1 rounded">ALLOWED</span>
        case 'denied':
            return <span className="text-xs font-bold text-destructive bg-destructive/10 px-2 py-1 rounded">BLOCKED</span>
        case 'checking':
            return <span className="text-xs font-bold text-muted-foreground animate-pulse">CHECKING...</span>
        case 'unsupported':
            return <span className="text-xs font-bold text-destructive bg-destructive/10 px-2 py-1 rounded">UNSUPPORTED</span>
        default:
            return <span className="text-xs font-bold text-amber-600 bg-amber-500/10 px-2 py-1 rounded">REQUIRED</span>
    }
}
