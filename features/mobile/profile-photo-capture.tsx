"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { toast } from "sonner"
import { motion, AnimatePresence } from "framer-motion"
import {
    IconCamera,
    IconLoader2,
    IconRefresh,
    IconCheck,
    IconX,
    IconZoomIn,
    IconArrowLeft,
} from "@tabler/icons-react"
import { createClient } from "@/lib/supabase/client"

interface ProfilePhotoCaptureProps {
    profileId: string
    onSuccess?: () => void
}

export function ProfilePhotoCapture({ profileId, onSuccess }: ProfilePhotoCaptureProps) {
    const router = useRouter()
    const supabase = createClient()

    const [status, setStatus] = useState<'idle' | 'streaming' | 'captured' | 'uploading' | 'success' | 'error'>('idle')
    const [errorMessage, setErrorMessage] = useState<string>('')
    const [capturedImage, setCapturedImage] = useState<string | null>(null)
    const [zoom, setZoom] = useState<number>(1)
    const [isUploading, setIsUploading] = useState(false)
    const [hasZoomSupport, setHasZoomSupport] = useState(false)

    const [debugLogs, setDebugLogs] = useState<string[]>([])
    const addLog = (msg: string) => {
        console.log(`[CameraDebug] ${msg}`)
        setDebugLogs(prev => [msg, ...prev].slice(0, 5))
    }

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

    // Start camera stream with zoom capability
    const startCamera = useCallback(async (retryCount = 0) => {
        addLog(`startCamera attempt ${retryCount}`)
        // Stop any existing stream first
        stopCamera()

        if (isMounted.current) {
            setStatus('idle')
            setErrorMessage('')
            setCapturedImage(null)
        }

        // Delay for hardware release (350ms)
        if (retryCount === 0) {
            addLog("350ms lock delay")
            await new Promise(resolve => setTimeout(resolve, 350))
        }

        try {
            // Standard HD first, basic on retry
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

            addLog("GUM request...")

            // 10s timeout for GUM
            const gumPromise = navigator.mediaDevices.getUserMedia(constraints)
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('GUM_TIMEOUT')), 10000)
            )

            const stream = await Promise.race([gumPromise, timeoutPromise]) as MediaStream
            addLog("GUM success")

            if (!isMounted.current) {
                addLog("unmounted during GUM")
                stream.getTracks().forEach(track => track.stop())
                return
            }

            streamRef.current = stream

            // Capability check
            try {
                const videoTrack = stream.getVideoTracks()[0]
                const capabilities = videoTrack.getCapabilities() as any
                addLog(`Zoom support: ${!!capabilities?.zoom}`)
                if (capabilities?.zoom) {
                    setHasZoomSupport(true)
                }
            } catch (e) {
                addLog("CapCheck fail")
            }

            if (videoRef.current) {
                const video = videoRef.current
                video.srcObject = stream

                // Mobile attributes
                video.setAttribute('playsinline', 'true')
                video.muted = true

                const handlePlay = async () => {
                    if (!isMounted.current) return
                    try {
                        addLog("play()...")
                        await video.play()
                        addLog("playing")
                        setStatus('streaming')
                    } catch (err: any) {
                        addLog(`play err: ${err.message}`)
                        setStatus('streaming')
                    }
                }

                if (video.readyState >= 2) {
                    addLog("ready, playing")
                    handlePlay()
                } else {
                    addLog("wait metadata")
                    video.onloadedmetadata = () => {
                        addLog("metadata event")
                        handlePlay()
                    }
                    // Spinner safety timeout
                    setTimeout(() => {
                        if (isMounted.current && status === 'idle') {
                            addLog("safety timeout")
                            handlePlay()
                        }
                    }, 2000)
                }
            } else {
                addLog("videoRef NULL")
            }
        } catch (error: unknown) {
            console.error('Camera error:', error)

            // Auto-retry once with elementary constraints
            if (retryCount === 0 && isMounted.current) {
                return startCamera(1)
            }

            if (!isMounted.current) return

            setStatus('error')
            const err = error as DOMException
            const name = err.name || ''

            if (name === 'NotAllowedError' || name === 'PermissionDeniedError' || name === 'SecurityError') {
                setErrorMessage('Permission Blocked. Check site settings.')
            } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
                setErrorMessage('No camera found.')
            } else {
                setErrorMessage('Hardware Error. Please refresh.')
            }
        }
    }, [stopCamera, status])

    // Apply zoom to video stream
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
                }).catch(err => console.warn("Zoom apply failed:", err))
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

        // Set canvas to high quality square
        canvas.width = 1000
        canvas.height = 1000

        // Source dimensions
        const vw = video.videoWidth
        const vh = video.videoHeight
        const size = Math.min(vw, vh)

        // Calculate crop for center square
        const sx = (vw - size) / 2
        const sy = (vh - size) / 2

        // Draw cropped square video frame
        ctx.save()
        // Mirror if it's the user camera
        ctx.translate(canvas.width, 0)
        ctx.scale(-1, 1)
        ctx.drawImage(video, sx, sy, size, size, 0, 0, canvas.width, canvas.height)
        ctx.restore()

        const imageDataUrl = canvas.toDataURL('image/jpeg', 0.95)
        setCapturedImage(imageDataUrl)
        setStatus('captured')
        stopCamera()
    }, [stopCamera, status])

    // Retake photo
    const handleRetake = useCallback(() => {
        startCamera()
    }, [startCamera])

    // Upload photo
    const handleUpload = useCallback(async () => {
        if (!capturedImage) return

        setIsUploading(true)
        setStatus('uploading')

        try {
            const response = await fetch(capturedImage)
            const blob = await response.blob()

            const fileName = `profile-${profileId}-${Date.now()}.jpg`
            const { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(fileName, blob, {
                    contentType: 'image/jpeg',
                    upsert: true,
                })

            if (uploadError) throw uploadError

            const { data: { publicUrl } } = supabase.storage
                .from('avatars')
                .getPublicUrl(fileName)

            const { error: updateError } = await supabase
                .from('profiles')
                .update({
                    avatar_url: publicUrl,
                    avatar_status: 'custom'
                })
                .eq('id', profileId)

            if (updateError) throw updateError

            setStatus('success')
            toast.success('Profile photo updated successfully!')

            setTimeout(() => {
                onSuccess?.()
                router.push('/mobile')
                router.refresh()
            }, 1500)
        } catch (error) {
            console.error('Upload error:', error)
            setStatus('error')
            setErrorMessage('Failed to upload. Please check your connection.')
            toast.error('Upload failed')
        } finally {
            setIsUploading(false)
        }
    }, [capturedImage, profileId, supabase, router, onSuccess])

    // Handle back button
    const handleBack = useCallback(() => {
        stopCamera()
        router.back()
    }, [stopCamera, router])

    useEffect(() => {
        startCamera()
        return () => stopCamera()
    }, [startCamera, stopCamera])

    return (
        <div className="fixed inset-0 bg-slate-950 flex flex-col z-[60] overflow-hidden">
            {/* Immersive Camera Section at TOP */}
            <div className="relative w-full aspect-square sm:max-w-md sm:mx-auto bg-slate-900 shadow-2xl overflow-hidden">
                <AnimatePresence mode="wait">
                    {status === 'streaming' ? (
                        <motion.div
                            key="camera"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0"
                        >
                            <video
                                ref={videoRef}
                                autoPlay
                                playsInline
                                muted
                                className="w-full h-full object-cover mirror"
                                style={{ transform: 'scaleX(-1)' }}
                            />
                            {/* Modern Overlay Gradient */}
                            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-slate-950/20 pointer-events-none" />

                            {/* Scanning Animation */}
                            <motion.div
                                className="absolute inset-x-0 h-32 bg-gradient-to-b from-primary/0 via-primary/20 to-primary/0 z-10 pointer-events-none"
                                animate={{ top: ['0%', '80%', '0%'] }}
                                transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
                            />

                            <motion.div
                                className="absolute inset-x-0 h-px bg-primary z-10 shadow-[0_0_15px_rgba(var(--primary),0.5)] pointer-events-none"
                                animate={{ top: ['0%', '100%', '0%'] }}
                                transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
                            />

                            {/* Circular Guide */}
                            <div className="absolute inset-0 flex items-center justify-center">
                                <div className="w-3/4 aspect-square rounded-full border-2 border-white/20 border-dashed animate-[spin_20s_linear_infinite]" />
                                <div className="absolute w-3/4 aspect-square rounded-full border border-white/40" />
                            </div>
                        </motion.div>
                    ) : capturedImage ? (
                        <motion.div
                            key="captured"
                            initial={{ scale: 1.1, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="absolute inset-0"
                        >
                            <img src={capturedImage} alt="Captured" className="w-full h-full object-cover" />
                            {status === 'success' && (
                                <div className="absolute inset-0 bg-green-500/40 backdrop-blur-sm flex items-center justify-center">
                                    <motion.div
                                        initial={{ scale: 0 }}
                                        animate={{ scale: 1 }}
                                        className="bg-white rounded-full p-6 shadow-2xl"
                                    >
                                        <IconCheck className="w-16 h-16 text-green-500" />
                                    </motion.div>
                                </div>
                            )}
                        </motion.div>
                    ) : (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-white/50">
                            {status === 'error' ? (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className="text-center p-8 bg-red-500/10 backdrop-blur-md rounded-3xl border border-red-500/20"
                                >
                                    <IconX className="w-12 h-12 text-red-500 mx-auto mb-4" />
                                    <p className="text-sm font-bold text-red-200 uppercase tracking-widest">{errorMessage}</p>
                                    <Button onClick={() => startCamera()} className="mt-6 bg-red-500 hover:bg-red-600 rounded-xl">
                                        Grant Permissions
                                    </Button>
                                </motion.div>
                            ) : (
                                <div className="flex flex-col items-center gap-4">
                                    <IconLoader2 className="w-12 h-12 animate-spin text-primary" />
                                    <p className="text-[10px] uppercase font-black tracking-[0.3em] animate-pulse">Initializing Camera</p>
                                </div>
                            )}
                        </div>
                    )}
                </AnimatePresence>

                {/* Debug Logs Overlay - Visible in all envs for now */}
                {debugLogs.length > 0 && (
                    <div className="absolute top-20 left-4 right-4 z-50 pointer-events-none">
                        <div className="bg-black/80 backdrop-blur-md rounded-xl p-3 border border-white/10">
                            <p className="text-[8px] font-black text-white/40 uppercase tracking-widest mb-2">Internal Diagnostics</p>
                            <div className="space-y-1">
                                {debugLogs.map((log, i) => (
                                    <p key={i} className="text-[10px] font-medium text-primary/80 truncate">
                                        {`> ${log}`}
                                    </p>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* Top Controls Overlay */}
                <div className="absolute top-0 left-0 right-0 p-6 flex justify-between items-start z-30">
                    <motion.button
                        whileTap={{ scale: 0.9 }}
                        onClick={handleBack}
                        className="p-3 rounded-2xl bg-black/20 backdrop-blur-xl border border-white/10 text-white"
                    >
                        <IconArrowLeft className="w-6 h-6" />
                    </motion.button>
                    {status === 'streaming' && hasZoomSupport && (
                        <div className="p-3 rounded-2xl bg-black/20 backdrop-blur-xl border border-white/10 text-white font-black text-[10px] tracking-widest uppercase">
                            HD Active
                        </div>
                    )}
                </div>
            </div>

            {/* Bottom Controls Section */}
            <div className="flex-1 bg-slate-950 p-8 flex flex-col justify-between overflow-y-auto">
                <div className="space-y-8">
                    {/* Instructions / Status */}
                    <div className="text-center space-y-2">
                        <h2 className="text-2xl font-black text-white tracking-tight">
                            {status === 'captured' ? "Looking Good!" : "Selfie Time"}
                        </h2>
                        <p className="text-slate-400 text-sm font-medium">
                            {status === 'captured'
                                ? "Update your profile with this photo or retake it."
                                : "Ensure your face is within the circle and well-lit."}
                        </p>
                    </div>

                    {/* Zoom Slider - Modern Styled */}
                    {status === 'streaming' && hasZoomSupport && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
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
                            className="w-full h-16 rounded-[2rem] bg-white text-slate-950 font-black text-lg hover:bg-slate-100 shadow-[0_20px_40px_rgba(255,255,255,0.1)] transition-all active:scale-95"
                        >
                            <IconCamera className="w-6 h-6 mr-3" />
                            CAPTURE NOW
                        </Button>
                    )}

                    {status === 'captured' && !isUploading && (
                        <div className="grid grid-cols-2 gap-4">
                            <Button
                                onClick={handleRetake}
                                variant="outline"
                                className="h-16 rounded-[2rem] border-white/10 text-white bg-white/5 hover:bg-white/10 font-bold"
                            >
                                <IconRefresh className="w-5 h-5 mr-3" />
                                RETAKE
                            </Button>
                            <Button
                                onClick={handleUpload}
                                className="h-16 rounded-[2rem] bg-primary hover:bg-primary/90 text-white font-black shadow-xl shadow-primary/20 transition-all active:scale-95"
                            >
                                <IconCheck className="w-5 h-5 mr-3" />
                                UPDATE
                            </Button>
                        </div>
                    )}

                    {status === 'uploading' && (
                        <Button disabled className="w-full h-16 rounded-[2rem] bg-white/10 text-white font-bold opacity-80 cursor-not-allowed">
                            <IconLoader2 className="w-5 h-5 mr-3 animate-spin" />
                            UPLOADING...
                        </Button>
                    )}
                    {status === 'streaming' && process.env.NODE_ENV === 'development' && (
                        <Button
                            variant="ghost"
                            onClick={() => {
                                const canvas = canvasRef.current;
                                if (canvas) {
                                    canvas.width = 100;
                                    canvas.height = 100;
                                    setCapturedImage(canvas.toDataURL());
                                    setStatus('captured');
                                }
                            }}
                            className="w-full text-[10px] text-white/20 font-bold tracking-widest hover:bg-transparent hover:text-white/40"
                        >
                            DEBUG: SKIP CAMERA
                        </Button>
                    )}
                </div>
            </div>

            {/* Hidden canvas for capture */}
            <canvas ref={canvasRef} className="hidden" />
        </div>
    )
}

