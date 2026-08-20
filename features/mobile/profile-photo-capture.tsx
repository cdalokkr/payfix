"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { motion, AnimatePresence } from "framer-motion"
import { trpc } from "@/lib/trpc/client"
import {
    Camera as IconCamera,
    Loader2 as IconLoader2,
    RefreshCw as IconRefresh,
    Check as IconCheck,
    X as IconX,
    ArrowLeft as IconArrowLeft,
    User as IconUser,
    Mail as IconMail,
    IdCard as IconId,
    Clock as IconClock,
    Phone as IconPhone,
} from "lucide-react"
import { BIOMETRIC_CAMERA_CONSTRAINTS, captureBiometricFrame } from "@/lib/biometrics/camera"

interface ProfileData {
    fullName: string
    email: string
    role: string
    avatarUrl: string | null
    avatarStatus?: string | null  // 'default' or 'custom'
    employeeId?: string
    mobileNo?: string | null
    designation?: string | null
}

interface ProfilePhotoCaptureProps {
    profileId: string
    profileData: ProfileData
    onSuccess?: () => void
}

export function ProfilePhotoCapture({ profileId, profileData, onSuccess }: ProfilePhotoCaptureProps) {
    const router = useRouter()
    const createPhotoRequest = trpc.profile.createPhotoUpdateRequest.useMutation()

    // Check if there's a pending photo request
    const { data: pendingRequest, isLoading: pendingLoading } = trpc.profile.getMyPendingPhotoRequest.useQuery()

    // Check if this is first-time upload or update request
    const isFirstTimeUpload = profileData.avatarStatus !== 'custom'
    const hasPendingRequest = !!pendingRequest

    const [status, setStatus] = useState<'idle' | 'streaming' | 'captured' | 'uploading' | 'success' | 'error'>('idle')
    const [errorMessage, setErrorMessage] = useState<string>('')
    const [capturedImage, setCapturedImage] = useState<string | null>(null)
    const [isUploading, setIsUploading] = useState(false)
    const [debugLogs, setDebugLogs] = useState<string[]>([])
    const statusRef = useRef(status)

    // Debug logger
    const addLog = useCallback((msg: string) => {
        setDebugLogs(prev => [...prev.slice(-10), `${new Date().toLocaleTimeString()}: ${msg}`])
    }, [])

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
            // Use the shared camera contract. Capture validates the actual granted stream.
            const gumPromise = navigator.mediaDevices.getUserMedia({
                video: BIOMETRIC_CAMERA_CONSTRAINTS,
                audio: false,
            })
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

    // Keep the full source frame; the server creates the padded avatar crop after validation.
    const capturePhoto = useCallback(() => {
        if (!videoRef.current || !canvasRef.current || status !== 'streaming') return
        try {
            const frame = captureBiometricFrame(videoRef.current, canvasRef.current)
            setCapturedImage(frame.dataUrl)
            setStatus('captured')
            stopCamera()
        } catch (error) {
            setStatus('error')
            setErrorMessage(error instanceof Error ? error.message : 'Could not capture a profile image.')
        }
    }, [stopCamera, status])

    // Retake photo
    const handleRetake = useCallback(() => {
        startCamera()
    }, [startCamera])

    // Upload photo via server API (bypasses client-side RLS)
    const handleUpload = useCallback(async () => {
        if (!capturedImage) return

        setDebugLogs([]) // Clear previous logs
        setIsUploading(true)
        setStatus('uploading')

        try {
            addLog('Starting upload...')

            // Convert data URL to blob directly (mobile compatible)
            const base64Data = capturedImage.split(',')[1]
            const byteCharacters = atob(base64Data)
            const byteNumbers = new Array(byteCharacters.length)
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i)
            }
            const byteArray = new Uint8Array(byteNumbers)
            const blob = new Blob([byteArray], { type: 'image/jpeg' })
            addLog(`Blob: ${Math.round(blob.size / 1024)}KB`)

            // Send to server API route (uses service role, bypasses RLS)
            addLog('Sending to server...')
            const formData = new FormData()
            formData.append('file', blob, 'avatar.jpg')
            formData.append('profileId', profileId)
            const response = await fetch('/api/upload-avatar', {
                method: 'POST',
                body: formData,
            })

            const result = await response.json()

            if (!response.ok) {
                addLog(`SERVER ERROR: ${result.error}`)
                throw new Error(result.error || 'Upload failed')
            }

            addLog('Upload complete!')
            addLog(`URL: ${result.path?.slice(0, 40)}...`)

            // An avatar becomes active only through the existing admin approval workflow.
            addLog('Creating approval request...')
            await createPhotoRequest.mutateAsync({ pendingPhotoUrl: result.path })
            setStatus('success')
            toast.success('Photo submitted for admin approval!')
            setTimeout(() => {
                onSuccess?.()
                router.push('/mobile')
                router.refresh()
            }, 1500)
        } catch (error: any) {
            const errMsg = error?.message || 'Unknown error'
            addLog(`ERROR: ${errMsg}`)
            setStatus('error')
            setErrorMessage(errMsg)
            toast.error('Upload failed: ' + errMsg)
        } finally {
            setIsUploading(false)
        }
    }, [capturedImage, profileId, router, onSuccess, addLog, createPhotoRequest])

    // Handle back button
    const handleBack = useCallback(() => {
        stopCamera()
        router.back()
    }, [stopCamera, router])

    useEffect(() => {
        // Don't start camera if there's a pending request
        if (hasPendingRequest) return
        startCamera()
        return () => stopCamera()
    }, [startCamera, stopCamera, hasPendingRequest])

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
                                    {hasPendingRequest ? (
                                        <motion.div
                                            initial={{ opacity: 0, scale: 0.9 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            className="text-center p-8 bg-amber-500/10 backdrop-blur-md rounded-3xl border border-amber-500/20 mx-6"
                                        >
                                            <IconClock className="w-12 h-12 text-amber-500 mx-auto mb-4" />
                                            <p className="text-base font-bold text-amber-200 mb-2">Photo Update Pending</p>
                                            <p className="text-sm text-amber-100/70">Your photo update request is awaiting admin approval.</p>
                                            <Button onClick={handleBack} variant="outline" className="mt-6 border-amber-500/30 text-amber-100 hover:bg-amber-500/20 rounded-xl">
                                                Go Back
                                            </Button>
                                        </motion.div>
                                    ) : status === 'error' ? (
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
                        <div className="flex items-start gap-4">
                            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-primary/30 to-primary/10 border-2 border-primary/30 flex items-center justify-center overflow-hidden shrink-0">
                                {profileData.avatarUrl ? (
                                    <img src={profileData.avatarUrl} alt="Current" className="w-full h-full object-cover" />
                                ) : (
                                    <IconUser className="w-7 h-7 text-primary" />
                                )}
                            </div>
                            <div className="flex-1 min-w-0 space-y-1.5">
                                <p className="text-white font-bold text-base truncate">{profileData.fullName}</p>
                                <div className="flex items-center gap-2">
                                    <IconMail className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                                    <p className="text-slate-400 text-xs truncate">{profileData.email}</p>
                                </div>
                                {profileData.mobileNo && (
                                    <div className="flex items-center gap-2">
                                        <IconPhone className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                                        <p className="text-slate-400 text-xs">{profileData.mobileNo}</p>
                                    </div>
                                )}
                                {/* Designation and Role Badges - Separate Rows */}
                                <div className="flex flex-col gap-1.5 pt-1.5">
                                    {profileData.designation && (
                                        <span className="inline-flex items-center px-3 py-1.5 rounded-lg bg-slate-700/60 text-slate-200 text-xs font-bold border border-white/10 w-fit shadow-lg backdrop-blur-md">
                                            {profileData.designation}
                                        </span>
                                    )}
                                    <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-primary/20 text-primary text-[10px] font-bold uppercase tracking-wider border border-primary/30 w-fit">
                                        {profileData.role}
                                    </span>
                                </div>
                            </div>
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

            {/* Bottom Slide-up Overlay for Progress/Success/Error */}
            <AnimatePresence>
                {(status === 'uploading' || status === 'success' || status === 'error') && (
                    <motion.div
                        initial={{ y: '100%' }}
                        animate={{ y: 0 }}
                        exit={{ y: '100%' }}
                        transition={{ type: 'spring', stiffness: 400, damping: 40 }}
                        className="fixed bottom-0 left-0 right-0 z-[70] p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]"
                    >
                        <div className="max-w-md mx-auto bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-3xl overflow-hidden shadow-2xl">
                            {status === 'uploading' && (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className="p-5"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="relative w-14 h-14 flex-shrink-0">
                                            <motion.div
                                                animate={{ rotate: 360 }}
                                                transition={{ repeat: Infinity, duration: 1.5, ease: 'linear' }}
                                                className="absolute inset-0 rounded-full border-3 border-t-primary border-r-primary/30 border-b-primary/10 border-l-primary/30"
                                            />
                                            <div className="absolute inset-0 flex items-center justify-center">
                                                <IconCamera className="w-6 h-6 text-primary" />
                                            </div>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-white font-bold text-base">Uploading Photo...</p>
                                            <div className="mt-2 space-y-0.5 max-h-16 overflow-y-auto">
                                                {debugLogs.slice(-3).map((log, i) => (
                                                    <p key={i} className={`text-xs truncate ${log.includes('ERROR') ? 'text-red-400' : 'text-slate-400'}`}>
                                                        {log}
                                                    </p>
                                                ))}
                                                {debugLogs.length === 0 && (
                                                    <p className="text-slate-500 text-xs">Initializing...</p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    {/* Progress bar */}
                                    <motion.div
                                        initial={{ scaleX: 0 }}
                                        animate={{ scaleX: 1 }}
                                        transition={{ duration: 3, ease: 'easeOut' }}
                                        className="mt-4 h-1 bg-gradient-to-r from-primary via-primary/80 to-primary rounded-full origin-left"
                                    />
                                </motion.div>
                            )}

                            {status === 'success' && (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className="p-5"
                                >
                                    <div className="flex items-center gap-4">
                                        <motion.div
                                            initial={{ scale: 0 }}
                                            animate={{ scale: 1 }}
                                            transition={{ type: 'spring', stiffness: 300, damping: 15 }}
                                            className="w-14 h-14 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0"
                                        >
                                            <motion.div
                                                initial={{ scale: 0 }}
                                                animate={{ scale: 1 }}
                                                transition={{ type: 'spring', delay: 0.15, stiffness: 400, damping: 10 }}
                                            >
                                                <IconCheck className="w-7 h-7 text-green-500" />
                                            </motion.div>
                                        </motion.div>
                                        <div className="flex-1">
                                            <motion.p
                                                initial={{ opacity: 0, x: -10 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                transition={{ delay: 0.1 }}
                                                className="text-white font-bold text-base"
                                            >
                                                'Photo Submitted for Approval!'
                                            </motion.p>
                                            <motion.p
                                                initial={{ opacity: 0, x: -10 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                transition={{ delay: 0.2 }}
                                                className="text-slate-400 text-sm mt-0.5"
                                            >
                                                'An admin will review your request soon.'
                                            </motion.p>
                                        </div>
                                        <motion.div
                                            initial={{ scale: 0, rotate: -180 }}
                                            animate={{ scale: 1, rotate: 0 }}
                                            transition={{ type: 'spring', delay: 0.25, stiffness: 300, damping: 15 }}
                                            className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center"
                                        >
                                            <IconCheck className="w-5 h-5 text-white" />
                                        </motion.div>
                                    </div>
                                </motion.div>
                            )}

                            {status === 'error' && (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className="p-5"
                                >
                                    <div className="flex items-center gap-4">
                                        <motion.div
                                            initial={{ scale: 0 }}
                                            animate={{ scale: 1 }}
                                            transition={{ type: 'spring', stiffness: 300, damping: 15 }}
                                            className="w-14 h-14 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0"
                                        >
                                            <IconX className="w-7 h-7 text-red-500" />
                                        </motion.div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-white font-bold text-base">Upload Failed</p>
                                            <p className="text-red-400 text-sm mt-0.5 truncate">
                                                {errorMessage || 'Something went wrong'}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="mt-4 flex gap-3">
                                        <Button
                                            onClick={handleRetake}
                                            variant="outline"
                                            className="flex-1 h-11 rounded-xl border-white/10 bg-white/5 text-white hover:bg-white/10"
                                        >
                                            <IconRefresh className="w-4 h-4 mr-2" />
                                            Retake
                                        </Button>
                                        <Button
                                            onClick={handleUpload}
                                            className="flex-1 h-11 rounded-xl bg-primary hover:bg-primary/90"
                                        >
                                            Try Again
                                        </Button>
                                    </div>
                                </motion.div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Hidden canvas for capture */}
            <canvas ref={canvasRef} className="hidden" />
        </div>
    )
}
