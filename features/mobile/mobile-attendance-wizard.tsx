"use client"

import React, { useState, useEffect, useCallback } from "react"
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
    MapPin as IconMapPin,
    MapPinOff as IconMapPinOff,
    AlertTriangle as IconAlertTriangle,
    RefreshCw as IconRefreshCw,
} from "lucide-react"
import { trpc } from "@/lib/trpc/client"
import { SelfieCapture, type SelfieResult } from "./selfie-capture"
import { format } from "date-fns"
import { usePwaCheck } from "@/hooks/use-pwa-check"
import { prewarmBiometricCamera, takePrewarmedBiometricCamera } from "@/lib/biometric-camera-prewarm"

type WizardStep = 'locating' | 'outside_office' | 'selfie' | 'submitting' | 'complete' | 'error'

interface MobileAttendanceWizardProps {
    action: 'clock_in' | 'clock_out'
    profileImageUrl: string | null
    profileName?: string | null
    profileEmail?: string | null
    onComplete: () => void
    onCancel: () => void
}

const STEPS = [
    { id: 'locating', label: 'Location', icon: IconMapPin },
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
    const [currentStep, setCurrentStep] = useState<WizardStep>('locating')
    const [errorMessage, setErrorMessage] = useState('')
    const [verifiedCoords, setVerifiedCoords] = useState<{ latitude: number; longitude: number } | null>(null)
    const [verifiedOfficeName, setVerifiedOfficeName] = useState<string | null>(null)
    const [outsideDetails, setOutsideDetails] = useState<{
        nearestOfficeName?: string
        distanceMeters?: number
        userCoords?: { latitude: number; longitude: number }
        reason?: string
    } | null>(null)
    const [isRetryingLocation, setIsRetryingLocation] = useState(false)

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

    // Pre-verification GPS Location Gate: Mandatory verification before opening camera
    const verifyOfficeLocation = useCallback(async () => {
        setIsRetryingLocation(true)
        setErrorMessage('')
        // Pre-warm camera hardware in background during location check so camera starts in <50ms once verified
        void prewarmBiometricCamera()
        try {
            if (typeof window === 'undefined' || !navigator.geolocation) {
                setOutsideDetails({
                    reason: 'Geolocation is not supported or accessible on this device.'
                })
                setCurrentStep('outside_office')
                return
            }

            // Request fresh, high-accuracy GPS coordinates (maximum age 10 seconds)
            const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, {
                    enableHighAccuracy: true,
                    timeout: 8000,
                    maximumAge: 10000,
                })
            })

            const lat = pos.coords.latitude
            const lng = pos.coords.longitude

            // Verify position against authorized office geofences via server-side Haversine check
            const geofenceResult = await utils.officeLocations.checkGeofence.fetch({
                latitude: lat,
                longitude: lng,
            })

            // Update session cache with fresh verified position
            try {
                sessionStorage.setItem('mobileUserCoords', JSON.stringify({ lat, lng }))
                sessionStorage.setItem('mobileGeofenceResult', JSON.stringify(geofenceResult))
                sessionStorage.setItem('mobileGeofenceTimestamp', Date.now().toString())
            } catch {}

            if (!geofenceResult.isAllowed) {
                // User is outside the authorized perimeter — block camera verification immediately!
                setOutsideDetails({
                    nearestOfficeName: geofenceResult.nearestOffice?.name,
                    distanceMeters: geofenceResult.nearestOffice?.distance,
                    userCoords: { latitude: lat, longitude: lng },
                    reason: 'You are outside the designated office boundary.'
                })
                setCurrentStep('outside_office')
                return
            }

            // Inside verified office zone: advance to biometric selfie camera step
            setVerifiedCoords({ latitude: lat, longitude: lng })
            setVerifiedOfficeName(geofenceResult.withinOffice?.name || null)
            setCurrentStep('selfie')
        } catch (err: any) {
            console.error('[WIZARD] Geolocation pre-gate error:', err)
            let errorMsg = 'Failed to obtain live GPS location.'
            if (err?.code === 1) { // PERMISSION_DENIED
                errorMsg = 'Location permission was denied. Please allow location access in your browser settings to verify your presence at the office.'
            } else if (err?.code === 2) { // POSITION_UNAVAILABLE
                errorMsg = 'GPS signal unavailable. Please ensure your device location is turned on and try again.'
            } else if (err?.code === 3) { // TIMEOUT
                errorMsg = 'Location acquisition timed out. Please check your GPS signal and retry.'
            }
            setOutsideDetails({
                reason: errorMsg
            })
            setCurrentStep('outside_office')
        } finally {
            setIsRetryingLocation(false)
        }
    }, [utils])

    useEffect(() => {
        if (isReady) {
            verifyOfficeLocation()
        }
    }, [isReady, verifyOfficeLocation])

    const handleSelfieCaptured = useCallback((result: SelfieResult) => {
        // Selfie captured but not verified yet - this is now handled in selfie-capture
    }, [])

    // This is called by SelfieCapture to submit attendance in parallel with verification
    const handleSubmitAttendance = useCallback(async (attendanceProof: string) => {
        let coords: { latitude: number | null; longitude: number | null } = {
            latitude: verifiedCoords?.latitude ?? null,
            longitude: verifiedCoords?.longitude ?? null,
        }

        // Live fallback if verifiedCoords was somehow missing
        if (!coords.latitude && typeof window !== 'undefined' && 'geolocation' in navigator) {
            try {
                const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
                    navigator.geolocation.getCurrentPosition(resolve, reject, {
                        enableHighAccuracy: true,
                        timeout: 5000,
                        maximumAge: 10000,
                    })
                })
                coords = {
                    latitude: pos.coords.latitude,
                    longitude: pos.coords.longitude,
                }
            } catch (err) {
                console.warn('[WIZARD] Live fallback location acquisition failed:', err)
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
                    longitude: coords.longitude || undefined,
                })
            } else {
                await clockOut.mutateAsync({
                    localDate,
                    attendanceProof,
                    latitude: coords.latitude || undefined,
                    longitude: coords.longitude || undefined,
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
    }, [effectiveAction, localDate, verifiedCoords, clockIn, clockOut, utils])

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
            case 'locating': return 25
            case 'selfie': return 60
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
                {/* STEP: Mandatory Location Verification Radar */}
                {currentStep === 'locating' && (
                    <Card className="rounded-[2.5rem] border-none shadow-2xl overflow-hidden bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl">
                        <CardContent className="py-16 px-6 text-center space-y-6">
                            <div className="relative mx-auto w-24 h-24 flex items-center justify-center">
                                <motion.div
                                    animate={{ scale: [1, 1.4, 1], opacity: [0.3, 0.7, 0.3] }}
                                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                                    className="absolute inset-0 rounded-full bg-primary/20"
                                />
                                <motion.div
                                    animate={{ scale: [1, 1.8, 1], opacity: [0.1, 0.4, 0.1] }}
                                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut", delay: 0.3 }}
                                    className="absolute inset-0 rounded-full bg-primary/10"
                                />
                                <div className="relative z-10 w-16 h-16 rounded-2xl bg-gradient-to-tr from-primary to-primary/80 flex items-center justify-center shadow-lg shadow-primary/25">
                                    <IconMapPin className="w-8 h-8 text-white animate-bounce" />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-[11px] font-black uppercase tracking-wider">
                                    <IconLoader2 className="w-3.5 h-3.5 animate-spin" />
                                    <span>GPS Verification</span>
                                </div>
                                <h3 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">Locating Office Area...</h3>
                                <p className="text-xs text-muted-foreground font-medium max-w-xs mx-auto">
                                    Verifying on-site office presence before starting biometric camera verification.
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* STEP: Outside Office Area Blocking Card (Camera NEVER opens) */}
                {currentStep === 'outside_office' && (
                    <Card className="rounded-[2.5rem] border border-destructive/20 shadow-2xl overflow-hidden bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl">
                        <CardContent className="py-10 px-6 text-center space-y-6">
                            <div className="relative mx-auto w-20 h-20 flex items-center justify-center">
                                <div className="absolute inset-0 rounded-full bg-destructive/10 animate-ping opacity-60" />
                                <div className="relative z-10 w-16 h-16 rounded-2xl bg-gradient-to-tr from-destructive to-destructive/80 flex items-center justify-center shadow-lg shadow-destructive/20">
                                    <IconMapPinOff className="w-8 h-8 text-white" />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-destructive/10 text-destructive text-[11px] font-black uppercase tracking-wider">
                                    <IconAlertTriangle className="w-3.5 h-3.5" />
                                    <span>Geofence Restricted</span>
                                </div>
                                <h3 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">Outside Office Area</h3>
                                <p className="text-xs text-muted-foreground font-medium max-w-xs mx-auto leading-relaxed">
                                    {outsideDetails?.reason || 'Attendance verification can only be completed while physically inside an authorized office location.'}
                                </p>
                            </div>

                            {outsideDetails?.nearestOfficeName && (
                                <div className="p-4 rounded-2xl bg-muted/50 border border-border/50 text-left space-y-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Nearest Office</span>
                                        <span className="text-[11px] font-black text-destructive bg-destructive/10 px-2 py-0.5 rounded-md">
                                            {outsideDetails.distanceMeters && outsideDetails.distanceMeters >= 1000
                                                ? `${(outsideDetails.distanceMeters / 1000).toFixed(1)} km away`
                                                : `${outsideDetails.distanceMeters || 0} m away`}
                                        </span>
                                    </div>
                                    <div className="text-sm font-black text-foreground">
                                        {outsideDetails.nearestOfficeName}
                                    </div>
                                    {outsideDetails.userCoords && (
                                        <div className="text-[10px] text-muted-foreground font-mono">
                                            GPS: {outsideDetails.userCoords.latitude.toFixed(5)}, {outsideDetails.userCoords.longitude.toFixed(5)}
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="space-y-2.5 pt-2">
                                <Button
                                    onClick={verifyOfficeLocation}
                                    disabled={isRetryingLocation}
                                    className="w-full h-12 rounded-2xl font-bold gap-2 shadow-md"
                                >
                                    {isRetryingLocation ? (
                                        <>
                                            <IconLoader2 className="w-4 h-4 animate-spin" />
                                            Checking Location...
                                        </>
                                    ) : (
                                        <>
                                            <IconRefreshCw className="w-4 h-4" />
                                            Retry Location Check
                                        </>
                                    )}
                                </Button>
                                <Button
                                    variant="outline"
                                    onClick={onCancel}
                                    className="w-full h-12 rounded-2xl font-semibold border-border/60 hover:bg-muted/50"
                                >
                                    <IconArrowLeft className="w-4 h-4 mr-1.5" />
                                    Return to Dashboard
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* STEP: Biometric Selfie Verification (Only reachable if location confirmed inside office) */}
                {currentStep === 'selfie' && (
                    <SelfieCapture
                        key={`selfie-${action}-${effectiveAction}`}
                        profileImageUrl={profileImageUrl}
                        profileName={profileName}
                        profileEmail={profileEmail}
                        preWarmedStream={takePrewarmedBiometricCamera()}
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
                                    onClick={() => verifyOfficeLocation()}
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
