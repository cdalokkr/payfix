// public/workers/face-embedding.worker.js

importScripts('/js/face-api.min.js');

let modelsLoaded = false;
const MODEL_URL = '/models';

// ======================
// Memory Helpers
// ======================
function l2Normalize(embedding) {
  if (!embedding || embedding.length === 0) return [];
  let norm = 0;
  for (let i = 0; i < embedding.length; i++) {
    norm += embedding[i] * embedding[i];
  }
  norm = Math.sqrt(norm);
  if (norm === 0) return embedding;
  return embedding.map(v => v / norm);
}

function disposeTensor(tensor) {

  if (tensor && typeof tensor.dispose === 'function') {
    try {
      tensor.dispose();
    } catch (e) {}
  }
}

function forceGC() {
  // TensorFlow.js memory cleanup
  if (typeof self.tf !== 'undefined' && self.tf.engine) {
    try {
      const engine = self.tf.engine();
      engine.startScope();
      engine.endScope();
    } catch (e) {}
  }
}

// ======================
// Main Message Handler
// ======================
self.onmessage = async (event) => {
  const { type, payload, id } = event.data;

  try {
    // ---------- LOAD MODELS ----------
    if (type === 'LOAD_MODELS') {
      if (modelsLoaded) {
        self.postMessage({ id, type: 'MODELS_LOADED', success: true });
        return;
      }

      const url = payload?.modelUrl || MODEL_URL;
      const faceapi = self.faceapi;

      if (!faceapi) {
        throw new Error('face-api.js not loaded in worker environment');
      }

      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(url),
        faceapi.nets.faceLandmark68Net.loadFromUri(url),
        faceapi.nets.faceRecognitionNet.loadFromUri(url),
      ]);

      modelsLoaded = true;

      // Warm-up + initial cleanup
      forceGC();

      self.postMessage({ id, type: 'MODELS_LOADED', success: true });
      return;
    }

    // ---------- EXTRACT EMBEDDING ----------
    if (type === 'EXTRACT_EMBEDDING') {
      if (!modelsLoaded) {
        throw new Error('Models not loaded');
      }

      const {
        imageBitmap,
        inputSize = 160,
        scoreThreshold = 0.4,
      } = payload;

      let canvas = null;
      let detection = null;
      const faceapi = self.faceapi;

      try {
        // Create OffscreenCanvas
        canvas = new OffscreenCanvas(imageBitmap.width, imageBitmap.height);
        const ctx = canvas.getContext('2d', {
          alpha: false,           // slightly better performance
          desynchronized: true,   // reduce latency
        });

        if (ctx) {
          ctx.drawImage(imageBitmap, 0, 0);
        }

        // Run detection inside tf scope for auto cleanup
        if (faceapi.tf?.engine) {
          await faceapi.tf.engine().startScope();
        }

        detection = await faceapi
          .detectSingleFace(
            canvas,
            new faceapi.TinyFaceDetectorOptions({
              inputSize,
              scoreThreshold,
            })
          )
          .withFaceLandmarks()
          .withFaceDescriptor();

        if (faceapi.tf?.engine) {
          await faceapi.tf.engine().endScope();
        }

        // Close bitmap ASAP
        if (imageBitmap && typeof imageBitmap.close === 'function') {
          imageBitmap.close();
        }

        if (!detection) {
          self.postMessage({
            id,
            type: 'EXTRACT_RESULT',
            success: false,
            error: 'No face detected',
          });
          return;
        }

        // Convert & L2 normalize descriptor safely
        const descriptor = l2Normalize(Array.from(detection.descriptor));


        self.postMessage({
          id,
          type: 'EXTRACT_RESULT',
          success: true,
          descriptor,
          score: detection.detection.score,
          box: {
            x: detection.detection.box.x,
            y: detection.detection.box.y,
            width: detection.detection.box.width,
            height: detection.detection.box.height,
          },
        });
      } finally {
        // ========== CRITICAL CLEANUP ==========
        if (imageBitmap && typeof imageBitmap.close === 'function') {
          try {
            imageBitmap.close();
          } catch (e) {}
        }
        canvas = null;
        detection = null;
        forceGC();
      }

      return;
    }

    // ---------- MANUAL CLEANUP ----------
    if (type === 'CLEANUP') {
      forceGC();
      self.postMessage({ id, type: 'CLEANUP_DONE', success: true });
    }
  } catch (error) {
    forceGC();

    self.postMessage({
      id,
      type: 'ERROR',
      error: error?.message || 'Worker error',
    });
  }
};
