"use client"

import React, { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import {
    IconMapPin,
    IconLoader2,
    IconCheck,
    IconX,
    IconCurrentLocation,
    IconRefresh,
    IconSettings,
} from "@tabler/icons-react"
import { trpc } from "@/lib/trpc/client"

interface LocationVerificationProps {
    onVerified: (result: LocationResult) => void
    onSkip?: () => void
}

export interface LocationResult {
    latitude: number
    longitude: number
    locationName: string
    distance: number
}

// Client-side distance formatter
function formatDistance(meters: number): string {
    if (meters < 1000) {
        return `${Math.round(meters)}m`
    }
    return `${(meters / 1000).toFixed(1)}km`
}

export function LocationVerification({ onVerified, onSkip }: LocationVerificationProps) {
    const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
    const [errorMessage, setErrorMessage] = useState<string>('')
    const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null)
    const [nearestOffice, setNearestOffice] = useState<{ name: string; distance: number } | null>(null)
    const [showManualEntry, setShowManualEntry] = useState(false)
    const [manualLat, setManualLat] = useState('')
    const [manualLng, setManualLng] = useState('')

    const { data: geofenceResult, refetch, isLoading: isChecking } = trpc.officeLocations.checkGeofence.useQuery(
        {
            latitude: userLocation?.lat ?? 0,
            longitude: userLocation?.lng ?? 0
        },
        {
            enabled: !!userLocation,
            staleTime: 0,
        }
    )

    // Get current location
    const getCurrentLocation = useCallback(async () => {
        if (!navigator.geolocation) {
            setStatus('error')
            setErrorMessage('Geolocation is not supported by this browser')
            setShowManualEntry(true)
            return
        }

        setStatus('loading')
        setErrorMessage('')

        try {
            const position = await new Promise<GeolocationPosition>((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, {
                    enableHighAccuracy: true,
                    timeout: 15000,
                    maximumAge: 0,
                })
            })

            console.log('[LOCATION] Got position:', position.coords.latitude, position.coords.longitude)
            setUserLocation({
                lat: position.coords.latitude,
                lng: position.coords.longitude,
            })
        } catch (error: unknown) {
            setStatus('error')
            const geoError = error as GeolocationPositionError
            console.error('[LOCATION] Geolocation error:', geoError.code, geoError.message)

            switch (geoError.code) {
                case 1: // PERMISSION_DENIED
                    setErrorMessage('Location permission denied. Use manual entry below.')
                    setShowManualEntry(true)
                    break
                case 2: // POSITION_UNAVAILABLE
                    setErrorMessage('Location unavailable. Use manual entry below.')
                    setShowManualEntry(true)
                    break
                case 3: // TIMEOUT
                    setErrorMessage('Location request timed out. Try again or use manual entry.')
                    setShowManualEntry(true)
                    break
                default:
                    setErrorMessage('Unable to get location. Use manual entry below.')
                    setShowManualEntry(true)
            }
        }
    }, [])

    // Handle manual coordinate entry
    const handleManualSubmit = useCallback(() => {
        const lat = parseFloat(manualLat)
        const lng = parseFloat(manualLng)

        if (isNaN(lat) || isNaN(lng)) {
            toast.error('Please enter valid coordinates')
            return
        }

        if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
            toast.error('Invalid coordinate range')
            return
        }

        console.log('[LOCATION] Manual entry:', lat, lng)
        setUserLocation({ lat, lng })
        setStatus('loading')
        setShowManualEntry(false)
    }, [manualLat, manualLng])

    // Check geofence result
    useEffect(() => {
        if (!geofenceResult) return

        console.log('[LOCATION] Geofence result:', geofenceResult)

        if (geofenceResult.isAllowed && geofenceResult.withinOffice) {
            setStatus('success')
            setNearestOffice({
                name: geofenceResult.withinOffice.name,
                distance: geofenceResult.withinOffice.distance,
            })
        } else if (geofenceResult.nearestOffice) {
            setStatus('error')
            setNearestOffice({
                name: geofenceResult.nearestOffice.name,
                distance: geofenceResult.nearestOffice.distance,
            })
            setErrorMessage(
                `You are ${formatDistance(geofenceResult.nearestOffice.distance)} away from ${geofenceResult.nearestOffice.name}`
            )
        } else {
            setStatus('error')
            setErrorMessage('No office locations configured. Please contact admin.')
        }
    }, [geofenceResult])

    // Auto-start location fetch on mount
    useEffect(() => {
        getCurrentLocation()
    }, [getCurrentLocation])

    const handleProceed = useCallback(() => {
        if (userLocation && geofenceResult?.withinOffice) {
            onVerified({
                latitude: userLocation.lat,
                longitude: userLocation.lng,
                locationName: geofenceResult.withinOffice.name,
                distance: geofenceResult.withinOffice.distance,
            })
        }
    }, [userLocation, geofenceResult, onVerified])

    const handleRetry = useCallback(() => {
        setUserLocation(null)
        setNearestOffice(null)
        setErrorMessage('')
        getCurrentLocation()
    }, [getCurrentLocation])

    return (
        <Card className="w-full max-w-md mx-auto">
            <CardHeader className="text-center">
                <div className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4 ${status === 'success' ? 'bg-green-500/10' :
                    status === 'error' ? 'bg-destructive/10' :
                        'bg-primary/10'
                    }`}>
                    {status === 'loading' || isChecking ? (
                        <IconLoader2 className="w-8 h-8 text-primary animate-spin" />
                    ) : status === 'success' ? (
                        <IconCheck className="w-8 h-8 text-green-500" />
                    ) : status === 'error' ? (
                        <IconX className="w-8 h-8 text-destructive" />
                    ) : (
                        <IconMapPin className="w-8 h-8 text-primary" />
                    )}
                </div>
                <CardTitle>
                    {status === 'success' ? 'Location Verified' :
                        status === 'error' ? 'Outside Office Area' :
                            'Verifying Location'}
                </CardTitle>
                <CardDescription>
                    {status === 'loading' || isChecking ? 'Getting your current location...' :
                        status === 'success' ? `You are at ${nearestOffice?.name}` :
                            status === 'error' ? errorMessage :
                                'We need to verify you are at the office'}
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Location details */}
                {userLocation && (
                    <div className="p-4 rounded-lg bg-muted/50 space-y-2">
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Your coordinates:</span>
                            <span className="font-mono">
                                {userLocation.lat.toFixed(5)}, {userLocation.lng.toFixed(5)}
                            </span>
                        </div>
                        {nearestOffice && (
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">
                                    {status === 'success' ? 'Distance:' : 'Nearest office:'}
                                </span>
                                <span className={status === 'success' ? 'text-green-600' : 'text-destructive'}>
                                    {nearestOffice.name} ({formatDistance(nearestOffice.distance)})
                                </span>
                            </div>
                        )}
                    </div>
                )}

                {/* Manual coordinate entry for testing */}
                {showManualEntry && (
                    <div className="p-4 rounded-lg border border-amber-500/30 bg-amber-500/5 space-y-3">
                        <p className="text-xs text-amber-600 font-medium">
                            📍 Manual Entry (for testing on ngrok)
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <Label className="text-xs">Latitude</Label>
                                <Input
                                    type="number"
                                    step="0.00001"
                                    placeholder="e.g. 26.78511"
                                    value={manualLat}
                                    onChange={(e) => setManualLat(e.target.value)}
                                />
                            </div>
                            <div>
                                <Label className="text-xs">Longitude</Label>
                                <Input
                                    type="number"
                                    step="0.00001"
                                    placeholder="e.g. 83.39249"
                                    value={manualLng}
                                    onChange={(e) => setManualLng(e.target.value)}
                                />
                            </div>
                        </div>
                        <Button
                            onClick={handleManualSubmit}
                            size="sm"
                            className="w-full gap-2"
                        >
                            <IconMapPin className="w-4 h-4" />
                            Use These Coordinates
                        </Button>
                    </div>
                )}

                {/* Actions */}
                {status === 'success' && (
                    <Button onClick={handleProceed} className="w-full gap-2">
                        <IconCheck className="w-4 h-4" />
                        Continue to Selfie
                    </Button>
                )}

                {status === 'error' && !showManualEntry && (
                    <div className="space-y-3">
                        <Button onClick={handleRetry} variant="outline" className="w-full gap-2">
                            <IconRefresh className="w-4 h-4" />
                            Retry Location
                        </Button>
                        <Button
                            onClick={() => setShowManualEntry(true)}
                            variant="ghost"
                            size="sm"
                            className="w-full gap-2 text-xs"
                        >
                            <IconSettings className="w-3 h-3" />
                            Enter Coordinates Manually
                        </Button>
                        <p className="text-xs text-center text-muted-foreground">
                            Make sure you are at the office and GPS is enabled
                        </p>
                    </div>
                )}

                {status === 'idle' && (
                    <Button onClick={getCurrentLocation} className="w-full gap-2">
                        <IconCurrentLocation className="w-4 h-4" />
                        Get Current Location
                    </Button>
                )}
            </CardContent>
        </Card>
    )
}

export default LocationVerification
