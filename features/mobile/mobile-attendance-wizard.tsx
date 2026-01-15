"use client"

import React, { useState, useCallback } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { toast } from "sonner"
import { motion, AnimatePresence } from "framer-motion"
import {
    IconCheck,
    IconLoader2,
    IconCamera,
    IconUserScan,
    IconX,
    IconArrowLeft,
    IconSparkles,
} from "@tabler/icons-react"
import { trpc } from "@/lib/trpc/client"
import { SelfieCapture, type SelfieResult } from "./selfie-capture"
import { FaceVerification, type FaceVerificationResult } from "./face-verification"

type WizardStep = 'selfie' | 'face' | 'submitting' | 'complete' | 'error'

interface MobileAttendanceWizardProps {
    action: 'clock_in' | 'clock_out'
    profileImageUrl: string | null
    onComplete: () => void
    onCancel: () => void
}

const STEPS = [
    { id: 'selfie', label: 'Selfie', icon: IconCamera },
    { id: 'face', label: 'Verify', icon: IconUserScan },
]

export function MobileAttendanceWizard({
    action,
    profileImageUrl,
    onComplete,
    onCancel,
}: MobileAttendanceWizardProps) {
    const [currentStep, setCurrentStep] = useState<WizardStep>('selfie')
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
        },
    })

    const handleSelfieCaptured = useCallback((result: SelfieResult) => {
        setSelfieResult(result)
        setCurrentStep('face')
    }, [])

    const handleFaceVerified = useCallback(async (result: FaceVerificationResult) => {
        setFaceResult(result)
        setCurrentStep('submitting')

        const localDate = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Kolkata' })

        try {
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
        if (currentStep === 'face') {
            setSelfieResult(null)
            setCurrentStep('selfie')
        } else {
            onCancel()
        }
    }, [currentStep, onCancel])

    const getProgress = () => {
        switch (currentStep) {
            case 'selfie': return 40
            case 'face': return 75
            case 'submitting': return 90
            case 'complete': return 100
            default: return 0
        }
    }

    const getCurrentStepIndex = () => {
        return STEPS.findIndex(s => s.id === currentStep)
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
                        <div className="flex items-center justify-between">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={handleBack}
                                className="h-10 px-4 rounded-2xl gap-2 font-bold hover:bg-white/50 transition-all"
                            >
                                <IconArrowLeft className="w-4 h-4" />
                                <span>Cancel</span>
                            </Button>
                            <div className="flex items-center gap-2 px-4 py-1.5 bg-primary/10 rounded-full">
                                <IconSparkles className="w-3.5 h-3.5 text-primary" />
                                <span className="text-[11px] font-black uppercase tracking-widest text-primary">
                                    {action === 'clock_in' ? 'Clocking In' : 'Clocking Out'}
                                </span>
                            </div>
                        </div>

                        {/* Modern Step Indicators */}
                        <div className="flex items-center justify-center gap-8 py-2">
                            {STEPS.map((step, index) => {
                                const StepIcon = step.icon
                                const isActive = step.id === currentStep
                                const isComplete = getCurrentStepIndex() > index

                                return (
                                    <div key={step.id} className="flex flex-col items-center gap-2 relative">
                                        <motion.div
                                            animate={{
                                                scale: isActive ? 1.1 : 1,
                                                backgroundColor: isActive ? 'var(--primary)' : isComplete ? '#22c55e' : 'var(--muted)'
                                            }}
                                            className={`w-14 h-14 rounded-3xl flex items-center justify-center shadow-lg transition-colors
                                                ${isActive ? 'text-primary-foreground' : isComplete ? 'text-white' : 'text-muted-foreground'}
                                            `}
                                        >
                                            {isComplete ? (
                                                <IconCheck className="w-7 h-7 stroke-[3]" />
                                            ) : (
                                                <StepIcon className="w-7 h-7 stroke-[2.5]" />
                                            )}
                                        </motion.div>
                                        <span className={`text-[10px] font-black uppercase tracking-[0.15em] ${isActive ? 'text-primary' : 'text-muted-foreground opacity-60'}`}>
                                            {step.label}
                                        </span>
                                    </div>
                                )
                            })}
                        </div>
                        <Progress value={getProgress()} className="h-1.5 rounded-full bg-slate-100 shadow-inner" />
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
                            <p className="text-sm text-muted-foreground mb-10 font-medium">
                                Your attendance has been securely recorded.
                            </p>
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
