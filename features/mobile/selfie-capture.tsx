"use client"

import React, { useState, useRef, useCallback, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import {
    IconCamera,
    IconLoader2,
    IconRefresh,
    IconCheck,
    IconX,
    IconPlayerSkipForward,
} from "@tabler/icons-react"
import { format } from "date-fns"

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

    const videoRef = useRef<HTMLVideoElement>(null)
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const streamRef = useRef<MediaStream | null>(null)

    // Start camera stream
    const startCamera = useCallback(async () => {
        setStatus('idle')
        setErrorMessage('')

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: 'user', // Front camera
                    width: { ideal: 640 },
                    height: { ideal: 480 },
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
                setErrorMessage('Camera permission denied. You can skip selfie for testing.')
            } else if (err.name === 'NotFoundError') {
                setErrorMessage('No camera found. You can skip selfie for testing.')
            } else if (err.message?.includes('permissions policy')) {
                setErrorMessage('Camera blocked by ngrok policy. You can skip selfie for testing.')
            } else {
                setErrorMessage('Unable to access camera. You can skip selfie for testing.')
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

    // Capture photo
    const capturePhoto = useCallback(() => {
        if (!videoRef.current || !canvasRef.current) return

        const video = videoRef.current
        const canvas = canvasRef.current
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        // Set canvas size to match video
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight

        // Draw video frame
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

        // Add timestamp overlay
        const now = new Date()
        const timestamp = format(now, "dd MMM yyyy, hh:mm:ss a")

        // Draw timestamp background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)'
        ctx.fillRect(0, canvas.height - 50, canvas.width, 50)

        // Draw timestamp text
        ctx.fillStyle = '#ffffff'
        ctx.font = 'bold 18px Arial'
        ctx.textAlign = 'center'
        ctx.fillText(timestamp, canvas.width / 2, canvas.height - 18)

        // Get image data URL
        const imageDataUrl = canvas.toDataURL('image/jpeg', 0.85)

        setCapturedImage(imageDataUrl)
        setCapturedAt(now)
        setStatus('captured')

        // Stop camera after capture
        stopCamera()
    }, [stopCamera])

    // Skip selfie (for testing when camera is blocked)
    const handleSkipSelfie = useCallback(() => {
        // Create a placeholder image and proceed
        const now = new Date()
        const placeholder = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iIzFlMjkzYiIvPjx0ZXh0IHg9IjEwMCIgeT0iMTAwIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTYiIGZpbGw9IiM5NGE3YjciIHRleHQtYW5jaG9yPSJtaWRkbGUiIGRvbWluYW50LWJhc2VsaW5lPSJtaWRkbGUiPlNraXBwZWQgKFRlc3QpPC90ZXh0Pjwvc3ZnPg=='

        toast.info('Selfie skipped (testing mode)')
        onCaptured({
            imageDataUrl: placeholder,
            capturedAt: now,
        })
    }, [onCaptured])

    // Retake photo
    const retakePhoto = useCallback(() => {
        setCapturedImage(null)
        setCapturedAt(null)
        startCamera()
    }, [startCamera])

    // Proceed with captured photo
    const handleProceed = useCallback(() => {
        if (capturedImage && capturedAt) {
            onCaptured({
                imageDataUrl: capturedImage,
                capturedAt,
            })
        }
    }, [capturedImage, capturedAt, onCaptured])

    // Start camera on mount
    useEffect(() => {
        startCamera()
        return () => {
            stopCamera()
        }
    }, [startCamera, stopCamera])

    return (
        <Card className="w-full max-w-md mx-auto">
            <CardHeader className="text-center">
                <div className={`mx-auto w-12 h-12 rounded-full flex items-center justify-center mb-4 ${status === 'captured' ? 'bg-green-500/10' :
                    status === 'error' ? 'bg-destructive/10' :
                        'bg-primary/10'
                    }`}>
                    {status === 'captured' ? (
                        <IconCheck className="w-6 h-6 text-green-500" />
                    ) : status === 'error' ? (
                        <IconX className="w-6 h-6 text-destructive" />
                    ) : (
                        <IconCamera className="w-6 h-6 text-primary" />
                    )}
                </div>
                <CardTitle>
                    {status === 'captured' ? 'Photo Captured!' :
                        status === 'error' ? 'Camera Error' :
                            'Take a Selfie'}
                </CardTitle>
                <CardDescription>
                    {status === 'captured' ? 'Review your photo and continue' :
                        status === 'error' ? errorMessage :
                            'Position your face in the frame and take a photo'}
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Camera preview / Captured image */}
                <div className="relative aspect-[4/3] bg-black rounded-lg overflow-hidden">
                    {status === 'captured' && capturedImage ? (
                        <img
                            src={capturedImage}
                            alt="Captured selfie"
                            className="w-full h-full object-cover"
                        />
                    ) : status === 'error' ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground gap-2">
                            <IconCamera className="w-12 h-12 opacity-50" />
                            <p className="text-xs text-center px-4">Camera access blocked by ngrok</p>
                        </div>
                    ) : (
                        <>
                            <video
                                ref={videoRef}
                                className="w-full h-full object-cover mirror"
                                style={{ transform: 'scaleX(-1)' }} // Mirror for selfie
                                playsInline
                                muted
                            />
                            {status === 'idle' && (
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <IconLoader2 className="w-8 h-8 text-white animate-spin" />
                                </div>
                            )}
                            {/* Face guide oval */}
                            {status === 'streaming' && (
                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                    <div className="w-48 h-64 border-2 border-white/50 rounded-full" />
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Hidden canvas for capture */}
                <canvas ref={canvasRef} className="hidden" />

                {/* Actions */}
                {status === 'streaming' && (
                    <Button onClick={capturePhoto} className="w-full gap-2" size="lg">
                        <IconCamera className="w-5 h-5" />
                        Capture Photo
                    </Button>
                )}

                {status === 'captured' && (
                    <div className="flex gap-3">
                        <Button variant="outline" onClick={retakePhoto} className="flex-1 gap-2">
                            <IconRefresh className="w-4 h-4" />
                            Retake
                        </Button>
                        <Button onClick={handleProceed} className="flex-1 gap-2">
                            <IconCheck className="w-4 h-4" />
                            Continue
                        </Button>
                    </div>
                )}

                {status === 'error' && (
                    <div className="space-y-3">
                        <Button onClick={startCamera} variant="outline" className="w-full gap-2">
                            <IconRefresh className="w-4 h-4" />
                            Try Again
                        </Button>
                        <Button onClick={handleSkipSelfie} className="w-full gap-2" variant="secondary">
                            <IconPlayerSkipForward className="w-4 h-4" />
                            Skip Selfie (Testing Only)
                        </Button>
                        {onBack && (
                            <Button variant="ghost" onClick={onBack} className="w-full text-xs">
                                Go Back
                            </Button>
                        )}
                    </div>
                )}

                {/* Timestamp info */}
                {status === 'captured' && capturedAt && (
                    <p className="text-xs text-center text-muted-foreground">
                        Captured at {format(capturedAt, "dd MMM yyyy, hh:mm:ss a")}
                    </p>
                )}
            </CardContent>
        </Card>
    )
}

export default SelfieCapture
