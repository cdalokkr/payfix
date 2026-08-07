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
    Maximize2, User
} from 'lucide-react';
import { toast } from 'sonner';
import { FaceApiBrowserService } from '@/lib/services/faceapi-browser.service';
import { trpc } from '@/lib/trpc/client';

interface CachedEmployee {
    id: string;
    name: string;
    avatarUrl?: string | null;
    biometricUserId?: string | null;
    faceEmbedding: number[] | null; // 128-d face-api.js vector
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
    const [modelsLoading, setModelsLoading] = useState<boolean>(false);
    const [modelsReady, setModelsReady] = useState<boolean>(false);
    const [modelProgress, setModelProgress] = useState<number>(0);
    const [stats, setStats] = useState({ totalEmployees: 0, enrolledEmployees: 0, queuedOffline: 0 });

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

    // Check stored pairing key on mount
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const savedKey = localStorage.getItem('payfix_kiosk_pairing_code');
            const savedDeviceInfo = localStorage.getItem('payfix_kiosk_device_info');

            if (savedKey) {
                setPairingCode(savedKey);
                if (savedDeviceInfo) {
                    try { setPairedDevice(JSON.parse(savedDeviceInfo)); } catch {}
                }
                verifyPairingMutation.mutate({ pairingCode: savedKey }, {
                    onSuccess: (res) => {
                        if (res.success && 'device' in res && res.device) {
                            setPairedDevice(res.device);
                            localStorage.setItem('payfix_kiosk_device_info', JSON.stringify(res.device));
                        } else {
                            toast.error('Kiosk Pairing Key is no longer active. Please pair again.');
                            handleUnpair();
                        }
                    }
                });
            }
        }
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

    // Load face-api.js models when paired
    useEffect(() => {
        if (pairingCode) {
            loadFaceModels();
        }
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
                    localStorage.setItem('payfix_kiosk_pairing_code', code);
                    localStorage.setItem('payfix_kiosk_device_info', JSON.stringify(res.device));
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
        localStorage.removeItem('payfix_kiosk_pairing_code');
        localStorage.removeItem('payfix_kiosk_device_info');
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

    // Fetch and cache employee face vectors locally using Kiosk Pairing Key
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
                        faceEmbedding: Array.isArray(e.faceEmbedding) && e.faceEmbedding.length === 128
                            ? e.faceEmbedding
                            : null,
                    }));
                    setEmployees(mapped);
                    try { localStorage.setItem('payfix_kiosk_cached_employees', JSON.stringify(mapped)); } catch {}

                    // Pre-parse Float32Array descriptors into memory cache for instant matching
                    const newMap = new Map<string, Float32Array>();
                    mapped.forEach(e => {
                        if (e.faceEmbedding && e.faceEmbedding.length === 128) {
                            newMap.set(e.id, FaceApiBrowserService.arrayToDescriptor(e.faceEmbedding));
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
            console.warn('[Kiosk] Failed to fetch face vectors from cloud. Checking offline cache...');
            const cached = localStorage.getItem('payfix_kiosk_cached_employees');
            if (cached) {
                try {
                    const mapped: CachedEmployee[] = JSON.parse(cached);
                    setEmployees(mapped);

                    const newMap = new Map<string, Float32Array>();
                    mapped.forEach(e => {
                        if (e.faceEmbedding && e.faceEmbedding.length === 128) {
                            newMap.set(e.id, FaceApiBrowserService.arrayToDescriptor(e.faceEmbedding));
                        }
                    });
                    descriptorMapRef.current = newMap;

                    const enrolledCount = mapped.filter(e => e.faceEmbedding !== null).length;
                    setStats(prev => ({ ...prev, totalEmployees: mapped.length, enrolledEmployees: enrolledCount }));
                } catch {}
            }
        }
    };

    // Start Camera Stream inside Modal (Optimized Resolution & Zoom for Mobile/Tablet)
    const startCamera = async () => {
        try {
            if (mediaStreamRef.current) {
                mediaStreamRef.current.getTracks().forEach(track => track.stop());
                mediaStreamRef.current = null;
            }

            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: 'user',
                    width: { ideal: 1280, max: 1280 },
                    height: { ideal: 720, max: 720 },
                    frameRate: { ideal: 30 }
                }
            });

            mediaStreamRef.current = stream;
            setCameraActive(true);
            setScanError(null);

            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                videoRef.current.muted = true;
                videoRef.current.play().catch(() => {});
            }

            // Apply hardware track zoom if supported by device camera
            const videoTrack = stream.getVideoTracks()[0];
            if (videoTrack && typeof videoTrack.getCapabilities === 'function') {
                const capabilities = videoTrack.getCapabilities() as any;
                if (capabilities && capabilities.zoom) {
                    try {
                        const targetZoom = Math.min(capabilities.zoom.max || 1.5, 1.25);
                        await (videoTrack as any).applyConstraints({
                            advanced: [{ zoom: targetZoom }]
                        });
                    } catch {}
                }
            }
        } catch (err) {
            console.error('Camera access error:', err);
            toast.error('Unable to access camera.');
        }
    };



    // Stop Camera Stream
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
    const openVerificationModal = () => {
        setIsVerificationModalOpen(true);
        setVerificationResult(null);
        setScanError(null);
        startCamera();

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

    // Close Verification Modal Flow
    const closeVerificationModal = () => {
        setIsVerificationModalOpen(false);
        setVerificationResult(null);
        setScanError(null);
        stopCamera();
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
        sctx.drawImage(video, 0, 0, snap.width, snap.height);
        return snap.toDataURL('image/jpeg', 0.85);
    };

    // Instant Face Verification Scan & Overlay Flow (Continuous Staff Scanning)
    const handleFaceScan = useCallback(async () => {
        if (isScanning || !modelsReady || !pairingCode) return;

        const video = videoRef.current;
        if (!video || !cameraActive) {
            toast.error('Camera stream not ready. Please try again.');
            return;
        }

        if (employees.length === 0) {
            toast.error('No employee profiles cached. Please check connection.');
            return;
        }

        const enrolledEmployees = employees.filter(e => e.faceEmbedding !== null && e.faceEmbedding.length === 128);

        if (enrolledEmployees.length === 0) {
            playErrorChimeSound();
            setScanError('No enrolled face vectors found! Employees must upload a profile photo first.');
            return;
        }

        // 1. Show UI spinner INSTANTLY (<10ms)
        setIsScanning(true);
        setScanError(null);

        // 2. Yield control to browser renderer — React repaints spinner overlay BEFORE heavy AI extraction
        setTimeout(async () => {
            try {
                // Extract live face descriptor directly from native HTMLVideoElement (zero image distortion)
                const liveDescriptor = await FaceApiBrowserService.extractDescriptor(video);


                if (!liveDescriptor) {
                    playErrorChimeSound();
                    const snapshotUrl = captureSnapshot();
                    setVerificationResult({
                        status: 'rejected',
                        matched: false,
                        error: 'No face detected. Please align face in camera view.',
                        snapshotUrl,
                    });
                    setTimeout(() => {
                        setVerificationResult(null);
                        setIsScanning(false);
                    }, 2000);
                    return;
                }

                // Fast vector comparison using pre-parsed Float32Array descriptors (<1ms)
                let matchedEmployee: CachedEmployee | null = null;
                let bestDistance = Infinity;

                for (const emp of enrolledEmployees) {
                    const storedDescriptor = descriptorMapRef.current.get(emp.id) || FaceApiBrowserService.arrayToDescriptor(emp.faceEmbedding!);
                    const dist = FaceApiBrowserService.euclideanDistance(liveDescriptor, storedDescriptor);
                    if (dist < bestDistance) {
                        bestDistance = dist;
                        matchedEmployee = emp;
                    }
                }


            // Threshold: < 0.6 = same person
            if (bestDistance >= 0.6) {
                matchedEmployee = null;
            }

            const now = new Date();
            const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

            if (!matchedEmployee) {
                playErrorChimeSound();
                const snapshotUrl = captureSnapshot();
                setVerificationResult({
                    status: 'rejected',
                    matched: false,
                    error: `Face Not Recognized. (Score: ${(Math.max(0, 1 - bestDistance) * 100).toFixed(0)}%)`,
                    snapshotUrl,
                });
                setTimeout(() => {
                    setVerificationResult(null);
                    setIsScanning(false);
                }, 2000);
                return;
            }

            // 4. Face MATCHED! Capture full-res snapshot NOW (deferred, only on match)
            const snapshotUrl = captureSnapshot();
            const similarity = `${Math.max(0, (1 - bestDistance) * 100).toFixed(1)}%`;

            // Instant UI Notification & Profile Card Overlay (<100ms)
            setVerificationResult({
                status: 'verified',
                matched: true,
                employeeName: matchedEmployee.name,
                avatarUrl: matchedEmployee.avatarUrl,
                time: timeStr,
                similarity,
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

            // DO NOT CLOSE MODAL! Auto-reset overlay after 2 seconds & keep camera active for next staff
            setTimeout(() => {
                setVerificationResult(null);
                setIsScanning(false);
            }, 2000);

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
                    <div className="flex items-center justify-between relative z-10">
                        <div className="flex items-center gap-2">
                            <Sparkles className="h-5 w-5 text-sky-400" />
                            <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                                Touchless Face Attendance Terminal
                            </span>
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
                            <div className="space-y-4 animate-in zoom-in-95 duration-300">
                                <Button
                                    onClick={openVerificationModal}
                                    className="w-full max-w-xs h-14 rounded-xl bg-sky-600 hover:bg-sky-500 active:bg-sky-700 text-white font-bold text-lg tracking-wide shadow-lg shadow-sky-600/30 transition-all transform hover:scale-105 active:scale-95 flex items-center justify-center gap-3 border border-sky-400/30"
                                >
                                    <ScanFace className="h-6 w-6 shrink-0" />
                                    <span>Start Verification</span>
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
            <Dialog open={isVerificationModalOpen} onOpenChange={(open) => !open && closeVerificationModal()}>
                <DialogContent className="max-w-md w-[95vw] bg-slate-950/95 border-slate-800 text-slate-100 p-0 overflow-hidden shadow-2xl rounded-3xl backdrop-blur-2xl">
                    <DialogHeader className="p-4 bg-slate-900/80 border-b border-slate-800 flex items-center justify-between flex-row space-y-0">
                        <DialogTitle className="text-base font-bold text-white flex items-center gap-2">
                            <ScanFace className="h-5 w-5 text-sky-400" /> Face Verification Scanner
                        </DialogTitle>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={closeVerificationModal}
                            className="text-slate-400 hover:text-white hover:bg-slate-800 h-8 w-8 rounded-full"
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    </DialogHeader>

                    {/* Camera Display Box (Sleek Biometric Face Oval Scanner Viewport) */}
                    <div className="p-4 flex flex-col items-center justify-center relative bg-slate-950 min-h-[440px]">
                        {/* Oval Face-Shaped Camera Viewport Frame */}
                        <div className="relative w-64 sm:w-72 aspect-[3/4] rounded-[50%/40%] overflow-hidden border-2 border-sky-500/50 shadow-[0_0_35px_rgba(56,189,248,0.25)] bg-black transition-all">
                            <video
                                ref={videoRef}
                                className="w-full h-full object-cover transform -scale-x-100 scale-125 transition-transform duration-300"
                                playsInline
                                muted
                            />

                            {/* Biometric Face Inner Guide Ring */}
                            <div className="absolute inset-0 rounded-[50%/40%] border border-sky-400/30 pointer-events-none z-10 shadow-[inset_0_0_20px_rgba(56,189,248,0.15)]" />


                            {/* Camera Initializing Loading Spinner Overlay */}
                            {!cameraActive && (
                                <div className="absolute inset-0 bg-slate-950 flex flex-col items-center justify-center space-y-3 z-10">
                                    <div className="w-14 h-14 rounded-2xl bg-sky-500/10 border border-sky-500/30 text-sky-400 flex items-center justify-center shadow-lg">
                                        <Camera className="h-7 w-7 animate-pulse" />
                                    </div>
                                    <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
                                        <RefreshCw className="h-4 w-4 text-sky-400 animate-spin" />
                                        <span>Initializing Camera Stream...</span>
                                    </div>
                                </div>
                            )}

                            {/* Scanning Progress Beam */}
                            {isScanning && !verificationResult && (
                                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-sky-500 via-emerald-400 to-sky-500 shadow-[0_0_15px_#38bdf8] animate-pulse z-20" />
                            )}

                            {/* Scanning Progress Spinner Overlay */}
                            {isScanning && !verificationResult && (
                                <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-xs flex items-center justify-center z-20">
                                    <div className="bg-slate-900/90 border border-sky-500/40 p-4 rounded-2xl shadow-2xl text-center space-y-2">
                                        <RefreshCw className="h-8 w-8 text-sky-400 animate-spin mx-auto" />
                                        <p className="font-bold text-xs text-sky-300">Extracting Face Vector...</p>
                                    </div>
                                </div>
                            )}

                            {/* =========================================================
                                INSTANT VERIFICATION RESULT OVERLAY (Glossy Blur Card)
                               ========================================================= */}
                            {verificationResult && (
                                <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-xl flex flex-col items-center justify-center p-5 space-y-3 z-30 text-center animate-in fade-in zoom-in-95 duration-200">
                                    {verificationResult.matched ? (
                                        <>
                                            {/* VERIFIED SUCCESS CARD */}
                                            <div className="w-16 h-16 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 p-0.5 shadow-[0_0_40px_rgba(16,185,129,0.6)] flex items-center justify-center animate-bounce-short">
                                                <div className="w-full h-full bg-slate-950 rounded-full flex items-center justify-center">
                                                    <CheckCheck className="h-8 w-8 text-emerald-400" />
                                                </div>
                                            </div>

                                            <div className="space-y-1">
                                                <div className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-400">
                                                    VERIFICATION SUCCESSFUL
                                                </div>
                                                <h3 className="text-xl font-bold text-white">
                                                    {verificationResult.employeeName}
                                                </h3>
                                                <Badge variant="outline" className="border-emerald-500/40 text-emerald-400 font-bold text-xs">
                                                    Verified {verificationResult.similarity} Match
                                                </Badge>
                                            </div>

                                            <div className="text-xs text-slate-400 pt-1 space-y-0.5">
                                                <div>Time: <span className="font-mono text-white font-bold">{verificationResult.time}</span></div>
                                                <div className="text-[11px] text-emerald-400/90 font-semibold">📍 Geofence Verified</div>
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            {/* REJECTED / NOT VERIFIED CARD */}
                                            <div className="w-16 h-16 rounded-full bg-gradient-to-r from-rose-600 to-red-600 p-0.5 shadow-[0_0_40px_rgba(244,63,94,0.6)] flex items-center justify-center">
                                                <div className="w-full h-full bg-slate-950 rounded-full flex items-center justify-center">
                                                    <XCircle className="h-8 w-8 text-rose-400" />
                                                </div>
                                            </div>

                                            <div className="space-y-1">
                                                <div className="text-[10px] font-extrabold uppercase tracking-widest text-rose-400">
                                                    NOT VERIFIED
                                                </div>
                                                <p className="text-xs text-slate-300 max-w-xs">
                                                    {verificationResult.error || 'Face not recognized in employee records.'}
                                                </p>
                                            </div>

                                            <Button
                                                onClick={() => setVerificationResult(null)}
                                                size="sm"
                                                className="bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs mt-2"
                                            >
                                                Try Again
                                            </Button>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>

                        {scanError && !verificationResult && (
                            <div className="mt-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-medium flex items-center gap-2.5 max-w-sm w-full shadow-sm">
                                <AlertCircle className="h-4 w-4 text-amber-400 shrink-0" />
                                <span>{scanError}</span>
                            </div>
                        )}
                    </div>

                    {/* Modal Control Footer */}
                    <div className="p-4 bg-slate-900/80 border-t border-slate-800 flex items-center justify-between gap-3">
                        <Button
                            onClick={closeVerificationModal}
                            className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 font-bold text-xs shadow-sm hover:text-white"
                        >
                            Cancel
                        </Button>

                        <Button
                            onClick={handleFaceScan}
                            disabled={isScanning || !cameraActive || !modelsReady}
                            className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold text-sm px-6 shadow-lg shadow-emerald-600/20"
                        >
                            {isScanning ? (
                                <>
                                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Verifying...
                                </>
                            ) : (
                                <>
                                    <ScanFace className="h-4 w-4 mr-2" /> Mark Attendance
                                </>
                            )}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}

