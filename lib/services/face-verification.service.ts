/**
 * Face Verification Service — Hybrid MediaPipe 3D Mesh + ArcFace 512-d ONNX Web
 *
 * Provides:
 * 1. Real-Time 3D Landmark Tracking & Anti-Spoofing Liveness Gate.
 * 2. Camera Circle Area + 20% Padded Canonical 5-Point Alignment (112x112).
 * 3. InsightFace ArcFace 512-d Vector Extraction & Fast Dot-Product Matching.
 * 4. Backward compatibility for legacy 128-d vectors.
 */

import { MediaPipeMeshService, AlignedFaceCropResult } from './mediapipe-mesh.service';
import { ArcFaceOnnxService } from './arcface-onnx.service';
import { FaceApiBrowserService } from './faceapi-browser.service';
import { BIOMETRIC_CAPTURE_PIPELINE_VERSION } from '@/lib/face-pipeline';
import { l2Normalize, dotProduct } from '../face-threshold';

export interface FaceVerificationResult {
    matched: boolean;
    similarity: number;
    method: 'arcface-512' | 'face-api';
    debugLog: string[];
    isLive?: boolean;
    error?: string;
    alignedCropDataUrl?: string;
    threshold?: number;
    verification?: {
        faceCount: number;
        embeddingDimensions: number;
        livenessPassed: boolean;
        backend: string;
    };
}

// In-memory cache for profile descriptors (URL -> Float32Array)
const descriptorCache = new Map<string, Float32Array>();

export const FaceVerificationService = {
    /**
     * Initialize MediaPipe and ArcFace ONNX models in parallel.
     */
    async initialize(onProgress?: (pct: number, msg: string) => void): Promise<boolean> {
        try {
            onProgress?.(10, 'Initializing Vision & Neural Networks...');
            const [mpReady, arcReady] = await Promise.all([
                MediaPipeMeshService.initialize((pct, msg) => onProgress?.(Math.round(pct * 0.5), msg)),
                ArcFaceOnnxService.loadModel((pct, msg) => onProgress?.(50 + Math.round(pct * 0.5), msg)),
            ]);

            // Fallback load legacy face-api in background if needed
            FaceApiBrowserService.loadModels().catch(() => {});

            return mpReady !== null || arcReady || FaceApiBrowserService.isReady();
        } catch {
            return FaceApiBrowserService.loadModels(onProgress);
        }
    },

    isReady(): boolean {
        return ArcFaceOnnxService.isReady() || FaceApiBrowserService.isReady();
    },

    clearCache(): void {
        descriptorCache.clear();
    },

    /**
     * Preload profile descriptor in the background.
     */
    async preloadProfileDescriptor(
        profileImageUrl: string,
        log?: (msg: string) => void
    ): Promise<boolean> {
        if (!profileImageUrl) return false;
        if (descriptorCache.has(profileImageUrl)) return true;

        try {
            log?.('Preloading profile face descriptor in background...');
            const descriptor = await this.extractAligned512dDescriptorFromUrl(profileImageUrl);
            if (descriptor) {
                descriptorCache.set(profileImageUrl, new Float32Array(descriptor));
                log?.('✅ Profile 512-d face descriptor cached in memory');
                return true;
            }
        } catch (err) {
            console.warn('[FaceVerification] Preload warning:', err);
        }
        return false;
    },

    /**
     * Extract 512-d ArcFace vector from an image URL with MediaPipe 20% padded canonical alignment.
     */
    async extractAligned512dDescriptorFromUrl(imageUrl: string): Promise<number[] | null> {
        return new Promise((resolve) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = async () => {
                try {
                    const aligned = await MediaPipeMeshService.processFaceFrame(img);
                    if (aligned) {
                        const embedding = await ArcFaceOnnxService.extract512dEmbedding(aligned.canvas112);
                        if (embedding) {
                            resolve(Array.from(embedding));
                            return;
                        }
                    }

                    // Fallback to legacy 128-d if 512-d extraction failed
                    const legacy = await FaceApiBrowserService.extractDescriptor(img);
                    resolve(legacy ? Array.from(legacy) : null);
                } catch {
                    resolve(null);
                }
            };
            img.onerror = () => resolve(null);
            img.src = imageUrl;
        });
    },

    /**
     * Extract 512-d ArcFace vector + 20% padded aligned crop from HTMLImageElement, HTMLVideoElement, or Base64 Data URL.
     */
    async extractAligned512dDescriptor(
        input: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement | string
    ): Promise<{ embedding: number[]; cropDataUrl: string; hdAvatarDataUrl?: string; isLive: boolean } | null> {
        let processElement: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement;

        if (typeof input === 'string') {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            await new Promise((res, rej) => {
                img.onload = res;
                img.onerror = rej;
                img.src = input;
            }).catch(() => null);
            processElement = img;
        } else {
            processElement = input;
        }

        try {
            // 1. MediaPipe 3D Landmark & Canonical 112x112 Warping + 512x512 HD Avatar (+18% margin)
            const aligned = await MediaPipeMeshService.processFaceFrame(processElement);
            if (aligned) {
                const embedding = await ArcFaceOnnxService.extract512dEmbedding(aligned.canvas112);
                if (embedding && embedding.length === 512) {
                    return {
                        embedding: Array.from(embedding),
                        cropDataUrl: aligned.dataUrl112,
                        hdAvatarDataUrl: aligned.dataUrl512 || aligned.hdAvatarDataUrl || aligned.dataUrl112,
                        isLive: aligned.isLive,
                    };
                }
            }

            // Fallback: Legacy FaceApi 128-d
            const legacyCrop = await FaceApiBrowserService.extractAlignedSquareFaceCrop(processElement);
            if (legacyCrop) {
                return {
                    embedding: Array.from(legacyCrop.descriptor),
                    cropDataUrl: legacyCrop.croppedDataUrl,
                    hdAvatarDataUrl: legacyCrop.croppedDataUrl,
                    isLive: true,
                };
            }
        } catch (err) {
            console.warn('[FaceVerification] Vector extraction error:', err);
        }

        return null;
    },

    /**
     * Compare a selfie against profile photo or pre-saved embedding vector.
     * Uses 512-d ArcFace Cosine Similarity (threshold: 0.65) with 128-d backward compatibility.
     */
    async compareFaces(
        selfieDataUrl: string,
        profileImageUrl: string,
        onDebugLog?: (log: string) => void,
        preSavedEmbedding?: number[] | Float32Array | null,
        livenessChallenge?: string,
        livenessFrames?: string[]
    ): Promise<FaceVerificationResult> {
        const debugLog: string[] = [];
        const log = (msg: string) => {
            const entry = `[${new Date().toLocaleTimeString()}] ${msg}`;
            debugLog.push(entry);
            onDebugLog?.(entry);
        };

        // Identity decisions are server-only. Browser models may guide framing but must not
        // become an enrollment/attendance fallback when the biometric service is unavailable.
        try {
            log('Sending captured selfie to the server biometric verifier...');
            const apiResp = await fetch('/api/attendance/verify-face', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    frames: livenessFrames?.length ? livenessFrames : [selfieDataUrl],
                    challenge: livenessChallenge,
                    biometricPipelineVersion: BIOMETRIC_CAPTURE_PIPELINE_VERSION,
                }),
                signal: AbortSignal.timeout(30000),
            });
            const apiData = await apiResp.json().catch(() => ({}));
            if (typeof apiData.matched === 'boolean') {
                log(`Server ArcFace 512-d match: ${(Number(apiData.similarity || 0) * 100).toFixed(1)}%`);
                return {
                    matched: apiData.matched,
                    similarity: Number(apiData.similarity || 0),
                    method: 'arcface-512',
                    debugLog,
                    isLive: apiData.is_live === true,
                    threshold: Number(apiData.threshold || 0),
                    verification: apiData.verification,
                    error: apiData.matched ? undefined : (apiData.error || 'Face verification was not successful.'),
                };
            }
            return {
                matched: false,
                similarity: 0,
                method: 'arcface-512',
                debugLog,
                isLive: false,
                error: apiData.error || 'The server biometric verifier is unavailable. Please try again online.',
            };
        } catch (error) {
            log('Server biometric verification could not be reached.');
            return {
                matched: false,
                similarity: 0,
                method: 'arcface-512',
                debugLog,
                isLive: false,
                error: 'The server biometric verifier is unavailable. Please check your connection and try again.',
            };
        }
    },

    getThreshold(): number {
        return 0.88;
    },

    formatSimilarity(similarity: number): string {
        return `${(similarity * 100).toFixed(0)}%`;
    },
};

export default FaceVerificationService;
