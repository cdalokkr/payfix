"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { format } from "date-fns"
import Link from "next/link"
import { motion } from "framer-motion"
import { useState, useEffect, useRef } from "react"
import { trpc } from "@/lib/trpc/client"
import { ProfilePhotoCapture } from "@/features/mobile/profile-photo-capture"



import {
    Clock as IconClock,
    LogIn as IconLogin,
    LogOut as IconLogout,
    Check as IconCheck,
    CheckCheck as IconCheckCheck,
    AlertTriangle as IconAlertTriangle,
    ArrowRight as IconArrowRight,
    History as IconHistory,
    CalendarDays as IconCalendarEvent,
    Settings as IconSettings,
    HelpCircle as IconQuestionMark,
    Loader2 as IconLoader2,
    Download as IconDownload,
    Camera as IconCamera
} from "lucide-react"
import {
    CalendarClock,
    MapPinCheck,
    MapPinX,
    MapPinHouse,
    MapPinOff,
    ClockArrowDown,
    ClockArrowUp,
    CircleCheckBig,
    IndianRupee,
    Receipt,
    TicketCheck,
    Briefcase,
    ShieldAlert,
    Smartphone,
    Cpu
} from "lucide-react"
import { usePwaCheck } from "@/hooks/use-pwa-check"
import { isDefaultAvatar } from "@/lib/utils/avatar-helper"
import { FaceVerificationService } from "@/lib/services/face-verification.service"
import { FaceApiBrowserService } from "@/lib/services/faceapi-browser.service"
import { MediaPipeMeshService } from "@/lib/services/mediapipe-mesh.service"

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

interface MobileDashboardProps {
    profile: {
        id: string
        full_name: string | null
        avatar_url: string | null
        email: string
        sex: string | null
        avatar_status: string | null
        role: string
    }
    todayAttendance: {
        id: string
        check_in: string | null
        check_out: string | null
        status: string
    } | null
    isPwaServer?: boolean
}

const containerVars = {
    hidden: { opacity: 0 },
    show: {
        opacity: 1,
        transition: {
            staggerChildren: 0.1
        }
    }
}

const itemVars = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
}

const quickActions = [
    { label: "Leaves", icon: IconCalendarEvent, href: "/mobile/leaves", color: "bg-purple-500/10 text-purple-600" },
    { label: "Advances", icon: IndianRupee, href: "/mobile/advances", color: "bg-emerald-500/10 text-emerald-600" },
    { label: "Pay Slips", icon: Receipt, href: "/mobile/payslip", color: "bg-orange-500/10 text-orange-600" },
    { label: "My Tickets", icon: TicketCheck, href: "/mobile/tickets", color: "bg-cyan-500/10 text-cyan-600" },
    { label: "History", icon: IconHistory, href: "/mobile/history", color: "bg-blue-500/10 text-blue-600" },
    { label: "Settings", icon: IconSettings, href: "/mobile/profile", color: "bg-slate-500/10 text-slate-600" },
]

export function MobileDashboard({ profile, todayAttendance: initialAttendance, isPwaServer }: MobileDashboardProps) {
    const { isPwa, isMobile, isReady } = usePwaCheck(isPwaServer)
    const [isDesktop, setIsDesktop] = useState(false)
    const [isPhotoCaptureOpen, setIsPhotoCaptureOpen] = useState(false)
    const [preWarmedStream, setPreWarmedStream] = useState<MediaStream | null>(null)
    const preWarmedStreamRef = useRef<MediaStream | null>(null)
    const [hardwareInfo] = useState(() => getHardwareAccelerationInfo())
    useEffect(() => {
        // Pre-warm face recognition models & MediaPipe vision in background
        FaceVerificationService.initialize().catch(() => {})
        FaceApiBrowserService.loadDetectorOnly().catch(() => {})
        MediaPipeMeshService.initialize().catch(() => {})

        const preWarmTimer = setTimeout(async () => {
            try {
                if (navigator?.mediaDevices?.getUserMedia) {
                    const stream = await navigator.mediaDevices.getUserMedia({
                        video: { facingMode: { exact: 'user' }, width: { ideal: 480 }, height: { ideal: 640 } },
                        audio: false
                    })
                    preWarmedStreamRef.current = stream
                    setPreWarmedStream(stream)
                }
            } catch {
                // Silently ignore camera pre-warm errors
            }
        }, 2000)

        setIsDesktop(window.innerWidth >= 1024)

        const handleResize = () => setIsDesktop(window.innerWidth >= 1024)
        window.addEventListener('resize', handleResize)
        return () => {
            clearTimeout(preWarmTimer)
            if (preWarmedStreamRef.current) {
                preWarmedStreamRef.current.getTracks().forEach(track => track.stop())
                preWarmedStreamRef.current = null
            }
            window.removeEventListener('resize', handleResize)
        }
    }, [])


    // Initialize from sessionStorage if available (persists across navigation) and not expired
    const [geofenceResult, setGeofenceResult] = useState<{
        isAllowed: boolean
        nearestOffice?: { id: string; name: string; distance: number }
        withinOffice?: { id: string; name: string; distance: number }
    } | null>(() => {
        if (typeof window !== 'undefined') {
            const cached = sessionStorage.getItem('mobileGeofenceResult')
            const cachedTime = sessionStorage.getItem('mobileGeofenceTimestamp')
            if (cached && cachedTime) {
                const age = Date.now() - Number(cachedTime)
                if (age < 600000) { // 10 minutes cache validity
                    return JSON.parse(cached)
                }
            }
            // Clear expired or absent cache
            sessionStorage.removeItem('mobileGeofenceResult')
            sessionStorage.removeItem('mobileUserCoords')
            sessionStorage.removeItem('mobileGeofenceTimestamp')
        }
        return null
    })

    const [isLocChecking, setIsLocChecking] = useState(() => {
        // If we have valid cached geofence result, don't show loading
        if (typeof window !== 'undefined') {
            const cached = sessionStorage.getItem('mobileGeofenceResult')
            const cachedTime = sessionStorage.getItem('mobileGeofenceTimestamp')
            if (cached && cachedTime) {
                const age = Date.now() - Number(cachedTime)
                if (age < 600000) {
                    return false
                }
            }
        }
        return true
    })

    const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(() => {
        if (typeof window !== 'undefined') {
            const cached = sessionStorage.getItem('mobileUserCoords')
            const cachedTime = sessionStorage.getItem('mobileGeofenceTimestamp')
            if (cached && cachedTime) {
                const age = Date.now() - Number(cachedTime)
                if (age < 600000) {
                    return JSON.parse(cached)
                }
            }
        }
        return null
    })


    const utils = trpc.useUtils()

    // Use client-side query with server data as initial value for real-time updates
    const { data: todayAttendance } = trpc.attendance.getMobileAttendance.useQuery(undefined, {
        initialData: initialAttendance,
        staleTime: 0, // Consider data always stale so it refetches on invalidation
        refetchOnWindowFocus: false,
    })

    // Fetch office settings and closures for holiday check
    const { data: settings } = trpc.attendance.getOfficeSettings.useQuery(undefined, {
        enabled: isReady && (isPwa || profile.role === 'employee')
    })
    const { data: closures } = trpc.attendance.getOfficeClosures.useQuery(undefined, {
        enabled: isReady && (isPwa || profile.role === 'employee')
    })

    const todayStr = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Kolkata' })
    const isTodayOffDay = settings?.off_days?.includes(new Date().getDay())
    const todayClosure = closures?.find((c: any) => c.date === todayStr)
    const isTodayHoliday = !!todayClosure

    const hasNoPhoto = profile.avatar_status !== 'custom' && (!profile.avatar_url || isDefaultAvatar(profile.avatar_url))

    useEffect(() => {
        const fetchLocation = async () => {
            // Check if we have a valid recent cache (less than 30 seconds old) with a result
            if (typeof window !== 'undefined') {
                const cachedTime = sessionStorage.getItem('mobileGeofenceTimestamp')
                const cachedResult = sessionStorage.getItem('mobileGeofenceResult')
                if (cachedTime && cachedResult) {
                    const age = Date.now() - Number(cachedTime)
                    if (age < 30000) { // 30 seconds cache validity
                        setIsLocChecking(false)
                        return
                    }
                }
            }

            // Only fetch if PWA (or Employee on mobile browser) and Profile photo is updated
            if (!(isPwa || profile.role === 'employee') || hasNoPhoto) {
                setIsLocChecking(false)
                return
            }

            // Look for cached or pre-warmed coordinates in sessionStorage or state
            let startCoords = userCoords
            if (!startCoords && typeof window !== 'undefined') {
                const cached = sessionStorage.getItem('mobileUserCoords')
                if (cached) {
                    try {
                        startCoords = JSON.parse(cached)
                    } catch (e) {}
                }
            }

            // If no coordinates are available yet, try a fast low-accuracy lookup (1.5s timeout)
            if (!startCoords && typeof window !== 'undefined' && navigator.geolocation) {
                try {
                    const fastPos = await new Promise<GeolocationPosition>((resolve, reject) => {
                        navigator.geolocation.getCurrentPosition(resolve, reject, {
                            enableHighAccuracy: false,
                            timeout: 1500,
                            maximumAge: 60000 // up to 1 minute cached coordinates
                        })
                    })
                    startCoords = {
                        lat: fastPos.coords.latitude,
                        lng: fastPos.coords.longitude
                    }
                    setUserCoords(startCoords)
                    sessionStorage.setItem('mobileUserCoords', JSON.stringify(startCoords))
                } catch (err) {
                    console.warn('[GEO] Fast geolocation lookup failed or timed out:', err)
                }
            }

            // If we have starting coordinates, run a fast server check immediately to render UI state
            if (startCoords) {
                try {
                    const result = await utils.officeLocations.checkGeofence.fetch({
                        latitude: startCoords.lat,
                        longitude: startCoords.lng
                    })
                    setGeofenceResult(result)
                    sessionStorage.setItem('mobileGeofenceResult', JSON.stringify(result))
                    sessionStorage.setItem('mobileGeofenceTimestamp', Date.now().toString())
                } catch (err) {
                    console.error('[GEO] Fast geofence verification failed:', err)
                } finally {
                    setIsLocChecking(false)
                }
            } else {
                setIsLocChecking(true)
            }

            if (!navigator.geolocation) {
                setIsLocChecking(false)
                return
            }

            // Run high-accuracy refinement in the background
            navigator.geolocation.getCurrentPosition(
                async (pos) => {
                    const refinedCoords = {
                        lat: pos.coords.latitude,
                        lng: pos.coords.longitude
                    }

                    // Check if difference is negligible (within ~10m) to save a redundant fetch
                    if (startCoords) {
                        const latDiff = Math.abs(refinedCoords.lat - startCoords.lat)
                        const lngDiff = Math.abs(refinedCoords.lng - startCoords.lng)
                        if (latDiff < 0.0001 && lngDiff < 0.0001) {
                            console.log('[GEO] Location refined: negligible difference, keeping fast result')
                            setIsLocChecking(false)
                            return
                        }
                    }

                    setUserCoords(refinedCoords)
                    sessionStorage.setItem('mobileUserCoords', JSON.stringify(refinedCoords))

                    try {
                        const result = await utils.officeLocations.checkGeofence.fetch({
                            latitude: refinedCoords.lat,
                            longitude: refinedCoords.lng
                        })
                        setGeofenceResult(result)
                        sessionStorage.setItem('mobileGeofenceResult', JSON.stringify(result))
                        sessionStorage.setItem('mobileGeofenceTimestamp', Date.now().toString())
                    } catch (err) {
                        console.error('[GEO] Refined geofence check failed:', err)
                    } finally {
                        setIsLocChecking(false)
                    }
                },
                (err) => {
                    console.warn('[GEO] Location refinement failed:', err)
                    setIsLocChecking(false)
                },
                { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
            )
        }

        if (isReady) {
            fetchLocation()
        }
    }, [utils, isPwa, isReady, hasNoPhoto])

    const hasCheckedIn = !!todayAttendance?.check_in
    const hasCheckedOut = !!todayAttendance?.check_out
    const isComplete = hasCheckedIn && hasCheckedOut

    const getStatusColor = () => {
        if (isComplete) return 'from-indigo-600 via-indigo-650 to-violet-700'
        if (hasCheckedIn) return 'from-sky-500 to-blue-600'
        return 'from-purple-500 to-indigo-600'
    }

    // Get icon color based on status
    const getHeadingIconColor = () => {
        return 'text-white'
    }

    const now = new Date()

    return (
        <motion.div
            variants={containerVars}
            initial="hidden"
            animate="show"
            className="space-y-6 pb-4"
        >
            {/* Today's Status Card */}
            <motion.div variants={itemVars} whileTap={{ scale: 0.99 }}>
                <div className={`relative overflow-hidden rounded-[1.5rem] bg-gradient-to-br ${getStatusColor()} p-3.5 text-white ${
                    isComplete ? 'shadow-[0_15px_35px_rgba(99,102,241,0.25)]' :
                    hasCheckedIn ? 'shadow-[0_15px_35px_rgba(14,165,233,0.25)]' :
                    'shadow-[0_15px_35px_rgba(139,92,246,0.25)]'
                } transition-all duration-500 border border-white/10 min-h-[235px] flex flex-col justify-between`}>
                    {/* Glass Decorations */}
                    <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full -mr-24 -mt-24 blur-2xl" />
                    <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full -ml-16 -mb-16 blur-xl" />

                    {/* Hardware Acceleration Badge Pill at the top row of the card */}
                    <div className="w-full mb-2.5 py-1.5 px-3 rounded-xl bg-slate-950/85 border border-sky-500/40 text-sky-400 font-mono font-black text-xs shadow-lg backdrop-blur-md flex items-center justify-center gap-2 text-center">
                        <Cpu className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                        <span className="tracking-wider text-sky-300">
                            {hardwareInfo.backend}
                        </span>
                    </div>


                    <div className="relative flex items-start justify-between gap-4">
                        <div className="flex flex-col gap-1.5 py-0.5">
                            {/* Today's Attendance Heading with CalendarClock icon */}
                            <div className="flex items-center gap-2">
                                <CalendarClock className="w-4 h-4 text-white" />
                                <span className="text-xs font-black uppercase tracking-[0.2em] opacity-90">Today's Attendance</span>
                            </div>

                            {/* GPS Coordinates - Below heading (only when not loading and has coords) */}
                            {!isLocChecking && userCoords && (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className="inline-flex items-center gap-1.5 mt-1.5 px-2.5 py-1 rounded-full bg-white/10 dark:bg-black/25 border border-white/10 backdrop-blur-md w-fit"
                                >
                                    {geofenceResult?.isAllowed ? (
                                        <div className="relative flex items-center justify-center shrink-0">
                                            <MapPinCheck className="w-3 h-3 text-white relative z-10" />
                                            <span className="absolute inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400 opacity-75 animate-ping" />
                                        </div>
                                    ) : (
                                        <div className="relative flex items-center justify-center shrink-0">
                                            <MapPinX className="w-3 h-3 text-white relative z-10" />
                                            <span className="absolute inline-flex h-2.5 w-2.5 rounded-full bg-orange-400 opacity-75 animate-ping" />
                                        </div>
                                    )}
                                    <span className="text-[10px] font-black text-white/95 tracking-tight font-mono">
                                        {userCoords.lat.toFixed(5)}, {userCoords.lng.toFixed(5)}
                                    </span>
                                </motion.div>
                            )}
                        </div>



                        {/* Integrated Calendar UI */}
                        <div className="relative group shrink-0">
                            <motion.div
                                initial={{ scale: 0.9 }}
                                animate={{ scale: 1 }}
                                className="flex flex-col items-center bg-white rounded-xl p-1.5 min-w-[65px] shadow-lg"
                            >
                                <span className="text-[9px] font-black text-rose-500 uppercase tracking-widest border-b border-rose-100 w-full text-center pb-0.5 mb-1">
                                    {format(now, 'MMM').toUpperCase()}
                                </span>
                                <div className="flex items-center justify-center gap-1">
                                    <span className="text-xl font-black text-slate-800 leading-none">
                                        {format(now, 'dd')}
                                    </span>
                                    <span className="text-[9px] font-black text-slate-500 uppercase">
                                        {format(now, 'EEE').toUpperCase()}
                                    </span>
                                </div>
                            </motion.div>
                            <div className="absolute -inset-1 bg-white/20 blur-md -z-10 rounded-xl" />
                        </div>
                    </div>

                    <motion.div layout className="mt-1 space-y-3">
                        {!isReady ? (
                            <div className="flex items-center justify-center p-8">
                                <IconLoader2 className="w-8 h-8 animate-spin opacity-20" />
                            </div>
                        ) : isDesktop ? (
                            <div className="p-6 rounded-[2rem] bg-rose-500/20 backdrop-blur-md border border-rose-500/30 text-center">
                                <IconAlertTriangle className="w-10 h-10 mx-auto mb-3 text-rose-100" />
                                <h4 className="text-sm font-black uppercase tracking-widest mb-2 text-rose-50">Desktop Blocked</h4>
                                <p className="text-[11px] font-medium text-rose-100/80">Attendance marking is restricted to mobile devices / PWA only.</p>
                            </div>
                        ) : (!isPwa && profile.role !== 'employee') ? (
                            <div className="p-6 rounded-[2rem] bg-white/20 backdrop-blur-md border border-white/30 text-center">
                                <IconDownload className="w-10 h-10 mx-auto mb-3 opacity-80" />
                                <h4 className="text-sm font-black uppercase tracking-widest mb-2">PWA Required</h4>
                                <p className="text-[11px] font-medium opacity-80 mb-4">Attendance can only be marked via the installed Mobile App.</p>
                                <div className="text-[10px] font-bold bg-white/20 py-2 rounded-xl">
                                    Install from browser menu
                                </div>
                            </div>
                        ) : hasNoPhoto ? (
                            <div className="p-6 rounded-[2rem] bg-rose-500/20 backdrop-blur-md border border-rose-500/30 text-center">
                                <IconCamera className="w-10 h-10 mx-auto mb-3 text-rose-100" />
                                <h4 className="text-sm font-black uppercase tracking-widest mb-2 text-rose-50">Update Photo</h4>
                                <p className="text-[11px] font-medium text-rose-100/80 mb-4">You must upload a custom profile photo to proceed.</p>
                                <Button
                                    onClick={() => setIsPhotoCaptureOpen(true)}
                                    className="w-full rounded-xl bg-white text-rose-600 font-bold hover:bg-white/90"
                                >
                                    Update Now
                                </Button>
                            </div>
                        ) : (
                            <motion.div layout className="w-full space-y-3">
                                {/* If today is holiday or off day and not clocked in, show info banner */}
                                {(isTodayHoliday || isTodayOffDay) && !todayAttendance && (
                                    <div className="p-4.5 rounded-[1.5rem] bg-white/10 border border-white/15 backdrop-blur-md text-center text-white space-y-1.5 shadow-md">
                                        <div className="flex items-center justify-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-amber-200">
                                            <IconCalendarEvent className="w-4 h-4" />
                                            <span>{isTodayHoliday ? 'Office Holiday' : 'Weekly Off'}</span>
                                        </div>
                                        <p className="text-[10px] font-semibold text-white/80 leading-relaxed">
                                            {isTodayHoliday ? (todayClosure?.reason || 'Office Closed') : 'Scheduled Weekly Off'}
                                        </p>
                                        <p className="text-[9px] font-bold text-white/50 uppercase tracking-widest leading-none pt-0.5">
                                            Office Verified by default. Clock in only if working.
                                        </p>
                                    </div>
                                )}
                                {/* Location Loading State - Centered with Zoom Animation */}
                                {isLocChecking ? (
                                    <motion.div
                                        initial={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.8 }}
                                        className="flex flex-col items-center justify-center p-8 bg-white/10 rounded-2xl border border-white/20 backdrop-blur-sm"
                                    >
                                        <IconLoader2 className="w-8 h-8 animate-spin text-white/70 mb-3" />
                                        <span className="text-[11px] font-black uppercase tracking-widest text-white/70">
                                            Locating Office Area...
                                        </span>
                                    </motion.div>
                                ) : (
                                    <motion.div
                                        initial={{ opacity: 0, scale: 0.95 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        transition={{ duration: 0.3, ease: "easeOut" }}
                                        className="space-y-3"
                                    >
                                        {/* Office Name Badge */}
                                        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl backdrop-blur-md border transition-all
                                            ${geofenceResult?.isAllowed
                                                ? 'bg-emerald-500/20 border-emerald-400/30'
                                                : 'bg-gradient-to-r from-orange-500/30 to-rose-500/30 border-orange-400/40'}`}>
                                            {geofenceResult?.isAllowed && geofenceResult.withinOffice ? (
                                                <>
                                                    <div className="w-5.5 h-5.5 rounded-md flex items-center justify-center shrink-0 bg-white/20">
                                                        <MapPinHouse className="w-3.5 h-3.5 text-white" />
                                                    </div>
                                                    <span className="text-[10px] font-black uppercase tracking-wider text-white">
                                                        {geofenceResult.withinOffice.name}
                                                    </span>
                                                </>
                                            ) : (
                                                <>
                                                    <div className="w-5.5 h-5.5 rounded-md flex items-center justify-center shrink-0 bg-white/20">
                                                        <MapPinOff className="w-3.5 h-3.5 text-white" />
                                                    </div>
                                                    <span className="text-[10px] font-black uppercase tracking-wider text-white">
                                                        Outside Office Area
                                                    </span>
                                                </>
                                            )}
                                        </div>

                                        {/* IN / OUT Time Display or Out-of-Office Warning */}
                                        {!geofenceResult?.isAllowed ? (
                                            <div className="p-4 rounded-xl bg-gradient-to-r from-orange-600/40 to-rose-600/40 border border-orange-400/30 backdrop-blur-md">
                                                <div className="flex items-center gap-3 mb-2">
                                                    <div className="w-8 h-8 rounded-xl bg-orange-500/30 flex items-center justify-center">
                                                        <IconAlertTriangle className="w-5 h-5 text-orange-200 animate-pulse" />
                                                    </div>
                                                    <div>
                                                        <p className="text-[11px] font-black uppercase tracking-widest text-white">
                                                            Outside Office Perimeter
                                                        </p>
                                                        <p className="text-[9px] font-medium text-white/60">
                                                            Attendance marking is restricted
                                                        </p>
                                                    </div>
                                                </div>
                                                {geofenceResult?.nearestOffice && (
                                                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/10">
                                                        <span className="text-[9px] font-bold text-white/50 uppercase tracking-wider">
                                                            Nearest: {geofenceResult.nearestOffice.name}
                                                        </span>
                                                        <span className="text-[10px] font-black text-orange-200 bg-orange-500/30 px-2.5 py-1 rounded-lg">
                                                            {(geofenceResult.nearestOffice.distance / 1000).toFixed(1)} KM Away
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <>
                                                {/* IN / OUT Time Labels */}
                                                <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl bg-white/10 border border-white/15 backdrop-blur-sm">
                                                    <div className="flex items-center gap-1.5 min-w-0">
                                                        <div className={`w-5.5 h-5.5 rounded-md flex items-center justify-center shrink-0
                                                            ${hasCheckedIn ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.3)]' : 'bg-white/10'}`}>
                                                            <ClockArrowDown className="w-3.5 h-3.5 text-white stroke-[2.5]" />
                                                        </div>
                                                        <div className="flex items-center gap-1 min-w-0">
                                                            <span className="text-[10px] font-black uppercase text-white/90 tracking-wider">IN</span>
                                                            <span className={`text-[13px] font-black whitespace-nowrap tracking-tight ${hasCheckedIn ? 'text-white' : 'text-white/40'}`}>
                                                                {todayAttendance?.check_in
                                                                    ? format(new Date(todayAttendance.check_in), 'hh:mm a')
                                                                    : '--:-- --'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <div className="w-px h-5 bg-white/20 shrink-0" />
                                                    <div className="flex items-center gap-1.5 min-w-0">
                                                        <div className={`w-5.5 h-5.5 rounded-md flex items-center justify-center shrink-0
                                                            ${hasCheckedOut ? 'bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.3)]' : 'bg-white/10'}`}>
                                                            <ClockArrowUp className="w-3.5 h-3.5 text-white stroke-[2.5]" />
                                                        </div>
                                                        <div className="flex items-center gap-1 min-w-0">
                                                            <span className="text-[10px] font-black uppercase text-white/90 tracking-wider">OUT</span>
                                                            <span className={`text-[13px] font-black whitespace-nowrap tracking-tight ${hasCheckedOut ? 'text-white' : 'text-white/40'}`}>
                                                                {todayAttendance?.check_out
                                                                    ? format(new Date(todayAttendance.check_out), 'hh:mm a')
                                                                    : '--:-- --'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Single Dynamic Clock Button */}
                                                {!isComplete && (
                                                    <motion.div whileTap={{ scale: 0.97 }} className="w-full">
                                                        <Link
                                                            href={`/mobile/attendance?action=${hasCheckedIn ? 'clock_out' : 'clock_in'}`}
                                                            className={`flex items-center justify-center gap-2.5 w-full h-11 px-3.5 rounded-xl border transition-all shadow-md active:scale-98 backdrop-blur-md
                                                                ${hasCheckedIn
                                                                    ? 'bg-rose-500/20 border-rose-400/35 hover:bg-rose-500/30 text-white'
                                                                    : 'bg-indigo-600/35 border-indigo-400/60 hover:bg-indigo-600/45 text-white'}`}
                                                        >
                                                            <div className={`w-7.5 h-7.5 rounded-lg flex items-center justify-center shadow-sm shrink-0 border border-white/20
                                                                ${hasCheckedIn
                                                                    ? 'bg-rose-500/90 text-white'
                                                                    : 'bg-indigo-600 text-white'}`}>
                                                                {hasCheckedIn
                                                                    ? <ClockArrowUp className="w-4 h-4 text-white stroke-[2.5]" />
                                                                    : <ClockArrowDown className="w-4 h-4 text-white stroke-[2.5]" />}
                                                            </div>
                                                            <span className="text-xs font-black uppercase tracking-wider text-white">
                                                                {hasCheckedIn ? 'Mark Office Out' : 'Mark Office In'}
                                                            </span>
                                                            <IconArrowRight className="w-4 h-4 text-white/80 ml-auto" />
                                                        </Link>

                                                    </motion.div>
                                                )}



                                                {/* Attendance Complete Badge */}
                                                {isComplete && (
                                                    <div className="flex items-center justify-center gap-2.5 px-3 py-2 rounded-xl bg-white/10 border border-white/15 backdrop-blur-md w-full">
                                                        <div className="w-5.5 h-5.5 rounded-full bg-white flex items-center justify-center shrink-0 shadow-sm">
                                                            <IconCheckCheck className="w-3.5 h-3.5 text-indigo-600 stroke-[3]" />
                                                        </div>
                                                        <span className="text-[10px] font-black uppercase tracking-[0.12em] text-white">
                                                            Attendance Marked
                                                        </span>
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </motion.div>
                                )}
                            </motion.div>
                        )}
                    </motion.div>
                </div>
            </motion.div>




            {/* Quick Actions Grid */}
            <motion.div variants={itemVars} className="space-y-4 pt-2">
                <div className="flex items-center justify-between px-2">
                    <h3 className="text-[11px] font-black text-muted-foreground uppercase tracking-[0.2em]">Quick Access</h3>
                    <div className="h-px bg-slate-200 dark:bg-slate-800 flex-1 ml-4" />
                </div>
                <div className="grid grid-cols-3 gap-3 px-2 pb-4 pt-1">
                    {quickActions.map((action) => (
                        <Link key={action.label} href={action.href} prefetch={true}>
                            <motion.div
                                whileTap={{ scale: 0.95 }}
                                className="bg-white dark:bg-slate-900/80 p-3 rounded-2xl flex flex-col gap-2.5 shadow-[0_2px_10px_rgba(0,0,0,0.03)] border border-slate-100 dark:border-slate-800/50 w-full relative overflow-hidden group items-center text-center backdrop-blur-sm"
                            >
                                <div className={`w-10 h-10 rounded-[1rem] ${action.color} flex items-center justify-center transition-transform group-hover:scale-110 duration-300`}>
                                    <action.icon className="w-5 h-5" />
                                </div>
                                <span className="font-bold text-[11.5px] tracking-tight">{action.label}</span>
                            </motion.div>
                        </Link>
                    ))}
                </div>
            </motion.div>

            {/* Profile Photo Warning */}
            {!profile.avatar_url && (
                <motion.div variants={itemVars}>
                    <Card className="rounded-[2rem] border-amber-500/20 bg-amber-50/50 dark:bg-amber-950/10 shadow-none border-dashed border-2 overflow-hidden">
                        <CardContent className="p-5">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                                    <IconAlertTriangle className="w-6 h-6 text-amber-600" />
                                </div>
                                <div className="flex-1">
                                    <p className="font-black text-sm text-amber-900 dark:text-amber-200 uppercase tracking-tight">Missing Profile Photo</p>
                                    <p className="text-xs text-amber-700/80 dark:text-amber-500/80 mb-3 font-medium">
                                        Required for face verification.
                                    </p>
                                    <Button
                                        onClick={() => setIsPhotoCaptureOpen(true)}
                                        size="sm"
                                        variant="outline"
                                        className="h-9 px-4 rounded-xl text-[11px] font-black border-amber-200 dark:border-amber-800/50 hover:bg-amber-500 hover:text-white transition-all uppercase tracking-wider"
                                    >
                                        Setup Now
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>
            )}

            {/* Seamless Profile Selfie Capture Popup Modal (Zero Page Reload / Refresh) */}
            <Dialog
                open={isPhotoCaptureOpen}
                onOpenChange={(open) => {
                    if (!open) {
                        setIsPhotoCaptureOpen(false)
                        if (preWarmedStreamRef.current) {
                            preWarmedStreamRef.current.getTracks().forEach(track => track.stop())
                            preWarmedStreamRef.current = null
                            setPreWarmedStream(null)
                        }
                    }
                }}
            >
                <DialogContent className="max-w-md w-[95vw] p-0 bg-slate-950 border-slate-800 text-slate-100 overflow-hidden rounded-3xl z-[70] max-h-[92vh] overflow-y-auto [&>button]:hidden">

                    <ProfilePhotoCapture
                        profileId={profile.id}
                        profileData={{
                            fullName: profile.full_name || 'User',
                            email: profile.email,
                            role: profile.role,
                            avatarUrl: profile.avatar_url,
                            avatarStatus: profile.avatar_status
                        }}
                        preWarmedStream={preWarmedStream}
                        onSuccess={() => {
                            setIsPhotoCaptureOpen(false)
                            if (preWarmedStreamRef.current) {
                                preWarmedStreamRef.current.getTracks().forEach(track => track.stop())
                                preWarmedStreamRef.current = null
                                setPreWarmedStream(null)
                            }
                            utils.profile.invalidate()
                            utils.attendance.invalidate()
                        }}
                    />
                </DialogContent>
            </Dialog>
        </motion.div>
    )
}

