import { NextRequest, NextResponse } from 'next/server';
import { FaceServiceClient } from '@/lib/face-service-client';

/**
 * POST /api/kiosk/extract-face
 * 
 * High-speed 512-d ArcFace vector extraction + 15% Face Crop for Express Kiosk terminals.
 * Powered by ZeroGPU AI Microservice (~29ms).
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { imageBase64 } = body;

        if (!imageBase64) {
            return NextResponse.json({
                success: false,
                error: 'No image payload provided'
            }, { status: 400 });
        }

        const extractRes = await FaceServiceClient.extract(imageBase64);

        if (!extractRes.success || !extractRes.face_detected) {
            return NextResponse.json({
                success: false,
                face_detected: false,
                error_code: extractRes.error_code || 'NO_FACE_DETECTED',
                error_message: extractRes.error_message || 'No face detected in camera frame.',
                troubleshooting_tip: extractRes.troubleshooting_tip || 'Please align face inside camera circle.'
            }, { status: 200 });
        }

        return NextResponse.json({
            success: true,
            face_detected: true,
            embedding_512: extractRes.embedding_512 || extractRes.embedding,
            cropped_face_base64: extractRes.cropped_face_base64 || null,
            is_live: extractRes.is_live,
            liveness_score: extractRes.liveness_score,
            diagnostics: extractRes.diagnostics
        });
    } catch (err: any) {
        console.error('[Kiosk Extract API] Error:', err);
        return NextResponse.json({
            success: false,
            error: err.message || 'Internal server error'
        }, { status: 500 });
    }
}
