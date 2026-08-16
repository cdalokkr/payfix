"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { motion, AnimatePresence } from "framer-motion"
import { trpc } from "@/lib/trpc/client"
import { FaceApiBrowserService } from "@/lib/services/faceapi-browser.service"
import { FaceVerificationService } from "@/lib/services/face-verification.service"
import { BiometricCameraModal } from "@/components/biometrics/BiometricCameraModal"


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
    preWarmedStream?: MediaStream | null
    onSuccess?: () => void
}

export function ProfilePhotoCapture({ profileId, profileData, preWarmedStream, onSuccess }: ProfilePhotoCaptureProps) {
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

    const [status, setStatus] = useState<'idle' | 'streaming' | 'captured' | 'uploading' | 'success' | 'submitted' | 'error'>('idle')

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
                    facingMode: { exact: 'user' },
                    width: { ideal: 480 },
                    height: { ideal: 640 },
                    aspectRatio: { ideal: 0.75 }
                },
                audio: false,
            } : {
                video: { facingMode: { exact: 'user' } },
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

    // Auto-capture triggered on verified in-mask eye blink
    const handleAutoCapture = useCallback((dataUrl: string) => {
        setCapturedImage(dataUrl)
        setStatus('captured')
        stopCamera()
        toast.success('Blink detected! Photo captured 📸')
    }, [stopCamera])

    // Capture photo matching live stream orientation 100% (Full HD uncompressed)
    const capturePhoto = useCallback(async () => {
        if (!videoRef.current || !canvasRef.current || status !== 'streaming') return

        const video = videoRef.current
        const canvas = canvasRef.current
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        // 1. Capture exact Full HD live frame matching camera viewport aspect ratio (720x960 / 1080x1440)
        const vw = video.videoWidth || 720
        const vh = video.videoHeight || 960
        canvas.width = vw
        canvas.height = vh

        ctx.save()
        ctx.translate(vw, 0)
        ctx.scale(-1, 1) // Mirror matching video stream
        ctx.drawImage(video, 0, 0, vw, vh)
        ctx.restore()

        const imageDataUrl = canvas.toDataURL('image/jpeg', 0.94)
        setCapturedImage(imageDataUrl)
        setStatus('captured')
        stopCamera()
    }, [stopCamera, status])



    // Retake photo
    const handleRetake = useCallback(() => {
        startCamera()
    }, [startCamera])

    // Upload photo via server API (crops to 512x512 HD face avatar ~45KB before saving)
    const handleUpload = useCallback(async () => {
        if (!capturedImage) return

        setDebugLogs([]) // Clear previous logs
        setIsUploading(true)
        setStatus('uploading')

        try {
            addLog('Starting 512x512 HD face crop & upload...')

            // 1. Convert captured photo to 512x512 HD upright face crop (+18% natural margin)
            let uploadDataUrl = capturedImage;
            let preExtracted512: number[] | null = null;

            try {
                const extracted = await FaceVerificationService.extractAligned512dDescriptor(capturedImage);
                if (extracted?.hdAvatarDataUrl || extracted?.cropDataUrl) {
                    uploadDataUrl = extracted.hdAvatarDataUrl || extracted.cropDataUrl;
                    if (extracted.embedding && extracted.embedding.length === 512) {
                        preExtracted512 = extracted.embedding;
                    }
                    addLog('✅ Face cropped to 512x512 HD upright avatar (+18% margin)');
                }
            } catch (cropErr) {
                console.warn('[ProfileUpload] Crop fallback to full image:', cropErr);
            }

            // 2. Convert data URL to blob (mobile compatible ~20KB)
            const base64Data = uploadDataUrl.split(',')[1]
            const byteCharacters = atob(base64Data)
            const byteNumbers = new Array(byteCharacters.length)
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i)
            }
            const byteArray = new Uint8Array(byteNumbers)
            const blob = new Blob([byteArray], { type: 'image/jpeg' })
            addLog(`Avatar Size: ${Math.round(blob.size / 1024)}KB`)

            // 3. Send to server API route (uses service role, bypasses RLS)
            addLog('Sending to server...')
            const formData = new FormData()
            formData.append('file', blob, 'avatar.jpg')
            formData.append('profileId', profileId)
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

            // Handle differently based on first-time upload vs update approval request
            if (isFirstTimeUpload) {
                // First-time: Direct update profile and save active face embedding immediately
                if (preExtracted512 && preExtracted512.length === 512) {
                    try {
                        await saveFaceEmbedding.mutateAsync({ embedding: preExtracted512 })
                        addLog('✅ ArcFace 512-d vector saved to DB for Kiosk & PWA matching.')
                    } catch (faceErr) {
                        addLog('⚠️ Face vector saving warning: ' + String(faceErr))
                    }
                } else if (capturedImage) {
                    try {
                        addLog('Extracting 512-d ArcFace vector with canonical 20% padded alignment...')
                        const extracted = await FaceVerificationService.extractAligned512dDescriptor(capturedImage)
                        if (extracted && extracted.embedding && extracted.embedding.length === 512) {
                            await saveFaceEmbedding.mutateAsync({ embedding: extracted.embedding })
                            addLog('✅ ArcFace 512-d vector saved to DB for Kiosk & PWA matching.')
                        }
                    } catch (faceErr) {
                        addLog('⚠️ Face vector extraction warning: ' + String(faceErr))
                    }
                }

                setStatus('success')
                toast.success('Profile photo updated successfully!')
            } else {
                // Subsequent update: Create pending request WITHOUT touching active profile photo or vector!
                addLog('Submitting for admin approval (vector deferred until approval)...')
                await createPhotoRequest.mutateAsync({
                    pendingPhotoUrl: result.path,
                    pendingFaceEmbedding: (preExtracted512 && preExtracted512.length === 512) ? preExtracted512 : undefined
                })
                setStatus('submitted')
                toast.success('Photo submitted for admin approval!')
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
    }, [capturedImage, profileId, addLog, isFirstTimeUpload, createPhotoRequest, saveFaceEmbedding])


    // Handle back button
    const handleBack = useCallback(() => {
        stopCamera()
        if (onSuccess) {
            onSuccess()
        } else {
            router.back()
        }
    }, [stopCamera, router, onSuccess])


    const [sessionTimeout, setSessionTimeout] = useState<number>(30)

    // 30-Second Security Session Timeout
    useEffect(() => {
        if (status === 'streaming' && !capturedImage) {
            setSessionTimeout(30)
            const interval = setInterval(() => {
                setSessionTimeout(prev => {
                    if (prev <= 1) {
                        clearInterval(interval)
                        toast.error("Camera session expired (30s limit). Please re-open camera.")
                        stopCamera()
                        handleBack()
                        return 0
                    }
                    return prev - 1
                })
            }, 1000)
            return () => clearInterval(interval)
        }
    }, [status, capturedImage, stopCamera, handleBack])


    return (
        <BiometricCameraModal
            isOpen={!hasPendingRequest}
            onClose={handleBack}
            title="Profile Photo Setup"
            icon={<IconUser className="w-5 h-5 text-sky-400" />}
            videoRefOut={videoRef}
            warmedStream={preWarmedStream}
            onStreamReady={() => setStatus('streaming')}
            statusText={status === 'captured' ? 'Photo captured! Review below' : undefined}
            timerSeconds={!capturedImage && status !== 'captured' ? sessionTimeout : undefined}
            enableAutoBlinkCapture={!capturedImage && status !== 'uploading' && status !== 'submitted'}
            onAutoCapture={handleAutoCapture}
            footerSlot={


                <div className="space-y-4">
                    {/* Employee Profile Card */}
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-3.5 backdrop-blur-lg">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-sky-500/30 to-sky-500/10 border-2 border-sky-500/30 flex items-center justify-center overflow-hidden shrink-0">
                                {profileData.avatarUrl ? (
                                    <img src={profileData.avatarUrl} alt="Current" className="w-full h-full object-cover" />
                                ) : (
                                    <IconUser className="w-5 h-5 text-sky-400" />
                                )}
                            </div>
                            <div className="flex-1 min-w-0 space-y-0.5">
                                <p className="text-white font-bold text-sm truncate">{profileData.fullName}</p>
                                <p className="text-slate-400 text-xs truncate">{profileData.email}</p>
                            </div>
                        </div>
                    </div>

                    {status === 'streaming' && (
                        <Button
                            onClick={capturePhoto}
                            size="lg"
                            className="w-full h-14 rounded-2xl bg-white text-slate-950 font-black text-base hover:bg-slate-100 shadow-lg transition-all active:scale-95 cursor-pointer"
                        >
                            <IconCamera className="w-5 h-5 mr-2" />
                            CAPTURE NOW
                        </Button>
                    )}

                    {status === 'captured' && !isUploading && (
                        <div className="grid grid-cols-2 gap-3">
                            <Button
                                onClick={handleRetake}
                                className="h-12 rounded-2xl border border-white/20 bg-slate-800 hover:bg-slate-700 text-white font-extrabold text-sm shadow-md"
                            >
                                <IconRefresh className="w-4 h-4 mr-2 text-sky-400" />
                                Retake
                            </Button>
                            <Button
                                onClick={handleUpload}
                                className="h-12 rounded-2xl bg-sky-500 hover:bg-sky-400 text-white font-black text-sm shadow-lg shadow-sky-500/25"
                            >
                                <IconCheck className="w-4 h-4 mr-2" />
                                Submit
                            </Button>
                        </div>
                    )}

                    {(status === 'submitted' || status === 'success') && (
                        <div className="space-y-3 animate-in fade-in zoom-in-95 duration-200">
                            <div className="p-4 bg-emerald-500/10 border border-emerald-500/25 rounded-2xl text-center space-y-1.5 backdrop-blur-md">
                                <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-400 mx-auto flex items-center justify-center border border-emerald-500/30">
                                    <IconCheck className="w-6 h-6 text-emerald-400" />
                                </div>
                                <p className="text-sm font-bold text-emerald-200">
                                    Photo Submitted Successfully
                                </p>
                                <p className="text-xs text-slate-300 leading-snug">
                                    Your profile photo is submitted for admin review and approval.
                                </p>
                            </div>

                            <Button
                                onClick={handleBack}
                                className="w-full h-13 rounded-2xl bg-sky-500 hover:bg-sky-400 text-white font-black text-base shadow-lg shadow-sky-500/25 active:scale-95 transition-all cursor-pointer"
                            >
                                OK
                            </Button>
                        </div>
                    )}
                </div>
            }

        >


            {/* Captured Selfie Photo Preview Overlay (Stays 100% continuous without black screen) */}

            {capturedImage && status !== 'streaming' && status !== 'idle' && (
                <div className="absolute inset-0 z-25 bg-slate-950 flex items-center justify-center overflow-hidden">
                    <img
                        src={capturedImage}
                        alt="Captured Selfie Preview"
                        className="w-full h-full object-cover"
                    />

                    {/* Uploading & Vector Extraction Spinner Overlay */}
                    {status === 'uploading' && (
                        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-slate-950/65 backdrop-blur-md p-6 text-center text-white">
                            <div className="p-6 bg-slate-900/90 border border-white/15 rounded-3xl space-y-3 shadow-2xl flex flex-col items-center max-w-xs animate-in zoom-in-95">
                                <IconRefresh className="w-10 h-10 text-sky-400 animate-spin" />
                                <p className="text-sm font-bold text-white">Submitting Profile Photo...</p>
                                <p className="text-xs text-slate-300">Extracting 160×160 face vector</p>
                            </div>
                        </div>
                    )}
                </div>
            )}




            {hasPendingRequest && (
                <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-slate-950 p-6 text-center text-white">
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
            )}
            {/* Hidden canvas for capture */}
            <canvas ref={canvasRef} className="hidden" />
        </BiometricCameraModal>
    )
}




