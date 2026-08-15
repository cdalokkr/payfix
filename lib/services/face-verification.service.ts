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
import { l2Normalize, dotProduct } from '../face-threshold';

export interface FaceVerificationResult {
    matched: boolean;
    similarity: number;
    method: 'arcface-512' | 'face-api';
    debugLog: string[];
    isLive?: boolean;
    error?: string;
    alignedCropDataUrl?: string;
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
    ): Promise<{ embedding: number[]; cropDataUrl: string; isLive: boolean } | null> {
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
            // 1. MediaPipe 3D Landmark & Canonical 20% Padded 112x112 Warping
            const aligned = await MediaPipeMeshService.processFaceFrame(processElement);
            if (aligned) {
                const embedding = await ArcFaceOnnxService.extract512dEmbedding(aligned.canvas112);
                if (embedding && embedding.length === 512) {
                    return {
                        embedding: Array.from(embedding),
                        cropDataUrl: aligned.dataUrl112,
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
        preSavedEmbedding?: number[] | Float32Array | null
    ): Promise<FaceVerificationResult> {
        const debugLog: string[] = [];
        const log = (msg: string) => {
            const entry = `[${new Date().toLocaleTimeString()}] ${msg}`;
            debugLog.push(entry);
            onDebugLog?.(entry);
        };

        try {
            log('🚀 Starting MediaPipe 3D + ArcFace 512-d face verification...');

            // 1. Extract selfie 512-d descriptor with camera circle + 20% padding alignment
            log('⚡ Extracting selfie face descriptor with canonical alignment...');
            const selfieRes = await this.extractAligned512dDescriptor(selfieDataUrl);

            if (!selfieRes || !selfieRes.embedding || selfieRes.embedding.length === 0) {
                return {
                    matched: false,
                    similarity: 0,
                    method: 'arcface-512',
                    debugLog,
                    error: 'No face detected in selfie. Please align face inside camera circle and retake.',
                };
            }

            // 2. Resolve Profile Embedding (512-d or 128-d)
            let profileVector: number[] | null = null;
            if (preSavedEmbedding) {
                profileVector = Array.isArray(preSavedEmbedding)
                    ? preSavedEmbedding
                    : Array.from(preSavedEmbedding);
                log(`⚡ Using pre-saved face embedding from database (${profileVector.length}-d)`);
            } else {
                const cached = descriptorCache.get(profileImageUrl);
                if (cached) {
                    profileVector = Array.from(cached);
                    log(`⚡ Using cached profile face embedding (${profileVector.length}-d)`);
                } else if (profileImageUrl) {
                    log('📷 Extracting profile photo embedding from URL...');
                    profileVector = await this.extractAligned512dDescriptorFromUrl(profileImageUrl);
                    if (profileVector) {
                        descriptorCache.set(profileImageUrl, new Float32Array(profileVector));
                    }
                }
            }

            if (!profileVector || profileVector.length === 0) {
                return {
                    matched: false,
                    similarity: 0,
                    method: 'arcface-512',
                    debugLog,
                    error: 'No face detected in profile photo. Please upload a clear profile photo.',
                };
            }

            // 3. Vector Match Calculation
            const is512 = selfieRes.embedding.length === 512 && profileVector.length === 512;
            const threshold = is512 ? 0.65 : 0.68;

            const normSelfie = l2Normalize(selfieRes.embedding);
            const normProfile = l2Normalize(profileVector);
            const similarity = Math.max(0, dotProduct(normSelfie, normProfile));
            const matched = similarity >= threshold;

            const method = is512 ? 'arcface-512' : 'face-api';
            log(`🎯 ${is512 ? 'ArcFace 512-d' : '128-d'} Similarity: ${(similarity * 100).toFixed(1)}% (Threshold: ${(threshold * 100)}%) | ${matched ? '✅ MATCH' : '❌ NO MATCH'}`);

            return {
                matched,
                similarity,
                method,
                debugLog,
                isLive: selfieRes.isLive,
                alignedCropDataUrl: selfieRes.cropDataUrl,
                error: matched
                    ? undefined
                    : `Face does not match profile photo (${(similarity * 100).toFixed(0)}% similarity, required >= ${(threshold * 100)}%).`,
            };
        } catch (error) {
            const msg = error instanceof Error ? error.message : 'Unknown error';
            log(`❌ Error: ${msg}`);
            return {
                matched: false,
                similarity: 0,
                method: 'arcface-512',
                debugLog,
                error: `Verification error: ${msg}`,
            };
        }
    },

    getThreshold(): number {
        return 0.65;
    },

    formatSimilarity(similarity: number): string {
        return `${(similarity * 100).toFixed(0)}%`;
    },
};

export default FaceVerificationService;
