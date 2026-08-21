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
    Clock as IconClock
} from "lucide-react"

import { format } from "date-fns"
import { Slider } from "@/components/ui/slider"
import { FaceVerificationService } from "@/lib/services/face-verification.service"
import { MediaPipeMeshService } from "@/lib/services/mediapipe-mesh.service"
import { OfflineSyncService } from "@/lib/services/offline-sync.service"
import { BiometricCameraModal } from "@/components/biometrics/BiometricCameraModal"



interface SelfieCaptureProps {
    profileImageUrl: string | null
    faceEmbedding?: number[] | null
    onCaptured: (result: SelfieResult) => void
    onVerified: (result: { matched: boolean; similarity: number }) => void
    onSubmitAttendance: (selfie?: string) => Promise<void>
    onBack?: () => void
    warmedStream?: MediaStream | null
    clearWarmedStream?: () => void
    mode?: 'check_in' | 'check_out'
}


// Track whether face-api models have been loaded this session
let modelsPreloaded = true

export interface SelfieResult {
    imageDataUrl: string
    capturedAt: Date
    verified: boolean
    similarity: number
}

export function SelfieCapture({
    profileImageUrl,
    faceEmbedding,
    onCaptured,
    onVerified,
    onSubmitAttendance,
    onBack,
    warmedStream,
    clearWarmedStream,
    mode = 'check_in'
}: SelfieCaptureProps) {


    const [status, setStatus] = useState<'idle' | 'streaming' | 'captured' | 'verifying' | 'verified' | 'verify_failed' | 'error'>('idle')
    const [errorMessage, setErrorMessage] = useState<string>('')
    const [capturedImage, setCapturedImage] = useState<string | null>(null)
    const [capturedAt, setCapturedAt] = useState<Date | null>(null)
    const [similarity, setSimilarity] = useState<number>(0)
    const [modelsReady, setModelsReady] = useState(true)
    const [apiStatus, setApiStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle')
    const [apiError, setApiError] = useState<string>('')

    const videoRef = useRef<HTMLVideoElement>(null)
    const canvasRef = useRef<HTMLCanvasElement>(null)
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
        setCapturedAt(null)
        setStatus('streaming')
    }, [])

    // Core verification routine on 512x512 HD snapshot
    const executeVerify = useCallback(async (imageToVerify: string) => {
        if (!imageToVerify) return

        const startTime = performance.now()
        setCapturedImage(imageToVerify)
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
                FaceVerificationService.compareFaces(imageToVerify, profileImageUrl, undefined, faceEmbedding),
                new Promise<never>((_, reject) =>
                    setTimeout(() => reject(new Error('TIMEOUT')), 45000)
                ),
            ])

            const elapsed = Math.round(performance.now() - startTime)
            const durStr = elapsed >= 1000 ? `${(elapsed / 1000).toFixed(2)}s` : `${elapsed}ms`
            setVerificationDuration(durStr)

            setSimilarity(result.similarity)

            if (!result.matched) {
                setStatus('verify_failed')
                setErrorMessage(result.error || 'Face does not match profile photo')
                return
            }

            // Verification passed — now submit attendance
            setStatus('verified')
            setApiStatus('pending')

            try {
                await onSubmitAttendance(imageToVerify)
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
    }, [profileImageUrl, faceEmbedding, onSubmitAttendance, stopCamera])

    // Manual capture fallback using 512x512 HD face crop
    const capturePhoto = useCallback(async () => {
        if (!videoRef.current || status !== 'streaming') return

        const video = videoRef.current
        try {
            const cropPromise = MediaPipeMeshService.processFaceFrame(video)
            const timeoutPromise = new Promise<null>((res) => setTimeout(() => res(null), 500))
            const cropResult = await Promise.race([cropPromise, timeoutPromise])

            let final512Url = cropResult?.dataUrl512 || ''
            if (!final512Url && canvasRef.current) {
                const canvas = canvasRef.current
                canvas.width = 512
                canvas.height = 512
                const ctx = canvas.getContext('2d')
                if (ctx) {
                    ctx.imageSmoothingEnabled = true
                    ctx.imageSmoothingQuality = 'high'
                    const vw = video.videoWidth || 720
                    const vh = video.videoHeight || 960
                    const squareSize = Math.min(vw, vh) * 0.92
                    const sx = (vw - squareSize) / 2
                    const sy = (vh - squareSize) / 2
                    ctx.save()
                    ctx.translate(512, 0)
                    ctx.scale(-1, 1)
                    ctx.drawImage(video, sx, sy, squareSize, squareSize, 0, 0, 512, 512)
                    ctx.restore()
                    final512Url = canvas.toDataURL('image/jpeg', 0.94)
                }
            }

            if (final512Url) {
                executeVerify(final512Url)
            }
        } catch (err) {
            console.error('Selfie capture error:', err)
        }
    }, [status, executeVerify])

    // Auto-capture on verified in-mask eye blink
    const handleAutoCapture = useCallback((dataUrl: string) => {
        toast.success('Blink verified! Verifying face biometrics 👁️')
        executeVerify(dataUrl)
    }, [executeVerify])

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
                    icon={<IconScanFace className="w-5 h-5 text-sky-400" />}
                    videoRefOut={videoRef}
                    onStreamReady={() => setStatus('streaming')}
                    timerSeconds={!capturedImage && status !== 'verified' ? sessionTimeout : undefined}
                    enableAutoBlinkCapture={!capturedImage && status !== 'verifying' && status !== 'verified'}
                    capturedCroppedUrl={capturedImage}
                    onAutoCapture={handleAutoCapture}
                    footerSlot={

                        <div className="space-y-3">
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
                                    <p className="text-[10px] text-sky-300 font-mono">512×512 HD biometrics verification</p>
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

                    <canvas ref={canvasRef} className="hidden" />
                </BiometricCameraModal>
            </div>
        </div>
    )


}

export default SelfieCapture


