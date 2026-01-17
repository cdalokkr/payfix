"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { motion, AnimatePresence } from "framer-motion"
import {
    IconCamera,
    IconLoader2,
    IconRefresh,
    IconCheck,
    IconX,
    IconArrowLeft,
    IconUser,
    IconMail,
    IconId,
} from "@tabler/icons-react"
import { createClient } from "@/lib/supabase/client"

interface ProfileData {
    fullName: string
    email: string
    role: string
    avatarUrl: string | null
    employeeId?: string
    designation?: string | null
}

interface ProfilePhotoCaptureProps {
    profileId: string
    profileData: ProfileData
    onSuccess?: () => void
}

export function ProfilePhotoCapture({ profileId, profileData, onSuccess }: ProfilePhotoCaptureProps) {
    const router = useRouter()
    const supabase = createClient()

    const [status, setStatus] = useState<'idle' | 'streaming' | 'captured' | 'uploading' | 'success' | 'error'>('idle')
    const [errorMessage, setErrorMessage] = useState<string>('')
    const [capturedImage, setCapturedImage] = useState<string | null>(null)
    const [isUploading, setIsUploading] = useState(false)
    const statusRef = useRef(status)

    // Keep statusRef in sync
    useEffect(() => {
        statusRef.current = status
    }, [status])


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

        // Stop any existing stream first
        stopCamera()

        if (isMounted.current) {
            setStatus('idle')
            setErrorMessage('')
            setCapturedImage(null)
        }

        // Delay for hardware release (350ms)
        if (retryCount === 0) {
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

            // 10s timeout for GUM
            const gumPromise = navigator.mediaDevices.getUserMedia(constraints)
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('GUM_TIMEOUT')), 10000)
            )

            const stream = await Promise.race([gumPromise, timeoutPromise]) as MediaStream

            if (!isMounted.current) {
                stream.getTracks().forEach(track => track.stop())
                return
            }

            streamRef.current = stream

            if (videoRef.current) {
                const video = videoRef.current
                video.srcObject = stream

                // Mobile attributes
                video.setAttribute('playsinline', 'true')
                video.muted = true

                const handlePlay = async () => {
                    if (!isMounted.current) return
                    try {
                        await video.play()
                        setStatus('streaming')
                        isInitializing.current = false
                    } catch (err: any) {
                        console.warn("Autoplay blocked:", err)
                        setStatus('streaming')
                        isInitializing.current = false
                    }
                }

                if (video.readyState >= 2) {
                    handlePlay()
                } else {
                    video.onloadedmetadata = handlePlay
                    // Safety timeout
                    setTimeout(() => {
                        if (isMounted.current && statusRef.current === 'idle') {
                            handlePlay()
                        }
                    }, 2000)
                }
            }
        } catch (error: unknown) {
            console.error('Camera error:', error)

            // Auto-retry once with basic constraints
            if (retryCount === 0 && isMounted.current) {
                return startCamera(1)
            }

            if (!isMounted.current) return

            setStatus('error')
            isInitializing.current = false
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
    }, [stopCamera])

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
            console.log('[UPLOAD] Starting upload...')
            const response = await fetch(capturedImage)
            const blob = await response.blob()
            console.log('[UPLOAD] Blob created, size:', blob.size)

            const fileName = `profile-${profileId}-${Date.now()}.jpg`
            console.log('[UPLOAD] Uploading to storage:', fileName)

            const { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(fileName, blob, {
                    contentType: 'image/jpeg',
                    upsert: true,
                })

            if (uploadError) {
                console.error('[UPLOAD] Storage upload error:', uploadError.message, uploadError)
                throw uploadError
            }
            console.log('[UPLOAD] Storage upload success')

            const { data: { publicUrl } } = supabase.storage
                .from('avatars')
                .getPublicUrl(fileName)
            console.log('[UPLOAD] Public URL:', publicUrl)

            console.log('[UPLOAD] Updating profile...')
            const { error: updateError } = await supabase
                .from('profiles')
                .update({
                    avatar_url: publicUrl,
                    avatar_status: 'custom'
                })
                .eq('id', profileId)

            if (updateError) {
                console.error('[UPLOAD] Profile update error:', updateError.message, updateError)
                throw updateError
            }
            console.log('[UPLOAD] Profile updated successfully')

            setStatus('success')
            toast.success('Profile photo updated successfully!')

            setTimeout(() => {
                onSuccess?.()
                router.push('/mobile')
                router.refresh()
            }, 1500)
        } catch (error: any) {
            console.error('[UPLOAD] Error:', error?.message || error)
            setStatus('error')
            setErrorMessage(error?.message || 'Failed to upload. Please check your connection.')
            toast.error('Upload failed: ' + (error?.message || 'Unknown error'))
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
                    {capturedImage ? (
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
                        <motion.div
                            key="camera-container"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="absolute inset-0 bg-slate-900"
                        >
                            {/* Video is always rendered so videoRef is never null */}
                            <video
                                ref={videoRef}
                                autoPlay
                                playsInline
                                muted
                                className={`w-full h-full object-cover mirror transition-opacity duration-500 ${status === 'streaming' ? 'opacity-100' : 'opacity-0'}`}
                                style={{ transform: 'scaleX(-1)' }}
                            />

                            {status === 'streaming' && (
                                <>
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
                                </>
                            )}

                            {status !== 'streaming' && (
                                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/40 backdrop-blur-sm text-white/50">
                                    {status === 'error' ? (
                                        <motion.div
                                            initial={{ opacity: 0, scale: 0.9 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            className="text-center p-8 bg-red-500/10 backdrop-blur-md rounded-3xl border border-red-500/20"
                                        >
                                            <IconX className="w-12 h-12 text-red-500 mx-auto mb-4" />
                                            <p className="text-sm font-bold text-red-200 uppercase tracking-widest">{errorMessage}</p>
                                            <Button onClick={() => startCamera()} className="mt-6 bg-red-500 hover:bg-red-600 rounded-xl">
                                                Retry Camera
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
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Top Controls Overlay */}
                <div className="absolute top-0 left-0 right-0 p-6 flex justify-between items-start z-30">
                    <motion.button
                        whileTap={{ scale: 0.9 }}
                        onClick={handleBack}
                        className="p-3 rounded-2xl bg-black/20 backdrop-blur-xl border border-white/10 text-white"
                    >
                        <IconArrowLeft className="w-6 h-6" />
                    </motion.button>
                </div>
            </div>

            {/* Bottom Controls Section */}
            <div className="flex-1 bg-slate-950 p-6 flex flex-col justify-between overflow-y-auto">
                <div className="space-y-6">
                    {/* Instructions / Status */}
                    <div className="text-center space-y-2">
                        <h2 className="text-2xl font-black text-white tracking-tight">
                            {status === 'captured' ? "Looking Good!" : status === 'uploading' ? "Updating..." : "Selfie Time"}
                        </h2>
                        <p className="text-slate-400 text-sm font-medium">
                            {status === 'captured'
                                ? "Update your profile with this photo or retake it."
                                : status === 'uploading'
                                    ? "Please wait while we update your photo..."
                                    : "Ensure your face is within the circle and well-lit."}
                        </p>
                    </div>

                    {/* Employee Profile Card */}
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-white/5 border border-white/10 rounded-2xl p-4 backdrop-blur-lg"
                    >
                        <div className="flex items-center gap-4">
                            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-primary/30 to-primary/10 border-2 border-primary/30 flex items-center justify-center overflow-hidden">
                                {profileData.avatarUrl ? (
                                    <img src={profileData.avatarUrl} alt="Current" className="w-full h-full object-cover" />
                                ) : (
                                    <IconUser className="w-7 h-7 text-primary" />
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-white font-bold text-base truncate">{profileData.fullName}</p>
                                <div className="flex items-center gap-2 mt-1">
                                    <IconMail className="w-3.5 h-3.5 text-slate-500" />
                                    <p className="text-slate-400 text-xs truncate">{profileData.email}</p>
                                </div>
                                {profileData.designation && (
                                    <div className="flex items-center gap-2 mt-0.5">
                                        <IconId className="w-3.5 h-3.5 text-slate-500" />
                                        <p className="text-slate-500 text-xs">{profileData.designation}</p>
                                    </div>
                                )}
                            </div>
                            <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-wider">
                                {profileData.role}
                            </span>
                        </div>
                    </motion.div>
                </div>

                <div className="space-y-4 pt-6">
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
                </div>
            </div>

            {/* Full-screen Upload Overlay */}
            <AnimatePresence>
                {status === 'uploading' && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[70] bg-slate-950/90 backdrop-blur-xl flex flex-col items-center justify-center"
                    >
                        <motion.div
                            initial={{ scale: 0.8 }}
                            animate={{ scale: 1 }}
                            className="w-24 h-24 rounded-full bg-primary/20 border-4 border-primary/30 flex items-center justify-center mb-6"
                        >
                            <IconLoader2 className="w-12 h-12 animate-spin text-primary" />
                        </motion.div>
                        <p className="text-white text-xl font-bold">Updating Photo</p>
                        <p className="text-slate-400 text-sm mt-2">Please wait...</p>
                    </motion.div>
                )}
                {status === 'success' && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[70] bg-slate-950/90 backdrop-blur-xl flex flex-col items-center justify-center"
                    >
                        <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: "spring", stiffness: 200, damping: 15 }}
                            className="w-24 h-24 rounded-full bg-green-500/20 border-4 border-green-500/30 flex items-center justify-center mb-6"
                        >
                            <IconCheck className="w-12 h-12 text-green-500" />
                        </motion.div>
                        <p className="text-white text-xl font-bold">Photo Updated!</p>
                        <p className="text-slate-400 text-sm mt-2">Redirecting to dashboard...</p>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Hidden canvas for capture */}
            <canvas ref={canvasRef} className="hidden" />
        </div>
    )
}
