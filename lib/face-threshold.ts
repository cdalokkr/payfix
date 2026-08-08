// src/lib/face-threshold.ts

export type ThresholdProfile = 'strict' | 'balanced' | 'tolerant';

const THRESHOLDS: Record<ThresholdProfile, number> = {
  strict: 0.65,    // High security, fewer false accepts
  balanced: 0.60,  // Minimum 60%+ score required for PayFix pass
  tolerant: 0.50,  // Poor lighting / more acceptance
};

/**
 * Get recommended threshold
 */
export function getThreshold(profile: ThresholdProfile = 'balanced'): number {
  return THRESHOLDS[profile];
}

/**
 * Dynamic threshold based on face quality score (0-1)
 * Low quality face → slightly lower threshold
 */
export function getAdaptiveThreshold(
  faceScore: number,
  baseProfile: ThresholdProfile = 'balanced'
): number {
  const base = getThreshold(baseProfile);

  if (faceScore >= 0.85) return base;
  if (faceScore >= 0.70) return base - 0.03;
  if (faceScore >= 0.55) return base - 0.05;

  return base - 0.08;
}

/**
 * Helper to decide match result with logging
 */
export function evaluateMatch(
  similarity: number,
  threshold: number,
  faceScore?: number
) {
  const finalThreshold =
    faceScore !== undefined
      ? getAdaptiveThreshold(faceScore)
      : threshold;

  return {
    isMatch: similarity >= finalThreshold,
    similarity,
    thresholdUsed: finalThreshold,
    confidenceLevel:
      similarity >= 0.75
        ? 'high'
        : similarity >= 0.60
        ? 'medium'
        : 'low',
  };
}
