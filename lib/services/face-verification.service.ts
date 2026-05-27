/**
 * Face Verification Service — Server-Side Python Vector Face Matching
 *
 * Replaces the client-side heavy face-api.js execution with a Next.js/tRPC
 * server-side vector extraction and database match.
 *
 * Keeps method signatures identical to avoid compilation issues in dependent code.
 */

export interface FaceVerificationResult {
    matched: boolean
    similarity: number
    method: 'face-api'
    debugLog: string[]
    error?: string
}

// State
let modelsLoaded = true // Instantly loaded because we don't download files client-side

export const FaceVerificationService = {
    /**
     * Initializes the service. With server-side matching, this is an instant operation.
     */
    async initialize(): Promise<boolean> {
        modelsLoaded = true
        return true
    },

    isReady(): boolean {
        return modelsLoaded
    },

    clearCache(): void {
        // Caching is handled on the server (in DB / profiles table)
    },

    /**
     * Dummy profile descriptor preloader.
     * Profile preloading is now handled dynamically on the server-side during verifyFace.
     */
    async preloadProfileDescriptor(
        profileImageUrl: string,
        log?: (msg: string) => void
    ): Promise<boolean> {
        const logFn = log || (() => {})
        logFn('📋 Profile descriptor preloading handled dynamically by server')
        return true
    },

    /**
     * Compare a selfie against a profile photo using server-side Python face recognition.
     * Calls the Next.js API endpoint /api/trpc/attendance.verifyFace.
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

        const t0 = performance.now()
        const ms = () => `${(performance.now() - t0).toFixed(0)}ms`

        try {
            log('🚀 Starting server-side face verification...')
            log('📦 Packaging compressed selfie and requesting verification...')

            // Call the tRPC verifyFace mutation via Next.js API
            const response = await fetch('/api/trpc/attendance.verifyFace?batch=1', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-trpc-source': 'client',
                },
                body: JSON.stringify({
                    "0": {
                        selfieBase64: selfieDataUrl,
                    }
                }),
            })

            if (!response.ok) {
                throw new Error(`Server returned HTTP status ${response.status}`)
            }

            const json = await response.json()
            const batchResult = Array.isArray(json) ? json[0] : json

            if (batchResult.error) {
                const errMsg = batchResult.error.message || batchResult.error.json?.message || 'Verification failed'
                throw new Error(errMsg)
            }

            const resultData = batchResult.result?.data?.json || batchResult.result?.data

            if (!resultData) {
                throw new Error('Malformed response from server')
            }

            const matched = !!resultData.matched
            const similarity = typeof resultData.similarity === 'number' ? resultData.similarity : 0
            const distance = typeof resultData.distance === 'number' ? resultData.distance : 0.5
            const error = resultData.error || (matched ? undefined : 'Face does not match profile photo.')

            log(`📊 Distance: ${distance.toFixed(3)} | Similarity: ${(similarity * 100).toFixed(1)}% (threshold: <0.500)`)
            log(`⏱️ Total round-trip time: ${ms()}`)
            log(matched ? '✅ MATCH — Same person verified!' : `❌ NO MATCH — ${error}`)

            return {
                matched,
                similarity,
                method: 'face-api',
                debugLog,
                error: matched ? undefined : error,
            }
        } catch (error) {
            const msg = error instanceof Error ? error.message : 'Unknown error'
            log(`❌ Error: ${msg} (${ms()})`)
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
        return 0.5 // Matching the server's threshold of 0.5 (1 - distance threshold)
    },

    formatSimilarity(similarity: number): string {
        return `${(similarity * 100).toFixed(0)}%`
    },
}

export default FaceVerificationService
