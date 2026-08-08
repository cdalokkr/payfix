/**
 * FaceWorkerClient — React / Next.js client wrapper for Web Worker face vector extraction
 * Handles zero-copy ImageBitmap transfer and non-blocking background AI passes.
 */

export type WorkerMessage =
  | { type: 'MODELS_LOADED'; success: boolean }
  | { type: 'EXTRACT_RESULT'; success: boolean; descriptor?: number[]; score?: number; error?: string }
  | { type: 'ERROR'; error: string };

export class FaceWorkerClient {
  private worker: Worker | null = null;
  private ready = false;

  constructor(private modelUrl: string = '/models') {}

  async init(): Promise<boolean> {
    if (typeof window === 'undefined') return false;
    if (this.worker && this.ready) return true;

    try {
      this.worker = new Worker('/workers/face-worker.js');

      return new Promise((resolve, reject) => {
        if (!this.worker) return reject(new Error('Worker initialization failed'));

        const timeout = setTimeout(() => {
          reject(new Error('Worker model loading timeout'));
        }, 15000);

        this.worker.onmessage = (e: MessageEvent<WorkerMessage>) => {
          if (e.data.type === 'MODELS_LOADED') {
            clearTimeout(timeout);
            this.ready = true;
            resolve(true);
          }
          if (e.data.type === 'ERROR') {
            clearTimeout(timeout);
            reject(new Error(e.data.error));
          }
        };

        this.worker.postMessage({
          type: 'LOAD_MODELS',
          payload: { modelUrl: this.modelUrl },
        });
      });
    } catch (err) {
      console.warn('[FaceWorkerClient] Web Worker not supported or failed to start:', err);
      return false;
    }
  }

  isReady(): boolean {
    return this.ready;
  }

  async extractEmbedding(
    videoOrCanvas: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement,
    options?: { inputSize?: number; scoreThreshold?: number }
  ): Promise<{ descriptor: number[]; score: number } | null> {
    if (!this.worker || !this.ready) {
      return null;
    }

    try {
      // Create ImageBitmap for zero-copy ownership transfer to Web Worker
      const bitmap = await createImageBitmap(videoOrCanvas);

      return new Promise((resolve, reject) => {
        const handler = (e: MessageEvent<WorkerMessage>) => {
          if (e.data.type === 'EXTRACT_RESULT') {
            this.worker?.removeEventListener('message', handler);

            if (e.data.success && e.data.descriptor) {
              resolve({
                descriptor: e.data.descriptor,
                score: e.data.score || 0,
              });
            } else {
              resolve(null); // No face detected
            }
          }

          if (e.data.type === 'ERROR') {
            this.worker?.removeEventListener('message', handler);
            reject(new Error(e.data.error));
          }
        };

        this.worker!.addEventListener('message', handler);

        this.worker!.postMessage(
          {
            type: 'EXTRACT_EMBEDDING',
            payload: {
              imageBitmap: bitmap,
              options: options || { inputSize: 160, scoreThreshold: 0.4 },
            },
          },
          [bitmap] // Zero-copy ownership transfer
        );
      });
    } catch (err) {
      console.warn('[FaceWorkerClient] ImageBitmap extraction error:', err);
      return null;
    }
  }

  terminate(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
      this.ready = false;
    }
  }
}

// Global Singleton for Web Worker Client
let _workerClientInstance: FaceWorkerClient | null = null;

export function getFaceWorkerClient(): FaceWorkerClient {
  if (!_workerClientInstance) {
    _workerClientInstance = new FaceWorkerClient('/models');
  }
  return _workerClientInstance;
}
