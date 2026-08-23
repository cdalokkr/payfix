"use client"

import React, { useState, useRef, useCallback, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { motion, AnimatePresence } from "framer-motion"
import { 
    Camera as IconCamera, 
    Loader2 as IconLoader2, 
    RefreshCw as IconRefresh, 
    Check as IconCheck, 
    X as IconX, 
    ArrowLeft as IconArrowLeft, 
    ZoomIn as IconZoomIn,
    ShieldCheck as IconShieldCheck,
    CheckCheck as IconCheckCheck,
    ScanFace as IconScanFace,
    AlertTriangle as IconAlertTriangle,
    Clock as IconClock,
    User as IconUser,
} from "lucide-react"

import { format } from "date-fns"
import { Slider } from "@/components/ui/slider"
import { FaceVerificationService } from "@/lib/services/face-verification.service"
import { captureNaturalBiometricFrame } from "@/lib/face-pipeline"
import { OfflineSyncService } from "@/lib/services/offline-sync.service"
import { BiometricCameraModal } from "@/components/biometrics/BiometricCameraModal"



interface SelfieCaptureProps {
    profileImageUrl: string | null
    profileName?: string | null
    profileEmail?: string | null
    faceEmbedding?: number[] | null
    onCaptured: (result: SelfieResult) => void
    onVerified: (result: { matched: boolean; similarity: number }) => void
    onSubmitAttendance: () => Promise<void>
    onBack?: () => void
    mode?: 'check_in' | 'check_out'
}


// Track whether face-api models have been loaded this session
let modelsPreloaded = true

interface DailyVerificationDetails {
    cameraResolution: string
    outputResolution: string
    format: string
    payloadBytes: number
    server?: { faceCount: number; embeddingDimensions: number; livenessPassed: boolean; backend: string }
    similarity?: number
    threshold?: number
}

export interface SelfieResult {
    imageDataUrl: string
    capturedAt: Date
    verified: boolean
    similarity: number
}

export function SelfieCapture({
    profileImageUrl,
    profileName,
    profileEmail,
    faceEmbedding,
    onCaptured,
    onVerified,
    onSubmitAttendance,
    onBack,
    mode = 'check_in'
}: SelfieCaptureProps) {


    const [status, setStatus] = useState<'idle' | 'streaming' | 'captured' | 'verifying' | 'verified' | 'verify_failed' | 'error'>('idle')
    const [errorMessage, setErrorMessage] = useState<string>('')
    const [capturedImage, setCapturedImage] = useState<string | null>(null)
    const [processedPortrait, setProcessedPortrait] = useState<string | null>(null)
    const [capturedAt, setCapturedAt] = useState<Date | null>(null)
    const [similarity, setSimilarity] = useState<number>(0)
    const [modelsReady, setModelsReady] = useState(true)
    const [apiStatus, setApiStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle')
    const [apiError, setApiError] = useState<string>('')
    const [verificationDetails, setVerificationDetails] = useState<DailyVerificationDetails | null>(null)
    const [livenessChallenge, setLivenessChallenge] = useState<string | null>(null)
    const [captureResetKey, setCaptureResetKey] = useState(0)

    const videoRef = useRef<HTMLVideoElement>(null)
    const streamRef = useRef<MediaStream | null>(null)

    // Stop camera stream
    const stopCamera = useCallback(() => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop())
            streamRef.current = null
        }
        if (videoRef.current) {
            videoRef.current.srcObject = null
        }
    }, [])

    const isMounted = useRef(true)
    const isInitializing = useRef(false)
    useEffect(() => {
        return () => { isMounted.current = false }
    }, [])

    // Retake camera stream
    const retakePhoto = useCallback(() => {
        setCapturedImage(null)
        setProcessedPortrait(null)
        setCapturedAt(null)
        setErrorMessage('')
        setApiStatus('idle')
        setApiError('')
        setVerificationDetails(null)
        setVerificationDuration('')
        setLivenessChallenge(null)
        setCaptureResetKey(value => value + 1)
        setStatus('streaming')
    }, [])

    const getLivenessChallenge = useCallback(async () => {
        const response = await fetch('/api/biometric/challenge', { method: 'POST' })
        const result = await response.json().catch(() => ({}))
        if (!response.ok || typeof result.challenge !== 'string') throw new Error(result.error || 'Could not start liveness verification.')
        setLivenessChallenge(result.challenge)
        return result.challenge as string
    }, [])

    const captureChallengeFrames = useCallback(async () => {
        const video = videoRef.current
        if (!video) return []
        const frames: string[] = []
        for (let index = 0; index < 3; index += 1) {
            const capture = captureNaturalBiometricFrame(video)
            if (!capture) return []
            frames.push(capture.dataUrl)
            if (index < 2) await new Promise(resolve => setTimeout(resolve, 260))
        }
        return frames
    }, [])

    const readImageDimensions = useCallback((dataUrl: string) => new Promise<{ width: number; height: number } | null>((resolve) => {
        const image = new Image()
        image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight })
        image.onerror = () => resolve(null)
        image.src = dataUrl
    }), [])

    // Core verification routine on 512x512 HD snapshot
    const executeVerify = useCallback(async (imageToVerify: string, challenge?: string, frames?: string[]) => {
        if (!imageToVerify) return

        const startTime = performance.now()
        const payloadMatch = imageToVerify.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/)
        const cameraResolution = videoRef.current?.videoWidth && videoRef.current?.videoHeight
            ? `${videoRef.current.videoWidth} × ${videoRef.current.videoHeight}`
            : 'Unavailable'
        setVerificationDetails({
            cameraResolution,
            outputResolution: 'Reading captured frame…',
            format: payloadMatch?.[1] || 'Unknown',
            payloadBytes: payloadMatch ? Math.floor((payloadMatch[2].length * 3) / 4) : 0,
        })
        void readImageDimensions(imageToVerify).then(dimensions => {
            if (!dimensions || !isMounted.current) return
            setVerificationDetails(previous => previous ? {
                ...previous,
                outputResolution: `${dimensions.width} × ${dimensions.height} natural frame`,
            } : previous)
        })
        setCapturedImage(imageToVerify)
        setProcessedPortrait(null)
        setCapturedAt(new Date())
        stopCamera()
        setStatus('verifying')

        // A face-only attendance event must fail closed while offline.
        if (OfflineSyncService.isOffline()) {
            setStatus('verify_failed')
            setErrorMessage('An internet connection is required to verify your identity before attendance can be recorded.')
            return
        }

        if (!profileImageUrl) {
            setStatus('verify_failed')
            setErrorMessage('No profile photo found. Please upload a profile photo first.')
            return
        }

        try {
            // Hard timeout — 45s allows for model loading + inference on slow mobile devices
            const result = await Promise.race([
                FaceVerificationService.compareFaces(imageToVerify, profileImageUrl, undefined, faceEmbedding, challenge, frames),
                new Promise<never>((_, reject) =>
                    setTimeout(() => reject(new Error('TIMEOUT')), 45000)
                ),
            ])

            const elapsed = Math.round(performance.now() - startTime)
            const durStr = elapsed >= 1000 ? `${(elapsed / 1000).toFixed(2)}s` : `${elapsed}ms`
            setVerificationDuration(durStr)

            setSimilarity(result.similarity)
            setVerificationDetails(previous => previous ? {
                ...previous,
                similarity: result.similarity,
                threshold: result.threshold,
                server: result.verification,
            } : previous)
            if (!result.matched) {
                setStatus('verify_failed')
                setErrorMessage(result.error || 'Face does not match profile photo')
                return
            }
            if (!result.canonicalPortraitDataUrl) {
                setStatus('verify_failed')
                setErrorMessage('The server accepted the match but did not return its canonical portrait. Please retake your selfie.')
                return
            }
            setProcessedPortrait(result.canonicalPortraitDataUrl)

            // Verification passed — now submit attendance
            setStatus('verified')
            setApiStatus('pending')

            try {
                await onSubmitAttendance()
                setApiStatus('success')
            } catch (error: any) {
                setApiStatus('error')
                const errMsg = error?.message || 'Failed to record attendance'
                setApiError(errMsg)
                // Re-throw so the wizard's onError / error card shows the real message
                throw error
            }
        } catch (error: any) {
            setStatus('verify_failed')
            const errMsg: string = error?.message || ''

            const isAttendanceError = (
                errMsg.includes('ALREADY_CLOCKED_IN') ||
                errMsg.includes('NO_CLOCK_IN_FOUND') ||
                errMsg.includes('FORBIDDEN') ||
                errMsg.includes('NOT_FOUND') ||
                errMsg.includes('ALREADY_EXISTS') ||
                errMsg.includes('session is currently in progress') ||
                errMsg.includes('clock out first') ||
                errMsg.includes('clock-in') ||
                errMsg.includes('clock in')
            )

            if (isAttendanceError) {
                setErrorMessage(errMsg)
            } else if (errMsg === 'TIMEOUT') {
                setErrorMessage('Verification timed out. Please check network connection.')
            } else {
                setErrorMessage(errMsg || 'Face verification failed. Please retake your selfie.')
            }
        }
    }, [profileImageUrl, faceEmbedding, onSubmitAttendance, stopCamera, readImageDimensions])

    // Capture a natural frame; the server owns face crops, alignment, and identity decisions.
    const capturePhoto = useCallback(() => {
        if (!videoRef.current || status !== 'streaming') return
        const capture = captureNaturalBiometricFrame(videoRef.current)
        if (!capture) { toast.error('Camera frame is not ready. Please try again.'); return }
        void (async () => {
            try {
                const challenge = await getLivenessChallenge()
                const frames = await captureChallengeFrames()
                if (frames.length !== 3) throw new Error('Camera frames were not available. Please retake your selfie.')
                executeVerify(frames[0], challenge, frames)
            } catch (error: any) {
                setStatus('verify_failed')
                setErrorMessage(error?.message || 'Could not start liveness verification.')
            }
        })()
    }, [status, executeVerify, getLivenessChallenge, captureChallengeFrames])

    // Auto-capture on verified in-mask eye blink
    const handleAutoCapture = useCallback((dataUrl: string) => {
        toast.success('Blink verified! Verifying face biometrics 👁️')
        void (async () => {
            try {
                const challenge = await getLivenessChallenge()
                const frames = await captureChallengeFrames()
                if (frames.length !== 3) throw new Error('Camera frames were not available. Please retake your selfie.')
                executeVerify(frames[0] || dataUrl, challenge, frames)
            } catch (error: any) {
                setStatus('verify_failed')
                setErrorMessage(error?.message || 'Could not start liveness verification.')
            }
        })()
    }, [executeVerify, getLivenessChallenge, captureChallengeFrames])

    const [verificationDuration, setVerificationDuration] = useState<string>('')

    const handleProceed = useCallback(async () => {
        if (status === 'streaming') {
            capturePhoto()
        } else if (capturedImage) {
            executeVerify(capturedImage)
        }
    }, [status, capturePhoto, capturedImage, executeVerify])

    const handleComplete = useCallback(() => {
        if (apiStatus === 'success') {
            // API already done, go directly to dashboard
            onVerified({ matched: true, similarity })
        } else if (apiStatus === 'pending') {
            // Wait for API to complete
            // The button will show spinner, user needs to wait
        } else if (apiStatus === 'error') {
            // Show error
            setStatus('verify_failed')
            setErrorMessage(apiError || 'Failed to record attendance')
        }
    }, [apiStatus, similarity, onVerified, apiError])

    const [sessionTimeout, setSessionTimeout] = useState<number>(10)

    // 10-Second Auto-Capture Timer (Automatically captures selfie at 10s if not captured manually or via blink)
    useEffect(() => {
        if (status === 'streaming' && !capturedImage) {
            setSessionTimeout(10)
            const interval = setInterval(() => {
                setSessionTimeout(prev => {
                    if (prev <= 1) {
                        clearInterval(interval)
                        toast.info("10s Auto-Capture triggered 📸")
                        capturePhoto()
                        return 0
                    }
                    return prev - 1
                })
            }, 1000)
            return () => clearInterval(interval)
        }
    }, [status, capturedImage, capturePhoto])

    // Auto-verify immediately after capture (no confirm step)
    useEffect(() => {
        if (status === 'captured' && capturedImage && capturedAt) {
            // Small delay for UX - let user see their captured photo briefly
            const timer = setTimeout(() => {
                handleProceed()
            }, 500)
            return () => clearTimeout(timer)
        }
    }, [status, capturedImage, capturedAt, handleProceed])

    useEffect(() => {
        return () => stopCamera()
    }, [stopCamera])

    return (
        <div className="fixed inset-0 z-[70] bg-slate-950/80 backdrop-blur-md flex flex-col items-center justify-center p-3 sm:p-6 overflow-hidden">
            {/* Topmost Mode Badge Row above Camera Screen Header */}
            <div className="w-full max-w-md flex justify-center pb-2">
                <span className="text-[11px] font-black uppercase tracking-widest px-4 py-1.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/35 backdrop-blur-md shadow-lg">
                    {mode === 'check_out' ? 'CLOCKING OUT' : 'CLOCKING IN'}
                </span>
            </div>

            <div className="w-full max-w-md">
                <BiometricCameraModal
                    isOpen={true}
                    onClose={onBack || (() => {})}
                    title="Identify Yourself"
                    topLabel={mode === 'check_out' ? 'Clocking Out' : 'Clocking In'}
                    icon={<IconScanFace className="w-5 h-5 text-sky-400" />}
                    videoRefOut={videoRef}
                    onStreamReady={() => setStatus('streaming')}
                    timerSeconds={!capturedImage && status !== 'verified' ? sessionTimeout : undefined}
                    enableAutoBlinkCapture={!capturedImage && status !== 'verifying' && status !== 'verified'}
                    capturedPreviewUrl={capturedImage}
                    processedPreviewUrl={processedPortrait}
                    onAutoCapture={handleAutoCapture}
                    captureResetKey={captureResetKey}
                    footerSlot={

                        <div className="space-y-3">
                            <div className="bg-white/5 border border-white/10 rounded-2xl p-3.5 backdrop-blur-lg">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-sky-500/30 to-sky-500/10 border-2 border-sky-500/30 flex items-center justify-center overflow-hidden shrink-0">
                                        {profileImageUrl ? (
                                            <img src={profileImageUrl} alt="Profile" className="w-full h-full object-cover" />
                                        ) : (
                                            <IconUser className="w-5 h-5 text-sky-400" />
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0 space-y-0.5">
                                        <p className="text-white font-bold text-sm truncate">{profileName || 'Employee'}</p>
                                        {profileEmail && <p className="text-slate-400 text-xs truncate">{profileEmail}</p>}
                                    </div>
                                </div>
                            </div>
                            {verificationDetails && (
                                <details open={status === 'verify_failed'} className="rounded-xl border border-slate-700 bg-slate-900/70 px-3 py-2.5 text-left">
                                    <summary className="cursor-pointer text-xs font-bold text-sky-300">Daily biometric verification details</summary>
                                    <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[10px] font-mono text-slate-300">
                                        <dt className="text-slate-500">Camera</dt><dd>{verificationDetails.cameraResolution}</dd>
                                        <dt className="text-slate-500">Output</dt><dd>{verificationDetails.outputResolution}</dd>
                                        <dt className="text-slate-500">Format</dt><dd>{verificationDetails.format}</dd>
                                        <dt className="text-slate-500">Payload</dt><dd>{Math.round(verificationDetails.payloadBytes / 1024)} KB</dd>
                                        {verificationDetails.server && <>
                                            <dt className="text-slate-500">Server faces</dt><dd>{verificationDetails.server.faceCount}</dd>
                                            <dt className="text-slate-500">Template</dt><dd>{verificationDetails.server.embeddingDimensions}-d</dd>
                                            <dt className="text-slate-500">Liveness</dt><dd>{verificationDetails.server.livenessPassed ? 'Passed' : 'Failed'}</dd>
                                            <dt className="text-slate-500">Backend</dt><dd className="break-all">{verificationDetails.server.backend}</dd>
                                        </>}
                                        {typeof verificationDetails.similarity === 'number' && <>
                                            <dt className="text-slate-500">Similarity</dt><dd>{(verificationDetails.similarity * 100).toFixed(1)}%</dd>
                                            <dt className="text-slate-500">Required</dt><dd>{((verificationDetails.threshold || 0) * 100).toFixed(1)}%</dd>
                                        </>}
                                    </dl>
                                </details>
                            )}

                            {status === 'streaming' && (
                                <Button
                                    onClick={handleProceed}
                                    size="lg"
                                    className="w-full h-14 rounded-2xl bg-sky-500 text-white font-black text-base hover:bg-sky-400 shadow-lg shadow-sky-500/25 transition-all active:scale-95 cursor-pointer"
                                >
                                    <IconScanFace className="w-5 h-5 mr-2" />
                                    IDENTIFY NOW
                                </Button>
                            )}

                            {status === 'verified' && (
                                <Button
                                    onClick={handleComplete}
                                    size="lg"
                                    className="w-full h-14 rounded-2xl bg-emerald-500 text-white font-black text-base hover:bg-emerald-400 shadow-lg shadow-emerald-500/25 transition-all active:scale-95 cursor-pointer"
                                >
                                    <IconCheck className="w-5 h-5 mr-2" />
                                    DONE
                                </Button>
                            )}
                        </div>
                    }
                >

                    {/* Verifying Spinner Status Pill (Positions at exact bottom status location over clear selfie) */}
                    {status === 'verifying' && (
                        <div className="absolute bottom-4 inset-x-4 z-30 flex flex-col items-center justify-center animate-in zoom-in-95 fade-in duration-200">
                            <div className="w-full max-w-sm p-3.5 bg-slate-950/95 border-2 border-sky-500/70 rounded-2xl backdrop-blur-md shadow-2xl flex items-center justify-center gap-3 text-center">
                                <IconRefresh className="w-5 h-5 text-sky-400 animate-spin shrink-0" />
                                <div className="text-left">
                                    <p className="text-xs font-bold text-white">Verifying Face...</p>
                                    <p className="text-[10px] text-sky-300 font-mono">Server 3:4 portrait &amp; 512-d biometric verification</p>
                                </div>
                            </div>
                        </div>
                    )}


                    {/* Verification Result Status Pill Card (2-Line Format) */}
                    {status === 'verified' && (
                        <div className="absolute bottom-4 inset-x-4 z-30 flex flex-col items-center justify-center animate-in zoom-in-95 fade-in duration-200">
                            <div className="w-full max-w-sm p-4 bg-slate-950/95 border-2 border-emerald-500/70 rounded-2xl backdrop-blur-md shadow-2xl space-y-1.5 text-center">
                                <div className="flex items-center justify-center gap-2 text-emerald-400 font-black text-sm">
                                    <IconCheckCheck className="w-5 h-5 text-emerald-400 shrink-0" />
                                    <span>Verification Success</span>
                                </div>
                                <div className="text-xs font-bold text-slate-200">
                                    {format(capturedAt || new Date(), "dd MMM yyyy, hh:mm:ss a")}
                                </div>
                                <div className="text-[11px] font-mono text-emerald-200/90 flex items-center justify-center gap-2 pt-0.5">
                                    <span>Similarity: {(similarity * 100).toFixed(1)}%</span>
                                    {verificationDuration && (
                                        <>
                                            <span>•</span>
                                            <span>Duration: {verificationDuration}</span>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Verification Failed Result Status Pill Card */}
                    {status === 'verify_failed' && (
                        <div className="absolute bottom-4 inset-x-4 z-30 flex flex-col items-center justify-center animate-in zoom-in-95 fade-in duration-200">
                            <div className="w-full max-w-sm p-4 bg-slate-950/95 border-2 border-rose-500/70 rounded-2xl backdrop-blur-md shadow-2xl space-y-1.5 text-center">
                                <div className="flex items-center justify-center gap-2 text-rose-400 font-black text-sm">
                                    <IconAlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
                                    <span>Verification Unsuccessful</span>
                                </div>
                                <div className="text-xs font-bold text-rose-200">
                                    {errorMessage || 'Face verification failed'}
                                </div>
                                <Button
                                    onClick={retakePhoto}
                                    className="mt-1 h-9 px-4 rounded-xl bg-sky-500 hover:bg-sky-400 text-white font-bold text-xs shadow-md cursor-pointer"
                                >
                                    <IconRefresh className="w-3.5 h-3.5 mr-1.5" /> Retake Selfie
                                </Button>
                            </div>
                        </div>
                    )}
                </BiometricCameraModal>
            </div>
        </div>
    )


}

export default SelfieCapture


