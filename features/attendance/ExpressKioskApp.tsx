'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertCircle, Camera, CheckCircle2, RefreshCw, Wifi, WifiOff, Zap, ScanFace, UserX, Key, MapPin, Tablet, ShieldCheck, LogOut } from 'lucide-react';
import { toast } from 'sonner';
import { FaceApiBrowserService } from '@/lib/services/faceapi-browser.service';
import { trpc } from '@/lib/trpc/client';

interface CachedEmployee {
    id: string;
    name: string;
    avatarUrl?: string | null;
    biometricUserId?: string | null;
    faceEmbedding: number[] | null; // 128-d face-api.js vector from profiles.face_embedding
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

export function ExpressKioskApp() {
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);

    // Kiosk Terminal Pairing State
    const [pairingCode, setPairingCode] = useState<string | null>(null);
    const [pairedDevice, setPairedDevice] = useState<PairedDeviceInfo | null>(null);
    const [inputKey, setInputKey] = useState('');
    const [isPairing, setIsPairing] = useState(false);

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
    const [modelMsg, setModelMsg] = useState<string>('');
    const [stats, setStats] = useState({ totalEmployees: 0, enrolledEmployees: 0, queuedOffline: 0 });

    const verifyPairingMutation = trpc.kioskDevices.verifyPairingCode.useMutation();

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
                // Verify pairing key with server
                verifyPairingMutation.mutate({ pairingCode: savedKey }, {
                    onSuccess: (res) => {
                        if (res.success && 'device' in res && res.device) {
                            setPairedDevice(res.device);
                            localStorage.setItem('payfix_kiosk_device_info', JSON.stringify(res.device));
                        } else {
                            // Key revoked or invalid
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
        stopCamera();
    };

    const loadFaceModels = async () => {
        if (FaceApiBrowserService.isReady()) {
            setModelsReady(true);
            fetchEmployeeFaceVectors();
            return;
        }
        setModelsLoading(true);
        setModelProgress(0);
        setModelMsg('Loading AI models...');

        const ok = await FaceApiBrowserService.loadModels((pct, msg) => {
            setModelProgress(pct);
            setModelMsg(msg);
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
                    // Cache in LocalStorage for offline fallback
                    try { localStorage.setItem('payfix_kiosk_cached_employees', JSON.stringify(mapped)); } catch {}

                    const enrolledCount = mapped.filter(e => e.faceEmbedding !== null).length;
                    setStats(prev => ({ ...prev, totalEmployees: data.total, enrolledEmployees: enrolledCount }));
                    toast.info(`${data.total} employees loaded for this tenant workspace. ${enrolledCount} have face enrolled.`);
                }
            } else if (res.status === 401) {
                toast.error('Unauthorized Kiosk device. Pairing Key rejected.');
                handleUnpair();
            }
        } catch (err) {
            console.warn('[Kiosk] Failed to fetch face vectors from cloud. Checking offline cache...');
            // Offline fallback
            const cached = localStorage.getItem('payfix_kiosk_cached_employees');
            if (cached) {
                try {
                    const mapped: CachedEmployee[] = JSON.parse(cached);
                    setEmployees(mapped);
                    const enrolledCount = mapped.filter(e => e.faceEmbedding !== null).length;
                    setStats(prev => ({ ...prev, totalEmployees: mapped.length, enrolledEmployees: enrolledCount }));
                    toast.warning(`Offline Mode: Loaded ${mapped.length} employees from local tablet cache.`);
                } catch {}
            }
        }
    };

    // Start Camera Stream
    const startCamera = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }
            });
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                videoRef.current.play();
                setCameraActive(true);
                setScanError(null);
                setLastScanResult(null);
            }
        } catch (err) {
            console.error('Camera access error:', err);
            toast.error('Unable to access front camera.');
        }
    };

    // Stop Camera Stream
    const stopCamera = () => {
        if (videoRef.current?.srcObject) {
            const stream = videoRef.current.srcObject as MediaStream;
            stream.getTracks().forEach(track => track.stop());
            videoRef.current.srcObject = null;
            setCameraActive(false);
        }
    };

    // Capture frame from video into canvas and return as ImageData element
    const captureFrame = (): HTMLCanvasElement | null => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas || !cameraActive) return null;

        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        return canvas;
    };

    // Real Face Scan using face-api.js
    const handleFaceScan = useCallback(async () => {
        if (isScanning || !modelsReady || !pairingCode) return;

        if (employees.length === 0) {
            toast.error('No employee profiles cached. Please check server connection.');
            return;
        }

        // Only match against employees who have enrolled face vectors
        const enrolledEmployees = employees.filter(e => e.faceEmbedding !== null && e.faceEmbedding.length === 128);

        if (enrolledEmployees.length === 0) {
            playErrorChimeSound();
            setScanError('No enrolled face vectors found! Employees must upload a profile photo first to enroll their face.');
            toast.error('No face enrollments found. Ask employees to upload their profile photo.');
            return;
        }

        setIsScanning(true);
        setScanError(null);

        try {
            // 1. Capture live frame from webcam
            const frameCanvas = captureFrame();
            if (!frameCanvas) {
                setScanError('Camera frame capture failed. Please try again.');
                return;
            }

            // 2. Extract live face descriptor from webcam frame
            const liveDescriptor = await FaceApiBrowserService.extractDescriptor(frameCanvas);

            if (!liveDescriptor) {
                playErrorChimeSound();
                setScanError('No face detected in camera frame. Please align your face in the circle and try again.');
                toast.warning('No face detected in frame.');
                return;
            }

            // 3. Find closest matching employee using Euclidean distance
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

            // 4. Threshold check — distance < 0.6 = same person
            if (bestDistance >= 0.6) {
                matchedEmployee = null;
            }

            if (!matchedEmployee) {
                playErrorChimeSound();
                setScanError(`Face Not Recognized! (Best match distance: ${bestDistance.toFixed(3)} — threshold: 0.6). Attendance NOT marked.`);
                toast.error('Face not recognized. Attendance NOT marked.');
                return;
            }

            // 5. Face matched — mark attendance!
            const now = new Date();
            const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const similarity = Math.max(0, (1 - bestDistance) * 100).toFixed(1);

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

            setLastScanResult({
                name: matchedEmployee.name,
                time: timeStr,
                type: `Verified ${similarity}% Match`,
            });

            playChimeSound();

            if (navigator.onLine) {
                const res = await fetch('/api/kiosk/sync', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-kiosk-secret': pairingCode
                    },
                    body: JSON.stringify(punchLog),
                });

                if (res.ok) {
                    const resData = await res.json();
                    if (resData.success) {
                        toast.success(`✅ Welcome ${matchedEmployee.name}! Attendance marked at ${timeStr} (${similarity}% match)`);
                    } else if (resData.errorDetails?.[0]) {
                        toast.error(`⚠️ ${resData.errorDetails[0]}`);
                    } else {
                        toast.success(`✅ Welcome ${matchedEmployee.name}! Attendance recorded.`);
                    }
                } else {
                    queueOfflinePunch(punchLog);
                }
            } else {
                queueOfflinePunch(punchLog);
            }
        } catch (err) {
            console.error('[Kiosk] Scan error:', err);
            toast.error('Face verification failed. Please try again.');
        } finally {
            setTimeout(() => setIsScanning(false), 2000);
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
        toast.info(`Offline Mode: Saved punch locally for ${punch.employeeName}. Will auto-sync when online.`);
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
                    toast.success(`Successfully synced ${prev.length} offline punches!`);
                    setStats(s => ({ ...s, queuedOffline: 0 }));
                }
            }).catch(e => {
                console.warn('[Kiosk] Offline sync retry failed:', e);
            });
            return [];
        });
    };

    // =========================================================================
    // UNPAIRED STATE — Show Pairing Key Input Screen
    // =========================================================================
    if (!pairingCode) {
        return (
            <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
                <Card className="w-full max-w-md bg-slate-900/90 border-slate-800 shadow-2xl text-slate-100">
                    <CardHeader className="text-center space-y-2">
                        <div className="mx-auto w-16 h-16 rounded-2xl bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center shadow-inner">
                            <Key className="h-8 w-8" />
                        </div>
                        <CardTitle className="text-2xl font-bold tracking-tight text-white">
                            Pair Kiosk Terminal
                        </CardTitle>
                        <CardDescription className="text-slate-400 text-sm">
                            Enter the Kiosk Pairing Key generated in your Admin Settings panel to authorize this entrance device.
                        </CardDescription>
                    </CardHeader>

                    <CardContent className="space-y-4">
                        <form onSubmit={handlePairDevice} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="pairing-key" className="text-xs font-bold uppercase tracking-wider text-slate-300">
                                    Kiosk Pairing Key
                                </Label>
                                <div className="relative">
                                    <Input
                                        id="pairing-key"
                                        type="text"
                                        placeholder="e.g. KSK-PAYFIX-9A82B"
                                        value={inputKey}
                                        onChange={(e) => setInputKey(e.target.value.toUpperCase())}
                                        className="bg-slate-950/80 border-slate-700 text-white placeholder:text-slate-600 font-mono tracking-wider font-bold text-center h-12 text-base focus-visible:ring-sky-500"
                                        required
                                        autoFocus
                                    />
                                </div>
                            </div>

                            <Button
                                type="submit"
                                disabled={isPairing || !inputKey.trim()}
                                className="w-full h-12 bg-sky-600 hover:bg-sky-500 text-white font-bold text-base shadow-lg shadow-sky-600/20"
                            >
                                {isPairing ? (
                                    <>
                                        <RefreshCw className="h-5 w-5 mr-2 animate-spin" /> Verifying Terminal Key...
                                    </>
                                ) : (
                                    <>
                                        <ShieldCheck className="h-5 w-5 mr-2" /> Pair Terminal &amp; Start
                                    </>
                                )}
                            </Button>
                        </form>

                        <div className="pt-2 text-center text-xs text-slate-500 space-y-1">
                            <p>Admin Panel Location:</p>
                            <code className="text-sky-400/90 font-mono">Payroll &gt; Settings &gt; Kiosk Tab</code>
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    // =========================================================================
    // PAIRED STATE — Always-On Kiosk Interface
    // =========================================================================
    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col p-4 md:p-6 space-y-6 select-none">
            {/* Header Status Bar */}
            <header className="flex flex-wrap items-center justify-between gap-4 bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-xl backdrop-blur-md">
                <div className="flex items-center gap-3">
                    <div className="p-3 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
                        <Tablet className="h-6 w-6" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-xl font-bold tracking-tight text-white">{pairedDevice?.name || 'Express Kiosk Terminal'}</h1>
                            <Badge variant="outline" className="border-sky-500/40 text-sky-400 text-xs font-bold">
                                Paired
                            </Badge>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                            <MapPin className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                            <span>{pairedDevice?.locationName || 'Geofenced Office Location'}</span>
                            {terminalGps.latitude && (
                                <span className="text-emerald-400/90 font-mono text-[11px] ml-1">
                                    (GPS Verified)
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {/* Online / Offline Status Badge */}
                    {isOnline ? (
                        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 px-3 py-1 font-semibold flex items-center gap-1.5">
                            <Wifi className="h-3.5 w-3.5" /> Online
                        </Badge>
                    ) : (
                        <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/30 px-3 py-1 font-semibold flex items-center gap-1.5">
                            <WifiOff className="h-3.5 w-3.5" /> Offline Mode ({stats.queuedOffline} queued)
                        </Badge>
                    )}

                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleUnpair}
                        className="text-slate-400 hover:text-red-400 hover:bg-red-500/10 h-9 w-9 rounded-xl"
                        title="Unpair Kiosk Device"
                    >
                        <LogOut className="h-4 w-4" />
                    </Button>
                </div>
            </header>

            {/* Main Content Area */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1">
                {/* Left Side: Live Webcam View */}
                <Card className="lg:col-span-8 bg-slate-900/60 border-slate-800 flex flex-col justify-between overflow-hidden shadow-2xl relative">
                    <CardHeader className="pb-2 border-b border-slate-800/80">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-lg font-bold text-white flex items-center gap-2">
                                <ScanFace className="h-5 w-5 text-sky-400" /> Live Entrance Scanner
                            </CardTitle>

                            {modelsLoading ? (
                                <Badge variant="secondary" className="bg-sky-500/10 text-sky-400 animate-pulse border border-sky-500/30">
                                    Loading AI Models ({modelProgress}%)
                                </Badge>
                            ) : modelsReady ? (
                                <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                                    AI Recognition Ready
                                </Badge>
                            ) : null}
                        </div>
                    </CardHeader>

                    <CardContent className="flex-1 flex flex-col items-center justify-center p-4 relative min-h-[400px]">
                        {/* Hidden Canvas for Frame Capture */}
                        <canvas ref={canvasRef} className="hidden" />

                        {cameraActive ? (
                            <div className="relative w-full max-w-xl aspect-video rounded-2xl overflow-hidden border-2 border-sky-500/30 shadow-2xl bg-black">
                                <video
                                    ref={videoRef}
                                    className="w-full h-full object-cover transform -scale-x-100"
                                    playsInline
                                    muted
                                />

                                {/* Face Guide Oval Overlay */}
                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                    <div className="w-56 h-72 rounded-[50%] border-4 border-dashed border-sky-400/60 animate-pulse shadow-[0_0_50px_rgba(56,189,248,0.2)]" />
                                </div>

                                {isScanning && (
                                    <div className="absolute inset-0 bg-sky-950/40 backdrop-blur-xs flex items-center justify-center">
                                        <div className="bg-slate-900/90 border border-sky-500/40 p-4 rounded-2xl shadow-2xl text-center space-y-2">
                                            <RefreshCw className="h-8 w-8 text-sky-400 animate-spin mx-auto" />
                                            <p className="font-bold text-sm text-sky-300">Comparing Face Vector...</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="text-center space-y-4 my-auto p-8">
                                <div className="mx-auto w-20 h-20 rounded-full bg-slate-800 flex items-center justify-center text-slate-500">
                                    <Camera className="h-10 w-10" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-white">Camera Standby</h3>
                                    <p className="text-sm text-slate-400 max-w-sm mx-auto mt-1">
                                        Click start camera to begin live face recognition attendance.
                                    </p>
                                </div>
                                <Button
                                    onClick={startCamera}
                                    disabled={!modelsReady}
                                    size="lg"
                                    className="bg-sky-600 hover:bg-sky-500 font-bold px-8"
                                >
                                    <Camera className="h-5 w-5 mr-2" /> Start Entrance Camera
                                </Button>
                            </div>
                        )}

                        {/* Scanner Error Notice */}
                        {scanError && (
                            <div className="mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-semibold flex items-center gap-2 max-w-xl w-full">
                                <AlertCircle className="h-4 w-4 shrink-0" />
                                <span>{scanError}</span>
                            </div>
                        )}
                    </CardContent>

                    {/* Scan Action Controls */}
                    <div className="p-4 border-t border-slate-800/80 bg-slate-950/40 flex items-center justify-between">
                        <Button
                            onClick={cameraActive ? stopCamera : startCamera}
                            variant={cameraActive ? "destructive" : "default"}
                            className="font-bold"
                        >
                            {cameraActive ? 'Pause Camera' : 'Start Camera'}
                        </Button>

                        <Button
                            onClick={handleFaceScan}
                            disabled={!cameraActive || isScanning || !modelsReady}
                            size="lg"
                            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-8 shadow-lg shadow-emerald-600/20"
                        >
                            <ScanFace className="h-5 w-5 mr-2" /> Scan &amp; Punch Attendance
                        </Button>
                    </div>
                </Card>

                {/* Right Side: Scan Results & Stats Panel */}
                <div className="lg:col-span-4 flex flex-col space-y-6">
                    {/* Last Scan Result Card */}
                    <Card className="bg-slate-900/60 border-slate-800 shadow-xl overflow-hidden">
                        <CardHeader className="pb-3 border-b border-slate-800/80">
                            <CardTitle className="text-base font-bold text-white flex items-center gap-2">
                                <CheckCircle2 className="h-5 w-5 text-emerald-400" /> Recent Verification
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-4">
                            {lastScanResult ? (
                                <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-center space-y-2">
                                    <div className="w-14 h-14 rounded-full bg-emerald-500/20 text-emerald-400 mx-auto flex items-center justify-center font-bold text-xl">
                                        {lastScanResult.name.charAt(0)}
                                    </div>
                                    <h4 className="text-lg font-bold text-white">{lastScanResult.name}</h4>
                                    <Badge variant="outline" className="border-emerald-500/50 text-emerald-400 font-bold">
                                        {lastScanResult.type}
                                    </Badge>
                                    <div className="text-xs text-slate-400 pt-1">
                                        Punch Time: {lastScanResult.time}
                                    </div>
                                </div>
                            ) : (
                                <div className="py-8 text-center text-slate-500 text-xs">
                                    No scan recorded yet. Ready for incoming employees.
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Terminal Cache Stats Card */}
                    <Card className="bg-slate-900/60 border-slate-800 shadow-xl flex-1">
                        <CardHeader className="pb-3 border-b border-slate-800/80">
                            <CardTitle className="text-base font-bold text-white flex items-center gap-2">
                                <ShieldCheck className="h-5 w-5 text-sky-400" /> Tenant Cache Status
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 space-y-4 text-sm">
                            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                                <span className="text-slate-400">Total Active Employees</span>
                                <span className="font-bold text-white font-mono">{stats.totalEmployees}</span>
                            </div>

                            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                                <span className="text-slate-400">Face Vector Enrolled</span>
                                <span className="font-bold text-emerald-400 font-mono">{stats.enrolledEmployees}</span>
                            </div>

                            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                                <span className="text-slate-400">Queued Offline Punches</span>
                                <span className="font-bold text-amber-400 font-mono">{stats.queuedOffline}</span>
                            </div>

                            <Button
                                onClick={fetchEmployeeFaceVectors}
                                variant="outline"
                                size="sm"
                                className="w-full border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 text-xs font-semibold"
                            >
                                <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Reload Tenant Vectors
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
