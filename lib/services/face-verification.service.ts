/**
 * Face Verification Service
 * Client-side face comparison using face-api.js
 * 
 * Optimized for mobile PWA:
 * - Models preloaded in parallel with camera init
 * - Profile descriptor cached for reuse
 * - Single-face + confidence guards
 * - Only human faces pass verification
 */

// Types for face-api.js (to avoid import issues in SSR)
export interface FaceVerificationResult {
    matched: boolean
    similarity: number
    method: 'face-api'
    debugLog: string[]
    error?: string
}

// Threshold for face match — Euclidean distance
// face-api.js uses distance where 0.6 = standard same-person threshold
// 0.5 is stricter (more accurate), 0.6 is more forgiving
const DISTANCE_THRESHOLD = 0.55

// Minimum face detection confidence score (0-1)
const MIN_FACE_CONFIDENCE = 0.5

// Flag to track model loading
let modelsLoaded = false
let modelsLoading: Promise<boolean> | null = null
let faceApi: typeof import('face-api.js') | null = null

// Cache profile descriptor to avoid recomputing
let cachedProfileUrl: string | null = null
let cachedProfileDescriptor: Float32Array | null = null

/**
 * Load face detection models with retry logic for mobile browsers
 * Returns a shared promise so multiple callers don't trigger parallel loads
 */
async function loadModels(retryCount = 0): Promise<boolean> {
    const MAX_RETRIES = 2

    if (modelsLoaded && faceApi) return true

    // If already loading, return the existing promise
    if (modelsLoading) return modelsLoading

    modelsLoading = (async () => {
        try {
            // Dynamic import to avoid SSR issues
            if (!faceApi) {
                faceApi = await import('face-api.js')
            }

            // Only load models that aren't already loaded
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
            console.error(`Failed to load face detection models (attempt ${retryCount + 1}):`, error)
            modelsLoading = null

            // Retry with exponential backoff for mobile network issues
            if (retryCount < MAX_RETRIES) {
                const delay = Math.pow(2, retryCount) * 500 // 500ms, 1s
                await new Promise(resolve => setTimeout(resolve, delay))
                return loadModels(retryCount + 1)
            }

            return false
        }
    })()

    return modelsLoading
}

/**
 * Create image element from data URL or URL
 */
function createImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image()
        img.crossOrigin = 'anonymous'
        img.onload = () => resolve(img)
        img.onerror = () => reject(new Error('Failed to load image'))
        img.src = src
    })
}

/**
 * Detect face and get descriptor from image
 * Returns null if no face detected, throws if multiple faces
 */
async function getFaceDescriptor(
    imageSource: string,
    label: string,
    log: (msg: string) => void
): Promise<{ descriptor: Float32Array; score: number } | null> {
    if (!faceApi) {
        const loaded = await loadModels()
        if (!loaded || !faceApi) return null
    }

    const img = await createImage(imageSource)
    log(`📷 ${label} image loaded (${img.naturalWidth}x${img.naturalHeight})`)

    const options = new faceApi.SsdMobilenetv1Options({ minConfidence: MIN_FACE_CONFIDENCE })

    // Detect ALL faces to check for multi-face
    const allDetections = await faceApi.detectAllFaces(img, options)
        .withFaceLandmarks()
        .withFaceDescriptors()

    if (allDetections.length === 0) {
        log(`⚠️ No human face detected in ${label}`)
        return null
    }

    if (allDetections.length > 1 && label === 'Selfie') {
        log(`⚠️ Multiple faces (${allDetections.length}) detected in ${label}`)
        throw new Error(`MULTI_FACE:${allDetections.length}`)
    }

    // Use the detection with highest confidence
    const best = allDetections.reduce((a, b) =>
        a.detection.score > b.detection.score ? a : b
    )

    log(`✅ ${label} face detected (confidence: ${(best.detection.score * 100).toFixed(0)}%)`)

    return {
        descriptor: best.descriptor,
        score: best.detection.score,
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
 * face-api.js Euclidean distance: 0 = identical, 0.6 = typical threshold
 */
function distanceToSimilarity(distance: number): number {
    return Math.max(0, Math.min(1, 1 - (distance / 1.0)))
}

export const FaceVerificationService = {
    /**
     * Preload models (call early, e.g., when camera opens)
     * This runs in the background so verification is instant after capture
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
     * Clear cached profile descriptor (call when profile photo changes)
     */
    clearCache(): void {
        cachedProfileUrl = null
        cachedProfileDescriptor = null
    },

    /**
     * Pre-compute and cache the profile descriptor
     * Call this while camera is still streaming for zero-delay on capture
     */
    async preloadProfileDescriptor(
        profileImageUrl: string,
        log?: (msg: string) => void
    ): Promise<boolean> {
        const logFn = log || (() => { })

        // Already cached for this URL
        if (cachedProfileUrl === profileImageUrl && cachedProfileDescriptor) {
            logFn('📋 Profile descriptor already cached')
            return true
        }

        try {
            await loadModels()
            const result = await getFaceDescriptor(profileImageUrl, 'Profile', logFn)
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
     * 
     * Guards:
     * 1. No face in selfie → reject ("No face detected")
     * 2. Multiple faces in selfie → reject ("Multiple faces")
     * 3. No face in profile → reject ("Update profile photo")  
     * 4. Low confidence detection → reject
     * 5. Distance > threshold → reject ("Face doesn't match")
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

        const startTime = performance.now()

        try {
            log('🚀 Starting face verification (face-api.js)...')

            // Ensure models are loaded (usually already loaded from preload)
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

            // Get profile descriptor (use cache if available)
            let profileDescriptor: Float32Array
            if (cachedProfileUrl === profileImageUrl && cachedProfileDescriptor) {
                profileDescriptor = cachedProfileDescriptor
                log('📋 Using cached profile descriptor')
            } else {
                log('📷 Analyzing profile photo...')
                const profileResult = await getFaceDescriptor(profileImageUrl, 'Profile', log)
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
                // Cache for next time
                cachedProfileUrl = profileImageUrl
                cachedProfileDescriptor = profileDescriptor
            }

            // Get selfie descriptor (with multi-face check)
            log('📷 Analyzing selfie...')
            let selfieResult: { descriptor: Float32Array; score: number } | null

            try {
                selfieResult = await getFaceDescriptor(selfieDataUrl, 'Selfie', log)
            } catch (error) {
                if (error instanceof Error && error.message.startsWith('MULTI_FACE:')) {
                    const count = error.message.split(':')[1]
                    return {
                        matched: false,
                        similarity: 0,
                        method: 'face-api',
                        debugLog,
                        error: `Multiple faces (${count}) detected. Only your face should be visible.`,
                    }
                }
                throw error
            }

            if (!selfieResult) {
                return {
                    matched: false,
                    similarity: 0,
                    method: 'face-api',
                    debugLog,
                    error: 'No human face detected in your selfie. Please retake with your face clearly visible.',
                }
            }

            // Calculate match
            const distance = calculateDistance(selfieResult.descriptor, profileDescriptor)
            const similarity = distanceToSimilarity(distance)

            log(`📊 Distance: ${distance.toFixed(4)}, Similarity: ${(similarity * 100).toFixed(1)}%`)
            log(`📊 Threshold: distance < ${DISTANCE_THRESHOLD} (similarity > ${((1 - DISTANCE_THRESHOLD) * 100).toFixed(0)}%)`)

            const matched = distance < DISTANCE_THRESHOLD
            const totalTime = performance.now() - startTime
            log(`⏱️ Total time: ${totalTime.toFixed(0)}ms`)
            log(matched ? '✅ MATCH — Face verified!' : '❌ NO MATCH — Different person')

            return {
                matched,
                similarity,
                method: 'face-api',
                debugLog,
                error: matched ? undefined : `Face does not match profile photo (${(similarity * 100).toFixed(0)}% similarity). Please ensure you are the account holder.`,
            }
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error'
            log(`❌ Error: ${errorMsg}`)
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
