/**
 * FaceApiBrowserService — Shared Singleton for face-api.js browser integration
 *
 * Loads face-api.js models once from /public/models/ (cached by browser after first load).
 * Provides face detection, landmark alignment, and 128-d descriptor extraction.
 *
 * Used by:
 *  - Kiosk Terminal (live webcam frame matching)
 *  - PWA Mobile (selfie vs profile photo comparison)
 *  - Profile Photo Capture (enrollment — extract & save face vector to DB)
 */

// Extend window type for face-api loaded via script tag
declare global {
    interface Window {
        faceapi: any
    }
}

const MODELS_PATH = '/models'

let _modelsLoaded = false
let _loadingPromise: Promise<boolean> | null = null

/**
 * Loads face-api.js script from /public/js/face-api.min.js if not already loaded,
 * then loads the required neural network models from /public/models/.
 */
async function loadScript(): Promise<void> {
    if (typeof window === 'undefined') return

    if (window.faceapi) return

    return new Promise((resolve, reject) => {
        const existingScript = document.querySelector('script[data-faceapi]')
        if (existingScript) {
            // Already injected — wait for it
            const check = setInterval(() => {
                if (window.faceapi) {
                    clearInterval(check)
                    resolve()
                }
            }, 100)
            setTimeout(() => { clearInterval(check); resolve() }, 8000)
            return
        }

        const script = document.createElement('script')
        script.src = '/js/face-api.min.js'
        script.setAttribute('data-faceapi', 'true')
        script.async = true
        script.onload = () => resolve()
        script.onerror = () => reject(new Error('Failed to load face-api.min.js from /public/js/'))
        document.head.appendChild(script)
    })
}

let _scaledCanvas: HTMLCanvasElement | null = null;

export const FaceApiBrowserService = {
    isReady(): boolean {
        return _modelsLoaded
    },

    /**
     * Load face-api.js script and all required models (singleton — safe to call multiple times).
     * @param onProgress Optional callback for loading progress (0-100)
     */
    async loadModels(onProgress?: (pct: number, msg: string) => void): Promise<boolean> {
        if (_modelsLoaded) return true

        // Prevent duplicate parallel loading
        if (_loadingPromise) return _loadingPromise

        _loadingPromise = (async () => {
            try {
                onProgress?.(5, 'Loading face-api.js...')
                await loadScript()

                if (!window.faceapi) {
                    throw new Error('face-api.js failed to initialize')
                }

                const faceapi = window.faceapi

                onProgress?.(20, 'Loading face detector...')
                await faceapi.nets.tinyFaceDetector.loadFromUri(MODELS_PATH)

                onProgress?.(50, 'Loading face landmarks...')
                await faceapi.nets.faceLandmark68Net.loadFromUri(MODELS_PATH)

                onProgress?.(80, 'Loading face recognition...')
                await faceapi.nets.faceRecognitionNet.loadFromUri(MODELS_PATH)

                onProgress?.(100, 'Models ready!')
                _modelsLoaded = true
                return true
            } catch (err) {
                _loadingPromise = null
                console.error('[FaceApiBrowserService] Model loading failed:', err)
                return false
            }
        })()

        return _loadingPromise
    },

    /**
     * Extract 128-d face descriptor from an HTMLImageElement, HTMLVideoElement, or HTMLCanvasElement.
     * Automatically resizes large inputs to 640px maintaining aspect ratio for 4x faster tensor extraction.
     * Uses inputSize 160 consistently across both Enrollment and Verification for 100% vector alignment.
     */
    async extractDescriptor(
        input: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement,
        onLog?: (msg: string) => void
    ): Promise<Float32Array | null> {
        if (!_modelsLoaded || !window.faceapi) {
            onLog?.('Models not loaded. Call loadModels() first.')
            return null
        }

        try {
            const faceapi = window.faceapi

            // 1. Aspect-ratio preserving 640px scaling for ultra-fast vector extraction
            let processInput: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement = input;
            const srcWidth = (input as HTMLVideoElement).videoWidth || (input as HTMLImageElement | HTMLCanvasElement).width || 0;
            const srcHeight = (input as HTMLVideoElement).videoHeight || (input as HTMLImageElement | HTMLCanvasElement).height || 0;

            if (srcWidth > 640 || srcHeight > 640) {
                const scale = Math.min(640 / srcWidth, 640 / srcHeight);
                const targetW = Math.round(srcWidth * scale);
                const targetH = Math.round(srcHeight * scale);

                if (typeof document !== 'undefined') {
                    if (!_scaledCanvas) _scaledCanvas = document.createElement('canvas');
                    _scaledCanvas.width = targetW;
                    _scaledCanvas.height = targetH;
                    const ctx = _scaledCanvas.getContext('2d');
                    if (ctx) {
                        ctx.drawImage(input, 0, 0, targetW, targetH);
                        processInput = _scaledCanvas;
                    }
                }
            }

            // 2. inputSize: 160 — 4x faster neural pass, aligned across enrollment & scanning
            const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 160, scoreThreshold: 0.4 })

            const detection = await faceapi
                .detectSingleFace(processInput, options)
                .withFaceLandmarks()
                .withFaceDescriptor()

            if (!detection) {
                onLog?.('No face detected in the image/frame.')
                return null
            }

            onLog?.(`Face detected (confidence: ${(detection.detection.score * 100).toFixed(1)}%)`)
            return detection.descriptor as Float32Array
        } catch (err) {
            onLog?.(`Descriptor extraction error: ${err}`)
            return null
        }
    },

    /**
     * Client-side Quality Gate: Checks brightness & contrast before running heavy AI passes.
     * Rejects dark or unlit frames in <2ms.
     */
    checkFrameQuality(canvas: HTMLCanvasElement): { acceptable: boolean; luminance: number } {
        try {
            const ctx = canvas.getContext('2d');
            if (!ctx) return { acceptable: true, luminance: 128 };
            const imageData = ctx.getImageData(0, 0, Math.min(100, canvas.width), Math.min(100, canvas.height));
            const data = imageData.data;
            let sum = 0;
            for (let i = 0; i < data.length; i += 16) {
                sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
            }
            const avgLuminance = sum / (data.length / 16);
            return { acceptable: avgLuminance >= 25, luminance: avgLuminance };
        } catch {
            return { acceptable: true, luminance: 128 };
        }
    },



    /**
     * Extract 128-d descriptor from a base64 data URL string.
     * Creates a temporary off-screen HTMLImageElement for processing.
     */
    async extractDescriptorFromDataUrl(
        dataUrl: string,
        onLog?: (msg: string) => void
    ): Promise<Float32Array | null> {
        if (!_modelsLoaded || !window.faceapi) {
            onLog?.('Models not loaded.')
            return null
        }

        return new Promise((resolve) => {
            const img = new Image()
            img.crossOrigin = 'anonymous'
            img.onload = async () => {
                const descriptor = await FaceApiBrowserService.extractDescriptor(img, onLog)
                resolve(descriptor)
            }
            img.onerror = () => {
                onLog?.('Failed to load image from data URL.')
                resolve(null)
            }
            img.src = dataUrl
        })
    },

    /**
     * Extract descriptor from a remote image URL (avatar_url from Supabase Storage).
     */
    async extractDescriptorFromUrl(
        url: string,
        onLog?: (msg: string) => void
    ): Promise<Float32Array | null> {
        if (!_modelsLoaded || !window.faceapi) {
            onLog?.('Models not loaded.')
            return null
        }

        return new Promise((resolve) => {
            const img = new Image()
            img.crossOrigin = 'anonymous'
            img.onload = async () => {
                const descriptor = await FaceApiBrowserService.extractDescriptor(img, onLog)
                resolve(descriptor)
            }
            img.onerror = () => {
                onLog?.(`Failed to load profile image from URL: ${url}`)
                resolve(null)
            }
            img.src = url
        })
    },

    /**
     * Euclidean distance between two 128-d face descriptors.
     * < 0.6 = same person (standard face-api.js threshold).
     */
    euclideanDistance(d1: Float32Array | number[], d2: Float32Array | number[]): number {
        if (!d1 || !d2 || d1.length !== d2.length) return Infinity
        let sum = 0
        for (let i = 0; i < d1.length; i++) {
            const diff = d1[i] - d2[i]
            sum += diff * diff
        }
        return Math.sqrt(sum)
    },

    /**
     * Compare two images (selfie dataUrl vs profile avatar URL).
     * Returns { matched, similarity, distance, error? }
     */
    async compareImages(
        selfieDataUrl: string,
        profileImageUrl: string,
        threshold = 0.40,
        onLog?: (msg: string) => void
    ): Promise<{ matched: boolean; similarity: number; distance: number; error?: string }> {

        const t0 = performance.now()
        const elapsed = () => `${(performance.now() - t0).toFixed(0)}ms`

        try {
            onLog?.('Extracting selfie face descriptor...')
            const selfieDescriptor = await FaceApiBrowserService.extractDescriptorFromDataUrl(selfieDataUrl, onLog)
            if (!selfieDescriptor) {
                return { matched: false, similarity: 0, distance: 1, error: 'No face detected in selfie. Please retake.' }
            }

            onLog?.('Extracting profile photo face descriptor...')
            const profileDescriptor = await FaceApiBrowserService.extractDescriptorFromUrl(profileImageUrl, onLog)
            if (!profileDescriptor) {
                return { matched: false, similarity: 0, distance: 1, error: 'No face detected in profile photo. Please update your profile picture.' }
            }

            const distance = FaceApiBrowserService.euclideanDistance(selfieDescriptor, profileDescriptor)
            const similarity = Math.max(0, 1 - distance)
            const matched = distance < threshold

            onLog?.(`Distance: ${distance.toFixed(3)} | Similarity: ${(similarity * 100).toFixed(1)}% | ${matched ? '✅ MATCH' : '❌ NO MATCH'} (${elapsed()})`)

            return {
                matched,
                similarity,
                distance,
                error: matched ? undefined : `Face does not match profile photo (${(similarity * 100).toFixed(0)}% similarity, need >${((1 - threshold) * 100).toFixed(0)}%).`
            }
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err)
            onLog?.(`Comparison error: ${msg}`)
            return { matched: false, similarity: 0, distance: 1, error: `Verification error: ${msg}` }
        }
    },

    /** Convert Float32Array descriptor to plain number[] for DB storage */
    descriptorToArray(descriptor: Float32Array): number[] {
        return Array.from(descriptor)
    },

    /** Convert number[] from DB back to Float32Array for comparison */
    arrayToDescriptor(arr: number[]): Float32Array {
        return new Float32Array(arr)
    },
}

export default FaceApiBrowserService
