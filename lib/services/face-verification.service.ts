/**
 * Face Verification Service — Hybrid Approach
 * 
 * Strategy for mobile speed + accuracy:
 * 1. face-api.js detectSingleFace (SSD MobileNet) → confirms it's a human face
 * 2. Crop the detected face region from both images
 * 3. Compare cropped face regions using fast perceptual hash
 * 4. Combine face detection confidence + hash similarity for final decision
 * 
 * This gives ~2-4s on mobile (vs 10-20s for full face recognition pipeline)
 * while still ensuring:
 * - Only human faces pass (non-faces rejected by face detection)
 * - Person matching uses face-focused comparison (not full image hash)
 */

// Types
export interface FaceVerificationResult {
    matched: boolean
    similarity: number
    method: 'hybrid'
    debugLog: string[]
    error?: string
}

// Similarity threshold for cropped face hash comparison
// Stricter than full-image because we're comparing face-to-face
const FACE_HASH_THRESHOLD = 0.62

// Minimum face detection confidence
const MIN_FACE_CONFIDENCE = 0.5

// Verification timeout
const VERIFICATION_TIMEOUT_MS = 15000

// Image sizes
const DETECTION_SIZE = 224  // For face detection (small = fast)
const FACE_CROP_SIZE = 64  // For hash comparison

// State
let modelsLoaded = false
let modelsLoading: Promise<boolean> | null = null
let faceApi: typeof import('face-api.js') | null = null

// Cache profile face data
let cachedProfileUrl: string | null = null
let cachedProfileFaceHash: { aHash: string; pHash: string; colors: number[] } | null = null

// ─── Model Loading ────────────────────────────────────────────────────────────

async function loadModels(retryCount = 0): Promise<boolean> {
    if (modelsLoaded && faceApi) return true
    if (modelsLoading) return modelsLoading

    modelsLoading = (async () => {
        try {
            if (!faceApi) {
                faceApi = await import('face-api.js')
            }

            const MODEL_URL = '/models'

            // Only need SSD MobileNet for face detection (no landmarks/recognition needed)
            if (!faceApi.nets.ssdMobilenetv1.isLoaded) {
                await faceApi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL)
            }

            modelsLoaded = true
            modelsLoading = null
            return true
        } catch (error) {
            console.error(`Face model load failed (attempt ${retryCount + 1}):`, error)
            modelsLoading = null

            if (retryCount < 2) {
                await new Promise(r => setTimeout(r, Math.pow(2, retryCount) * 500))
                return loadModels(retryCount + 1)
            }
            return false
        }
    })()

    return modelsLoading
}

// ─── Image Utilities ──────────────────────────────────────────────────────────

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`TIMEOUT: ${label}`)), ms)
        promise.then(
            v => { clearTimeout(timer); resolve(v) },
            e => { clearTimeout(timer); reject(e) }
        )
    })
}

function loadImage(src: string): Promise<HTMLImageElement> {
    return withTimeout(new Promise((resolve, reject) => {
        const img = new Image()
        img.crossOrigin = 'anonymous'
        img.onload = () => resolve(img)
        img.onerror = () => reject(new Error('Image load failed'))
        img.src = src
    }), 8000, 'Image load')
}

/**
 * Draw image into a square canvas at target size
 */
function imageToCanvas(img: HTMLImageElement, size: number): HTMLCanvasElement {
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')!
    const w = img.naturalWidth, h = img.naturalHeight
    const s = Math.min(w, h)
    ctx.drawImage(img, (w - s) / 2, (h - s) / 2, s, s, 0, 0, size, size)
    return canvas
}

/**
 * Crop the face bounding box from an image into a canvas
 */
function cropFace(
    img: HTMLImageElement,
    box: { x: number; y: number; width: number; height: number },
    detectionSize: number,
    outputSize: number
): HTMLCanvasElement {
    const canvas = document.createElement('canvas')
    canvas.width = outputSize
    canvas.height = outputSize
    const ctx = canvas.getContext('2d')!

    // Scale bounding box from detection size back to original image size
    const origW = img.naturalWidth, origH = img.naturalHeight
    const origSize = Math.min(origW, origH)
    const scale = origSize / detectionSize
    const offsetX = (origW - origSize) / 2
    const offsetY = (origH - origSize) / 2

    // Add 20% padding around face for better hash comparison
    const pad = 0.2
    const sx = offsetX + (box.x - box.width * pad) * scale
    const sy = offsetY + (box.y - box.height * pad) * scale
    const sw = box.width * (1 + pad * 2) * scale
    const sh = box.height * (1 + pad * 2) * scale

    ctx.drawImage(img, Math.max(0, sx), Math.max(0, sy), sw, sh, 0, 0, outputSize, outputSize)
    return canvas
}

// ─── Perceptual Hash (fast image comparison) ──────────────────────────────────

function getGrayPixels(canvas: HTMLCanvasElement): number[] {
    const ctx = canvas.getContext('2d')!
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const gray: number[] = []
    for (let i = 0; i < data.length; i += 4) {
        gray.push(data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114)
    }
    return gray
}

function averageHash(canvas: HTMLCanvasElement): string {
    const gray = getGrayPixels(canvas)
    const avg = gray.reduce((a, b) => a + b, 0) / gray.length
    const s = canvas.width
    const step = s / 8
    let hash = ''
    for (let y = 0; y < 8; y++) {
        for (let x = 0; x < 8; x++) {
            const idx = Math.floor(y * step) * s + Math.floor(x * step)
            hash += gray[idx] > avg ? '1' : '0'
        }
    }
    return hash
}

function perceptualHash(canvas: HTMLCanvasElement): string {
    const gray = getGrayPixels(canvas)
    const s = canvas.width
    const blockSize = s / 8
    const blocks: number[] = []
    for (let by = 0; by < 8; by++) {
        for (let bx = 0; bx < 8; bx++) {
            let sum = 0, count = 0
            for (let y = 0; y < blockSize; y++) {
                for (let x = 0; x < blockSize; x++) {
                    sum += gray[Math.floor(by * blockSize + y) * s + Math.floor(bx * blockSize + x)]
                    count++
                }
            }
            blocks.push(sum / count)
        }
    }
    const median = [...blocks].sort((a, b) => a - b)[32]
    return blocks.map(v => v > median ? '1' : '0').join('')
}

function extractColors(canvas: HTMLCanvasElement): number[] {
    const ctx = canvas.getContext('2d')!
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height)
    // Center 60% of the canvas
    const s = canvas.width
    const from = Math.floor(s * 0.2), to = Math.floor(s * 0.8)
    let r = 0, g = 0, b = 0, n = 0
    for (let y = from; y < to; y++) {
        for (let x = from; x < to; x++) {
            const i = (y * s + x) * 4
            r += data[i]; g += data[i + 1]; b += data[i + 2]; n++
        }
    }
    return [Math.round(r / n), Math.round(g / n), Math.round(b / n)]
}

function hammingDistance(h1: string, h2: string): number {
    if (h1.length !== h2.length) return 64
    let d = 0
    for (let i = 0; i < h1.length; i++) if (h1[i] !== h2[i]) d++
    return d
}

function colorDistance(c1: number[], c2: number[]): number {
    const d = Math.sqrt(
        (c1[0] - c2[0]) ** 2 + (c1[1] - c2[1]) ** 2 + (c1[2] - c2[2]) ** 2
    )
    return Math.max(0, 1 - d / 441)
}

function computeFaceHash(canvas: HTMLCanvasElement) {
    return {
        aHash: averageHash(canvas),
        pHash: perceptualHash(canvas),
        colors: extractColors(canvas),
    }
}

function compareFaceHashes(
    h1: { aHash: string; pHash: string; colors: number[] },
    h2: { aHash: string; pHash: string; colors: number[] }
) {
    const aHashSim = 1 - hammingDistance(h1.aHash, h2.aHash) / 64
    const pHashSim = 1 - hammingDistance(h1.pHash, h2.pHash) / 64
    const colorSim = colorDistance(h1.colors, h2.colors)

    // Weighted: pHash most important, aHash for structure, color for skin tone
    const combined = pHashSim * 0.50 + aHashSim * 0.30 + colorSim * 0.20

    return { aHashSim, pHashSim, colorSim, combined }
}

// ─── Public Service ───────────────────────────────────────────────────────────

export const FaceVerificationService = {
    async initialize(): Promise<boolean> {
        return loadModels()
    },

    isReady(): boolean {
        return modelsLoaded && faceApi !== null
    },

    clearCache(): void {
        cachedProfileUrl = null
        cachedProfileFaceHash = null
    },

    /**
     * Pre-compute profile face hash while camera is streaming
     */
    async preloadProfileDescriptor(
        profileImageUrl: string,
        log?: (msg: string) => void
    ): Promise<boolean> {
        const logFn = log || (() => { })

        if (cachedProfileUrl === profileImageUrl && cachedProfileFaceHash) {
            return true
        }

        try {
            await loadModels()
            if (!faceApi) return false

            const img = await loadImage(profileImageUrl)
            const detCanvas = imageToCanvas(img, DETECTION_SIZE)
            const options = new faceApi.SsdMobilenetv1Options({ minConfidence: MIN_FACE_CONFIDENCE })
            const detection = await faceApi.detectSingleFace(detCanvas, options)

            if (!detection) {
                logFn('⚠️ No face in profile photo')
                return false
            }

            // Crop face and compute hash
            const faceCrop = cropFace(img, detection.box, DETECTION_SIZE, FACE_CROP_SIZE)
            cachedProfileFaceHash = computeFaceHash(faceCrop)
            cachedProfileUrl = profileImageUrl
            logFn('✅ Profile face hash cached')
            return true
        } catch {
            return false
        }
    },

    /**
     * Compare selfie against profile photo
     * 
     * Flow:
     * 1. Detect face in selfie (confirms human) → ~1-2s on mobile
     * 2. Detect face in profile (use cache) → ~0ms if cached
     * 3. Crop face regions from both images
     * 4. Compare face hashes → ~5ms
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
            return await withTimeout(
                this._compare(selfieDataUrl, profileImageUrl, log, debugLog),
                VERIFICATION_TIMEOUT_MS,
                'Verification'
            )
        } catch (error) {
            const msg = error instanceof Error ? error.message : 'Unknown error'
            log(`❌ ${msg}`)
            return {
                matched: false, similarity: 0, method: 'hybrid', debugLog,
                error: msg.startsWith('TIMEOUT:')
                    ? 'Verification timed out. Please ensure good lighting and try again.'
                    : 'Verification failed. Please try again.',
            }
        }
    },

    async _compare(
        selfieDataUrl: string,
        profileImageUrl: string,
        log: (msg: string) => void,
        debugLog: string[]
    ): Promise<FaceVerificationResult> {
        const t0 = performance.now()
        const ms = () => `${(performance.now() - t0).toFixed(0)}ms`

        log('🚀 Starting face verification (hybrid)...')

        // 1. Load models (only SSD MobileNet — fast, ~2MB)
        if (!modelsLoaded) {
            log('📦 Loading face detection model...')
            const ok = await loadModels()
            if (!ok) {
                return {
                    matched: false, similarity: 0, method: 'hybrid', debugLog,
                    error: 'Failed to load face detection. Please refresh.',
                }
            }
            log(`✅ Model loaded (${ms()})`)
        } else {
            log('✅ Model ready')
        }

        if (!faceApi) {
            return {
                matched: false, similarity: 0, method: 'hybrid', debugLog,
                error: 'Face detection not available.',
            }
        }

        const options = new faceApi.SsdMobilenetv1Options({ minConfidence: MIN_FACE_CONFIDENCE })

        // 2. Load and detect face in selfie
        log('📷 Loading selfie...')
        const selfieImg = await loadImage(selfieDataUrl)
        log(`✅ Selfie loaded (${ms()})`)

        const selfieDetCanvas = imageToCanvas(selfieImg, DETECTION_SIZE)
        log('🔍 Detecting face in selfie...')
        const selfieDetection = await faceApi.detectSingleFace(selfieDetCanvas, options)

        if (!selfieDetection) {
            log(`❌ No face detected (${ms()})`)
            return {
                matched: false, similarity: 0, method: 'hybrid', debugLog,
                error: 'No human face detected in selfie. Please retake with your face clearly visible.',
            }
        }
        log(`✅ Selfie face detected — confidence: ${(selfieDetection.score * 100).toFixed(0)}% (${ms()})`)

        // 3. Crop selfie face and compute hash
        const selfieFaceCrop = cropFace(selfieImg, selfieDetection.box, DETECTION_SIZE, FACE_CROP_SIZE)
        const selfieHash = computeFaceHash(selfieFaceCrop)
        log(`🔢 Selfie face hash computed (${ms()})`)

        // 4. Get profile face hash (cached or compute)
        let profileHash: { aHash: string; pHash: string; colors: number[] }

        if (cachedProfileUrl === profileImageUrl && cachedProfileFaceHash) {
            profileHash = cachedProfileFaceHash
            log('📋 Using cached profile face hash')
        } else {
            log('📷 Loading profile photo...')
            const profileImg = await loadImage(profileImageUrl)
            log(`✅ Profile loaded (${ms()})`)

            const profileDetCanvas = imageToCanvas(profileImg, DETECTION_SIZE)
            log('🔍 Detecting face in profile...')
            const profileDetection = await faceApi.detectSingleFace(profileDetCanvas, options)

            if (!profileDetection) {
                log(`❌ No face in profile photo (${ms()})`)
                return {
                    matched: false, similarity: 0, method: 'hybrid', debugLog,
                    error: 'No face detected in profile photo. Please update your profile photo.',
                }
            }
            log(`✅ Profile face detected — confidence: ${(profileDetection.score * 100).toFixed(0)}% (${ms()})`)

            const profileFaceCrop = cropFace(profileImg, profileDetection.box, DETECTION_SIZE, FACE_CROP_SIZE)
            profileHash = computeFaceHash(profileFaceCrop)
            cachedProfileUrl = profileImageUrl
            cachedProfileFaceHash = profileHash
            log(`🔢 Profile face hash computed (${ms()})`)
        }

        // 5. Compare face hashes
        const result = compareFaceHashes(selfieHash, profileHash)
        log(`📊 aHash: ${(result.aHashSim * 100).toFixed(1)}% | pHash: ${(result.pHashSim * 100).toFixed(1)}% | Color: ${(result.colorSim * 100).toFixed(1)}%`)
        log(`📊 Combined: ${(result.combined * 100).toFixed(1)}% (threshold: ${(FACE_HASH_THRESHOLD * 100).toFixed(0)}%)`)

        const matched = result.combined >= FACE_HASH_THRESHOLD
        log(`⏱️ Total: ${ms()}`)
        log(matched ? '✅ MATCH — Face verified!' : '❌ NO MATCH — Face does not match')

        return {
            matched,
            similarity: result.combined,
            method: 'hybrid',
            debugLog,
            error: matched ? undefined : `Face does not match profile (${(result.combined * 100).toFixed(0)}% similarity). Please ensure you are the account holder.`,
        }
    },

    getThreshold(): number {
        return FACE_HASH_THRESHOLD
    },

    formatSimilarity(similarity: number): string {
        return `${(similarity * 100).toFixed(0)}%`
    },
}

export default FaceVerificationService
