'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

declare global {
  interface Window {
    faceapi: any;
  }
}


import {
  FACE_DETECT_OPTIONS,
  fromFaceApiDetection,
  verifyAgainstEmployees,
} from '@/lib/face-pipeline';
import {
  syncFacesFromSupabase,
  getAllEmployeeFaces,
  getSyncInfo,
} from '@/lib/face-db';
import type { MatchResult } from '@/lib/face-matching';

// ---------- Types ----------
type UiStatus =
  | 'booting'       // camera + models + sync
  | 'ready'
  | 'processing'
  | 'success'
  | 'not_recognized'
  | 'no_face'
  | 'error';

interface Props {
  tenantId: string;
}

// ---------- Supabase (browser) ----------
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function KioskAttendance({ tenantId }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const modelsReady = useRef(false);

  const [status, setStatus] = useState<UiStatus>('booting');
  const [message, setMessage] = useState('Starting kiosk...');
  const [employeeCount, setEmployeeCount] = useState(0);
  const [matchedName, setMatchedName] = useState<string | null>(null);
  const [similarity, setSimilarity] = useState<number | null>(null);
  const [lastSync, setLastSync] = useState<string | null>(null);

  // ============================================
  // 1. Boot: Camera warmup + Models + IndexedDB sync
  // ============================================
  useEffect(() => {
    let mounted = true;

    async function boot() {
      try {
        setMessage('Starting camera...');

        // --- Camera warmup (480×640 portrait – best settings) ---
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'user',
            width: { ideal: 480 },
            height: { ideal: 640 },
          },
          audio: false,
        });

        if (!mounted) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }

        // --- Load face-api models ---
        setMessage('Loading face models...');
        const MODEL_URL = '/models';

        if (window.faceapi) {
          await Promise.all([
            window.faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
            window.faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL),
            window.faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
          ]);
        }
        modelsReady.current = true;


        // --- Sync embeddings from Supabase → IndexedDB ---
        setMessage('Syncing employee faces...');
        const { count: saved } = await syncFacesFromSupabase(tenantId, supabase);
        setEmployeeCount(saved);

        const info = await getSyncInfo();
        if (info?.lastSyncedAt) {
          setLastSync(new Date(info.lastSyncedAt).toLocaleTimeString());
        }

        if (!mounted) return;
        setStatus('ready');
        setMessage(`Ready • ${saved} employees offline`);
      } catch (err: any) {
        console.error('Kiosk boot error:', err);
        if (!mounted) return;
        setStatus('error');
        setMessage(
          err?.name === 'NotAllowedError'
            ? 'Camera permission denied'
            : err?.message || 'Failed to start kiosk'
        );
      }
    }

    boot();

    return () => {
      mounted = false;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [tenantId]);

  // ============================================
  // 2. Mark Attendance
  // ============================================
  const handleMarkAttendance = useCallback(async () => {
    if (status !== 'ready' || !videoRef.current || !modelsReady.current) return;

    setStatus('processing');
    setMessage('Verifying face...');
    setMatchedName(null);
    setSimilarity(null);

    try {
      const video = videoRef.current;

      // Detect + descriptor (same pipeline as enrollment)
      const fa = window.faceapi;
      if (!fa) return;

      const detection = await fa
        .detectSingleFace(
          video,
          new fa.TinyFaceDetectorOptions(FACE_DETECT_OPTIONS)
        )
        .withFaceLandmarks(true)
        .withFaceDescriptor();


      if (!detection) {
        setStatus('no_face');
        setMessage('No face detected. Look at the camera.');
        setTimeout(() => resetToReady(), 2000);
        return;
      }

      // Quality + normalize (shared pipeline)
      let extracted;
      try {
        extracted = fromFaceApiDetection(detection);
      } catch (e: any) {
        setStatus('no_face');
        setMessage(e?.message || 'Poor face quality');
        setTimeout(() => resetToReady(), 2000);
        return;
      }

      // Offline match from IndexedDB
      const employees = await getAllEmployeeFaces();
      const match: MatchResult = verifyAgainstEmployees(
        extracted,
        employees,
        'balanced'
      );

      if (match.isMatch && match.employee) {
        setStatus('success');
        setMatchedName(match.employee.fullName);
        setSimilarity(match.similarity);
        setMessage(`Welcome, ${match.employee.fullName}`);

        // Background attendance sync (non-blocking)
        void syncAttendance({
          employeeId: match.employee.id,
          tenantId,
          confidence: match.similarity,
          type: 'check_in',
        });

        setTimeout(() => resetToReady(), 2500);
      } else {
        setStatus('not_recognized');
        setMessage(match.message || 'Face not recognized');
        setSimilarity(match.similarity > 0 ? match.similarity : null);
        setTimeout(() => resetToReady(), 2000);
      }
    } catch (err: any) {
      console.error(err);
      setStatus('error');
      setMessage(err?.message || 'Verification failed');
      setTimeout(() => resetToReady(), 2500);
    }
  }, [status, tenantId]);

  function resetToReady() {
    setStatus('ready');
    setMessage(
      employeeCount > 0
        ? `Ready • ${employeeCount} employees offline`
        : 'Ready'
    );
    setMatchedName(null);
    setSimilarity(null);
  }

  // ============================================
  // 3. Manual re-sync
  // ============================================
  const handleResync = async () => {
    if (status === 'processing' || status === 'booting') return;
    try {
      setMessage('Re-syncing faces...');
      const { count: saved } = await syncFacesFromSupabase(tenantId, supabase);
      setEmployeeCount(saved);
      const info = await getSyncInfo();
      if (info?.lastSyncedAt) {
        setLastSync(new Date(info.lastSyncedAt).toLocaleTimeString());
      }
      setStatus('ready');
      setMessage(`Synced • ${saved} employees`);
    } catch (e: any) {
      setMessage(e?.message || 'Sync failed');
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-950 p-4 text-white">
      {/* Camera */}
      <div className="relative aspect-[3/4] w-full max-w-sm overflow-hidden rounded-2xl bg-black">
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className="h-full w-full object-cover"
        />

        {/* Overlay states */}
        {status !== 'ready' && status !== 'booting' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/65">
            {status === 'processing' && (
              <>
                <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-white/30 border-t-white" />
                <p className="text-lg">Verifying...</p>
              </>
            )}

            {status === 'success' && (
              <>
                <div className="mb-3 text-5xl text-green-400">✓</div>
                <p className="text-2xl font-semibold">{matchedName}</p>
                {similarity != null && (
                  <p className="mt-1 text-sm text-white/70">
                    Confidence: {(similarity * 100).toFixed(1)}%
                  </p>
                )}
              </>
            )}

            {status === 'not_recognized' && (
              <>
                <div className="mb-3 text-5xl text-red-400">✕</div>
                <p className="text-xl">Face not recognized</p>
                {similarity != null && (
                  <p className="mt-1 text-sm text-white/60">
                    Best score: {(similarity * 100).toFixed(1)}%
                  </p>
                )}
              </>
            )}

            {status === 'no_face' && (
              <p className="px-4 text-center text-xl">{message}</p>
            )}

            {status === 'error' && (
              <p className="px-4 text-center text-lg text-red-300">{message}</p>
            )}
          </div>
        )}

        {status === 'booting' && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80">
            <p className="text-center text-lg">{message}</p>
          </div>
        )}
      </div>

      {/* Status line */}
      <p className="mt-6 text-center text-lg">{message}</p>
      {lastSync && status === 'ready' && (
        <p className="mt-1 text-sm text-white/45">Last sync: {lastSync}</p>
      )}

      {/* Actions */}
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <button
          onClick={handleMarkAttendance}
          disabled={status !== 'ready'}
          className="rounded-xl bg-blue-600 px-10 py-4 text-lg font-medium transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-gray-700"
        >
          {status === 'processing' ? 'Processing...' : 'Mark Attendance'}
        </button>

        <button
          onClick={handleResync}
          disabled={status === 'booting' || status === 'processing'}
          className="rounded-xl border border-white/20 px-5 py-3 text-sm text-white/80 hover:bg-white/10 disabled:opacity-40"
        >
          Re-sync faces
        </button>
      </div>
    </div>
  );
}

// ---------- Background attendance sync ----------
async function syncAttendance(payload: {
  employeeId: string;
  tenantId: string;
  confidence: number;
  type: 'check_in' | 'check_out';
}) {
  try {
    await fetch('/api/attendance/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        employeeId: payload.employeeId,
        tenantId: payload.tenantId,
        type: payload.type,
        method: 'kiosk',
        confidence: payload.confidence,
        offlineMatched: true,
      }),
    });
  } catch (e) {
    console.warn('Attendance sync failed:', e);
  }
}
