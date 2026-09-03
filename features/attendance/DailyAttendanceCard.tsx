"use client"

import { MetricCard } from "@/components/dashboard/metric-card"
import { Calendar, LogIn, LogOut, UserCheck, Loader2, Plus, Clock } from "lucide-react"
import { trpc } from "@/lib/trpc/client"
import { format } from "date-fns"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"
import { useProfile } from "@/lib/context/profile-context"
import { MobileAttendanceWizard } from "@/features/mobile/mobile-attendance-wizard"

export function DailyAttendanceCard({ className }: { className?: string }) {
    const { profile } = useProfile()
    const utils = trpc.useUtils()
    const todayStr = format(new Date(), 'yyyy-MM-dd')

    // Fetch last 2 days to catch stale sessions from yesterday
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayStr = format(yesterday, 'yyyy-MM-dd')

    const { data: attendance, isLoading } = trpc.attendance.getAttendance.useQuery({
        profileId: profile?.id,
        startDate: yesterdayStr,
        endDate: todayStr
    }, {
        enabled: !!profile?.id
    })

    const { data: settings } = trpc.attendance.getOfficeSettings.useQuery()
    const { data: closures } = trpc.attendance.getOfficeClosures.useQuery()

    const [currentTime, setCurrentTime] = useState(new Date())

    // Optimistic state to show immediate button transitions
    const [verificationAction, setVerificationAction] = useState<'clock_in' | 'clock_out' | null>(null)

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000)
        return () => clearInterval(timer)
    }, [])

    useEffect(() => {
        setVerificationAction(null)
    }, [todayStr])

    const normalizeDate = (d: unknown): string => {
        if (!d) return ''
        if (d instanceof Date) {
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
        }
        const str = String(d)
        return str.split('T')[0]
    }

    const todayRecord = attendance?.find(r => normalizeDate(r.date) === todayStr)
    const pendingRecord = attendance?.find(r => !r.check_out && normalizeDate(r.date) === todayStr)

    // Multi-session state determination
    const isClockedIn = !!pendingRecord
    const totalSessionsToday = todayRecord?.total_sessions || 0
    const workingHoursToday = todayRecord?.working_hours ? Number(todayRecord.working_hours).toFixed(1) : '0.0'

    const isTodayOffDay = settings?.off_days?.includes(new Date().getDay())
    const todayClosure = closures?.find(c => c.date === todayStr)
    const isTodayHoliday = !!todayClosure

    const handleClockIn = () => {
        setVerificationAction('clock_in')
    }

    const handleClockOut = () => {
        setVerificationAction('clock_out')
    }

    if (verificationAction && profile) {
        return (
            <MobileAttendanceWizard
                action={verificationAction}
                profileImageUrl={profile.avatar_url}
                profileName={profile.full_name}
                profileEmail={profile.email}
                onComplete={() => {
                    setVerificationAction(null)
                    utils.attendance.invalidate()
                }}
                onCancel={() => setVerificationAction(null)}
            />
        )
    }

    return (
        <MetricCard
            className={cn("shadow-xl", className)}
            gradientColor="from-green-500/10 to-transparent"
            delay={0.2}
            disableHover={true}
            borderColor="border-green-500/10"
            cardBgColor="bg-card/50"
        >
            <div className="flex flex-col gap-6">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-green-500/10 text-green-700 dark:text-green-400">
                            <Calendar className="h-5 w-5" />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold tracking-tight text-foreground">Daily Attendance</h3>
                            <p className="text-sm text-muted-foreground">{format(new Date(), "EEEE, MMMM do, yyyy")}</p>
                        </div>
                    </div>
                    <div className="text-right">
                        <p className="text-2xl font-bold tracking-tighter tabular-nums text-foreground">{format(currentTime, "hh:mm:ss a")}</p>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Current Time</p>
                    </div>
                </div>

                <div className="flex flex-col items-center justify-center p-6 bg-background/30 rounded-2xl border border-green-500/5 min-h-[140px] space-y-4">
                    {isLoading ? (
                        <div className="flex items-center gap-2 text-muted-foreground">
                            <Loader2 className="h-5 w-5 animate-spin" />
                            <span className="text-sm font-medium">Loading status...</span>
                        </div>
                    ) : isClockedIn ? (
                        <div className="flex flex-col items-center gap-3">
                            <button
                                onClick={handleClockOut}
                                disabled={verificationAction !== null}
                                className="group relative flex items-center gap-4 px-10 py-5 rounded-2xl border border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100 hover:border-orange-300 transition-all duration-300 shadow-xl shadow-orange-500/10 active:scale-95 disabled:opacity-50"
                            >
                                <LogOut className="h-7 w-7 group-hover:rotate-12 transition-transform" />
                                <span className="text-2xl font-extrabold uppercase tracking-tight">Office - Out</span>
                            </button>
                            <div className="flex items-center gap-2">
                                <Badge variant="outline" className="border-orange-300 text-orange-700 font-semibold text-xs">
                                    Active Session #{totalSessionsToday || 1}
                                </Badge>
                                <Badge variant="outline" className="border-slate-300 text-slate-600 text-xs">
                                    Total Today: {workingHoursToday} hrs
                                </Badge>
                            </div>
                        </div>
                    ) : isTodayHoliday ? (
                        <div className="flex flex-col items-center gap-2 text-center">
                            <div className="px-10 py-4 rounded-2xl bg-amber-500/10 border-2 border-dashed border-amber-500/30 text-amber-600 text-3xl font-black uppercase tracking-widest">
                                Holiday
                            </div>
                            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-600/60 mt-2">
                                Office is closed for {todayClosure?.reason}
                            </p>
                        </div>
                    ) : isTodayOffDay ? (
                        <div className="flex flex-col items-center gap-2 text-center">
                            <div className="px-10 py-4 rounded-2xl bg-muted/50 border-2 border-dashed border-muted-foreground/20 text-muted-foreground/60 text-3xl font-black uppercase tracking-widest">
                                Week off Day
                            </div>
                            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/40 mt-1">Weekly scheduled off day</p>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center gap-3">
                            <button
                                onClick={handleClockIn}
                                disabled={verificationAction !== null}
                                className="group relative flex items-center gap-4 px-10 py-5 rounded-2xl border border-green-200 bg-green-50 text-green-700 hover:bg-green-100 hover:border-green-300 transition-all duration-300 shadow-xl shadow-green-500/10 active:scale-95 disabled:opacity-50"
                            >
                                <LogIn className="h-7 w-7 group-hover:-rotate-12 transition-transform" />
                                <span className="text-2xl font-extrabold uppercase tracking-tight">
                                    {totalSessionsToday > 0 ? `Session #${totalSessionsToday + 1} - In` : 'Office - In'}
                                </span>
                            </button>

                            {totalSessionsToday > 0 && (
                                <div className="flex items-center gap-2">
                                    <Badge variant="outline" className="border-emerald-300 text-emerald-700 font-semibold text-xs">
                                        {totalSessionsToday} Sessions Completed
                                    </Badge>
                                    <Badge variant="outline" className="border-slate-300 text-slate-600 text-xs">
                                        Total Hours: {workingHoursToday} hrs
                                    </Badge>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </MetricCard>
    )
}

