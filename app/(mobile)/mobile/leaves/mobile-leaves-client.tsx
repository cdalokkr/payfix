"use client"

import { useState, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { format, differenceInDays, parseISO, isAfter, isBefore, isEqual } from "date-fns"
import { trpc } from "@/lib/trpc/client"
import { useRouter } from "next/navigation"
import {
    Calendar,
    CalendarDays,
    ChevronLeft,
    FileText,
    Plus,
    X,
    CheckCircle2,
    Clock,
    AlertCircle,
    Info,
    Plane,
    Loader2
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"

const containerVars = {
    hidden: { opacity: 0 },
    show: {
        opacity: 1,
        transition: { staggerChildren: 0.05 }
    }
}

const itemVars = {
    hidden: { opacity: 0, y: 15 },
    show: { opacity: 1, y: 0 }
}

export function MobileLeavesClient({ profile }: { profile: any }) {
    const router = useRouter()
    const utils = trpc.useUtils()
    const [isApplyOpen, setIsApplyOpen] = useState(false)

    // Form states
    const [leaveType, setLeaveType] = useState<string>("Casual Leave")
    const [startDate, setStartDate] = useState("")
    const [endDate, setEndDate] = useState("")
    const [reason, setReason] = useState("")
    const [isHalfDay, setIsHalfDay] = useState(false)
    const [halfDayPeriod, setHalfDayPeriod] = useState<"morning" | "afternoon">("morning")

    // Fetch leaves data
    const { data: leaves = [], isLoading, isFetching } = trpc.attendance.getLeaves.useQuery({
        profileId: profile?.id,
        status: 'all'
    })

    const applyMutation = trpc.attendance.applyLeave.useMutation({
        onSuccess: () => {
            toast.success("Leave applied successfully")
            setIsApplyOpen(false)
            resetForm()
            utils.attendance.getLeaves.invalidate()
        },
        onError: (error) => {
            toast.error(error.message || "Failed to apply for leave")
        }
    })

    const resetForm = () => {
        setLeaveType("Casual Leave")
        setStartDate("")
        setEndDate("")
        setReason("")
        setIsHalfDay(false)
        setHalfDayPeriod("morning")
    }

    // Helper to calculate duration in days
    const getLeaveDuration = (leave: any) => {
        if (leave.is_half_day) return 0.5
        try {
            const start = typeof leave.start_date === 'string' ? parseISO(leave.start_date) : new Date(leave.start_date)
            const end = typeof leave.end_date === 'string' ? parseISO(leave.end_date) : new Date(leave.end_date)
            return differenceInDays(end, start) + 1
        } catch (e) {
            return 1
        }
    }

    // Stats calculations
    const stats = useMemo(() => {
        let approved = 0
        let pending = 0
        
        leaves.forEach((leave: any) => {
            const duration = getLeaveDuration(leave)
            if (leave.status === 'approved') {
                approved += duration
            } else if (leave.status === 'pending') {
                pending += duration
            }
        })

        const totalAllowance = 18 // Standard annual allowance
        const remaining = Math.max(0, totalAllowance - approved)

        return { approved, pending, remaining, totalAllowance }
    }, [leaves])

    const handleApplySubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (!startDate) return toast.error("Please select a start date")
        
        const finalEndDate = isHalfDay ? startDate : endDate
        if (!isHalfDay && !finalEndDate) return toast.error("Please select an end date")

        // Validate date ranges
        if (!isHalfDay) {
            const start = new Date(startDate)
            const end = new Date(finalEndDate)
            if (isAfter(start, end)) {
                return toast.error("Start date must be before or equal to End date")
            }
        }

        applyMutation.mutate({
            leaveType,
            startDate,
            endDate: finalEndDate,
            isHalfDay,
            halfDayPeriod: isHalfDay ? halfDayPeriod : undefined,
            reason
        })
    }

    const handleStartDateChange = (val: string) => {
        setStartDate(val)
        if (isHalfDay || !endDate) {
            setEndDate(val)
        }
    }

    const handleHalfDayToggle = (checked: boolean) => {
        setIsHalfDay(checked)
        if (checked && startDate) {
            setEndDate(startDate)
        }
    }

    return (
        <div className="flex flex-col min-h-[calc(100dvh-5rem-5rem)] -mx-4 -mt-4 bg-slate-50 dark:bg-slate-950 pb-20 relative">
            {/* Top Navigation Header */}
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
                        Leave Manager
                    </h1>
                    
                    {isFetching && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground absolute right-4" />}
                </div>
            </div>

            {/* Content Container */}
            <div className="flex-1 p-4 space-y-4 overflow-y-auto">
                {/* Stats Summary Cards */}
                <motion.div 
                    variants={containerVars} 
                    initial="hidden" 
                    animate="show"
                    className="grid grid-cols-3 gap-3"
                >
                    {/* Remaining */}
                    <motion.div 
                        variants={itemVars}
                        className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white rounded-2xl p-3 flex flex-col justify-between shadow-md shadow-indigo-500/10"
                    >
                        <span className="text-[10px] uppercase font-black tracking-wider opacity-75">Remaining</span>
                        <div className="my-2">
                            <span className="text-2xl font-black">{stats.remaining}</span>
                            <span className="text-[10px] opacity-75 font-semibold"> / {stats.totalAllowance}d</span>
                        </div>
                        <div className="w-full bg-white/20 h-1 rounded-full overflow-hidden">
                            <div 
                                className="bg-white h-full rounded-full transition-all duration-500" 
                                style={{ width: `${(stats.remaining / stats.totalAllowance) * 100}%` }}
                            />
                        </div>
                    </motion.div>

                    {/* Approved */}
                    <motion.div 
                        variants={itemVars}
                        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 flex flex-col justify-between shadow-sm"
                    >
                        <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Approved</span>
                        <div className="my-2">
                            <span className="text-2xl font-black text-emerald-600 dark:text-emerald-500">{stats.approved}</span>
                            <span className="text-[10px] text-muted-foreground font-semibold"> Days</span>
                        </div>
                        <span className="text-[9px] text-muted-foreground flex items-center gap-1 font-medium">
                            <CheckCircle2 className="w-3 h-3 text-emerald-500" /> Confirmed
                        </span>
                    </motion.div>

                    {/* Pending */}
                    <motion.div 
                        variants={itemVars}
                        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 flex flex-col justify-between shadow-sm"
                    >
                        <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Pending</span>
                        <div className="my-2">
                            <span className="text-2xl font-black text-amber-600 dark:text-amber-500">{stats.pending}</span>
                            <span className="text-[10px] text-muted-foreground font-semibold"> Days</span>
                        </div>
                        <span className="text-[9px] text-muted-foreground flex items-center gap-1 font-medium">
                            <Clock className="w-3 h-3 text-amber-500" /> Awaiting
                        </span>
                    </motion.div>
                </motion.div>

                {/* Info Tip */}
                <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/40 rounded-xl p-3 flex items-start gap-2.5 text-xs text-blue-800 dark:text-blue-300"
                >
                    <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                    <p className="leading-relaxed">
                        Leave balance is based on an annual allotment of <strong>{stats.totalAllowance} days</strong>. Deductions are processed automatically upon admin approval.
                    </p>
                </motion.div>

                {/* History Timeline */}
                <div className="space-y-3">
                    <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2 px-1">
                        <Plane className="w-4 h-4 text-purple-500" /> Leave Logs
                    </h2>

                    {isLoading ? (
                        <div className="py-12 flex flex-col items-center justify-center gap-2">
                            <Loader2 className="w-8 h-8 animate-spin text-primary" />
                            <p className="text-xs text-muted-foreground">Loading records...</p>
                        </div>
                    ) : leaves.length === 0 ? (
                        <div className="bg-white dark:bg-slate-900 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl p-10 text-center flex flex-col items-center justify-center gap-2">
                            <CalendarDays className="w-10 h-10 text-slate-300 dark:text-slate-700" />
                            <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">No leaves applied yet</p>
                            <p className="text-xs text-muted-foreground">Use the button below to submit your first leave application.</p>
                        </div>
                    ) : (
                        <motion.div 
                            variants={containerVars}
                            initial="hidden"
                            animate="show"
                            className="space-y-3"
                        >
                            {leaves.map((leave: any) => {
                                const duration = getLeaveDuration(leave)
                                const isApproved = leave.status === 'approved'
                                const isRejected = leave.status === 'rejected'
                                const isPending = leave.status === 'pending'
                                
                                return (
                                    <motion.div 
                                        key={leave.id}
                                        variants={itemVars}
                                        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm space-y-3"
                                    >
                                        <div className="flex items-start justify-between">
                                            <div className="space-y-0.5">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-semibold text-sm text-slate-900 dark:text-white">
                                                        {leave.leave_type || "Leave Request"}
                                                    </span>
                                                    {leave.is_half_day && (
                                                        <Badge variant="outline" className="text-[10px] px-1.5 py-0.25 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 capitalize font-medium">
                                                            ½ Day ({leave.half_day_period})
                                                        </Badge>
                                                    )}
                                                </div>
                                                <p className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                                                    <Calendar className="w-3.5 h-3.5" />
                                                    {format(parseISO(leave.start_date), "MMM dd, yyyy")}
                                                    {!leave.is_half_day && leave.end_date !== leave.start_date && (
                                                        <>
                                                            <span>→</span>
                                                            {format(parseISO(leave.end_date), "MMM dd, yyyy")}
                                                        </>
                                                    )}
                                                </p>
                                            </div>

                                            <div className="flex flex-col items-end gap-1.5">
                                                <Badge 
                                                    className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 shadow-none rounded-full ${
                                                        isApproved ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' :
                                                        isRejected ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20' :
                                                        'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                                                    }`}
                                                >
                                                    {leave.status}
                                                </Badge>
                                                <span className="text-[11px] font-black text-slate-500 dark:text-slate-400">
                                                    {duration} {duration === 1 ? 'Day' : 'Days'}
                                                </span>
                                            </div>
                                        </div>

                                        {leave.reason && (
                                            <div className="text-xs text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl border border-slate-100 dark:border-slate-900 flex items-start gap-2">
                                                <FileText className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                                                <p className="leading-relaxed italic">"{leave.reason}"</p>
                                            </div>
                                        )}

                                        {leave.remarks && (
                                            <div className="text-xs text-slate-600 dark:text-slate-400 bg-indigo-50/30 dark:bg-indigo-950/20 p-2.5 rounded-xl border border-indigo-100/40 dark:border-indigo-900/20">
                                                <p className="leading-relaxed">
                                                    <strong className="text-indigo-600 dark:text-indigo-400">Admin Remarks:</strong> {leave.remarks}
                                                </p>
                                            </div>
                                        )}
                                    </motion.div>
                                )
                            })}
                        </motion.div>
                    )}
                </div>
            </div>

            {/* Bottom Sticky Action Button */}
            <div className="fixed bottom-16 left-0 right-0 max-w-md mx-auto px-4 py-3 bg-gradient-to-t from-slate-50 via-slate-50/90 to-transparent dark:from-slate-950 dark:via-slate-950/90 dark:to-transparent z-20">
                <Button 
                    onClick={() => setIsApplyOpen(true)}
                    className="w-full h-12 rounded-full font-bold shadow-lg shadow-purple-500/20 bg-gradient-to-r from-indigo-500 to-purple-600 text-white hover:from-indigo-600 hover:to-purple-700 transition-all flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98]"
                >
                    <Plus className="w-5 h-5" /> Apply for Leave
                </Button>
            </div>

            {/* Custom Sliding Drawer Form */}
            <AnimatePresence>
                {isApplyOpen && (
                    <>
                        {/* Backdrop */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 0.5 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsApplyOpen(false)}
                            className="fixed inset-0 bg-black z-40"
                        />

                        {/* Drawer Panel */}
                        <motion.div
                            initial={{ y: "100%" }}
                            animate={{ y: 0 }}
                            exit={{ y: "100%" }}
                            transition={{ type: "spring", damping: 25, stiffness: 220 }}
                            className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white dark:bg-slate-900 rounded-t-[2.5rem] border-t border-slate-200 dark:border-slate-800 shadow-2xl z-50 overflow-hidden flex flex-col max-h-[85vh]"
                        >
                            {/* Drawer Drag Indicator & Header */}
                            <div className="flex-none p-4 flex flex-col items-center border-b border-slate-100 dark:border-slate-800">
                                <div className="w-12 h-1 bg-slate-300 dark:bg-slate-700 rounded-full mb-3" />
                                <div className="flex items-center justify-between w-full px-2">
                                    <h3 className="text-base font-black tracking-tight">Apply for Leave</h3>
                                    <button 
                                        onClick={() => setIsApplyOpen(false)}
                                        className="p-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            {/* Form Content - Scrollable */}
                            <form onSubmit={handleApplySubmit} className="flex-1 overflow-y-auto p-6 space-y-5 pb-8">
                                {/* Leave Type */}
                                <div className="space-y-2">
                                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Leave Type</Label>
                                    <Select value={leaveType} onValueChange={setLeaveType}>
                                        <SelectTrigger className="h-12 rounded-xl bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800">
                                            <SelectValue placeholder="Select type" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Casual Leave">Casual Leave</SelectItem>
                                            <SelectItem value="Sick Leave">Sick Leave</SelectItem>
                                            <SelectItem value="Earned Leave">Earned Leave</SelectItem>
                                            <SelectItem value="Other">Other</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* Half Day Toggle */}
                                <div className="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-slate-950 border border-slate-200/60 dark:border-slate-800/60 rounded-xl">
                                    <div className="space-y-0.5">
                                        <Label htmlFor="half-day" className="text-sm font-semibold cursor-pointer">Apply for Half Day</Label>
                                        <p className="text-[10px] text-muted-foreground">Requests attendance adjustment for 0.5 days</p>
                                    </div>
                                    <input 
                                        type="checkbox"
                                        id="half-day"
                                        checked={isHalfDay}
                                        onChange={(e) => handleHalfDayToggle(e.target.checked)}
                                        className="w-5 h-5 accent-indigo-600 rounded cursor-pointer"
                                    />
                                </div>

                                {/* Half Day Period Selector (Visible only if half day is checked) */}
                                <AnimatePresence>
                                    {isHalfDay && (
                                        <motion.div
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: "auto" }}
                                            exit={{ opacity: 0, height: 0 }}
                                            className="space-y-2 overflow-hidden"
                                        >
                                            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Period</Label>
                                            <div className="grid grid-cols-2 gap-2 bg-slate-100 dark:bg-slate-950 p-1 rounded-xl">
                                                <button
                                                    type="button"
                                                    onClick={() => setHalfDayPeriod("morning")}
                                                    className={`py-2 text-xs font-bold rounded-lg transition-all ${
                                                        halfDayPeriod === "morning"
                                                            ? "bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm"
                                                            : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                                                    }`}
                                                >
                                                    Morning Session
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setHalfDayPeriod("afternoon")}
                                                    className={`py-2 text-xs font-bold rounded-lg transition-all ${
                                                        halfDayPeriod === "afternoon"
                                                            ? "bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm"
                                                            : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                                                    }`}
                                                >
                                                    Afternoon Session
                                                </button>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>

                                {/* Dates selection */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                            {isHalfDay ? "Select Date" : "Start Date"}
                                        </Label>
                                        <Input
                                            type="date"
                                            value={startDate}
                                            onChange={(e) => handleStartDateChange(e.target.value)}
                                            required
                                            className="h-12 rounded-xl bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-sm"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">End Date</Label>
                                        <Input
                                            type="date"
                                            value={isHalfDay ? startDate : endDate}
                                            onChange={(e) => setEndDate(e.target.value)}
                                            disabled={isHalfDay}
                                            required={!isHalfDay}
                                            className="h-12 rounded-xl bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-sm disabled:opacity-50"
                                        />
                                    </div>
                                </div>

                                {/* Reason Textarea */}
                                <div className="space-y-2">
                                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Reason</Label>
                                    <Textarea
                                        placeholder="Please provide details for this leave request..."
                                        value={reason}
                                        onChange={(e) => setReason(e.target.value)}
                                        rows={3}
                                        required
                                        className="rounded-xl bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 resize-none text-sm"
                                    />
                                </div>

                                {/* Submit buttons */}
                                <div className="flex gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                                    <Button 
                                        type="button" 
                                        variant="outline" 
                                        onClick={() => setIsApplyOpen(false)}
                                        className="flex-1 h-12 rounded-xl text-sm font-semibold border-slate-200 dark:border-slate-800"
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        type="submit"
                                        disabled={applyMutation.isPending}
                                        className="flex-1 h-12 rounded-xl text-sm font-bold shadow-md shadow-indigo-500/10 bg-gradient-to-r from-indigo-500 to-purple-600 text-white"
                                    >
                                        {applyMutation.isPending ? (
                                            <>
                                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                                Submitting...
                                            </>
                                        ) : (
                                            "Submit"
                                        )}
                                    </Button>
                                </div>
                            </form>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    )
}
