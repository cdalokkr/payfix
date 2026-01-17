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

    const videoRef = useRef<HTMLVideoElement>(null)
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const streamRef = useRef<MediaStream | null>(null)

    // Start camera stream with zoom capability
    const startCamera = useCallback(async () => {
        setStatus('idle')
        setErrorMessage('')
        setCapturedImage(null)

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: 'user',
                    width: { ideal: 720 },
                    height: { ideal: 720 },
                },
                audio: false,
            })

            streamRef.current = stream

            if (videoRef.current) {
                videoRef.current.srcObject = stream
                await videoRef.current.play()
                setStatus('streaming')
            }
        } catch (error: unknown) {
            console.error('Camera error:', error)
            setStatus('error')

            const err = error as DOMException
            if (err.name === 'NotAllowedError') {
                setErrorMessage('Camera permission denied. Please allow camera access.')
            } else if (err.name === 'NotFoundError') {
                setErrorMessage('No camera found on this device.')
            } else {
                setErrorMessage('Unable to access camera.')
            }
        }
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

    // Apply zoom to video stream
    useEffect(() => {
        if (streamRef.current && status === 'streaming') {
            const videoTrack = streamRef.current.getVideoTracks()[0]
            const capabilities = videoTrack.getCapabilities() as any

            if (capabilities.zoom) {
                const settings = {
                    zoom: capabilities.zoom.min + (capabilities.zoom.max - capabilities.zoom.min) * ((zoom - 1) / 2)
                }
                videoTrack.applyConstraints({ advanced: [settings] as any }).catch(() => { })
            }
        }
    }, [zoom, status])

    // Capture photo
    const capturePhoto = useCallback(() => {
        if (!videoRef.current || !canvasRef.current || status === 'captured') return

        const video = videoRef.current
        const canvas = canvasRef.current
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        // Set canvas to square for profile photo
        const size = Math.min(video.videoWidth, video.videoHeight)
        canvas.width = 400
        canvas.height = 400

        // Calculate crop for center square
        const sx = (video.videoWidth - size) / 2
        const sy = (video.videoHeight - size) / 2

        // Draw cropped square video frame
        ctx.drawImage(video, sx, sy, size, size, 0, 0, 400, 400)

        // Get image data URL
        const imageDataUrl = canvas.toDataURL('image/jpeg', 0.9)

        setCapturedImage(imageDataUrl)
        setStatus('captured')
        stopCamera()
    }, [stopCamera, status])

    // Retake photo
    const handleRetake = useCallback(() => {
        setCapturedImage(null)
        setStatus('idle')
        startCamera()
    }, [startCamera])

    // Upload photo
    const handleUpload = useCallback(async () => {
        if (!capturedImage) return

        setIsUploading(true)
        setStatus('uploading')

        try {
            // Convert data URL to blob
            const response = await fetch(capturedImage)
            const blob = await response.blob()

            // Upload to Supabase Storage
            const fileName = `${profileId}-${Date.now()}.jpg`
            const { error: uploadError, data } = await supabase.storage
                .from('avatars')
                .upload(fileName, blob, {
                    contentType: 'image/jpeg',
                    upsert: true,
                })

            if (uploadError) throw uploadError

            // Get public URL
            const { data: { publicUrl } } = supabase.storage
                .from('avatars')
                .getPublicUrl(fileName)

            // Update profile with new avatar and status
            const { error: updateError } = await supabase
                .from('profiles')
                .update({
                    avatar_url: publicUrl,
                    avatar_status: 'custom'
                })
                .eq('id', profileId)

            if (updateError) throw updateError

            setStatus('success')
            toast.success('Profile photo updated!')

            // Navigate back after success
            setTimeout(() => {
                onSuccess?.()
                router.push('/mobile')
                router.refresh()
            }, 1000)
        } catch (error) {
            console.error('Upload error:', error)
            setStatus('error')
            setErrorMessage('Failed to upload photo. Please try again.')
            toast.error('Failed to upload photo')
        } finally {
            setIsUploading(false)
        }
    }, [capturedImage, profileId, supabase, router, onSuccess])

    // Handle back button
    const handleBack = useCallback(() => {
        stopCamera()
        router.back()
    }, [stopCamera, router])

    // Auto-start camera on mount
    useEffect(() => {
        startCamera()
        return () => stopCamera()
    }, [startCamera, stopCamera])

    return (
        <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 text-white">
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleBack}
                    className="text-white hover:bg-white/10"
                >
                    <IconArrowLeft className="w-6 h-6" />
                </Button>
                <h1 className="text-lg font-bold">Update Photo</h1>
                <div className="w-10" /> {/* Spacer */}
            </div>

            {/* Camera View */}
            <div className="flex-1 flex flex-col items-center justify-center px-4 pb-4">
                <div className="relative w-full max-w-[320px] aspect-square rounded-full overflow-hidden border-4 border-white/30 shadow-2xl">
                    {/* Video Preview */}
                    <AnimatePresence mode="wait">
                        {status === 'streaming' && (
                            <motion.video
                                key="video"
                                ref={videoRef}
                                autoPlay
                                playsInline
                                muted
                                className="w-full h-full object-cover scale-x-[-1]"
                                style={{ transform: `scale(${zoom}) scaleX(-1)` }}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                            />
                        )}

                        {status === 'captured' && capturedImage && (
                            <motion.img
                                key="captured"
                                src={capturedImage}
                                alt="Captured"
                                className="w-full h-full object-cover"
                                initial={{ scale: 1.1, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ opacity: 0 }}
                            />
                        )}

                        {status === 'success' && (
                            <motion.div
                                key="success"
                                className="absolute inset-0 bg-green-500/90 flex items-center justify-center"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                            >
                                <IconCheck className="w-20 h-20 text-white" />
                            </motion.div>
                        )}

                        {(status === 'idle' || status === 'error') && (
                            <motion.div
                                key="placeholder"
                                className="w-full h-full bg-slate-700 flex items-center justify-center"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                            >
                                {status === 'error' ? (
                                    <div className="text-center p-4">
                                        <IconX className="w-12 h-12 text-red-400 mx-auto mb-2" />
                                        <p className="text-sm text-red-300">{errorMessage}</p>
                                    </div>
                                ) : (
                                    <IconLoader2 className="w-12 h-12 text-white/50 animate-spin" />
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Face Guide Overlay */}
                    {status === 'streaming' && (
                        <div className="absolute inset-0 pointer-events-none">
                            <div className="absolute inset-8 rounded-full border-2 border-dashed border-white/40" />
                        </div>
                    )}
                </div>

                {/* Zoom Control */}
                {status === 'streaming' && (
                    <motion.div
                        className="w-full max-w-[280px] mt-6 px-4"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                    >
                        <div className="flex items-center gap-3 text-white/70">
                            <IconZoomIn className="w-5 h-5" />
                            <Slider
                                value={[zoom]}
                                onValueChange={(v) => setZoom(v[0])}
                                min={1}
                                max={3}
                                step={0.1}
                                className="flex-1"
                            />
                            <span className="text-sm font-medium w-10">{zoom.toFixed(1)}x</span>
                        </div>
                    </motion.div>
                )}

                {/* Hidden Canvas */}
                <canvas ref={canvasRef} className="hidden" />
            </div>

            {/* Action Buttons */}
            <div className="p-6 space-y-3">
                {status === 'streaming' && (
                    <Button
                        onClick={capturePhoto}
                        size="lg"
                        className="w-full h-14 rounded-2xl bg-white text-slate-900 font-bold text-lg hover:bg-white/90 shadow-lg"
                    >
                        <IconCamera className="w-6 h-6 mr-2" />
                        Take Photo
                    </Button>
                )}

                {status === 'captured' && !isUploading && (
                    <div className="grid grid-cols-2 gap-3">
                        <Button
                            onClick={handleRetake}
                            variant="outline"
                            size="lg"
                            className="h-14 rounded-2xl border-white/30 text-white bg-white/10 hover:bg-white/20"
                        >
                            <IconRefresh className="w-5 h-5 mr-2" />
                            Retake
                        </Button>
                        <Button
                            onClick={handleUpload}
                            size="lg"
                            className="h-14 rounded-2xl bg-green-500 text-white font-bold hover:bg-green-600"
                        >
                            <IconCheck className="w-5 h-5 mr-2" />
                            Use Photo
                        </Button>
                    </div>
                )}

                {status === 'uploading' && (
                    <Button
                        disabled
                        size="lg"
                        className="w-full h-14 rounded-2xl bg-white/20 text-white"
                    >
                        <IconLoader2 className="w-5 h-5 mr-2 animate-spin" />
                        Uploading...
                    </Button>
                )}

                {status === 'error' && (
                    <Button
                        onClick={startCamera}
                        size="lg"
                        className="w-full h-14 rounded-2xl bg-white text-slate-900 font-bold"
                    >
                        <IconRefresh className="w-5 h-5 mr-2" />
                        Try Again
                    </Button>
                )}
            </div>
        </div>
    )
}
