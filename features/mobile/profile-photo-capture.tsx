"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { motion, AnimatePresence } from "framer-motion"
import { trpc } from "@/lib/trpc/client"
import { BIOMETRIC_CAPTURE_PIPELINE_VERSION, captureNaturalBiometricFrame } from "@/lib/face-pipeline"
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

interface CaptureDiagnostics {
    cameraResolution: string
    outputResolution: string
    outputMime: string
    outputBytes: number
    cropMode: string
    serverStatus?: string
    serverVerification?: {
        faceCount: number
        embeddingDimensions: number
        livenessPassed: boolean
        backend: string
        storedOriginalPortrait: boolean
    }
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
    const createPhotoRequest = trpc.profile.createPhotoUpdateRequest.useMutation()

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
    const [captureDiagnostics, setCaptureDiagnostics] = useState<CaptureDiagnostics | null>(null)
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
    const streamRef = useRef<MediaStream | null>(null)

    const recordCaptureDiagnostics = useCallback((dataUrl: string, cropMode: string) => {
        const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/)
        const cameraResolution = videoRef.current?.videoWidth && videoRef.current?.videoHeight
            ? `${videoRef.current.videoWidth} × ${videoRef.current.videoHeight}`
            : 'Unavailable'
        const outputBytes = match ? Math.floor((match[2].length * 3) / 4) : 0
        const image = new Image()
        image.onload = () => setCaptureDiagnostics({
            cameraResolution,
            outputResolution: `${image.naturalWidth} × ${image.naturalHeight}`,
            outputMime: match?.[1] || 'Unknown',
            outputBytes,
            cropMode,
        })
        image.src = dataUrl
    }, [])

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
        recordCaptureDiagnostics(dataUrl, 'Natural portrait auto-capture — server canonicalization pending')
        setCapturedImage(dataUrl)
        setStatus('captured')
        stopCamera()
        toast.success('Blink detected! Photo captured 📸')
    }, [recordCaptureDiagnostics, stopCamera])

    // Capture a complete portrait frame. The server owns face crops and alignment.
    const capturePhoto = useCallback(() => {
        if (!videoRef.current || status !== 'streaming') return
        const capture = captureNaturalBiometricFrame(videoRef.current)
        if (!capture) { toast.error('Camera frame is not ready. Please try again.'); return }
        recordCaptureDiagnostics(capture.dataUrl, 'Natural portrait capture — server canonicalization pending')
        setCapturedImage(capture.dataUrl)
        setStatus('captured')
        stopCamera()
    }, [recordCaptureDiagnostics, stopCamera, status])

    // Retake photo
    const handleRetake = useCallback(() => {
        startCamera()
    }, [startCamera])

    // Upload the natural portrait; server validation and canonicalization are authoritative.
    const handleUpload = useCallback(async () => {
        if (!capturedImage) return

        setDebugLogs([]) // Clear previous logs
        setIsUploading(true)
        setStatus('uploading')

        try {
            // Do not crop or trust browser biometrics: the server validates and aligns this natural frame.
            const uploadDataUrl = capturedImage
            const dataUrlMatch = uploadDataUrl.match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/)
            if (!dataUrlMatch) throw new Error('Captured image format is invalid. Please retake the selfie.')

            const mimeType = dataUrlMatch[1]
            const byteCharacters = atob(dataUrlMatch[2])
            const byteNumbers = new Array(byteCharacters.length)
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i)
            }
            const byteArray = new Uint8Array(byteNumbers)
            const blob = new Blob([byteArray], { type: mimeType })
            addLog(`Sending natural portrait to the server (${Math.round(blob.size / 1024)}KB)`)

            // Send to server API route (uses service role, bypasses RLS)
            addLog('Sending to server...')
            const formData = new FormData()
            formData.append('file', blob, 'avatar.jpg')
            formData.append('profileId', profileId)
            formData.append('biometricPipelineVersion', BIOMETRIC_CAPTURE_PIPELINE_VERSION)
            const response = await fetch('/api/upload-avatar', {
                method: 'POST',
                body: formData,
            })

            const result = await response.json()

            if (!response.ok) {
                const serverStatus = [result.code, result.error].filter(Boolean).join(' — ') || 'Unknown server rejection'
                setCaptureDiagnostics(previous => previous ? { ...previous, serverStatus } : previous)
                addLog(`SERVER ERROR: ${serverStatus}`)
                if (result.diagnostics) addLog(`Service diagnostics: ${JSON.stringify(result.diagnostics)}`)
                throw new Error(result.error || 'Upload failed')
            }

            setCaptureDiagnostics(previous => previous ? { ...previous, serverStatus: 'Accepted: one face, server liveness passed, 512-d template pending approval', serverVerification: result.verification } : previous)
            addLog('Upload complete!')
            addLog(`URL: ${result.path?.slice(0, 40)}...`)

            // Every enrollment remains inactive until a reviewer approves a server-generated template.
            addLog('Submitting for admin approval...')
            await createPhotoRequest.mutateAsync({ pendingPhotoUrl: result.path })
            setStatus('submitted')
            toast.success('Photo submitted for admin approval!')

        } catch (error: any) {
            const errMsg = error?.message || 'Unknown error'
            addLog(`ERROR: ${errMsg}`)
            setStatus('error')
            setErrorMessage(errMsg)
            toast.error('Upload failed: ' + errMsg)
        } finally {
            setIsUploading(false)
        }
    }, [capturedImage, profileId, addLog, createPhotoRequest])


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
            capturedPreviewUrl={capturedImage}
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


                    {captureDiagnostics && (
                        <details open={status === 'error'} className="rounded-xl border border-slate-700 bg-slate-900/70 px-3 py-2.5 text-left">
                            <summary className="cursor-pointer text-xs font-bold text-sky-300">Biometric capture details</summary>
                            <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[10px] font-mono text-slate-300">
                                <dt className="text-slate-500">Camera</dt><dd>{captureDiagnostics.cameraResolution}</dd>
                                <dt className="text-slate-500">Output</dt><dd>{captureDiagnostics.outputResolution}</dd>
                                <dt className="text-slate-500">Format</dt><dd>{captureDiagnostics.outputMime}</dd>
                                <dt className="text-slate-500">Payload</dt><dd>{Math.round(captureDiagnostics.outputBytes / 1024)} KB</dd>
                                <dt className="text-slate-500">Crop</dt><dd className="col-span-1">{captureDiagnostics.cropMode}</dd>
                            </dl>
                            {captureDiagnostics.serverStatus && <p className="mt-2 break-words text-[10px] text-amber-200">Server: {captureDiagnostics.serverStatus}</p>}
                            {captureDiagnostics.serverVerification && (
                                <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 border-t border-slate-700 pt-2 text-[10px] font-mono text-slate-300">
                                    <dt className="text-slate-500">Server faces</dt><dd>{captureDiagnostics.serverVerification.faceCount}</dd>
                                    <dt className="text-slate-500">Template</dt><dd>{captureDiagnostics.serverVerification.embeddingDimensions}-d</dd>
                                    <dt className="text-slate-500">Liveness</dt><dd>{captureDiagnostics.serverVerification.livenessPassed ? 'Passed' : 'Failed'}</dd>
                                    <dt className="text-slate-500">Stored image</dt><dd>{captureDiagnostics.serverVerification.storedOriginalPortrait ? 'Original portrait' : 'Derivative'}</dd>
                                    <dt className="text-slate-500">Backend</dt><dd className="break-all">{captureDiagnostics.serverVerification.backend}</dd>
                                </dl>
                            )}
                            {debugLogs.length > 0 && <pre className="mt-2 max-h-24 overflow-auto whitespace-pre-wrap border-t border-slate-700 pt-2 text-[9px] leading-4 text-slate-400">{debugLogs.join('\n')}</pre>}
                        </details>
                    )}

                    {status !== 'captured' && status !== 'submitted' && status !== 'success' && status !== 'uploading' && (
                        <Button
                            onClick={capturePhoto}
                            disabled={status !== 'streaming'}
                            size="lg"
                            className={`w-full h-14 rounded-2xl font-black text-base transition-all active:scale-95 shadow-lg ${
                                status === 'streaming'
                                    ? 'bg-white text-slate-950 hover:bg-slate-100 cursor-pointer shadow-white/10'
                                    : 'bg-slate-800 text-slate-400 border border-slate-700 cursor-not-allowed opacity-60'
                            }`}
                        >
                            {status === 'streaming' ? (
                                <>
                                    <IconCamera className="w-5 h-5 mr-2" />
                                    CAPTURE NOW
                                </>
                            ) : (
                                <>
                                    <IconLoader2 className="w-5 h-5 mr-2 animate-spin text-sky-400" />
                                    STARTING CAMERA...
                                </>
                            )}
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
                                <p className="text-xs text-slate-300">Generating 512-d ArcFace vector</p>
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
        </BiometricCameraModal>
    )
}




