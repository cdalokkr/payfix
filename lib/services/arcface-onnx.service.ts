/**
 * ArcFace ONNX Web Service — Industry Gold-Standard 512-d Face Recognition
 *
 * Powered by onnxruntime-web (WebGPU / WASM SIMD execution providers).
 * Input: Standardized 112x112 aligned face canvas (RGB, mean: 127.5, std: 128.0).
 * Output: 512-dimensional L2-normalized Float32Array embedding.
 */

import * as ort from 'onnxruntime-web';
import { l2Normalize } from '../face-threshold';

// Configure ONNX WASM paths to load from reliable CDN / public assets
if (typeof window !== 'undefined') {
    ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.21.0/dist/';
    // Limit thread count for low-end mobile devices
    ort.env.wasm.numThreads = 2;
    // Enable proxy worker if available
    ort.env.wasm.proxy = false;
}

// Fallback & primary ONNX model locations
const MODEL_URLS = [
    '/models/arcface_mobilefacenet.onnx',
    'https://raw.githubusercontent.com/onnx/models/main/validated/vision/body_analysis/arcface/model/arcfaceresnet100-8.onnx',
    'https://cdn.jsdelivr.net/gh/deepinsight/insightface@master/model_zoo/mobilefacenet.onnx'
];

let session: ort.InferenceSession | null = null;
let initPromise: Promise<boolean> | null = null;

export const ArcFaceOnnxService = {
    isReady(): boolean {
        return session !== null;
    },

    /**
     * Load ArcFace ONNX model (Singleton — safe to call multiple times)
     */
    async loadModel(onProgress?: (pct: number, msg: string) => void): Promise<boolean> {
        if (session) return true;
        if (initPromise) return initPromise;

        initPromise = (async () => {
            try {
                onProgress?.(15, 'Initializing ONNX Web Engine (WebGPU/WASM)...');

                const sessionOptions: ort.InferenceSession.SessionOptions = {
                    executionProviders: ['webgpu', 'wasm'],
                    graphOptimizationLevel: 'all',
                };

                let loadedSession: ort.InferenceSession | null = null;

                // Try local asset first, then CDN
                for (const url of MODEL_URLS) {
                    try {
                        onProgress?.(40, `Loading ArcFace 512-d model...`);
                        loadedSession = await ort.InferenceSession.create(url, sessionOptions);
                        if (loadedSession) break;
                    } catch (e) {
                        console.warn(`[ArcFace] Could not load from ${url}, trying fallback...`, e);
                    }
                }

                if (!loadedSession) {
                    // Fallback to pure WASM if WebGPU failed
                    for (const url of MODEL_URLS) {
                        try {
                            loadedSession = await ort.InferenceSession.create(url, {
                                executionProviders: ['wasm'],
                                graphOptimizationLevel: 'all',
                            });
                            if (loadedSession) break;
                        } catch {}
                    }
                }

                if (!loadedSession) {
                    throw new Error('Failed to initialize ArcFace ONNX Inference Session');
                }

                session = loadedSession;
                onProgress?.(100, 'ArcFace 512-d Engine Ready!');
                console.log('✅ [ArcFace] 512-d ONNX session successfully initialized.');
                return true;
            } catch (err) {
                console.error('[ArcFace] Model loading error:', err);
                initPromise = null;
                return false;
            }
        })();

        return initPromise;
    },

    /**
     * Preprocesses a 112x112 Canvas/Image into a (1, 3, 112, 112) Float32 Tensor with (x - 127.5) / 128.0
     */
    preprocessImageToTensor(canvas: HTMLCanvasElement): ort.Tensor {
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) throw new Error('Could not get 2D context from 112x112 canvas');

        const imgData = ctx.getImageData(0, 0, 112, 112);
        const { data } = imgData;

        const floatData = new Float32Array(3 * 112 * 112);
        const channelSize = 112 * 112;

        // Planar RGB layout (1, 3, 112, 112)
        for (let i = 0; i < channelSize; i++) {
            const r = data[i * 4];
            const g = data[i * 4 + 1];
            const b = data[i * 4 + 2];

            // Normalize: (pixel - 127.5) / 128.0
            floatData[i] = (r - 127.5) / 128.0;                    // Red channel
            floatData[channelSize + i] = (g - 127.5) / 128.0;      // Green channel
            floatData[2 * channelSize + i] = (b - 127.5) / 128.0;  // Blue channel
        }

        return new ort.Tensor('float32', floatData, [1, 3, 112, 112]);
    },

    /**
     * Extracts 512-dimensional L2-normalized embedding vector from an aligned 112x112 canvas.
     */
    async extract512dEmbedding(aligned112Canvas: HTMLCanvasElement): Promise<Float32Array | null> {
        if (!session) {
            const ok = await this.loadModel();
            if (!ok || !session) return null;
        }

        try {
            const inputTensor = this.preprocessImageToTensor(aligned112Canvas);
            const inputName = session.inputNames[0] || 'data';

            const feeds: Record<string, ort.Tensor> = { [inputName]: inputTensor };
            const results = await session.run(feeds);

            const outputName = session.outputNames[0] || 'fc1';
            const outputTensor = results[outputName];

            if (!outputTensor || !outputTensor.data) {
                throw new Error('No output tensor from ArcFace model');
            }

            const rawData = outputTensor.data as Float32Array;
            const normalized = l2Normalize(Array.from(rawData));
            return new Float32Array(normalized);
        } catch (err) {
            console.error('[ArcFace] Vector extraction error:', err);
            return null;
        }
    },

    /**
     * Compute Cosine Similarity between two 512-d embeddings
     */
    cosineSimilarity(a: Float32Array | number[], b: Float32Array | number[]): number {
        if (a.length !== b.length || a.length === 0) return 0;
        let dot = 0;
        for (let i = 0; i < a.length; i++) {
            dot += a[i] * b[i];
        }
        return Math.max(0, Math.min(1, dot));
    },

    /**
     * Standard ArcFace Verification threshold
     * Same Person: >= 0.65 (High Confidence >= 0.70)
     * Lookalike / Impersonator: <= 0.35
     */
    getThreshold(): number {
        return 0.65;
    },
};

export default ArcFaceOnnxService;
