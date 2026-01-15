"use client"

import { useState, useEffect, useCallback } from "react"

export type PermissionStatus = 'prompt' | 'granted' | 'denied' | 'checking' | 'unsupported'

export function usePermissionCheck() {
    const [locationStatus, setLocationStatus] = useState<PermissionStatus>('checking')
    const [cameraStatus, setCameraStatus] = useState<PermissionStatus>('checking')
    const [isChecking, setIsChecking] = useState(true)

    const checkPermissions = useCallback(async () => {
        if (typeof window === 'undefined') return

        setIsChecking(true)

        // 1. Check Location
        try {
            if (!navigator.geolocation) {
                setLocationStatus('unsupported')
            } else {
                const result = await navigator.permissions.query({ name: 'geolocation' as PermissionName })
                setLocationStatus(result.state)

                result.onchange = () => {
                    setLocationStatus(result.state as PermissionStatus)
                }
            }
        } catch (e) {
            // Fallback for Safari/iOS
            setLocationStatus('prompt')
        }

        // 2. Check Camera
        try {
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                setCameraStatus('unsupported')
            } else {
                const result = await navigator.permissions.query({ name: 'camera' as PermissionName })
                setCameraStatus(result.state)

                result.onchange = () => {
                    setCameraStatus(result.state as PermissionStatus)
                }
            }
        } catch (e) {
            // Fallback for Safari/iOS
            setCameraStatus('prompt')
        }

        setIsChecking(false)
    }, [])

    const requestPermissions = async () => {
        setIsChecking(true)

        // Request Geolocation
        const locResult = await new Promise<boolean>((resolve) => {
            navigator.geolocation.getCurrentPosition(
                () => {
                    setLocationStatus('granted')
                    resolve(true)
                },
                () => {
                    setLocationStatus('denied')
                    resolve(false)
                }
            )
        })

        // Request Camera
        let camResult = false
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true })
            setCameraStatus('granted')
            stream.getTracks().forEach(track => track.stop())
            camResult = true
        } catch (err) {
            setCameraStatus('denied')
        }

        setIsChecking(false)
        return locResult && camResult
    }

    useEffect(() => {
        checkPermissions()
    }, [checkPermissions])

    return {
        locationStatus,
        cameraStatus,
        isChecking,
        allGranted: locationStatus === 'granted' && cameraStatus === 'granted',
        checkPermissions,
        requestPermissions
    }
}
