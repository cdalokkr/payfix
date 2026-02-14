"use client"

import React, { useState, useCallback, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { Lock as IconLock, Fingerprint as IconFingerprint, Key as IconKey, Loader2 as IconLoader2 } from "lucide-react"
import { trpc } from "@/lib/trpc/client"

interface MpinLoginProps {
    onSuccess: () => void
    onForgotMpin?: () => void
    onUsePassword?: () => void
}

export function MpinLogin({ onSuccess, onForgotMpin, onUsePassword }: MpinLoginProps) {
    const [mpin, setMpin] = useState('')
    const [isValidating, setIsValidating] = useState(false)
    const [attemptsRemaining, setAttemptsRemaining] = useState<number | null>(null)
    const [lockedUntil, setLockedUntil] = useState<Date | null>(null)

    const { data: mpinStatus } = trpc.mpin.getStatus.useQuery(undefined, {
        staleTime: 30000,
    })

    const validateMpin = trpc.mpin.validate.useMutation({
        onSuccess: (result) => {
            if (result.success) {
                toast.success('Login successful!')
                onSuccess()
            } else {
                toast.error(result.error || 'Invalid MPIN')
                if (result.attemptsRemaining !== undefined) {
                    setAttemptsRemaining(result.attemptsRemaining)
                }
                if (result.lockedUntil) {
                    setLockedUntil(new Date(result.lockedUntil))
                }
                setMpin('')
            }
        },
        onError: (error) => {
            toast.error(error.message || 'Login failed')
            setMpin('')
        },
    })

    const validateBiometric = trpc.mpin.validateBiometric.useMutation({
        onSuccess: (result) => {
            if (result.success) {
                toast.success('Biometric login successful!')
                onSuccess()
            } else {
                toast.error(result.error || 'Biometric authentication failed')
            }
        },
        onError: (error) => {
            toast.error(error.message || 'Biometric authentication failed')
        },
    })

    // Check if account is locked
    useEffect(() => {
        if (mpinStatus?.isLocked && mpinStatus.lockedUntil) {
            setLockedUntil(new Date(mpinStatus.lockedUntil))
        }
    }, [mpinStatus])

    // Auto-submit when 6 digits entered
    useEffect(() => {
        if (mpin.length === 6 && !lockedUntil) {
            handleSubmit()
        }
    }, [mpin])

    const handleKeyPress = useCallback((digit: string) => {
        if (mpin.length < 6 && !lockedUntil) {
            setMpin(prev => prev + digit)
        }
    }, [mpin.length, lockedUntil])

    const handleBackspace = useCallback(() => {
        setMpin(prev => prev.slice(0, -1))
    }, [])

    const handleClear = useCallback(() => {
        setMpin('')
    }, [])

    const handleSubmit = useCallback(async () => {
        if (mpin.length !== 6) {
            toast.error('Please enter a 6-digit MPIN')
            return
        }

        setIsValidating(true)
        try {
            await validateMpin.mutateAsync({ mpin })
        } finally {
            setIsValidating(false)
        }
    }, [mpin, validateMpin])

    const handleBiometric = useCallback(async () => {
        if (!window.PublicKeyCredential) {
            toast.error('Biometric not supported on this device')
            return
        }

        setIsValidating(true)
        try {
            const credential = await navigator.credentials.get({
                publicKey: {
                    challenge: new Uint8Array(32),
                    rpId: window.location.hostname,
                    userVerification: 'required',
                    timeout: 60000,
                },
            }) as PublicKeyCredential | null

            if (credential) {
                await validateBiometric.mutateAsync({ credentialId: credential.id })
            }
        } catch (error) {
            console.error('Biometric error:', error)
            toast.error('Biometric authentication cancelled')
        } finally {
            setIsValidating(false)
        }
    }, [validateBiometric])

    // Countdown for locked account
    const [lockCountdown, setLockCountdown] = useState('')
    useEffect(() => {
        if (!lockedUntil) {
            setLockCountdown('')
            return
        }

        const interval = setInterval(() => {
            const now = new Date()
            const diff = lockedUntil.getTime() - now.getTime()

            if (diff <= 0) {
                setLockedUntil(null)
                setLockCountdown('')
                setAttemptsRemaining(null)
                return
            }

            const minutes = Math.floor(diff / 60000)
            const seconds = Math.floor((diff % 60000) / 1000)
            setLockCountdown(`${minutes}:${seconds.toString().padStart(2, '0')}`)
        }, 1000)

        return () => clearInterval(interval)
    }, [lockedUntil])

    const keypadButtons = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clear', '0', 'back']

    return (
        <Card className="w-full max-w-md mx-auto">
            <CardHeader className="text-center">
                <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                    <IconLock className="w-6 h-6 text-primary" />
                </div>
                <CardTitle>Enter MPIN</CardTitle>
                <CardDescription>
                    Enter your 6-digit PIN to continue
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* MPIN Dots */}
                <div className="flex justify-center gap-3">
                    {[...Array(6)].map((_, i) => (
                        <div
                            key={i}
                            className={`w-4 h-4 rounded-full border-2 transition-all ${i < mpin.length
                                ? 'bg-primary border-primary'
                                : 'border-muted-foreground/30'
                                }`}
                        />
                    ))}
                </div>

                {/* Attempts warning */}
                {attemptsRemaining !== null && attemptsRemaining < 5 && !lockedUntil && (
                    <p className="text-center text-sm text-destructive">
                        {attemptsRemaining} attempts remaining
                    </p>
                )}

                {/* Locked message */}
                {lockedUntil && (
                    <div className="text-center p-4 rounded-lg bg-destructive/10">
                        <p className="text-sm text-destructive font-medium">
                            Account locked
                        </p>
                        <p className="text-xs text-destructive/80">
                            Try again in {lockCountdown}
                        </p>
                    </div>
                )}

                {/* Keypad */}
                <div className="grid grid-cols-3 gap-3">
                    {keypadButtons.map((key) => (
                        <Button
                            key={key}
                            variant={key === 'clear' || key === 'back' ? 'outline' : 'secondary'}
                            size="lg"
                            disabled={isValidating || !!lockedUntil}
                            onClick={() => {
                                if (key === 'clear') handleClear()
                                else if (key === 'back') handleBackspace()
                                else handleKeyPress(key)
                            }}
                            className="h-14 text-xl font-medium"
                        >
                            {key === 'clear' ? 'C' : key === 'back' ? '←' : key}
                        </Button>
                    ))}
                </div>

                {/* Biometric button */}
                {mpinStatus?.biometricEnabled && (
                    <Button
                        variant="outline"
                        onClick={handleBiometric}
                        disabled={isValidating || !!lockedUntil}
                        className="w-full gap-2"
                    >
                        {isValidating ? (
                            <IconLoader2 className="w-5 h-5 animate-spin" />
                        ) : (
                            <IconFingerprint className="w-5 h-5" />
                        )}
                        Use Fingerprint / Face ID
                    </Button>
                )}

                {/* Alternative options */}
                <div className="flex justify-between text-sm">
                    <Button
                        variant="link"
                        size="sm"
                        onClick={onForgotMpin}
                        className="text-muted-foreground p-0 h-auto"
                    >
                        Forgot MPIN?
                    </Button>
                    <Button
                        variant="link"
                        size="sm"
                        onClick={onUsePassword}
                        className="text-muted-foreground p-0 h-auto gap-1"
                    >
                        <IconKey className="w-4 h-4" />
                        Use Password
                    </Button>
                </div>
            </CardContent>
        </Card>
    )
}

export default MpinLogin
