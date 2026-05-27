"use client"

import React, { useState, useRef, useCallback, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { motion, AnimatePresence } from "framer-motion"
import { Camera as IconCamera, Loader2 as IconLoader2, RefreshCw as IconRefresh, Check as IconCheck, X as IconX, ArrowLeft as IconArrowLeft, ZoomIn as IconZoomIn } from "lucide-react"
import { format } from "date-fns"
import { Slider } from "@/components/ui/slider"
import { FaceVerificationService } from "@/lib/services/face-verification.service"

interface SelfieCaptureProps {
    profileImageUrl: string | null
    onCaptured: (result: SelfieResult) => void
    onVerified: (result: { matched: boolean; similarity: number }) => void
    onSubmitAttendance: () => Promise<void>
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
            // Request Full HD (1080p) for clearer selfies, fallback to basic video on retry
            const constraints: MediaStreamConstraints = retryCount === 0 ? {
                video: {
                    facingMode: 'user',
                    width: { ideal: 1920 },
                    height: { ideal: 1080 },
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
                await onSubmitAttendance()
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
    }, [capturedImage, capturedAt, profileImageUrl, onSubmitAttendance])

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
                                    {/* Face guide */}
                                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                        <div className="w-3/4 h-3/4 border-2 border-white/30 rounded-[3rem] border-dashed animate-pulse" />
                                        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-slate-950 via-transparent to-transparent pointer-events-none" />
                                    </div>

                                    {/* Scanning Animation */}
                                    <motion.div
                                        className="absolute inset-x-0 h-32 bg-gradient-to-b from-primary/0 via-primary/10 to-primary/0 z-10 pointer-events-none"
                                        animate={{ top: ['0%', '80%', '0%'] }}
                                        transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
                                    />

                                    <motion.div
                                        className="absolute inset-x-0 h-px bg-primary/40 z-10 shadow-[0_0_10px_rgba(var(--primary),0.3)] pointer-events-none"
                                        animate={{ top: ['0%', '100%', '0%'] }}
                                        transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
                                    />

                                    {/* Countdown UI */}
                                    {countdown !== null && countdown > 0 && (
                                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
                                            <motion.div
                                                key={countdown}
                                                initial={{ scale: 1.5, opacity: 0 }}
                                                animate={{ scale: 1, opacity: 1 }}
                                                className="w-24 h-24 rounded-full bg-primary/40 backdrop-blur-xl border-4 border-white/20 flex items-center justify-center"
                                            >
                                                <span className="text-4xl font-black text-white">{countdown}</span>
                                            </motion.div>
                                            <p className="text-white/70 text-[10px] uppercase font-black tracking-widest text-center mt-4">Auto-Capture</p>
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
                    <div className="px-4 py-2 rounded-full bg-primary/20 backdrop-blur-xl border border-primary/30">
                        <span className="text-[10px] font-black text-primary uppercase tracking-widest">Attendance Mode</span>
                    </div>
                </div>
            </div>

            {/* Controls Area */}
            <div className="flex-1 bg-slate-950 p-8 flex flex-col justify-between overflow-y-auto">
                <div className="space-y-8">
                    <div className="text-center space-y-2">
                        <h2 className="text-2xl font-black text-white tracking-tight">
                            {status === 'captured' ? "Verify & Proceed" : "Identify Yourself"}
                        </h2>
                        <p className="text-slate-400 text-sm font-medium">
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
                                className="flex flex-col items-center py-8"
                            >
                                <motion.div
                                    animate={{ rotate: 360 }}
                                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                                    className="w-16 h-16 rounded-full border-4 border-primary/30 border-t-primary mb-6"
                                />
                                <h3 className="text-xl font-black text-white tracking-tight mb-1">Verifying Identity</h3>
                                <p className="text-xs text-white/50 font-medium uppercase tracking-wider">Please wait...</p>
                            </motion.div>
                        )}

                        {status === 'verified' && (
                            <motion.div
                                key="verified"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                                className="flex flex-col items-center py-4"
                            >
                                <motion.div
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    transition={{ type: "spring", damping: 12 }}
                                    className="w-16 h-16 rounded-full bg-emerald-500 flex items-center justify-center mb-4 shadow-xl shadow-emerald-500/30"
                                >
                                    <IconCheck className="w-8 h-8 text-white stroke-[3]" />
                                </motion.div>
                                <h3 className="text-xl font-black text-white tracking-tight mb-1">Verified!</h3>
                                <p className="text-sm text-emerald-300 font-bold mb-4">Match: {(similarity * 100).toFixed(0)}%</p>

                                {apiStatus === 'pending' ? (
                                    <>
                                        <div className="flex items-center gap-2 mb-4">
                                            <IconLoader2 className="w-4 h-4 text-white/50 animate-spin" />
                                            <p className="text-xs text-white/50 font-medium">Syncing attendance...</p>
                                        </div>
                                        <Button
                                            disabled
                                            className="w-full h-14 rounded-[2rem] bg-white/30 text-white/50 font-black text-lg cursor-not-allowed"
                                        >
                                            <IconLoader2 className="w-5 h-5 mr-3 animate-spin" />
                                            SYNCING...
                                        </Button>
                                    </>
                                ) : (
                                    <>
                                        <p className="text-xs text-white/40 font-medium mb-4">Attendance recorded</p>
                                        <Button
                                            onClick={handleComplete}
                                            className="w-full h-14 rounded-[2rem] bg-emerald-500 hover:bg-emerald-400 text-white font-black text-lg shadow-xl shadow-emerald-500/20 transition-all active:scale-95"
                                        >
                                            <IconCheck className="w-5 h-5 mr-3" />
                                            DONE
                                        </Button>
                                    </>
                                )}
                            </motion.div>
                        )}

                        {status === 'verify_failed' && (
                            <motion.div
                                key="failed"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                                className="flex flex-col items-center py-4"
                            >
                                <motion.div
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    transition={{ type: "spring", damping: 12 }}
                                    className="w-16 h-16 rounded-full bg-rose-500 flex items-center justify-center mb-4 shadow-xl shadow-rose-500/30"
                                >
                                    <IconX className="w-8 h-8 text-white stroke-[3]" />
                                </motion.div>
                                <h3 className="text-xl font-black text-white tracking-tight mb-1">Verification Failed</h3>
                                <p className="text-xs text-rose-300 font-medium mb-1 text-center">{errorMessage}</p>
                                <p className="text-[10px] text-white/40 font-medium mb-4 uppercase tracking-wider">Try with better lighting</p>
                                <Button
                                    onClick={onBack}
                                    className="w-full h-14 rounded-[2rem] bg-white text-slate-900 font-black text-lg shadow-xl hover:bg-white/90 transition-all active:scale-95"
                                >
                                    OK
                                </Button>
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
