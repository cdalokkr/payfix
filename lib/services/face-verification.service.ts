/**
 * Face Verification Service — Browser-side face-api.js
 *
 * Uses FaceApiBrowserService (singleton) to compare selfie against profile photo.
 * Completely replaces the Python microservice dependency.
 * Method signatures preserved for backward compatibility with selfie-capture.tsx
 * and face-verification.tsx — no changes needed in those files.
 */

import { FaceApiBrowserService } from './faceapi-browser.service'

export interface FaceVerificationResult {
    matched: boolean
    similarity: number
    method: 'face-api'
    debugLog: string[]
    error?: string
}

// Minimum similarity score required to pass = 60% (Euclidean distance <= 0.40)
const THRESHOLD = 0.40

// In-memory cache for profile descriptors (URL -> Float32Array)
const descriptorCache = new Map<string, Float32Array>()

export const FaceVerificationService = {
    /**
     * Initialize and load face-api.js models (call once on app start or before first scan).
     */
    async initialize(onProgress?: (pct: number, msg: string) => void): Promise<boolean> {
        return FaceApiBrowserService.loadModels(onProgress)
    },

    isReady(): boolean {
        return FaceApiBrowserService.isReady()
    },

    clearCache(): void {
        descriptorCache.clear()
    },

    /**
     * Preload profile descriptor in the background while camera is opening.
     */
    async preloadProfileDescriptor(
        profileImageUrl: string,
        log?: (msg: string) => void
    ): Promise<boolean> {
        if (!profileImageUrl) return false
        if (descriptorCache.has(profileImageUrl)) return true

        try {
            log?.('Preloading profile face descriptor in background...')
            if (!FaceApiBrowserService.isReady()) {
                await FaceApiBrowserService.loadModels()
            }
            const descriptor = await FaceApiBrowserService.extractDescriptorFromUrl(profileImageUrl, log)
            if (descriptor) {
                descriptorCache.set(profileImageUrl, descriptor)
                log?.('✅ Profile face descriptor cached in memory')
                return true
            }
        } catch (err) {
            console.warn('[FaceVerification] Preload failed:', err)
        }
        return false
    },

    /**
     * Compare a selfie (base64 data URL) against a profile photo or pre-saved face embedding.
     * Uses face-api.js running entirely in the browser.
     * Uses pre-saved DB embedding or cached profile descriptor for instant matching (<80ms).
     */
    async compareFaces(
        selfieDataUrl: string,
        profileImageUrl: string,
        onDebugLog?: (log: string) => void,
        preSavedEmbedding?: number[] | Float32Array | null
    ): Promise<FaceVerificationResult> {
        const debugLog: string[] = []
        const log = (msg: string) => {
            const entry = `[${new Date().toLocaleTimeString()}] ${msg}`
            debugLog.push(entry)
            onDebugLog?.(entry)
        }

        try {
            log('🚀 Starting fast browser-side face-api.js verification...')

            // Ensure models are loaded
            if (!FaceApiBrowserService.isReady()) {
                log('⏳ Loading face-api.js models...')
                const loaded = await FaceApiBrowserService.loadModels((pct, msg) => log(`📦 ${pct}% — ${msg}`))
                if (!loaded) {
                    return {
                        matched: false,
                        similarity: 0,
                        method: 'face-api',
                        debugLog,
                        error: 'Failed to load face recognition models. Please refresh and try again.'
                    }
                }
            }

            // Check if profile descriptor is pre-saved in DB session context or cached in memory
            let profileDescriptor: Float32Array | null = null;
            if (preSavedEmbedding && Array.isArray(preSavedEmbedding) && preSavedEmbedding.length === 128) {
                profileDescriptor = FaceApiBrowserService.arrayToDescriptor(preSavedEmbedding);
                log('⚡ Using pre-saved face embedding from session DB context (Zero Network Download!)');
            } else if (preSavedEmbedding instanceof Float32Array) {
                profileDescriptor = preSavedEmbedding;
            } else {
                profileDescriptor = descriptorCache.get(profileImageUrl) || null;
            }

            // Extract selfie descriptor
            log('⚡ Extracting selfie face descriptor...')
            const selfieDescriptor = await FaceApiBrowserService.extractDescriptorFromDataUrl(selfieDataUrl, log)
            if (!selfieDescriptor) {
                return {
                    matched: false,
                    similarity: 0,
                    method: 'face-api',
                    debugLog,
                    error: 'No face detected in selfie. Please align your face inside the guide oval and retake.'
                }
            }

            // Extract profile descriptor from image URL only if not already available
            if (!profileDescriptor) {
                log('📷 Extracting profile photo face descriptor...')
                profileDescriptor = await FaceApiBrowserService.extractDescriptorFromUrl(profileImageUrl, log)
                if (profileDescriptor) {
                    descriptorCache.set(profileImageUrl, profileDescriptor)
                }
            } else {
                log('⚡ Using cached profile face descriptor (Instant Matching)')
            }


            if (!profileDescriptor) {
                return {
                    matched: false,
                    similarity: 0,
                    method: 'face-api',
                    debugLog,
                    error: 'No face detected in profile photo. Please update your profile picture.'
                }
            }

            // Instant Euclidean vector comparison
            const distance = FaceApiBrowserService.euclideanDistance(selfieDescriptor, profileDescriptor)
            const similarity = Math.max(0, 1 - distance)
            const matched = distance < THRESHOLD

            log(`🎯 Distance: ${distance.toFixed(3)} | Similarity: ${(similarity * 100).toFixed(1)}% | ${matched ? '✅ MATCH' : '❌ NO MATCH'}`)

            return {
                matched,
                similarity,
                method: 'face-api',
                debugLog,
                error: matched ? undefined : `Face does not match profile photo (${(similarity * 100).toFixed(0)}% similarity, need >${((1 - THRESHOLD) * 100).toFixed(0)}%).`,
            }
        } catch (error) {
            const msg = error instanceof Error ? error.message : 'Unknown error'
            log(`❌ Error: ${msg}`)
            return {
                matched: false,
                similarity: 0,
                method: 'face-api',
                debugLog,
                error: `Verification error: ${msg}`,
            }
        }
    },


    getThreshold(): number {
        return 1 - THRESHOLD // Returns as similarity (0.60 = 60% similarity minimum)
    },

    formatSimilarity(similarity: number): string {
        return `${(similarity * 100).toFixed(0)}%`
    },

    /**
     * Optional Server-Side RPC Matching: Invokes Postgres match_employee_face RPC function when pgvector is active.
     */
    async matchEmployeeFaceRPC(
        supabase: any,
        liveDescriptor: Float32Array | number[],
        matchThreshold = 0.60
    ): Promise<{ matched: boolean; employeeId?: string; fullName?: string; similarity: number; error?: string }> {
        try {
            const embeddingArray = Array.from(liveDescriptor)
            const { data, error } = await supabase.rpc('match_employee_face', {
                query_embedding: embeddingArray,
                match_threshold: matchThreshold,
                match_count: 1
            })

            if (error) {
                return { matched: false, similarity: 0, error: error.message }
            }

            if (data && data.length > 0) {
                const best = data[0]
                return {
                    matched: true,
                    employeeId: best.employee_id,
                    fullName: best.full_name,
                    similarity: best.similarity || 0.60
                }
            }

            return { matched: false, similarity: 0, error: 'No matching employee found (Minimum 60% score required).' }
        } catch (err: any) {
            return { matched: false, similarity: 0, error: err.message || 'RPC invocation failed' }
        }
    },
}

export default FaceVerificationService

