import type { FaceExtractResult } from '@/lib/face-service-client'

export interface BiometricFrameFailure {
  index: number
  code: string
  message: string
  result: FaceExtractResult
}

/** Exact duplicate frames are not a valid multi-frame capture. Near-identical frames
 * remain acceptable; final quality and liveness decisions stay with the face service. */
export function hasDistinctNaturalFrames(frames: string[]): boolean {
  return new Set(frames).size === frames.length
}

function extractionEmbedding(result: FaceExtractResult): number[] | null {
  const embedding = result.embedding_512 || (result.embedding?.length === 512 ? result.embedding : null)
  return embedding && embedding.length === 512 && embedding.every(Number.isFinite) ? embedding : null
}

export function findFrameFailure(extractions: FaceExtractResult[]): BiometricFrameFailure | null {
  for (let index = 0; index < extractions.length; index += 1) {
    const result = extractions[index]
    if (!result.success || !result.face_detected || result.face_count !== 1) {
      return {
        index,
        code: result.error_code || (result.face_count > 1 ? 'MULTIPLE_FACES_DETECTED' : 'FACE_EXTRACTION_FAILED'),
        message: result.error_message || 'Exactly one clear face is required in every capture frame.',
        result,
      }
    }
    if (!extractionEmbedding(result)) {
      return { index, code: 'EMBEDDING_FAILED', message: 'A valid 512-dimensional biometric template could not be generated.', result }
    }
    if (result.is_live !== true) {
      return {
        index,
        code: result.error_code || 'LIVENESS_FAILED',
        message: result.error_message || 'This frame did not pass the server quality and liveness checks. Use even light and hold the phone steady.',
        result,
      }
    }
  }
  return null
}

/** Picks the strongest service-validated frame for the display portrait. */
export function selectBestValidatedFrame(extractions: FaceExtractResult[]): FaceExtractResult | null {
  return extractions.reduce<FaceExtractResult | null>((best, candidate) => {
    if (!best) return candidate
    const bestScore = (Number(best.quality_score) || 0) * 1000 + (Number(best.diagnostics?.sharpness_score) || 0)
    const candidateScore = (Number(candidate.quality_score) || 0) * 1000 + (Number(candidate.diagnostics?.sharpness_score) || 0)
    return candidateScore > bestScore ? candidate : best
  }, null)
}
