"use client"

import React, { useState, useEffect, useMemo } from "react"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { ActionButton, EditButton } from "@/components/ui/action-button"
import {
    Clock,
    LogIn,
    LogOut,
    CheckCircle2,
    AlertCircle,
    Fingerprint,
    Check,
    X,
    Loader2,
    XCircle,
    Info,
    ArrowRight,
    Save,
    Sparkles,
    CheckCheck,
    RotateCcw,
    UserCheck,
    UserX,
} from "lucide-react"
import { format, isValid, differenceInMinutes } from "date-fns"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"
import { ProfileInfoCell } from "@/components/dashboard/profile-info-cell"
import { trpc } from "@/lib/trpc/client"
import { toast } from "sonner"

interface AttendanceSessionsDialogProps {
    isOpen: boolean
    onOpenChange: (open: boolean) => void
    record: any | null
    onSessionUpdated?: () => void
}

export function AttendanceSessionsDialog({
    isOpen,
    onOpenChange,
    record,
    onSessionUpdated,
}: AttendanceSessionsDialogProps) {
    const utils = trpc.useUtils()

    // Working local draft state of sessions
    const [draftSessions, setDraftSessions] = useState<any[]>([])

    // Active accordion inline-expanded session id
    const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null)

    // Inline edit form state for the currently expanded session
    const [inlineEditForm, setInlineEditForm] = useState<{
        checkInTime: string
        checkOutTime: string
        remarks: string
        status: string
    }>({
        checkInTime: "",
        checkOutTime: "",
        remarks: "",
        status: "completed",
    })

    // Helper to format ISO time for input (HH:mm:ss)
    const formatTimeForInput = (val: string | Date | null | undefined) => {
        if (!val) return ""
        const d = new Date(val)
        return isValid(d) ? format(d, "HH:mm:ss") : ""
    }

    // Helper to format time for display (hh:mm:ss a)
    const formatSafeTime = (val: string | Date | null | undefined) => {
        if (!val) return "--:--"
        const d = new Date(val)
        return isValid(d) ? format(d, "hh:mm:ss a") : "--:--"
    }

    const formatSafeDate = (val: string | Date | null | undefined) => {
        if (!val) return ""
        const d = new Date(val)
        return isValid(d) ? format(d, "EEEE, MMMM dd, yyyy") : String(val)
    }

    // Initialize/sync draft sessions when record changes
    useEffect(() => {
        if (record && isOpen) {
            const rawSessions: any[] = record.sessions || []
            const cloned = rawSessions.map((s, idx) => ({
                ...s,
                _original: { ...s },
                _isModified: false,
                session_number: s.session_number || idx + 1,
            }))
            setDraftSessions(cloned)
            setExpandedSessionId(null)
        }
    }, [record, isOpen])

    // Detect if there are unsaved changes
    const hasUnsavedChanges = useMemo(() => {
        return draftSessions.some((s) => s._isModified)
    }, [draftSessions])

    // Calculate real-time live total credited hours from draft sessions
    const liveCreditedHours = useMemo(() => {
        const valid = draftSessions.filter((s) => s.status !== "rejected")
        const totalMinutes = valid.reduce((acc, sess) => {
            return acc + (sess.working_hours ? Math.round(Number(sess.working_hours) * 60) : 0)
        }, 0)
        return (totalMinutes / 60).toFixed(2)
    }, [draftSessions])

    // Live preview of duration for the currently expanded session
    const liveSessionDuration = useMemo(() => {
        if (!inlineEditForm.checkInTime) return null
        if (!inlineEditForm.checkOutTime) return "In Progress..."

        const dateStr = record?.date || format(new Date(), "yyyy-MM-dd")
        const inDate = new Date(`${dateStr}T${inlineEditForm.checkInTime}+05:30`)
        const outDate = new Date(`${dateStr}T${inlineEditForm.checkOutTime}+05:30`)

        if (!isValid(inDate) || !isValid(outDate)) return null
        if (outDate <= inDate) return "INVALID_TIME"

        const diffMins = Math.max(0, differenceInMinutes(outDate, inDate))
        return `${(diffMins / 60).toFixed(2)} hrs (${diffMins}m)`
    }, [inlineEditForm.checkInTime, inlineEditForm.checkOutTime, record?.date])

    // Open inline edit accordion for a session
    const handleStartInlineEdit = (sess: any) => {
        setExpandedSessionId(sess.id)
        setInlineEditForm({
            checkInTime: formatTimeForInput(sess.check_in),
            checkOutTime: formatTimeForInput(sess.check_out),
            remarks: sess.remarks || "",
            status: sess.status || (sess.check_out ? "completed" : "active"),
        })
    }

    // Cancel inline edit without applying to this row
    const handleCancelInlineEdit = () => {
        setExpandedSessionId(null)
    }

    // Done button clicked inside expanded row -> updates local draft state and collapses
    const handleDoneInlineEdit = (sessionId: string) => {
        if (!inlineEditForm.checkInTime) {
            toast.error("Check-in time is required")
            return
        }

        const dateStr = record?.date || format(new Date(), "yyyy-MM-dd")
        const inISO = new Date(`${dateStr}T${inlineEditForm.checkInTime}+05:30`).toISOString()
        const outISO = inlineEditForm.checkOutTime
            ? new Date(`${dateStr}T${inlineEditForm.checkOutTime}+05:30`).toISOString()
            : null

        let workingHours: string | null = null
        if (inISO && outISO) {
            const inDate = new Date(inISO)
            const outDate = new Date(outISO)
            if (outDate <= inDate) {
                toast.error("Check-out time must be after check-in time")
                return
            }
            const diffMins = Math.max(0, differenceInMinutes(outDate, inDate))
            workingHours = (diffMins / 60).toFixed(2)
        }

        setDraftSessions((prev) =>
            prev.map((s) => {
                if (s.id !== sessionId) return s
                return {
                    ...s,
                    check_in: inISO,
                    check_out: outISO,
                    working_hours: workingHours,
                    remarks: inlineEditForm.remarks || null,
                    status: s.status === "rejected" ? "rejected" : (outISO ? "completed" : "active"),
                    _isModified: true,
                }
            })
        )

        setExpandedSessionId(null)
        toast.info("Session updated in draft. Click 'Save Changes' to apply.")
    }

    // Toggle Verify in local draft
    const handleToggleVerify = (sessionId: string) => {
        setDraftSessions((prev) =>
            prev.map((s) => {
                if (s.id !== sessionId) return s
                const newStatus = s.status === "verified" ? "completed" : "verified"
                return {
                    ...s,
                    status: newStatus,
                    _isModified: true,
                }
            })
        )
    }

    // Toggle Reject in local draft
    const handleToggleReject = (sessionId: string) => {
        setDraftSessions((prev) =>
            prev.map((s) => {
                if (s.id !== sessionId) return s
                const isCurrentlyRejected = s.status === "rejected"
                const newStatus = isCurrentlyRejected
                    ? (s.check_out ? "completed" : "active")
                    : "rejected"
                return {
                    ...s,
                    status: newStatus,
                    remarks: isCurrentlyRejected ? s.remarks : (s.remarks || "Marked as rejected by admin"),
                    _isModified: true,
                }
            })
        )
    }

    // Batch Update Mutation to commit everything to the database
    const batchUpdateMutation = trpc.attendance.batchUpdateSessions.useMutation({
        onSuccess: () => {
            toast.success("Attendance sessions saved and synchronized successfully!")
            utils.attendance.getAttendance.invalidate()
            onSessionUpdated?.()
            onOpenChange(false)
        },
        onError: (err) => {
            toast.error(err.message || "Failed to save sessions")
        },
    })

    // One-click Verify All in draft
    const handleVerifyAllDraft = () => {
        setDraftSessions((prev) =>
            prev.map((s) => {
                if (s.status === "rejected") return s
                return {
                    ...s,
                    status: "verified",
                    _isModified: true,
                }
            })
        )
        toast.info("All valid sessions marked verified in draft. Click 'Save Changes' to apply.")
    }

    // Save Changes clicked in modal footer
    const handleSaveAll = () => {
        if (!record?.id) return

        const payloadSessions = draftSessions.map((s) => ({
            id: s.id,
            check_in: s.check_in,
            check_out: s.check_out,
            status: s.status as any,
            remarks: s.remarks,
        }))

        batchUpdateMutation.mutate({
            attendanceId: record.id,
            sessions: payloadSessions,
        })
    }

    if (!record) return null

    const employee = record.profile
    const isCurrentlyCheckedIn = record.current_session_status === "checked_in"
    const hasRejected = draftSessions.some((s) => s.status === "rejected")
    const unverifiedCount = draftSessions.filter(
        (s) => s.status !== "verified" && s.status !== "rejected"
    ).length

    return (
        <Dialog open={isOpen} onOpenChange={(open) => {
            if (!open && hasUnsavedChanges && !batchUpdateMutation.isPending) {
                if (confirm("You have unsaved changes in this session. Are you sure you want to discard them?")) {
                    onOpenChange(false)
                }
                return
            }
            onOpenChange(open)
        }}>
            <DialogContent className="max-w-[660px] w-[95vw] sm:w-full max-h-[90vh] flex flex-col p-0 overflow-hidden rounded-2xl shadow-2xl border border-slate-200/90 dark:border-slate-800/90 bg-white dark:bg-slate-950">
                {/* Header - Fixed Top */}
                <div className="shrink-0 px-5 pt-4 pb-3.5 border-b border-slate-100 dark:border-slate-800/80 bg-gradient-to-b from-slate-50/90 to-white dark:from-slate-900/70 dark:to-slate-950">
                    <div className="flex items-start justify-between gap-3">
                        <div className="space-y-0.5">
                            <DialogTitle className="text-base font-extrabold flex items-center gap-2 text-slate-900 dark:text-slate-100">
                                <div className="p-1.5 rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20">
                                    <Clock className="w-4 h-4" />
                                </div>
                                Attendance Sessions Breakdown
                            </DialogTitle>
                            <DialogDescription className="text-xs font-medium text-muted-foreground ml-8">
                                {formatSafeDate(record.date)}
                            </DialogDescription>
                        </div>

                        {/* Status & Credited Hours */}
                        <div className="flex flex-col items-end gap-1 shrink-0">
                            {isCurrentlyCheckedIn ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
                                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping inline-block" />
                                    Active (In Office)
                                </span>
                            ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                                    Checked Out
                                </span>
                            )}
                            <span className="text-[11px] font-semibold text-muted-foreground">
                                Total Credited: <strong className="text-primary font-black text-xs">{liveCreditedHours} hrs</strong>
                            </span>
                        </div>
                    </div>

                    {/* Employee Profile Cell */}
                    {employee && (
                        <div className="mt-3 pt-2.5 border-t border-slate-200/60 dark:border-slate-800/60 flex items-center justify-between">
                            <ProfileInfoCell profile={employee} />
                            <div className="flex items-center gap-2">
                                {hasUnsavedChanges && (
                                    <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30 text-[10px] font-bold py-0.5">
                                        Unsaved Edits
                                    </Badge>
                                )}
                                <Badge variant="outline" className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
                                    {draftSessions.length} {draftSessions.length === 1 ? "Session" : "Sessions"}
                                </Badge>
                            </div>
                        </div>
                    )}

                    {/* Rejection Alert Banner */}
                    {hasRejected && (
                        <div className="mt-2.5 p-2 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-800 dark:text-rose-300 text-[11px] flex items-center gap-2 font-medium">
                            <Info className="w-3.5 h-3.5 shrink-0 text-rose-600 dark:text-rose-400" />
                            <span>Rejected session duration is <strong>strictly excluded (0.00 hrs)</strong> from total credited hours.</span>
                        </div>
                    )}
                </div>

                {/* Sessions Row-Wise List - Scrollable Middle */}
                <div className="flex-1 min-h-0 overflow-y-auto px-5 py-3.5 space-y-2.5 custom-scrollbar">
                    {draftSessions.length > 0 ? (
                        draftSessions.map((sess, idx) => {
                            const isEditing = expandedSessionId === sess.id
                            const isRejected = sess.status === "rejected"
                            const isVerified = sess.status === "verified"
                            const isActive = sess.status === "active" || (!sess.check_out && isCurrentlyCheckedIn && idx === draftSessions.length - 1)
                            const sIn = formatSafeTime(sess.check_in)
                            const sOut = sess.check_out ? formatSafeTime(sess.check_out) : (isActive ? "In Office" : "--:--")
                            const sDuration = sess.working_hours ? `${Number(sess.working_hours).toFixed(2)}h` : (isActive ? "In Progress" : "--")

                            return (
                                <div
                                    key={sess.id || idx}
                                    className={cn(
                                        "rounded-xl border transition-all duration-200 overflow-hidden shadow-xs",
                                        isRejected
                                            ? "bg-rose-500/[0.04] border-rose-300 dark:border-rose-900/60"
                                            : isVerified
                                            ? "bg-emerald-500/[0.04] border-emerald-300 dark:border-emerald-900/60"
                                            : isActive
                                            ? "bg-sky-500/[0.04] border-sky-300 dark:border-sky-900/60"
                                            : "bg-slate-50/70 dark:bg-slate-900/40 border-slate-200/80 dark:border-slate-800/80",
                                        isEditing && "ring-2 ring-primary/40 border-primary shadow-sm"
                                    )}
                                >
                                    {/* Main Row Display */}
                                    <div className="px-3 pt-2.5 pb-1 flex items-center justify-between gap-2">
                                        {/* Left: Session Number & Time Range */}
                                        <div className="flex items-center gap-2.5 min-w-0">
                                            <span className="font-extrabold text-xs text-foreground shrink-0 flex items-center gap-1.5">
                                                #{sess.session_number || idx + 1}
                                                {sess._isModified && (
                                                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500 inline-block" title="Unsaved edit" />
                                                )}
                                            </span>

                                            <div className="flex items-center gap-1.5 text-xs">
                                                <span className="font-bold text-emerald-700 dark:text-emerald-400">
                                                    {sIn}
                                                </span>
                                                <span className="text-muted-foreground/50 text-[10px]">→</span>
                                                <span className={cn(
                                                    "font-bold",
                                                    sess.check_out ? "text-amber-700 dark:text-amber-400" : "text-sky-600 dark:text-sky-400 font-semibold"
                                                )}>
                                                    {sOut}
                                                </span>
                                            </div>

                                            
                                        </div>

                                        {/* Right: Duration, Status Badge & Main Action Icon Buttons */}
                                        <div className="flex items-center gap-2 shrink-0">
                                            {/* Duration Pill */}
                                            <div className="text-right">
                                                {isRejected ? (
                                                    <span className="text-[11px] font-bold">
                                                        <span className="line-through text-muted-foreground text-[10px] mr-1">{sDuration}</span>
                                                        <span className="text-rose-600 font-extrabold">0.00h</span>
                                                    </span>
                                                ) : (
                                                    <span className="text-xs font-black text-primary tabular-nums">
                                                        {sDuration}
                                                    </span>
                                                )}
                                            </div>

                                            {/* Status Badge */}
                                            {isRejected ? (
                                                <Badge variant="destructive" className="text-[9px] py-0 px-1.5 h-4.5 font-bold uppercase tracking-tight">
                                                    Rejected
                                                </Badge>
                                            ) : isVerified ? (
                                                <Badge className="bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 text-[9px] py-0 px-1.5 h-4.5 font-bold uppercase tracking-tight">
                                                    Verified
                                                </Badge>
                                            ) : isActive ? (
                                                <Badge className="bg-sky-500/20 text-sky-700 dark:text-sky-300 border-sky-500/30 text-[9px] py-0 px-1.5 h-4.5 font-bold uppercase tracking-tight">
                                                    In Office
                                                </Badge>
                                            ) : (
                                                <Badge variant="secondary" className="text-[9px] py-0 px-1.5 h-4.5 font-semibold uppercase tracking-tight">
                                                    Done
                                                </Badge>
                                            )}

                                            {/* Action Icon Buttons (Same as Main Table Row) */}
                                            {!isEditing ? (
                                                <TooltipProvider>
                                                    <div className="flex items-center gap-1 pl-1 border-l border-slate-200 dark:border-slate-800">
                                                        {/* Verify / Unverify Toggle Button */}
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <ActionButton
                                                                    action={isVerified ? "deactivate" : "activate"}
                                                                    icon={isVerified ? UserX : UserCheck}
                                                                    variant="icon-only"
                                                                    size="sm"
                                                                    onClick={() => handleToggleVerify(sess.id)}
                                                                    className={cn(
                                                                        "h-7 w-7 transition-colors",
                                                                        isVerified
                                                                            ? "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-300 dark:border-rose-800/80 hover:bg-rose-500/25 hover:border-rose-400 hover:text-rose-700 shadow-xs"
                                                                            : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-300/80 dark:border-emerald-800/80 hover:bg-emerald-500/20 hover:border-emerald-400 shadow-xs"
                                                                    )}
                                                                />
                                                            </TooltipTrigger>
                                                            <TooltipContent>
                                                                {isVerified ? "Mark Unverified" : "Approve & Verify"}
                                                            </TooltipContent>
                                                        </Tooltip>


                                                        {/* Reject Button */}
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <ActionButton
                                                                    action="reject"
                                                                    variant="icon-only"
                                                                    size="sm"
                                                                    onClick={() => handleToggleReject(sess.id)}
                                                                    className={cn(
                                                                        "h-7 w-7",
                                                                        isRejected && "bg-rose-500/20 text-rose-700 dark:text-rose-300 border-rose-500/40"
                                                                    )}
                                                                />
                                                            </TooltipTrigger>
                                                            <TooltipContent>
                                                                {isRejected ? "Un-reject (Restore Duration)" : "Reject (Exclude Duration)"}
                                                            </TooltipContent>
                                                        </Tooltip>

                                                        {/* Edit Button -> Expands Accordion */}
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <EditButton
                                                                    variant="icon-only"
                                                                    size="sm"
                                                                    onClick={() => handleStartInlineEdit(sess)}
                                                                    className="h-7 w-7"
                                                                />
                                                            </TooltipTrigger>
                                                            <TooltipContent>Edit Time & Reason</TooltipContent>
                                                        </Tooltip>
                                                    </div>
                                                </TooltipProvider>
                                            ) : (
                                                /* When editing, outer buttons are hidden, showing Active Editing badge */
                                                <span className="text-[10px] font-bold text-primary animate-pulse pl-1.5 uppercase">
                                                    Editing...
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Remarks row on its own line - displays full remark text without truncate */}
                                    {sess.remarks && !isEditing && (
                                        <div className="px-3 pb-2 pt-0 flex items-start gap-1 text-[10px] text-muted-foreground italic leading-tight">
                                            <span className="not-italic font-semibold text-slate-500 dark:text-slate-400 shrink-0">Remark:</span>
                                            <span className="break-words">{sess.remarks}</span>
                                        </div>
                                    )}

                                    {/* Inline Accordion Expandable Editor */}
                                    <AnimatePresence>
                                        {isEditing && (
                                            <motion.div
                                                initial={{ opacity: 0, height: 0 }}
                                                animate={{ opacity: 1, height: "auto" }}
                                                exit={{ opacity: 0, height: 0 }}
                                                transition={{ duration: 0.2 }}
                                                className="border-t border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-950/90 px-4 py-3.5 space-y-3"
                                            >
                                                {/* Row 1: Time Pickers & Live Duration Preview */}
                                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 items-end">
                                                    <div className="space-y-1">
                                                        <Label className="text-[11px] font-bold uppercase text-muted-foreground flex items-center gap-1">
                                                            <LogIn className="w-3 h-3 text-emerald-600" />
                                                            Check-In Time
                                                        </Label>
                                                        <Input
                                                            type="time"
                                                            step="1"
                                                            value={inlineEditForm.checkInTime}
                                                            onChange={(e) =>
                                                                setInlineEditForm((prev) => ({
                                                                    ...prev,
                                                                    checkInTime: e.target.value,
                                                                }))
                                                            }
                                                            className="h-8 text-xs font-bold"
                                                        />
                                                    </div>

                                                    <div className="space-y-1">
                                                        <Label className="text-[11px] font-bold uppercase text-muted-foreground flex items-center gap-1">
                                                            <LogOut className="w-3 h-3 text-amber-600" />
                                                            Check-Out Time
                                                        </Label>
                                                        <Input
                                                            type="time"
                                                            step="1"
                                                            value={inlineEditForm.checkOutTime}
                                                            onChange={(e) =>
                                                                setInlineEditForm((prev) => ({
                                                                    ...prev,
                                                                    checkOutTime: e.target.value,
                                                                }))
                                                            }
                                                            className="h-8 text-xs font-bold"
                                                            placeholder="Leave empty if active"
                                                        />
                                                    </div>

                                                    <div className="space-y-1">
                                                        <Label className="text-[11px] font-bold uppercase text-muted-foreground">
                                                            Live Duration Preview
                                                        </Label>
                                                        <div className={cn(
                                                            "h-8 px-2.5 rounded-lg border flex items-center justify-center text-xs font-black",
                                                            liveSessionDuration === "INVALID_TIME"
                                                                ? "bg-rose-500/10 border-rose-500/30 text-rose-600"
                                                                : "bg-primary/5 border-primary/20 text-primary"
                                                        )}>
                                                            {liveSessionDuration === "INVALID_TIME"
                                                                ? "Error: Out < In"
                                                                : liveSessionDuration || "--"}
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Row 2: Reason / Remarks & Quick Presets */}
                                                <div className="space-y-1.5 pt-1">
                                                    <div className="flex items-center justify-between">
                                                        <Label className="text-[11px] font-bold uppercase text-muted-foreground">
                                                            Reason / Audit Remark
                                                        </Label>
                                                        <span className="text-[10px] text-muted-foreground">
                                                            Quick Presets:
                                                        </span>
                                                    </div>

                                                    {/* Quick Preset Buttons */}
                                                    <div className="flex flex-wrap gap-1">
                                                        {[
                                                            "Duplicate punch",
                                                            "Biometric time lag",
                                                            "Manager sign-off",
                                                            "Client meeting",
                                                        ].map((preset) => (
                                                            <button
                                                                key={preset}
                                                                type="button"
                                                                onClick={() =>
                                                                    setInlineEditForm((prev) => ({
                                                                        ...prev,
                                                                        remarks: preset,
                                                                    }))
                                                                }
                                                                className={cn(
                                                                    "text-[10px] px-2 py-0.5 rounded-md border transition-all",
                                                                    inlineEditForm.remarks === preset
                                                                        ? "bg-primary/15 border-primary/40 text-primary font-bold"
                                                                        : "bg-slate-100 dark:bg-slate-800 text-muted-foreground hover:bg-slate-200"
                                                                )}
                                                            >
                                                                {preset}
                                                            </button>
                                                        ))}
                                                    </div>

                                                    <Input
                                                        placeholder="Type reason or adjustment note..."
                                                        value={inlineEditForm.remarks}
                                                        onChange={(e) =>
                                                            setInlineEditForm((prev) => ({
                                                                ...prev,
                                                                remarks: e.target.value,
                                                            }))
                                                        }
                                                        className="h-8 text-xs"
                                                    />
                                                </div>

                                                {/* Expanded Row Action Buttons: Cancel and Done */}
                                                <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800/60 flex items-center justify-between">
                                                    <span className="text-[10px] text-muted-foreground italic">
                                                        Click Done to apply to draft row
                                                    </span>

                                                    <div className="flex items-center gap-1.5">
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            className="h-7 px-3 text-xs"
                                                            onClick={handleCancelInlineEdit}
                                                        >
                                                            Cancel
                                                        </Button>

                                                        <Button
                                                            size="sm"
                                                            className="h-7 px-3 text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs flex items-center gap-1"
                                                            disabled={liveSessionDuration === "INVALID_TIME"}
                                                            onClick={() => handleDoneInlineEdit(sess.id)}
                                                        >
                                                            <Check className="w-3.5 h-3.5" />
                                                            Done
                                                        </Button>
                                                    </div>
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            )
                        })
                    ) : (
                        <div className="py-8 text-center text-muted-foreground">
                            <AlertCircle className="w-8 h-8 mx-auto mb-2 text-muted-foreground/40" />
                            <p className="text-xs font-medium">No recorded punch sessions for this date.</p>
                        </div>
                    )}
                </div>

                {/* Footer - Fixed Bottom with Master Save */}
                <div className="shrink-0 px-5 py-3 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-900/60 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        {unverifiedCount > 0 && (
                            <Button
                                size="sm"
                                variant="outline"
                                className="h-8 px-2.5 text-xs font-bold border-emerald-500/40 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10 flex items-center gap-1"
                                onClick={handleVerifyAllDraft}
                            >
                                <CheckCheck className="w-3.5 h-3.5" />
                                Verify All ({unverifiedCount})
                            </Button>
                        )}
                        <span className="text-[11px] text-muted-foreground hidden sm:inline-block">
                            {hasUnsavedChanges ? (
                                <strong className="text-amber-600">Pending Save</strong>
                            ) : (
                                "All sessions in sync"
                            )}
                        </span>
                    </div>

                    <div className="flex items-center gap-2">
                        <Button
                            size="sm"
                            variant="secondary"
                            className="h-8 px-3 text-xs font-medium"
                            onClick={() => onOpenChange(false)}
                            disabled={batchUpdateMutation.isPending}
                        >
                            Close
                        </Button>

                        <Button
                            size="sm"
                            className="h-8 px-4 text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm flex items-center gap-1.5"
                            onClick={handleSaveAll}
                            disabled={!hasUnsavedChanges || batchUpdateMutation.isPending}
                        >
                            {batchUpdateMutation.isPending ? (
                                <>
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    Saving...
                                </>
                            ) : (
                                <>
                                    <Save className="w-3.5 h-3.5" />
                                    Save Changes
                                </>
                            )}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
