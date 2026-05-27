"use client"

import { useState, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
    format,
    startOfMonth,
    endOfMonth,
    startOfWeek,
    endOfWeek,
    eachDayOfInterval,
    isSameMonth,
    isSameDay,
    isAfter,
    isBefore,
    addMonths,
    subMonths,
    parseISO
} from "date-fns"
import { trpc } from "@/lib/trpc/client"
import { useRouter } from "next/navigation"
import {
    ChevronLeft,
    ChevronRight,
    Calendar as IconCalendar,
    MapPin,
    Camera,
    CheckCircle2,
    XCircle,
    UserCheck,
    Clock,
    AlertCircle,
    Loader2,
    MapPinCheck,
    ScanFace,
    MessageSquareQuote
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"

const containerVars = {
    hidden: { opacity: 0 },
    show: {
        opacity: 1,
        transition: { staggerChildren: 0.05 }
    }
}

const itemVars = {
    hidden: { opacity: 0, y: 10 },
    show: { opacity: 1, y: 0 }
}

export function MobileHistoryClient({ profile }: { profile: any }) {
    const router = useRouter()
    const today = new Date()
    const [currentMonth, setCurrentMonth] = useState<Date>(today)
    const [selectedDate, setSelectedDate] = useState<Date>(today)

    const monthStart = startOfMonth(currentMonth)
    const monthEnd = endOfMonth(currentMonth)

    // Fetch tRPC data for current month
    const { data: attendance = [], isLoading: isAttendanceLoading } = trpc.attendance.getAttendance.useQuery({
        startDate: format(monthStart, 'yyyy-MM-dd'),
        endDate: format(monthEnd, 'yyyy-MM-dd')
    })

    const { data: leaves = [], isLoading: isLeavesLoading } = trpc.attendance.getLeaves.useQuery({
        status: 'approved'
    })

    const { data: closures = [], isLoading: isClosuresLoading } = trpc.attendance.getOfficeClosures.useQuery()
    const { data: settings, isLoading: isSettingsLoading } = trpc.attendance.getOfficeSettings.useQuery()

    const isLoading = isAttendanceLoading || isLeavesLoading || isClosuresLoading || isSettingsLoading

    // Map attendance by date string (YYYY-MM-DD)
    const attendanceMap = useMemo(() => {
        const map: Record<string, any> = {}
        attendance.forEach((record: any) => {
            const dateStr = typeof record.date === 'string' 
                ? record.date.split('T')[0] 
                : format(new Date(record.date), 'yyyy-MM-dd')
            map[dateStr] = record
        })
        return map
    }, [attendance])

    // Generate days for the grid view
    const calendarDays = useMemo(() => {
        const startGrid = startOfWeek(monthStart, { weekStartsOn: 0 })
        const endGrid = endOfWeek(monthEnd, { weekStartsOn: 0 })
        return eachDayOfInterval({ start: startGrid, end: endGrid })
    }, [currentMonth])

    // Helper: get status and configuration of a specific date
    const getDateInfo = (day: Date) => {
        const dateStr = format(day, 'yyyy-MM-dd')
        const record = attendanceMap[dateStr]
        const dayOfWeek = day.getDay()
        const isOffDay = settings?.off_days?.includes(dayOfWeek)
        const isHoliday = closures?.some((c: any) => c.date === dateStr)
        
        const approvedLeave = leaves?.find((l: any) => {
            const start = parseISO(l.start_date)
            const end = parseISO(l.end_date)
            // check if day falls within leave duration
            return (isAfter(day, start) || isSameDay(day, start)) && 
                   (isBefore(day, end) || isSameDay(day, end))
        })

        let status: 'present' | 'pending_verification' | 'absent' | 'leave' | 'holiday' | 'off_day' | 'future' = 'future'

        if (isAfter(day, today)) {
            status = 'future'
        } else if (isHoliday) {
            status = 'holiday'
        } else if (approvedLeave) {
            status = 'leave'
        } else if (record) {
            if (record.status === 'verified') {
                status = 'present'
            } else {
                status = 'pending_verification'
            }
        } else if (isOffDay) {
            status = 'off_day'
        } else {
            status = 'absent'
        }

        return {
            record,
            isOffDay,
            isHoliday,
            approvedLeave,
            status,
            holidayDetail: isHoliday ? closures.find((c: any) => c.date === dateStr) : null
        }
    }

    // Stats compiled for current month (up to today)
    const stats = useMemo(() => {
        let present = 0
        let absent = 0
        let leavesCount = 0
        let holidays = 0

        const days = eachDayOfInterval({ start: monthStart, end: isBefore(today, monthEnd) ? today : monthEnd })

        days.forEach(day => {
            const info = getDateInfo(day)
            if (info.status === 'present') {
                present++
            } else if (info.status === 'absent') {
                absent++
            } else if (info.status === 'leave') {
                leavesCount += info.record?.is_half_day ? 0.5 : 1
            } else if (info.status === 'holiday') {
                holidays++
            }
        })

        return { present, absent, leaves: leavesCount, holidays }
    }, [attendanceMap, leaves, closures, settings, currentMonth])

    const handlePrevMonth = () => {
        const newMonth = subMonths(currentMonth, 1)
        setCurrentMonth(newMonth)
        setSelectedDate(startOfMonth(newMonth))
    }

    const handleNextMonth = () => {
        const newMonth = addMonths(currentMonth, 1)
        setCurrentMonth(newMonth)
        setSelectedDate(startOfMonth(newMonth))
    }

    // Days list for the scrolling details view
    const daysInMonthList = useMemo(() => {
        const start = monthStart
        const end = isSameMonth(currentMonth, today) ? today : monthEnd
        
        // Return reverse chronological days
        return eachDayOfInterval({ start, end }).reverse()
    }, [currentMonth])

    return (
        <div className="flex flex-col min-h-[calc(100dvh-5rem-5rem)] -mx-4 -mt-4 bg-slate-50 dark:bg-slate-950 pb-20 relative">
            {/* Navigation Header */}
            <div className="flex-none px-4 pt-2 pb-3 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-sm sticky top-0 z-30">
                <div className="flex items-center justify-between">
                    <button 
                        onClick={() => router.push("/mobile")}
                        className="flex items-center justify-center p-2 -ml-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
                        aria-label="Back to dashboard"
                    >
                        <ChevronLeft className="w-6 h-6" />
                        <span className="text-sm font-semibold pr-1">Back</span>
                    </button>
                    
                    <h1 className="text-md font-bold tracking-tight text-center flex-1 pr-8">
                        Attendance Logs
                    </h1>
                </div>
            </div>

            {/* Scrollable Contents */}
            <div className="flex-1 p-4 space-y-5 overflow-y-auto">
                
                {/* Month Switcher Header */}
                <div className="flex items-center justify-between bg-white dark:bg-slate-900 px-4 py-2.5 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 shadow-sm">
                    <button 
                        onClick={handlePrevMonth}
                        className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-850 text-slate-600 dark:text-slate-300 transition-colors"
                    >
                        <ChevronLeft className="w-5 h-5" />
                    </button>
                    
                    <span className="font-extrabold text-sm text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                        <IconCalendar className="w-4 h-4 text-primary" />
                        {format(currentMonth, "MMMM yyyy")}
                    </span>

                    <button 
                        onClick={handleNextMonth}
                        disabled={isSameMonth(currentMonth, today)}
                        className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-855 text-slate-600 dark:text-slate-300 transition-colors disabled:opacity-30 disabled:pointer-events-none"
                    >
                        <ChevronRight className="w-5 h-5" />
                    </button>
                </div>

                {/* Stats row */}
                <div className="grid grid-cols-4 gap-2">
                    <div className="bg-emerald-500/10 dark:bg-emerald-500/5 border border-emerald-500/10 rounded-2xl p-2.5 text-center flex flex-col justify-center">
                        <span className="text-[9px] uppercase font-bold text-emerald-600 dark:text-emerald-500">Present</span>
                        <span className="text-lg font-black text-emerald-600 dark:text-emerald-500 leading-tight mt-0.5">{stats.present}d</span>
                    </div>
                    <div className="bg-rose-500/10 dark:bg-rose-500/5 border border-rose-500/10 rounded-2xl p-2.5 text-center flex flex-col justify-center">
                        <span className="text-[9px] uppercase font-bold text-rose-600 dark:text-rose-500">Absent</span>
                        <span className="text-lg font-black text-rose-600 dark:text-rose-500 leading-tight mt-0.5">{stats.absent}d</span>
                    </div>
                    <div className="bg-indigo-500/10 dark:bg-indigo-500/5 border border-indigo-500/10 rounded-2xl p-2.5 text-center flex flex-col justify-center">
                        <span className="text-[9px] uppercase font-bold text-indigo-600 dark:text-indigo-500">Leaves</span>
                        <span className="text-lg font-black text-indigo-600 dark:text-indigo-500 leading-tight mt-0.5">{stats.leaves}d</span>
                    </div>
                    <div className="bg-slate-500/10 dark:bg-slate-500/5 border border-slate-500/10 rounded-2xl p-2.5 text-center flex flex-col justify-center">
                        <span className="text-[9px] uppercase font-bold text-slate-500 dark:text-slate-400">Holidays</span>
                        <span className="text-lg font-black text-slate-500 dark:text-slate-400 leading-tight mt-0.5">{stats.holidays}d</span>
                    </div>
                </div>

                {/* Calendar Grid Container */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2rem] p-4 shadow-sm relative overflow-hidden">
                    {isLoading && (
                        <div className="absolute inset-0 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xs flex items-center justify-center z-10 rounded-[2rem]">
                            <Loader2 className="w-8 h-8 animate-spin text-primary" />
                        </div>
                    )}
                    
                    {/* Days of week header */}
                    <div className="grid grid-cols-7 gap-1 text-center mb-2">
                        {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map(d => (
                            <span key={d} className="text-[10px] font-black text-muted-foreground uppercase tracking-widest py-1">
                                {d}
                            </span>
                        ))}
                    </div>

                    {/* Calendar cells */}
                    <div className="grid grid-cols-7 gap-y-2 gap-x-1">
                        {calendarDays.map((day, idx) => {
                            const dateStr = format(day, 'yyyy-MM-dd')
                            const info = getDateInfo(day)
                            const isSelected = isSameDay(day, selectedDate)
                            const isCurrentMonth = isSameMonth(day, currentMonth)
                            const isToday = isSameDay(day, today)

                            // Styling setup
                            let bgClass = "bg-transparent text-slate-800 dark:text-slate-200"
                            let borderClass = isSelected ? "ring-2 ring-primary ring-offset-2 dark:ring-offset-slate-900" : ""
                            
                            if (info.status === 'present') {
                                bgClass = "bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400"
                            } else if (info.status === 'pending_verification') {
                                bgClass = "bg-amber-500/15 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400"
                            } else if (info.status === 'absent') {
                                bgClass = "bg-rose-500/10 dark:bg-rose-500/20 text-rose-700 dark:text-rose-400"
                            } else if (info.status === 'leave') {
                                bgClass = "bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-455"
                            } else if (info.status === 'holiday') {
                                bgClass = "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                            } else if (info.status === 'off_day') {
                                bgClass = "text-slate-400 dark:text-slate-600"
                            } else if (info.status === 'future') {
                                bgClass = "text-slate-300 dark:text-slate-700"
                            }

                            if (!isCurrentMonth) {
                                bgClass += " opacity-25"
                            }

                            return (
                                <button
                                    key={idx}
                                    onClick={() => isCurrentMonth && setSelectedDate(day)}
                                    disabled={!isCurrentMonth}
                                    className={`relative aspect-square w-full rounded-full flex flex-col items-center justify-center text-xs font-semibold transition-all ${bgClass} ${borderClass}`}
                                >
                                    <span>{format(day, "d")}</span>
                                    {isToday && (
                                        <span className="absolute bottom-1 w-1 h-1 bg-primary rounded-full" />
                                    )}
                                </button>
                            )
                        })}
                    </div>

                    {/* Legend */}
                    <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 mt-4 pt-4 border-t border-slate-100 dark:border-slate-800/80 text-[10px] font-bold text-muted-foreground">
                        <div className="flex items-center gap-1">
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/20 border border-emerald-500/30" />
                            <span>Present</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <span className="w-2.5 h-2.5 rounded-full bg-rose-500/20 border border-rose-500/30" />
                            <span>Absent</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <span className="w-2.5 h-2.5 rounded-full bg-indigo-500/20 border border-indigo-500/30" />
                            <span>Leave</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <span className="w-2.5 h-2.5 rounded-full bg-slate-100 dark:bg-slate-800" />
                            <span>Holiday</span>
                        </div>
                    </div>
                </div>

                {/* Day Details feed */}
                <div className="space-y-3">
                    <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2 px-1">
                        <Clock className="w-4 h-4 text-blue-500" /> Day Details log
                    </h2>

                    {isLoading ? (
                        <div className="py-8 flex flex-col items-center justify-center gap-2">
                            <Loader2 className="w-6 h-6 animate-spin text-primary" />
                            <span className="text-xs text-muted-foreground">Loading details...</span>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {daysInMonthList.map((day) => {
                                const dateStr = format(day, 'yyyy-MM-dd')
                                const info = getDateInfo(day)
                                const isSelected = isSameDay(day, selectedDate)

                                // Render off-days and future dates simply unless they are selected
                                if (info.status === 'future') return null
                                if (info.status === 'off_day' && !isSelected) return null

                                const record = info.record
                                const formattedDate = format(day, "EEEE, MMMM dd")
                                
                                return (
                                    <motion.div
                                        key={dateStr}
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        className={`bg-white dark:bg-slate-900 border rounded-3xl p-4 shadow-sm space-y-3.5 transition-all ${
                                            isSelected 
                                                ? 'ring-2 ring-indigo-500 border-indigo-500 dark:border-indigo-500 shadow-md scale-[1.01]' 
                                                : 'border-slate-200 dark:border-slate-800'
                                        }`}
                                    >
                                        {/* Header */}
                                        <div className="flex items-start justify-between">
                                            <div className="space-y-0.5">
                                                <h3 className={`text-sm font-extrabold tracking-tight ${isSelected ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-900 dark:text-white'}`}>
                                                    {formattedDate}
                                                </h3>
                                                {isSameDay(day, today) && (
                                                    <span className="text-[10px] font-black uppercase text-primary tracking-wider bg-primary/10 px-2 py-0.25 rounded-full">
                                                        Today
                                                    </span>
                                                )}
                                            </div>

                                            <div className="flex items-center gap-2">
                                                {info.status === 'present' && (
                                                    <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shadow-none font-bold uppercase text-[9px] tracking-wider">
                                                        Verified
                                                    </Badge>
                                                )}
                                                {info.status === 'pending_verification' && (
                                                    <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 shadow-none font-bold uppercase text-[9px] tracking-wider">
                                                        Awaiting
                                                    </Badge>
                                                )}
                                                {info.status === 'absent' && (
                                                    <Badge className="bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 shadow-none font-bold uppercase text-[9px] tracking-wider">
                                                        Absent
                                                    </Badge>
                                                )}
                                                {info.status === 'leave' && (
                                                    <Badge className="bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 shadow-none font-bold uppercase text-[9px] tracking-wider">
                                                        Leave
                                                    </Badge>
                                                )}
                                                {info.status === 'holiday' && (
                                                    <Badge className="bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 shadow-none font-bold uppercase text-[9px] tracking-wider">
                                                        Holiday
                                                    </Badge>
                                                )}
                                                {info.status === 'off_day' && (
                                                    <Badge className="bg-slate-50 text-slate-500 dark:bg-slate-900 border dark:border-slate-800 shadow-none font-bold uppercase text-[9px] tracking-wider">
                                                        Weekend
                                                    </Badge>
                                                )}
                                            </div>
                                        </div>

                                        {/* Status Detail Blocks */}
                                        {info.status === 'holiday' && info.holidayDetail && (
                                            <div className="text-xs p-3 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800/50 rounded-2xl text-slate-600 dark:text-slate-400">
                                                <strong className="text-slate-900 dark:text-white font-semibold">Office Closed:</strong> {info.holidayDetail.reason}
                                            </div>
                                        )}

                                        {info.status === 'leave' && info.approvedLeave && (
                                            <div className="text-xs p-3 bg-indigo-50/30 dark:bg-indigo-950/20 border border-indigo-100/50 dark:border-indigo-900/10 rounded-2xl space-y-1">
                                                <p className="text-slate-900 dark:text-white">
                                                    <strong className="text-indigo-600 dark:text-indigo-400 font-semibold">{info.approvedLeave.leave_type || "Leave"}:</strong> Approved
                                                </p>
                                                {info.approvedLeave.reason && (
                                                    <p className="text-muted-foreground italic">"{info.approvedLeave.reason}"</p>
                                                )}
                                            </div>
                                        )}

                                        {record && (
                                            <div className="space-y-3">
                                                {/* Punch in/out hours summary */}
                                                <div className="grid grid-cols-3 gap-2 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800/50 rounded-2xl p-3 text-center">
                                                    <div className="flex flex-col">
                                                        <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Clock In</span>
                                                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-1">
                                                            {record.check_in ? format(new Date(record.check_in), "hh:mm a") : "—"}
                                                        </span>
                                                    </div>
                                                    <div className="flex flex-col border-x border-slate-200/50 dark:border-slate-800/80">
                                                        <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Clock Out</span>
                                                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-1">
                                                            {record.check_out ? format(new Date(record.check_out), "hh:mm a") : (isSameDay(day, today) ? "Active" : "—")}
                                                        </span>
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Hrs Worked</span>
                                                        <span className="text-xs font-black text-indigo-600 dark:text-indigo-400 mt-1">
                                                            {record.working_hours ? `${Number(record.working_hours).toFixed(2)}h` : "—"}
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Verification Card Details */}
                                                <div className="bg-slate-50/50 dark:bg-slate-950/30 border border-slate-100 dark:border-slate-900 rounded-2xl p-3 space-y-3">
                                                    <div className="flex items-center gap-3">
                                                        {/* Selfie Avatar */}
                                                        <div className="relative shrink-0">
                                                            <Avatar className="w-12 h-12 rounded-xl ring-2 ring-slate-200/60 dark:ring-slate-800">
                                                                <AvatarImage src={record.selfie_url || ''} className="object-cover" />
                                                                <AvatarFallback className="rounded-xl bg-slate-100 dark:bg-slate-800">
                                                                    <Camera className="w-5 h-5 text-muted-foreground" />
                                                                </AvatarFallback>
                                                            </Avatar>
                                                            {record.face_match_score && (
                                                                <span className="absolute -bottom-1.5 -right-1.5 bg-indigo-600 text-white font-extrabold text-[8px] px-1 rounded-full border border-white dark:border-slate-950 flex items-center justify-center h-4 min-w-4 shadow-sm">
                                                                    {Math.round(Number(record.face_match_score) * 100)}%
                                                                </span>
                                                            )}
                                                        </div>

                                                        {/* Verification Specs */}
                                                        <div className="flex-1 min-w-0 space-y-1">
                                                            <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 text-xs font-semibold">
                                                                <ScanFace className="w-3.5 h-3.5 text-indigo-500" />
                                                                <span className="truncate">Face Verification Match</span>
                                                            </div>
                                                            <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 text-xs font-semibold">
                                                                <MapPinCheck className="w-3.5 h-3.5 text-emerald-500" />
                                                                <span className="truncate text-slate-700 dark:text-slate-350">
                                                                    {record.checkin_location_name || "Office Geofence Approved"}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Coordinates or verification source */}
                                                    {(record.checkin_latitude && record.checkin_longitude) && (
                                                        <div className="text-[10px] text-muted-foreground flex items-center gap-1 font-medium bg-slate-100/50 dark:bg-slate-900/60 py-1 px-2.5 rounded-lg w-fit">
                                                            <MapPin className="w-3 h-3 text-slate-400" />
                                                            <span>{Number(record.checkin_latitude).toFixed(4)}°, {Number(record.checkin_longitude).toFixed(4)}°</span>
                                                            <span className="opacity-40">•</span>
                                                            <span className="capitalize">{record.source || 'mobile'} check-in</span>
                                                        </div>
                                                    )}

                                                    {/* Remarks from Moderator */}
                                                    {record.remarks && (
                                                        <div className="pt-2 border-t border-slate-150/40 dark:border-slate-800/40 flex items-start gap-1.5 text-xs text-slate-650 dark:text-slate-455">
                                                            <MessageSquareQuote className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
                                                            <p className="leading-relaxed"><strong className="font-semibold text-slate-855 dark:text-slate-350">Remarks:</strong> {record.remarks}</p>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                        {info.status === 'absent' && (
                                            <div className="text-xs p-3 bg-rose-50/20 dark:bg-rose-950/10 border border-rose-100/20 dark:border-rose-900/10 rounded-2xl text-rose-800 dark:text-rose-300 flex items-start gap-2">
                                                <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                                                <p className="leading-relaxed">
                                                    No attendance logs recorded for this day. Absent status will default unless verified by administration.
                                                </p>
                                            </div>
                                        )}
                                    </motion.div>
                                )
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
