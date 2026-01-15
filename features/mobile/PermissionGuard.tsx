"use client"

import React, { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { IconMapPin, IconCamera, IconAlertTriangle, IconRefresh, IconLock } from "@tabler/icons-react"
import { motion, AnimatePresence } from "framer-motion"

interface PermissionGuardProps {
    children: React.ReactNode
}

export function PermissionGuard({ children }: PermissionGuardProps) {
    const [locationStatus, setLocationStatus] = useState<'prompt' | 'granted' | 'denied' | 'checking'>('checking')
    const [cameraStatus, setCameraStatus] = useState<'prompt' | 'granted' | 'denied' | 'checking'>('checking')
    const [isChecking, setIsChecking] = useState(true)

    const checkPermissions = useCallback(async () => {
        setIsChecking(true)

        // 1. Check Location
        try {
            if (!navigator.geolocation) {
                setLocationStatus('denied')
            } else {
                const result = await navigator.permissions.query({ name: 'geolocation' as PermissionName })
                setLocationStatus(result.state === 'granted' ? 'granted' : result.state === 'prompt' ? 'prompt' : 'denied')

                result.onchange = () => {
                    setLocationStatus(result.state === 'granted' ? 'granted' : result.state === 'prompt' ? 'prompt' : 'denied')
                }
            }
        } catch (e) {
            // Fallback for browsers that don't support permissions.query for geolocation
            navigator.geolocation.getCurrentPosition(
                () => setLocationStatus('granted'),
                () => setLocationStatus('denied')
            )
        }

        // 2. Check Camera
        try {
            const result = await navigator.permissions.query({ name: 'camera' as PermissionName })
            setCameraStatus(result.state === 'granted' ? 'granted' : result.state === 'prompt' ? 'prompt' : 'denied')

            result.onchange = () => {
                setCameraStatus(result.state === 'granted' ? 'granted' : result.state === 'prompt' ? 'prompt' : 'denied')
            }
        } catch (e) {
            // Fallback for camera
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: true })
                setCameraStatus('granted')
                stream.getTracks().forEach(track => track.stop())
            } catch (err) {
                setCameraStatus('denied')
            }
        }

        setIsChecking(false)
    }, [])

    useEffect(() => {
        checkPermissions()
    }, [checkPermissions])

    const requestPermissions = async () => {
        setIsChecking(true)

        // Request Geolocation
        await new Promise((resolve) => {
            navigator.geolocation.getCurrentPosition(
                () => {
                    setLocationStatus('granted')
                    resolve(true)
                },
                () => {
                    setLocationStatus('denied')
                    resolve(false)
                }
            )
        })

        // Request Camera
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true })
            setCameraStatus('granted')
            stream.getTracks().forEach(track => track.stop())
        } catch (err) {
            setCameraStatus('denied')
        }

        setIsChecking(false)
    }

    const allGranted = locationStatus === 'granted' && cameraStatus === 'granted'

    if (allGranted) {
        return <>{children}</>
    }

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="fixed inset-0 z-[100] bg-background/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto"
            >
                <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                >
                    <Card className="w-full max-w-sm border-2 border-primary/20 shadow-2xl">
                        <CardHeader className="text-center">
                            <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                                <IconLock className="w-8 h-8 text-primary" />
                            </div>
                            <CardTitle className="text-xl">Permissions Required</CardTitle>
                            <CardDescription>
                                To use PayFix, we need access to your camera and location for attendance verification.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="space-y-4">
                                {/* Location Status */}
                                <div className="flex items-center justify-between p-3 rounded-xl bg-muted/50">
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2 rounded-lg ${locationStatus === 'granted' ? 'bg-green-500/10 text-green-600' : 'bg-amber-500/10 text-amber-600'}`}>
                                            <IconMapPin className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-semibold">Location Access</p>
                                            <p className="text-xs text-muted-foreground">Needed for geofencing</p>
                                        </div>
                                    </div>
                                    <StatusBadge status={locationStatus} />
                                </div>

                                {/* Camera Status */}
                                <div className="flex items-center justify-between p-3 rounded-xl bg-muted/50">
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2 rounded-lg ${cameraStatus === 'granted' ? 'bg-green-500/10 text-green-600' : 'bg-amber-500/10 text-amber-600'}`}>
                                            <IconCamera className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-semibold">Camera Access</p>
                                            <p className="text-xs text-muted-foreground">Needed for face verification</p>
                                        </div>
                                    </div>
                                    <StatusBadge status={cameraStatus} />
                                </div>
                            </div>

                            {locationStatus === 'denied' || cameraStatus === 'denied' ? (
                                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 flex gap-3 text-destructive">
                                    <IconAlertTriangle className="w-5 h-5 shrink-0" />
                                    <p className="text-xs leading-relaxed">
                                        Permissions were denied. Please enable them in your browser settings and refresh the page.
                                    </p>
                                </div>
                            ) : null}

                            <div className="space-y-3">
                                <Button
                                    onClick={requestPermissions}
                                    className="w-full h-12 text-md font-semibold gap-2 shadow-lg"
                                    disabled={isChecking}
                                >
                                    {isChecking ? (
                                        <IconRefresh className="w-5 h-5 animate-spin" />
                                    ) : (
                                        "Enable Permissions"
                                    )}
                                </Button>
                                <Button
                                    variant="outline"
                                    onClick={() => window.location.reload()}
                                    className="w-full h-12"
                                >
                                    I've Enabled Them
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    )
}

function StatusBadge({ status }: { status: 'prompt' | 'granted' | 'denied' | 'checking' }) {
    switch (status) {
        case 'granted':
            return <span className="text-xs font-bold text-green-600 bg-green-500/10 px-2 py-1 rounded">ALLOWED</span>
        case 'denied':
            return <span className="text-xs font-bold text-destructive bg-destructive/10 px-2 py-1 rounded">BLOCKED</span>
        case 'checking':
            return <span className="text-xs font-bold text-muted-foreground animate-pulse">CHECKING...</span>
        default:
            return <span className="text-xs font-bold text-amber-600 bg-amber-500/10 px-2 py-1 rounded">REQUIRED</span>
    }
}
