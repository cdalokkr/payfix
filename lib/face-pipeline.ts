// src/lib/face-pipeline.ts
// Standard settings for enrollment, verification, PWA, & Kiosk

import {
  prepareEmbedding,
  checkFaceQuality,
  matchFace,
  type EmployeeFace,
  type MatchResult,
  EMBEDDING_SIZE,
} from './face-matching';

/** Shared camera configuration for enrollment, attendance, and kiosk capture. */
export const BIOMETRIC_CAMERA_CONFIG = {
  // A 720 × 960 portrait front-camera stream settles much faster on Android
  // hardware than forcing 1280 × 960 while exceeding the 640 × 480 minimum and
  // preserving full facial detail for 480 × 640 server verification.
  width: 720,
  height: 960,
  minWidth: 480,
  minHeight: 640,
  aspectRatio: 0.75, // Portrait-first 3:4 preference; hardware may report another native ratio, while the server generates the canonical 3:4 portrait.
  // Cloud Run detection natively caps at 640px (480 × 640 for 3:4 portrait).
  // Capturing at 720px (540 × 720) with 0.88 JPEG quality preserves crisp facial
  // texture for 5-point ArcFace alignment while staying compact (~55–80 KB/frame).
  captureMaxDimension: 720,
  captureJpegQuality: 0.88,
  // Client-only face/eye guidance always runs from a tiny transient canvas. It
  // never produces an embedding, crop, authorization decision, or upload.
  guidanceCanvasWidth: 256,
  guidanceIntervalMs: 125,
  guidanceInputSize: 224 as const,
  guidanceScoreThreshold: 0.30,
  // Biometric capture must never silently fall back to the rear camera.
  facingMode: { exact: 'user' } as const,
  inputSize: 416 as const,
  scoreThreshold: 0.5,
};

export const BIOMETRIC_CAMERA_CONSTRAINTS: MediaTrackConstraints = {
  facingMode: BIOMETRIC_CAMERA_CONFIG.facingMode,
  width: { ideal: BIOMETRIC_CAMERA_CONFIG.width, min: BIOMETRIC_CAMERA_CONFIG.minWidth },
  height: { ideal: BIOMETRIC_CAMERA_CONFIG.height, min: BIOMETRIC_CAMERA_CONFIG.minHeight },
  aspectRatio: { ideal: BIOMETRIC_CAMERA_CONFIG.aspectRatio },
  // Use native 30fps preview preference without a strict max: 24 cap so Android Camera2
  // opens its default fast hardware pipeline without multi-second ISP reconfiguration.
  frameRate: { ideal: 30 },
};

export function validateBiometricCameraFrame(width: number, height: number) {
  const longSide = Math.max(width, height);
  const shortSide = Math.min(width, height);
  return {
    minimumSupported: longSide >= 640 && shortSide >= 480,
    preferred: longSide >= 1280 && shortSide >= 720,
    fourByThreeFamily: Math.abs((longSide / Math.max(shortSide, 1)) - (4 / 3)) <= 0.12,
  };
}

const zoomLockedStreams = new WeakSet<MediaStream>();

/**
 * Locks the active camera video track to 1.0x optical zoom (or minimum optical zoom).
 * Guarded per MediaStream instance so repeated attachments do not stall Android drivers.
 */
export async function lockCameraHardwareZoom(stream: MediaStream | null | undefined): Promise<void> {
  if (!stream || !stream.active || zoomLockedStreams.has(stream)) return;
  zoomLockedStreams.add(stream);
  try {
    const track = stream.getVideoTracks()[0];
    if (!track) return;
    const capabilities = (typeof track.getCapabilities === 'function' ? track.getCapabilities() : {}) as any;
    if (capabilities && capabilities.zoom) {
      const minZoom = typeof capabilities.zoom.min === 'number' ? Math.max(1, capabilities.zoom.min) : 1;
      const currentSettings = (typeof track.getSettings === 'function' ? track.getSettings() : {}) as any;
      if (typeof currentSettings.zoom === 'number' && Math.abs(currentSettings.zoom - minZoom) > 0.05) {
        await track.applyConstraints({
          advanced: [{ zoom: minZoom } as any],
        });
      }
    }
  } catch (err) {
    // Non-fatal if device driver does not permit setting zoom
    console.debug('[BiometricCamera] Hardware zoom lock not supported by driver:', err);
  }
}


/** Shared detector options – keep identical everywhere */
export const FACE_DETECT_OPTIONS = {
  inputSize: BIOMETRIC_CAMERA_CONFIG.inputSize,
  scoreThreshold: BIOMETRIC_CAMERA_CONFIG.scoreThreshold,
};

/** Fast browser-only preflight options for the 256px guidance canvas. */
export const LIVE_GUIDANCE_FACE_DETECT_OPTIONS = {
  inputSize: BIOMETRIC_CAMERA_CONFIG.guidanceInputSize,
  scoreThreshold: BIOMETRIC_CAMERA_CONFIG.guidanceScoreThreshold,
};

export interface ExtractedFace {
  embedding: number[]; // raw 128-d from face-api (not normalized yet)
  normalizedEmbedding: number[];
  score: number;
  box?: { x: number; y: number; width: number; height: number };
}

/**
 * Call after face-api:
 *   detectSingleFace(...).withFaceLandmarks(true).withFaceDescriptor()
 */
export function fromFaceApiDetection(detection: {
  descriptor: Float32Array | number[];
  detection: { score: number; box: { x: number; y: number; width: number; height: number } };
}): ExtractedFace {
  const raw = Array.from(detection.descriptor);

  if (raw.length !== EMBEDDING_SIZE) {
    throw new Error(`Expected ${EMBEDDING_SIZE}-d descriptor, got ${raw.length}`);
  }

  const quality = checkFaceQuality(detection.detection.score, detection.detection.box);
  if (!quality.ok) {
    throw new Error(quality.message);
  }

  return {
    embedding: raw,
    normalizedEmbedding: prepareEmbedding(raw),
    score: detection.detection.score,
    box: {
      x: detection.detection.box.x,
      y: detection.detection.box.y,
      width: detection.detection.box.width,
      height: detection.detection.box.height,
    },
  };
}

/** Enrollment payload for API */
export function buildEnrollPayload(
  extracted: ExtractedFace,
  extra: { tenantId: string; facePhotoUrl?: string }
) {
  return {
    embedding: extracted.embedding, // API will normalize again (safe)
    faceQualityScore: extracted.score,
    facePhotoUrl: extra.facePhotoUrl,
    tenantId: extra.tenantId,
  };
}

/** Verification against in-memory / IndexedDB list */
export function verifyAgainstEmployees(
  extracted: ExtractedFace,
  employees: EmployeeFace[],
  profile: 'strict' | 'balanced' | 'tolerant' = 'balanced'
): MatchResult {
  return matchFace(extracted.normalizedEmbedding, employees, {
    faceScore: extracted.score,
    profile,
  });
}

/**
 * Browser capture contract: a high-resolution, centre-framed 3:4 camera image only.
 * This does not detect, align, or crop a face. The biometric service remains the
 * authority for face validation and the stored 720 × 960 canonical portrait.
 */
export const BIOMETRIC_CAPTURE_PIPELINE_VERSION = 'natural-portrait-3x4-v2';
export interface NaturalBiometricCapture {
  dataUrl: string;
  width: number;
  height: number;
  sourceWidth: number;
  sourceHeight: number;
}
export function captureNaturalBiometricFrame(
  video: HTMLVideoElement,
  options: {
    maxDimension?: number;
    jpegQuality?: number;
    mirror?: boolean;
    aspectRatio?: number;
  } = {}
): NaturalBiometricCapture | null {
  const sourceWidth = video.videoWidth;
  const sourceHeight = video.videoHeight;
  if (!sourceWidth || !sourceHeight) return null;

  // Sensors that cannot provide 3:4 still produce a consistent, centre-framed
  // portrait input. This is an image-frame crop, never a browser face crop.
  const aspectRatio = options.aspectRatio ?? BIOMETRIC_CAMERA_CONFIG.aspectRatio;
  let cropWidth = sourceWidth;
  let cropHeight = sourceHeight;
  if (sourceWidth / sourceHeight > aspectRatio) {
    cropWidth = Math.round(sourceHeight * aspectRatio);
  } else {
    cropHeight = Math.round(sourceWidth / aspectRatio);
  }
  const sourceX = Math.max(0, Math.round((sourceWidth - cropWidth) / 2));
  const sourceY = Math.max(0, Math.round((sourceHeight - cropHeight) / 2));
  const scale = Math.min(1, (options.maxDimension ?? BIOMETRIC_CAMERA_CONFIG.captureMaxDimension) / Math.max(cropWidth, cropHeight));
  const width = Math.max(1, Math.round(cropWidth * scale));
  const height = Math.max(1, Math.round(cropHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d'); if (!context) return null;
  context.imageSmoothingEnabled = true; context.imageSmoothingQuality = 'high';
  if (options.mirror ?? true) { context.translate(width, 0); context.scale(-1, 1); }
  context.drawImage(video, sourceX, sourceY, cropWidth, cropHeight, 0, 0, width, height);
  return {
    dataUrl: canvas.toDataURL('image/jpeg', options.jpegQuality ?? BIOMETRIC_CAMERA_CONFIG.captureJpegQuality),
    width,
    height,
    sourceWidth,
    sourceHeight,
  };
}
