"use client"

import { MetricCard } from "@/components/dashboard/metric-card"
import { Calendar, LogIn, LogOut, UserCheck, Loader2 } from "lucide-react"
import { trpc } from "@/lib/trpc/client"
import { format } from "date-fns"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"

export function DailyAttendanceCard({ className }: { className?: string }) {
    const utils = trpc.useUtils()
    const { data: attendance, isLoading } = trpc.attendance.getAttendance.useQuery({
        startDate: format(new Date(), 'yyyy-MM-dd'),
        endDate: format(new Date(), 'yyyy-MM-dd')
    })

    const [currentTime, setCurrentTime] = useState(new Date())
    const clockInMutation = trpc.attendance.clockIn.useMutation({
        onSuccess: () => {
            toast.success("Clocked in successfully")
            utils.attendance.getAttendance.invalidate()
        }
    })
    const clockOutMutation = trpc.attendance.clockOut.useMutation({
        onSuccess: () => {
            toast.success("Clocked out successfully")
            utils.attendance.getAttendance.invalidate()
        }
    })

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000)
        return () => clearInterval(timer)
    }, [])

    const todayRecord = attendance?.[0]
    const isClockedIn = !!todayRecord?.check_in && !todayRecord?.check_out
    const isMarked = !!todayRecord?.check_in && !!todayRecord?.check_out

    const handleClockIn = async () => {
        try {
            await clockInMutation.mutateAsync()
        } catch (error: any) {
            toast.error(error.message || "Failed to clock in")
        }
    }

    const handleClockOut = async () => {
        try {
            await clockOutMutation.mutateAsync()
        } catch (error: any) {
            toast.error(error.message || "Failed to clock out")
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
                            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-green-600/60 mt-2">Attendance Complete</p>
                        </div>
                    ) : isClockedIn ? (
                        <button
                            onClick={handleClockOut}
                            disabled={clockOutMutation.isPending}
                            className="group relative flex items-center gap-4 px-10 py-5 rounded-2xl border border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100 hover:border-orange-300 transition-all duration-300 shadow-xl shadow-orange-500/10 active:scale-95 disabled:opacity-50"
                        >
                            <LogOut className="h-7 w-7 group-hover:rotate-12 transition-transform" />
                            <span className="text-2xl font-extrabold uppercase tracking-tight">Office - Out</span>
                            {clockOutMutation.isPending && <Loader2 className="h-5 w-5 animate-spin ml-2" />}
                        </button>
                    ) : (
                        <button
                            onClick={handleClockIn}
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
