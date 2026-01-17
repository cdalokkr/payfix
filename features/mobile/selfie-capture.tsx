"use client"

import React, { useState, useRef, useCallback, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { motion, AnimatePresence } from "framer-motion"
import { IconCamera, IconLoader2, IconRefresh, IconCheck, IconX, IconArrowLeft, IconZoomIn } from "@tabler/icons-react"
import { format } from "date-fns"
import { Slider } from "@/components/ui/slider"

interface SelfieCaptureProps {
    onCaptured: (result: SelfieResult) => void
    onBack?: () => void
}

export interface SelfieResult {
    imageDataUrl: string
    capturedAt: Date
}

export function SelfieCapture({ onCaptured, onBack }: SelfieCaptureProps) {
    const [status, setStatus] = useState<'idle' | 'streaming' | 'captured' | 'error'>('idle')
    const [errorMessage, setErrorMessage] = useState<string>('')
    const [capturedImage, setCapturedImage] = useState<string | null>(null)
    const [capturedAt, setCapturedAt] = useState<Date | null>(null)
    const [countdown, setCountdown] = useState<number | null>(null)
    const [zoom, setZoom] = useState<number>(1)
    const [hasZoomSupport, setHasZoomSupport] = useState(false)

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
    useEffect(() => {
        return () => { isMounted.current = false }
    }, [])

    // Start camera stream
    const startCamera = useCallback(async (retryCount = 0) => {
        stopCamera()
        if (isMounted.current) {
            setStatus('idle')
            setErrorMessage('')
        }

        // Delay for hardware release (350ms)
        if (retryCount === 0) {
            await new Promise(resolve => setTimeout(resolve, 350))
        }

        try {
            // Use standard HD (720p) first, fallback to basic video on retry
            const constraints: MediaStreamConstraints = retryCount === 0 ? {
                video: {
                    facingMode: 'user',
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
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
                    } catch (err) {
                        console.warn("Autoplay block, but status set to streaming:", err)
                        setStatus('streaming')
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
            }
        } catch (error: unknown) {
            console.error('Camera error:', error)

            // Auto-retry once with basic video
            if (retryCount === 0 && isMounted.current) {
                return startCamera(1)
            }

            if (!isMounted.current) return

            setStatus('error')
            setErrorMessage('Camera access failed. Check site settings.')
        }
    }, [stopCamera, status])

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

        canvas.width = 1000
        canvas.height = 1000

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

        // Draw modern timestamp pill
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'
        const pillWidth = 350
        const pillHeight = 50
        const pillX = (canvas.width - pillWidth) / 2
        const pillY = canvas.height - 80

        // Rounded rect for pill
        ctx.beginPath()
        ctx.roundRect(pillX, pillY, pillWidth, pillHeight, 25)
        ctx.fill()

        ctx.fillStyle = '#ffffff'
        ctx.font = 'bold 22px Inter, system-ui'
        ctx.textAlign = 'center'
        ctx.fillText(timestamp, canvas.width / 2, pillY + 33)

        const imageDataUrl = canvas.toDataURL('image/jpeg', 0.9)
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

    const handleProceed = useCallback(() => {
        if (capturedImage && capturedAt) {
            onCaptured({
                imageDataUrl: capturedImage,
                capturedAt,
            })
        }
    }, [capturedImage, capturedAt, onCaptured])

    // Auto-capture countdown
    useEffect(() => {
        if (status === 'streaming' && !capturedImage) {
            setCountdown(7)
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

    useEffect(() => {
        startCamera()
        return () => stopCamera()
    }, [startCamera, stopCamera])

    return (
        <div className="fixed inset-0 bg-slate-950 flex flex-col z-[60] overflow-hidden">
            {/* Immersive Camera View at TOP */}
            <div className="relative w-full aspect-square bg-slate-900 shadow-2xl overflow-hidden sm:max-w-md sm:mx-auto">
                <AnimatePresence mode="wait">
                    {status === 'streaming' ? (
                        <motion.div
                            key="streaming"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="absolute inset-0"
                        >
                            <video
                                ref={videoRef}
                                className="w-full h-full object-cover mirror"
                                style={{ transform: 'scaleX(-1)' }}
                                playsInline
                                muted
                            />
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
                        </motion.div>
                    ) : capturedImage ? (
                        <motion.div
                            key="captured"
                            initial={{ scale: 1.1, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="absolute inset-0"
                        >
                            <img src={capturedImage} alt="Selfie" className="w-full h-full object-cover" />
                        </motion.div>
                    ) : (
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                            {status === 'error' ? (
                                <div className="text-center p-8">
                                    <IconX className="w-12 h-12 text-red-500 mx-auto mb-4" />
                                    <p className="text-xs font-black text-red-200 uppercase tracking-widest">{errorMessage}</p>
                                    <Button onClick={startCamera} className="mt-4">Reset Camera</Button>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center gap-4">
                                    <IconLoader2 className="w-12 h-12 animate-spin text-primary" />
                                    <p className="text-[10px] font-black text-white/50 uppercase tracking-[0.3em]">Calibrating</p>
                                </div>
                            )}
                        </div>
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
                        <div className="grid grid-cols-2 gap-4">
                            <Button
                                onClick={retakePhoto}
                                variant="outline"
                                className="h-16 rounded-[2rem] border-white/10 text-white bg-white/5 hover:bg-white/10 font-bold"
                            >
                                <IconRefresh className="w-5 h-5 mr-3" />
                                RETAKE
                            </Button>
                            <Button
                                onClick={handleProceed}
                                className="h-16 rounded-[2rem] bg-primary hover:bg-primary/90 text-white font-black shadow-xl shadow-primary/20 transition-all active:scale-95"
                            >
                                <IconCheck className="w-5 h-5 mr-3" />
                                CONFIRM
                            </Button>
                        </div>
                    )}

                    {status === 'streaming' && process.env.NODE_ENV === 'development' && (
                        <Button
                            variant="ghost"
                            onClick={() => {
                                const canvas = canvasRef.current;
                                if (canvas) {
                                    canvas.width = 100;
                                    canvas.height = 100;
                                    const now = new Date();
                                    setCapturedImage(canvas.toDataURL());
                                    setCapturedAt(now);
                                    setStatus('captured');
                                }
                            }}
                            className="w-full text-[10px] text-white/20 font-bold tracking-widest hover:bg-transparent hover:text-white/40"
                        >
                            DEBUG: SKIP FOR TESTING
                        </Button>
                    )}
                </div>
            </div>

            <canvas ref={canvasRef} className="hidden" />
        </div>
    )
}

export default SelfieCapture

