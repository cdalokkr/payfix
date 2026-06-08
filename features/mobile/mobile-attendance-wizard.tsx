"use client"

import React, { useState, useCallback, useEffect, useRef } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { toast } from "sonner"
import { motion, AnimatePresence } from "framer-motion"
import {
    Check as IconCheck,
    Loader2 as IconLoader2,
    Camera as IconCamera,
    ScanFace as IconUserScan,
    X as IconX,
    ArrowLeft as IconArrowLeft,
    Sparkles as IconSparkles,
} from "lucide-react"
import { trpc } from "@/lib/trpc/client"
import { SelfieCapture, type SelfieResult } from "./selfie-capture"
import { format } from "date-fns"
import { usePwaCheck } from "@/hooks/use-pwa-check"
import { OfflineSyncService } from "@/lib/services/offline-sync.service"

type WizardStep = 'selfie' | 'submitting' | 'complete' | 'error'

interface MobileAttendanceWizardProps {
    action: 'clock_in' | 'clock_out'
    profileImageUrl: string | null
    onComplete: () => void
    onCancel: () => void
}

const STEPS = [
    { id: 'selfie', label: 'Verify', icon: IconCamera },
]

export function MobileAttendanceWizard({
    action,
    profileImageUrl,
    onComplete,
    onCancel,
}: MobileAttendanceWizardProps) {
    const { isPwa, isReady } = usePwaCheck()
    const [currentStep, setCurrentStep] = useState<WizardStep>('selfie')
    const [errorMessage, setErrorMessage] = useState('')
    const [warmedStream, setWarmedStream] = useState<MediaStream | null>(null)
    const warmedStreamRef = useRef<MediaStream | null>(null)

    // Pre-warm camera stream as soon as the wizard is mounted
    useEffect(() => {
        let activeStream: MediaStream | null = null

        const prewarm = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        facingMode: 'user',
                        width: { ideal: 1920 },
                        height: { ideal: 1080 },
                    },
                    audio: false,
                })
                activeStream = stream
                warmedStreamRef.current = stream
                setWarmedStream(stream)
            } catch (err) {
                console.warn('Failed to pre-warm camera:', err)
            }
        }

        prewarm()

        return () => {
            if (warmedStreamRef.current) {
                warmedStreamRef.current.getTracks().forEach(track => track.stop())
                warmedStreamRef.current = null
            }
        }
    }, [])

    const clearWarmedStream = useCallback(() => {
        warmedStreamRef.current = null
        setWarmedStream(null)
    }, [])

    const utils = trpc.useUtils()

    // Clock in mutation
    const clockIn = trpc.attendance.clockIn.useMutation({
        onError: (error) => {
            setCurrentStep('error')
            setErrorMessage(error.message || 'Failed to clock in')
        },
    })

    // Clock out mutation
    const clockOut = trpc.attendance.clockOut.useMutation({
        onError: (error) => {
            setCurrentStep('error')
            setErrorMessage(error.message || 'Failed to clock out')
        },
    })

    const handleSelfieCaptured = useCallback((result: SelfieResult) => {
        // Selfie captured but not verified yet - this is now handled in selfie-capture
    }, [])

    // This is called by SelfieCapture to submit attendance in parallel with verification
    const handleSubmitAttendance = useCallback(async (selfie?: string) => {
        const localDate = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Kolkata' })

        let coords: { latitude: number | null; longitude: number | null } = { latitude: null, longitude: null }
        if (action === 'clock_in') {
            try {
                // Try to reuse fresh cached coordinates from sessionStorage (less than 1 minute old)
                let cachedCoords: { lat: number; lng: number } | null = null
                if (typeof window !== 'undefined') {
                    const cachedCoordsStr = sessionStorage.getItem('mobileUserCoords')
                    const cachedTimeStr = sessionStorage.getItem('mobileGeofenceTimestamp')
                    if (cachedCoordsStr && cachedTimeStr) {
                        const age = Date.now() - Number(cachedTimeStr)
                        if (age < 60000) { // 1 minute is extremely fresh for location verification
                            const parsed = JSON.parse(cachedCoordsStr)
                            if (parsed && typeof parsed.lat === 'number' && typeof parsed.lng === 'number') {
                                console.log('[WIZARD] Reusing fresh cached coordinates for clock_in:', parsed)
                                coords = {
                                    latitude: parsed.lat,
                                    longitude: parsed.lng
                                }
                            }
                        }
                    }
                }

                // Fallback to fresh GPS query if cached coordinates are missing or stale
                if (!coords.latitude && 'geolocation' in navigator) {
                    const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
                        navigator.geolocation.getCurrentPosition(resolve, reject, {
                            enableHighAccuracy: true,
                            timeout: 5000,
                            maximumAge: 0
                        })
                    })
                    coords = {
                        latitude: pos.coords.latitude,
                        longitude: pos.coords.longitude
                    }
                }
            } catch (err) {
                console.warn('Failed to get location:', err)
                // Proceed without location
            }
        }

        const isOffline = OfflineSyncService.isOffline()
        if (isOffline) {
            console.log('[WIZARD] Client is offline, queuing punch directly in IndexedDB')
            await OfflineSyncService.queuePunch({
                action,
                localDate,
                latitude: coords.latitude,
                longitude: coords.longitude,
                selfie: selfie || null
            })
            toast.success("Connection unavailable. Punched successfully offline!")
            return
        }

        try {
            if (action === 'clock_in') {
                await clockIn.mutateAsync({
                    localDate,
                    isExtraDay: false,
                    latitude: coords.latitude || undefined,
                    longitude: coords.longitude || undefined
                })
            } else {
                await clockOut.mutateAsync({
                    localDate,
                })
            }
        } catch (err) {
            console.warn('[WIZARD] Server post failed, falling back to IndexedDB local queue:', err)
            await OfflineSyncService.queuePunch({
                action,
                localDate,
                latitude: coords.latitude,
                longitude: coords.longitude,
                selfie: selfie || null
            })
            toast.success("Server connection lost. Saved offline successfully!")
        }

        // Invalidate cache for real-time update
        utils.attendance.getMobileAttendance.invalidate()
    }, [action, clockIn, clockOut, utils])

    // Called when verification AND API both succeed
    const handleVerified = useCallback((result: { matched: boolean; similarity: number }) => {
        toast.success(action === 'clock_in' ? 'Successfully clocked in!' : 'Successfully clocked out!')
        onComplete()
    }, [action, onComplete])

    const handleBack = useCallback(() => {
        onCancel()
    }, [onCancel])

    const getProgress = () => {
        switch (currentStep) {
            case 'selfie': return 50
            case 'submitting': return 90
            case 'complete': return 100
            default: return 0
        }
    }

    const getCurrentStepIndex = () => {
        return STEPS.findIndex(s => s.id === currentStep)
    }

    if (isReady && !isPwa) {
        return (
            <Card className="rounded-[2.5rem] border-none shadow-2xl overflow-hidden bg-white/80 backdrop-blur-xl p-8 text-center">
                <IconX className="w-12 h-12 text-destructive mx-auto mb-4" />
                <h3 className="text-xl font-bold mb-2">PWA Required</h3>
                <p className="text-sm text-muted-foreground mb-6">Attendance marking is restricted to the installed Mobile App.</p>
                <Button onClick={onCancel} className="w-full rounded-2xl">Return to Dashboard</Button>
            </Card>
        )
    }

    return (
        <div className="w-full max-w-md mx-auto space-y-6">
            <AnimatePresence mode="wait">
                {!['complete', 'error', 'submitting'].includes(currentStep) && (
                    <motion.div
                        key="progress-header"
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="space-y-4"
                    >
                        <div className="flex items-center justify-center">
                            <div className="flex items-center gap-2 px-6 py-2 bg-primary/10 rounded-full border border-primary/20 backdrop-blur-md">
                                <span className="text-xs font-black uppercase shadow-sm tracking-[0.2em] text-primary">
                                    {action === 'clock_in' ? 'Clocking In' : 'Clocking Out'}
                                </span>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <motion.div
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="relative"
            >
                {currentStep === 'selfie' && (
                    <SelfieCapture
                        profileImageUrl={profileImageUrl}
                        onCaptured={handleSelfieCaptured}
                        onVerified={handleVerified}
                        onSubmitAttendance={handleSubmitAttendance}
                        onBack={handleBack}
                        warmedStream={warmedStream}
                        clearWarmedStream={clearWarmedStream}
                    />
                )}



                {currentStep === 'submitting' && (
                    <Card className="rounded-[2.5rem] border-none shadow-2xl overflow-hidden bg-white/80 backdrop-blur-xl">
                        <CardContent className="py-20 text-center space-y-6">
                            <div className="relative mx-auto w-24 h-24">
                                <motion.div
                                    animate={{ rotate: 360 }}
                                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                                    className="absolute inset-0 rounded-[2rem] border-4 border-primary/20"
                                />
                                <motion.div
                                    animate={{ rotate: -360 }}
                                    transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                                    className="absolute inset-2 rounded-[1.5rem] border-4 border-t-primary border-transparent"
                                />
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <IconLoader2 className="w-8 h-8 text-primary animate-spin" />
                                </div>
                            </div>
                            <div>
                                <h3 className="text-2xl font-black tracking-tight mb-2">Recording Status...</h3>
                                <p className="text-sm text-muted-foreground font-medium uppercase tracking-widest opacity-60">Please wait a moment</p>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {currentStep === 'complete' && (
                    <Card className="rounded-[3rem] border-none shadow-2xl overflow-hidden bg-gradient-to-b from-white to-emerald-50">
                        <CardContent className="py-16 text-center">
                            <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ type: "spring", damping: 12 }}
                                className="w-24 h-24 rounded-[2.5rem] bg-emerald-500 flex items-center justify-center mx-auto mb-8 shadow-xl shadow-emerald-200"
                            >
                                <IconCheck className="w-12 h-12 text-white stroke-[3]" />
                            </motion.div>
                            <h3 className="text-3xl font-black tracking-tighter mb-2">
                                {action === 'clock_in' ? 'Clocked In!' : 'Clocked Out!'}
                            </h3>
                            <div className="space-y-1 mb-10">
                                <p className="text-sm text-muted-foreground font-semibold">
                                    Attendance Verified Securely
                                </p>
                                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-emerald-600 bg-emerald-500/10 py-2 rounded-full border border-emerald-500/20 px-4 inline-block">
                                    {format(new Date(), "dd MMM yyyy • hh:mm:ss a")}
                                </p>
                            </div>
                            <Button
                                onClick={onComplete}
                                className="w-full h-16 rounded-[2rem] bg-slate-900 hover:bg-slate-800 text-lg font-black shadow-xl"
                            >
                                Done
                            </Button>
                        </CardContent>
                    </Card>
                )}

                {currentStep === 'error' && (
                    <Card className="rounded-[3rem] border-none shadow-2xl overflow-hidden">
                        <CardContent className="py-16 text-center">
                            <div className="w-20 h-20 rounded-[2rem] bg-destructive/10 flex items-center justify-center mx-auto mb-6">
                                <IconX className="w-10 h-10 text-destructive stroke-[3]" />
                            </div>
                            <h3 className="text-2xl font-black tracking-tight mb-2">Verification Failed</h3>
                            <p className="text-sm text-muted-foreground mb-8 font-medium">
                                {errorMessage}
                            </p>
                            <div className="space-y-3">
                                <Button
                                    onClick={() => setCurrentStep('selfie')}
                                    className="w-full h-14 rounded-2xl bg-destructive hover:bg-destructive/90 font-black shadow-lg"
                                >
                                    Try Again
                                </Button>
                                <Button
                                    variant="ghost"
                                    onClick={onCancel}
                                    className="w-full h-12 font-bold text-muted-foreground"
                                >
                                    Cancel
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                )}
            </motion.div>
        </div>
    )
}

export default MobileAttendanceWizard
