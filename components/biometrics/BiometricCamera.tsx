'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Camera, AlertCircle, RefreshCw } from 'lucide-react';
import { BIOMETRIC_CAMERA_CONFIG } from '@/lib/face-pipeline';

interface BiometricCameraProps {
  onStreamReady?: (stream: MediaStream, videoEl: HTMLVideoElement) => void;
  onCameraError?: (error: Error) => void;
  className?: string;
  showOverlay?: boolean;
  overlayLabel?: string;
  isProcessing?: boolean;
  statusText?: string;
  videoRefOut?: React.RefObject<HTMLVideoElement | null>;
  children?: React.ReactNode;
}

export const BiometricCamera: React.FC<BiometricCameraProps> = ({
  onStreamReady,
  onCameraError,
  className = '',
  showOverlay = true,
  overlayLabel = 'Position face inside the oval',
  isProcessing = false,
  statusText,
  videoRefOut,
  children,
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

  const [cameraState, setCameraState] = useState<'initializing' | 'active' | 'error'>('initializing');
  const [errorMessage, setErrorMessage] = useState<string>('');

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  const startCamera = useCallback(async () => {
    // If stream is already active and playing, don't restart it
    if (streamRef.current && streamRef.current.active && cameraState === 'active') {
      return;
    }

    stopStream();
    setCameraState('initializing');
    setErrorMessage('');

    try {
      // Primary constraint: 480x640 (3:4 portrait) standard
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
      } catch (firstErr) {
        // Fallback for devices that reject specific width/height constraints
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

        await new Promise<void>((resolve) => {
          if (video.readyState >= 2) {
            resolve();
          } else {
            video.onloadeddata = () => resolve();
          }
        });

        await video.play().catch(() => {});
        setCameraState('active');

        if (onStreamReadyRef.current) {
          onStreamReadyRef.current(stream, video);
        }
      }
    } catch (err: any) {
      if (!isMountedRef.current) return;
      console.error('[BiometricCamera] Failed to access camera:', err);
      setCameraState('error');
      const msg =
        err?.name === 'NotAllowedError'
          ? 'Camera permission denied. Please allow camera access in browser settings.'
          : err?.message || 'Failed to start camera';
      setErrorMessage(msg);
      if (onCameraErrorRef.current) {
        onCameraErrorRef.current(err);
      }
    }
  }, [stopStream, videoRef, cameraState]);

  useEffect(() => {
    isMountedRef.current = true;
    startCamera();

    return () => {
      isMountedRef.current = false;
      stopStream();
    };
  }, []); // Run ONCE on mount

  return (
    <div className={`relative aspect-[3/4] w-full max-w-sm overflow-hidden rounded-2xl bg-gray-950 shadow-2xl border border-gray-800 ${className}`}>
      {/* HTML Video Element */}
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        className="h-full w-full object-cover transform -scale-x-100"
      />

      {/* Loading state */}
      {cameraState === 'initializing' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-950/90 p-4 text-center text-white">
          <div className="mb-3 h-10 w-10 animate-spin rounded-full border-4 border-blue-500/30 border-t-blue-500" />
          <p className="text-sm font-medium text-gray-300">Starting camera feed...</p>
        </div>
      )}

      {/* Error state */}
      {cameraState === 'error' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-950/95 p-6 text-center text-white">
          <AlertCircle className="mb-3 h-12 w-12 text-red-400" />
          <p className="mb-4 text-sm text-red-200">{errorMessage}</p>
          <button
            onClick={() => startCamera()}
            className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500"
          >
            <RefreshCw className="h-4 w-4" /> Try Again
          </button>
        </div>
      )}

      {/* Biometric Oval Frame Overlay */}
      {showOverlay && cameraState === 'active' && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-between p-6">
          {/* Target Oval */}
          <div className="relative mt-6 h-[72%] w-[82%] rounded-[50%] border-2 border-dashed border-white/50 shadow-[0_0_0_9999px_rgba(0,0,0,0.4)] transition-colors duration-300">
            {/* Top & Bottom Accent Markers */}
            <div className="absolute -top-1 left-1/2 h-3 w-8 -translate-x-1/2 rounded-full bg-blue-500/80" />
            <div className="absolute -bottom-1 left-1/2 h-3 w-8 -translate-x-1/2 rounded-full bg-blue-500/80" />
          </div>

          {/* Status Badge */}
          <div className="z-10 mb-2 rounded-full bg-black/65 px-4 py-1.5 backdrop-blur-md">
            <p className="text-xs font-medium text-white/90">
              {statusText || overlayLabel}
            </p>
          </div>
        </div>
      )}

      {/* Processing Spinner Overlay */}
      {isProcessing && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/60 backdrop-blur-xs text-white">
          <div className="mb-3 h-12 w-12 animate-spin rounded-full border-4 border-blue-400/30 border-t-blue-400" />
          <p className="text-sm font-semibold">{statusText || 'Processing face...'}</p>
        </div>
      )}

      {/* Custom Children Slots */}
      {children}
    </div>
  );
};

export default BiometricCamera;
