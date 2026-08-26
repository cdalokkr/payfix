"use client"

import React, { useState, useEffect, useCallback, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { toast } from "sonner"
import {
    Check as IconCheck,
    RefreshCw as IconRefresh,
    Image as IconPhoto,
    Bug as IconBug,
    ChevronDown as IconChevronDown,
    ChevronUp as IconChevronUp,
} from "lucide-react"
import { FaceVerificationService } from "@/lib/services/face-verification.service"
import { motion, AnimatePresence } from "framer-motion"

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
    const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying')
    const [progress, setProgress] = useState(0)
    const [similarity, setSimilarity] = useState<number | null>(null)
    const [errorMessage, setErrorMessage] = useState<string>('')
    const [debugLogs, setDebugLogs] = useState<string[]>([])
    const [showDebug, setShowDebug] = useState(false)
    const verificationStarted = useRef(false)

    // Add debug log
    const addDebugLog = useCallback((log: string) => {
        setDebugLogs(prev => [...prev, log])
    }, [])

    // Verify face on mount
    const verifyFace = useCallback(async () => {
        // Prevent double execution
        if (verificationStarted.current) return
        verificationStarted.current = true

        setDebugLogs([])
        addDebugLog(`[${new Date().toLocaleTimeString()}] 🔄 Verification started`)

        // Check if selfie was skipped (placeholder image)
        if (selfieDataUrl.includes('data:image/svg+xml')) {
            setStatus('error')
            setErrorMessage('Please capture a valid selfie to verify your identity.')
            addDebugLog('❌ Invalid selfie format detected (SVG placeholder)')
            return
        }

        // Check if profile image exists
        if (!profileImageUrl) {
            setStatus('error')
            setErrorMessage('No profile picture found. Please upload a profile photo first.')
            addDebugLog('❌ No profile image URL provided')
            return
        }

        addDebugLog(`📷 Selfie size: ${(selfieDataUrl.length / 1024).toFixed(1)}KB`)
        addDebugLog(`📷 Profile URL: ${profileImageUrl.substring(0, 50)}...`)

        setProgress(10)

        try {
            // Use face-api.js AI verification
            setProgress(30)

            const result = await FaceVerificationService.compareFaces(
                selfieDataUrl,
                profileImageUrl,
                undefined,
                addDebugLog
            )

            setProgress(100)
            setSimilarity(result.similarity)

            if (result.matched) {
                setStatus('success')
                toast.success(`Verified! Match: ${FaceVerificationService.formatSimilarity(result.similarity)}`)
                addDebugLog('✅ Verification successful!')

                // Auto proceed after success
                setTimeout(() => {
                    onVerified({
                        matched: true,
                        similarity: result.similarity,
                    })
                }, 1000)
            } else {
                setStatus('error')
                setErrorMessage(result.error || 'Verification failed - face does not match profile')
                addDebugLog(`❌ Verification failed: ${result.error}`)
            }
        } catch (error) {
            console.error('Face verification error:', error)
            const errorMsg = error instanceof Error ? error.message : 'Unknown error'
            setStatus('error')
            setErrorMessage('Verification service error. Please try again.')
            addDebugLog(`❌ Exception: ${errorMsg}`)
        }
    }, [selfieDataUrl, profileImageUrl, onVerified, addDebugLog])

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
                    {status === 'verifying' ? 'Verifying Identity' :
                        status === 'success' ? 'Identity Confirmed' :
                            'Verification Failed'}
                </CardTitle>
                <CardDescription className="text-[11px] font-bold uppercase tracking-wider opacity-60">
                    {status === 'verifying' ? 'Fast verification in progress...' :
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
                        {status === 'verifying' ? (
                            <motion.div
                                className="w-4 h-4 rounded-full border-2 border-primary border-t-transparent"
                                animate={{ rotate: 360 }}
                                transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }}
                            />
                        ) : status === 'success' ? (
                            <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center"
                            >
                                <IconCheck className="w-3 h-3 text-white" />
                            </motion.div>
                        ) : (
                            <div className="w-2 h-2 rounded-full bg-red-500" />
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
                {status === 'verifying' && (
                    <div className="space-y-2">
                        <Progress value={progress} className="h-2" />
                        <p className="text-xs text-center text-muted-foreground">
                            AI face recognition in progress...
                        </p>
                    </div>
                )}

                {/* Similarity score */}
                {similarity !== null && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="p-4 rounded-lg bg-muted/50 text-center"
                    >
                        <p className="text-sm text-muted-foreground mb-1">Match Score</p>
                        <p className={`text-3xl font-bold ${similarity >= threshold ? 'text-green-500' : 'text-destructive'
                            }`}>
                            {FaceVerificationService.formatSimilarity(similarity)}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                            Minimum required: {threshold * 100}%
                        </p>
                    </motion.div>
                )}

                {/* Debug Logs Panel */}
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                    <button
                        onClick={() => setShowDebug(!showDebug)}
                        className="w-full px-4 py-2 flex items-center justify-between bg-slate-50 hover:bg-slate-100 transition-colors"
                    >
                        <span className="flex items-center gap-2 text-xs font-medium text-slate-600">
                            <IconBug className="w-4 h-4" />
                            Debug Logs ({debugLogs.length})
                        </span>
                        {showDebug ? (
                            <IconChevronUp className="w-4 h-4 text-slate-400" />
                        ) : (
                            <IconChevronDown className="w-4 h-4 text-slate-400" />
                        )}
                    </button>
                    <AnimatePresence>
                        {showDebug && (
                            <motion.div
                                initial={{ height: 0 }}
                                animate={{ height: 'auto' }}
                                exit={{ height: 0 }}
                                className="overflow-hidden"
                            >
                                <div className="p-3 bg-slate-900 max-h-48 overflow-y-auto">
                                    {debugLogs.length === 0 ? (
                                        <p className="text-xs text-slate-500 font-mono">No logs yet...</p>
                                    ) : (
                                        debugLogs.map((log, i) => (
                                            <p key={i} className="text-[10px] text-slate-300 font-mono leading-relaxed">
                                                {log}
                                            </p>
                                        ))
                                    )}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

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
