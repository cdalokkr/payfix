import { NextRequest, NextResponse } from 'next/server';
import { eq, and } from 'drizzle-orm';
import { centralDb } from '@/lib/db';
import { profiles } from '@/lib/db/schema';
import { l2Normalize } from '@/lib/face-threshold';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: employeeId } = await params;
    const body = await req.json();

    const {
      embedding,           // number[128] from client (face-api descriptor)
      faceQualityScore,    // detection score 0-1
      facePhotoUrl,        // optional: Supabase Storage URL
      tenantId,            // required for multi-tenant safety
    } = body;

    // ---------- Validation ----------
    if (!employeeId || !tenantId) {
      return NextResponse.json(
        { success: false, message: 'employeeId and tenantId are required' },
        { status: 400 }
      );
    }

    if (!embedding || !Array.isArray(embedding)) {
      return NextResponse.json(
        { success: false, message: 'embedding array is required' },
        { status: 400 }
      );
    }

    if (embedding.length !== 128) {
      return NextResponse.json(
        {
          success: false,
          message: `Invalid embedding size. Expected 128, got ${embedding.length}`,
        },
        { status: 400 }
      );
    }

    // Check all values are numbers
    if (embedding.some((v) => typeof v !== 'number' || Number.isNaN(v))) {
      return NextResponse.json(
        { success: false, message: 'embedding must be an array of numbers' },
        { status: 400 }
      );
    }

    // ---------- Normalize ----------
    const normalizedEmbedding = l2Normalize(embedding);

    // ---------- Update DB ----------
    const updated = await centralDb
      .update(profiles)
      .set({
        face_embedding: normalizedEmbedding,
        face_quality_score:
          typeof faceQualityScore === 'number' ? faceQualityScore : null,
        face_photo_url: facePhotoUrl || null,
        face_enrolled_at: new Date(),
        updated_at: new Date(),
      })
      .where(
        and(
          eq(profiles.id, employeeId),
          eq(profiles.tenant_id, tenantId) // tenant safety
        )
      )
      .returning({
        id: profiles.id,
        fullName: profiles.full_name,
        faceEnrolledAt: profiles.face_enrolled_at,
        faceQualityScore: profiles.face_quality_score,
      });

    if (!updated.length) {
      return NextResponse.json(
        { success: false, message: 'Employee not found or access denied' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Face enrolled successfully',
      employee: updated[0],
    });
  } catch (err: any) {
    console.error('Enroll face error:', err);
    return NextResponse.json(
      {
        success: false,
        message: err?.message || 'Failed to enroll face',
      },
      { status: 500 }
    );
  }
}
