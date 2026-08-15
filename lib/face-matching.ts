// src/lib/face-matching.ts
// Face matching utilities – 128-d face-api.js embeddings

export const EMBEDDING_SIZE = 128;

export type ThresholdProfile = 'strict' | 'balanced' | 'tolerant';

const THRESHOLDS: Record<ThresholdProfile, number> = {
  strict: 0.75,
  balanced: 0.68,
  tolerant: 0.65,
};

export interface EmployeeFace {
  id: string;
  fullName: string;
  employeeCode?: string;
  embedding: number[]; // 128-d, preferably L2-normalized
  faceQualityScore?: number;
  avatarUrl?: string | null;
}

export interface MatchResult {
  isMatch: boolean;
  employee: EmployeeFace | null;
  similarity: number;
  secondBestSimilarity: number;
  thresholdUsed: number;
  message: string;
}

export interface QualityCheckResult {
  ok: boolean;
  message: string;
}

/** L2 normalize embedding */
export function l2Normalize(embedding: number[]): number[] {
  if (!embedding?.length) return embedding;

  let norm = 0;
  for (let i = 0; i < embedding.length; i++) {
    norm += embedding[i] * embedding[i];
  }
  norm = Math.sqrt(norm);
  if (norm === 0) return embedding.slice();

  const out = new Array<number>(embedding.length);
  for (let i = 0; i < embedding.length; i++) {
    out[i] = embedding[i] / norm;
  }
  return out;
}

/** Validate 128-d embedding */
export function isValidEmbedding(embedding: unknown): embedding is number[] {
  if (!Array.isArray(embedding) || embedding.length !== EMBEDDING_SIZE) {
    return false;
  }
  return embedding.every((v) => typeof v === 'number' && !Number.isNaN(v));
}

/** Prepare embedding for storage / matching */
export function prepareEmbedding(raw: number[]): number[] {
  if (!isValidEmbedding(raw)) {
    throw new Error(
      `Invalid embedding: expected ${EMBEDDING_SIZE}-d array of numbers`
    );
  }
  return l2Normalize(raw);
}

/** Cosine similarity (assumes both vectors L2-normalized → dot product) */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;

  let dot = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
  }
  return dot;
}

/** Base threshold by profile */
export function getThreshold(profile: ThresholdProfile = 'balanced'): number {
  return THRESHOLDS[profile];
}

/** Adaptive threshold from detection score */
export function getAdaptiveThreshold(
  faceScore: number,
  baseProfile: ThresholdProfile = 'balanced'
): number {
  const base = getThreshold(baseProfile);

  if (faceScore >= 0.85) return base;
  if (faceScore >= 0.7) return base - 0.03;
  if (faceScore >= 0.55) return base - 0.06;
  return base - 0.08;
}

/** Basic face quality gate before matching */
export function checkFaceQuality(
  score: number,
  box?: { width: number; height: number }
): QualityCheckResult {
  if (score < 0.5) {
    return { ok: false, message: 'Face confidence too low. Look at the camera.' };
  }
  if (box && (box.width < 60 || box.height < 60)) {
    return { ok: false, message: 'Face too small. Move closer.' };
  }
  return { ok: true, message: 'OK' };
}

/**
 * Fast 1:N match against employee list
 * - query is normalized internally
 * - employees[].embedding should already be normalized (from DB / IndexedDB)
 */
export function matchFace(
  queryEmbedding: number[],
  employees: EmployeeFace[],
  options: {
    threshold?: number;
    faceScore?: number;
    profile?: ThresholdProfile;
    minGap?: number; // best vs second-best gap
  } = {}
): MatchResult {
  const {
    faceScore,
    profile = 'balanced',
    minGap = 0.08,
  } = options;

  const threshold =
    options.threshold ??
    (faceScore !== undefined
      ? getAdaptiveThreshold(faceScore, profile)
      : getThreshold(profile));

  if (!isValidEmbedding(queryEmbedding)) {
    return {
      isMatch: false,
      employee: null,
      similarity: 0,
      secondBestSimilarity: 0,
      thresholdUsed: threshold,
      message: `Invalid query embedding (expected ${EMBEDDING_SIZE}-d)`,
    };
  }

  if (!employees?.length) {
    return {
      isMatch: false,
      employee: null,
      similarity: 0,
      secondBestSimilarity: 0,
      thresholdUsed: threshold,
      message: 'No employee faces available',
    };
  }

  const query = l2Normalize(queryEmbedding);

  let bestScore = -1;
  let secondBest = -1;
  let bestEmployee: EmployeeFace | null = null;

  for (const emp of employees) {
    if (!isValidEmbedding(emp.embedding)) continue;

    const score = cosineSimilarity(query, emp.embedding);

    if (score > bestScore) {
      secondBest = bestScore;
      bestScore = score;
      bestEmployee = emp;
    } else if (score > secondBest) {
      secondBest = score;
    }
  }

  if (bestEmployee && bestScore >= threshold) {
    // Ambiguous: best and second too close
    if (secondBest >= 0 && bestScore - secondBest < minGap) {
      return {
        isMatch: false,
        employee: null,
        similarity: bestScore,
        secondBestSimilarity: secondBest,
        thresholdUsed: threshold,
        message: 'Ambiguous match. Please try again.',
      };
    }

    return {
      isMatch: true,
      employee: bestEmployee,
      similarity: bestScore,
      secondBestSimilarity: secondBest > 0 ? secondBest : 0,
      thresholdUsed: threshold,
      message: 'Face matched successfully',
    };
  }

  return {
    isMatch: false,
    employee: null,
    similarity: bestScore > 0 ? bestScore : 0,
    secondBestSimilarity: secondBest > 0 ? secondBest : 0,
    thresholdUsed: threshold,
    message: 'No matching employee found',
  };
}
