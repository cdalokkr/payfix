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
  width: 960,
  height: 1280,
  minWidth: 480,
  minHeight: 640,
  aspectRatio: 0.75, // Portrait-first 3:4 preference; hardware may report 4:3, and canonical output is always square.
  facingMode: { ideal: 'user' } as const,
  inputSize: 416 as const,
  scoreThreshold: 0.5,
};

export const BIOMETRIC_CAMERA_CONSTRAINTS: MediaTrackConstraints = {
  facingMode: BIOMETRIC_CAMERA_CONFIG.facingMode,
  width: { ideal: BIOMETRIC_CAMERA_CONFIG.width, min: BIOMETRIC_CAMERA_CONFIG.minWidth },
  height: { ideal: BIOMETRIC_CAMERA_CONFIG.height, min: BIOMETRIC_CAMERA_CONFIG.minHeight },
  aspectRatio: { ideal: BIOMETRIC_CAMERA_CONFIG.aspectRatio },
  frameRate: { ideal: 30, max: 30 },
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

/** Shared detector options – keep identical everywhere */
export const FACE_DETECT_OPTIONS = {
  inputSize: BIOMETRIC_CAMERA_CONFIG.inputSize,
  scoreThreshold: BIOMETRIC_CAMERA_CONFIG.scoreThreshold,
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

/** Browser capture contract: complete camera frame only; server owns face cropping and alignment. */
export const BIOMETRIC_CAPTURE_PIPELINE_VERSION = 'natural-portrait-v1';
export interface NaturalBiometricCapture { dataUrl: string; width: number; height: number; }
export function captureNaturalBiometricFrame(video: HTMLVideoElement, options: { maxDimension?: number; jpegQuality?: number; mirror?: boolean } = {}): NaturalBiometricCapture | null {
  const sourceWidth = video.videoWidth; const sourceHeight = video.videoHeight;
  if (!sourceWidth || !sourceHeight) return null;
  const scale = Math.min(1, (options.maxDimension ?? 1280) / Math.max(sourceWidth, sourceHeight));
  const width = Math.max(1, Math.round(sourceWidth * scale)); const height = Math.max(1, Math.round(sourceHeight * scale));
  const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
  const context = canvas.getContext('2d'); if (!context) return null;
  context.imageSmoothingEnabled = true; context.imageSmoothingQuality = 'high';
  if (options.mirror ?? true) { context.translate(width, 0); context.scale(-1, 1); }
  context.drawImage(video, 0, 0, sourceWidth, sourceHeight, 0, 0, width, height);
  return { dataUrl: canvas.toDataURL('image/jpeg', options.jpegQuality ?? 0.88), width, height };
}
