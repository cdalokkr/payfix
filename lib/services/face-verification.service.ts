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

// Threshold: distance < 0.6 = same person (face-api.js standard)
const THRESHOLD = 0.6

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
        // No-op: face-api.js models stay in memory per session (browser cache handles persistence)
    },

    /**
     * Preload profile descriptor in the background.
     * With browser-side face-api.js, this is handled lazily inside compareFaces().
     */
    async preloadProfileDescriptor(
        profileImageUrl: string,
        log?: (msg: string) => void
    ): Promise<boolean> {
        log?.('Profile descriptor will be extracted on first comparison.')
        return true
    },

    /**
     * Compare a selfie (base64 data URL) against a profile photo (remote URL).
     * Uses face-api.js running entirely in the browser — no network call to Python.
     */
    async compareFaces(
        selfieDataUrl: string,
        profileImageUrl: string,
        onDebugLog?: (log: string) => void
    ): Promise<FaceVerificationResult> {
        const debugLog: string[] = []
        const log = (msg: string) => {
            const entry = `[${new Date().toLocaleTimeString()}] ${msg}`
            debugLog.push(entry)
            onDebugLog?.(entry)
        }

        try {
            log('🚀 Starting browser-side face-api.js verification...')

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

            const result = await FaceApiBrowserService.compareImages(
                selfieDataUrl,
                profileImageUrl,
                THRESHOLD,
                log
            )

            return {
                matched: result.matched,
                similarity: result.similarity,
                method: 'face-api',
                debugLog,
                error: result.error,
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
        return 1 - THRESHOLD // Returns as similarity (0.4 = 40% similarity minimum)
    },

    formatSimilarity(similarity: number): string {
        return `${(similarity * 100).toFixed(0)}%`
    },
}

export default FaceVerificationService
