/**
 * Face Verification Service
 * Client-side face comparison using face-api.js
 * 
 * Note: This service requires face-api.js to be installed:
 * npm install face-api.js
 * 
 * Models must be served from /models directory in public folder
 */

// Types for face-api.js (to avoid import issues in SSR)
interface FaceApiResult {
    matched: boolean
    similarity: number
    error?: string
}

// Threshold for face match (90%)
const MATCH_THRESHOLD = 0.90

// Flag to track model loading
let modelsLoaded = false
let faceApi: typeof import('face-api.js') | null = null

/**
 * Load face detection models
 */
async function loadModels(): Promise<boolean> {
    if (modelsLoaded && faceApi) return true

    try {
        // Dynamic import to avoid SSR issues
        faceApi = await import('face-api.js')

        // Load models from public directory
        const MODEL_URL = '/models'

        await Promise.all([
            faceApi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
            faceApi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
            faceApi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        ])

        modelsLoaded = true
        console.log('Face detection models loaded')
        return true
    } catch (error) {
        console.error('Failed to load face detection models:', error)
        return false
    }
}

/**
 * Create image element from data URL
 */
function createImageFromDataUrl(dataUrl: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image()
        img.onload = () => resolve(img)
        img.onerror = reject
        img.src = dataUrl
    })
}

/**
 * Get face descriptor from image
 */
async function getFaceDescriptor(imageSource: HTMLImageElement | string): Promise<Float32Array | null> {
    if (!faceApi) {
        const loaded = await loadModels()
        if (!loaded || !faceApi) return null
    }

    try {
        let img: HTMLImageElement

        if (typeof imageSource === 'string') {
            // It's a URL or data URL
            img = await createImageFromDataUrl(imageSource)
        } else {
            img = imageSource
        }

        // Detect face and get descriptor
        const detection = await faceApi
            .detectSingleFace(img)
            .withFaceLandmarks()
            .withFaceDescriptor()

        if (!detection) {
            console.log('No face detected in image')
            return null
        }

        return detection.descriptor
    } catch (error) {
        console.error('Error getting face descriptor:', error)
        return null
    }
}

/**
 * Calculate Euclidean distance between two face descriptors
 */
function calculateDistance(descriptor1: Float32Array, descriptor2: Float32Array): number {
    if (descriptor1.length !== descriptor2.length) {
        throw new Error('Descriptor lengths do not match')
    }

    let sum = 0
    for (let i = 0; i < descriptor1.length; i++) {
        const diff = descriptor1[i] - descriptor2[i]
        sum += diff * diff
    }
    return Math.sqrt(sum)
}

/**
 * Convert distance to similarity score (0-1)
 * face-api.js uses Euclidean distance where:
 * - 0 = identical
 * - 0.6 = same person threshold
 * - > 0.6 = different person
 */
function distanceToSimilarity(distance: number): number {
    // Convert distance to similarity (lower distance = higher similarity)
    // Using a sigmoid-like function for better distribution
    return Math.max(0, Math.min(1, 1 - (distance / 1.2)))
}

export const FaceVerificationService = {
    /**
     * Initialize the service (preload models)
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
     * Compare two faces
     * @param selfieDataUrl - Data URL of the captured selfie
     * @param profileImageUrl - URL of the profile picture
     * @returns Match result with similarity score
     */
    async compareFaces(
        selfieDataUrl: string,
        profileImageUrl: string
    ): Promise<FaceApiResult> {
        try {
            // Ensure models are loaded
            if (!modelsLoaded) {
                const loaded = await loadModels()
                if (!loaded) {
                    return {
                        matched: false,
                        similarity: 0,
                        error: 'Failed to load face detection models. Please refresh and try again.',
                    }
                }
            }

            // Get descriptors for both faces
            const [selfieDescriptor, profileDescriptor] = await Promise.all([
                getFaceDescriptor(selfieDataUrl),
                getFaceDescriptor(profileImageUrl),
            ])

            // Check if faces were detected
            if (!selfieDescriptor) {
                return {
                    matched: false,
                    similarity: 0,
                    error: 'No face detected in your selfie. Please retake with your face clearly visible.',
                }
            }

            if (!profileDescriptor) {
                return {
                    matched: false,
                    similarity: 0,
                    error: 'Could not detect face in profile picture. Please update your profile photo.',
                }
            }

            // Calculate similarity
            const distance = calculateDistance(selfieDescriptor, profileDescriptor)
            const similarity = distanceToSimilarity(distance)

            console.log(`Face comparison - Distance: ${distance.toFixed(4)}, Similarity: ${(similarity * 100).toFixed(1)}%`)

            // Check against threshold
            const matched = similarity >= MATCH_THRESHOLD

            return {
                matched,
                similarity,
                error: matched ? undefined : `Face match too low (${(similarity * 100).toFixed(0)}%). Minimum required: ${MATCH_THRESHOLD * 100}%`,
            }
        } catch (error) {
            console.error('Face comparison error:', error)
            return {
                matched: false,
                similarity: 0,
                error: 'Face verification failed. Please try again.',
            }
        }
    },

    /**
     * Get the match threshold
     */
    getThreshold(): number {
        return MATCH_THRESHOLD
    },

    /**
     * Format similarity as percentage string
     */
    formatSimilarity(similarity: number): string {
        return `${(similarity * 100).toFixed(0)}%`
    },
}

export default FaceVerificationService
