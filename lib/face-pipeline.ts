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

/** Shared camera configuration – 480x640 (3:4 portrait) */
export const BIOMETRIC_CAMERA_CONFIG = {
  width: 480,
  height: 640,
  aspectRatio: 0.75, // 3:4 portrait ratio
  facingMode: 'user' as const,
  inputSize: 160 as const,
  scoreThreshold: 0.5,
};

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
