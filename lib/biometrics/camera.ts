export const BIOMETRIC_CAMERA_CONSTRAINTS: MediaTrackConstraints = {
  facingMode: { ideal: "user" },
  width: { ideal: 1280, min: 640 },
  height: { ideal: 960, min: 480 },
  aspectRatio: { ideal: 4 / 3 },
  frameRate: { ideal: 30, max: 30 },
};

export const BIOMETRIC_MINIMUM_FRAME = { longSide: 640, shortSide: 480 } as const;
export const BIOMETRIC_PREFERRED_FRAME = { longSide: 1280, shortSide: 720 } as const;

export type CameraFrameValidation = {
  width: number;
  height: number;
  minimumSupported: boolean;
  preferred: boolean;
  fourByThreeFamily: boolean;
};

export function validateBiometricCameraFrame(width: number, height: number): CameraFrameValidation {
  const longSide = Math.max(width, height);
  const shortSide = Math.min(width, height);
  const normalizedRatio = longSide / Math.max(shortSide, 1);

  return {
    width,
    height,
    minimumSupported: longSide >= BIOMETRIC_MINIMUM_FRAME.longSide && shortSide >= BIOMETRIC_MINIMUM_FRAME.shortSide,
    preferred: longSide >= BIOMETRIC_PREFERRED_FRAME.longSide && shortSide >= BIOMETRIC_PREFERRED_FRAME.shortSide,
    fourByThreeFamily: Math.abs(normalizedRatio - 4 / 3) <= 0.12,
  };
}

export function captureBiometricFrame(video: HTMLVideoElement, canvas: HTMLCanvasElement, options: { maxLongSide?: number; quality?: number } = {}) {
  const sourceWidth = video.videoWidth;
  const sourceHeight = video.videoHeight;
  const validation = validateBiometricCameraFrame(sourceWidth, sourceHeight);
  if (!validation.minimumSupported) throw new Error("Camera resolution is below the 640 × 480 verification minimum.");

  const scale = Math.min(1, (options.maxLongSide ?? 1280) / Math.max(sourceWidth, sourceHeight));
  canvas.width = Math.max(1, Math.round(sourceWidth * scale));
  canvas.height = Math.max(1, Math.round(sourceHeight * scale));
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Could not prepare the camera frame.");

  // The preview may be mirrored for UX; all biometric server inputs remain unmirrored and consistent.
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  return { dataUrl: canvas.toDataURL("image/jpeg", options.quality ?? 0.86), width: canvas.width, height: canvas.height, validation };
}
