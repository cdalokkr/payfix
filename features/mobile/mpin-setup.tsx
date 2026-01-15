"use client"

import React, { useState, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { toast } from "sonner"
import { IconLock, IconFingerprint, IconCheck, IconX } from "@tabler/icons-react"
import { trpc } from "@/lib/trpc/client"

interface MpinSetupProps {
    onComplete?: () => void
    isFirstTime?: boolean
}

export function MpinSetup({ onComplete, isFirstTime = false }: MpinSetupProps) {
    const [step, setStep] = useState<'enter' | 'confirm' | 'biometric'>('enter')
    const [mpin, setMpin] = useState('')
    const [confirmMpin, setConfirmMpin] = useState('')
    const [enableBiometric, setEnableBiometric] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)

    const setupMpin = trpc.mpin.setup.useMutation({
        onSuccess: () => {
            if (enableBiometric) {
                setStep('biometric')
            } else {
                toast.success('MPIN set up successfully!')
                onComplete?.()
            }
        },
        onError: (error) => {
            toast.error(error.message || 'Failed to set up MPIN')
        },
    })

    const setBiometric = trpc.mpin.setBiometric.useMutation({
        onSuccess: () => {
            toast.success('MPIN and biometric set up successfully!')
            onComplete?.()
        },
        onError: (error) => {
            toast.error(error.message || 'Failed to enable biometric')
        },
    })

    const handleMpinChange = useCallback((value: string, setter: (v: string) => void) => {
        // Only allow digits and max 6 characters
        const cleaned = value.replace(/\D/g, '').slice(0, 6)
        setter(cleaned)
    }, [])

    const handleNext = useCallback(() => {
        if (mpin.length !== 6) {
            toast.error('Please enter a 6-digit MPIN')
            return
        }
        setStep('confirm')
    }, [mpin])

    const handleConfirm = useCallback(async () => {
        if (confirmMpin !== mpin) {
            toast.error('MPINs do not match')
            setConfirmMpin('')
            return
        }

        setIsSubmitting(true)
        try {
            await setupMpin.mutateAsync({ mpin })
        } finally {
            setIsSubmitting(false)
        }
    }, [mpin, confirmMpin, setupMpin])

    const handleBiometricSetup = useCallback(async () => {
        // Check if WebAuthn is supported
        if (!window.PublicKeyCredential) {
            toast.error('Biometric authentication not supported on this device')
            onComplete?.()
            return
        }

        setIsSubmitting(true)
        try {
            // Create credential for biometric
            const credential = await navigator.credentials.create({
                publicKey: {
                    challenge: new Uint8Array(32),
                    rp: { name: 'PayFix', id: window.location.hostname },
                    user: {
                        id: new Uint8Array(16),
                        name: 'user',
                        displayName: 'User',
                    },
                    pubKeyCredParams: [
                        { type: 'public-key', alg: -7 }, // ES256
                        { type: 'public-key', alg: -257 }, // RS256
                    ],
                    authenticatorSelection: {
                        authenticatorAttachment: 'platform',
                        userVerification: 'required',
                    },
                    timeout: 60000,
                },
            }) as PublicKeyCredential | null

            if (credential) {
                await setBiometric.mutateAsync({
                    enabled: true,
                    credentialId: credential.id,
                })
            } else {
                toast.error('Biometric setup cancelled')
                onComplete?.()
            }
        } catch (error) {
            console.error('Biometric setup error:', error)
            toast.error('Failed to set up biometric authentication')
            onComplete?.()
        } finally {
            setIsSubmitting(false)
        }
    }, [setBiometric, onComplete])

    const handleSkipBiometric = useCallback(() => {
        toast.success('MPIN set up successfully!')
        onComplete?.()
    }, [onComplete])

    return (
        <Card className="w-full max-w-md mx-auto">
            <CardHeader className="text-center">
                <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                    <IconLock className="w-6 h-6 text-primary" />
                </div>
                <CardTitle>
                    {isFirstTime ? 'Set Up Your MPIN' : 'Change MPIN'}
                </CardTitle>
                <CardDescription>
                    {step === 'enter' && 'Create a 6-digit PIN for quick access'}
                    {step === 'confirm' && 'Confirm your 6-digit PIN'}
                    {step === 'biometric' && 'Set up fingerprint/face authentication'}
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                {step === 'enter' && (
                    <>
                        <div className="space-y-2">
                            <Label htmlFor="mpin">Enter 6-Digit MPIN</Label>
                            <Input
                                id="mpin"
                                type="password"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                maxLength={6}
                                value={mpin}
                                onChange={(e) => handleMpinChange(e.target.value, setMpin)}
                                placeholder="••••••"
                                className="text-center text-2xl tracking-[0.5em] font-mono"
                                autoFocus
                            />
                            <div className="flex justify-center gap-1 mt-2">
                                {[...Array(6)].map((_, i) => (
                                    <div
                                        key={i}
                                        className={`w-3 h-3 rounded-full transition-colors ${i < mpin.length ? 'bg-primary' : 'bg-muted'
                                            }`}
                                    />
                                ))}
                            </div>
                        </div>

                        <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                            <div className="flex items-center gap-3">
                                <IconFingerprint className="w-5 h-5 text-muted-foreground" />
                                <div>
                                    <p className="text-sm font-medium">Enable Biometric</p>
                                    <p className="text-xs text-muted-foreground">
                                        Use fingerprint or face ID
                                    </p>
                                </div>
                            </div>
                            <Switch
                                checked={enableBiometric}
                                onCheckedChange={setEnableBiometric}
                            />
                        </div>

                        <Button
                            onClick={handleNext}
                            disabled={mpin.length !== 6}
                            className="w-full"
                        >
                            Continue
                        </Button>
                    </>
                )}

                {step === 'confirm' && (
                    <>
                        <div className="space-y-2">
                            <Label htmlFor="confirm-mpin">Confirm 6-Digit MPIN</Label>
                            <Input
                                id="confirm-mpin"
                                type="password"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                maxLength={6}
                                value={confirmMpin}
                                onChange={(e) => handleMpinChange(e.target.value, setConfirmMpin)}
                                placeholder="••••••"
                                className="text-center text-2xl tracking-[0.5em] font-mono"
                                autoFocus
                            />
                            <div className="flex justify-center gap-1 mt-2">
                                {[...Array(6)].map((_, i) => (
                                    <div
                                        key={i}
                                        className={`w-3 h-3 rounded-full transition-colors ${i < confirmMpin.length
                                                ? confirmMpin[i] === mpin[i]
                                                    ? 'bg-green-500'
                                                    : 'bg-red-500'
                                                : 'bg-muted'
                                            }`}
                                    />
                                ))}
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <Button
                                variant="outline"
                                onClick={() => {
                                    setStep('enter')
                                    setConfirmMpin('')
                                }}
                                className="flex-1"
                            >
                                Back
                            </Button>
                            <Button
                                onClick={handleConfirm}
                                disabled={confirmMpin.length !== 6 || isSubmitting}
                                className="flex-1"
                            >
                                {isSubmitting ? 'Setting up...' : 'Set MPIN'}
                            </Button>
                        </div>
                    </>
                )}

                {step === 'biometric' && (
                    <>
                        <div className="text-center py-8">
                            <div className="mx-auto w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                                <IconFingerprint className="w-10 h-10 text-primary" />
                            </div>
                            <p className="text-sm text-muted-foreground mb-4">
                                Touch the fingerprint sensor or look at the camera to set up biometric login
                            </p>
                        </div>

                        <div className="flex gap-3">
                            <Button
                                variant="outline"
                                onClick={handleSkipBiometric}
                                className="flex-1"
                            >
                                Skip
                            </Button>
                            <Button
                                onClick={handleBiometricSetup}
                                disabled={isSubmitting}
                                className="flex-1"
                            >
                                {isSubmitting ? 'Setting up...' : 'Enable Biometric'}
                            </Button>
                        </div>
                    </>
                )}
            </CardContent>
        </Card>
    )
}

export default MpinSetup
