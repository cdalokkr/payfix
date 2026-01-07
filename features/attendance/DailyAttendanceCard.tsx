"use client"

import { MetricCard } from "@/components/dashboard/metric-card"
import { Calendar, LogIn, LogOut, UserCheck, Loader2, Plus } from "lucide-react"
import { trpc } from "@/lib/trpc/client"
import { format } from "date-fns"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"

export function DailyAttendanceCard({ className }: { className?: string }) {
    const utils = trpc.useUtils()
    const todayStr = format(new Date(), 'yyyy-MM-dd')

    // Fetch last 2 days to catch stale sessions from yesterday
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayStr = format(yesterday, 'yyyy-MM-dd')

    const { data: attendance, isLoading } = trpc.attendance.getAttendance.useQuery({
        startDate: yesterdayStr,
        endDate: todayStr
    })

    const { data: settings } = trpc.attendance.getOfficeSettings.useQuery()
    const { data: closures } = trpc.attendance.getOfficeClosures.useQuery()

    const [currentTime, setCurrentTime] = useState(new Date())

    // Optimistic state to show immediate button transitions
    const [optimisticState, setOptimisticState] = useState<'idle' | 'clocked-in' | 'marked'>('idle')

    const clockInMutation = trpc.attendance.clockIn.useMutation({
        onMutate: () => {
            setOptimisticState('clocked-in')
        },
        onSuccess: () => {
            toast.success("Clocked in successfully")
            utils.attendance.invalidate()
        },
        onError: (error) => {
            setOptimisticState('idle')
            toast.error(error.message)
        }
    })
    const clockOutMutation = trpc.attendance.clockOut.useMutation({
        onMutate: () => {
            setOptimisticState('marked')
        },
        onSuccess: () => {
            toast.success("Clocked out successfully")
            utils.attendance.invalidate()
        },
        onError: (error) => {
            setOptimisticState('clocked-in')
            toast.error(error.message)
        }
    })

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000)
        return () => clearInterval(timer)
    }, [])

    // Reset optimistic state on component mount (fresh page load)
    useEffect(() => {
        setOptimisticState('idle')
    }, [])

    // Reset optimistic state when attendance data updates, unless a mutation is in progress
    useEffect(() => {
        if (attendance) {
            if (!clockInMutation.isPending && !clockOutMutation.isPending) {
                setOptimisticState('idle')
            }
        }
    }, [attendance, clockInMutation.isPending, clockOutMutation.isPending])

    // Helper to normalize date to YYYY-MM-DD string format
    const normalizeDate = (d: unknown): string => {
        if (!d) return ''
        if (d instanceof Date) {
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
        }
        // If it's already a string, ensure it's in YYYY-MM-DD format (handle potential ISO strings)
        const str = String(d)
        return str.split('T')[0] // Handle ISO format like "2026-01-07T00:00:00.000Z"
    }

    // Find today's record using normalized date comparison
    const todayRecord = attendance?.find(r => normalizeDate(r.date) === todayStr)
    // Find the most recent pending record (could be today or yesterday)
    const pendingRecord = attendance?.filter(r => !r.check_out).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0]

    // Determine button state with optimistic updates taking priority
    const isClockedIn = optimisticState === 'clocked-in' || (optimisticState === 'idle' && !!pendingRecord)
    const isMarked = optimisticState === 'marked' || (optimisticState === 'idle' && !!todayRecord?.check_in && !!todayRecord?.check_out)
    const isTodayOffDay = settings?.off_days?.includes(new Date().getDay())
    const todayClosure = closures?.find(c => c.date === todayStr)
    const isTodayHoliday = !!todayClosure

    const handleClockIn = async (isExtra: boolean = false) => {
        try {
            await clockInMutation.mutateAsync({ localDate: todayStr, isExtraDay: isExtra })
        } catch (error: any) {
            // Already handled in onError
        }
    }

    const handleClockOut = async () => {
        try {
            await clockOutMutation.mutateAsync({ localDate: todayStr })
        } catch (error: any) {
            // Already handled in onError
        }
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

                <div className="flex items-center justify-center p-8 bg-background/30 rounded-2xl border border-green-500/5 min-h-[140px]">
                    {isLoading ? (
                        <div className="flex items-center gap-2 text-muted-foreground">
                            <Loader2 className="h-5 w-5 animate-spin" />
                            <span className="text-sm font-medium">Loading status...</span>
                        </div>
                    ) : isMarked ? (
                        <div className="flex flex-col items-center gap-2 animate-in fade-in zoom-in duration-500">
                            <Badge variant="secondary" className="px-8 py-3 text-xl font-black bg-green-500/10 text-green-700 border-green-500/20 shadow-sm">
                                <UserCheck className="mr-3 h-6 w-6" /> Marked
                            </Badge>
                            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-green-600/60 mt-2">
                                {todayRecord?.is_extra_day ? "Extra Work Day Complete" : "Attendance Complete"}
                            </p>
                        </div>
                    ) : isClockedIn ? (
                        <div className="flex flex-col items-center gap-4">
                            <button
                                onClick={handleClockOut}
                                disabled={clockOutMutation.isPending}
                                className="group relative flex items-center gap-4 px-10 py-5 rounded-2xl border border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100 hover:border-orange-300 transition-all duration-300 shadow-xl shadow-orange-500/10 active:scale-95 disabled:opacity-50"
                            >
                                <LogOut className="h-7 w-7 group-hover:rotate-12 transition-transform" />
                                <span className="text-2xl font-extrabold uppercase tracking-tight">Office - Out</span>
                                {clockOutMutation.isPending && <Loader2 className="h-5 w-5 animate-spin ml-2" />}
                            </button>
                            {pendingRecord?.is_extra_day && (
                                <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-widest text-orange-600 border-orange-200 bg-orange-50/50">Extra Work Session</Badge>
                            )}
                        </div>
                    ) : isTodayHoliday ? (
                        <div className="flex flex-col items-center gap-2 animate-in fade-in slide-in-from-bottom-4 duration-700 text-center">
                            <div className="px-10 py-4 rounded-2xl bg-amber-500/10 border-2 border-dashed border-amber-500/30 text-amber-600 text-3xl font-black uppercase tracking-widest">
                                Holiday
                            </div>
                            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-600/60 mt-2">
                                Office is closed for {todayClosure.reason}
                            </p>
                        </div>
                    ) : isTodayOffDay ? (
                        <div className="flex flex-col items-center gap-2 animate-in fade-in slide-in-from-bottom-4 duration-700 text-center">
                            <div className="px-10 py-4 rounded-2xl bg-muted/50 border-2 border-dashed border-muted-foreground/20 text-muted-foreground/60 text-3xl font-black uppercase tracking-widest">
                                Week off Day
                            </div>
                            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/40 mt-1">Weekly scheduled off day</p>
                        </div>
                    ) : (
                        <button
                            onClick={() => handleClockIn(false)}
                            disabled={clockInMutation.isPending}
                            className="group relative flex items-center gap-4 px-10 py-5 rounded-2xl border border-green-200 bg-green-50 text-green-700 hover:bg-green-100 hover:border-green-300 transition-all duration-300 shadow-xl shadow-green-500/10 active:scale-95 disabled:opacity-50"
                        >
                            <LogIn className="h-7 w-7 group-hover:-rotate-12 transition-transform" />
                            <span className="text-2xl font-extrabold uppercase tracking-tight">Office - In</span>
                            {clockInMutation.isPending && <Loader2 className="h-5 w-5 animate-spin ml-2" />}
                        </button>
                    )}
                </div>
            </div>
        </MetricCard>
    )
}
