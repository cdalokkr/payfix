"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { format } from "date-fns"
import Link from "next/link"
import { motion } from "framer-motion"
import {
    IconClock,
    IconLogin,
    IconLogout,
    IconCheck,
    IconMapPin,
    IconCalendar,
    IconAlertTriangle,
    IconArrowRight,
    IconHistory,
    IconCalendarEvent,
    IconSettings,
    IconQuestionMark,
} from "@tabler/icons-react"

interface MobileDashboardProps {
    profile: {
        id: string
        full_name: string | null
        avatar_url: string | null
        email: string
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
    const hasCheckedIn = !!todayAttendance?.check_in
    const hasCheckedOut = !!todayAttendance?.check_out
    const isComplete = hasCheckedIn && hasCheckedOut

    const getStatusColor = () => {
        if (isComplete) return 'from-emerald-500 to-teal-600'
        if (hasCheckedIn) return 'from-sky-500 to-blue-600'
        return 'from-orange-500 to-rose-600'
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
            {/* Today's Status Card - Reimagined */}
            <motion.div variants={itemVars} whileTap={{ scale: 0.98 }}>
                <div className={`relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br ${getStatusColor()} p-5 text-white shadow-2xl shadow-primary/10`}>
                    {/* Glass Decorations */}
                    <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full -mr-24 -mt-24 blur-2xl" />
                    <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full -ml-16 -mb-16 blur-xl" />

                    <div className="relative flex items-center justify-between">
                        <div className="space-y-1">
                            <div className="flex items-center gap-2 mb-1 px-3 py-1 bg-white/10 w-fit rounded-full backdrop-blur-md">
                                <StatusIcon className="w-3.5 h-3.5" />
                                <span className="text-[11px] font-bold uppercase tracking-wider opacity-90">Today's Status</span>
                            </div>
                            <h2 className="text-2xl font-black tracking-tight leading-tight">
                                {getStatusText()}
                            </h2>
                        </div>

                        {/* Integrated Calendar UI */}
                        <div className="relative group">
                            <motion.div
                                initial={{ scale: 0.9 }}
                                animate={{ scale: 1 }}
                                className="flex flex-col items-center bg-white rounded-2xl p-2 min-w-[80px] shadow-lg transition-transform duration-300"
                            >
                                <span className="text-[10px] font-black text-rose-500 uppercase tracking-widest border-b border-rose-100 w-full text-center pb-1 mb-1">
                                    {format(now, 'EEE').toUpperCase()}
                                </span>
                                <div className="flex items-baseline gap-1">
                                    <span className="text-2xl font-black text-slate-800 leading-none">
                                        {format(now, 'dd')}
                                    </span>
                                    <span className="text-xs font-black text-slate-600 uppercase">
                                        {format(now, 'MMM').toUpperCase()}
                                    </span>
                                </div>
                                <span className="text-[10px] font-bold text-slate-400 mt-0.5 tracking-wider">
                                    {format(now, 'yyyy')}
                                </span>
                            </motion.div>
                            <div className="absolute -inset-1 bg-white/20 blur-md -z-10 rounded-2xl" />
                        </div>
                    </div>

                    {/* Time Details */}
                    {(hasCheckedIn || hasCheckedOut) && (
                        <div className="relative mt-6 grid grid-cols-2 gap-4 bg-white/10 rounded-[2rem] p-3.5 backdrop-blur-md border border-white/10">
                            <div className="flex flex-col items-center text-center space-y-1">
                                <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center mb-1">
                                    <IconLogin className="w-4 h-4 text-white" />
                                </div>
                                <p className="text-[8px] uppercase tracking-widest font-black opacity-70">Clock In</p>
                                <p className="text-base font-black leading-none">
                                    {todayAttendance?.check_in
                                        ? format(new Date(todayAttendance.check_in), 'hh:mm')
                                        : '--:--'
                                    }
                                    <span className="text-[9px] ml-0.5 opacity-80 uppercase font-bold">
                                        {todayAttendance?.check_in ? format(new Date(todayAttendance.check_in), 'a') : ''}
                                    </span>
                                </p>
                            </div>
                            <div className="flex flex-col items-center text-center space-y-1">
                                <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center mb-1">
                                    <IconLogout className="w-4 h-4 text-white" />
                                </div>
                                <p className="text-[8px] uppercase tracking-widest font-black opacity-70">Clock Out</p>
                                <p className="text-base font-black leading-none">
                                    {todayAttendance?.check_out
                                        ? format(new Date(todayAttendance.check_out), 'hh:mm')
                                        : '--:--'
                                    }
                                    <span className="text-[9px] ml-0.5 opacity-80 uppercase font-bold">
                                        {todayAttendance?.check_out ? format(new Date(todayAttendance.check_out), 'a') : ''}
                                    </span>
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Integrated Action Button */}
                    {!isComplete && (
                        <div className="mt-6 flex justify-center">
                            <Link href="/mobile/attendance">
                                <Button
                                    className="h-12 px-8 rounded-full bg-white text-slate-900 hover:bg-white/90 font-black text-sm shadow-xl border-none group transition-all"
                                >
                                    {hasCheckedIn ? (
                                        <>
                                            <IconLogout className="w-4 h-4 mr-2 stroke-[3]" />
                                            <span>Clock Out Now</span>
                                        </>
                                    ) : (
                                        <>
                                            <IconLogin className="w-4 h-4 mr-2 stroke-[3]" />
                                            <span>Clock In Now</span>
                                        </>
                                    )}
                                    <IconArrowRight className="w-3.5 h-3.5 ml-4 opacity-50 group-hover:translate-x-1 transition-transform" />
                                </Button>
                            </Link>
                        </div>
                    )}
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

            {/* Location Badge */}
            <motion.div variants={itemVars} className="flex items-center justify-center pt-2">
                <div className="inline-flex items-center gap-2.5 px-5 py-2.5 rounded-full bg-slate-100/80 dark:bg-slate-900/80 backdrop-blur-sm border border-slate-200/50 dark:border-slate-800/50 shadow-sm">
                    <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                    <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 opacity-80 uppercase tracking-[0.15em]">Secure Location Enabled</span>
                </div>
            </motion.div>

        </motion.div>
    )
}
