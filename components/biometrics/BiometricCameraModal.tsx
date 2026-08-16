'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { X, RefreshCw, AlertCircle } from 'lucide-react';
import { BIOMETRIC_CAMERA_CONFIG } from '@/lib/face-pipeline';
import { MediaPipeMeshService, InMaskLivenessStatus } from '@/lib/services/mediapipe-mesh.service';
import { FaceApiBrowserService } from '@/lib/services/faceapi-browser.service';

interface BiometricCameraModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string | React.ReactNode;
  subtitle?: string;
  icon?: React.ReactNode;
  videoRefOut?: React.RefObject<HTMLVideoElement | null>;
  warmedStream?: MediaStream | null;
  onStreamReady?: (stream: MediaStream, videoEl: HTMLVideoElement) => void;
  onCameraError?: (error: Error) => void;
  statusText?: string;
  isProcessing?: boolean;
  footerSlot?: React.ReactNode;
  children?: React.ReactNode;
  timerSeconds?: number;
  enableAutoBlinkCapture?: boolean;
  onAutoCapture?: (dataUrl: string) => void;
}

export const BiometricCameraModal: React.FC<BiometricCameraModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  icon,
  videoRefOut,
  warmedStream,
  onStreamReady,
  onCameraError,
  statusText,
  isProcessing = false,
  footerSlot,
  children,
  timerSeconds,
  enableAutoBlinkCapture = true,
  onAutoCapture,
}) => {
  const internalVideoRef = useRef<HTMLVideoElement | null>(null);
  const videoRef = videoRefOut || internalVideoRef;
  const streamRef = useRef<MediaStream | null>(null);
  const isMountedRef = useRef(true);
  const [isStreamPlaying, setIsStreamPlaying] = useState(false);

  const onStreamReadyRef = useRef(onStreamReady);
  const onCameraErrorRef = useRef(onCameraError);
  const onAutoCaptureRef = useRef(onAutoCapture);

  useEffect(() => {
    onStreamReadyRef.current = onStreamReady;
    onCameraErrorRef.current = onCameraError;
    onAutoCaptureRef.current = onAutoCapture;
  }, [onStreamReady, onCameraError, onAutoCapture]);

  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Real-time In-Mask Liveness & Blink state
  const [livenessStatus, setLivenessStatus] = useState<InMaskLivenessStatus>({
    isFaceDetected: false,
    isAlignedInMask: false,
    isBlinking: false,
    blinkConfirmed: false,
    prompt: 'Position face in mask',
    statusBadgeColor: 'blue',
    ear: 0,
    headPose: { yaw: 0, pitch: 0, roll: 0 },
  });

  const [flashSuccess, setFlashSuccess] = useState(false);
  const isCapturingRef = useRef(false);
  const isEvaluatingRef = useRef(false);

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setIsStreamPlaying(false);
    MediaPipeMeshService.resetBlinkState();
    isCapturingRef.current = false;
    isEvaluatingRef.current = false;
  }, []);

  const startCamera = useCallback(async () => {
    if (!isOpen) return;

    // Fast-path: use pre-warmed stream if active
    if (warmedStream && warmedStream.active) {
      streamRef.current = warmedStream;
      isCapturingRef.current = false;
      isEvaluatingRef.current = false;
      MediaPipeMeshService.resetBlinkState();
      setIsStreamPlaying(true);
      if (videoRef.current) {
        const video = videoRef.current;
        video.srcObject = warmedStream;
        video.setAttribute('playsinline', 'true');
        video.muted = true;
        video.play().then(() => setIsStreamPlaying(true)).catch(() => {});
        FaceApiBrowserService.loadDetectorOnly().catch(() => {});
        MediaPipeMeshService.initialize().catch(() => {});
        onStreamReadyRef.current?.(warmedStream, video);
      }
      return;
    }

    // Stream is active — DO NOT STOP stream!
    if (streamRef.current && streamRef.current.active) {
      setIsStreamPlaying(true);
      if (videoRef.current && videoRef.current.srcObject !== streamRef.current) {
        videoRef.current.srcObject = streamRef.current;
        videoRef.current.play().then(() => setIsStreamPlaying(true)).catch(() => {});
      }
      return;
    }

    setHasError(false);
    MediaPipeMeshService.resetBlinkState();
    isCapturingRef.current = false;
    isEvaluatingRef.current = false;

    try {
      const primaryConstraints: MediaStreamConstraints = {
        video: {
          facingMode: BIOMETRIC_CAMERA_CONFIG.facingMode,
          width: { ideal: BIOMETRIC_CAMERA_CONFIG.width, min: 720 },
          height: { ideal: BIOMETRIC_CAMERA_CONFIG.height, min: 960 },
          aspectRatio: { ideal: BIOMETRIC_CAMERA_CONFIG.aspectRatio },
        },
        audio: false,
      };

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia(primaryConstraints);
      } catch (e) {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { exact: 'user' }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
      }

      if (!isMountedRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      streamRef.current = stream;
      setIsStreamPlaying(true);

      if (videoRef.current) {
        const video = videoRef.current;
        video.srcObject = stream;
        video.setAttribute('playsinline', 'true');
        video.muted = true;
        video.play().then(() => {
          if (isMountedRef.current) setIsStreamPlaying(true);
        }).catch(() => {
          if (isMountedRef.current) setIsStreamPlaying(true);
        });

        // Fast preload detector for instant blink detection
        FaceApiBrowserService.loadDetectorOnly().catch(() => {});
        MediaPipeMeshService.initialize().catch(() => {});

        if (onStreamReadyRef.current) {
          onStreamReadyRef.current(stream, video);
        }
      }
    } catch (err: any) {
      if (!isMountedRef.current) return;
      console.error('[BiometricCameraModal] Camera error:', err);
      setHasError(true);
      setErrorMessage(err?.message || 'Failed to start camera');
      if (onCameraErrorRef.current) {
        onCameraErrorRef.current(err);
      }
    }
  }, [isOpen, videoRef, warmedStream]);

  useEffect(() => {
    isMountedRef.current = true;
    if (isOpen) {
      startCamera();
    } else {
      stopStream();
    }

    return () => {
      isMountedRef.current = false;
      stopStream();
    };
  }, [isOpen, startCamera, stopStream]);

  // Real-time In-Mask Liveness & Blink Tracking Loop
  useEffect(() => {
    if (!isOpen || !enableAutoBlinkCapture || isProcessing) return;

    let animId: number;
    let lastEvalTime = 0;

    const loop = async (time: number) => {
      if (
        videoRef.current &&
        videoRef.current.videoWidth > 0 &&
        !isCapturingRef.current &&
        !isProcessing &&
        !isEvaluatingRef.current
      ) {
        // Run tracker every ~80ms for ultra-responsive blink capture
        if (time - lastEvalTime >= 80) {
          lastEvalTime = time;
          isEvaluatingRef.current = true;
          try {
            // 200ms timeout guard prevents RAF loop from stalling if model loading is slow
            const evalPromise = MediaPipeMeshService.evaluateInMaskLiveness(videoRef.current, time);
            const timeoutPromise = new Promise<InMaskLivenessStatus>((resolve) =>
              setTimeout(() => resolve({
                isFaceDetected: false, isAlignedInMask: false, isBlinking: false,
                blinkConfirmed: false, prompt: 'Detecting face...', statusBadgeColor: 'blue',
                ear: 0, headPose: { yaw: 0, pitch: 0, roll: 0 },
              }), 200)
            );
            const status = await Promise.race([evalPromise, timeoutPromise]);
            if (isMountedRef.current) {
              setLivenessStatus(status);
              if (!isStreamPlaying) {
                setIsStreamPlaying(true);
              }
            }

            // Handle Blink Confirmed Auto-Capture
            if (status.blinkConfirmed && onAutoCaptureRef.current && !isCapturingRef.current) {
              isCapturingRef.current = true;
              setFlashSuccess(true);

              // Capture Full HD uncompressed snapshot
              const video = videoRef.current;
              const snapCanvas = document.createElement('canvas');
              const vw = video.videoWidth || 720;
              const vh = video.videoHeight || 960;
              snapCanvas.width = vw;
              snapCanvas.height = vh;
              const ctx = snapCanvas.getContext('2d');
              if (ctx) {
                ctx.save();
                ctx.translate(vw, 0);
                ctx.scale(-1, 1); // Match mirrored video preview exactly
                ctx.drawImage(video, 0, 0, vw, vh);
                ctx.restore();
              }

              const capturedDataUrl = snapCanvas.toDataURL('image/jpeg', 0.94);

              // Quick haptic pulse
              if (typeof navigator !== 'undefined' && navigator.vibrate) {
                try { navigator.vibrate([40, 60, 40]); } catch {}
              }

              setTimeout(() => {
                if (onAutoCaptureRef.current) {
                  onAutoCaptureRef.current(capturedDataUrl);
                }
                setTimeout(() => setFlashSuccess(false), 500);
              }, 100);
            }
          } catch (err) {
            // Ignore frame errors
          } finally {
            isEvaluatingRef.current = false;
          }
        }
      }

      if (isMountedRef.current && isOpen && !isCapturingRef.current) {
        animId = requestAnimationFrame(loop);
      }
    };

    animId = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(animId);
      isEvaluatingRef.current = false;
    };
  }, [isOpen, enableAutoBlinkCapture, isProcessing, videoRef, isStreamPlaying]);

  if (!isOpen) return null;

  const isAligned = livenessStatus.isAlignedInMask;
  const isBlinkConfirmed = livenessStatus.blinkConfirmed || flashSuccess;

  // Single Spacious Face Oval Path (Fits full head naturally, without inner cramping!)
  const OVAL_PATH = "M150 18 C228 18 280 65 280 172 C280 280 228 354 150 354 C72 354 20 280 20 172 C20 65 72 18 150 18 Z";

  return (
    <div className="relative w-full h-full min-h-[580px] bg-slate-950 flex flex-col overflow-hidden rounded-3xl p-0 border border-slate-800 shadow-2xl">
      {/* 1. Header Bar OUTSIDE Camera Viewport (Above camera screen area) */}
      <div className="w-full px-5 py-4 z-30 flex items-center justify-between bg-slate-900 border-b border-slate-800/80 shrink-0">
        <div className="flex items-center gap-3">
          {icon && (
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-500/15 text-sky-400 border border-sky-500/30 shadow-md">
              {icon}
            </div>
          )}
          <div>
            <h2 className="text-base font-black text-white tracking-tight leading-tight">
              {title}
            </h2>
            {subtitle && (
              <span className="text-[10px] font-bold text-sky-400 uppercase tracking-widest">
                {subtitle}
              </span>
            )}
          </div>
        </div>

        {/* Single Styled Close (X) Icon Button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close camera modal"
          className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-slate-300 transition-all border border-slate-700 shadow-md cursor-pointer"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Edge-to-Edge Camera Viewport Container */}
      <div className="relative w-full aspect-[3/4] bg-slate-950 overflow-hidden flex-1 p-0 flex items-center justify-center">
        {/* Instant HTML Video Element */}
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          onPlay={() => setIsStreamPlaying(true)}
          onPlaying={() => setIsStreamPlaying(true)}
          onLoadedData={() => setIsStreamPlaying(true)}
          onCanPlay={() => setIsStreamPlaying(true)}
          className="absolute inset-0 h-full w-full object-cover transform -scale-x-100"
        />

        {/* Green Flash Animation on Blink Success */}
        {flashSuccess && (
          <div className="absolute inset-0 z-40 bg-emerald-500/35 animate-in fade-in duration-100 backdrop-blur-[2px]" />
        )}

        {/* 2. Unified Single Spacious Oval Face Mask & Outside Dimmed Backdrop */}
        {!hasError && (
          <div className="pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-between p-4">
            {/* Single Spacious Oval Mask Reticle Container (w-[88%] max-w-[340px] aspect-[1/1.24]) */}
            <div
              className={`relative mt-2 w-[88%] max-w-[340px] aspect-[1/1.24] rounded-full transition-all duration-300 flex items-center justify-center shadow-[0_0_0_9999px_rgba(2,6,23,0.70)]`}
            >
              {/* Paytm / KYC Biometric Single Oval Face Mask SVG */}
              <svg
                className="absolute inset-0 w-full h-full pointer-events-none z-20"
                viewBox="0 0 300 372"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <defs>
                  <linearGradient id="timerGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#38bdf8" />
                    <stop offset="50%" stopColor="#34d399" />
                    <stop offset="100%" stopColor="#f59e0b" />
                  </linearGradient>
                  <linearGradient id="timerRedGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#f87171" />
                    <stop offset="50%" stopColor="#ef4444" />
                    <stop offset="100%" stopColor="#dc2626" />
                  </linearGradient>
                </defs>

                {/* 1. Base Oval Mask Outline */}
                <path
                  d={OVAL_PATH}
                  stroke={isAligned ? '#34d399' : '#38bdf8'}
                  strokeWidth={isAligned ? '3.5' : '2.4'}
                  strokeDasharray={isAligned ? 'none' : '7 7'}
                  strokeOpacity={isAligned ? 0.95 : 0.65}
                  className="transition-all duration-300"
                  style={{
                    filter: isAligned
                      ? 'drop-shadow(0 0 14px rgba(52, 211, 153, 0.95))'
                      : 'drop-shadow(0 0 6px rgba(56, 189, 248, 0.45))',
                  }}
                />

                {/* 2. 30-Second Countdown Progress Stroke directly along the SAME Oval Path */}
                {timerSeconds !== undefined && (
                  <path
                    d={OVAL_PATH}
                    stroke={timerSeconds <= 5 ? 'url(#timerRedGradient)' : 'url(#timerGradient)'}
                    strokeWidth="4.5"
                    strokeLinecap="round"
                    pathLength="100"
                    strokeDasharray="100"
                    fill="none"
                    className={timerSeconds <= 5 ? 'animate-pulse' : ''}
                    style={{
                      strokeDashoffset: `${100 - (Math.max(0, Math.min(30, timerSeconds)) / 30) * 100}`,
                      transition: 'stroke-dashoffset 1s linear',
                      filter:
                        timerSeconds <= 5
                          ? 'drop-shadow(0px 0px 8px rgba(239, 68, 68, 0.9))'
                          : 'drop-shadow(0px 0px 6px rgba(56, 189, 248, 0.6))',
                    }}
                  />
                )}

                {/* 3. Left Eye Target Guide Crosshairs */}
                <g transform="translate(98, 142)" opacity={isAligned ? 0.95 : 0.6}>
                  <circle
                    cx="0"
                    cy="0"
                    r="15"
                    stroke={isAligned ? '#34d399' : '#38bdf8'}
                    strokeWidth="1.5"
                    strokeDasharray="3 3"
                  />
                  <circle cx="0" cy="0" r="2.5" fill={isAligned ? '#34d399' : '#38bdf8'} />
                  <path
                    d="M-18 0 H18 M0 -18 V18"
                    stroke={isAligned ? '#34d399' : '#38bdf8'}
                    strokeWidth="1.2"
                    strokeOpacity="0.6"
                  />
                </g>

                {/* 4. Right Eye Target Guide Crosshairs */}
                <g transform="translate(202, 142)" opacity={isAligned ? 0.95 : 0.6}>
                  <circle
                    cx="0"
                    cy="0"
                    r="15"
                    stroke={isAligned ? '#34d399' : '#38bdf8'}
                    strokeWidth="1.5"
                    strokeDasharray="3 3"
                  />
                  <circle cx="0" cy="0" r="2.5" fill={isAligned ? '#34d399' : '#38bdf8'} />
                  <path
                    d="M-18 0 H18 M0 -18 V18"
                    stroke={isAligned ? '#34d399' : '#38bdf8'}
                    strokeWidth="1.2"
                    strokeOpacity="0.6"
                  />
                </g>

                {/* 5. Nose Bridge Alignment Indicator */}
                <path
                  d="M150 170 L146 198 H154 L150 170"
                  stroke={isAligned ? '#34d399' : '#38bdf8'}
                  strokeWidth="1.6"
                  strokeOpacity={isAligned ? 0.7 : 0.4}
                />

                {/* 6. Forehead Crown Arc */}
                <path
                  d="M105 48 Q150 32 195 48"
                  stroke={isAligned ? '#34d399' : '#38bdf8'}
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeOpacity={isAligned ? 0.9 : 0.5}
                />

                {/* 7. Chin Rest Notch */}
                <path
                  d="M125 354 H175"
                  stroke={isAligned ? '#34d399' : '#38bdf8'}
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeOpacity={isAligned ? 0.9 : 0.5}
                />
              </svg>

              {/* Top & Bottom Accent Alignment Markers */}
              <div
                className={`absolute -top-1 left-1/2 h-3 w-8 -translate-x-1/2 rounded-full transition-colors z-30 ${
                  isAligned ? 'bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.9)]' : 'bg-sky-400/90 shadow-[0_0_10px_rgba(56,189,248,0.8)]'
                }`}
              />
              <div
                className={`absolute -bottom-1 left-1/2 h-3 w-8 -translate-x-1/2 rounded-full transition-colors z-30 ${
                  isAligned ? 'bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.9)]' : 'bg-sky-400/90 shadow-[0_0_10px_rgba(56,189,248,0.8)]'
                }`}
              />
            </div>

            {/* 3. Real-time Status Badge & Dynamic Flow Guidance Indicator Overlay */}
            <div className="z-30 mb-1 rounded-full bg-slate-900/95 px-4 py-2 backdrop-blur-md border border-slate-700 shadow-xl flex items-center gap-2">
              {isProcessing ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-sky-400/30 border-t-sky-400 shrink-0" />
                  <p className="text-xs font-bold text-sky-300">
                    {statusText || 'Verifying face biometrics...'}
                  </p>
                </>
              ) : !isStreamPlaying ? (
                <>
                  <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-sky-400/30 border-t-sky-400 shrink-0" />
                  <p className="text-xs font-bold text-sky-300">
                    Starting HD Camera...
                  </p>
                </>
              ) : isBlinkConfirmed ? (
                <>
                  <div className="h-3 w-3 rounded-full bg-emerald-400 animate-ping shrink-0" />
                  <p className="text-xs font-black text-emerald-400">
                    {statusText || 'Blink Verified! Capturing... 📸'}
                  </p>
                </>
              ) : isAligned ? (
                <>
                  <span className="text-sm">👁️</span>
                  <p className="text-xs font-black text-emerald-300 animate-pulse">
                    {statusText || 'Blink your eyes to capture'}
                  </p>
                </>
              ) : (
                <>
                  <div className="h-2.5 w-2.5 rounded-full bg-sky-400 shrink-0" />
                  <p className="text-xs font-bold text-sky-300">
                    {statusText || livenessStatus.prompt || 'Position face in mask'}
                  </p>
                </>
              )}
            </div>
          </div>
        )}

        {/* Camera Error State Overlay */}
        {hasError && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-slate-950 p-6 text-center text-white">
            <AlertCircle className="mb-3 h-12 w-12 text-red-400" />
            <p className="mb-4 text-sm text-red-200">{errorMessage}</p>
            <button
              type="button"
              onClick={() => startCamera()}
              className="flex items-center gap-2 rounded-2xl bg-sky-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-sky-500 shadow-lg cursor-pointer"
            >
              <RefreshCw className="h-4 w-4" /> Retry Camera
            </button>
          </div>
        )}

        {/* Custom Inner Slots */}
        {children}
      </div>

      {/* 4. Footer Slot Container */}
      {footerSlot && (
        <div className="w-full bg-slate-950 p-4 border-t border-slate-900 z-30 shrink-0">
          {footerSlot}
        </div>
      )}
    </div>
  );
};

export default BiometricCameraModal;
