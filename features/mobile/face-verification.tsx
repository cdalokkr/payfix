"use client"

import React, { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { toast } from "sonner"
import {
    IconUserScan,
    IconLoader2,
    IconCheck,
    IconX,
    IconRefresh,
    IconPhoto,
} from "@tabler/icons-react"
import { FaceVerificationService } from "@/lib/services/face-verification.service"

interface FaceVerificationProps {
    selfieDataUrl: string
    profileImageUrl: string | null
    onVerified: (result: FaceVerificationResult) => void
    onRetakeSelfie: () => void
    onBack?: () => void
}

export interface FaceVerificationResult {
    matched: boolean
    similarity: number
}

export function FaceVerification({
    selfieDataUrl,
    profileImageUrl,
    onVerified,
    onRetakeSelfie,
    onBack,
}: FaceVerificationProps) {
    const [status, setStatus] = useState<'loading-models' | 'comparing' | 'success' | 'error'>('loading-models')
    const [progress, setProgress] = useState(0)
    const [similarity, setSimilarity] = useState<number | null>(null)
    const [errorMessage, setErrorMessage] = useState<string>('')

    // Verify face on mount
    const verifyFace = useCallback(async () => {
        // Check if selfie was skipped (placeholder image)
        if (selfieDataUrl.includes('data:image/svg+xml')) {
            setStatus('error')
            setErrorMessage('Please capture a valid selfie to verify your identity.')
            return
        }

        // Check if profile image exists
        if (!profileImageUrl) {
            setStatus('error')
            setErrorMessage('No profile picture found. Please upload a profile photo first.')
            return
        }

        // Load models
        setStatus('loading-models')
        setProgress(20)

        try {
            const modelsLoaded = await FaceVerificationService.initialize()
            if (!modelsLoaded) {
                setStatus('error')
                setErrorMessage('Failed to load face detection models. Please refresh and try again.')
                return
            }

            // Compare faces
            setStatus('comparing')
            setProgress(50)

            const result = await FaceVerificationService.compareFaces(selfieDataUrl, profileImageUrl)

            setProgress(100)
            setSimilarity(result.similarity)

            if (result.matched) {
                setStatus('success')
                toast.success(`Face verified! Match: ${FaceVerificationService.formatSimilarity(result.similarity)}`)

                // Auto proceed after success
                setTimeout(() => {
                    onVerified({
                        matched: true,
                        similarity: result.similarity,
                    })
                }, 1500)
            } else {
                setStatus('error')
                setErrorMessage(result.error || 'Face verification failed')
            }
        } catch (error) {
            console.error('Face verification error:', error)
            setStatus('error')
            setErrorMessage('Face verification service error. Please try again or contact support.')
        }
    }, [selfieDataUrl, profileImageUrl, onVerified])

    useEffect(() => {
        verifyFace()
    }, [verifyFace])

    const handleProceed = useCallback(() => {
        if (similarity !== null) {
            onVerified({
                matched: true,
                similarity,
            })
        }
    }, [similarity, onVerified])

    const threshold = FaceVerificationService.getThreshold()

    return (
        <Card className="w-full max-w-md mx-auto border-none shadow-none bg-transparent">
            <CardHeader className="text-center pb-2">
                <CardTitle className="text-2xl font-black tracking-tighter">
                    {status === 'loading-models' ? 'Initializing AI' :
                        status === 'comparing' ? 'Verifying Identity' :
                            status === 'success' ? 'Identity Confirmed' :
                                'Verification Failed'}
                </CardTitle>
                <CardDescription className="text-[11px] font-bold uppercase tracking-wider opacity-60">
                    {status === 'loading-models' ? 'Preparing verification models...' :
                        status === 'comparing' ? 'Comparing facial features...' :
                            status === 'success' ? 'Face matches profile photo' :
                                errorMessage}
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* Face comparison preview */}
                <div className="flex items-center justify-center gap-6">
                    <div className="relative group">
                        <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-white shadow-xl ring-2 ring-emerald-500/20">
                            <img
                                src={selfieDataUrl}
                                alt="Your selfie"
                                className="w-full h-full object-cover"
                            />
                        </div>
                        <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 text-[8px] font-black uppercase tracking-widest bg-white px-2 py-0.5 rounded-full border shadow-sm">
                            Selfie
                        </span>
                    </div>

                    <div className="flex flex-col items-center gap-1">
                        <div className="w-8 h-px bg-slate-200" />
                        {status === 'comparing' ? (
                            <IconLoader2 className="w-4 h-4 text-primary animate-spin" />
                        ) : status === 'success' ? (
                            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        ) : (
                            <div className="w-2 h-2 rounded-full bg-slate-200" />
                        )}
                        <div className="w-8 h-px bg-slate-200" />
                    </div>

                    <div className="relative">
                        <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-white shadow-xl ring-2 ring-blue-500/10">
                            {profileImageUrl ? (
                                <img
                                    src={profileImageUrl}
                                    alt="Profile photo"
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <div className="w-full h-full bg-muted flex items-center justify-center">
                                    <IconPhoto className="w-8 h-8 text-muted-foreground" />
                                </div>
                            )}
                        </div>
                        <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 text-[8px] font-black uppercase tracking-widest bg-white px-2 py-0.5 rounded-full border shadow-sm">
                            Profile
                        </span>
                    </div>
                </div>

                {/* Progress bar */}
                {(status === 'loading-models' || status === 'comparing') && (
                    <div className="space-y-2">
                        <Progress value={progress} />
                        <p className="text-xs text-center text-muted-foreground">
                            {status === 'loading-models' ? 'Loading AI models...' : 'Analyzing facial features...'}
                        </p>
                    </div>
                )}

                {/* Similarity score */}
                {similarity !== null && (
                    <div className="p-4 rounded-lg bg-muted/50 text-center">
                        <p className="text-sm text-muted-foreground mb-1">Match Score</p>
                        <p className={`text-3xl font-bold ${similarity >= threshold ? 'text-green-500' : 'text-destructive'
                            }`}>
                            {FaceVerificationService.formatSimilarity(similarity)}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                            Minimum required: {threshold * 100}%
                        </p>
                    </div>
                )}

                {/* Actions */}
                {status === 'success' && (
                    <Button onClick={handleProceed} className="w-full gap-2">
                        <IconCheck className="w-4 h-4" />
                        Complete Attendance
                    </Button>
                )}

                {status === 'error' && (
                    <div className="space-y-3">

                        <Button onClick={onRetakeSelfie} variant="outline" className="w-full gap-2">
                            <IconRefresh className="w-4 h-4" />
                            Retake Selfie
                        </Button>
                        {!profileImageUrl && (
                            <Button variant="outline" className="w-full gap-2">
                                <IconPhoto className="w-4 h-4" />
                                Upload Profile Photo
                            </Button>
                        )}
                        {onBack && (
                            <Button variant="ghost" onClick={onBack} className="w-full text-xs">
                                Cancel
                            </Button>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    )
}

export default FaceVerification
