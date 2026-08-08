/**
 * Web Worker for Off-Main-Thread Face Embedding Extraction
 * Runs face-api.js neural network inference inside a background Web Worker thread
 * so the main React UI thread NEVER freezes, stutters, or lags during attendance scans.
 */

// Load face-api.js inside Web Worker context
importScripts('/js/face-api.min.js');

let modelsLoaded = false;

self.onmessage = async (e) => {
  const { type, payload } = e.data;

  try {
    if (type === 'LOAD_MODELS') {
      const MODEL_URL = payload.modelUrl || '/models';

      if (!self.faceapi) {
        throw new Error('face-api.js script not available in Web Worker');
      }

      const faceapi = self.faceapi;

      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
      ]);

      modelsLoaded = true;
      self.postMessage({ type: 'MODELS_LOADED', success: true });
      return;
    }

    if (type === 'EXTRACT_EMBEDDING') {
      if (!modelsLoaded) {
        throw new Error('Face-api models not loaded in Web Worker yet');
      }

      const { imageBitmap, options } = payload;
      const faceapi = self.faceapi;

      // Create OffscreenCanvas (zero-copy GPU buffer in Web Worker)
      let processInput = imageBitmap;
      let canvas = null;

      // 640px aspect-ratio preserved scaling inside Web Worker
      const srcW = imageBitmap.width;
      const srcH = imageBitmap.height;

      if (srcW > 640 || srcH > 640) {
        const scale = Math.min(640 / srcW, 640 / srcH);
        const targetW = Math.round(srcW * scale);
        const targetH = Math.round(srcH * scale);

        canvas = new OffscreenCanvas(targetW, targetH);
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(imageBitmap, 0, 0, targetW, targetH);
          processInput = canvas;
        }
      } else {
        canvas = new OffscreenCanvas(srcW, srcH);
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(imageBitmap, 0, 0);
          processInput = canvas;
        }
      }

      const detectorOptions = new faceapi.TinyFaceDetectorOptions({
        inputSize: options?.inputSize || 160,
        scoreThreshold: options?.scoreThreshold || 0.4,
      });

      const detection = await faceapi
        .detectSingleFace(processInput, detectorOptions)
        .withFaceLandmarks()
        .withFaceDescriptor();

      // Cleanup bitmap memory
      if (imageBitmap && typeof imageBitmap.close === 'function') {
        imageBitmap.close();
      }

      if (!detection) {
        self.postMessage({
          type: 'EXTRACT_RESULT',
          success: false,
          error: 'No face detected',
        });
        return;
      }

      // Convert Float32Array to standard array for structured clone transfer
      const descriptor = Array.from(detection.descriptor);

      self.postMessage({
        type: 'EXTRACT_RESULT',
        success: true,
        descriptor,
        score: detection.detection.score,
      });
    }
  } catch (err) {
    self.postMessage({
      type: 'ERROR',
      error: err.message || 'Unknown error in Web Worker',
    });
  }
};
