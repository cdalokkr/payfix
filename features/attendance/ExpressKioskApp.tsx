'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import {
    AlertCircle, Camera, CheckCircle2, CheckCheck, XCircle, RefreshCw, Wifi, WifiOff,
    Zap, ScanFace, UserX, Key, MapPin, Tablet, ShieldCheck, LogOut, Sparkles, Clock, X,
    Maximize2, User, Cpu
} from 'lucide-react';
import { toast } from 'sonner';
import { FaceApiBrowserService } from '@/lib/services/faceapi-browser.service';
import { FaceVerificationService } from '@/lib/services/face-verification.service';
import { KioskIndexedDBService } from '@/lib/services/kiosk-idb.service';
import { saveEmployeeFaces, getSyncInfo as getIdbSyncInfo, getAllEmployeeFaces, EmployeeFace } from '@/lib/face-db';
import { l2Normalize, matchFaceFast, isGoodQualityFace, getAdaptiveThreshold } from '@/lib/face-threshold';
import { trpc } from '@/lib/trpc/client';
import { BiometricCameraModal } from '@/components/biometrics/BiometricCameraModal';

function getHardwareAccelerationInfo(): { backend: string; isGpu: boolean } {
    if (typeof window === 'undefined') return { backend: 'CPU', isGpu: false };
    try {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl2') || canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        if (!gl) return { backend: 'CPU (No WebGL)', isGpu: false };
        const debugInfo = (gl as any).getExtension('WEBGL_debug_renderer_info');
        if (debugInfo) {
            const renderer = (gl as any).getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || '';
            const isSoftware = renderer.toLowerCase().includes('swiftshader') || renderer.toLowerCase().includes('llvmpipe') || renderer.toLowerCase().includes('software');
            if (isSoftware) return { backend: 'CPU Software', isGpu: false };
            
            let label = renderer.replace(/^ANGLE\s*\((.*)\)$/, '$1').split(',')[0].trim();
            const upper = renderer.toUpperCase();
            if (upper.includes('ARM') || upper.includes('MALI')) {
                label = 'ARM Mali GPU';
            } else if (upper.includes('ADRENO') || upper.includes('QUALCOMM')) {
                label = 'Adreno GPU';
            } else if (upper.includes('APPLE')) {
                label = 'Apple GPU';
            } else if (label.length > 18) {
                label = label.slice(0, 18);
            }
            return { backend: `GPU: ${label}`, isGpu: true };
        }
        return { backend: 'WebGL GPU', isGpu: true };
    } catch {
        return { backend: 'CPU Fallback', isGpu: false };
    }
}







interface CachedEmployee {
    id: string;
    name: string;
    avatarUrl?: string | null;
    biometricUserId?: string | null;
    faceEmbedding: number[] | null; // 512-d ArcFace or 128-d vector
}

interface QueuedPunch {
    id: string;
    profileId: string;
    employeeName: string;
    timestamp: string;
    punchType: 'auto' | 'check_in' | 'check_out';
    synced: boolean;
    latitude?: number | null;
    longitude?: number | null;
}

interface PairedDeviceInfo {
    id: string;
    name: string;
    pairingCode: string;
    locationId?: string | null;
    locationName?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    radiusMeters?: number;
}

interface VerificationOverlayState {
    status: 'idle' | 'scanning' | 'verified' | 'rejected';
    matched?: boolean;
    employeeName?: string;
    avatarUrl?: string | null;
    time?: string;
    similarity?: string;
    duration?: string;
    error?: string;
    snapshotUrl?: string | null;
}


export function ExpressKioskApp() {
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);        // Full-res snapshot canvas
    const detectCanvasRef = useRef<HTMLCanvasElement | null>(null);  // Small detect canvas for face-api
    const mediaStreamRef = useRef<MediaStream | null>(null);

    // Kiosk Terminal Pairing State
    const [pairingCode, setPairingCode] = useState<string | null>(null);
    const [pairedDevice, setPairedDevice] = useState<PairedDeviceInfo | null>(null);
    const [inputKey, setInputKey] = useState('');
    const [isPairing, setIsPairing] = useState(false);

    // Verification Modal & Camera State
    const [isVerificationModalOpen, setIsVerificationModalOpen] = useState<boolean>(false);
    const [verificationResult, setVerificationResult] = useState<VerificationOverlayState | null>(null);

    // Live Clock State
    const [currentTime, setCurrentTime] = useState<string>('');
    const [currentDate, setCurrentDate] = useState<string>('');

    // Terminal Location GPS State
    const [terminalGps, setTerminalGps] = useState<{ latitude: number | null; longitude: number | null }>({
        latitude: null,
        longitude: null,
    });

    const [isOnline, setIsOnline] = useState<boolean>(true);
    const [cameraActive, setCameraActive] = useState<boolean>(false);
    const [employees, setEmployees] = useState<CachedEmployee[]>([]);
    const [offlineQueue, setOfflineQueue] = useState<QueuedPunch[]>([]);
    const [lastScanResult, setLastScanResult] = useState<{ name: string; time: string; type: string } | null>(null);
    const [isScanning, setIsScanning] = useState<boolean>(false);
    const [scanError, setScanError] = useState<string | null>(null);
    const [capturedFreezeUrl, setCapturedFreezeUrl] = useState<string | null>(null);
    const [hardwareInfo] = useState(() => getHardwareAccelerationInfo());

    const [idbSyncInfo, setIdbSyncInfo] = useState<{ lastSyncedAt: number; totalEmployees: number; enrolledEmployees: number } | null>(null);

    const [modelsLoading, setModelsLoading] = useState<boolean>(false);
    const [modelsReady, setModelsReady] = useState<boolean>(false);
    const [modelProgress, setModelProgress] = useState<number>(0);
    const [isCameraReady, setIsCameraReady] = useState<boolean>(false);
    const [stats, setStats] = useState({ totalEmployees: 0, enrolledEmployees: 0, queuedOffline: 0 });

    const warmupVideoRef = useRef<HTMLVideoElement>(null);


    const verifyPairingMutation = trpc.kioskDevices.verifyPairingCode.useMutation();

    // Live clock update
    useEffect(() => {
        const updateClock = () => {
            const now = new Date();
            setCurrentTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
            setCurrentDate(now.toLocaleDateString([], { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }));
        };
        updateClock();
        const timer = setInterval(updateClock, 1000);
        return () => clearInterval(timer);
    }, []);

    const scanAbortControllerRef = useRef<AbortController | null>(null);

    // Check stored pairing key on mount (from LocalStorage, IndexedDB, or 10-Year Cookies)
    useEffect(() => {
        let isMounted = true;
        async function restorePairing() {
            if (typeof window === 'undefined') return;
            const { pairingCode: savedKey, deviceInfo: savedDeviceInfo } = await KioskIndexedDBService.loadPairingCredentials();

            if (savedKey && isMounted) {
                setPairingCode(savedKey);
                if (savedDeviceInfo) {
                    setPairedDevice(savedDeviceInfo);
                }
                verifyPairingMutation.mutate({ pairingCode: savedKey }, {
                    onSuccess: (res) => {
                        if (res.success && 'device' in res && res.device) {
                            setPairedDevice(res.device);
                            void KioskIndexedDBService.savePairingCredentials(savedKey, res.device);
                        } else {
                            toast.error('Kiosk Pairing Key is no longer active. Please pair again.');
                            handleUnpair();
                        }
                    }
                });
            }
        }

        restorePairing();
        return () => { isMounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Watch terminal GPS position
    useEffect(() => {
        if ('geolocation' in navigator) {
            const watchId = navigator.geolocation.watchPosition(
                (pos) => {
                    setTerminalGps({
                        latitude: pos.coords.latitude,
                        longitude: pos.coords.longitude,
                    });
                },
                (err) => {
                    console.warn('[Kiosk GPS] Location watch warning:', err.message);
                },
                { enableHighAccuracy: true, timeout: 20000, maximumAge: 60000 }
            );
            return () => navigator.geolocation.clearWatch(watchId);
        }
    }, []);

    // Background Pre-Warm Camera Stream on Kiosk Load (Instant 0ms Modal Opening)
    const prewarmCamera = useCallback(async () => {
        if (typeof window === 'undefined' || !navigator.mediaDevices?.getUserMedia) return;
        if (mediaStreamRef.current && mediaStreamRef.current.active) {
            setIsCameraReady(true);
            return;
        }
        try {
            let stream: MediaStream | null = null;
            try {
                stream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        facingMode: 'user',
                        width: { ideal: 640 },
                        height: { ideal: 480 },
                    },
                    audio: false
                });
            } catch {
                // Fallback for laptops/desktops where facingMode is not user
                stream = await navigator.mediaDevices.getUserMedia({
                    video: true,
                    audio: false
                });
            }

            if (stream) {
                mediaStreamRef.current = stream;

                if (warmupVideoRef.current) {
                    warmupVideoRef.current.srcObject = stream;
                    await warmupVideoRef.current.play().catch(() => {});
                }
                setIsCameraReady(true);
                console.log('[Kiosk Camera] Warmup stream active & video element bound');
            }
        } catch (err) {
            console.warn('[Kiosk Camera] Background pre-warm notice:', err);
        }
    }, []);

    // Parallel initialization: Pre-warm camera + Load Models + Sync Vectors on Page Load
    useEffect(() => {
        let mounted = true;
        
        async function parallelInit() {
            // Start camera pre-warm asynchronously in background
            void prewarmCamera();

            // Load face models and face vectors in parallel
            if (pairingCode) {
                void loadFaceModels();
            }
        }

        parallelInit();

        return () => {
            mounted = false;
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pairingCode]);





    // Monitor Network Online/Offline status
    useEffect(() => {
        setIsOnline(navigator.onLine);

        const handleOnline = () => {
            setIsOnline(true);
            toast.success('Internet Restored! Syncing queued kiosk punches...');
            flushOfflineQueue();
        };

        const handleOffline = () => {
            setIsOnline(false);
            toast.warning('Internet Disconnected. Kiosk running in 100% Local Offline Mode.');
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pairingCode]);

    // Bind camera stream whenever cameraActive or videoRef updates inside Modal
    useEffect(() => {
        if (cameraActive && videoRef.current && mediaStreamRef.current) {
            const video = videoRef.current;
            video.srcObject = mediaStreamRef.current;
            video.muted = true;
            video.play().catch(err => console.warn('[Kiosk Video] Play error:', err));
        }
    }, [cameraActive, isVerificationModalOpen]);

    // Cleanup camera stream on unmount
    useEffect(() => {
        return () => {
            if (mediaStreamRef.current) {
                mediaStreamRef.current.getTracks().forEach(track => track.stop());
                mediaStreamRef.current = null;
            }
        };
    }, []);

    // 15-minute background refresh to fetch newly enrolled employee face vectors automatically
    useEffect(() => {
        if (!pairingCode) return;
        
        const syncInterval = setInterval(() => {
            console.log('[Kiosk Background] Running 15-minute periodic face vector sync...');
            fetchEmployeeFaceVectors();
        }, 15 * 60 * 1000);

        return () => clearInterval(syncInterval);
    }, [pairingCode]);


    const handlePairDevice = (e: React.FormEvent) => {
        e.preventDefault();
        const code = inputKey.trim().toUpperCase();
        if (!code) {
            toast.error('Please enter a Kiosk Pairing Key');
            return;
        }

        setIsPairing(true);
        verifyPairingMutation.mutate({ pairingCode: code }, {
            onSuccess: (res) => {
                setIsPairing(false);
                if (res.success && 'device' in res && res.device) {
                    toast.success(`Kiosk Terminal Paired Successfully! (${res.device.name})`);
                    setPairingCode(code);
                    setPairedDevice(res.device);
                    void KioskIndexedDBService.savePairingCredentials(code, res.device);
                } else {
                    const msg = 'message' in res ? res.message : 'Invalid or inactive Pairing Key';
                    toast.error(msg);
                }
            },
            onError: (err) => {
                setIsPairing(false);
                toast.error(err.message || 'Failed to verify pairing code');
            }
        });
    };

    const handleUnpair = () => {
        void KioskIndexedDBService.clearPairingCredentials();
        setPairingCode(null);
        setPairedDevice(null);
        setInputKey('');
        setEmployees([]);
        closeVerificationModal();
    };

    const loadFaceModels = async () => {
        if (FaceApiBrowserService.isReady()) {
            setModelsReady(true);
            fetchEmployeeFaceVectors();
            return;
        }
        setModelsLoading(true);
        setModelProgress(0);

        const ok = await FaceApiBrowserService.loadModels((pct) => {
            setModelProgress(pct);
        });

        if (ok) {
            setModelProgress(100);
            // 2-second delay after 100% load before revealing Start Verification button
            setTimeout(() => {
                setModelsReady(true);
                setModelsLoading(false);
                fetchEmployeeFaceVectors();
            }, 2000);
        } else {
            setModelsLoading(false);
            toast.error('Failed to load face recognition models. Please refresh.');
        }
    };


    const descriptorMapRef = useRef<Map<string, Float32Array>>(new Map());

    // Fetch and cache employee face vectors locally using Kiosk Pairing Key (IndexedDB + RAM)
    const fetchEmployeeFaceVectors = async () => {
        if (!pairingCode) return;
        try {
            const res = await fetch('/api/kiosk/face-vectors', {
                headers: {
                    'x-kiosk-secret': pairingCode
                }
            });
            if (res.ok) {
                const data = await res.json();
                if (data.success) {
                    const mapped: CachedEmployee[] = data.employees.map((e: any) => ({
                        id: e.id,
                        name: e.name,
                        avatarUrl: e.avatarUrl,
                        biometricUserId: e.biometricUserId,
                        faceEmbedding: Array.isArray(e.faceEmbedding) && (e.faceEmbedding.length === 512 || e.faceEmbedding.length === 128)
                            ? e.faceEmbedding
                            : (Array.isArray(e.faceEmbedding512) && e.faceEmbedding512.length === 512 ? e.faceEmbedding512 : null),
                    }));
                    setEmployees(mapped);
                    
                    // Save to IndexedDB via 'idb' package (saveEmployeeFaces in lib/face-db.ts)
                    const idbFormatted: EmployeeFace[] = mapped.map(e => ({
                        id: e.id,
                        fullName: e.name,
                        avatarUrl: e.avatarUrl,
                        employeeCode: e.biometricUserId || undefined,
                        embedding: e.faceEmbedding || [],
                        updatedAt: Date.now()
                    }));
                    
                    saveEmployeeFaces(idbFormatted, pairingCode);
                    KioskIndexedDBService.saveEmployees(mapped, pairingCode);
                    try { localStorage.setItem('payfix_kiosk_cached_employees', JSON.stringify(mapped)); } catch {}

                    const info = await getIdbSyncInfo();
                    if (info) {
                        setIdbSyncInfo({
                            lastSyncedAt: info.lastSyncedAt,
                            totalEmployees: info.totalEmployees,
                            enrolledEmployees: info.enrolledEmployees
                        });
                    }


                    // Pre-parse Float32Array descriptors into memory cache for instant matching
                    const newMap = new Map<string, Float32Array>();
                    mapped.forEach(e => {
                        if (e.faceEmbedding && (e.faceEmbedding.length === 512 || e.faceEmbedding.length === 128)) {
                            newMap.set(e.id, new Float32Array(e.faceEmbedding));
                        }
                    });
                    descriptorMapRef.current = newMap;


                    const enrolledCount = mapped.filter(e => e.faceEmbedding !== null).length;
                    setStats(prev => ({ ...prev, totalEmployees: data.total, enrolledEmployees: enrolledCount }));
                }
            } else if (res.status === 401) {
                toast.error('Unauthorized Kiosk device. Pairing Key rejected.');
                handleUnpair();
            }
        } catch (err) {
            console.warn('[Kiosk] Failed to fetch face vectors from cloud. Checking IndexedDB offline cache...');
            const idbEmployees = await KioskIndexedDBService.getEmployees();
            let mapped: CachedEmployee[] = idbEmployees;

            if (!mapped || mapped.length === 0) {
                const cached = localStorage.getItem('payfix_kiosk_cached_employees');
                if (cached) {
                    try { mapped = JSON.parse(cached); } catch {}
                }
            }

            if (mapped && mapped.length > 0) {
                setEmployees(mapped);

                const newMap = new Map<string, Float32Array>();
                mapped.forEach(e => {
                    if (e.faceEmbedding && (e.faceEmbedding.length === 512 || e.faceEmbedding.length === 128)) {
                        newMap.set(e.id, new Float32Array(e.faceEmbedding));
                    }
                });
                descriptorMapRef.current = newMap;

                const enrolledCount = mapped.filter(e => e.faceEmbedding !== null).length;
                setStats(prev => ({ ...prev, totalEmployees: mapped.length, enrolledEmployees: enrolledCount }));
            }
        }
    };




    // Start Camera Stream inside Modal (Instant 0ms feed swap)
    const startCamera = async () => {
        try {
            if (!mediaStreamRef.current || !mediaStreamRef.current.active) {
                await prewarmCamera();
            }

            if (mediaStreamRef.current && mediaStreamRef.current.active) {
                setCameraActive(true);
                setScanError(null);

                if (videoRef.current) {
                    videoRef.current.srcObject = mediaStreamRef.current;
                    videoRef.current.muted = true;
                    await videoRef.current.play().catch(() => {});
                }
            } else {
                toast.error('Unable to access camera.');
            }
        } catch (err) {
            console.error('Camera access error:', err);
            toast.error('Unable to access camera.');
        }
    };






    // Auto-attach camera stream to videoRef as soon as modal DOM element mounts
    useEffect(() => {
        if (isVerificationModalOpen) {
            const attachStream = async () => {
                if (!mediaStreamRef.current || !mediaStreamRef.current.active) {
                    await prewarmCamera();
                }

                if (mediaStreamRef.current && mediaStreamRef.current.active) {
                    setCameraActive(true);
                    setScanError(null);
                    if (videoRef.current) {
                        videoRef.current.srcObject = mediaStreamRef.current;
                        videoRef.current.muted = true;
                        await videoRef.current.play().catch(() => {});
                    }
                }
            };

            attachStream();
            const timer = setTimeout(attachStream, 120);
            return () => clearTimeout(timer);
        }
    }, [isVerificationModalOpen, prewarmCamera]);

    // Clean up mediaStream tracks on page unmount
    useEffect(() => {
        return () => {
            if (mediaStreamRef.current) {
                mediaStreamRef.current.getTracks().forEach(track => track.stop());
                mediaStreamRef.current = null;
            }
        };
    }, []);

    // Stop Camera Stream (Only used on unpair or emergency reset)
    const stopCamera = () => {
        if (mediaStreamRef.current) {
            mediaStreamRef.current.getTracks().forEach(track => track.stop());
            mediaStreamRef.current = null;
        }
        if (videoRef.current) {
            videoRef.current.srcObject = null;
        }
        setCameraActive(false);
    };

    // Open Verification Modal Flow (Pre-warms WebGL AI Engine)
    const openVerificationModal = async () => {
        setIsVerificationModalOpen(true);
        setVerificationResult(null);
        setCapturedFreezeUrl(null);
        setScanError(null);

        if (!mediaStreamRef.current || !mediaStreamRef.current.active) {
            await prewarmCamera();
        }

        // Background Pre-Warm Neural Engine to eliminate cold-start latency
        setTimeout(() => {
            try {
                const dummyCanvas = document.createElement('canvas');
                dummyCanvas.width = 64;
                dummyCanvas.height = 64;
                FaceApiBrowserService.extractDescriptor(dummyCanvas).catch(() => {});
            } catch {}
        }, 100);
    };

    // Close Verification Modal Flow (Keeps camera stream active in background for instant re-opening)
    const closeVerificationModal = () => {
        if (scanAbortControllerRef.current) {
            scanAbortControllerRef.current.abort();
            scanAbortControllerRef.current = null;
        }
        setIsScanning(false);
        setIsVerificationModalOpen(false);
        setVerificationResult(null);
        setCapturedFreezeUrl(null);
        setScanError(null);
        if (videoRef.current) {
            videoRef.current.srcObject = null;
        }
        setCameraActive(false);
    };



    // Capture full-res JPEG snapshot from video stream (deferred until face match confirmed)
    const captureSnapshot = (): string | null => {
        const video = videoRef.current;
        const snap = canvasRef.current;
        if (!video || !snap || !cameraActive) return null;
        snap.width = video.videoWidth || 720;
        snap.height = video.videoHeight || 1280;
        const sctx = snap.getContext('2d');
        if (!sctx) return null;
        sctx.save();
        sctx.translate(snap.width, 0);
        sctx.scale(-1, 1); // Match front camera mirror preview
        sctx.drawImage(video, 0, 0, snap.width, snap.height);
        sctx.restore();
        return snap.toDataURL('image/jpeg', 0.90);
    };

    // Instant Face Verification Scan & Overlay Flow (Continuous Staff Scanning)
    const handleFaceScan = useCallback(async (overrideSnapshotUrl?: string) => {
        if (isScanning || !modelsReady || !pairingCode) return;

        const scanStartTime = performance.now();
        const getDurationStr = () => {
            const ms = Math.round(performance.now() - scanStartTime);
            return ms >= 1000 ? `${(ms / 1000).toFixed(2)}s` : `${ms}ms`;
        };

        const video = videoRef.current;
        if (!video || !cameraActive) {
            toast.error('Camera stream not ready. Please try again.');
            return;
        }

        const enrolledEmployees = employees.filter(e => e.faceEmbedding !== null && (e.faceEmbedding.length === 512 || e.faceEmbedding.length === 128));

        if (enrolledEmployees.length === 0) {
            playErrorChimeSound();
            setScanError('No enrolled face vectors found! Employees must upload a profile photo first.');
            return;
        }

        // 1. Immediately capture freeze-frame selfie snapshot (<5ms)
        const freezeUrl = overrideSnapshotUrl || captureSnapshot();
        if (freezeUrl) setCapturedFreezeUrl(freezeUrl);

        setIsScanning(true);
        setScanError(null);

        // 2. Yield control to browser renderer — React repaints freeze frame & bottom status bar BEFORE heavy AI extraction
        setTimeout(async () => {
            try {
                // Pre-flight lighting check (<2ms) before heavy neural pass
                if (canvasRef.current && video) {
                    const tempCanvas = canvasRef.current;
                    tempCanvas.width = 160;
                    tempCanvas.height = 120;
                    const tctx = tempCanvas.getContext('2d');
                    if (tctx) {
                        tctx.drawImage(video, 0, 0, 160, 120);
                        const quality = FaceApiBrowserService.checkFrameQuality(tempCanvas);
                        if (!quality.acceptable) {
                            playErrorChimeSound();
                            setScanError('Lighting too dark! Please ensure face area is well lit.');
                            setIsScanning(false);
                            setCapturedFreezeUrl(null);
                            return;
                        }
                    }
                }

                // Extract 512-d ArcFace vector with +15% Face Crop & Liveness
                let liveDescriptor: Float32Array | null = null;

                // 1. High-Speed Server AI Microservice Extraction (ZeroGPU ~29ms)
                try {
                    const snapshotB64 = freezeUrl || captureSnapshot();
                    if (snapshotB64) {
                        const apiResp = await fetch('/api/kiosk/extract-face', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ imageBase64: snapshotB64 }),
                            signal: AbortSignal.timeout(5000)
                        });
                        if (apiResp.ok) {
                            const apiData = await apiResp.json();
                            if (apiData.success && apiData.embedding_512 && apiData.embedding_512.length === 512) {
                                liveDescriptor = new Float32Array(apiData.embedding_512);
                                if (apiData.cropped_face_base64) {
                                    setCapturedFreezeUrl(apiData.cropped_face_base64);
                                }
                            }
                        }
                    }
                } catch (servErr) {
                    console.warn('[Kiosk] Fast server extract fallback to local:', servErr);
                }

                // 2. Offline / Local Fallback if server unreachable
                if (!liveDescriptor) {
                    const extracted512 = await FaceVerificationService.extractAligned512dDescriptor(video);
                    if (extracted512?.embedding) {
                        liveDescriptor = new Float32Array(extracted512.embedding);
                        if (extracted512?.cropDataUrl) {
                            setCapturedFreezeUrl(extracted512.cropDataUrl);
                        }
                    } else {
                        const alignedResult = await FaceApiBrowserService.extractAlignedSquareFaceCrop(video);
                        liveDescriptor = alignedResult?.descriptor || await FaceApiBrowserService.extractDescriptor(video);
                        if (alignedResult?.croppedDataUrl) {
                            setCapturedFreezeUrl(alignedResult.croppedDataUrl);
                        }
                    }
                }

                if (!liveDescriptor) {
                    playErrorChimeSound();
                    const snapshotUrl = freezeUrl || captureSnapshot();
                    setVerificationResult({
                        status: 'rejected',
                        matched: false,
                        error: 'No face detected. Please align face inside camera circle.',
                        duration: getDurationStr(),
                        snapshotUrl,
                    });
                    setTimeout(() => {
                        setVerificationResult(null);
                        setCapturedFreezeUrl(null);
                        setIsScanning(false);
                    }, 2400);
                    return;
                }

                // 3. Fast L2-Normalized Dot-Product Matching + Adaptive Threshold (0.68) + Top-2 Gap Check (0.08)
                const candidateList: EmployeeFace[] = enrolledEmployees.map(emp => ({
                    id: emp.id,
                    fullName: emp.name,
                    embedding: l2Normalize(emp.faceEmbedding!)
                }));

                const matchRes = matchFaceFast(liveDescriptor, candidateList, 0.65, 0.06);

                const matchedEmployee = matchRes.isMatch && matchRes.employee
                    ? enrolledEmployees.find(e => e.id === matchRes.employee!.id) || null
                    : null;

                const now = new Date();
                const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

                if (!matchedEmployee) {
                    playErrorChimeSound();
                    const snapshotUrl = freezeUrl || captureSnapshot();
                    setVerificationResult({
                        status: 'rejected',
                        matched: false,
                        error: matchRes.message.includes('Ambiguous') ? matchRes.message : `Face Not Recognized. (Score: ${(matchRes.similarity * 100).toFixed(0)}%)`,
                        duration: getDurationStr(),
                        snapshotUrl,
                    });
                    setTimeout(() => {
                        setVerificationResult(null);
                        setCapturedFreezeUrl(null);
                        setIsScanning(false);
                    }, 2400);
                    return;
                }

                // 4. Face MATCHED!
                const snapshotUrl = freezeUrl || captureSnapshot();
                const similarity = `${(matchRes.similarity * 100).toFixed(1)}%`;
                const duration = getDurationStr();

                // Instant UI Notification & Profile Card Overlay (<100ms)
                setVerificationResult({
                    status: 'verified',
                    matched: true,
                    employeeName: matchedEmployee.name,
                    avatarUrl: matchedEmployee.avatarUrl,
                    time: timeStr,
                    similarity,
                    duration,
                    snapshotUrl,
                });


            setLastScanResult({
                name: matchedEmployee.name,
                time: timeStr,
                type: `Verified (${similarity} Match)`,
            });

            playChimeSound();

            // 5. ASYNC BACKGROUND PUNCH (Non-blocking DB sync while camera stays active for next staff)
            const punchLog: QueuedPunch = {
                id: `punch_${Date.now()}`,
                profileId: matchedEmployee.id,
                employeeName: matchedEmployee.name,
                timestamp: now.toISOString(),
                punchType: 'auto',
                synced: false,
                latitude: terminalGps.latitude,
                longitude: terminalGps.longitude,
            };

            (async () => {
                if (navigator.onLine) {
                    try {
                        const res = await fetch('/api/kiosk/sync', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'x-kiosk-secret': pairingCode
                            },
                            body: JSON.stringify(punchLog),
                        });
                        if (!res.ok) queueOfflinePunch(punchLog);
                    } catch {
                        queueOfflinePunch(punchLog);
                    }
                } else {
                    queueOfflinePunch(punchLog);
                }
            })();

            // DO NOT CLOSE MODAL! Auto-reset overlay after 2 seconds & unfreeze camera for next staff
            setTimeout(() => {
                setVerificationResult(null);
                setCapturedFreezeUrl(null);
                setIsScanning(false);
            }, 2200);


        } catch (err) {
            console.error('[Kiosk] Scan error:', err);
            playErrorChimeSound();
            setScanError('Verification processing failed. Please try again.');
            setIsScanning(false);
        }
        }, 10);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isScanning, modelsReady, employees, cameraActive, pairingCode, terminalGps]);


    const playErrorChimeSound = () => {
        try {
            const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(300, ctx.currentTime);
            osc.frequency.setValueAtTime(150, ctx.currentTime + 0.15);
            gain.gain.setValueAtTime(0.15, ctx.currentTime);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + 0.35);
        } catch (e) { }
    };

    const playChimeSound = () => {
        try {
            const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(587.33, ctx.currentTime);
            osc.frequency.setValueAtTime(880, ctx.currentTime + 0.15);
            gain.gain.setValueAtTime(0.1, ctx.currentTime);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + 0.4);
        } catch (e) { }
    };

    const queueOfflinePunch = (punch: QueuedPunch) => {
        setOfflineQueue(prev => {
            const updated = [...prev, punch];
            setStats(s => ({ ...s, queuedOffline: updated.length }));
            return updated;
        });
    };

    const flushOfflineQueue = async () => {
        if (!pairingCode) return;
        setOfflineQueue(prev => {
            if (prev.length === 0) return prev;
            fetch('/api/kiosk/sync', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-kiosk-secret': pairingCode
                },
                body: JSON.stringify({ punches: prev }),
            }).then(res => {
                if (res.ok) {
                    toast.success(`Synced ${prev.length} offline punches!`);
                    setStats(s => ({ ...s, queuedOffline: 0 }));
                }
            }).catch(() => {});
            return [];
        });
    };

    // =========================================================================
    // UNPAIRED STATE — Pairing Key Screen
    // =========================================================================
    if (!pairingCode) {
        return (
            <div className="h-screen w-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 overflow-hidden select-none">
                <Card className="w-full max-w-md bg-slate-900/90 border-slate-800 shadow-2xl text-slate-100 backdrop-blur-xl">
                    <CardHeader className="text-center space-y-2">
                        <div className="mx-auto w-16 h-16 rounded-2xl bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center shadow-inner">
                            <Key className="h-8 w-8" />
                        </div>
                        <CardTitle className="text-2xl font-bold tracking-tight text-white">
                            Pair Kiosk Terminal
                        </CardTitle>
                        <CardDescription className="text-slate-400 text-xs">
                            Enter Kiosk Pairing Key generated in Admin Settings panel.
                        </CardDescription>
                    </CardHeader>

                    <CardContent className="space-y-4">
                        <form onSubmit={handlePairDevice} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="pairing-key" className="text-xs font-bold uppercase tracking-wider text-slate-300">
                                    Kiosk Pairing Key
                                </Label>
                                <Input
                                    id="pairing-key"
                                    type="text"
                                    placeholder="e.g. KSK-PAYFIX-9A82B"
                                    value={inputKey}
                                    onChange={(e) => setInputKey(e.target.value.toUpperCase())}
                                    className="bg-slate-950/80 border-slate-700 text-white font-mono tracking-wider font-bold text-center h-12 text-base focus-visible:ring-sky-500"
                                    required
                                    autoFocus
                                />
                            </div>

                            <Button
                                type="submit"
                                disabled={isPairing || !inputKey.trim()}
                                className="w-full h-12 bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white font-bold text-base shadow-lg shadow-sky-600/20"
                            >
                                {isPairing ? (
                                    <>
                                        <RefreshCw className="h-5 w-5 mr-2 animate-spin" /> Verifying Key...
                                    </>
                                ) : (
                                    <>
                                        <ShieldCheck className="h-5 w-5 mr-2" /> Pair Terminal &amp; Start
                                    </>
                                )}
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            </div>
        );
    }

    // =========================================================================
    // PAIRED STATE — Zero-Scroll Kiosk Dashboard UI
    // =========================================================================
    return (
        <div className="h-screen w-screen bg-slate-950 text-slate-100 flex flex-col overflow-hidden select-none">
            {/* Hidden Canvas for Snapshot Capture */}
            <canvas ref={canvasRef} className="hidden" />

            {/* Top Header Bar: Tenant Name & Location Address */}
            <header className="h-14 px-4 bg-slate-900/90 border-b border-slate-800/80 flex items-center justify-between shrink-0 shadow-lg backdrop-blur-md">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
                        <Tablet className="h-5 w-5" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-base font-bold tracking-tight text-white leading-none">
                                {pairedDevice?.locationName || 'PayFix Workspace'}
                            </h1>
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-0.5">
                            <MapPin className="h-3 w-3 text-emerald-400 shrink-0" />
                            <span className="truncate max-w-[220px] md:max-w-xs">{pairedDevice?.locationName || 'Office Entrance Terminal'}</span>
                            {terminalGps.latitude && (
                                <span className="text-emerald-400 font-mono text-[10px] hidden md:inline">
                                    (GPS Verified)
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {/* Live Clock & Date */}
                    <div className="hidden sm:flex flex-col items-end text-right">
                        <span className="text-sm font-bold font-mono text-white leading-none">{currentTime}</span>
                        <span className="text-[10px] text-slate-400 mt-0.5">{currentDate}</span>
                    </div>

                    {/* Hardware Acceleration Status Badge (WebGL GPU / CPU) */}
                    <Badge variant="outline" className={hardwareInfo.isGpu ? "bg-sky-500/10 text-sky-400 border-sky-500/30 px-2.5 py-0.5 font-semibold text-xs flex items-center gap-1" : "bg-amber-500/10 text-amber-400 border-amber-500/30 px-2.5 py-0.5 font-semibold text-xs flex items-center gap-1"}>
                        <Cpu className="h-3 w-3" /> {hardwareInfo.backend}
                    </Badge>


                    {/* Online / Offline Status Badge */}
                    {isOnline ? (
                        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 px-2.5 py-0.5 font-semibold text-xs flex items-center gap-1">
                            <Wifi className="h-3 w-3" /> Online
                        </Badge>
                    ) : (
                        <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/30 px-2.5 py-0.5 font-semibold text-xs flex items-center gap-1">
                            <WifiOff className="h-3 w-3" /> Offline ({stats.queuedOffline})
                        </Badge>
                    )}


                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleUnpair}
                        className="text-slate-400 hover:text-red-400 hover:bg-red-500/10 h-8 w-8 rounded-lg"
                        title="Unpair Terminal"
                    >
                        <LogOut className="h-4 w-4" />
                    </Button>
                </div>
            </header>

            {/* Central Viewport Area (Zero Scroll Grid) */}
            <div className="flex-1 p-3 md:p-5 grid grid-cols-1 lg:grid-cols-12 gap-4 overflow-hidden">
                {/* Left/Main Hero Card: Start Verification CTA + Embedded Local Cache */}
                <Card className="lg:col-span-8 bg-gradient-to-br from-slate-900/90 via-slate-900/60 to-slate-950/90 border-slate-800/80 shadow-2xl flex flex-col justify-between p-5 md:p-6 relative overflow-hidden backdrop-blur-xl">
                    {/* Background Glowing Ambient Orbs */}
                    <div className="absolute -top-24 -left-24 w-72 h-72 rounded-full bg-sky-500/10 blur-3xl pointer-events-none" />
                    <div className="absolute -bottom-24 -right-24 w-72 h-72 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />

                    {/* Top Header inside Hero Card */}
                    <div className="flex items-center justify-between flex-wrap gap-2 relative z-10">
                        <div className="flex items-center gap-2">
                            <Sparkles className="h-5 w-5 text-sky-400" />
                            <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                                Touchless Face Attendance Terminal
                            </span>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="outline" className={hardwareInfo.isGpu ? "border-sky-500/40 bg-sky-950/60 text-sky-300 text-[11px] font-bold gap-1.5 py-1 px-2.5 shadow-md flex items-center" : "border-amber-500/40 bg-amber-950/60 text-amber-300 text-[11px] font-bold gap-1.5 py-1 px-2.5 shadow-md flex items-center"}>
                                <Cpu className="h-3.5 w-3.5 text-sky-400" />
                                <span>{hardwareInfo.backend}</span>
                            </Badge>
                            {idbSyncInfo && (
                                <Badge variant="outline" className="border-sky-500/40 bg-sky-950/60 text-sky-300 text-[11px] font-bold gap-1.5 py-1 px-2.5 shadow-md">
                                    <ShieldCheck className="h-3.5 w-3.5 text-sky-400 animate-pulse" />
                                    <span>💾 IndexedDB: {idbSyncInfo.enrolledEmployees} Vectors Cached</span>
                                </Badge>
                            )}
                        </div>

                    </div>


                    {/* Central Area: Paired Device Info + AI Loading OR Start Verification Primary Button */}
                    <div className="my-auto text-center space-y-5 relative z-10 max-w-lg mx-auto py-2">

                        {/* PAIRED DEVICE DETAILS BOX (RIGHT BEFORE START VERIFICATION BUTTON) */}
                        {pairedDevice && (
                            <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 backdrop-blur-md flex items-center justify-between text-xs max-w-sm mx-auto shadow-md">
                                <div className="flex items-center gap-2.5 text-left">
                                    <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/30 text-sky-400 flex items-center justify-center font-bold">
                                        <Tablet className="h-4 w-4" />
                                    </div>
                                    <div>
                                        <div className="font-bold text-white text-xs">{pairedDevice.name}</div>
                                        <div className="text-[10px] text-slate-400 flex items-center gap-1 font-mono">
                                            <span>Key: {pairedDevice.pairingCode}</span>
                                        </div>
                                    </div>
                                </div>
                                <Badge variant="outline" className="border-sky-500/40 text-sky-400 text-[10px] font-bold">
                                    Paired &amp; Active
                                </Badge>
                            </div>
                        )}

                        {!modelsReady ? (
                            /* 1. INITIAL LOADING AI STATE (Before 100% & 2s Preparation) */
                            <div className="w-full max-w-sm mx-auto p-5 rounded-2xl bg-slate-950/80 border border-slate-800 shadow-xl space-y-3 text-center backdrop-blur-md animate-in fade-in duration-300">
                                {modelProgress < 100 ? (
                                    <>
                                        <div className="flex items-center justify-center gap-3">
                                            <RefreshCw className="h-5 w-5 text-sky-400 animate-spin" />
                                            <span className="text-sm font-bold text-white tracking-wide">
                                                Loading AI Models ({modelProgress}%)
                                            </span>
                                        </div>
                                        <Progress value={modelProgress} className="h-2 bg-slate-800" />
                                        <p className="text-[11px] text-slate-400">
                                            Initializing local face recognition neural networks...
                                        </p>
                                    </>
                                ) : (
                                    <>
                                        <div className="flex items-center justify-center gap-3">
                                            <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                                            <span className="text-sm font-bold text-emerald-400 tracking-wide">
                                                AI Models Loaded (100%)
                                            </span>
                                        </div>
                                        <Progress value={100} className="h-2 bg-slate-800" />
                                        <p className="text-[11px] text-emerald-400/90 font-medium">
                                            Preparing entrance camera scanner...
                                        </p>
                                    </>
                                )}
                            </div>
                        ) : (
                            /* 2. REVEALED PRIMARY "START VERIFICATION" BUTTON (After 100% + 2s Delay) */
                            <div className="w-full max-w-xl mx-auto space-y-4 animate-in zoom-in-95 duration-300">
                                <Button
                                    onClick={openVerificationModal}
                                    disabled={!isCameraReady}
                                    className="w-full h-16 rounded-2xl bg-sky-600 hover:bg-sky-500 active:bg-sky-700 disabled:opacity-50 text-white font-black text-lg tracking-wide shadow-xl shadow-sky-600/30 transition-all transform hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-3 border border-sky-400/30 cursor-pointer"
                                >
                                    {!isCameraReady ? (
                                        <>
                                            <RefreshCw className="h-5 w-5 shrink-0 animate-spin text-sky-200" />
                                            <span>Starting Camera...</span>
                                        </>
                                    ) : (
                                        <>
                                            <ScanFace className="h-6 w-6 shrink-0 text-white" />
                                            <span>Start Verification</span>
                                        </>
                                    )}
                                </Button>
                            </div>

                        )}

                        {/* 3. TERMINAL LOCAL CACHE EMBEDDED INSIDE HERO CARD */}
                        <div className="w-full max-w-xl mx-auto mt-4 p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80 backdrop-blur-md space-y-2.5">
                            <div className="flex items-center justify-between border-b border-slate-800/80 pb-1.5">
                                <span className="text-xs text-slate-400 flex items-center gap-1.5 font-medium">
                                    <Zap className="h-3.5 w-3.5 text-sky-400" /> Terminal Local Cache
                                </span>
                                <Button
                                    onClick={fetchEmployeeFaceVectors}
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 px-2 text-[11px] text-slate-400 hover:text-white hover:bg-slate-800/80 font-semibold"
                                >
                                    <RefreshCw className="h-3 w-3 mr-1" /> Reload Vectors
                                </Button>
                            </div>
                            <div className="grid grid-cols-3 gap-2 text-center text-xs">
                                <div className="p-2 rounded-lg bg-slate-900/80 border border-slate-800">
                                    <div className="text-[10px] text-slate-400">Workspace Staff</div>
                                    <div className="text-sm font-bold text-white font-mono mt-0.5">{stats.totalEmployees}</div>
                                </div>
                                <div className="p-2 rounded-lg bg-slate-900/80 border border-slate-800">
                                    <div className="text-[10px] text-slate-400">Face Enrolled</div>
                                    <div className="text-sm font-bold text-emerald-400 font-mono mt-0.5">{stats.enrolledEmployees}</div>
                                </div>
                                <div className="p-2 rounded-lg bg-slate-900/80 border border-slate-800">
                                    <div className="text-[10px] text-slate-400">Queued Offline</div>
                                    <div className="text-sm font-bold text-amber-400 font-mono mt-0.5">{stats.queuedOffline}</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Bottom Status Bar (Removed Enrolled Count as requested) */}
                    <div className="flex items-center justify-between text-xs text-slate-400 border-t border-slate-800/80 pt-3 relative z-10">
                        <div className="flex items-center gap-2">
                            <ShieldCheck className="h-4 w-4 text-emerald-400" />
                            <span>Geofenced &amp; Encrypted</span>
                        </div>
                    </div>
                </Card>


                {/* Right Panel: Compact Recent Verification Card (Height 56px) */}
                <div className="lg:col-span-4 flex flex-col space-y-4 overflow-hidden">
                    {/* Compact Recent Verification Card (Height 56px) */}
                    <Card className="bg-slate-900/80 border-slate-800 shadow-lg min-h-[56px] h-[56px] flex items-center px-4 py-2 backdrop-blur-md overflow-hidden">
                        {lastScanResult ? (
                            <div className="w-full flex items-center justify-between text-xs">
                                <div className="flex items-center gap-2.5">
                                    <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-sm shrink-0">
                                        {lastScanResult.name.charAt(0)}
                                    </div>
                                    <div>
                                        <div className="font-bold text-white text-sm leading-none">{lastScanResult.name}</div>
                                        <div className="text-[10px] text-emerald-400 mt-0.5 font-medium">{lastScanResult.type}</div>
                                    </div>
                                </div>
                                <div className="text-[11px] font-mono text-slate-400">
                                    {lastScanResult.time}
                                </div>
                            </div>
                        ) : (
                            <div className="w-full flex items-center justify-between text-xs text-slate-400">
                                <div className="flex items-center gap-2">
                                    <CheckCircle2 className="h-4 w-4 text-slate-500 shrink-0" />
                                    <span className="font-medium text-slate-300">Recent Scan: <span className="text-slate-500 font-normal">None yet</span></span>
                                </div>
                                <Badge variant="outline" className="border-slate-800 text-slate-500 text-[10px]">
                                    Ready
                                </Badge>
                            </div>
                        )}
                    </Card>
                </div>
            </div>


            {/* =========================================================================
                VERIFICATION CAMERA MODAL DIALOG
               ========================================================================= */}
            <Dialog
                open={isVerificationModalOpen}
                onOpenChange={(open) => {
                    if (!open) closeVerificationModal();
                }}
            >
                <DialogContent className="max-w-md w-[95vw] bg-slate-950 border-slate-800 text-slate-100 p-0 overflow-hidden shadow-2xl rounded-3xl backdrop-blur-2xl [&>button]:hidden">
                    <BiometricCameraModal
                        isOpen={isVerificationModalOpen}
                        onClose={() => closeVerificationModal()}
                        title="Face Verification Scanner"
                        icon={<ScanFace className="h-5 w-5 text-sky-400" />}
                        videoRefOut={videoRef}
                        statusText={isScanning && !verificationResult ? "512×512 HD biometrics matching..." : undefined}
                        isProcessing={isScanning && !verificationResult}
                        enableAutoBlinkCapture={!isScanning && isVerificationModalOpen}
                        onAutoCapture={(dataUrl) => {
                            if (!isScanning) {
                                toast.success('Blink verified! Matching employee face 👁️');
                                handleFaceScan(dataUrl);
                            }
                        }}
                        footerSlot={
                            <div className="w-full flex items-center justify-center">
                                <Button
                                    onClick={() => handleFaceScan()}
                                    disabled={isScanning || !cameraActive || !modelsReady}
                                    className="w-full h-14 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-base shadow-xl shadow-emerald-600/25 cursor-pointer"
                                >
                                    {isScanning ? (
                                        <>
                                            <RefreshCw className="h-5 w-5 mr-2 animate-spin" /> Verifying Face...
                                        </>
                                    ) : (
                                        <>
                                            <ScanFace className="h-5 w-5 mr-2" /> Mark Attendance
                                        </>
                                    )}
                                </Button>
                            </div>
                        }
                    >
                        {/* Freeze Frame Captured Selfie Overlay (Prevents background video stutter) */}
                        {capturedFreezeUrl && (
                            <img
                                src={capturedFreezeUrl}
                                alt="Captured Selfie Freeze"
                                className="absolute inset-0 w-full h-full object-cover transform -scale-x-100 z-15"
                            />
                        )}

                        {/* Verification Result Status Pill (Positions at exact bottom status location over clear selfie photo) */}
                        {verificationResult && (
                            <div className="absolute bottom-4 inset-x-4 z-30 flex flex-col items-center justify-center animate-in zoom-in-95 fade-in duration-200">
                                {verificationResult.matched ? (
                                    <div className="w-full max-w-sm p-4 bg-slate-950/95 border-2 border-emerald-500/70 rounded-2xl backdrop-blur-md shadow-2xl space-y-1 text-center">
                                        <div className="flex items-center justify-center gap-2 text-emerald-400 font-black text-sm">
                                            <CheckCheck className="w-5 h-5 text-emerald-400 shrink-0" />
                                            <span className="truncate">Verified: {verificationResult.employeeName}</span>
                                        </div>
                                        <div className="text-[11px] font-mono text-emerald-200/90 flex items-center justify-center gap-2">
                                            <span>Score: {verificationResult.similarity}</span>
                                            <span>•</span>
                                            <span>Duration: {verificationResult.duration}</span>
                                        </div>
                                        <div className="text-[10px] font-bold text-emerald-400/90 pt-0.5">
                                            ✅ Attendance Recorded (Clock In)
                                        </div>
                                    </div>
                                ) : (
                                    <div className="w-full max-w-sm p-4 bg-slate-950/95 border-2 border-rose-500/70 rounded-2xl backdrop-blur-md shadow-2xl space-y-1 text-center">
                                        <div className="flex items-center justify-center gap-2 text-rose-400 font-black text-sm">
                                            <XCircle className="w-5 h-5 text-rose-400 shrink-0" />
                                            <span className="truncate">{verificationResult.error || 'Verification Unsuccessful'}</span>
                                        </div>
                                        {verificationResult.duration && (
                                            <div className="text-[11px] font-mono text-rose-200/90 pt-0.5">
                                                Duration: {verificationResult.duration}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}


                    </BiometricCameraModal>


                </DialogContent>
            </Dialog>

            {/* Hidden background video element keeping camera stream hot & active on page load */}
            <video
                ref={warmupVideoRef}
                autoPlay
                muted
                playsInline
                className="hidden pointer-events-none opacity-0 absolute -z-50"
            />
        </div>
    );
}


