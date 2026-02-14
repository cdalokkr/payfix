/**
 * Type declarations for face-api.js
 * Covers detection-only usage (no landmarks/descriptors needed for hybrid approach)
 */

declare module 'face-api.js' {
    export class SsdMobilenetv1Options {
        constructor(options?: { minConfidence?: number })
    }

    export const nets: {
        ssdMobilenetv1: {
            loadFromUri(url: string): Promise<void>
            isLoaded: boolean
        }
        faceLandmark68Net: {
            loadFromUri(url: string): Promise<void>
            isLoaded: boolean
        }
        faceRecognitionNet: {
            loadFromUri(url: string): Promise<void>
            isLoaded: boolean
        }
    }

    interface FaceDetection {
        score: number
        box: {
            x: number
            y: number
            width: number
            height: number
        }
    }

    // detectSingleFace returns a task that is also a thenable (Promise-like)
    // When awaited directly (without chaining), it resolves to FaceDetection | undefined
    interface DetectionTask extends Promise<FaceDetection | undefined> {
        withFaceLandmarks(): LandmarksTask
    }

    interface DetectionAllTask extends Promise<FaceDetection[]> {
        withFaceLandmarks(): LandmarksAllTask
    }

    interface LandmarksTask {
        withFaceDescriptor(): Promise<FaceDetectionResult | undefined>
    }

    interface LandmarksAllTask {
        withFaceDescriptors(): Promise<FaceDetectionResult[]>
    }

    interface FaceDetectionResult {
        detection: FaceDetection
        descriptor: Float32Array
    }

    export function detectSingleFace(
        input: HTMLImageElement | HTMLCanvasElement | HTMLVideoElement,
        options?: SsdMobilenetv1Options
    ): DetectionTask

    export function detectAllFaces(
        input: HTMLImageElement | HTMLCanvasElement | HTMLVideoElement,
        options?: SsdMobilenetv1Options
    ): DetectionAllTask
}
