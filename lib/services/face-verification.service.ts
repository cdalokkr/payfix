/**
 * Face Verification Service — face-api.js (Real Face Recognition)
 *
 * Uses SSD MobileNetV1 + 68-point landmarks + 128-dim face descriptor.
 * Compares Euclidean distance between descriptors to verify identity.
 *
 * face-api.js is loaded as a UMD script from /js/face-api.min.js
 * (NOT via npm import) to avoid Turbopack/Webpack bundling issues
 * with the old TensorFlow.js 1.2.2 dependency.
 *
 * Models load once from /models/ and are cached in memory.
 * Profile descriptor is cached for fast re-verification.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FaceVerificationResult {
    matched: boolean
    similarity: number
    method: 'face-api'
    debugLog: string[]
    error?: string
}

// ─── Config ───────────────────────────────────────────────────────────────────

/**
 * Euclidean distance threshold for face matching.
 * face-api.js descriptors: distance < 0.6 ≈ same person (industry standard).
 * We convert to a 0-1 "similarity" for UI display: similarity = max(0, 1 - distance).
 */
const MATCH_DISTANCE_THRESHOLD = 0.6
const MODEL_URL = '/models'
const SCRIPT_URL = '/js/face-api.min.js'
const IMAGE_LOAD_TIMEOUT = 8000

// ─── State ────────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let faceapi: any = null
let scriptLoading: Promise<any> | null = null
let modelsLoaded = false
let modelsLoading: Promise<boolean> | null = null

let cachedProfileUrl: string | null = null
let cachedProfileDescriptor: Float32Array | null = null

// ─── Script Loader ────────────────────────────────────────────────────────────

/**
 * Load face-api.js by injecting a <script> tag.
 * This bypasses all bundler issues — the UMD bundle sets window.faceapi.
 */
function loadFaceApiScript(): Promise<any> {
    if (faceapi) return Promise.resolve(faceapi)
    if (typeof window === 'undefined') {
        return Promise.reject(new Error('face-api.js can only be used in the browser'))
    }

    // Check if already loaded globally (e.g. from a previous page)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((window as any).faceapi) {
        faceapi = (window as any).faceapi
        return Promise.resolve(faceapi)
    }

    if (scriptLoading) return scriptLoading

    scriptLoading = new Promise((resolve, reject) => {
        const script = document.createElement('script')
        script.src = SCRIPT_URL
        script.async = true
        script.onload = () => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            faceapi = (window as any).faceapi
            if (faceapi) {
                resolve(faceapi)
            } else {
                reject(new Error('face-api.js loaded but window.faceapi is undefined'))
            }
        }
        script.onerror = () => {
            scriptLoading = null
            reject(new Error('Failed to load face-api.js script'))
        }
        document.head.appendChild(script)
    })

    return scriptLoading
}

// ─── Image Loading ────────────────────────────────────────────────────────────

function loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Image load timeout')), IMAGE_LOAD_TIMEOUT)
        const img = new Image()

        // Data URLs don't need CORS
        if (!src.startsWith('data:')) {
            img.crossOrigin = 'anonymous'
        }

        img.onload = () => { clearTimeout(timer); resolve(img) }
        img.onerror = () => {
            clearTimeout(timer)
            // Retry without CORS as fallback
            if (img.crossOrigin) {
                const img2 = new Image()
                const timer2 = setTimeout(() => reject(new Error('Image load failed')), IMAGE_LOAD_TIMEOUT)
                img2.onload = () => { clearTimeout(timer2); resolve(img2) }
                img2.onerror = () => { clearTimeout(timer2); reject(new Error('Image load failed')) }
                img2.src = src
            } else {
                reject(new Error('Image load failed'))
            }
        }
        img.src = src
    })
}

// ─── Descriptor Extraction ────────────────────────────────────────────────────

/**
 * Detect a single face and extract its 128-dim descriptor.
 * Returns null if no face is detected.
 */
async function extractDescriptor(
    input: HTMLImageElement | HTMLCanvasElement,
    log: (msg: string) => void
): Promise<Float32Array | null> {
    const api = faceapi
    const detection = await api
        .detectSingleFace(input, new api.SsdMobilenetv1Options({ minConfidence: 0.5 }))
        .withFaceLandmarks()
        .withFaceDescriptor()

    if (!detection) {
        log('⚠️ No face detected in image')
        return null
    }

    log(`✅ Face detected (confidence: ${(detection.detection.score * 100).toFixed(1)}%)`)
    return detection.descriptor
}

/**
 * Prepare image for detection: draw onto a canvas at a reasonable size.
 * face-api.js performs best at ~320-640px. We cap at 512px.
 */
function prepareCanvas(img: HTMLImageElement, maxSize = 512): HTMLCanvasElement {
    const canvas = document.createElement('canvas')
    const scale = Math.min(1, maxSize / Math.max(img.naturalWidth, img.naturalHeight))
    canvas.width = Math.round(img.naturalWidth * scale)
    canvas.height = Math.round(img.naturalHeight * scale)
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    return canvas
}

/**
 * Compute Euclidean distance between two 128-dim face descriptors.
 */
function euclideanDistance(d1: Float32Array, d2: Float32Array): number {
    let sum = 0
    for (let i = 0; i < d1.length; i++) {
        const diff = d1[i] - d2[i]
        sum += diff * diff
    }
    return Math.sqrt(sum)
}

// ─── Public API ───────────────────────────────────────────────────────────────

export const FaceVerificationService = {
    /**
     * Load face-api.js script and then load models from /models/.
     * Safe to call multiple times — loads once.
     */
    async initialize(): Promise<boolean> {
        if (modelsLoaded) return true
        if (modelsLoading) return modelsLoading

        modelsLoading = (async () => {
            try {
                // Step 1: Load the face-api.js script
                await loadFaceApiScript()

                // Step 2: Load the 3 model weight files
                await Promise.all([
                    faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
                    faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
                    faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
                ])
                modelsLoaded = true
                return true
            } catch (e) {
                console.error('[FaceVerification] Init failed:', e)
                modelsLoading = null
                return false
            }
        })()

        return modelsLoading
    },

    isReady(): boolean {
        return modelsLoaded
    },

    clearCache(): void {
        cachedProfileUrl = null
        cachedProfileDescriptor = null
    },

    /**
     * Pre-compute and cache the profile image's face descriptor.
     * Call this while the camera is initializing for faster verification later.
     */
    async preloadProfileDescriptor(
        profileImageUrl: string,
        log?: (msg: string) => void
    ): Promise<boolean> {
        if (cachedProfileUrl === profileImageUrl && cachedProfileDescriptor) return true
        const logFn = log || (() => { })

        try {
            const ready = await this.initialize()
            if (!ready) {
                logFn('⚠️ Models not loaded, cannot preload profile')
                return false
            }

            const img = await loadImage(profileImageUrl)
            const canvas = prepareCanvas(img)
            const descriptor = await extractDescriptor(canvas, logFn)

            if (!descriptor) {
                logFn('⚠️ No face found in profile image')
                return false
            }

            cachedProfileDescriptor = descriptor
            cachedProfileUrl = profileImageUrl
            logFn('✅ Profile descriptor cached')
            return true
        } catch (e) {
            logFn(`⚠️ Profile preload failed: ${e}`)
            return false
        }
    },

    /**
     * Compare a selfie against a profile photo using real face recognition.
     * Returns match result with similarity score (0-1).
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
            log('🚀 Starting face verification...')

            // ── 1. Ensure script + models are loaded ──
            if (!modelsLoaded) {
                log('📦 Loading face recognition engine...')
                const ready = await this.initialize()
                if (!ready) {
                    log(`❌ Engine failed to load (${ms()})`)
                    return {
                        matched: false, similarity: 0, method: 'face-api', debugLog,
                        error: 'Face recognition models failed to load. Please check your connection and try again.',
                    }
                }
                log(`✅ Engine ready (${ms()})`)
            }

            // ── 2. Load and process selfie ──
            const selfieImg = await loadImage(selfieDataUrl)
            const selfieCanvas = prepareCanvas(selfieImg)
            log(`📷 Selfie loaded (${selfieCanvas.width}×${selfieCanvas.height}) (${ms()})`)

            // ── 3. Extract selfie face descriptor ──
            const selfieDescriptor = await extractDescriptor(selfieCanvas, log)

            if (!selfieDescriptor) {
                log(`❌ No face detected in selfie (${ms()})`)
                return {
                    matched: false, similarity: 0, method: 'face-api', debugLog,
                    error: 'No face detected in your selfie. Please ensure your face is clearly visible with good lighting.',
                }
            }
            log(`🔢 Selfie descriptor extracted (${ms()})`)

            // ── 4. Get profile descriptor (cached or compute) ──
            let profileDescriptor: Float32Array

            if (cachedProfileUrl === profileImageUrl && cachedProfileDescriptor) {
                profileDescriptor = cachedProfileDescriptor
                log('📋 Using cached profile descriptor')
            } else {
                log('📷 Loading profile image...')
                const profileImg = await loadImage(profileImageUrl)
                const profileCanvas = prepareCanvas(profileImg)
                log(`📷 Profile loaded (${profileCanvas.width}×${profileCanvas.height}) (${ms()})`)

                const desc = await extractDescriptor(profileCanvas, log)
                if (!desc) {
                    log(`❌ No face detected in profile image (${ms()})`)
                    return {
                        matched: false, similarity: 0, method: 'face-api', debugLog,
                        error: 'No face detected in your profile photo. Please upload a clear profile photo with your face visible.',
                    }
                }

                profileDescriptor = desc
                cachedProfileUrl = profileImageUrl
                cachedProfileDescriptor = profileDescriptor
                log(`✅ Profile descriptor extracted (${ms()})`)
            }

            // ── 5. Compare descriptors ──
            const distance = euclideanDistance(selfieDescriptor, profileDescriptor)
            const similarity = Math.max(0, 1 - distance)
            const matched = distance < MATCH_DISTANCE_THRESHOLD

            log(`📊 Distance: ${distance.toFixed(3)} | Similarity: ${(similarity * 100).toFixed(1)}% (threshold: <${MATCH_DISTANCE_THRESHOLD})`)
            log(`⏱️ Total: ${ms()}`)
            log(matched ? '✅ MATCH — Same person verified!' : '❌ NO MATCH — Different person')

            return {
                matched,
                similarity,
                method: 'face-api',
                debugLog,
                error: matched
                    ? undefined
                    : `Face does not match profile photo (${(similarity * 100).toFixed(0)}% similarity). Only the registered employee can mark their own attendance.`,
            }
        } catch (error) {
            const msg = error instanceof Error ? error.message : 'Unknown error'
            log(`❌ Error: ${msg} (${ms()})`)
            return {
                matched: false, similarity: 0, method: 'face-api', debugLog,
                error: `Verification error: ${msg}`,
            }
        }
    },

    getThreshold(): number {
        return 1 - MATCH_DISTANCE_THRESHOLD
    },

    formatSimilarity(similarity: number): string {
        return `${(similarity * 100).toFixed(0)}%`
    },
}

export default FaceVerificationService
