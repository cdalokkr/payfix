'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { X, RefreshCw, AlertCircle } from 'lucide-react';
import { BIOMETRIC_CAMERA_CONFIG } from '@/lib/face-pipeline';

interface BiometricCameraModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string | React.ReactNode;
  subtitle?: string;
  icon?: React.ReactNode;
  videoRefOut?: React.RefObject<HTMLVideoElement | null>;
  onStreamReady?: (stream: MediaStream, videoEl: HTMLVideoElement) => void;
  onCameraError?: (error: Error) => void;
  statusText?: string;
  isProcessing?: boolean;
  footerSlot?: React.ReactNode;
  children?: React.ReactNode;
  timerSeconds?: number;
}

export const BiometricCameraModal: React.FC<BiometricCameraModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  icon,
  videoRefOut,
  onStreamReady,
  onCameraError,
  statusText,
  isProcessing = false,
  footerSlot,
  children,
  timerSeconds,
}) => {

  const internalVideoRef = useRef<HTMLVideoElement | null>(null);
  const videoRef = videoRefOut || internalVideoRef;
  const streamRef = useRef<MediaStream | null>(null);
  const isMountedRef = useRef(true);

  // Store callback refs so parent re-renders never restart stream
  const onStreamReadyRef = useRef(onStreamReady);
  const onCameraErrorRef = useRef(onCameraError);
  useEffect(() => {
    onStreamReadyRef.current = onStreamReady;
    onCameraErrorRef.current = onCameraError;
  }, [onStreamReady, onCameraError]);

  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  const startCamera = useCallback(async () => {
    if (!isOpen) return;

    // Stream is active — DO NOT STOP stream!
    if (streamRef.current && streamRef.current.active) {
      if (videoRef.current && videoRef.current.srcObject !== streamRef.current) {
        videoRef.current.srcObject = streamRef.current;
        videoRef.current.play().catch(() => {});
      }
      return;
    }

    setHasError(false);

    try {
      const primaryConstraints: MediaStreamConstraints = {
        video: {
          facingMode: BIOMETRIC_CAMERA_CONFIG.facingMode,
          width: { ideal: BIOMETRIC_CAMERA_CONFIG.width },
          height: { ideal: BIOMETRIC_CAMERA_CONFIG.height },
          aspectRatio: { ideal: BIOMETRIC_CAMERA_CONFIG.aspectRatio },
        },
        audio: false,
      };

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia(primaryConstraints);
      } catch (e) {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user' },
          audio: false,
        });
      }

      if (!isMountedRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      streamRef.current = stream;

      if (videoRef.current) {
        const video = videoRef.current;
        video.srcObject = stream;
        video.setAttribute('playsinline', 'true');
        video.muted = true;
        // Asynchronous play without blocking rendering
        video.play().catch(() => {});

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
  }, [isOpen, videoRef]);

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

  if (!isOpen) return null;

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

        {/* Styled Close (X) Icon Button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close modal"
          className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-slate-300 transition-all border border-slate-700 shadow-md cursor-pointer"
        >
          <X className="h-5 w-5" />
        </button>
      </div>


      {/* Edge-to-Edge Camera Viewport Container */}
      <div className="relative w-full aspect-[3/4] bg-black overflow-hidden flex-1 p-0">
        {/* Instant HTML Video Element */}
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className="h-full w-full object-cover transform -scale-x-100"
        />

        {/* 2. Biometric Oval Reticle with Outside Dimmed Backdrop Overlay */}

        {!hasError && (
          <div className="pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-between p-6">
            {/* Circular Face Guide Reticle (5% Larger w-[81%]) with 9999px Dimmed Backdrop Mask */}
            <div className={`relative mt-8 w-[81%] aspect-square rounded-full border-2 border-dashed transition-all duration-300 flex items-center justify-center ${
              timerSeconds !== undefined && timerSeconds <= 3
                ? 'border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.8)] animate-pulse'
                : 'border-sky-400/80 shadow-[0_0_0_9999px_rgba(2,6,23,0.65)]'
            }`}>
              {/* 10-Second Dynamic Circular Countdown Progress Ring around face circle */}
              {timerSeconds !== undefined && (
                <svg className="absolute -inset-3 w-[calc(100%+24px)] h-[calc(100%+24px)] transform -rotate-90 pointer-events-none z-30">
                  <circle
                    cx="50%"
                    cy="50%"
                    r="47%"
                    stroke={timerSeconds <= 3 ? "rgba(239, 68, 68, 0.25)" : "rgba(56, 189, 248, 0.2)"}
                    strokeWidth="4"
                    fill="transparent"
                  />
                  <circle
                    cx="50%"
                    cy="50%"
                    r="47%"
                    stroke={timerSeconds <= 3 ? "url(#timerRedGradient)" : "url(#timerGradient)"}
                    strokeWidth="6"
                    fill="transparent"
                    strokeLinecap="round"
                    pathLength="100"
                    strokeDasharray="100"
                    className={timerSeconds <= 3 ? "animate-pulse" : ""}
                    style={{
                      strokeDashoffset: `${100 - (Math.max(0, Math.min(10, timerSeconds)) / 10) * 100}`,
                      transition: 'stroke-dashoffset 1s linear',
                      filter: timerSeconds <= 3 ? 'drop-shadow(0px 0px 8px rgba(239, 68, 68, 0.9))' : 'drop-shadow(0px 0px 6px rgba(56, 189, 248, 0.6))',
                    }}
                  />
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
                </svg>
              )}

              <div className="absolute -top-1 left-1/2 h-3 w-8 -translate-x-1/2 rounded-full bg-sky-400/90 shadow-[0_0_10px_rgba(56,189,248,0.8)]" />
              <div className="absolute -bottom-1 left-1/2 h-3 w-8 -translate-x-1/2 rounded-full bg-sky-400/90 shadow-[0_0_10px_rgba(56,189,248,0.8)]" />
            </div>

            {/* Status Badge & Processing Indicator Overlay (Positioned below face area without blurring selfie) */}
            {(statusText || isProcessing) && (
              <div className="z-30 mb-2 rounded-full bg-slate-900/90 px-4 py-2 backdrop-blur-md border border-sky-500/30 shadow-xl flex items-center gap-2">
                {isProcessing && (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-sky-400/30 border-t-sky-400 shrink-0" />
                )}
                <p className="text-xs font-bold text-sky-300">
                  {statusText || 'Extracting face vector & matching...'}
                </p>
              </div>
            )}
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

      {/* 3. Footer Slot Container */}
      {footerSlot && (
        <div className="w-full bg-slate-950 p-5 border-t border-slate-900 z-30 shrink-0">
          {footerSlot}
        </div>
      )}
    </div>
  );
};

export default BiometricCameraModal;
