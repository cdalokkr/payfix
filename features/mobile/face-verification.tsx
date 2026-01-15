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
    IconPlayerSkipForward,
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

    // Check if selfie was skipped (placeholder image)
    const isTestMode = selfieDataUrl.includes('data:image/svg+xml')

    // Verify face on mount
    const verifyFace = useCallback(async () => {
        // If in test mode (selfie was skipped), auto-skip verification
        if (isTestMode) {
            setStatus('error')
            setErrorMessage('Selfie was skipped. Click "Skip Verification" to continue testing.')
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
            } else {
                setStatus('error')
                setErrorMessage(result.error || 'Face verification failed')
            }
        } catch (error) {
            console.error('Face verification error:', error)
            setStatus('error')
            setErrorMessage('Face verification service error. Use skip for testing.')
        }
    }, [selfieDataUrl, profileImageUrl, isTestMode])

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

    // Skip verification (for testing)
    const handleSkipVerification = useCallback(() => {
        toast.info('Face verification skipped (testing mode)')
        onVerified({
            matched: true,
            similarity: 0.99, // Fake high similarity for testing
        })
    }, [onVerified])

    const threshold = FaceVerificationService.getThreshold()

    return (
        <Card className="w-full max-w-md mx-auto">
            <CardHeader className="text-center">
                <div className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4 ${status === 'success' ? 'bg-green-500/10' :
                    status === 'error' ? 'bg-destructive/10' :
                        'bg-primary/10'
                    }`}>
                    {status === 'loading-models' || status === 'comparing' ? (
                        <IconLoader2 className="w-8 h-8 text-primary animate-spin" />
                    ) : status === 'success' ? (
                        <IconCheck className="w-8 h-8 text-green-500" />
                    ) : (
                        <IconX className="w-8 h-8 text-destructive" />
                    )}
                </div>
                <CardTitle>
                    {status === 'loading-models' ? 'Loading...' :
                        status === 'comparing' ? 'Verifying Face' :
                            status === 'success' ? 'Face Verified!' :
                                'Verification Failed'}
                </CardTitle>
                <CardDescription>
                    {status === 'loading-models' ? 'Preparing face detection...' :
                        status === 'comparing' ? 'Comparing your selfie with profile photo...' :
                            status === 'success' ? 'Your identity has been confirmed' :
                                errorMessage}
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* Face comparison preview */}
                <div className="flex items-center justify-center gap-4">
                    <div className="relative">
                        <img
                            src={selfieDataUrl}
                            alt="Your selfie"
                            className="w-24 h-24 rounded-full object-cover border-2 border-muted"
                        />
                        <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 text-xs bg-background px-2 py-0.5 rounded border">
                            {isTestMode ? 'Skipped' : 'Selfie'}
                        </span>
                    </div>

                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${status === 'success' ? 'bg-green-500' :
                        status === 'error' ? 'bg-destructive' :
                            'bg-muted'
                        }`}>
                        {status === 'success' ? (
                            <IconCheck className="w-4 h-4 text-white" />
                        ) : status === 'error' ? (
                            <IconX className="w-4 h-4 text-white" />
                        ) : (
                            <IconLoader2 className="w-4 h-4 text-muted-foreground animate-spin" />
                        )}
                    </div>

                    <div className="relative">
                        {profileImageUrl ? (
                            <img
                                src={profileImageUrl}
                                alt="Profile photo"
                                className="w-24 h-24 rounded-full object-cover border-2 border-muted"
                            />
                        ) : (
                            <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center border-2 border-dashed border-muted-foreground/30">
                                <IconPhoto className="w-8 h-8 text-muted-foreground" />
                            </div>
                        )}
                        <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 text-xs bg-background px-2 py-0.5 rounded border">
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
                        {/* Skip button for testing */}
                        <Button onClick={handleSkipVerification} className="w-full gap-2">
                            <IconPlayerSkipForward className="w-4 h-4" />
                            Skip Verification (Testing Only)
                        </Button>

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
