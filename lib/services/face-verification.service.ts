/**
 * Face Verification Service
 * Client-side face comparison using face-api.js
 * 
 * Optimized for mobile PWA speed:
 * - Images resized to 320px before detection (10x faster)
 * - Models preloaded in parallel with camera init
 * - Profile descriptor cached for instant reuse
 * - detectSingleFace for selfie (faster than detectAllFaces)
 * - 20s timeout to prevent infinite hang
 * - Only human faces pass verification
 */

// Types
export interface FaceVerificationResult {
    matched: boolean
    similarity: number
    method: 'face-api'
    debugLog: string[]
    error?: string
}

// Threshold for face match — Euclidean distance
// face-api.js: 0 = identical, 0.6 = standard same-person threshold
// 0.55 is stricter but still allows lighting / angle variation
const DISTANCE_THRESHOLD = 0.55

// Minimum face detection confidence (0-1)
const MIN_FACE_CONFIDENCE = 0.5

// Maximum time (ms) for the entire compareFaces operation
const VERIFICATION_TIMEOUT_MS = 20000

// Target size for image downsizing before face detection
const DETECTION_IMAGE_SIZE = 320

// State
let modelsLoaded = false
let modelsLoading: Promise<boolean> | null = null
let faceApi: typeof import('face-api.js') | null = null

// Cache profile descriptor
let cachedProfileUrl: string | null = null
let cachedProfileDescriptor: Float32Array | null = null

/**
 * Load face detection models with retry logic
 * Returns a shared promise so multiple callers don't trigger parallel loads
 */
async function loadModels(retryCount = 0): Promise<boolean> {
    const MAX_RETRIES = 2

    if (modelsLoaded && faceApi) return true
    if (modelsLoading) return modelsLoading

    modelsLoading = (async () => {
        try {
            if (!faceApi) {
                faceApi = await import('face-api.js')
            }

            const MODEL_URL = '/models'
            const loadPromises: Promise<void>[] = []

            if (!faceApi.nets.ssdMobilenetv1.isLoaded) {
                loadPromises.push(faceApi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL))
            }
            if (!faceApi.nets.faceLandmark68Net.isLoaded) {
                loadPromises.push(faceApi.nets.faceLandmark68Net.loadFromUri(MODEL_URL))
            }
            if (!faceApi.nets.faceRecognitionNet.isLoaded) {
                loadPromises.push(faceApi.nets.faceRecognitionNet.loadFromUri(MODEL_URL))
            }

            if (loadPromises.length > 0) {
                await Promise.all(loadPromises)
            }

            modelsLoaded = true
            modelsLoading = null
            return true
        } catch (error) {
            console.error(`Failed to load face models (attempt ${retryCount + 1}):`, error)
            modelsLoading = null

            if (retryCount < MAX_RETRIES) {
                const delay = Math.pow(2, retryCount) * 500
                await new Promise(resolve => setTimeout(resolve, delay))
                return loadModels(retryCount + 1)
            }

            return false
        }
    })()

    return modelsLoading
}

/**
 * Create a timeout-wrapped promise
 */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            reject(new Error(`TIMEOUT: ${label} exceeded ${ms}ms`))
        }, ms)

        promise.then(
            (value) => { clearTimeout(timer); resolve(value) },
            (error) => { clearTimeout(timer); reject(error) }
        )
    })
}

/**
 * Load image and resize to target size for faster face detection
 * Returns a canvas element at the target size
 */
function loadAndResizeImage(src: string, targetSize: number): Promise<HTMLCanvasElement> {
    return new Promise((resolve, reject) => {
        const img = new Image()
        img.crossOrigin = 'anonymous'

        img.onload = () => {
            const canvas = document.createElement('canvas')
            canvas.width = targetSize
            canvas.height = targetSize
            const ctx = canvas.getContext('2d')
            if (!ctx) {
                reject(new Error('Could not get canvas context'))
                return
            }

            // Draw image into target-sized canvas (preserves aspect, crops to square center)
            const w = img.naturalWidth
            const h = img.naturalHeight
            const size = Math.min(w, h)
            const sx = (w - size) / 2
            const sy = (h - size) / 2

            ctx.drawImage(img, sx, sy, size, size, 0, 0, targetSize, targetSize)
            resolve(canvas)
        }

        img.onerror = () => reject(new Error('Failed to load image'))
        img.src = src
    })
}

/**
 * Detect single face and get descriptor from a resized canvas
 */
async function detectFace(
    canvas: HTMLCanvasElement,
    label: string,
    log: (msg: string) => void
): Promise<{ descriptor: Float32Array; score: number } | null> {
    if (!faceApi) return null

    const options = new faceApi.SsdMobilenetv1Options({ minConfidence: MIN_FACE_CONFIDENCE })

    // Use detectSingleFace — much faster than detectAllFaces on mobile
    const detection = await faceApi
        .detectSingleFace(canvas, options)
        .withFaceLandmarks()
        .withFaceDescriptor()

    if (!detection) {
        log(`⚠️ No human face detected in ${label}`)
        return null
    }

    log(`✅ ${label} face detected (confidence: ${(detection.detection.score * 100).toFixed(0)}%)`)

    return {
        descriptor: detection.descriptor,
        score: detection.detection.score,
    }
}

/**
 * Calculate Euclidean distance between two face descriptors
 */
function calculateDistance(d1: Float32Array, d2: Float32Array): number {
    let sum = 0
    for (let i = 0; i < d1.length; i++) {
        const diff = d1[i] - d2[i]
        sum += diff * diff
    }
    return Math.sqrt(sum)
}

/**
 * Convert distance to similarity score (0-1)
 */
function distanceToSimilarity(distance: number): number {
    return Math.max(0, Math.min(1, 1 - (distance / 1.0)))
}

export const FaceVerificationService = {
    /**
     * Preload models (call when camera opens)
     */
    async initialize(): Promise<boolean> {
        return loadModels()
    },

    /**
     * Check if models are loaded
     */
    isReady(): boolean {
        return modelsLoaded && faceApi !== null
    },

    /**
     * Clear cached profile descriptor
     */
    clearCache(): void {
        cachedProfileUrl = null
        cachedProfileDescriptor = null
    },

    /**
     * Pre-compute and cache the profile face descriptor
     * Call while camera is streaming for zero-delay after capture
     */
    async preloadProfileDescriptor(
        profileImageUrl: string,
        log?: (msg: string) => void
    ): Promise<boolean> {
        const logFn = log || (() => { })

        if (cachedProfileUrl === profileImageUrl && cachedProfileDescriptor) {
            logFn('📋 Profile descriptor already cached')
            return true
        }

        try {
            await loadModels()
            if (!faceApi) return false

            const canvas = await loadAndResizeImage(profileImageUrl, DETECTION_IMAGE_SIZE)
            logFn(`📷 Profile image resized to ${DETECTION_IMAGE_SIZE}px`)

            const result = await detectFace(canvas, 'Profile', logFn)
            if (result) {
                cachedProfileUrl = profileImageUrl
                cachedProfileDescriptor = result.descriptor
                logFn('✅ Profile descriptor cached')
                return true
            }
            return false
        } catch {
            return false
        }
    },

    /**
     * Compare a live selfie against the saved profile photo
     * Wrapped in a timeout to prevent infinite hang on mobile
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

        // Wrap the entire operation in a timeout
        try {
            return await withTimeout(
                this._doCompare(selfieDataUrl, profileImageUrl, log, debugLog),
                VERIFICATION_TIMEOUT_MS,
                'Face verification'
            )
        } catch (error) {
            if (error instanceof Error && error.message.startsWith('TIMEOUT:')) {
                log(`⏱️ ${error.message}`)
                return {
                    matched: false,
                    similarity: 0,
                    method: 'face-api',
                    debugLog,
                    error: 'Verification timed out. Please try again with better lighting.',
                }
            }
            log(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
            return {
                matched: false,
                similarity: 0,
                method: 'face-api',
                debugLog,
                error: 'Face verification failed. Please try again.',
            }
        }
    },

    /**
     * Internal: actual comparison logic (called within timeout wrapper)
     */
    async _doCompare(
        selfieDataUrl: string,
        profileImageUrl: string,
        log: (msg: string) => void,
        debugLog: string[]
    ): Promise<FaceVerificationResult> {
        const startTime = performance.now()
        log('🚀 Starting face verification...')

        // 1. Ensure models loaded
        if (!modelsLoaded) {
            log('📦 Loading AI models...')
            const loaded = await loadModels()
            if (!loaded) {
                return {
                    matched: false,
                    similarity: 0,
                    method: 'face-api',
                    debugLog,
                    error: 'Failed to load face detection models. Please refresh and try again.',
                }
            }
            log(`✅ Models loaded (${(performance.now() - startTime).toFixed(0)}ms)`)
        } else {
            log('✅ Models already loaded')
        }

        // 2. Get profile descriptor (cached or compute)
        let profileDescriptor: Float32Array
        if (cachedProfileUrl === profileImageUrl && cachedProfileDescriptor) {
            profileDescriptor = cachedProfileDescriptor
            log('📋 Using cached profile descriptor')
        } else {
            log('📷 Analyzing profile photo...')
            const profileCanvas = await loadAndResizeImage(profileImageUrl, DETECTION_IMAGE_SIZE)
            log(`📐 Profile resized to ${DETECTION_IMAGE_SIZE}px (${(performance.now() - startTime).toFixed(0)}ms)`)

            const profileResult = await detectFace(profileCanvas, 'Profile', log)
            if (!profileResult) {
                return {
                    matched: false,
                    similarity: 0,
                    method: 'face-api',
                    debugLog,
                    error: 'Could not detect face in profile picture. Please update your profile photo.',
                }
            }
            profileDescriptor = profileResult.descriptor
            cachedProfileUrl = profileImageUrl
            cachedProfileDescriptor = profileDescriptor
            log(`✅ Profile analyzed (${(performance.now() - startTime).toFixed(0)}ms)`)
        }

        // 3. Analyze selfie (resize first for speed)
        log('📷 Analyzing selfie...')
        const selfieCanvas = await loadAndResizeImage(selfieDataUrl, DETECTION_IMAGE_SIZE)
        log(`📐 Selfie resized to ${DETECTION_IMAGE_SIZE}px (${(performance.now() - startTime).toFixed(0)}ms)`)

        const selfieResult = await detectFace(selfieCanvas, 'Selfie', log)

        if (!selfieResult) {
            return {
                matched: false,
                similarity: 0,
                method: 'face-api',
                debugLog,
                error: 'No human face detected in your selfie. Please retake with your face clearly visible.',
            }
        }

        // 4. Calculate match
        const distance = calculateDistance(selfieResult.descriptor, profileDescriptor)
        const similarity = distanceToSimilarity(distance)

        log(`📊 Distance: ${distance.toFixed(4)}, Similarity: ${(similarity * 100).toFixed(1)}%`)
        log(`📊 Threshold: distance < ${DISTANCE_THRESHOLD} (similarity > ${((1 - DISTANCE_THRESHOLD) * 100).toFixed(0)}%)`)

        const matched = distance < DISTANCE_THRESHOLD
        const totalTime = performance.now() - startTime
        log(`⏱️ Total: ${totalTime.toFixed(0)}ms`)
        log(matched ? '✅ MATCH — Face verified!' : '❌ NO MATCH — Different person')

        return {
            matched,
            similarity,
            method: 'face-api',
            debugLog,
            error: matched ? undefined : `Face does not match profile photo (${(similarity * 100).toFixed(0)}% similarity). Please ensure you are the account holder.`,
        }
    },

    /**
     * Get the match threshold as similarity percentage
     */
    getThreshold(): number {
        return 1 - DISTANCE_THRESHOLD
    },

    /**
     * Format similarity as percentage string
     */
    formatSimilarity(similarity: number): string {
        return `${(similarity * 100).toFixed(0)}%`
    },
}

export default FaceVerificationService
