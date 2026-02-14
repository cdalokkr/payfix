/**
 * Type declarations for face-api.js
 * This is a stub declaration - the actual types come with the package when installed
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

    export function detectSingleFace(
        input: HTMLImageElement | HTMLCanvasElement | HTMLVideoElement,
        options?: SsdMobilenetv1Options
    ): DetectionTask

    export function detectAllFaces(
        input: HTMLImageElement | HTMLCanvasElement | HTMLVideoElement,
        options?: SsdMobilenetv1Options
    ): DetectionAllTask

    interface DetectionTask {
        withFaceLandmarks(): LandmarksTask
    }

    interface DetectionAllTask {
        withFaceLandmarks(): LandmarksAllTask
    }

    interface LandmarksTask {
        withFaceDescriptor(): Promise<FaceDetectionResult | undefined>
    }

    interface LandmarksAllTask {
        withFaceDescriptors(): Promise<FaceDetectionResult[]>
    }

    interface FaceDetectionResult {
        detection: {
            score: number
            box: {
                x: number
                y: number
                width: number
                height: number
            }
        }
        descriptor: Float32Array
    }
}
