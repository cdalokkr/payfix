import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { l2Normalize } from '@/lib/face-threshold';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      embedding,          // number[128] from client
      tenantId,
      type = 'check_in',  // check_in | check_out
      method = 'pwa',
      confidence: clientConfidence,
      latitude,
      longitude,
      accessToken,        // optional: user session
    } = body;

    if (!embedding || !Array.isArray(embedding) || embedding.length !== 128) {
      return NextResponse.json(
        { success: false, message: 'Invalid embedding. Expected 128-d array.' },
        { status: 400 }
      );
    }
    if (!tenantId) {
      return NextResponse.json(
        { success: false, message: 'tenantId required' },
        { status: 400 }
      );
    }

    const normalized = l2Normalize(embedding);

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      accessToken
        ? { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
        : undefined
    );

    // 1. Match via Supabase RPC (128-d vector cosine ops)
    const { data: matches, error: matchError } = await supabase.rpc(
      'match_employee_face',
      {
        query_embedding: normalized,
        match_threshold: 0.42,
        match_count: 1,
        p_tenant_id: tenantId,
      }
    );

    if (matchError) {
      console.error('[API Attendance Check] RPC Match Error:', matchError);
      return NextResponse.json(
        { success: false, message: 'Match failed', error: matchError.message },
        { status: 500 }
      );
    }

    const best = matches?.[0];
    if (!best) {
      return NextResponse.json({
        success: false,
        isMatch: false,
        message: 'No matching employee found',
      });
    }

    // 2. Mark attendance log in Supabase
    const { data: log, error: logError } = await supabase
      .from('attendance_logs')
      .insert({
        tenant_id: tenantId,
        employee_id: best.employee_id,
        type,
        method,
        confidence: best.similarity ?? clientConfidence,
        latitude: latitude ?? null,
        longitude: longitude ?? null,
        geofence_passed: true,
      })
      .select()
      .single();

    if (logError) {
      console.error('[API Attendance Check] Save Log Error:', logError);
      return NextResponse.json(
        { success: false, message: 'Failed to save attendance log', error: logError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      isMatch: true,
      employee: {
        id: best.employee_id,
        fullName: best.full_name,
        employeeCode: best.employee_code,
      },
      similarity: best.similarity,
      attendanceId: log?.id,
      message: 'Attendance marked successfully',
    });
  } catch (err: any) {
    console.error('[API Attendance Check] System Error:', err);
    return NextResponse.json(
      { success: false, message: err?.message || 'Server error' },
      { status: 500 }
    );
  }
}
