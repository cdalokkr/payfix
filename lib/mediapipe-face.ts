/**
 * MediaPipe Face Detector Helper (Google BlazeFace GPU Delegate)
 * Provides ultra-fast <10ms face detection and bounding box cropping
 * for hybrid high-performance attendance verification.
 */

import {
  FaceDetector,
  FilesetResolver,
  Detection,
} from '@mediapipe/tasks-vision';

let faceDetector: FaceDetector | null = null;
let initPromise: Promise<FaceDetector | null> | null = null;

export async function initMediaPipeFaceDetector(): Promise<FaceDetector | null> {
  if (typeof window === 'undefined') return null;
  if (faceDetector) return faceDetector;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
      );

      faceDetector = await FaceDetector.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite`,
          delegate: 'GPU',
        },
        runningMode: 'VIDEO',
        minDetectionConfidence: 0.5,
      });

      console.log('[MediaPipe] BlazeFace GPU FaceDetector initialized successfully.');
      return faceDetector;
    } catch (err) {
      console.warn('[MediaPipe] GPU FaceDetector init warning (falling back to CPU/face-api):', err);
      initPromise = null;
      return null;
    }
  })();

  return initPromise;
}

export async function detectFaceFromVideo(
  video: HTMLVideoElement
): Promise<Detection | null> {
  try {
    const detector = await initMediaPipeFaceDetector();
    if (!detector) return null;

    const result = detector.detectForVideo(video, performance.now());
    return result.detections?.[0] || null;
  } catch (err) {
    console.warn('[MediaPipe] detectForVideo warning:', err);
    return null;
  }
}
