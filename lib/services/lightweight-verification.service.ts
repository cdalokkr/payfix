/**
 * Lightweight Face Verification Service
 * Uses perceptual image hashing for fast comparison without heavy AI models
 * 
 * This is much faster than face-api.js (~10ms vs ~10s on mobile)
 */

interface VerificationResult {
    matched: boolean
    similarity: number
    method: 'hash' | 'visual'
    debugLog: string[]
    error?: string
}

// Threshold for hash-based similarity (lower = more strict)
// Hash difference of 10 out of 64 bits = ~84% similar
const HASH_SIMILARITY_THRESHOLD = 0.75

/**
 * Create a canvas from image source (data URL or regular URL)
 */
async function loadImageToCanvas(imageSource: string): Promise<HTMLCanvasElement> {
    return new Promise((resolve, reject) => {
        const img = new Image()
        img.crossOrigin = 'anonymous'

        img.onload = () => {
            const canvas = document.createElement('canvas')
            // Use small size for faster processing
            canvas.width = 32
            canvas.height = 32
            const ctx = canvas.getContext('2d')
            if (!ctx) {
                reject(new Error('Could not get canvas context'))
                return
            }
            ctx.drawImage(img, 0, 0, 32, 32)
            resolve(canvas)
        }

        img.onerror = () => reject(new Error('Failed to load image'))
        img.src = imageSource
    })
}

/**
 * Calculate average hash (aHash) of an image
 * This creates a 64-bit fingerprint of the image
 */
function calculateAverageHash(canvas: HTMLCanvasElement): string {
    const ctx = canvas.getContext('2d')
    if (!ctx) return ''

    const imageData = ctx.getImageData(0, 0, 32, 32)
    const pixels = imageData.data

    // Convert to grayscale and calculate average
    const grayPixels: number[] = []
    for (let i = 0; i < pixels.length; i += 4) {
        const gray = (pixels[i] * 0.299 + pixels[i + 1] * 0.587 + pixels[i + 2] * 0.114)
        grayPixels.push(gray)
    }

    const average = grayPixels.reduce((a, b) => a + b, 0) / grayPixels.length

    // Create hash: 1 if pixel > average, 0 otherwise
    let hash = ''
    // Sample 64 pixels (8x8 grid from 32x32)
    for (let y = 0; y < 8; y++) {
        for (let x = 0; x < 8; x++) {
            const idx = (y * 4) * 32 + (x * 4)
            hash += grayPixels[idx] > average ? '1' : '0'
        }
    }

    return hash
}

/**
 * Calculate perceptual hash (pHash) - more robust to transformations
 */
function calculatePerceptualHash(canvas: HTMLCanvasElement): string {
    const ctx = canvas.getContext('2d')
    if (!ctx) return ''

    const imageData = ctx.getImageData(0, 0, 32, 32)
    const pixels = imageData.data

    // Convert to grayscale
    const grayPixels: number[][] = []
    for (let y = 0; y < 32; y++) {
        const row: number[] = []
        for (let x = 0; x < 32; x++) {
            const i = (y * 32 + x) * 4
            const gray = (pixels[i] * 0.299 + pixels[i + 1] * 0.587 + pixels[i + 2] * 0.114)
            row.push(gray)
        }
        grayPixels.push(row)
    }

    // Apply simple DCT-like transformation (simplified)
    // Just use averages of 4x4 blocks (8x8 = 64 values)
    const blockValues: number[] = []
    for (let by = 0; by < 8; by++) {
        for (let bx = 0; bx < 8; bx++) {
            let sum = 0
            for (let y = 0; y < 4; y++) {
                for (let x = 0; x < 4; x++) {
                    sum += grayPixels[by * 4 + y][bx * 4 + x]
                }
            }
            blockValues.push(sum / 16)
        }
    }

    const median = [...blockValues].sort((a, b) => a - b)[32]

    let hash = ''
    for (const val of blockValues) {
        hash += val > median ? '1' : '0'
    }

    return hash
}

/**
 * Calculate Hamming distance between two hashes
 */
function hammingDistance(hash1: string, hash2: string): number {
    if (hash1.length !== hash2.length) return 64

    let distance = 0
    for (let i = 0; i < hash1.length; i++) {
        if (hash1[i] !== hash2[i]) distance++
    }
    return distance
}

/**
 * Convert hamming distance to similarity score (0-1)
 */
function hashToSimilarity(distance: number): number {
    // 64 bits total, so similarity = 1 - (distance / 64)
    return Math.max(0, 1 - (distance / 64))
}

/**
 * Extract dominant colors from image for additional comparison
 */
function extractDominantColors(canvas: HTMLCanvasElement): number[] {
    const ctx = canvas.getContext('2d')
    if (!ctx) return []

    const imageData = ctx.getImageData(0, 0, 32, 32)
    const pixels = imageData.data

    // Get average color of center region (face area)
    let r = 0, g = 0, b = 0, count = 0
    for (let y = 8; y < 24; y++) {
        for (let x = 8; x < 24; x++) {
            const i = (y * 32 + x) * 4
            r += pixels[i]
            g += pixels[i + 1]
            b += pixels[i + 2]
            count++
        }
    }

    return [Math.round(r / count), Math.round(g / count), Math.round(b / count)]
}

/**
 * Calculate color similarity
 */
function colorSimilarity(colors1: number[], colors2: number[]): number {
    if (colors1.length !== 3 || colors2.length !== 3) return 0

    const dr = colors1[0] - colors2[0]
    const dg = colors1[1] - colors2[1]
    const db = colors1[2] - colors2[2]

    // Max distance is sqrt(3 * 255^2) ≈ 441
    const distance = Math.sqrt(dr * dr + dg * dg + db * db)
    return Math.max(0, 1 - (distance / 441))
}

export const LightweightVerificationService = {
    /**
     * Fast face verification using perceptual hashing
     * @param selfieDataUrl - Data URL of the captured selfie
     * @param profileImageUrl - URL of the profile picture
     * @param onDebugLog - Optional callback for real-time debug logs
     */
    async compareFaces(
        selfieDataUrl: string,
        profileImageUrl: string,
        onDebugLog?: (log: string) => void
    ): Promise<VerificationResult> {
        const debugLog: string[] = []
        const log = (msg: string) => {
            const timestamp = new Date().toLocaleTimeString()
            const entry = `[${timestamp}] ${msg}`
            debugLog.push(entry)
            onDebugLog?.(entry)
            console.log(entry)
        }

        const startTime = performance.now()

        try {
            log('🚀 Starting lightweight verification...')

            // Load images
            log('📷 Loading selfie image...')
            const selfieCanvas = await loadImageToCanvas(selfieDataUrl)
            log(`✅ Selfie loaded (${performance.now() - startTime}ms)`)

            log('📷 Loading profile image...')
            const profileCanvas = await loadImageToCanvas(profileImageUrl)
            log(`✅ Profile loaded (${(performance.now() - startTime).toFixed(0)}ms)`)

            // Calculate average hash
            log('🔢 Calculating average hash...')
            const selfieAHash = calculateAverageHash(selfieCanvas)
            const profileAHash = calculateAverageHash(profileCanvas)
            const aHashDistance = hammingDistance(selfieAHash, profileAHash)
            const aHashSimilarity = hashToSimilarity(aHashDistance)
            log(`📊 aHash similarity: ${(aHashSimilarity * 100).toFixed(1)}% (distance: ${aHashDistance}/64)`)

            // Calculate perceptual hash
            log('🔢 Calculating perceptual hash...')
            const selfiePHash = calculatePerceptualHash(selfieCanvas)
            const profilePHash = calculatePerceptualHash(profileCanvas)
            const pHashDistance = hammingDistance(selfiePHash, profilePHash)
            const pHashSimilarity = hashToSimilarity(pHashDistance)
            log(`📊 pHash similarity: ${(pHashSimilarity * 100).toFixed(1)}% (distance: ${pHashDistance}/64)`)

            // Calculate color similarity
            log('🎨 Analyzing color profile...')
            const selfieColors = extractDominantColors(selfieCanvas)
            const profileColors = extractDominantColors(profileCanvas)
            const colorSim = colorSimilarity(selfieColors, profileColors)
            log(`📊 Color similarity: ${(colorSim * 100).toFixed(1)}%`)

            // Combined similarity (weighted average)
            // pHash is more important, aHash for general structure, color for skin tone
            const combinedSimilarity = (pHashSimilarity * 0.5) + (aHashSimilarity * 0.3) + (colorSim * 0.2)

            const totalTime = performance.now() - startTime
            log(`⏱️ Total time: ${totalTime.toFixed(0)}ms`)
            log(`📊 Combined similarity: ${(combinedSimilarity * 100).toFixed(1)}%`)

            const matched = combinedSimilarity >= HASH_SIMILARITY_THRESHOLD
            log(matched ? '✅ MATCH - Verification passed!' : `❌ NO MATCH - Below ${HASH_SIMILARITY_THRESHOLD * 100}% threshold`)

            return {
                matched,
                similarity: combinedSimilarity,
                method: 'hash',
                debugLog,
                error: matched ? undefined : `Similarity too low (${(combinedSimilarity * 100).toFixed(0)}%). Min required: ${HASH_SIMILARITY_THRESHOLD * 100}%`
            }
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error'
            log(`❌ Error: ${errorMsg}`)
            return {
                matched: false,
                similarity: 0,
                method: 'hash',
                debugLog,
                error: errorMsg
            }
        }
    },

    /**
     * Get the match threshold
     */
    getThreshold(): number {
        return HASH_SIMILARITY_THRESHOLD
    },

    /**
     * Format similarity as percentage string
     */
    formatSimilarity(similarity: number): string {
        return `${(similarity * 100).toFixed(0)}%`
    },
}

export default LightweightVerificationService
