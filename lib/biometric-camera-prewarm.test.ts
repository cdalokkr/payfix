import {
  prewarmBiometricCamera,
  takePrewarmedBiometricCamera,
  takeOrAwaitPrewarmedBiometricCamera,
  stopPrewarmedBiometricCamera,
} from './biometric-camera-prewarm'
import { lockCameraHardwareZoom } from './face-pipeline'

describe('biometric-camera-prewarm single-owner stream handoff', () => {
  const originalMediaDevices = navigator.mediaDevices
  const originalFetch = global.fetch

  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true }) as any
  })

  afterEach(() => {
    stopPrewarmedBiometricCamera()
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: originalMediaDevices,
    })
    global.fetch = originalFetch
    jest.restoreAllMocks()
  })

  it('awaits an in-flight prewarm instead of spawning a duplicate getUserMedia call', async () => {
    const track = {
      stop: jest.fn(),
      getCapabilities: jest.fn(() => ({ zoom: { min: 1 } })),
      getSettings: jest.fn(() => ({ zoom: 2 })),
      applyConstraints: jest.fn().mockResolvedValue(undefined),
    }
    const fakeStream = {
      active: true,
      getTracks: () => [track],
      getVideoTracks: () => [track],
    } as unknown as MediaStream

    let resolveGum!: (stream: MediaStream) => void
    const getUserMedia = jest.fn(() => new Promise<MediaStream>((resolve) => {
      resolveGum = resolve
    }))

    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia },
    })

    const warmPromise = prewarmBiometricCamera()
    const takePromise = takeOrAwaitPrewarmedBiometricCamera()

    resolveGum(fakeStream)
    await warmPromise
    const acquired = await takePromise

    expect(acquired).toBe(fakeStream)
    expect(getUserMedia).toHaveBeenCalledTimes(1)
    expect(takePrewarmedBiometricCamera()).toBeNull()

    // Calling lockCameraHardwareZoom again on the same stream must not re-apply constraints
    await lockCameraHardwareZoom(fakeStream)
    expect(track.applyConstraints).toHaveBeenCalledTimes(1)
  })
})
