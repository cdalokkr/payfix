'use client'

import { useEffect } from 'react'
import { FaceVerificationService } from '@/lib/services/face-verification.service'
import { FaceApiBrowserService } from '@/lib/services/faceapi-browser.service'
import { MediaPipeMeshService } from '@/lib/services/mediapipe-mesh.service'
import { prewarmBiometricCamera, stopPrewarmedBiometricCamera } from '@/lib/biometric-camera-prewarm'

/** Lives at the authenticated mobile-layout level so navigation does not cold-start the camera. */
export function BiometricCameraPrewarm() {
  useEffect(() => {
    FaceVerificationService.initialize().catch(() => {})
    FaceApiBrowserService.loadDetectorOnly().catch(() => {})
    MediaPipeMeshService.initialize().catch(() => {})
    void prewarmBiometricCamera()

    // Pre-warm OS cached location coordinates in background so Today's attendance card resolves in <50ms
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