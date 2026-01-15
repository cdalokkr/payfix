/**
 * Type declarations for face-api.js
 * This is a stub declaration - the actual types come with the package when installed
 */

declare module 'face-api.js' {
    export const nets: {
        ssdMobilenetv1: {
            loadFromUri(url: string): Promise<void>
        }
        faceLandmark68Net: {
            loadFromUri(url: string): Promise<void>
        }
        faceRecognitionNet: {
            loadFromUri(url: string): Promise<void>
        }
    }

    export function detectSingleFace(
        input: HTMLImageElement | HTMLCanvasElement | HTMLVideoElement
    ): DetectionTask

    interface DetectionTask {
        withFaceLandmarks(): LandmarksTask
    }

    interface LandmarksTask {
        withFaceDescriptor(): Promise<FaceDetectionResult | undefined>
    }

    interface FaceDetectionResult {
        descriptor: Float32Array
    }
}
