// public/workers/face-embedding.worker.js
// Drop-in: backend auto-select (webgpu → webgl → wasm → cpu) + face embedding

importScripts(
  'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js',
  'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-backend-webgpu@4.22.0/dist/tf-backend-webgpu.js',
  'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.15/dist/face-api.js'
);

let modelsLoaded = false;
let activeBackend = 'unknown';
let extractCount = 0;

const DEFAULT_MODEL_URL = '/models';
const GC_EVERY_N = 15;

// ------------------ Backend init ------------------

async function initBackend() {
  const tf = self.tf || (typeof faceapi !== 'undefined' ? faceapi.tf : null);
  if (!tf) throw new Error('TensorFlow.js not found in worker');

  // 1) WebGPU
  try {
    if (typeof navigator !== 'undefined' && navigator.gpu) {
      const ok = await tf.setBackend('webgpu');
      if (ok) {
        await tf.ready();
        if (tf.getBackend() === 'webgpu') {
          activeBackend = 'webgpu';
          return activeBackend;
        }
      }
    }
  } catch (e) {
    console.warn('[worker] WebGPU unavailable:', e?.message || e);
  }

  // 2) WebGL
  try {
    const ok = await tf.setBackend('webgl');
    if (ok) {
      await tf.ready();
      activeBackend = tf.getBackend() || 'webgl';
      return activeBackend;
    }
  } catch (e) {
    console.warn('[worker] WebGL unavailable:', e?.message || e);
  }

  // 3) WASM (optional – only if backend registered)
  try {
    const ok = await tf.setBackend('wasm');
    if (ok) {
      await tf.ready();
      activeBackend = tf.getBackend() || 'wasm';
      return activeBackend;
    }
  } catch (e) {
    console.warn('[worker] WASM unavailable:', e?.message || e);
  }

  // 4) CPU
  await tf.setBackend('cpu');
  await tf.ready();
  activeBackend = 'cpu';
  return activeBackend;
}

// ------------------ Memory helpers ------------------

function safeCloseBitmap(bitmap) {
  if (bitmap && typeof bitmap.close === 'function') {
    try {
      bitmap.close();
    } catch (_) {}
  }
}

function lightCleanup() {
  try {
    const tf = faceapi.tf || self.tf;
    const engine = tf?.engine?.();
    if (!engine?.scopeStack) return;
    while (engine.scopeStack.length > 0) {
      try {
        engine.endScope();
      } catch (_) {
        break;
      }
    }
  } catch (_) {}
}

function deepCleanup() {
  lightCleanup();
  try {
    const tf = faceapi.tf || self.tf;
    const engine = tf?.engine?.();
    if (engine) {
      engine.startScope();
      engine.endScope();
    }
  } catch (_) {}
}

// ------------------ Messages ------------------

self.onmessage = async (event) => {
  const { type, payload, id } = event.data;

  try {
    // ===== INIT BACKEND ONLY =====
    if (type === 'INIT_BACKEND') {
      const backend = await initBackend();
      self.postMessage({
        id,
        type: 'BACKEND_READY',
        success: true,
        backend,
      });
      return;
    }

    // ===== LOAD MODELS (backend + weights) =====
    if (type === 'LOAD_MODELS') {
      if (!modelsLoaded) {
        const backend = await initBackend();
        const modelUrl = payload?.modelUrl || DEFAULT_MODEL_URL;

        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(modelUrl),
          faceapi.nets.faceLandmark68TinyNet.loadFromUri(modelUrl),
          faceapi.nets.faceRecognitionNet.loadFromUri(modelUrl),
        ]);

        modelsLoaded = true;
        deepCleanup();

        self.postMessage({
          id,
          type: 'MODELS_LOADED',
          success: true,
          backend,
        });
      } else {
        self.postMessage({
          id,
          type: 'MODELS_LOADED',
          success: true,
          backend: activeBackend,
        });
      }
      return;
    }

    // ===== EXTRACT =====
    if (type === 'EXTRACT_EMBEDDING') {
      if (!modelsLoaded) throw new Error('Models not loaded');

      const {
        imageBitmap,
        inputSize = 160,
        scoreThreshold = 0.5,
      } = payload;

      let canvas = null;
      let bitmapClosed = false;

      try {
        canvas = new OffscreenCanvas(imageBitmap.width, imageBitmap.height);
        const ctx = canvas.getContext('2d', {
          alpha: false,
          desynchronized: true,
          willReadFrequently: false,
        });
        if (!ctx) throw new Error('2d context failed');
        ctx.drawImage(imageBitmap, 0, 0);

        safeCloseBitmap(imageBitmap);
        bitmapClosed = true;

        const tf = faceapi.tf || self.tf;
        const engine = tf.engine();
        engine.startScope();

        let detection;
        try {
          detection = await faceapi
            .detectSingleFace(
              canvas,
              new faceapi.TinyFaceDetectorOptions({ inputSize, scoreThreshold })
            )
            .withFaceLandmarks(true)
            .withFaceDescriptor();
        } finally {
          engine.endScope();
        }

        canvas.width = 0;
        canvas.height = 0;
        canvas = null;

        if (!detection) {
          self.postMessage({
            id,
            type: 'EXTRACT_RESULT',
            success: false,
            error: 'No face detected',
            backend: activeBackend,
          });
          return;
        }

        const descriptor = Array.from(detection.descriptor);
        const score = detection.detection.score;
        const box = {
          x: detection.detection.box.x,
          y: detection.detection.box.y,
          width: detection.detection.box.width,
          height: detection.detection.box.height,
        };

        self.postMessage({
          id,
          type: 'EXTRACT_RESULT',
          success: true,
          descriptor,
          score,
          box,
          backend: activeBackend,
        });
      } finally {
        if (!bitmapClosed) safeCloseBitmap(imageBitmap);
        if (canvas) {
          try {
            canvas.width = 0;
            canvas.height = 0;
          } catch (_) {}
        }
        lightCleanup();
        extractCount += 1;
        if (extractCount % GC_EVERY_N === 0) deepCleanup();
      }
      return;
    }

    // ===== CLEANUP =====
    if (type === 'CLEANUP') {
      deepCleanup();
      extractCount = 0;
      self.postMessage({
        id,
        type: 'CLEANUP_DONE',
        success: true,
        backend: activeBackend,
      });
      return;
    }

    // ===== STATUS =====
    if (type === 'STATUS') {
      let tfMemory = null;
      try {
        const tf = faceapi.tf || self.tf;
        tfMemory = tf?.memory?.() ?? null;
      } catch (_) {}

      self.postMessage({
        id,
        type: 'STATUS_RESULT',
        modelsLoaded,
        backend: activeBackend,
        extractCount,
        tfMemory,
      });
    }
  } catch (error) {
    lightCleanup();
    self.postMessage({
      id,
      type: 'ERROR',
      error: error?.message || 'Worker error',
      backend: activeBackend,
    });
  }
};
