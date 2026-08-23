'use client'

import { BIOMETRIC_CAMERA_CONSTRAINTS } from './face-pipeline'

let warmedStream: MediaStream | null = null
let warming: Promise<MediaStream | null> | null = null

/** Starts the shared front-camera stream without changing capture constraints. */
export function prewarmBiometricCamera(): Promise<MediaStream | null> {
  if (warmedStream?.active) return Promise.resolve(warmedStream)
  if (warming) return warming
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) return Promise.resolve(null)

  warming = navigator.mediaDevices.getUserMedia({
    video: BIOMETRIC_CAMERA_CONSTRAINTS,
    audio: false,
  }).then(stream => {
    warmedStream = stream
    return stream
  }).catch(() => null).finally(() => {
    warming = null
  })
  return warming
}

/** Transfers ownership to a camera modal; the modal is responsible for stopping it. */
export function takePrewarmedBiometricCamera(): MediaStream | null {
  const stream = warmedStream
  warmedStream = null
  return stream?.active ? stream : null
}

export function stopPrewarmedBiometricCamera() {
  warmedStream?.getTracks().forEach(track => track.stop())
  warmedStream = null
}