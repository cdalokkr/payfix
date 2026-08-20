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
import { Slider } from "@/components/ui/slider"
import { FaceVerificationService } from "@/lib/services/face-verification.service"
import { OfflineSyncService } from "@/lib/services/offline-sync.service"
import { BIOMETRIC_CAMERA_CONSTRAINTS, captureBiometricFrame } from "@/lib/biometrics/camera"

interface SelfieCaptureProps {
    profileImageUrl: string | null
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
            // Use one camera contract on every biometric screen. The actual frame is checked again at capture time.
            const stream = await navigator.mediaDevices.getUserMedia({
                video: BIOMETRIC_CAMERA_CONSTRAINTS,
                audio: false,
            })

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

    // Preserve the full camera frame. The server owns face cropping and alignment.
    const capturePhoto = useCallback(() => {
        if (!videoRef.current || !canvasRef.current || status !== 'streaming') return
        try {
            const frame = captureBiometricFrame(videoRef.current, canvasRef.current)
            setCapturedImage(frame.dataUrl)
            setCapturedAt(new Date())
            setStatus('captured')
            stopCamera()
        } catch (error) {
            setStatus('error')
            setErrorMessage(error instanceof Error ? error.message : 'Could not capture a verification image.')
        }
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

        // Face-only attendance cannot be treated as verified while offline.
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
                FaceVerificationService.compareFaces(capturedImage, profileImageUrl),
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
            } catch (error) {
                setApiStatus('error')
                setApiError(error instanceof Error ? error.message : 'Failed to record attendance')
            }
        } catch (error) {
            setStatus('verify_failed')
            const msg = error instanceof Error && error.message === 'TIMEOUT'
                ? 'Verification timed out. Please try again.'
                : 'Verification failed. Please try again.'
            setErrorMessage(msg)
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
        <div className="fixed inset-0 bg-slate-950 flex flex-col z-[60] overflow-hidden">
            {/* Immersive Camera View at TOP */}
            <div className="relative w-full aspect-square bg-slate-900 shadow-2xl overflow-hidden sm:max-w-md sm:mx-auto">
                <AnimatePresence mode="wait">
                    {capturedImage ? (
                        <motion.div
                            key="captured"
                            initial={{ scale: 1.1, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="absolute inset-0"
                        >
                            <img src={capturedImage} alt="Selfie" className="w-full h-full object-cover" />
                            
                            {/* Futuristic Verifying Laser-Scan Wave */}
                            {status === 'verifying' && (
                                <>
                                    <motion.div
                                        className="absolute inset-x-0 h-32 bg-gradient-to-b from-primary/0 via-primary/10 to-primary/0 z-20 pointer-events-none"
                                        animate={{ top: ['0%', '80%', '0%'] }}
                                        transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                                    />
                                    <motion.div
                                        className="absolute inset-x-0 h-0.5 bg-primary z-20 shadow-[0_0_15px_rgba(var(--primary),0.6)] pointer-events-none"
                                        animate={{ top: ['0%', '100%', '0%'] }}
                                        transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                                    />
                                    <div className="absolute inset-0 bg-slate-950/20 backdrop-brightness-95 z-10 pointer-events-none" />
                                </>
                            )}
                        </motion.div>
                    ) : (
                        <motion.div
                            key="camera-container"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="absolute inset-0 bg-slate-900"
                        >
                            <video
                                ref={videoRef}
                                autoPlay
                                playsInline
                                muted
                                className={`w-full h-full object-cover mirror transition-opacity duration-500 ${status === 'streaming' ? 'opacity-100' : 'opacity-0'}`}
                                style={{ transform: 'scaleX(-1)' }}
                            />

                            {status === 'streaming' ? (
                                <>
                                    {/* Immersive SVG Scanning Mask & Glowing Border */}
                                    <svg className="absolute inset-0 w-full h-full pointer-events-none z-20">
                                        <defs>
                                            <mask id="face-guide-mask">
                                                {/* White mask blocks nothing */}
                                                <rect width="100%" height="100%" fill="white" />
                                                {/* Black cut-out for the face oval */}
                                                <ellipse cx="50%" cy="50%" rx="35%" ry="38%" fill="black" />
                                            </mask>
                                        </defs>
                                        
                                        {/* Dimmed background overlay outside the oval cutout */}
                                        <rect width="100%" height="100%" fill="rgba(2, 6, 23, 0.65)" mask="url(#face-guide-mask)" />
                                        
                                        {/* Stylized Glowing Scanning Border */}
                                        <ellipse cx="50%" cy="50%" rx="35%" ry="38%" fill="none" stroke="rgba(255, 255, 255, 0.2)" strokeWidth="3" />
                                        <motion.ellipse 
                                            cx="50%" 
                                            cy="50%" 
                                            rx="35%" 
                                            ry="38%" 
                                            fill="none" 
                                            stroke="rgba(6, 182, 212, 0.8)" 
                                            strokeWidth="3" 
                                            animate={{ 
                                                stroke: ['rgba(6, 182, 212, 0.8)', 'rgba(34, 197, 94, 0.8)', 'rgba(6, 182, 212, 0.8)'] 
                                            }}
                                            transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
                                        />
                                    </svg>

                                    {/* Scanning Wave Animation */}
                                    <motion.div
                                        className="absolute inset-x-0 h-24 bg-gradient-to-b from-primary/0 via-primary/10 to-primary/0 z-10 pointer-events-none"
                                        animate={{ top: ['12.5%', '70%', '12.5%'] }}
                                        transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut" }}
                                    />

                                    <motion.div
                                        className="absolute inset-x-0 h-px bg-primary/40 z-10 shadow-[0_0_10px_rgba(var(--primary),0.3)] pointer-events-none"
                                        animate={{ top: ['12.5%', '87.5%', '12.5%'] }}
                                        transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut" }}
                                    />

                                    {/* Countdown Progress Ring UI */}
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
                                </>
                            ) : (
                                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/40 backdrop-blur-sm">
                                    {status === 'error' ? (
                                        <div className="text-center p-8 bg-red-500/10 backdrop-blur-md rounded-3xl border border-red-500/20">
                                            <IconX className="w-12 h-12 text-red-500 mx-auto mb-4" />
                                            <p className="text-xs font-black text-red-200 uppercase tracking-widest">{errorMessage}</p>
                                            <Button onClick={() => startCamera()} className="mt-4 bg-red-500 hover:bg-red-600 rounded-xl">Retry Camera</Button>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center gap-4 text-white/50">
                                            <IconLoader2 className="w-12 h-12 animate-spin text-primary" />
                                            <p className="text-[10px] font-black uppercase tracking-[0.3em] animate-pulse">
                                                {!modelsReady ? 'Loading Face Recognition...' : 'Initializing Camera'}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Navbar Overlay */}
                <div className="absolute top-0 inset-x-0 p-6 flex justify-between items-center z-30">
                    <motion.button
                        whileTap={{ scale: 0.9 }}
                        onClick={onBack}
                        className="p-3 rounded-2xl bg-black/20 backdrop-blur-xl border border-white/10 text-white"
                    >
                        <IconArrowLeft className="w-6 h-6" />
                    </motion.button>
                </div>
            </div>

            {/* Controls Area */}
            <div className="flex-1 bg-slate-950 p-8 flex flex-col justify-between overflow-y-auto">
                <div className="space-y-8">
                    {/* Attendance Mode Pill centered just after the selfie outer area */}
                    <div className="flex justify-center -mt-4 mb-2">
                        <div className="px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 backdrop-blur-md">
                            <span className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">Attendance Mode</span>
                        </div>
                    </div>
                    <div className="text-center space-y-2">
                        <h2 className="text-2xl font-black text-white tracking-tight">
                            {status === 'captured' ? "Verify & Proceed" : "Identify Yourself"}
                        </h2>
                        <p className="text-slate-450 text-sm font-medium">
                            {status === 'captured'
                                ? "Ensure your face and background are clear."
                                : "Face verification is required for security."}
                        </p>
                    </div>

                    {status === 'streaming' && hasZoomSupport && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="bg-white/5 border border-white/10 rounded-3xl p-6 px-8 backdrop-blur-lg"
                        >
                            <div className="flex items-center gap-6">
                                <IconZoomIn className="w-5 h-5 text-primary" />
                                <Slider
                                    value={[zoom]}
                                    onValueChange={(v) => setZoom(v[0])}
                                    min={1}
                                    max={3}
                                    step={0.1}
                                    className="flex-1 py-4"
                                />
                                <span className="text-xs font-black text-white w-8">{zoom.toFixed(1)}x</span>
                            </div>
                        </motion.div>
                    )}
                </div>

                <div className="space-y-4 pt-8">
                    {status === 'streaming' && (
                        <Button
                            onClick={capturePhoto}
                            size="lg"
                            className="w-full h-16 rounded-[2rem] bg-white text-slate-950 font-black text-lg hover:bg-slate-100 shadow-xl transition-all active:scale-95"
                        >
                            <IconCamera className="w-6 h-6 mr-3" />
                            IDENTIFY NOW
                        </Button>
                    )}

                    {status === 'captured' && (
                        <div className="flex flex-col items-center py-8">
                            <motion.div
                                animate={{ rotate: 360 }}
                                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                                className="w-16 h-16 rounded-full border-4 border-primary/30 border-t-primary mb-6"
                            />
                            <h3 className="text-xl font-black text-white tracking-tight mb-1">Processing</h3>
                            <p className="text-xs text-white/50 font-medium uppercase tracking-wider">Starting verification...</p>
                        </div>
                    )}

                    {/* Inline Verification States */}
                    <AnimatePresence mode="wait">
                        {status === 'verifying' && (
                            <motion.div
                                key="verifying"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                                className="flex flex-col items-center py-4 space-y-6"
                            >
                                <div className="relative w-16 h-16 flex items-center justify-center">
                                    <motion.div
                                        animate={{ rotate: 360 }}
                                        transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                                        className="absolute inset-0 rounded-full border-4 border-primary/20 border-t-primary"
                                    />
                                    <IconScanFace className="w-6 h-6 text-primary animate-pulse" />
                                </div>
                                <div className="text-center space-y-1">
                                    <h3 className="text-lg font-black text-white tracking-tight">Biometric Scan Active</h3>
                                    <p className="text-xs text-white/50 font-medium uppercase tracking-widest animate-pulse">Running face vector alignment...</p>
                                </div>

                                {/* Modern Biometric Checking Steps */}
                                <div className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 space-y-3.5 text-xs text-slate-300">
                                    <div className="flex items-center justify-between">
                                        <span className="font-semibold flex items-center gap-2 text-white/90">
                                            <IconCheckCheck className="w-3.5 h-3.5 text-primary animate-pulse" /> Check Biometric Identity
                                        </span>
                                        <span className="text-[10px] text-primary font-black uppercase animate-pulse">Scanning...</span>
                                    </div>
                                    <div className="h-px bg-white/10" />
                                    <div className="flex items-center justify-between opacity-50">
                                        <span className="font-semibold flex items-center gap-2">
                                            <IconShieldCheck className="w-3.5 h-3.5" /> Anti-Spoofing Liveness
                                        </span>
                                        <span className="text-[10px] font-black uppercase">Pending</span>
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        {status === 'verified' && (
                            <motion.div
                                key="verified"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                                className="flex flex-col items-center py-4 w-full space-y-6"
                            >
                                {/* Compact One-Row Verification Header */}
                                <div className="flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 w-full justify-center">
                                    <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center shrink-0 shadow-md">
                                        <IconCheckCheck className="w-5 h-5 text-white stroke-[3.5]" />
                                    </div>
                                    <div className="text-left flex flex-col min-w-0">
                                        <span className="text-sm font-black text-white">Verification Successful</span>
                                        <span className="text-[11px] text-emerald-450 font-bold uppercase tracking-wider">Similarity Match : {(similarity * 100).toFixed(0)}%</span>
                                    </div>
                                </div>

                                {apiStatus === 'pending' && (
                                    <div className="w-full">
                                        <Button
                                            disabled
                                            className="w-full h-14 rounded-2xl bg-white/10 border border-white/20 text-white/50 font-black text-lg cursor-not-allowed uppercase tracking-wider flex items-center justify-center gap-3"
                                        >
                                            <IconLoader2 className="w-5 h-5 mr-3 animate-spin text-primary shrink-0" />
                                            Syncing Attendance...
                                        </Button>
                                    </div>
                                )}

                                {apiStatus === 'error' && (
                                    <div className="w-full">
                                        <Button
                                            disabled
                                            className="w-full h-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500/50 font-black text-lg cursor-not-allowed uppercase tracking-wider flex items-center justify-center gap-3"
                                        >
                                            <IconAlertTriangle className="w-5 h-5 mr-3 text-rose-500 shrink-0" />
                                            Sync Failed
                                        </Button>
                                    </div>
                                )}

                                {apiStatus === 'success' && (
                                    <div className="w-full space-y-3">
                                        <div className="flex items-center justify-center gap-1 text-emerald-450 font-bold text-xs">
                                            <IconCheckCheck className="w-4 h-4" /> Live attendance synced successfully!
                                        </div>
                                        <Button
                                            onClick={handleComplete}
                                            className="w-full h-14 rounded-2xl bg-emerald-500 hover:bg-emerald-450 text-white font-black text-lg shadow-xl shadow-emerald-500/25 transition-all active:scale-95"
                                        >
                                            <IconCheckCheck className="w-5 h-5 mr-3" />
                                            DONE
                                        </Button>
                                    </div>
                                )}

                                {/* Floating Sync Error Modal Popup */}
                                <AnimatePresence>
                                    {apiStatus === 'error' && (
                                        <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-6">
                                            <motion.div
                                                initial={{ opacity: 0, scale: 0.95 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                exit={{ opacity: 0, scale: 0.95 }}
                                                className="bg-slate-900 border border-white/10 rounded-3xl p-6 w-full max-w-xs text-center space-y-4 shadow-2xl"
                                            >
                                                <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mx-auto">
                                                    <IconAlertTriangle className="w-6 h-6 text-rose-500" />
                                                </div>
                                                <div className="space-y-1.5">
                                                    <h4 className="text-sm font-black text-white uppercase tracking-wider">Sync Connection Error</h4>
                                                    <p className="text-xs text-slate-400 leading-relaxed">
                                                        {apiError || 'Failed to record attendance logs. Please check your internet connection.'}
                                                    </p>
                                                </div>
                                                <div className="grid grid-cols-2 gap-2.5 pt-2">
                                                    <Button
                                                        onClick={() => {
                                                            setApiStatus('idle')
                                                            setStatus('captured') // Go back to captured state
                                                        }}
                                                        variant="outline"
                                                        className="h-11 rounded-xl text-white border-white/20 font-bold text-xs bg-transparent"
                                                    >
                                                        Cancel
                                                    </Button>
                                                    <Button
                                                        onClick={async () => {
                                                            setApiStatus('pending')
                                                            try {
                                                                await onSubmitAttendance(capturedImage || undefined)
                                                                setApiStatus('success')
                                                            } catch (error) {
                                                                setApiStatus('error')
                                                                setApiError(error instanceof Error ? error.message : 'Failed to record attendance')
                                                            }
                                                        }}
                                                        className="h-11 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-black text-xs"
                                                    >
                                                        Retry Sync
                                                    </Button>
                                                </div>
                                            </motion.div>
                                        </div>
                                    )}
                                </AnimatePresence>
                            </motion.div>
                        )}

                        {status === 'verify_failed' && (
                            <motion.div
                                key="failed"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                                className="flex flex-col items-center py-4 space-y-5"
                            >
                                <motion.div
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    transition={{ type: "spring", damping: 12 }}
                                    className="w-16 h-16 rounded-full bg-rose-500 flex items-center justify-center shadow-xl shadow-rose-500/30"
                                >
                                    <IconX className="w-8 h-8 text-white stroke-[3.5]" />
                                </motion.div>
                                <div className="text-center space-y-1">
                                    <h3 className="text-lg font-black text-white tracking-tight">Security Biometric Mismatch</h3>
                                    <p className="text-xs text-rose-450 font-bold uppercase tracking-wider">Similarity Match: {(similarity * 100).toFixed(0)}%</p>
                                </div>

                                {/* Biometric Check Error Steps */}
                                <div className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 space-y-3.5 text-xs text-slate-300">
                                    <div className="flex items-center justify-between">
                                        <span className="font-semibold flex items-center gap-2 text-white/90">
                                            <IconX className="w-3.5 h-3.5 text-rose-500" /> Biometric Identity Match
                                        </span>
                                        <span className="text-[10px] text-rose-500 font-black uppercase">FAILED</span>
                                    </div>
                                    <div className="h-px bg-white/10" />
                                    <div className="flex items-center justify-between">
                                        <span className="font-semibold flex items-center gap-2 text-white/90">
                                            <IconAlertTriangle className="w-3.5 h-3.5 text-rose-500" /> Anti-Spoofing Verification
                                        </span>
                                        <span className="text-[10px] text-rose-500 font-black uppercase">FAILED</span>
                                    </div>
                                </div>

                                {/* Security Warning Explanation */}
                                <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-xs text-rose-350 text-center leading-relaxed space-y-2">
                                    <p className="font-bold flex items-center justify-center gap-1 text-rose-455">
                                        <IconAlertTriangle className="w-4 h-4 shrink-0" /> Anti-Spoofing Rule Triggered
                                    </p>
                                    <p className="opacity-95">
                                        The biometric facial vector does not match the registered embedding of the authorized account holder. Attendance is strictly locked.
                                    </p>
                                </div>

                                {/* Quick Tips */}
                                <div className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-xs text-slate-400 space-y-2">
                                    <p className="font-black text-white uppercase tracking-wider text-[10px]">Verification Tips:</p>
                                    <ul className="list-disc pl-4 space-y-1 text-slate-350">
                                        <li>Avoid backlighting (do not stand against bright windows/doors).</li>
                                        <li>Position face inside the cyan scanning mask.</li>
                                        <li>Ensure eyes, nose, and mouth are clearly illuminated.</li>
                                    </ul>
                                </div>

                                <div className="grid grid-cols-2 gap-3 w-full">
                                    <Button
                                        onClick={onBack}
                                        variant="outline"
                                        className="h-14 rounded-2xl text-white border-white/20 font-bold text-sm bg-transparent"
                                    >
                                        Exit
                                    </Button>
                                    <Button
                                        onClick={retakePhoto}
                                        className="h-14 rounded-2xl bg-white text-slate-900 font-black text-sm shadow-xl hover:bg-white/90"
                                    >
                                        Retry Scan
                                    </Button>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>

            <canvas ref={canvasRef} className="hidden" />
        </div>
    )
}

export default SelfieCapture
