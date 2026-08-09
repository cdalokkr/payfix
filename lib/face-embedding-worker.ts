// src/lib/face-embedding-worker.ts

type WorkerSuccessResponse =
  | { id: string; type: 'MODELS_LOADED'; success: true }
  | {
      id: string;
      type: 'EXTRACT_RESULT';
      success: true;
      descriptor: number[];
      score: number;
      box?: {
        x: number;
        y: number;
        width: number;
        height: number;
      };
    }
  | { id: string; type: 'CLEANUP_DONE'; success: true };

type WorkerErrorResponse = {
  id: string;
  type: 'ERROR' | 'EXTRACT_RESULT';
  success?: false;
  error: string;
};

type WorkerResponse = WorkerSuccessResponse | WorkerErrorResponse;

export interface FaceMatchResult {
  isMatch: boolean;
  similarity: number;
  employeeId?: string;
  fullName?: string;
  employeeCode?: string;
  message: string;
}

export interface ExtractResult {
  descriptor: number[];
  score: number;
  box?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

interface PendingRequest {
  resolve: (value: any) => void;
  reject: (reason?: any) => void;
  timeoutId?: ReturnType<typeof setTimeout>;
}

export class FaceEmbeddingWorker {
  private worker: Worker | null = null;
  private ready = false;
  public activeBackend = 'unknown';
  private messageId = 0;
  private pending = new Map<string, PendingRequest>();
  private initPromise: Promise<any> | null = null;

  get backend(): string {
    return this.activeBackend;
  }

  constructor(
    private modelUrl: string = '/models',
    private defaultTimeout = 15000
  ) {}


  /**
   * Initialize worker and load models
   */
  async init(): Promise<void> {
    if (this.ready && this.worker) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise(async (resolve, reject) => {
      try {
        if (typeof window === 'undefined') {
          reject(new Error('Window not defined'));
          return;
        }

        this.worker = new Worker('/workers/face-embedding.worker.js');

        this.worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
          this.handleWorkerMessage(e.data);
        };

        this.worker.onerror = (err) => {
          console.error('[FaceEmbeddingWorker] Worker error:', err);
          this.rejectAllPending(new Error('Worker crashed'));
        };

        // Load models
        const res = await this.send('LOAD_MODELS', { modelUrl: this.modelUrl });
        this.ready = true;
        resolve(res || { backend: this.activeBackend });

      } catch (err) {
        this.initPromise = null;
        reject(err);
      }
    });

    return this.initPromise;
  }

  /**
   * Extract face embedding from video/canvas/image
   */
  async extract(
    source: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement,
    options: {
      inputSize?: number;
      scoreThreshold?: number;
      timeout?: number;
    } = {}
  ): Promise<ExtractResult | null> {
    await this.ensureReady();

    let bitmap: ImageBitmap | null = null;

    try {
      bitmap = await createImageBitmap(source);

      const result = await this.send(
        'EXTRACT_EMBEDDING',
        {
          imageBitmap: bitmap,
          inputSize: options.inputSize ?? 160,
          scoreThreshold: options.scoreThreshold ?? 0.4,
        },
        [bitmap],
        options.timeout
      );

      return result as ExtractResult | null;
    } catch (error) {
      if (bitmap && typeof bitmap.close === 'function') {
        try {
          bitmap.close();
        } catch (_) {}
      }
      throw error;
    }
  }

  /**
   * Extract the best face from frame (supports multi-face)
   */
  async extractBestFace(
    source: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement,
    options: {
      inputSize?: number;
      scoreThreshold?: number;
      preferLargest?: boolean;
    } = {}
  ): Promise<ExtractResult | null> {
    return this.extract(source, {
      inputSize: options.inputSize ?? 160,
      scoreThreshold: options.scoreThreshold ?? 0.4,
    });
  }

  /**
   * Calculate cosine similarity between two embeddings
   */
  static cosineSimilarity(a: number[], b: number[]): number {
    if (!a?.length || !b?.length || a.length !== b.length) {
      return 0;
    }

    let dot = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    if (denominator === 0) return 0;

    return dot / denominator;
  }

  /**
   * Match a query embedding against a list of employee faces
   */
  static matchFace(
    queryEmbedding: number[],
    employees: Array<{
      id: string;
      fullName: string;
      employeeCode?: string;
      embedding: number[];
    }>,
    threshold: number = 0.60
  ): FaceMatchResult {
    if (!queryEmbedding?.length) {
      return {
        isMatch: false,
        similarity: 0,
        message: 'Invalid query embedding',
      };
    }

    if (!employees?.length) {
      return {
        isMatch: false,
        similarity: 0,
        message: 'No employee faces available for matching',
      };
    }

    let bestScore = -1;
    let bestEmployee: (typeof employees)[0] | null = null;

    for (const emp of employees) {
      if (!emp.embedding || emp.embedding.length !== queryEmbedding.length) {
        continue;
      }

      const score = FaceEmbeddingWorker.cosineSimilarity(
        queryEmbedding,
        emp.embedding
      );

      if (score > bestScore) {
        bestScore = score;
        bestEmployee = emp;
      }
    }

    if (bestEmployee && bestScore >= threshold) {
      return {
        isMatch: true,
        similarity: bestScore,
        employeeId: bestEmployee.id,
        fullName: bestEmployee.fullName,
        employeeCode: bestEmployee.employeeCode,
        message: 'Face matched successfully',
      };
    }

    return {
      isMatch: false,
      similarity: bestScore > 0 ? bestScore : 0,
      message: 'No matching employee found',
    };
  }

  /**
   * Ask worker to run cleanup
   */
  async cleanup(): Promise<void> {
    if (!this.worker) return;

    try {
      await this.send('CLEANUP', {}, [], 5000);
    } catch (err) {
      console.warn('[FaceEmbeddingWorker] Cleanup failed:', err);
    }
  }

  /**
   * Terminate worker and clear everything
   */
  terminate() {
    this.rejectAllPending(new Error('Worker terminated'));
    this.worker?.terminate();
    this.worker = null;
    this.ready = false;
    this.initPromise = null;
    this.pending.clear();
  }

  get isReady() {
    return this.ready;
  }

  // ======================
  // Private Helpers
  // ======================

  private async ensureReady() {
    if (!this.ready) {
      await this.init();
    }
    if (!this.worker) {
      throw new Error('FaceEmbeddingWorker is not available');
    }
  }

  private handleWorkerMessage(data: WorkerResponse) {
    const pending = this.pending.get(data.id);
    if (!pending) return;

    if (pending.timeoutId) {
      clearTimeout(pending.timeoutId);
    }

    this.pending.delete(data.id);

    if ((data as any).backend) {
      this.activeBackend = (data as any).backend;
    }

    if (data.type === 'MODELS_LOADED') {
      pending.resolve({ success: true, backend: this.activeBackend });
      return;
    }


    if (data.type === 'EXTRACT_RESULT' && 'descriptor' in data) {
      pending.resolve({
        descriptor: data.descriptor,
        score: data.score,
        box: data.box,
      });
      return;
    }


    if (data.type === 'CLEANUP_DONE') {
      pending.resolve(true);
      return;
    }

    pending.resolve(data);
  }

  private send(
    type: string,
    payload: any = {},
    transfer: Transferable[] = [],
    timeout = this.defaultTimeout
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.worker) {
        reject(new Error('Worker not initialized'));
        return;
      }

      const id = `msg_${++this.messageId}_${Date.now()}`;

      const timeoutId = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Request timeout after ${timeout}ms (${type})`));
      }, timeout);

      this.pending.set(id, { resolve, reject, timeoutId });

      try {
        this.worker.postMessage({ type, payload, id }, transfer);
      } catch (err) {
        clearTimeout(timeoutId);
        this.pending.delete(id);
        reject(err);
      }
    });
  }

  private rejectAllPending(error: Error) {
    this.pending.forEach((pending) => {
      if (pending.timeoutId) clearTimeout(pending.timeoutId);
      pending.reject(error);
    });
    this.pending.clear();
  }
}
