'use client'

import { BIOMETRIC_CAMERA_CONSTRAINTS, lockCameraHardwareZoom } from './face-pipeline'

let warmedStream: MediaStream | null = null
let warming: Promise<MediaStream | null> | null = null

let lastServicePrewarm = 0

/**
 * Pings the biometric AI verification service in background to eliminate Cloud Run cold starts.
 * Throttled on client to once per 25 seconds.
 */
export function prewarmBiometricService(force = false): void {
  if (typeof window === 'undefined' || typeof fetch !== 'function') return
  const now = Date.now()
  if (!force && now - lastServicePrewarm < 25000) return
  lastServicePrewarm = now

  fetch('/api/attendance/prewarm', {
    method: 'GET',
    cache: 'no-store',
    keepalive: true,
  }).catch(() => {})
}

/** Starts the shared front-camera stream without changing capture constraints and wakes backend. */
export function prewarmBiometricCamera(): Promise<MediaStream | null> {
  // Fire backend service prewarm non-blockingly
  prewarmBiometricService()

  if (warmedStream?.active) return Promise.resolve(warmedStream)
  if (warming) return warming
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) return Promise.resolve(null)

  warming = navigator.mediaDevices.getUserMedia({
    video: BIOMETRIC_CAMERA_CONSTRAINTS,
    audio: false,
  }).then(async (stream) => {
    await lockCameraHardwareZoom(stream)
    warmedStream = stream
    return stream
  }).catch(() => null).finally(() => {
    warming = null
  })
  return warming
}

/** Transfers ownership synchronously if ready, or null. */
export function takePrewarmedBiometricCamera(): MediaStream | null {
  const stream = warmedStream
  warmedStream = null
  return stream?.active ? stream : null
}

/** Transfers ownership once an in-flight prewarm resolves, preventing duplicate getUserMedia calls. */
export async function takeOrAwaitPrewarmedBiometricCamera(): Promise<MediaStream | null> {
  const ready = takePrewarmedBiometricCamera()
  if (ready) return ready

  if (warming) {
    await warming
    return takePrewarmedBiometricCamera()
  }

  return null
}

export function stopPrewarmedBiometricCamera() {
  warmedStream?.getTracks().forEach(track => track.stop())
  warmedStream = null
}
