"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { format } from "date-fns"
import Link from "next/link"
import { motion } from "framer-motion"
import { useState, useEffect } from "react"
import { trpc } from "@/lib/trpc/client"
import {
    IconClock,
    IconLogin,
    IconLogout,
    IconCheck,
    IconMapPin,
    IconAlertTriangle,
    IconArrowRight,
    IconHistory,
    IconCalendarEvent,
    IconSettings,
    IconQuestionMark,
    IconLoader2,
    IconMapPinOff,
    IconDownload,
    IconCamera
} from "@tabler/icons-react"
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
    { label: "Settings", icon: IconSettings, href: "/mobile/profile", color: "bg-slate-500/10 text-slate-600" },
    { label: "Help", icon: IconQuestionMark, href: "/mobile/help", color: "bg-amber-500/10 text-amber-600" },
]

export function MobileDashboard({ profile, todayAttendance }: MobileDashboardProps) {
    const { isPwa, isMobile, isReady } = usePwaCheck()
    const [geofenceResult, setGeofenceResult] = useState<{
        isAllowed: boolean
        nearestOffice?: { id: string; name: string; distance: number }
        withinOffice?: { id: string; name: string; distance: number }
    } | null>(null)
    const [isLocChecking, setIsLocChecking] = useState(true)

    const utils = trpc.useUtils()

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
                    try {
                        const result = await utils.officeLocations.checkGeofence.fetch({
                            latitude: pos.coords.latitude,
                            longitude: pos.coords.longitude
                        })
                        setGeofenceResult(result)
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
    }, [utils, isPwa, isReady, hasNoPhoto])

    const hasCheckedIn = !!todayAttendance?.check_in
    const hasCheckedOut = !!todayAttendance?.check_out
    const isComplete = hasCheckedIn && hasCheckedOut

    const getStatusColor = () => {
        if (isComplete) return 'from-emerald-500 to-teal-600'
        if (hasCheckedIn) return 'from-sky-500 to-blue-600'
        return 'from-purple-500 to-indigo-600'
    }

    const getStatusIcon = () => {
        if (isComplete) return IconCheck
        if (hasCheckedIn) return IconClock
        return IconAlertTriangle
    }

    const getStatusText = () => {
        if (isComplete) return 'Attendance Complete'
        if (hasCheckedIn) return 'Waiting for Clock Out'
        return 'Not Clocked In'
    }

    const StatusIcon = getStatusIcon()
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
                <div className={`relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br ${getStatusColor()} p-5 text-white shadow-2xl shadow-primary/10`}>
                    {/* Glass Decorations */}
                    <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full -mr-24 -mt-24 blur-2xl" />
                    <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full -ml-16 -mb-16 blur-xl" />

                    <div className="relative flex items-stretch justify-between gap-4">
                        <div className="flex flex-col justify-between py-1.5">
                            <div className="flex items-center gap-2">
                                <StatusIcon className="w-4 h-4 opacity-90" />
                                <span className="text-xs font-black uppercase tracking-[0.2em] opacity-90">Today's Attendance</span>
                            </div>

                            {/* Geofence/Location Status aligned with Date row */}
                            <div className="inline-flex items-center gap-2 px-3 py-1.5 mt-2 rounded-full bg-white/10 backdrop-blur-md border border-white/10 w-fit">
                                <div className={`w-1.5 h-1.5 rounded-full ${geofenceResult?.isAllowed ? 'bg-green-400' : 'bg-rose-400'} animate-pulse`} />
                                <span className="text-[11px] font-black uppercase tracking-wider text-white">
                                    {isLocChecking ? "Checking Location..." :
                                        geofenceResult?.isAllowed ? `${geofenceResult.withinOffice?.name}` :
                                            "Restricted"}
                                </span>
                            </div>
                        </div>

                        {/* Integrated Calendar UI - Month on Top for alignment */}
                        <div className="relative group shrink-0">
                            <motion.div
                                initial={{ scale: 0.9 }}
                                animate={{ scale: 1 }}
                                className="flex flex-col items-center bg-white rounded-2xl p-2 min-w-[70px] shadow-lg"
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
                            <div className="absolute -inset-1 bg-white/20 blur-md -z-10 rounded-2xl" />
                        </div>
                    </div>

                    {/* Integrated Action Row */}
                    <div className="mt-8 space-y-4">
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
                                <Link href="/mobile/profile">
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
                            /* IN/OUT Controls - Horizontal Layout */
                            <div className="grid grid-cols-2 gap-3">
                                {/* IN Icon */}
                                <Link
                                    href="/mobile/attendance?action=clock_in"
                                    className={`flex items-center gap-3 p-3.5 rounded-[1.5rem] bg-white/10 backdrop-blur-md border border-white/20 transition-all active:scale-95 group ${!geofenceResult?.isAllowed && !isLocChecking ? 'opacity-50 pointer-events-none' : ''}`}
                                >
                                    <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center shrink-0">
                                        <IconLogin className="w-5 h-5 text-emerald-500" />
                                    </div>
                                    <div className="flex flex-col">
                                        <p className="text-[9px] font-black uppercase tracking-widest text-emerald-100/70 leading-none mb-1.5">IN</p>
                                        <p className="text-xs font-black text-white leading-none">
                                            {todayAttendance?.check_in
                                                ? format(new Date(todayAttendance.check_in), 'hh:mm a')
                                                : '--:--'}
                                        </p>
                                    </div>
                                </Link>

                                {/* OUT Icon */}
                                <Link
                                    href="/mobile/attendance?action=clock_out"
                                    className={`flex items-center gap-3 p-3.5 rounded-[1.5rem] bg-white/10 backdrop-blur-md border border-white/20 transition-all active:scale-95 group 
                                    ${(!todayAttendance?.check_in || isLocChecking || !geofenceResult?.isAllowed || todayAttendance?.check_out) ? 'opacity-30 pointer-events-none grayscale' : ''}`}
                                >
                                    <div className="w-10 h-10 rounded-xl bg-orange-500/20 flex items-center justify-center shrink-0">
                                        <IconLogout className="w-5 h-5 text-orange-500" />
                                    </div>
                                    <div className="flex flex-col">
                                        <p className="text-[9px] font-black uppercase tracking-widest text-orange-100/70 leading-none mb-1.5">OUT</p>
                                        <p className="text-xs font-black text-white leading-none">
                                            {todayAttendance?.check_out
                                                ? format(new Date(todayAttendance.check_out), 'hh:mm a')
                                                : '--:--'}
                                        </p>
                                    </div>
                                </Link>
                            </div>
                        )}

                        {isPwa && !hasNoPhoto && !geofenceResult?.isAllowed && !isLocChecking && !isTodayHoliday && !isTodayOffDay && (
                            <p className="text-[9px] font-bold text-rose-100 text-center uppercase tracking-wider bg-rose-500/20 py-2 rounded-xl border border-white/10">
                                Outside Office Area
                            </p>
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
                <div className="grid grid-cols-2 gap-4">
                    {quickActions.map((action) => (
                        <Link key={action.label} href={action.href}>
                            <motion.div
                                whileTap={{ scale: 0.95 }}
                                className="bg-white dark:bg-slate-900/50 p-5 rounded-[2rem] flex flex-col gap-4 shadow-sm border border-slate-100 dark:border-slate-800/50 h-full relative overflow-hidden group"
                            >
                                <div className={`w-12 h-12 rounded-2xl ${action.color} flex items-center justify-center transition-transform group-hover:scale-110 duration-300`}>
                                    <action.icon className="w-7 h-7" />
                                </div>
                                <span className="font-bold text-sm tracking-tight">{action.label}</span>
                                <div className="absolute -right-2 -bottom-2 opacity-[0.03] dark:opacity-[0.05] group-hover:opacity-[0.08] transition-opacity">
                                    <action.icon size={80} stroke={2} />
                                </div>
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
