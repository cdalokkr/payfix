"use client"

import React, { useState, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { toast } from "sonner"
import {
    IconCheck,
    IconLoader2,
    IconMapPin,
    IconCamera,
    IconUserScan,
    IconX,
    IconArrowLeft,
} from "@tabler/icons-react"
import { trpc } from "@/lib/trpc/client"
import { LocationVerification, type LocationResult } from "./location-verification"
import { SelfieCapture, type SelfieResult } from "./selfie-capture"
import { FaceVerification, type FaceVerificationResult } from "./face-verification"

type WizardStep = 'location' | 'selfie' | 'face' | 'submitting' | 'complete' | 'error'

interface MobileAttendanceWizardProps {
    action: 'clock_in' | 'clock_out'
    profileImageUrl: string | null
    onComplete: () => void
    onCancel: () => void
}

const STEPS = [
    { id: 'location', label: 'Location', icon: IconMapPin },
    { id: 'selfie', label: 'Selfie', icon: IconCamera },
    { id: 'face', label: 'Verify', icon: IconUserScan },
]

export function MobileAttendanceWizard({
    action,
    profileImageUrl,
    onComplete,
    onCancel,
}: MobileAttendanceWizardProps) {
    const [currentStep, setCurrentStep] = useState<WizardStep>('location')
    const [locationResult, setLocationResult] = useState<LocationResult | null>(null)
    const [selfieResult, setSelfieResult] = useState<SelfieResult | null>(null)
    const [faceResult, setFaceResult] = useState<FaceVerificationResult | null>(null)
    const [errorMessage, setErrorMessage] = useState('')

    const utils = trpc.useUtils()

    // Clock in mutation
    const clockIn = trpc.attendance.clockIn.useMutation({
        onSuccess: () => {
            setCurrentStep('complete')
            toast.success('Successfully clocked in!')
            utils.attendance.getTodayStatus.invalidate()
        },
        onError: (error) => {
            setCurrentStep('error')
            setErrorMessage(error.message || 'Failed to clock in')
            toast.error(error.message || 'Failed to clock in')
        },
    })

    // Clock out mutation
    const clockOut = trpc.attendance.clockOut.useMutation({
        onSuccess: () => {
            setCurrentStep('complete')
            toast.success('Successfully clocked out!')
            utils.attendance.getTodayStatus.invalidate()
        },
        onError: (error) => {
            setCurrentStep('error')
            setErrorMessage(error.message || 'Failed to clock out')
            toast.error(error.message || 'Failed to clock out')
        },
    })

    const handleLocationVerified = useCallback((result: LocationResult) => {
        setLocationResult(result)
        setCurrentStep('selfie')
    }, [])

    const handleSelfieCaptured = useCallback((result: SelfieResult) => {
        setSelfieResult(result)
        setCurrentStep('face')
    }, [])

    const handleFaceVerified = useCallback(async (result: FaceVerificationResult) => {
        setFaceResult(result)
        setCurrentStep('submitting')

        // Use IST date (Asia/Kolkata timezone)
        const localDate = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Kolkata' })

        try {
            // TODO: Upload selfie to Supabase storage and get URL
            // For now, we'll proceed without the selfie URL

            if (action === 'clock_in') {
                await clockIn.mutateAsync({
                    localDate,
                    isExtraDay: false,
                })
            } else {
                await clockOut.mutateAsync({
                    localDate,
                })
            }
        } catch {
            // Error handled in mutation callbacks
        }
    }, [action, clockIn, clockOut])

    const handleRetakeSelfie = useCallback(() => {
        setSelfieResult(null)
        setCurrentStep('selfie')
    }, [])

    const handleBack = useCallback(() => {
        switch (currentStep) {
            case 'selfie':
                setCurrentStep('location')
                break
            case 'face':
                setSelfieResult(null)
                setCurrentStep('selfie')
                break
            default:
                onCancel()
        }
    }, [currentStep, onCancel])

    // Calculate progress
    const getProgress = () => {
        switch (currentStep) {
            case 'location': return 15
            case 'selfie': return 40
            case 'face': return 65
            case 'submitting': return 85
            case 'complete': return 100
            default: return 0
        }
    }

    const getCurrentStepIndex = () => {
        return STEPS.findIndex(s => s.id === currentStep)
    }

    return (
        <div className="w-full max-w-md mx-auto space-y-4">
            {/* Progress header */}
            {!['complete', 'error'].includes(currentStep) && (
                <Card className="p-4">
                    <div className="flex items-center justify-between mb-3">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleBack}
                            className="gap-1 -ml-2"
                        >
                            <IconArrowLeft className="w-4 h-4" />
                            Back
                        </Button>
                        <span className="text-sm text-muted-foreground">
                            {action === 'clock_in' ? 'Clock In' : 'Clock Out'}
                        </span>
                    </div>

                    {/* Step indicators */}
                    <div className="flex items-center justify-between mb-3">
                        {STEPS.map((step, index) => {
                            const StepIcon = step.icon
                            const isActive = step.id === currentStep
                            const isComplete = getCurrentStepIndex() > index

                            return (
                                <React.Fragment key={step.id}>
                                    <div className={`flex flex-col items-center gap-1 ${isActive ? 'text-primary' :
                                        isComplete ? 'text-green-500' :
                                            'text-muted-foreground'
                                        }`}>
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isActive ? 'bg-primary text-primary-foreground' :
                                            isComplete ? 'bg-green-500 text-white' :
                                                'bg-muted'
                                            }`}>
                                            {isComplete ? (
                                                <IconCheck className="w-5 h-5" />
                                            ) : (
                                                <StepIcon className="w-5 h-5" />
                                            )}
                                        </div>
                                        <span className="text-xs font-medium">{step.label}</span>
                                    </div>
                                    {index < STEPS.length - 1 && (
                                        <div className={`flex-1 h-0.5 mx-2 ${isComplete ? 'bg-green-500' : 'bg-muted'
                                            }`} />
                                    )}
                                </React.Fragment>
                            )
                        })}
                    </div>

                    <Progress value={getProgress()} className="h-1" />
                </Card>
            )}

            {/* Step content */}
            {currentStep === 'location' && (
                <LocationVerification onVerified={handleLocationVerified} />
            )}

            {currentStep === 'selfie' && (
                <SelfieCapture
                    onCaptured={handleSelfieCaptured}
                    onBack={handleBack}
                />
            )}

            {currentStep === 'face' && selfieResult && (
                <FaceVerification
                    selfieDataUrl={selfieResult.imageDataUrl}
                    profileImageUrl={profileImageUrl}
                    onVerified={handleFaceVerified}
                    onRetakeSelfie={handleRetakeSelfie}
                    onBack={handleBack}
                />
            )}

            {currentStep === 'submitting' && (
                <Card className="w-full">
                    <CardContent className="py-12 text-center">
                        <IconLoader2 className="w-12 h-12 mx-auto text-primary animate-spin mb-4" />
                        <p className="text-lg font-medium">Submitting Attendance...</p>
                        <p className="text-sm text-muted-foreground">Please wait</p>
                    </CardContent>
                </Card>
            )}

            {currentStep === 'complete' && (
                <Card className="w-full">
                    <CardContent className="py-12 text-center">
                        <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4">
                            <IconCheck className="w-8 h-8 text-green-500" />
                        </div>
                        <h3 className="text-xl font-semibold mb-2">
                            {action === 'clock_in' ? 'Clocked In!' : 'Clocked Out!'}
                        </h3>
                        <p className="text-sm text-muted-foreground mb-6">
                            Your attendance has been recorded successfully
                        </p>
                        {locationResult && (
                            <p className="text-xs text-muted-foreground mb-4">
                                📍 {locationResult.locationName}
                            </p>
                        )}
                        <Button onClick={onComplete} className="w-full">
                            Done
                        </Button>
                    </CardContent>
                </Card>
            )}

            {currentStep === 'error' && (
                <Card className="w-full">
                    <CardContent className="py-12 text-center">
                        <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
                            <IconX className="w-8 h-8 text-destructive" />
                        </div>
                        <h3 className="text-xl font-semibold mb-2">Something Went Wrong</h3>
                        <p className="text-sm text-muted-foreground mb-6">
                            {errorMessage}
                        </p>
                        <div className="space-y-3">
                            <Button onClick={() => setCurrentStep('location')} className="w-full">
                                Try Again
                            </Button>
                            <Button variant="outline" onClick={onCancel} className="w-full">
                                Cancel
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    )
}

export default MobileAttendanceWizard
