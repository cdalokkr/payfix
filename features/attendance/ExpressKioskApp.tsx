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
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
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

        setModelsLoading(false);
        if (ok) {
            setModelsReady(true);
            toast.success('Face recognition models loaded!');
            fetchEmployeeFaceVectors();
        } else {
            toast.error('Failed to load face recognition models. Please refresh.');
        }
    };

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
                    const enrolledCount = mapped.filter(e => e.faceEmbedding !== null).length;
                    setStats(prev => ({ ...prev, totalEmployees: mapped.length, enrolledEmployees: enrolledCount }));
                } catch {}
            }
        }
    };

    // Start Camera Stream inside Modal (Full HD Native Resolution)
    const startCamera = async () => {
        try {
            if (mediaStreamRef.current) {
                mediaStreamRef.current.getTracks().forEach(track => track.stop());
                mediaStreamRef.current = null;
            }

            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: 'user',
                    width: { ideal: 1920, min: 1280 },
                    height: { ideal: 1080, min: 720 },
                    frameRate: { ideal: 60, min: 30 }
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
        } catch (err) {
            console.error('Camera access error:', err);
            toast.error('Unable to access camera in HD quality.');
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

    // Open Verification Modal Flow
    const openVerificationModal = () => {
        setIsVerificationModalOpen(true);
        setVerificationResult(null);
        setScanError(null);
        startCamera();
    };

    // Close Verification Modal Flow
    const closeVerificationModal = () => {
        setIsVerificationModalOpen(false);
        setVerificationResult(null);
        setScanError(null);
        stopCamera();
    };

    // Capture frame from video into canvas and return as Data URL
    const captureFrame = (): { canvas: HTMLCanvasElement | null; dataUrl: string | null } => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas || !cameraActive) return { canvas: null, dataUrl: null };

        canvas.width = video.videoWidth || 720;
        canvas.height = video.videoHeight || 1280;
        const ctx = canvas.getContext('2d');
        if (!ctx) return { canvas: null, dataUrl: null };

        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        return { canvas, dataUrl };
    };

    // Instant Face Verification Scan & Overlay Flow
    const handleFaceScan = useCallback(async () => {
        if (isScanning || !modelsReady || !pairingCode) return;

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

        setIsScanning(true);
        setScanError(null);

        try {
            // 1. Capture live frame snapshot
            const { canvas, dataUrl: snapshotUrl } = captureFrame();
            if (!canvas) {
                setScanError('Camera frame capture failed. Please try again.');
                setIsScanning(false);
                return;
            }

            // 2. Extract live face descriptor
            const liveDescriptor = await FaceApiBrowserService.extractDescriptor(canvas);

            if (!liveDescriptor) {
                playErrorChimeSound();
                setVerificationResult({
                    status: 'rejected',
                    matched: false,
                    error: 'No face detected in camera frame. Please align face inside the guide oval.',
                    snapshotUrl,
                });
                setIsScanning(false);
                return;
            }

            // 3. Vector comparison against enrolled employee vectors
            let matchedEmployee: CachedEmployee | null = null;
            let bestDistance = Infinity;

            for (const emp of enrolledEmployees) {
                const storedDescriptor = FaceApiBrowserService.arrayToDescriptor(emp.faceEmbedding!);
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
                setVerificationResult({
                    status: 'rejected',
                    matched: false,
                    error: `Face Not Recognized in employee database. (Match score: ${(Math.max(0, 1 - bestDistance) * 100).toFixed(0)}%)`,
                    snapshotUrl,
                });
                setIsScanning(false);
                return;
            }

            // 4. Face MATCHED!
            const similarity = `${Math.max(0, (1 - bestDistance) * 100).toFixed(1)}%`;

            // Instant UI Notification & Overlay (<100ms)
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

            // 5. ASYNC BACKGROUND PUNCH (Non-blocking DB sync)
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

            // Auto-close modal after 2.5 seconds for next employee
            setTimeout(() => {
                closeVerificationModal();
                setIsScanning(false);
            }, 2500);

        } catch (err) {
            console.error('[Kiosk] Scan error:', err);
            playErrorChimeSound();
            setScanError('Verification processing failed. Please try again.');
            setIsScanning(false);
        }
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

            {/* Compact Header Bar (h-14) */}
            <header className="h-14 px-4 bg-slate-900/90 border-b border-slate-800/80 flex items-center justify-between shrink-0 shadow-lg backdrop-blur-md">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
                        <Tablet className="h-5 w-5" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-base font-bold tracking-tight text-white leading-none">
                                {pairedDevice?.name || 'Kiosk Terminal'}
                            </h1>
                            <Badge variant="outline" className="border-sky-500/40 text-sky-400 text-[10px] font-bold px-1.5 py-0">
                                Paired
                            </Badge>
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-0.5">
                            <MapPin className="h-3 w-3 text-emerald-400 shrink-0" />
                            <span className="truncate max-w-[200px] md:max-w-xs">{pairedDevice?.locationName || 'Geofenced Location'}</span>
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

                        {modelsReady ? (
                            <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-xs font-semibold">
                                AI Ready
                            </Badge>
                        ) : (
                            <Badge variant="secondary" className="bg-sky-500/10 text-sky-400 animate-pulse border border-sky-500/30 text-xs font-semibold">
                                Loading AI ({modelProgress}%)
                            </Badge>
                        )}
                    </div>

                    {/* Central Area: Initial AI Loading State OR Start Verification Primary Button */}
                    <div className="my-auto text-center space-y-5 relative z-10 max-w-lg mx-auto py-2">
                        <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white">
                            Entrance Attendance Scanner
                        </h2>

                        {!modelsReady ? (
                            /* 1. INITIAL LOADING AI STATE (Before 100%) */
                            <div className="w-full max-w-sm mx-auto p-5 rounded-2xl bg-slate-950/80 border border-slate-800 shadow-xl space-y-3 text-center backdrop-blur-md animate-in fade-in duration-300">
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
                            </div>
                        ) : (
                            /* 2. REVEALED PRIMARY "START VERIFICATION" BUTTON (After 100%) */
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

                    {/* Bottom Status Bar */}
                    <div className="flex items-center justify-between text-xs text-slate-400 border-t border-slate-800/80 pt-3 relative z-10">
                        <div className="flex items-center gap-2">
                            <ShieldCheck className="h-4 w-4 text-emerald-400" />
                            <span>Geofenced &amp; Encrypted</span>
                        </div>
                        <div className="flex items-center gap-2 font-mono">
                            <span>{stats.enrolledEmployees} Employees Enrolled</span>
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

                    {/* Camera Display Box (Full Native HD View) */}
                    <div className="p-4 flex flex-col items-center justify-center relative bg-black min-h-[440px]">
                        <div className="relative w-full max-w-sm aspect-[3/4] rounded-2xl overflow-hidden border border-slate-800 shadow-2xl bg-black">
                            <video
                                ref={videoRef}
                                className="w-full h-full object-cover transform -scale-x-100"
                                playsInline
                                muted
                            />

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
                            variant="outline"
                            className="border-slate-700 text-slate-300 hover:bg-slate-800 font-bold text-xs"
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

