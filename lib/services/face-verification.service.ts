/**
 * Face Verification Service — Fast & Simple
 * 
 * Strategy:
 * 1. Native FaceDetector API (Chrome Android) — instant, no downloads
 *    Fallback: face-api.js SSD MobileNet if native unavailable
 * 2. Crop detected face region from both images
 * 3. Compare cropped face regions via perceptual hash (~5ms)
 * 
 * Total time: ~200ms-1s on mobile (vs 20s+ with full face-api.js)
 */

export interface FaceVerificationResult {
    matched: boolean
    similarity: number
    method: 'native' | 'fallback'
    debugLog: string[]
    error?: string
}

// ─── Configuration ────────────────────────────────────────────────────────────

// Similarity threshold for cropped-face hash comparison
const MATCH_THRESHOLD = 0.58

// Face crop output size for hash comparison
const FACE_CROP_SIZE = 64

// ─── Types ────────────────────────────────────────────────────────────────────

interface FaceBox {
    x: number
    y: number
    width: number
    height: number
}

// ─── Native Face Detection (Chrome Android) ───────────────────────────────────

let nativeFaceDetector: any = null
let nativeSupported: boolean | null = null

async function detectFaceNative(canvas: HTMLCanvasElement): Promise<FaceBox | null> {
    // Check and cache native support
    if (nativeSupported === null) {
        nativeSupported = 'FaceDetector' in window
        if (nativeSupported) {
            try {
                nativeFaceDetector = new (window as any).FaceDetector({ fastMode: true })
            } catch {
                nativeSupported = false
            }
        }
    }

    if (!nativeSupported || !nativeFaceDetector) return null

    try {
        const faces = await nativeFaceDetector.detect(canvas)
        if (faces.length === 0) return null

        // Use largest face found
        const face = faces.reduce((a: any, b: any) =>
            (a.boundingBox.width * a.boundingBox.height) >
                (b.boundingBox.width * b.boundingBox.height) ? a : b
        )

        return {
            x: face.boundingBox.x,
            y: face.boundingBox.y,
            width: face.boundingBox.width,
            height: face.boundingBox.height,
        }
    } catch {
        return null
    }
}

// ─── face-api.js Fallback ─────────────────────────────────────────────────────

let faceApiLoaded = false
let faceApiLoading: Promise<boolean> | null = null
let faceApi: typeof import('face-api.js') | null = null

async function loadFaceApi(): Promise<boolean> {
    if (faceApiLoaded && faceApi) return true
    if (faceApiLoading) return faceApiLoading

    faceApiLoading = (async () => {
        try {
            faceApi = await import('face-api.js')
            if (!faceApi.nets.ssdMobilenetv1.isLoaded) {
                await faceApi.nets.ssdMobilenetv1.loadFromUri('/models')
            }
            faceApiLoaded = true
            faceApiLoading = null
            return true
        } catch (e) {
            console.error('face-api.js load failed:', e)
            faceApiLoading = null
            return false
        }
    })()

    return faceApiLoading
}

async function detectFaceFallback(canvas: HTMLCanvasElement): Promise<FaceBox | null> {
    if (!faceApi) {
        const ok = await loadFaceApi()
        if (!ok || !faceApi) return null
    }

    const options = new faceApi.SsdMobilenetv1Options({ minConfidence: 0.5 })
    const detection = await faceApi.detectSingleFace(canvas, options)
    if (!detection) return null

    // detectSingleFace resolves to the detection result when awaited
    const det = detection as any
    return {
        x: det.box?.x ?? det._box?._x ?? 0,
        y: det.box?.y ?? det._box?._y ?? 0,
        width: det.box?.width ?? det._box?._width ?? canvas.width,
        height: det.box?.height ?? det._box?._height ?? canvas.height,
    }
}

// ─── Image Utilities ──────────────────────────────────────────────────────────

function loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Image load timeout')), 8000)
        const img = new Image()
        img.crossOrigin = 'anonymous'
        img.onload = () => { clearTimeout(timer); resolve(img) }
        img.onerror = () => { clearTimeout(timer); reject(new Error('Image load failed')) }
        img.src = src
    })
}

/**
 * Draw full image into a square canvas for face detection
 */
function toCanvas(img: HTMLImageElement, size: number): HTMLCanvasElement {
    const c = document.createElement('canvas')
    c.width = size; c.height = size
    const ctx = c.getContext('2d')!
    const w = img.naturalWidth, h = img.naturalHeight
    const s = Math.min(w, h)
    ctx.drawImage(img, (w - s) / 2, (h - s) / 2, s, s, 0, 0, size, size)
    return c
}

/**
 * Crop the face region from an image into a small canvas for hash comparison
 */
function cropFace(
    img: HTMLImageElement,
    box: FaceBox,
    detectionSize: number,
    outputSize: number
): HTMLCanvasElement {
    const c = document.createElement('canvas')
    c.width = outputSize; c.height = outputSize
    const ctx = c.getContext('2d')!

    // Scale box from detection canvas back to original image
    const origW = img.naturalWidth, origH = img.naturalHeight
    const origSize = Math.min(origW, origH)
    const scale = origSize / detectionSize
    const offsetX = (origW - origSize) / 2
    const offsetY = (origH - origSize) / 2

    // Add 25% padding around face
    const pad = 0.25
    const sx = offsetX + (box.x - box.width * pad) * scale
    const sy = offsetY + (box.y - box.height * pad) * scale
    const sw = box.width * (1 + pad * 2) * scale
    const sh = box.height * (1 + pad * 2) * scale

    ctx.drawImage(img,
        Math.max(0, sx), Math.max(0, sy), sw, sh,
        0, 0, outputSize, outputSize
    )
    return c
}

// ─── Perceptual Hash ──────────────────────────────────────────────────────────

function getGray(canvas: HTMLCanvasElement): number[] {
    const { data } = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height)
    const g: number[] = []
    for (let i = 0; i < data.length; i += 4)
        g.push(data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114)
    return g
}

function aHash(canvas: HTMLCanvasElement): string {
    const g = getGray(canvas)
    const avg = g.reduce((a, b) => a + b, 0) / g.length
    const s = canvas.width, step = s / 8
    let h = ''
    for (let y = 0; y < 8; y++)
        for (let x = 0; x < 8; x++)
            h += g[Math.floor(y * step) * s + Math.floor(x * step)] > avg ? '1' : '0'
    return h
}

function pHash(canvas: HTMLCanvasElement): string {
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

function skinColors(canvas: HTMLCanvasElement): number[] {
    const { data } = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height)
    const s = canvas.width
    const from = Math.floor(s * 0.2), to = Math.floor(s * 0.8)
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

interface FaceHash { a: string; p: string; c: number[] }

function hashFace(canvas: HTMLCanvasElement): FaceHash {
    return { a: aHash(canvas), p: pHash(canvas), c: skinColors(canvas) }
}

function compareFaceHashes(h1: FaceHash, h2: FaceHash) {
    const aSim = 1 - hamming(h1.a, h2.a) / 64
    const pSim = 1 - hamming(h1.p, h2.p) / 64
    const cSim = colorDist(h1.c, h2.c)
    // pHash weighted highest (structure), aHash (general), color (skin tone)
    return pSim * 0.45 + aSim * 0.30 + cSim * 0.25
}

// ─── Cache ────────────────────────────────────────────────────────────────────

let cachedUrl: string | null = null
let cachedHash: FaceHash | null = null
let cachedBox: FaceBox | null = null

// ─── Public API ───────────────────────────────────────────────────────────────

export const FaceVerificationService = {
    /**
     * Preload: try to detect and cache profile face while camera is streaming
     */
    async initialize(): Promise<boolean> {
        // Check native support early
        if (nativeSupported === null) {
            nativeSupported = 'FaceDetector' in window
            if (nativeSupported) {
                try {
                    nativeFaceDetector = new (window as any).FaceDetector({ fastMode: true })
                } catch {
                    nativeSupported = false
                }
            }
        }

        // If no native support, start loading face-api.js in background
        if (!nativeSupported) {
            loadFaceApi().catch(() => { })
        }

        return true
    },

    isReady(): boolean {
        return nativeSupported === true || faceApiLoaded
    },

    clearCache(): void {
        cachedUrl = null
        cachedHash = null
        cachedBox = null
    },

    async preloadProfileDescriptor(
        profileImageUrl: string,
        log?: (msg: string) => void
    ): Promise<boolean> {
        if (cachedUrl === profileImageUrl && cachedHash) return true

        const logFn = log || (() => { })
        try {
            const img = await loadImage(profileImageUrl)
            const DET_SIZE = 320
            const canvas = toCanvas(img, DET_SIZE)

            // Try native detection first
            let box = await detectFaceNative(canvas)
            if (!box) {
                // Try face-api fallback
                if (!faceApiLoaded) await loadFaceApi()
                box = await detectFaceFallback(canvas)
            }

            if (box) {
                const faceCrop = cropFace(img, box, DET_SIZE, FACE_CROP_SIZE)
                cachedHash = hashFace(faceCrop)
                cachedBox = box
                cachedUrl = profileImageUrl
                logFn('✅ Profile face cached')
                return true
            } else {
                // No face detected — use center crop as fallback
                logFn('⚠️ No face in profile, using center crop')
                const fallbackCrop = toCanvas(img, FACE_CROP_SIZE)
                cachedHash = hashFace(fallbackCrop)
                cachedBox = null
                cachedUrl = profileImageUrl
                return true
            }
        } catch {
            return false
        }
    },

    /**
     * Compare selfie against profile photo
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
            const DET_SIZE = 320
            const useNative = nativeSupported === true
            const method: 'native' | 'fallback' = useNative ? 'native' : 'fallback'
            log(`🚀 Starting verification (${useNative ? 'native FaceDetector' : 'face-api.js fallback'})`)

            // ── 1. Load selfie ──
            log('📷 Loading selfie...')
            const selfieImg = await loadImage(selfieDataUrl)
            const selfieCanvas = toCanvas(selfieImg, DET_SIZE)
            log(`✅ Selfie loaded (${ms()})`)

            // ── 2. Detect face in selfie ──
            log('🔍 Detecting face...')
            let selfieBox: FaceBox | null = null

            if (useNative) {
                selfieBox = await detectFaceNative(selfieCanvas)
            }

            if (!selfieBox && !useNative) {
                // Load face-api if not loaded
                if (!faceApiLoaded) {
                    log('📦 Loading face detection model...')
                    await loadFaceApi()
                }
                selfieBox = await detectFaceFallback(selfieCanvas)
            }

            if (!selfieBox) {
                log(`❌ No face detected (${ms()})`)
                return {
                    matched: false, similarity: 0, method, debugLog,
                    error: 'No human face detected. Please retake with your face clearly visible.',
                }
            }

            log(`✅ Face detected (${ms()})`)

            // ── 3. Crop selfie face and hash ──
            const selfieFaceCrop = cropFace(selfieImg, selfieBox, DET_SIZE, FACE_CROP_SIZE)
            const selfieHash = hashFace(selfieFaceCrop)
            log(`🔢 Selfie face hashed (${ms()})`)

            // ── 4. Get profile face hash ──
            let profileHash: FaceHash

            if (cachedUrl === profileImageUrl && cachedHash) {
                profileHash = cachedHash
                log('📋 Using cached profile hash')
            } else {
                log('📷 Loading profile...')
                const profileImg = await loadImage(profileImageUrl)
                const profileCanvas = toCanvas(profileImg, DET_SIZE)

                let profileBox = useNative ? await detectFaceNative(profileCanvas) : null
                if (!profileBox) profileBox = await detectFaceFallback(profileCanvas)

                if (profileBox) {
                    const profileCrop = cropFace(profileImg, profileBox, DET_SIZE, FACE_CROP_SIZE)
                    profileHash = hashFace(profileCrop)
                } else {
                    // No face in profile — use center crop
                    log('⚠️ No face in profile photo, using center')
                    profileHash = hashFace(toCanvas(profileImg, FACE_CROP_SIZE))
                }

                cachedUrl = profileImageUrl
                cachedHash = profileHash
                log(`✅ Profile processed (${ms()})`)
            }

            // ── 5. Compare ──
            const similarity = compareFaceHashes(selfieHash, profileHash)
            const matched = similarity >= MATCH_THRESHOLD

            log(`📊 Similarity: ${(similarity * 100).toFixed(1)}% (threshold: ${(MATCH_THRESHOLD * 100).toFixed(0)}%)`)
            log(`⏱️ Total: ${ms()}`)
            log(matched ? '✅ MATCH — Verified!' : '❌ NO MATCH')

            return {
                matched, similarity, method, debugLog,
                error: matched ? undefined
                    : `Face does not match profile (${(similarity * 100).toFixed(0)}%). Please ensure you are the account holder.`,
            }
        } catch (error) {
            const msg = error instanceof Error ? error.message : 'Unknown error'
            log(`❌ Error: ${msg}`)
            return {
                matched: false, similarity: 0, method: 'fallback', debugLog,
                error: 'Verification failed. Please try again.',
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
