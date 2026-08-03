'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { AlertCircle, Camera, CheckCircle2, RefreshCw, Wifi, WifiOff, Zap, ScanFace, UserX } from 'lucide-react';
import { toast } from 'sonner';
import { FaceApiBrowserService } from '@/lib/services/faceapi-browser.service';

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
}

export function ExpressKioskApp() {
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);

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

    // Load face-api.js models on startup
    useEffect(() => {
        loadFaceModels();
    }, []);

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
    }, []);

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

    // Fetch and cache employee face vectors locally
    const fetchEmployeeFaceVectors = async () => {
        try {
            const res = await fetch('/api/kiosk/face-vectors');
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
                    const enrolledCount = mapped.filter(e => e.faceEmbedding !== null).length;
                    setStats(prev => ({ ...prev, totalEmployees: data.total, enrolledEmployees: enrolledCount }));
                    toast.info(`${data.total} employees cached. ${enrolledCount} have face enrolled.`);
                }
            }
        } catch (err) {
            console.warn('[Kiosk] Failed to fetch face vectors from cloud. Using local cache.');
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
        if (isScanning || !modelsReady) return;

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
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(punchLog),
                });
                if (res.ok) {
                    toast.success(`✅ Welcome ${matchedEmployee.name}! Attendance marked at ${timeStr} (${similarity}% match)`);
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
    }, [isScanning, modelsReady, employees, cameraActive]);

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
        setOfflineQueue(prev => {
            if (prev.length === 0) return prev;
            fetch('/api/kiosk/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ punches: prev }),
            }).then(res => {
                if (res.ok) {
                    toast.success(`Synced ${prev.length} offline punches!`);
                    setStats(s => ({ ...s, queuedOffline: 0 }));
                    return [];
                }
                return prev;
            }).catch(console.error);
            return prev;
        });
    };

    return (
        <Card className="w-full max-w-4xl mx-auto border-2 border-border shadow-2xl bg-card text-foreground overflow-hidden">
            <CardHeader className="border-b border-border pb-4 bg-muted/30">
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="text-2xl font-bold flex items-center gap-2 text-foreground">
                            <Zap className="h-6 w-6 text-amber-500 fill-amber-500" />
                            Express Selfie Kiosk
                        </CardTitle>
                        <CardDescription className="text-muted-foreground">
                            Always-On Entrance Attendance Terminal — Real face-api.js Matching
                        </CardDescription>
                    </div>

                    <div className="flex items-center gap-3">
                        <Badge variant={isOnline ? 'default' : 'destructive'} className="flex items-center gap-1.5 px-3 py-1 text-sm font-medium">
                            {isOnline ? <Wifi className="h-4 w-4 text-emerald-400" /> : <WifiOff className="h-4 w-4" />}
                            {isOnline ? 'Cloud Connected' : 'Local Offline Mode'}
                        </Badge>

                        {stats.queuedOffline > 0 && (
                            <Badge variant="outline" className="border-amber-500 text-amber-600 dark:text-amber-400 font-bold animate-pulse">
                                {stats.queuedOffline} Queued Offline
                            </Badge>
                        )}
                    </div>
                </div>
            </CardHeader>

            <CardContent className="p-6 space-y-6">
                {/* Model Loading Progress */}
                {modelsLoading && (
                    <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/30 space-y-2">
                        <div className="flex items-center gap-2 text-sm font-medium text-blue-600 dark:text-blue-400">
                            <RefreshCw className="h-4 w-4 animate-spin" />
                            {modelMsg}
                        </div>
                        <Progress value={modelProgress} className="h-2" />
                        <p className="text-xs text-muted-foreground">Loading once — future loads will be instant from cache.</p>
                    </div>
                )}

                {/* Camera Viewer */}
                <div className="relative aspect-video w-full max-w-2xl mx-auto rounded-2xl overflow-hidden bg-slate-950 border-2 border-slate-800 shadow-inner flex items-center justify-center">
                    <video
                        ref={videoRef}
                        className={`w-full h-full object-cover transform -scale-x-100 ${!cameraActive ? 'hidden' : ''}`}
                        playsInline
                        muted
                    />

                    {/* Hidden canvas for frame capture */}
                    <canvas ref={canvasRef} className="hidden" />

                    {!cameraActive && (
                        <div className="text-center p-8 space-y-4">
                            <div className="w-20 h-20 mx-auto rounded-full bg-slate-900 border border-slate-700 flex items-center justify-center">
                                <Camera className="h-10 w-10 text-amber-400" />
                            </div>
                            <h3 className="text-lg font-bold text-slate-100">Kiosk Terminal Standby</h3>
                            <p className="text-sm text-slate-400 max-w-md">
                                Mount this tablet at your office entrance. Click below to start the camera stream.
                            </p>
                            <Button
                                onClick={startCamera}
                                disabled={!modelsReady}
                                size="lg"
                                className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold px-8 shadow-lg transition-all active:scale-95 disabled:opacity-50"
                            >
                                {modelsLoading ? (
                                    <><RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Loading Models...</>
                                ) : (
                                    'Start Always-On Kiosk'
                                )}
                            </Button>
                        </div>
                    )}

                    {/* Face Alignment Oval Overlay */}
                    {cameraActive && (
                        <div className="absolute inset-0 border-4 border-dashed border-amber-400/40 rounded-2xl pointer-events-none flex items-center justify-center">
                            <div className="relative w-64 h-80 rounded-full border-2 border-emerald-400/80 shadow-[0_0_30px_rgba(52,211,153,0.3)]">
                                <span className="absolute -bottom-9 left-1/2 -translate-x-1/2 text-xs font-bold text-emerald-300 bg-slate-950/90 border border-emerald-500/40 px-3 py-1 rounded-full backdrop-blur-md whitespace-nowrap shadow-md">
                                    Align Face in Circle
                                </span>
                            </div>
                        </div>
                    )}
                </div>

                {/* Action Buttons */}
                {cameraActive && (
                    <div className="flex justify-center gap-4">
                        <Button
                            onClick={handleFaceScan}
                            disabled={isScanning || !modelsReady}
                            size="lg"
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold px-10 text-lg shadow-lg hover:shadow-emerald-600/30 transition-all active:scale-95"
                        >
                            {isScanning ? (
                                <><RefreshCw className="h-5 w-5 mr-2 animate-spin text-white" /> Scanning Face...</>
                            ) : (
                                <><ScanFace className="h-5 w-5 mr-2 text-white" /> Mark Attendance</>
                            )}
                        </Button>

                        <Button
                            onClick={stopCamera}
                            variant="outline"
                            className="border-slate-300 dark:border-slate-700 text-foreground hover:bg-slate-100 dark:hover:bg-slate-800 font-bold"
                        >
                            Stop Camera
                        </Button>
                    </div>
                )}

                {/* Error Banner */}
                {scanError && (
                    <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/40 flex items-center justify-between animate-in fade-in slide-in-from-bottom-2">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-full bg-destructive/20 border border-destructive flex items-center justify-center text-destructive shrink-0">
                                <UserX className="h-6 w-6" />
                            </div>
                            <div>
                                <h4 className="font-bold text-base text-destructive">Face Verification Failed</h4>
                                <p className="text-xs text-muted-foreground">{scanError}</p>
                            </div>
                        </div>
                        <Badge variant="destructive" className="font-bold px-3 py-1 shrink-0">
                            Not Marked
                        </Badge>
                    </div>
                )}

                {/* Success Result Card */}
                {lastScanResult && !scanError && (
                    <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between animate-in fade-in slide-in-from-bottom-2">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-full bg-emerald-500/20 border border-emerald-500 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                                <CheckCircle2 className="h-6 w-6" />
                            </div>
                            <div>
                                <h4 className="font-bold text-lg text-foreground">{lastScanResult.name}</h4>
                                <p className="text-xs text-muted-foreground">
                                    {lastScanResult.type} • {lastScanResult.time}
                                </p>
                            </div>
                        </div>
                        <Badge className="bg-emerald-600 text-white font-bold px-3 py-1">
                            Verified ✓
                        </Badge>
                    </div>
                )}

                {/* Footer Stats */}
                <div className="pt-4 border-t border-border grid grid-cols-3 gap-4 text-center text-xs text-muted-foreground">
                    <div className="p-3 rounded-lg bg-muted/60 border border-border">
                        <span className="block font-bold text-lg text-foreground">{stats.totalEmployees}</span>
                        Total Employees
                    </div>
                    <div className="p-3 rounded-lg bg-muted/60 border border-border">
                        <span className="block font-bold text-lg text-emerald-600 dark:text-emerald-400">{stats.enrolledEmployees}</span>
                        Face Enrolled
                    </div>
                    <div className="p-3 rounded-lg bg-muted/60 border border-border">
                        <span className="block font-bold text-lg text-amber-600 dark:text-amber-400">
                            {modelsReady ? '< 300ms' : 'Loading...'}
                        </span>
                        Scan Latency
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
