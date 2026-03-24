"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { format } from "date-fns"
import Link from "next/link"
import { motion } from "framer-motion"
import { useState, useEffect } from "react"
import { trpc } from "@/lib/trpc/client"
import {
    Clock as IconClock,
    LogIn as IconLogin,
    LogOut as IconLogout,
    Check as IconCheck,
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
    Receipt
} from "lucide-react"
import { usePwaCheck } from "@/hooks/use-pwa-check"
import { isDefaultAvatar } from "@/lib/utils/avatar-helper"

interface MobileDashboardProps {
    profile: {
        id: string
        full_name: string | null
        avatar_url: string | null
        email: string
        sex: string | null
        avatar_status: string | null
    }
    todayAttendance: {
        id: string
        check_in: string | null
        check_out: string | null
        status: string
    } | null
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
    { label: "History", icon: IconHistory, href: "/mobile/history", color: "bg-blue-500/10 text-blue-600" },
    { label: "Leaves", icon: IconCalendarEvent, href: "/mobile/leaves", color: "bg-purple-500/10 text-purple-600" },
    { label: "Advances", icon: IndianRupee, href: "/mobile/advances", color: "bg-emerald-500/10 text-emerald-600" },
    { label: "PaySlip", icon: Receipt, href: "/mobile/payslip", color: "bg-orange-500/10 text-orange-600" },
    { label: "Settings", icon: IconSettings, href: "/mobile/profile", color: "bg-slate-500/10 text-slate-600" },
    { label: "Help", icon: IconQuestionMark, href: "/mobile/help", color: "bg-amber-500/10 text-amber-600" },
]

export function MobileDashboard({ profile, todayAttendance: initialAttendance }: MobileDashboardProps) {
    const { isPwa, isMobile, isReady } = usePwaCheck()

    // Initialize from sessionStorage if available (persists across navigation)
    const [geofenceResult, setGeofenceResult] = useState<{
        isAllowed: boolean
        nearestOffice?: { id: string; name: string; distance: number }
        withinOffice?: { id: string; name: string; distance: number }
    } | null>(() => {
        if (typeof window !== 'undefined') {
            const cached = sessionStorage.getItem('mobileGeofenceResult')
            return cached ? JSON.parse(cached) : null
        }
        return null
    })

    const [isLocChecking, setIsLocChecking] = useState(() => {
        // If we have cached geofence result, don't show loading
        if (typeof window !== 'undefined') {
            return !sessionStorage.getItem('mobileGeofenceResult')
        }
        return true
    })

    const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(() => {
        if (typeof window !== 'undefined') {
            const cached = sessionStorage.getItem('mobileUserCoords')
            return cached ? JSON.parse(cached) : null
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
        enabled: isReady && isPwa
    })
    const { data: closures } = trpc.attendance.getOfficeClosures.useQuery(undefined, {
        enabled: isReady && isPwa
    })

    const todayStr = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Kolkata' })
    const isTodayOffDay = settings?.off_days?.includes(new Date().getDay())
    const todayClosure = closures?.find((c: any) => c.date === todayStr)
    const isTodayHoliday = !!todayClosure

    const hasNoPhoto = profile.avatar_status !== 'custom' && (!profile.avatar_url || isDefaultAvatar(profile.avatar_url))

    useEffect(() => {
        const fetchLocation = async () => {
            // Skip if already have cached location from sessionStorage
            if (geofenceResult) {
                setIsLocChecking(false)
                return
            }

            // Only fetch if PWA and Profile photo is updated
            if (!isPwa || hasNoPhoto) {
                setIsLocChecking(false)
                return
            }

            setIsLocChecking(true)
            if (!navigator.geolocation) {
                setIsLocChecking(false)
                return
            }

            navigator.geolocation.getCurrentPosition(
                async (pos) => {
                    // Store user coordinates
                    const coords = {
                        lat: pos.coords.latitude,
                        lng: pos.coords.longitude
                    }
                    setUserCoords(coords)
                    sessionStorage.setItem('mobileUserCoords', JSON.stringify(coords))

                    try {
                        const result = await utils.officeLocations.checkGeofence.fetch({
                            latitude: pos.coords.latitude,
                            longitude: pos.coords.longitude
                        })
                        setGeofenceResult(result)
                        // Cache in sessionStorage for navigation persistence
                        sessionStorage.setItem('mobileGeofenceResult', JSON.stringify(result))
                    } catch (err) {
                        console.error('Geofence check failed:', err)
                    } finally {
                        setIsLocChecking(false)
                    }
                },
                () => setIsLocChecking(false),
                { enableHighAccuracy: true, timeout: 10000 }
            )
        }

        if (isReady) {
            fetchLocation()
        }
    }, [utils, isPwa, isReady, hasNoPhoto, geofenceResult])

    const hasCheckedIn = !!todayAttendance?.check_in
    const hasCheckedOut = !!todayAttendance?.check_out
    const isComplete = hasCheckedIn && hasCheckedOut

    const getStatusColor = () => {
        if (isComplete) return 'from-emerald-500 to-teal-600'
        if (hasCheckedIn) return 'from-sky-500 to-blue-600'
        return 'from-purple-500 to-indigo-600'
    }

    // Get icon color based on status
    const getHeadingIconColor = () => {
        if (isComplete) return 'text-emerald-200'
        if (hasCheckedIn) return 'text-sky-200'
        return 'text-purple-200'
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
            <motion.div variants={itemVars} whileTap={{ scale: 0.98 }}>
                <div className={`relative overflow-hidden rounded-[1rem] bg-gradient-to-br ${getStatusColor()} p-4 text-white shadow-2xl shadow-primary/20 min-h-[290px] flex flex-col justify-between`}>
                    {/* Glass Decorations */}
                    <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full -mr-24 -mt-24 blur-2xl" />
                    <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full -ml-16 -mb-16 blur-xl" />

                    <div className="relative flex items-start justify-between gap-4">
                        <div className="flex flex-col gap-2 py-1.5">
                            {/* Today's Attendance Heading with CalendarClock icon */}
                            <div className="flex items-center gap-2">
                                <CalendarClock className={`w-4 h-4 ${getHeadingIconColor()}`} />
                                <span className="text-xs font-black uppercase tracking-[0.2em] opacity-90">Today's Attendance</span>
                            </div>

                            {/* GPS Coordinates - Below heading (only when not loading and has coords) */}
                            {!isLocChecking && userCoords && (
                                <motion.div
                                    initial={{ opacity: 0, y: -5 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="flex items-center gap-1.5 mt-1"
                                >
                                    {geofenceResult?.isAllowed ? (
                                        <MapPinCheck className="w-3.5 h-3.5 text-emerald-300" />
                                    ) : (
                                        <MapPinX className="w-3.5 h-3.5 text-orange-300" />
                                    )}
                                    <span className="text-xs font-bold text-white/60 tracking-tight">
                                        {userCoords.lat.toFixed(6)}, {userCoords.lng.toFixed(6)}
                                    </span>
                                </motion.div>
                            )}
                        </div>

                        {/* Integrated Calendar UI */}
                        <div className="relative group shrink-0">
                            <motion.div
                                initial={{ scale: 0.9 }}
                                animate={{ scale: 1 }}
                                className="flex flex-col items-center bg-white rounded-xl p-2 min-w-[70px] shadow-lg"
                            >
                                <span className="text-[10px] font-black text-rose-500 uppercase tracking-widest border-b border-rose-100 w-full text-center pb-0.5 mb-1">
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

                    {/* Integrated Action Row */}
                    <div className="mt-2 space-y-4">
                        {!isReady ? (
                            <div className="flex items-center justify-center p-8">
                                <IconLoader2 className="w-8 h-8 animate-spin opacity-20" />
                            </div>
                        ) : !isPwa ? (
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
                                <Link href="/mobile/update-photo">
                                    <Button className="w-full rounded-xl bg-white text-rose-600 font-bold hover:bg-white/90">
                                        Update Now
                                    </Button>
                                </Link>
                            </div>
                        ) : isTodayHoliday ? (
                            <div className="p-6 rounded-[2rem] bg-amber-500/20 backdrop-blur-md border border-amber-500/30 text-center">
                                <IconCalendarEvent className="w-10 h-10 mx-auto mb-3 text-amber-100" />
                                <h4 className="text-sm font-black uppercase tracking-widest mb-1 text-amber-50">Holiday</h4>
                                <p className="text-[11px] font-medium text-amber-100/80">{todayClosure?.reason || 'Office Closed'}</p>
                            </div>
                        ) : isTodayOffDay ? (
                            <div className="p-6 rounded-[2rem] bg-indigo-500/20 backdrop-blur-md border border-indigo-500/30 text-center">
                                <IconCalendarEvent className="w-10 h-10 mx-auto mb-3 text-indigo-100" />
                                <h4 className="text-sm font-black uppercase tracking-widest mb-1 text-indigo-50">Weekly Off</h4>
                                <p className="text-[11px] font-medium text-indigo-100/80">Scheduled Weekly Off</p>
                            </div>
                        ) : (
                            <div className="w-full space-y-3">
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
                                        initial={{ opacity: 0, scale: 0.9 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        transition={{ duration: 0.3, ease: "easeOut" }}
                                        className="space-y-3"
                                    >
                                        {/* Office Name Badge */}
                                        <div className={`flex items-center gap-2 px-3 py-2 rounded-xl backdrop-blur-md border transition-all
                                            ${geofenceResult?.isAllowed
                                                ? 'bg-emerald-500/20 border-emerald-400/30'
                                                : 'bg-gradient-to-r from-orange-500/30 to-rose-500/30 border-orange-400/40'}`}>
                                            {geofenceResult?.isAllowed && geofenceResult.withinOffice ? (
                                                <>
                                                    <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 bg-emerald-400/30">
                                                        <MapPinHouse className="w-4 h-4 text-emerald-200" />
                                                    </div>
                                                    <span className="text-[10px] font-black uppercase tracking-wider text-emerald-100 bg-emerald-500/40 px-3 py-1 rounded-lg">
                                                        {geofenceResult.withinOffice.name}
                                                    </span>
                                                </>
                                            ) : (
                                                <>
                                                    <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 bg-orange-400/30">
                                                        <MapPinOff className="w-4 h-4 text-orange-200" />
                                                    </div>
                                                    <span className="text-[10px] font-black uppercase tracking-wider text-orange-100">
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
                                                <div className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl bg-white/10 border border-white/15 backdrop-blur-sm">
                                                    <div className="flex items-center gap-2">
                                                        <div className={`w-6 h-6 rounded-lg flex items-center justify-center
                                                            ${hasCheckedIn ? 'bg-emerald-400/40' : 'bg-white/20'}`}>
                                                            <ClockArrowDown className={`w-3.5 h-3.5 ${hasCheckedIn ? 'text-emerald-200' : 'text-white/50'}`} />
                                                        </div>
                                                        <span className="text-[10px] font-black uppercase tracking-wider text-white/60">IN:</span>
                                                        <span className={`text-sm font-black ${hasCheckedIn ? 'text-white' : 'text-white/40'}`}>
                                                            {todayAttendance?.check_in
                                                                ? format(new Date(todayAttendance.check_in), 'hh:mm a')
                                                                : '--:-- --'}
                                                        </span>
                                                    </div>
                                                    <div className="w-px h-6 bg-white/20" />
                                                    <div className="flex items-center gap-2">
                                                        <div className={`w-6 h-6 rounded-lg flex items-center justify-center
                                                            ${hasCheckedOut ? 'bg-orange-400/40' : 'bg-white/20'}`}>
                                                            <ClockArrowUp className={`w-3.5 h-3.5 ${hasCheckedOut ? 'text-orange-200' : 'text-white/50'}`} />
                                                        </div>
                                                        <span className="text-[10px] font-black uppercase tracking-wider text-white/60">OUT:</span>
                                                        <span className={`text-sm font-black ${hasCheckedOut ? 'text-white' : 'text-white/40'}`}>
                                                            {todayAttendance?.check_out
                                                                ? format(new Date(todayAttendance.check_out), 'hh:mm a')
                                                                : '--:-- --'}
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Single Dynamic Clock Button */}
                                                {!isComplete && (
                                                    <Link
                                                        href={`/mobile/attendance?action=${hasCheckedIn ? 'clock_out' : 'clock_in'}`}
                                                        className={`flex items-center justify-center gap-3 w-full px-4 py-3 rounded-2xl border transition-all active:scale-95 shadow-lg
                                                            ${hasCheckedIn
                                                                ? 'bg-gradient-to-r from-orange-500/40 to-rose-500/40 border-orange-400/40 hover:from-orange-500/50 hover:to-rose-500/50'
                                                                : 'bg-gradient-to-r from-emerald-500/40 to-teal-500/40 border-emerald-400/40 hover:from-emerald-500/50 hover:to-teal-500/50'}`}
                                                    >
                                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-lg
                                                            ${hasCheckedIn
                                                                ? 'bg-orange-500 shadow-orange-600/30'
                                                                : 'bg-emerald-500 shadow-emerald-600/30'}`}>
                                                            {hasCheckedIn
                                                                ? <ClockArrowUp className="w-5 h-5 text-white" />
                                                                : <ClockArrowDown className="w-5 h-5 text-white" />}
                                                        </div>
                                                        <span className="text-sm font-black uppercase tracking-widest text-white">
                                                            {hasCheckedIn ? 'Mark Office Out' : 'Mark Office In'}
                                                        </span>
                                                        <IconArrowRight className="w-5 h-5 text-white/60 ml-auto" />
                                                    </Link>
                                                )}

                                                {/* Attendance Complete Badge */}
                                                {isComplete && (
                                                    <div className="flex items-center justify-center gap-3 px-4 py-3 rounded-xl bg-emerald-500/20 border border-emerald-400/30">
                                                        <div className="w-8 h-8 rounded-xl bg-emerald-500/40 flex items-center justify-center">
                                                            <CircleCheckBig className="w-5 h-5 text-emerald-200" />
                                                        </div>
                                                        <span className="text-sm font-black uppercase tracking-widest text-emerald-100">
                                                            Attendance Marked
                                                        </span>
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </motion.div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </motion.div>

            {/* Quick Actions Grid */}
            <motion.div variants={itemVars} className="space-y-4 pt-2">
                <div className="flex items-center justify-between px-2">
                    <h3 className="text-[11px] font-black text-muted-foreground uppercase tracking-[0.2em]">Quick Access</h3>
                    <div className="h-px bg-slate-200 dark:bg-slate-800 flex-1 ml-4" />
                </div>
                <div className="flex overflow-x-auto gap-4 px-2 pb-4 pt-1 snap-x snap-mandatory hide-scrollbar">
                    {quickActions.map((action) => (
                        <Link key={action.label} href={action.href} className="snap-start shrink-0">
                            <motion.div
                                whileTap={{ scale: 0.95 }}
                                className="bg-white dark:bg-slate-900/80 p-4 rounded-3xl flex flex-col gap-3 shadow-[0_2px_10px_rgba(0,0,0,0.03)] border border-slate-100 dark:border-slate-800/50 w-[110px] relative overflow-hidden group items-center text-center backdrop-blur-sm"
                            >
                                <div className={`w-12 h-12 rounded-[1.1rem] ${action.color} flex items-center justify-center transition-transform group-hover:scale-110 duration-300`}>
                                    <action.icon className="w-6 h-6" />
                                </div>
                                <span className="font-bold text-[11px] tracking-tight">{action.label}</span>
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
                                    <Link href="/mobile/profile">
                                        <Button size="sm" variant="outline" className="h-9 px-4 rounded-xl text-[11px] font-black border-amber-200 dark:border-amber-800/50 hover:bg-amber-500 hover:text-white transition-all uppercase tracking-wider">
                                            Setup Now
                                        </Button>
                                    </Link>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>
            )}
        </motion.div>
    )
}
