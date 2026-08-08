/**
 * Face Verification Accuracy & Speed Optimization Utilities
 *
 * Implements L2 Normalization, Fast Dot-Product Cosine Matching,
 * Quality Filtering, Dynamic Adaptive Thresholds, and Top-2 Gap Checks.
 */

export interface EmployeeFace {
    id: string;
    fullName: string;
    employeeCode?: string;
    avatarUrl?: string | null;
    embedding: number[]; // L2-normalized 128-d vector
    faceQualityScore?: number;
    updatedAt?: number;
}


export interface MatchResult {
    isMatch: boolean;
    employee: EmployeeFace | null;
    similarity: number;
    message: string;
    secondBestScore?: number;
}

/**
 * L2-Normalize embedding vector (unit length)
 */
export function l2Normalize(embedding: number[] | Float32Array): number[] {
    if (!embedding || embedding.length === 0) return [];
    let norm = 0;
    for (let i = 0; i < embedding.length; i++) {
        norm += embedding[i] * embedding[i];
    }
    norm = Math.sqrt(norm);
    if (norm === 0) return Array.from(embedding);

    const result = new Array(embedding.length);
    for (let i = 0; i < embedding.length; i++) {
        result[i] = embedding[i] / norm;
    }
    return result;
}

/**
 * Fast Dot Product (equivalent to Cosine Similarity for L2-normalized vectors)
 */
export function dotProduct(a: number[] | Float32Array, b: number[] | Float32Array): number {
    if (a.length !== b.length) return 0;
    let dot = 0;
    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
    }
    return dot;
}

/**
 * Quality Filter: Ensures high face detection confidence and minimum size
 */
export function isGoodQualityFace(
    score: number,
    box?: { width: number; height: number }
): { isGood: boolean; reason?: string } {
    if (score < 0.55) {
        return { isGood: false, reason: 'Low detection confidence. Look directly at camera.' };
    }
    if (box && (box.width < 80 || box.height < 80)) {
        return { isGood: false, reason: 'Face is too far. Please step closer to camera.' };
    }
    return { isGood: true };
}

/**
 * Dynamic Adaptive Threshold based on face detection confidence
 */
export function getAdaptiveThreshold(faceScore: number): number {
    if (faceScore >= 0.85) return 0.45;
    if (faceScore >= 0.70) return 0.42;
    return 0.38; // Soft threshold for lower quality / lighting
}

/**
 * Fast + Accurate Employee Face Matching with Top-2 Gap Check
 */
export function matchFaceFast(
    queryEmbedding: number[] | Float32Array,
    employees: EmployeeFace[],
    threshold?: number,
    top2GapThreshold = 0.08
): MatchResult {
    if (!queryEmbedding || queryEmbedding.length === 0 || !employees || employees.length === 0) {
        return {
            isMatch: false,
            employee: null,
            similarity: 0,
            message: 'No cached employee faces available'
        };
    }

    // 1. L2 Normalize Query Vector
    const query = l2Normalize(queryEmbedding);

    let bestScore = -1;
    let secondBestScore = -1;
    let bestEmployee: EmployeeFace | null = null;

    // 2. Fast Dot Product Loop over all employees
    for (const emp of employees) {
        if (!emp.embedding || emp.embedding.length !== query.length) continue;

        // Ensure stored vector is normalized
        const empNorm = l2Normalize(emp.embedding);
        let score = 0;
        for (let i = 0; i < query.length; i++) {
            score += query[i] * empNorm[i];
        }

        if (score > bestScore) {
            secondBestScore = bestScore;
            bestScore = score;
            bestEmployee = emp;
        } else if (score > secondBestScore) {
            secondBestScore = score;
        }
    }

    const minThreshold = threshold ?? 0.42;

    // 3. Top-2 Gap Check (Eliminate ambiguous matches when multiple candidates exist)
    if (employees.length > 1 && bestScore >= minThreshold && (bestScore - secondBestScore < top2GapThreshold)) {
        return {
            isMatch: false,
            employee: null,
            similarity: bestScore,
            secondBestScore,
            message: 'Ambiguous face match. Please align face clearly.'
        };
    }

    if (bestEmployee && bestScore >= minThreshold) {
        return {
            isMatch: true,
            employee: bestEmployee,
            similarity: bestScore,
            secondBestScore,
            message: 'Face matched successfully'
        };
    }

    return {
        isMatch: false,
        employee: null,
        similarity: bestScore > 0 ? bestScore : 0,
        secondBestScore,
        message: 'No matching employee found'
    };
}
