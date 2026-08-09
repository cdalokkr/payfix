"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { motion, AnimatePresence } from "framer-motion"
import { trpc } from "@/lib/trpc/client"
import { FaceApiBrowserService } from "@/lib/services/faceapi-browser.service"
import { BiometricCamera } from "@/components/biometrics/BiometricCamera"

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
import { createClient } from "@/lib/supabase/client"

interface ProfileData {
    fullName: string | null
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
    const supabase = createClient()
    const updateProfilePicture = trpc.profile.updateProfilePicture.useMutation()
    const createPhotoRequest = trpc.profile.createPhotoUpdateRequest.useMutation()
    const saveFaceEmbedding = trpc.profile.saveFaceEmbedding.useMutation()

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
            // 480x640 (3:4 portrait) for consistent face vector alignment across enrollment & kiosk
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

        // Higher resolution for clearer photos (720x720 for quality)
        canvas.width = 720
        canvas.height = 720

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
        // Use 0.85 quality for good compression with minimal visual difference
        const imageDataUrl = canvas.toDataURL('image/jpeg', 0.85)
        setCapturedImage(imageDataUrl)
        setStatus('captured')
        stopCamera()
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
            // Use different path for pending photos
            if (!isFirstTimeUpload) {
                formData.append('isPending', 'true')
            }

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

            // Handle differently based on first-time vs update
            if (isFirstTimeUpload) {
                // First-time: Direct update (current behavior)
                setStatus('success')
                toast.success('Profile photo updated successfully!')

                // Background: Extract and save face embedding for kiosk & PWA verification
                if (capturedImage) {
                    try {
                        addLog('Extracting face vector for attendance verification...')
                        await FaceApiBrowserService.loadModels()
                        const descriptor = await FaceApiBrowserService.extractDescriptorFromDataUrl(capturedImage)
                        if (descriptor && descriptor.length === 128) {
                            const embedding = FaceApiBrowserService.descriptorToArray(descriptor)
                            await saveFaceEmbedding.mutateAsync({ embedding })
                            addLog('✅ Face vector saved for attendance matching.')
                        } else {
                            addLog('⚠️ No face detected in photo — enrollment skipped.')
                        }
                    } catch (faceErr) {
                        addLog('⚠️ Face enrollment failed (non-critical): ' + String(faceErr))
                    }
                }

                setTimeout(() => {
                    if (onSuccess) {
                        onSuccess()
                    } else {
                        router.push('/mobile')
                        router.refresh()
                    }
                }, 1500)

            } else {
                // Subsequent update: Create pending request
                addLog('Creating approval request...')
                await createPhotoRequest.mutateAsync({
                    pendingPhotoUrl: result.path
                })

                setStatus('success')
                toast.success('Photo submitted for admin approval!')

                setTimeout(() => {
                    if (onSuccess) {
                        onSuccess()
                    } else {
                        router.push('/mobile')
                        router.refresh()
                    }
                }, 1500)
            }
        } catch (error: any) {
            const errMsg = error?.message || 'Unknown error'
            addLog(`ERROR: ${errMsg}`)
            setStatus('error')
            setErrorMessage(errMsg)
            toast.error('Upload failed: ' + errMsg)
        } finally {
            setIsUploading(false)
        }
    }, [capturedImage, profileId, router, onSuccess, addLog, isFirstTimeUpload, createPhotoRequest])

    // Handle back button
    const handleBack = useCallback(() => {
        stopCamera()
        if (onSuccess) {
            onSuccess()
        } else {
            router.back()
        }
    }, [stopCamera, router, onSuccess])


    useEffect(() => {
        // Don't start camera if there's a pending request
        if (hasPendingRequest) return
        startCamera()
        return () => stopCamera()
    }, [startCamera, stopCamera, hasPendingRequest])

    return (
        <div className="relative w-full h-full min-h-[85vh] bg-slate-950 flex flex-col overflow-hidden rounded-3xl">
            {/* Immersive Camera Section at TOP (Portrait 3:4 Aligned with Kiosk & Daily Attendance) */}
            <div className="relative w-full aspect-[3/4] bg-slate-900 shadow-2xl overflow-hidden shrink-0">


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
                            className="absolute inset-0 bg-slate-950 flex items-center justify-center"
                        >
                            {hasPendingRequest ? (
                                <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-slate-950 p-6 text-center text-white">
                                    <motion.div
                                        initial={{ opacity: 0, scale: 0.9 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        className="p-8 bg-amber-500/10 backdrop-blur-md rounded-3xl border border-amber-500/20 max-w-sm"
                                    >
                                        <IconClock className="w-12 h-12 text-amber-500 mx-auto mb-4" />
                                        <p className="text-base font-bold text-amber-200 mb-2">Photo Update Pending</p>
                                        <p className="text-sm text-amber-100/70">Your photo update request is awaiting admin approval.</p>
                                        <Button onClick={handleBack} variant="outline" className="mt-6 border-amber-500/30 text-amber-100 hover:bg-amber-500/20 rounded-xl">
                                            Go Back
                                        </Button>
                                    </motion.div>
                                </div>
                            ) : (
                                <BiometricCamera
                                    videoRefOut={videoRef}
                                    onStreamReady={() => setStatus('streaming')}
                                    statusText="Position face inside the oval"
                                    className="h-full w-full max-w-none rounded-none border-none"
                                />
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

                    {/* Employee Profile Card (Shows ONLY Name and Email) */}
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-white/5 border border-white/10 rounded-2xl p-4 backdrop-blur-lg"
                    >
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary/30 to-primary/10 border-2 border-primary/30 flex items-center justify-center overflow-hidden shrink-0">
                                {profileData.avatarUrl ? (
                                    <img src={profileData.avatarUrl} alt="Current" className="w-full h-full object-cover" />
                                ) : (
                                    <IconUser className="w-6 h-6 text-primary" />
                                )}
                            </div>
                            <div className="flex-1 min-w-0 space-y-1">
                                <p className="text-white font-bold text-base truncate">{profileData.fullName}</p>
                                <div className="flex items-center gap-2">
                                    <IconMail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                    <p className="text-slate-300 text-xs truncate">{profileData.email}</p>
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
                                                {isFirstTimeUpload ? 'Photo Updated!' : 'Photo Submitted for Approval!'}
                                            </motion.p>
                                            <motion.p
                                                initial={{ opacity: 0, x: -10 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                transition={{ delay: 0.2 }}
                                                className="text-slate-400 text-sm mt-0.5"
                                            >
                                                {isFirstTimeUpload
                                                    ? 'Redirecting to dashboard...'
                                                    : 'An admin will review your request soon.'}
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
