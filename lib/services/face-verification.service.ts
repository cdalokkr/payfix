/**
 * Face Verification Service — Pure Canvas, Zero Dependencies
 * 
 * NO model downloads. NO external APIs. Just fast pixel math.
 * 
 * Strategy:
 * 1. Basic skin-tone detection in center of image (confirms it's likely a face, not a wall/desk)
 * 2. Perceptual hash comparison on center-cropped regions (face-focused matching)
 * 3. All operations ~10-50ms total
 */

export interface FaceVerificationResult {
    matched: boolean
    similarity: number
    method: 'canvas'
    debugLog: string[]
    error?: string
}

// Match threshold — percentage similarity required for a match
// Selfie vs profile photo: allow for lighting, angle, camera differences
const MATCH_THRESHOLD = 0.55

// Minimum skin-tone pixel percentage in center region to consider "has face"
const MIN_SKIN_PERCENTAGE = 0.15 // 15% of center pixels should be skin-toned

// Hash comparison canvas size
const HASH_SIZE = 64

// ─── Image Utilities ──────────────────────────────────────────────────────────

/**
 * Load image with robust CORS handling
 * - Data URLs: loaded directly (no CORS needed)
 * - HTTP URLs: try CORS first → fetch-to-dataURL fallback → no-CORS fallback
 */
async function loadImage(src: string): Promise<HTMLImageElement> {
    // Data URLs don't need CORS — load directly
    if (src.startsWith('data:')) {
        return loadImgElement(src, false)
    }

    // Try loading with CORS header
    try {
        return await loadImgElement(src, true)
    } catch {
        // CORS failed — try converting via fetch
        try {
            const response = await fetchWithTimeout(src, 5000)
            const blob = await response.blob()
            const dataUrl = await blobToDataURL(blob)
            return await loadImgElement(dataUrl, false)
        } catch {
            // Last resort: load without CORS (canvas tainted but still drawable)
            return loadImgElement(src, false)
        }
    }
}

function loadImgElement(src: string, useCors: boolean): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Image load timeout')), 5000)
        const img = new Image()
        if (useCors) img.crossOrigin = 'anonymous'
        img.onload = () => { clearTimeout(timer); resolve(img) }
        img.onerror = () => { clearTimeout(timer); reject(new Error('Image load failed')) }
        img.src = src
    })
}

function fetchWithTimeout(url: string, ms: number): Promise<Response> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), ms)
    return fetch(url, { signal: controller.signal, mode: 'cors' })
        .finally(() => clearTimeout(timer))
}

function blobToDataURL(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = reject
        reader.readAsDataURL(blob)
    })
}

/**
 * Draw image center-cropped into a square canvas
 */
function centerCrop(img: HTMLImageElement, size: number): HTMLCanvasElement {
    const c = document.createElement('canvas')
    c.width = size; c.height = size
    const ctx = c.getContext('2d')!
    const w = img.naturalWidth, h = img.naturalHeight
    const s = Math.min(w, h)
    ctx.drawImage(img, (w - s) / 2, (h - s) / 2, s, s, 0, 0, size, size)
    return c
}

// ─── Skin Tone Detection ──────────────────────────────────────────────────────

/**
 * Check if the center region of the image contains skin-toned pixels
 * This catches obvious non-face images (walls, desks, objects)
 * Works across all human skin tones
 */
function hasSkinTone(canvas: HTMLCanvasElement): { hasSkin: boolean; percentage: number } {
    const ctx = canvas.getContext('2d')!
    const size = canvas.width
    // Sample center 60% of image
    const from = Math.floor(size * 0.2)
    const to = Math.floor(size * 0.8)
    const { data } = ctx.getImageData(from, from, to - from, to - from)

    let skinPixels = 0
    let totalPixels = 0

    for (let i = 0; i < data.length; i += 4) {
        const r = data[i], g = data[i + 1], b = data[i + 2]
        totalPixels++

        // Convert to YCbCr color space (better for skin detection across ethnicities)
        const y = 0.299 * r + 0.587 * g + 0.114 * b
        const cb = 128 - 0.169 * r - 0.331 * g + 0.5 * b
        const cr = 128 + 0.5 * r - 0.419 * g - 0.081 * b

        // Skin detection in YCbCr space — works for all skin tones
        // Reference: "Face Detection in Color Images" (Chai & Ngan, 1999)
        if (y > 40 && cb > 77 && cb < 127 && cr > 133 && cr < 173) {
            skinPixels++
        }
    }

    const percentage = totalPixels > 0 ? skinPixels / totalPixels : 0
    return { hasSkin: percentage >= MIN_SKIN_PERCENTAGE, percentage }
}

// ─── Perceptual Hash ──────────────────────────────────────────────────────────

function getGray(canvas: HTMLCanvasElement): number[] {
    const { data } = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height)
    const g: number[] = []
    for (let i = 0; i < data.length; i += 4)
        g.push(data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114)
    return g
}

function averageHash(canvas: HTMLCanvasElement): string {
    const g = getGray(canvas)
    const avg = g.reduce((a, b) => a + b, 0) / g.length
    const s = canvas.width, step = s / 8
    let h = ''
    for (let y = 0; y < 8; y++)
        for (let x = 0; x < 8; x++)
            h += g[Math.floor(y * step) * s + Math.floor(x * step)] > avg ? '1' : '0'
    return h
}

function perceptualHash(canvas: HTMLCanvasElement): string {
    const g = getGray(canvas)
    const s = canvas.width, bs = s / 8
    const blocks: number[] = []
    for (let by = 0; by < 8; by++)
        for (let bx = 0; bx < 8; bx++) {
            let sum = 0, n = 0
            for (let y = 0; y < bs; y++)
                for (let x = 0; x < bs; x++) {
                    sum += g[Math.floor(by * bs + y) * s + Math.floor(bx * bs + x)]
                    n++
                }
            blocks.push(sum / n)
        }
    const med = [...blocks].sort((a, b) => a - b)[32]
    return blocks.map(v => v > med ? '1' : '0').join('')
}

function colorSignature(canvas: HTMLCanvasElement): number[] {
    const { data } = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height)
    const s = canvas.width
    const from = Math.floor(s * 0.15), to = Math.floor(s * 0.85)
    let r = 0, g = 0, b = 0, n = 0
    for (let y = from; y < to; y++)
        for (let x = from; x < to; x++) {
            const i = (y * s + x) * 4
            r += data[i]; g += data[i + 1]; b += data[i + 2]; n++
        }
    return [Math.round(r / n), Math.round(g / n), Math.round(b / n)]
}

function hamming(h1: string, h2: string): number {
    let d = 0
    for (let i = 0; i < h1.length; i++) if (h1[i] !== h2[i]) d++
    return d
}

function colorDist(c1: number[], c2: number[]): number {
    return Math.max(0, 1 - Math.sqrt(
        (c1[0] - c2[0]) ** 2 + (c1[1] - c2[1]) ** 2 + (c1[2] - c2[2]) ** 2
    ) / 441)
}

interface ImageHash { a: string; p: string; c: number[] }

function computeHash(canvas: HTMLCanvasElement): ImageHash {
    return { a: averageHash(canvas), p: perceptualHash(canvas), c: colorSignature(canvas) }
}

function compareHashes(h1: ImageHash, h2: ImageHash): number {
    const aSim = 1 - hamming(h1.a, h2.a) / 64
    const pSim = 1 - hamming(h1.p, h2.p) / 64
    const cSim = colorDist(h1.c, h2.c)
    // pHash most important (face structure), color (skin tone), aHash (general)
    return pSim * 0.45 + cSim * 0.30 + aSim * 0.25
}

// ─── Cache ────────────────────────────────────────────────────────────────────

let cachedUrl: string | null = null
let cachedHash: ImageHash | null = null

// ─── Public API ───────────────────────────────────────────────────────────────

export const FaceVerificationService = {
    async initialize(): Promise<boolean> {
        return true // No models to load!
    },

    isReady(): boolean {
        return true // Always ready — pure canvas
    },

    clearCache(): void {
        cachedUrl = null
        cachedHash = null
    },

    /**
     * Pre-compute profile image hash while camera streams
     */
    async preloadProfileDescriptor(
        profileImageUrl: string,
        log?: (msg: string) => void
    ): Promise<boolean> {
        if (cachedUrl === profileImageUrl && cachedHash) return true
        const logFn = log || (() => { })

        try {
            const img = await loadImage(profileImageUrl)
            const canvas = centerCrop(img, HASH_SIZE)
            cachedHash = computeHash(canvas)
            cachedUrl = profileImageUrl
            logFn('✅ Profile hash cached')
            return true
        } catch (e) {
            logFn(`⚠️ Profile preload failed: ${e}`)
            return false
        }
    },

    /**
     * Compare selfie against profile photo
     * Pure canvas — no models, no downloads, ~10-50ms
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
            log('🚀 Starting verification...')

            // ── 1. Load and process selfie ──
            const selfieImg = await loadImage(selfieDataUrl)
            const selfieCanvas = centerCrop(selfieImg, HASH_SIZE)
            log(`📷 Selfie processed (${ms()})`)

            // ── 2. Skin tone check (is it a human face?) ──
            const skin = hasSkinTone(selfieCanvas)
            log(`🔍 Skin detection: ${(skin.percentage * 100).toFixed(1)}% skin pixels`)

            if (!skin.hasSkin) {
                log(`❌ No face detected — likely not a human (${ms()})`)
                return {
                    matched: false, similarity: 0, method: 'canvas', debugLog,
                    error: 'No face detected. Please ensure your face is clearly visible.',
                }
            }

            // ── 3. Get selfie hash ──
            const selfieHash = computeHash(selfieCanvas)
            log(`🔢 Selfie hash computed (${ms()})`)

            // ── 4. Get profile hash (cached or compute) ──
            let profileHash: ImageHash

            if (cachedUrl === profileImageUrl && cachedHash) {
                profileHash = cachedHash
                log('📋 Using cached profile hash')
            } else {
                log('📷 Loading profile...')
                const profileImg = await loadImage(profileImageUrl)
                const profileCanvas = centerCrop(profileImg, HASH_SIZE)
                profileHash = computeHash(profileCanvas)
                cachedUrl = profileImageUrl
                cachedHash = profileHash
                log(`✅ Profile processed (${ms()})`)
            }

            // ── 5. Compare ──
            const similarity = compareHashes(selfieHash, profileHash)
            const matched = similarity >= MATCH_THRESHOLD

            log(`📊 Similarity: ${(similarity * 100).toFixed(1)}% (threshold: ${(MATCH_THRESHOLD * 100).toFixed(0)}%)`)
            log(`⏱️ Total: ${ms()}`)
            log(matched ? '✅ MATCH — Verified!' : '❌ NO MATCH')

            return {
                matched, similarity, method: 'canvas', debugLog,
                error: matched ? undefined
                    : `Face does not match profile (${(similarity * 100).toFixed(0)}%). Please ensure you are the account holder.`,
            }
        } catch (error) {
            const msg = error instanceof Error ? error.message : 'Unknown error'
            log(`❌ Error: ${msg} (${ms()})`)
            return {
                matched: false, similarity: 0, method: 'canvas', debugLog,
                error: `Verification error: ${msg}`,
            }
        }
    },

    getThreshold(): number {
        return MATCH_THRESHOLD
    },

    formatSimilarity(similarity: number): string {
        return `${(similarity * 100).toFixed(0)}%`
    },
}

export default FaceVerificationService
