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
    return () => stopPrewarmedBiometricCamera()
  }, [])

  return null
}