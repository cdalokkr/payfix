"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AsyncButton } from "@/components/ui/async-button"
import { trpc } from "@/lib/trpc/client"
import { Play, Square, Clock } from "lucide-react"
import { toast } from "sonner"
import { format } from "date-fns"

export function AttendanceControl() {
    const [currentTime, setCurrentTime] = useState(new Date())
    const utils = trpc.useUtils()

    const { data: attendance, isLoading } = trpc.attendance.getAttendance.useQuery({
        startDate: format(new Date(), 'yyyy-MM-dd'),
        endDate: format(new Date(), 'yyyy-MM-dd')
    })

    const todayRecord = attendance?.[0]

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000)
        return () => clearInterval(timer)
    }, [])

    const clockInMutation = trpc.attendance.clockIn.useMutation({
        onSuccess: () => {
            toast.success("Clocked in successfully")
            utils.attendance.getAttendance.invalidate()
        },
        onError: (error) => {
            toast.error(error.message)
        }
    })

    const clockOutMutation = trpc.attendance.clockOut.useMutation({
        onSuccess: () => {
            toast.success("Clocked out successfully")
            utils.attendance.getAttendance.invalidate()
        },
        onError: (error) => {
            toast.error(error.message)
        }
    })

    const isClockedIn = !!todayRecord?.check_in && !todayRecord?.check_out

    return (
        <Card className="border-none shadow-md bg-card/50 backdrop-blur-sm overflow-hidden">
            <CardHeader className="bg-primary/5 border-b pb-6">
                <div className="flex justify-between items-center">
                    <div>
                        <CardTitle className="text-xl font-bold">Daily Attendance</CardTitle>
                        <CardDescription>{format(currentTime, 'EEEE, MMMM do yyyy')}</CardDescription>
                    </div>
                    <div className="text-3xl font-mono font-black text-primary drop-shadow-sm">
                        {format(currentTime, 'HH:mm:ss')}
                    </div>
                </div>
            </CardHeader>
            <CardContent className="pt-6">
                <div className="flex flex-col gap-6">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 rounded-xl bg-background/50 border border-muted-foreground/10 group hover:border-primary/20 transition-colors">
                            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2 mb-2">
                                <Clock className="size-3 text-primary" /> Office In
                            </div>
                            <div className="text-2xl font-bold">
                                {todayRecord?.check_in ? format(new Date(todayRecord.check_in), 'hh:mm a') : '--:--'}
                            </div>
                        </div>
                        <div className="p-4 rounded-xl bg-background/50 border border-muted-foreground/10 group hover:border-primary/20 transition-colors">
                            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2 mb-2">
                                <Clock className="size-3 text-primary" /> Office Out
                            </div>
                            <div className="text-2xl font-bold">
                                {todayRecord?.check_out ? format(new Date(todayRecord.check_out), 'hh:mm a') : '--:--'}
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-4">
                        <AsyncButton
                            className="flex-1 h-14 text-lg font-bold shadow-lg shadow-primary/10 transition-all hover:scale-[1.02]"
                            variant={isClockedIn || todayRecord?.check_in ? "outline" : "default"}
                            disabled={!!todayRecord?.check_in}
                            state={clockInMutation.isPending ? 'loading' : 'idle'}
                            onClick={() => clockInMutation.mutate()}
                        >
                            <Play className="mr-2 size-5 fill-current" /> Clock In
                        </AsyncButton>

                        <AsyncButton
                            className="flex-1 h-14 text-lg font-bold shadow-lg shadow-rose-500/10 transition-all hover:scale-[1.02]"
                            variant={!isClockedIn ? "outline" : "danger"}
                            disabled={!isClockedIn}
                            state={clockOutMutation.isPending ? 'loading' : 'idle'}
                            onClick={() => clockOutMutation.mutate()}
                        >
                            <Square className="mr-2 size-5 fill-current" /> Clock Out
                        </AsyncButton>
                    </div>

                    {todayRecord?.working_hours && (
                        <div className="text-center py-2 px-4 rounded-full bg-muted/30 text-xs font-bold uppercase tracking-tighter text-muted-foreground">
                            Total Working Hours Today: <span className="text-primary">{todayRecord.working_hours.toFixed(2)}h</span>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    )
}
