"use client"

import React, { useState, useCallback } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { toast } from "sonner"
import { motion } from "framer-motion"
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

type WizardStep = 'selfie' | 'submitting' | 'complete' | 'error'

interface MobileAttendanceWizardProps {
    action: 'clock_in' | 'clock_out'
    profileImageUrl: string | null
    profileName?: string | null
    profileEmail?: string | null
    onComplete: () => void
    onCancel: () => void
}

const STEPS = [
    { id: 'selfie', label: 'Verify', icon: IconCamera },
]

export function MobileAttendanceWizard({
    action,
    profileImageUrl,
    profileName,
    profileEmail,
    onComplete,
    onCancel,
}: MobileAttendanceWizardProps) {
    const { isPwa, isReady } = usePwaCheck()
    const [currentStep, setCurrentStep] = useState<WizardStep>('selfie')
    const [errorMessage, setErrorMessage] = useState('')
    const utils = trpc.useUtils()
    const localDate = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Kolkata' })

    // Client-side status check — double-safety net to guarantee action matches real DB state
    const { data: serverTodayStatus } = trpc.attendance.getTodayStatus.useQuery({ localDate })

    const effectiveAction: 'clock_in' | 'clock_out' = serverTodayStatus?.status === 'clocked_in'
        ? 'clock_out'
        : serverTodayStatus?.status === 'not_clocked_in'
            ? 'clock_in'
            : action

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
    const handleSubmitAttendance = useCallback(async (attendanceProof: string) => {
        let coords: { latitude: number | null; longitude: number | null } = { latitude: null, longitude: null }
        if (effectiveAction === 'clock_in') {
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

        if (typeof navigator !== 'undefined' && !navigator.onLine) {
            throw new Error('An internet connection is required to verify your identity before attendance can be recorded.')
        }

        try {
            if (effectiveAction === 'clock_in') {
                await clockIn.mutateAsync({
                    localDate,
                    attendanceProof,
                    isExtraDay: false,
                    latitude: coords.latitude || undefined,
                    longitude: coords.longitude || undefined
                })
            } else {
                await clockOut.mutateAsync({
                    localDate,
                    attendanceProof,
                })
            }
        } catch (err: any) {
            // Only fall back to offline queue for genuine NETWORK errors.
            // Real server errors (ALREADY_CLOCKED_IN, FORBIDDEN, NO_CLOCK_IN_FOUND etc.)
            // must be re-thrown so the user sees the correct error message.
            const errMsg: string = err?.message || ''
            const isServerError = (
                errMsg.includes('ALREADY_CLOCKED_IN') ||
                errMsg.includes('NO_CLOCK_IN_FOUND') ||
                errMsg.includes('FORBIDDEN') ||
                errMsg.includes('NOT_FOUND') ||
                errMsg.includes('ALREADY_EXISTS') ||
                errMsg.includes('UNAUTHORIZED') ||
                // tRPC BAD_REQUEST responses are real server errors
                err?.data?.code === 'BAD_REQUEST' ||
                err?.data?.code === 'FORBIDDEN' ||
                err?.data?.code === 'NOT_FOUND' ||
                err?.data?.code === 'UNAUTHORIZED'
            )

            if (isServerError) {
                // Re-throw so selfie-capture shows the real error to the user
                throw err
            }

            // Only genuine offline / network failures reach here
            console.warn('[WIZARD] Network error — falling back to IndexedDB local queue:', err)
            throw new Error('Attendance could not be recorded because the server connection was lost. Please verify again while online.')
        }

        // Invalidate BOTH queries for real-time UI update
        // getTodayStatus drives the clock-in/clock-out button state — must be fresh
        await utils.attendance.getTodayStatus.invalidate()
        utils.attendance.getMobileAttendance.invalidate()
    }, [effectiveAction, localDate, clockIn, clockOut, utils])

    // Called when verification AND API both succeed
    const handleVerified = useCallback((result: { matched: boolean; similarity: number }) => {
        toast.success(effectiveAction === 'clock_in' ? 'Successfully clocked in!' : 'Successfully clocked out!')
        onComplete()
    }, [effectiveAction, onComplete])

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
            <motion.div
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="relative"
            >
                {currentStep === 'selfie' && (
                    <SelfieCapture
                        profileImageUrl={profileImageUrl}
                        profileName={profileName}
                        profileEmail={profileEmail}
                        onCaptured={handleSelfieCaptured}
                        onVerified={handleVerified}
                        onSubmitAttendance={handleSubmitAttendance}
                        onBack={handleBack}
                        mode={action === 'clock_out' ? 'check_out' : 'check_in'}
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
