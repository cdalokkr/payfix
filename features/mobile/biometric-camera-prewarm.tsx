'use client'

import { useEffect } from 'react'
import { FaceApiBrowserService } from '@/lib/services/faceapi-browser.service'
import { prewarmBiometricService, stopPrewarmedBiometricCamera } from '@/lib/biometric-camera-prewarm'

/**
 * Lives at the authenticated mobile-layout level.
 * Pre-warms only the remote biometric service container + lightweight local blink detector
 * (no heavy ONNX/MediaPipe CDN downloads and no background camera hardware lock on non-camera tabs).
 */
export function BiometricCameraPrewarm() {
  useEffect(() => {
    prewarmBiometricService()
    FaceApiBrowserService.loadDetectorOnly().catch(() => {})

    // Pre-warm OS cached location coordinates in background so Today's attendance card resolves cleanly
    if (typeof window !== 'undefined' && 'geolocation' in navigator) {
      try {
        const cachedTime = Number(sessionStorage.getItem('mobileGeofenceTimestamp') || localStorage.getItem('mobileGeofenceTimestamp') || 0)
        if (Date.now() - cachedTime > 120000) {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              try {
                const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude }
                sessionStorage.setItem('mobileUserCoords', JSON.stringify(coords))
                localStorage.setItem('mobileUserCoords', JSON.stringify(coords))
              } catch {}
            },
            () => {},
            { enableHighAccuracy: true, timeout: 5000, maximumAge: 300000 }
          )
        }
      } catch {}
    }

    return () => stopPrewarmedBiometricCamera()
  }, [])

  return null
}
