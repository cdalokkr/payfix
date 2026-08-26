/**
 * FaceServiceClient — Universal High-Performance AI Client for PayFix Face Service
 * Seamlessly supports both Direct FastAPI REST endpoints and Hugging Face Gradio ZeroGPU Spaces.
 */

export interface FaceExtractResult {
    success: boolean
    face_detected: boolean
    face_count: number
    embedding_512: number[] | null
    embedding_128: number[] | null
    embedding: number[] | null
    cropped_face_base64?: string | null
    canonical_portrait_base64?: string | null
    canonical_portrait_aspect_ratio?: string | null
    canonical_portrait_width?: number | null
    canonical_portrait_height?: number | null
    dimensions: number
    quality_score: number
    is_live: boolean
    liveness_score: number
    diagnostics?: {
        face_box?: { top: number; left: number; width: number; height: number }
        face_coverage_pct?: number
        brightness_score?: number
        contrast_score?: number
        sharpness_score?: number
        liveness_score?: number
        is_live?: boolean
        spoof_reasons?: string[]
        timings_ms?: Record<string, number>
        backend_engine?: string
    } | null
    error_code?: string | null
    error_message?: string | null
    troubleshooting_tip?: string | null
}

export interface FaceCompareResult {
    matched: boolean
    similarity: number
    distance: number
    dimensions: number
    threshold_used: number
    confidence_level: 'HIGH' | 'MEDIUM' | 'LOW' | 'REJECTED'
}

export class FaceServiceClient {
    private static getBaseUrl(): string {
        // Keep the production/preview service isolated from the development
        // service even when both variables exist in the same Vercel project.
        // Vercel exposes exactly one of: production, preview, development.
        const vercelEnvironment = process.env.VERCEL_ENV
        const useDevelopmentService =
            vercelEnvironment === 'development' ||
            (!vercelEnvironment && process.env.NODE_ENV !== 'production')
        const configuredUrl = useDevelopmentService
            ? process.env.DEV_FACE_API_URL
            : process.env.FACE_API_URL
        if (!configuredUrl) throw new Error('FACE_SERVICE_NOT_CONFIGURED')
        return configuredUrl
    }

    /**
     * Accept a canonical portrait only when the service itself supplied either its
     * 3:4 contract label or dimensions that prove that exact ratio. This never
     * creates or substitutes a portrait on the application side.
     */
    private static normalizeCanonicalPortrait(result: FaceExtractResult): FaceExtractResult {
        if (!result.canonical_portrait_base64) return result
        if (result.canonical_portrait_aspect_ratio === '3:4') return result

        const width = Number(result.canonical_portrait_width)
        const height = Number(result.canonical_portrait_height)
        if (Number.isInteger(width) && Number.isInteger(height) && width > 0 && height > 0 && width * 4 === height * 3) {
            return { ...result, canonical_portrait_aspect_ratio: '3:4' }
        }
        return result
    }

    /**
     * Extracts 512-d ArcFace vector & liveness diagnostics from a base64 image.
     */
    static async extract(imageBase64: string): Promise<FaceExtractResult> {
        const baseUrl = this.getBaseUrl().replace(/\/$/, '')
        // The profile-enrollment route sends raw base64 while attendance sends
        // browser data URLs. Keep both flows identical at the service boundary:
        // the Hugging Face extractor expects the encoded image bytes, not the
        // `data:image/...;base64,` transport prefix.
        const serviceImageBase64 = imageBase64.replace(/^data:image\/(?:jpeg|png|webp);base64,/, '')

        // 1. Try Direct REST /extract first
        try {
            const resp = await fetch(`${baseUrl}/extract`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    image_base64: serviceImageBase64,
                    require_512: true,
                    require_128: true,
                    check_liveness: true
                }),
                signal: AbortSignal.timeout(8000)
            })

            if (resp.ok) {
                return this.normalizeCanonicalPortrait((await resp.json()) as FaceExtractResult)
            }
        } catch {
            // Fallback to Gradio SSE Call API
        }

        // 2. Gradio ZeroGPU SSE API Call (/gradio_api/call/extract) with auto-retry
        for (let attempt = 1; attempt <= 3; attempt++) {
            try {
                const callResp = await fetch(`${baseUrl}/gradio_api/call/extract`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ data: [serviceImageBase64] }),
                    signal: AbortSignal.timeout(12000)
                })

                if (!callResp.ok) {
                    throw new Error(`Gradio API returned status ${callResp.status}`)
                }

                const callData = (await callResp.json()) as { event_id?: string }
                if (!callData.event_id) {
                    throw new Error('Gradio event_id not received')
                }

                const sseResp = await fetch(`${baseUrl}/gradio_api/call/extract/${callData.event_id}`, {
                    signal: AbortSignal.timeout(25000)
                })

                const sseText = await sseResp.text()
                
                // Parse all data lines from SSE stream
                const lines = sseText.split('\n')
                let lastDataLine = ''
                for (const line of lines) {
                    const trimmed = line.trim()
                    if (trimmed.startsWith('data:')) {
                        lastDataLine = trimmed.replace(/^data:\s*/, '')
                    }
                }

                if (lastDataLine) {
                    const parsedArr = JSON.parse(lastDataLine)
                    if (Array.isArray(parsedArr) && parsedArr.length > 0) {
                        const raw = parsedArr[0]
                        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
                        if (parsed && typeof parsed.success === 'boolean') {
                            return this.normalizeCanonicalPortrait(parsed as FaceExtractResult)
                        }
                    }
                }
            } catch (err: any) {
                console.warn(`[FaceServiceClient] Extract attempt ${attempt}/3 failed:`, err?.message || err)
                if (attempt < 3) {
                    await new Promise(r => setTimeout(r, attempt * 500)) // Exponential backoff (500ms, 1000ms)
                }
            }
        }

        return {
            success: false,
            face_detected: false,
            face_count: 0,
            embedding_512: null,
            embedding_128: null,
            embedding: null,
            dimensions: 0,
            quality_score: 0,
            is_live: false,
            liveness_score: 0,
            error_code: 'SERVICE_UNREACHABLE',
            error_message: 'Biometric AI service connection error',
            troubleshooting_tip: 'Please check your internet connection and try again.'
        }
    }

    /**
     * Compares two face vectors (128-d or 512-d).
     */
    static async compare(embedding1: number[], embedding2: number[], threshold?: number): Promise<FaceCompareResult> {
        const baseUrl = this.getBaseUrl().replace(/\/$/, '')

        // 1. Try Direct REST /compare first
        try {
            const resp = await fetch(`${baseUrl}/compare`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    embedding1,
                    embedding2,
                    threshold
                }),
                signal: AbortSignal.timeout(5000)
            })

            if (resp.ok) {
                return (await resp.json()) as FaceCompareResult
            }
        } catch {
            // Fallback to Gradio SSE Call API
        }

        // 2. Gradio ZeroGPU SSE API Call (/gradio_api/call/compare)
        try {
            const callResp = await fetch(`${baseUrl}/gradio_api/call/compare`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    data: [
                        JSON.stringify(embedding1),
                        JSON.stringify(embedding2),
                        threshold ?? 0.65
                    ]
                }),
                signal: AbortSignal.timeout(6000)
            })

            if (callResp.ok) {
                const callData = (await callResp.json()) as { event_id?: string }
                if (callData.event_id) {
                    const sseResp = await fetch(`${baseUrl}/gradio_api/call/compare/${callData.event_id}`, {
                        signal: AbortSignal.timeout(8000)
                    })
                    const sseText = await sseResp.text()
                    const dataMatch = sseText.match(/data:\s*(\[.*\])/)
                    if (dataMatch && dataMatch[1]) {
                        const parsedArr = JSON.parse(dataMatch[1]) as string[]
                        if (parsedArr && parsedArr[0]) {
                            return JSON.parse(parsedArr[0]) as FaceCompareResult
                        }
                    }
                }
            }
        } catch (err: any) {
            console.error('[FaceServiceClient] Compare failed:', err)
        }

        // 3. Fallback: Fast client-side Cosine Dot Product
        const dims = embedding1.length
        let dot = 0
        let norm1 = 0
        let norm2 = 0
        for (let i = 0; i < dims; i++) {
            dot += embedding1[i] * embedding2[i]
            norm1 += embedding1[i] * embedding1[i]
            norm2 += embedding2[i] * embedding2[i]
        }
        const sim = Math.max(0, Math.min(1, dot / (Math.sqrt(norm1) * Math.sqrt(norm2) || 1)))
        const th = threshold ?? (dims === 512 ? 0.65 : 0.60)
        const matched = sim >= th

        return {
            matched,
            similarity: Math.round(sim * 10000) / 10000,
            distance: Math.round(Math.sqrt(2 * (1 - sim)) * 10000) / 10000,
            dimensions: dims,
            threshold_used: th,
            confidence_level: sim >= 0.80 ? 'HIGH' : sim >= 0.70 ? 'MEDIUM' : matched ? 'LOW' : 'REJECTED'
        }
    }
}
