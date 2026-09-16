/**
 * KioskCandidateCache — In-memory candidate template cache for 1:N kiosk matching.
 *
 * Caches active employee 512-d templates per tenant schema with a 60-second TTL.
 * Flushed immediately on photo approval or profile update so newly approved
 * employees can punch in immediately.
 */

export interface KioskCandidateProfile {
    id: string
    full_name: string | null
    email: string
    avatar_url: string | null
    face_embedding_512: unknown
    face_embedding_pipeline_version: string | null
}

interface CacheEntry {
    candidates: KioskCandidateProfile[]
    expiresAt: number
}

const candidateCache = new Map<string, CacheEntry>()
const CACHE_TTL_MS = 60_000 // 60 seconds

export async function getCachedKioskCandidates(
    tenantSchema: string,
    fetchCandidates: () => Promise<KioskCandidateProfile[]>
): Promise<KioskCandidateProfile[]> {
    const now = Date.now()
    const existing = candidateCache.get(tenantSchema)
    if (existing && existing.expiresAt > now) {
        return existing.candidates
    }

    const fresh = await fetchCandidates()
    candidateCache.set(tenantSchema, {
        candidates: fresh,
        expiresAt: now + CACHE_TTL_MS,
    })
    return fresh
}

export function invalidateKioskCandidateCache(tenantSchema?: string): void {
    if (tenantSchema) {
        candidateCache.delete(tenantSchema)
    } else {
        candidateCache.clear()
    }
}
