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
    AlertTriangle as IconAlertTriangle
} from "lucide-react"
import { format } from "date-fns"
import { Slider } from "@/components/ui/slider"
import { FaceVerificationService } from "@/lib/services/face-verification.service"
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
    clearWarmedStream
}: SelfieCaptureProps) {

    const [status, setStatus] = useState<'idle' | 'streaming' | 'captured' | 'verifying' | 'verified' | 'verify_failed' | 'error'>('idle')
    const [errorMessage, setErrorMessage] = useState<string>('')
    const [capturedImage, setCapturedImage] = useState<string | null>(null)
    const [capturedAt, setCapturedAt] = useState<Date | null>(null)
    const [countdown, setCountdown] = useState<number | null>(null)
    const [zoom, setZoom] = useState<number>(1)
    const [hasZoomSupport, setHasZoomSupport] = useState(false)
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

    // Start camera stream
    const startCamera = useCallback(async (retryCount = 0) => {
        // Prevent multiple simultaneous calls
        if (isInitializing.current && retryCount === 0) {
            return
        }
        isInitializing.current = true

        // Set models as preloaded instantly
        modelsPreloaded = true
        if (isMounted.current) setModelsReady(true)

        stopCamera()
        if (isMounted.current) {
            setStatus('idle')
            setErrorMessage('')
        }

        // Delay for hardware release (350ms) - only if we don't have a warmed stream
        if (retryCount === 0 && !warmedStream) {
            await new Promise(resolve => setTimeout(resolve, 350))
        }

        // Try using the pre-warmed stream
        if (warmedStream && retryCount === 0) {
            try {
                streamRef.current = warmedStream
                const videoTrack = warmedStream.getVideoTracks()[0]
                if (videoTrack) {
                    const capabilities = videoTrack.getCapabilities() as any
                    if (capabilities?.zoom) {
                        setHasZoomSupport(true)
                    }
                }

                if (videoRef.current) {
                    const video = videoRef.current
                    video.srcObject = warmedStream
                    video.setAttribute('playsinline', 'true')
                    video.muted = true
                    
                    try {
                        await video.play()
                        if (isMounted.current) setStatus('streaming')
                    } catch (err) {
                        console.warn("Autoplay blocked, but setting status to streaming:", err)
                        if (isMounted.current) setStatus('streaming')
                    }
                    isInitializing.current = false
                    clearWarmedStream?.()
                    return
                }
            } catch (err) {
                console.error("Failed to use pre-warmed stream, falling back to getUserMedia:", err)
            }
        }

        try {
            // Request 480x640 (3:4 portrait) for consistent face vector alignment across enrollment & kiosk
            const constraints: MediaStreamConstraints = retryCount === 0 ? {
                video: {
                    facingMode: 'user',
                    width: { ideal: 480 },
                    height: { ideal: 640 },
                    aspectRatio: { ideal: 0.75 }
                },
                audio: false,
            } : {
                video: { facingMode: 'user' },
                audio: false
            }


            const stream = await navigator.mediaDevices.getUserMedia(constraints)

            if (!isMounted.current) {
                stream.getTracks().forEach(track => track.stop())
                return
            }

            streamRef.current = stream

            const videoTrack = stream.getVideoTracks()[0]
            const capabilities = videoTrack.getCapabilities() as any
            if (capabilities?.zoom) {
                setHasZoomSupport(true)
            }

            if (videoRef.current) {
                const video = videoRef.current
                video.srcObject = stream

                // For mobile compatibility
                video.setAttribute('playsinline', 'true')
                video.muted = true

                const handlePlay = async () => {
                    if (!isMounted.current) return
                    try {
                        await video.play()
                        setStatus('streaming')
                        isInitializing.current = false
                    } catch (err) {
                        console.warn("Autoplay block, but status set to streaming:", err)
                        setStatus('streaming')
                        isInitializing.current = false
                    }
                }

                if (video.readyState >= 2) {
                    handlePlay()
                } else {
                    video.onloadedmetadata = handlePlay
                    // Safety timeout for the spinner
                    setTimeout(() => {
                        if (isMounted.current && status === 'idle') handlePlay()
                    }, 1500)
                }

                // Profile descriptor preloading now handled above in initialize() chain
            }
        } catch (error: unknown) {
            console.error('Camera error:', error)

            // Auto-retry once with basic video
            if (retryCount === 0 && isMounted.current) {
                return startCamera(1)
            }

            if (!isMounted.current) return

            setStatus('error')
            isInitializing.current = false
            setErrorMessage('Camera access failed. Check site settings.')
        }
    }, [stopCamera])

    // Apply zoom
    useEffect(() => {
        if (streamRef.current && status === 'streaming') {
            const videoTrack = streamRef.current.getVideoTracks()[0]
            const capabilities = videoTrack.getCapabilities() as any

            if (capabilities.zoom) {
                const min = capabilities.zoom.min || 1
                const max = capabilities.zoom.max || 1
                const zoomVal = min + (max - min) * (zoom - 1) / 2
                videoTrack.applyConstraints({
                    advanced: [{ zoom: zoomVal }] as any
                }).catch(() => { })
            }
        }
    }, [zoom, status])

    // Capture photo
    const capturePhoto = useCallback(() => {
        if (!videoRef.current || !canvasRef.current || status !== 'streaming') return

        const video = videoRef.current
        const canvas = canvasRef.current
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        // 320×320: optimized for fast server-side processing on mobile
        canvas.width = 320
        canvas.height = 320

        const vw = video.videoWidth
        const vh = video.videoHeight
        const size = Math.min(vw, vh)
        const sx = (vw - size) / 2
        const sy = (vh - size) / 2

        ctx.save()
        ctx.translate(canvas.width, 0)
        ctx.scale(-1, 1)
        ctx.drawImage(video, sx, sy, size, size, 0, 0, canvas.width, canvas.height)
        ctx.restore()

        const now = new Date()
        const timestamp = format(now, "dd MMM yyyy, hh:mm:ss a")

        // Draw modern timestamp pill (scaled to 320px canvas)
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'
        const pillWidth = 200
        const pillHeight = 28
        const pillX = (canvas.width - pillWidth) / 2
        const pillY = canvas.height - 42

        // Rounded rect for pill
        ctx.beginPath()
        ctx.roundRect(pillX, pillY, pillWidth, pillHeight, 14)
        ctx.fill()

        ctx.fillStyle = '#ffffff'
        ctx.font = 'bold 12px Inter, system-ui'
        ctx.textAlign = 'center'
        ctx.fillText(timestamp, canvas.width / 2, pillY + 19)

        // Compress image to quality 0.7 for tiny payload size
        const imageDataUrl = canvas.toDataURL('image/jpeg', 0.7)
        setCapturedImage(imageDataUrl)
        setCapturedAt(now)
        setStatus('captured')
        stopCamera()
    }, [stopCamera, status])

    const retakePhoto = useCallback(() => {
        setCapturedImage(null)
        setCapturedAt(null)
        startCamera()
    }, [startCamera])

    const handleProceed = useCallback(async () => {
        if (!capturedImage || !capturedAt) return

        // Start verification
        setStatus('verifying')

        // Check if offline
        const isOffline = OfflineSyncService.isOffline()
        if (isOffline) {
            console.log('[SELFIE] Client is offline, bypassing server verification and saving locally')
            setSimilarity(1.0)
            setStatus('verified')
            setApiStatus('pending')
            try {
                await onSubmitAttendance(capturedImage)
                setApiStatus('success')
                // Optimistically succeed after a tiny visual delay
                setTimeout(() => {
                    if (isMounted.current) {
                        onVerified({ matched: true, similarity: 1.0 })
                    }
                }, 500)
            } catch (error) {
                setApiStatus('error')
                setApiError('Failed to record attendance locally')
            }
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
                FaceVerificationService.compareFaces(capturedImage, profileImageUrl, undefined, faceEmbedding),
                new Promise<never>((_, reject) =>
                    setTimeout(() => reject(new Error('TIMEOUT')), 45000)
                ),
            ])


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
                await onSubmitAttendance(capturedImage)
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

            // Attendance submission server errors — show actual message, not generic "Verification failed"
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
                setErrorMessage('Verification timed out. Please try again.')
            } else {
                setErrorMessage('Face verification failed. Please retake your selfie.')
            }
        }
    }, [capturedImage, capturedAt, profileImageUrl, onSubmitAttendance, onVerified])

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

    // Auto-capture countdown — only starts after face-api models are loaded
    useEffect(() => {
        if (status === 'streaming' && !capturedImage && modelsReady) {
            setCountdown(5)
            const timer = setInterval(() => {
                setCountdown(prev => {
                    if (prev === null) return null
                    if (prev <= 1) {
                        clearInterval(timer)
                        capturePhoto()
                        return 0
                    }
                    return prev - 1
                })
            }, 1000)
            return () => clearInterval(timer)
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
        startCamera()
        return () => stopCamera()
    }, [startCamera, stopCamera])

    return (
        <BiometricCameraModal
            isOpen={true}
            onClose={onBack || (() => {})}
            title="Identify Yourself"
            icon={<IconScanFace className="w-5 h-5 text-sky-400" />}
            videoRefOut={videoRef}
            onStreamReady={() => setStatus('streaming')}
            statusText={status === 'streaming' ? 'Align face within oval target' : undefined}
            isProcessing={status === 'verifying'}
            footerSlot={
                <div className="space-y-3">
                    {status === 'streaming' && (
                        <Button
                            onClick={handleProceed}
                            size="lg"
                            className="w-full h-14 rounded-2xl bg-white text-slate-950 font-black text-base hover:bg-slate-100 shadow-lg transition-all active:scale-95 cursor-pointer"
                        >
                            <IconScanFace className="w-5 h-5 mr-2 text-sky-500" />
                            IDENTIFY NOW
                        </Button>
                    )}

                    {status === 'captured' && (
                        <div className="text-center space-y-1">
                            <h3 className="text-xl font-bold text-white">Verify &amp; Proceed</h3>
                            <p className="text-slate-400 text-xs font-medium">Ensure your face and background are clear.</p>
                        </div>
                    )}
                </div>
            }
        >

            {/* Countdown Progress Ring UI Overlay */}
            {countdown !== null && countdown > 0 && (
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none flex flex-col items-center justify-center z-30">
                    <div className="relative w-24 h-24 flex items-center justify-center">
                        <svg className="absolute inset-0 w-full h-full transform -rotate-90">
                            <circle cx="48" cy="48" r="40" stroke="rgba(255, 255, 255, 0.15)" strokeWidth="4" fill="rgba(15, 23, 42, 0.6)" />
                            <motion.circle 
                                cx="48" 
                                cy="48" 
                                r="40" 
                                stroke="rgba(6, 182, 212, 1)" 
                                strokeWidth="4" 
                                fill="transparent" 
                                strokeDasharray={251.2}
                                animate={{ strokeDashoffset: 251.2 - ((countdown || 0) / 5) * 251.2 }}
                                transition={{ duration: 0.3, ease: "easeOut" }}
                                strokeLinecap="round"
                            />
                        </svg>
                        <span className="text-4xl font-black text-white relative z-10">{countdown}</span>
                    </div>
                    <p className="text-white/80 text-[10px] uppercase font-black tracking-widest text-center mt-4 bg-slate-900/80 backdrop-blur-md px-3 py-1 rounded-full border border-white/10 shadow-lg">
                        Auto-Capture
                    </p>
                </div>
            )}
            <canvas ref={canvasRef} className="hidden" />
        </BiometricCameraModal>
    )
}

export default SelfieCapture

