"use client"

import React, { useState, useEffect, useMemo } from "react"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog"
import {
    Sheet,
    SheetContent,
    SheetTitle,
    SheetDescription,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import {
    Clock,
    Calendar,
    X,
    Layers,
    FileText,
    CheckCircle2,
    UserCheck,
    UserX,
    MessageSquare,
    Save,
    CheckCheck,
    Check,
    LogIn,
    LogOut,
    AlertCircle,
    Info,
    CalendarDays,
    Loader2,
    Edit2,
} from "lucide-react"
import { format, isValid, differenceInMinutes } from "date-fns"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"
import { ActionButton, EditButton } from "@/components/ui/action-button"
import { UserAvatarProfile } from "@/components/user-avatar-profile"
import { trpc } from "@/lib/trpc/client"
import { toast } from "sonner"

interface AttendanceSessionsDrawerProps {
    isOpen: boolean
    onOpenChange: (open: boolean) => void
    record: any | null
    onSessionUpdated?: () => void
}

export function AttendanceSessionsDrawer({
    isOpen,
    onOpenChange,
    record,
    onSessionUpdated,
}: AttendanceSessionsDrawerProps) {
    const utils = trpc.useUtils()

    // Working local draft state of sessions
    const [draftSessions, setDraftSessions] = useState<any[]>([])

    // Active accordion inline-expanded session id
    const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null)

    // Themed confirmation modal state for open sessions without check-out
    const [confirmAutoOutModal, setConfirmAutoOutModal] = useState<{
        isOpen: boolean
        sessionNumbers: string
        currentTimeFormatted: string
        onConfirm: () => void
    }>({
        isOpen: false,
        sessionNumbers: "",
        currentTimeFormatted: "",
        onConfirm: () => {},
    })

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

    // Calculate real-time live total credited hours from draft sessions with seconds precision
    const liveCreditedHours = useMemo(() => {
        const valid = draftSessions.filter((s) => s.status !== "rejected")
        const totalSeconds = valid.reduce((acc, sess) => {
            if (sess.check_in && sess.check_out) {
                const inD = new Date(sess.check_in)
                const outD = new Date(sess.check_out)
                if (isValid(inD) && isValid(outD)) {
                    return acc + Math.max(0, (outD.getTime() - inD.getTime()) / 1000)
                }
            }
            return acc + (sess.working_hours ? Number(sess.working_hours) * 3600 : 0)
        }, 0)
        return (totalSeconds / 3600).toFixed(2)
    }, [draftSessions])

    // Break down sessions into Completed and Open for KPI cards
    const completedSessionsCount = useMemo(() => {
        return draftSessions.filter((s) => s.check_out && s.status !== "rejected").length
    }, [draftSessions])

    const openSessionsCount = useMemo(() => {
        return draftSessions.filter((s) => !s.check_out && s.status !== "rejected").length
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

        const diffSecs = Math.max(0, (outDate.getTime() - inDate.getTime()) / 1000)
        const diffHours = (diffSecs / 3600).toFixed(2)
        const mins = Math.floor(diffSecs / 60)
        const secs = Math.round(diffSecs % 60)
        return `${diffHours} hrs (${mins}m ${secs}s)`
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
            const diffSecs = Math.max(0, (outDate.getTime() - inDate.getTime()) / 1000)
            workingHours = (diffSecs / 3600).toFixed(2)
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

    // Toggle Verify in local draft with open session check
    const handleToggleVerify = (sessionId: string) => {
        const targetSession = draftSessions.find((s) => s.id === sessionId)
        if (!targetSession) return

        const isCurrentlyVerified = targetSession.status === "verified"

        // If un-verifying: toggle back to completed (or active if no check_out)
        if (isCurrentlyVerified) {
            setDraftSessions((prev) =>
                prev.map((s) => {
                    if (s.id !== sessionId) return s
                    return {
                        ...s,
                        status: s.check_out ? "completed" : "active",
                        _isModified: true,
                    }
                })
            )
            return
        }

        // If verifying a session that has NO check_out:
        if (!targetSession.check_out) {
            const now = new Date()
            const timeFormatted = format(now, "hh:mm:ss a")
            setConfirmAutoOutModal({
                isOpen: true,
                sessionNumbers: `Session #${targetSession.session_number || ""}`,
                currentTimeFormatted: timeFormatted,
                onConfirm: () => {
                    const inDate = new Date(targetSession.check_in)
                    const diffSecs = Math.max(0, (now.getTime() - inDate.getTime()) / 1000)
                    const workingHours = (diffSecs / 3600).toFixed(2)
                    const remarkText = targetSession.remarks
                        ? `${targetSession.remarks} | Auto punch-out at ${timeFormatted} (Admin Verified)`
                        : `Auto punch-out at ${timeFormatted} (Admin Verified)`

                    setDraftSessions((prev) =>
                        prev.map((s) => {
                            if (s.id !== sessionId) return s
                            return {
                                ...s,
                                check_out: now.toISOString(),
                                working_hours: workingHours,
                                remarks: remarkText,
                                status: "verified",
                                _isModified: true,
                            }
                        })
                    )
                    toast.success(`Session #${targetSession.session_number} punch-out recorded at ${timeFormatted} & marked verified.`)
                },
            })
            return
        }

        // Standard session with existing check_out
        setDraftSessions((prev) =>
            prev.map((s) => {
                if (s.id !== sessionId) return s
                return {
                    ...s,
                    status: "verified",
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

    // Unified One-Click Verify All & Save directly to database
    const handleVerifyAllAndSave = () => {
        if (!record?.id) return

        let updatedDraft = [...draftSessions]
        const openSessions = updatedDraft.filter((s) => !s.check_out && s.status !== "rejected")

        // If there are open sessions without check-out, prompt themed confirmation modal
        if (openSessions.length > 0) {
            const now = new Date()
            const timeFormatted = format(now, "hh:mm:ss a")
            const sessionNumbers = openSessions.map((s) => `#${s.session_number || ""}`).join(", ")

            setConfirmAutoOutModal({
                isOpen: true,
                sessionNumbers: `Session ${sessionNumbers}`,
                currentTimeFormatted: timeFormatted,
                onConfirm: () => {
                    // Auto-close open sessions with current time
                    const closedDraft = updatedDraft.map((s) => {
                        if (!s.check_out && s.status !== "rejected") {
                            const inDate = new Date(s.check_in)
                            const diffSecs = Math.max(0, (now.getTime() - inDate.getTime()) / 1000)
                            const workingHours = (diffSecs / 3600).toFixed(2)
                            const remarkText = s.remarks
                                ? `${s.remarks} | Auto punch-out at ${timeFormatted} (Admin Verified)`
                                : `Auto punch-out at ${timeFormatted} (Admin Verified)`
                            return {
                                ...s,
                                check_out: now.toISOString(),
                                working_hours: workingHours,
                                remarks: remarkText,
                                status: "verified",
                                _isModified: true,
                            }
                        }
                        return s
                    })

                    // Mark all non-rejected as verified
                    const finalSessions = closedDraft.map((s) => {
                        if (s.status === "rejected") return s
                        return {
                            ...s,
                            status: "verified",
                        }
                    })

                    setDraftSessions(finalSessions)

                    // Execute batchUpdateMutation
                    const payloadSessions = finalSessions.map((s) => ({
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
                },
            })
            return
        }

        // If all sessions already have check-out: proceed directly to verify all and save!
        const finalSessions = updatedDraft.map((s) => {
            if (s.status === "rejected") return s
            return {
                ...s,
                status: "verified",
            }
        })

        setDraftSessions(finalSessions)

        const payloadSessions = finalSessions.map((s) => ({
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

    // Save Changes clicked (saves manual draft edits without verifying unverified sessions)
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
    const allValidSessionsAlreadyVerified =
        draftSessions.length > 0 &&
        draftSessions.every((s) => s.status === "verified" || s.status === "rejected")
    const hasOpenSession = draftSessions.some((s) => !s.check_out && s.status !== "rejected")

    return (
        <>
            <Sheet
            open={isOpen}
            onOpenChange={(open) => {
                if (!open && hasUnsavedChanges && !batchUpdateMutation.isPending) {
                    if (confirm("You have unsaved changes in this session. Are you sure you want to discard them?")) {
                        onOpenChange(false)
                    }
                    return
                }
                onOpenChange(open)
            }}
        >
            <SheetContent
                side="right"
                closeClassName="top-4 right-5"
                className="w-full sm:max-w-[560px] md:max-w-[620px] p-0 flex flex-col h-full bg-white dark:bg-slate-950 border-l border-slate-200/90 dark:border-slate-800/90 shadow-2xl z-50 overflow-hidden"
            >
                {/* 1. Header Area - Fixed Top */}
                <div className="shrink-0 px-6 pt-5 pb-4 border-b border-slate-100 dark:border-slate-800/80 bg-white dark:bg-slate-950">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800/60 pr-10">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 ring-1 ring-indigo-500/10">
                                <Clock className="w-5 h-5" />
                            </div>
                            <div>
                                <SheetTitle className="text-base font-semibold text-slate-900 dark:text-slate-100 leading-tight">
                                    Attendance Verification
                                </SheetTitle>
                                <SheetDescription className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5 mt-0.5">
                                    <Calendar className="w-3.5 h-3.5 text-muted-foreground/70" />
                                    {formatSafeDate(record.date)}
                                </SheetDescription>
                            </div>
                        </div>
                    </div>

                    {/* 2. Employee Profile Row */}
                    {employee && (
                        <div className="flex items-center justify-between pt-3.5">
                            <div className="flex items-center gap-3">
                                <UserAvatarProfile
                                    user={employee}
                                    className="h-11 w-11 border border-background shadow-xs shrink-0 rounded-full"
                                />
                                <div className="flex flex-col min-w-0">
                                    <span className="font-semibold text-sm text-foreground leading-tight">
                                        {employee.full_name}
                                    </span>
                                    <div className="flex items-center gap-1.5 mt-1">
                                        {employee.designation?.name && (
                                            <Badge
                                                variant="secondary"
                                                className="text-[9px] h-4 px-1.5 font-bold uppercase tracking-wider bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border-none"
                                            >
                                                {employee.designation.name}
                                            </Badge>
                                        )}
                                        <span className="text-[11px] text-muted-foreground font-medium capitalize">
                                            {employee.role || 'Employee'}
                                        </span>
                                    </div>
                                    <span className="text-[11px] text-muted-foreground font-medium mt-0.5 select-all">
                                        {employee.email}
                                    </span>
                                </div>
                            </div>

                            {/* Right Status Pill & Credited Hours */}
                            <div className="flex flex-col items-end gap-1.5 shrink-0">
                                {isCurrentlyCheckedIn ? (
                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800">
                                        <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block animate-pulse" />
                                        In Office
                                    </span>
                                ) : (
                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/80">
                                        Checked Out
                                    </span>
                                )}
                                <span className="text-xs font-semibold text-muted-foreground">
                                    Credited: <span className="text-indigo-600 dark:text-indigo-400 font-semibold text-xs">{liveCreditedHours} hrs</span>
                                </span>
                            </div>
                        </div>
                    )}

                    {/* 3. Horizontal 4 KPI Cards: TOTAL WORKED, COMPLETED, SESSION OPEN, STATUS */}
                    <div className="mt-3.5 grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {/* 1. Total Worked */}
                        <div className="p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900/60 flex items-center gap-2.5 shadow-2xs">
                            <div className="p-1.5 rounded-lg bg-emerald-100/70 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 shrink-0">
                                <Clock className="w-3.5 h-3.5" />
                            </div>
                            <div className="min-w-0">
                                <span className="text-[9px] uppercase tracking-wider font-semibold text-muted-foreground block leading-tight truncate">
                                    TOTAL WORKED
                                </span>
                                <span className="text-sm font-semibold text-foreground tabular-nums block mt-0.5 truncate">
                                    {liveCreditedHours}h
                                </span>
                            </div>
                        </div>

                        {/* 2. Session Completed */}
                        <div className="p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900/60 flex items-center gap-2.5 shadow-2xs">
                            <div className="p-1.5 rounded-lg bg-purple-100/70 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 shrink-0">
                                <CheckCheck className="w-3.5 h-3.5" />
                            </div>
                            <div className="min-w-0">
                                <span className="text-[9px] uppercase tracking-wider font-semibold text-muted-foreground block leading-tight truncate">
                                    COMPLETED
                                </span>
                                <span className="text-sm font-semibold text-purple-700 dark:text-purple-400 tabular-nums block mt-0.5 truncate">
                                    {completedSessionsCount} Done
                                </span>
                            </div>
                        </div>

                        {/* 3. Session Open */}
                        <div className="p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900/60 flex items-center gap-2.5 shadow-2xs">
                            <div className={cn(
                                "p-1.5 rounded-lg shrink-0",
                                openSessionsCount > 0
                                    ? "bg-sky-100 text-sky-600 dark:bg-sky-950/60 dark:text-sky-400 animate-pulse"
                                    : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                            )}>
                                <LogIn className="w-3.5 h-3.5" />
                            </div>
                            <div className="min-w-0">
                                <span className="text-[9px] uppercase tracking-wider font-semibold text-muted-foreground block leading-tight truncate">
                                    SESSION OPEN
                                </span>
                                <span className={cn(
                                    "text-sm font-semibold tabular-nums block mt-0.5 truncate",
                                    openSessionsCount > 0
                                        ? "text-sky-600 dark:text-sky-400"
                                        : "text-muted-foreground"
                                )}>
                                    {openSessionsCount > 0 ? `${openSessionsCount} Active` : "0 Open"}
                                </span>
                            </div>
                        </div>

                        {/* 4. Status */}
                        <div className="p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900/60 flex items-center gap-2.5 shadow-2xs">
                            <div className="p-1.5 rounded-lg bg-amber-100/70 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 shrink-0">
                                <FileText className="w-3.5 h-3.5" />
                            </div>
                            <div className="min-w-0">
                                <span className="text-[9px] uppercase tracking-wider font-semibold text-muted-foreground block leading-tight truncate">
                                    STATUS
                                </span>
                                <span className="text-sm font-semibold text-foreground capitalize block truncate mt-0.5">
                                    {hasUnsavedChanges ? "Pending" : (record.status || "Pending")}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Rejection Alert Banner */}
                    {hasRejected && (
                        <div className="mt-2.5 p-2 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-800 dark:text-rose-300 text-[11px] flex items-center gap-2 font-medium">
                            <Info className="w-3.5 h-3.5 shrink-0 text-rose-600 dark:text-rose-400" />
                            <span>Rejected session duration is <strong>strictly excluded (0.00 hrs)</strong> from total credited hours.</span>
                        </div>
                    )}
                </div>

                {/* 4. Section Header & Sessions Scrollable Middle */}
                <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4 space-y-3 custom-scrollbar">
                    {/* Section Header */}
                    <div className="flex items-center gap-2 pb-0.5">
                        <div className="p-1 rounded-md bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-400">
                            <CalendarDays className="w-4 h-4" />
                        </div>
                        <span className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                            Today&apos;s Recorded Sessions ({draftSessions.length})
                        </span>
                        {hasUnsavedChanges && (
                            <Badge className="ml-auto bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30 text-[10px] font-bold py-0.5">
                                Pending Save
                            </Badge>
                        )}
                    </div>

                    {/* Session Cards List */}
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
                                        "rounded-2xl border transition-all duration-200 overflow-hidden shadow-xs p-3.5",
                                        isRejected
                                            ? "bg-rose-500/[0.03] border-rose-300/80 dark:border-rose-900/60"
                                            : isVerified
                                            ? "bg-emerald-500/[0.03] border-emerald-300/80 dark:border-emerald-900/60"
                                            : isActive
                                            ? "bg-sky-500/[0.03] border-sky-300/80 dark:border-sky-900/60"
                                            : "bg-slate-50/70 dark:bg-slate-900/40 border-slate-200/80 dark:border-slate-800/80",
                                        isEditing && "ring-2 ring-primary/40 border-primary shadow-sm"
                                    )}
                                >
                                    {/* Main Row: Session Pill, Times, Vertical Line, Duration, Status Badge, Actions */}
                                    <div className="flex items-center justify-between gap-2">
                                        {/* Left Side: Number Pill + Time Range */}
                                        <div className="flex items-center gap-3 min-w-0">
                                            {/* Session Number Pill */}
                                            <span className={cn(
                                                "font-bold text-xs px-2 py-0.5 rounded-lg shrink-0 tracking-tight",
                                                isActive
                                                    ? "bg-sky-100 text-sky-900 dark:bg-sky-950/80 dark:text-sky-300"
                                                    : isRejected
                                                    ? "bg-rose-100 text-rose-900 dark:bg-rose-950/80 dark:text-rose-300"
                                                    : "bg-emerald-100/70 text-emerald-900 dark:bg-emerald-950/80 dark:text-emerald-300"
                                            )}>
                                                #{sess.session_number || idx + 1}
                                            </span>

                                            {/* Times: In -> Out */}
                                            <div className="flex items-center gap-1.5 text-xs font-semibold">
                                                <span className="text-emerald-700 dark:text-emerald-400 font-semibold">
                                                    {sIn}
                                                </span>
                                                <span className="text-muted-foreground/60 text-[11px] font-normal">→</span>
                                                <span className={cn(
                                                    isActive
                                                        ? "text-sky-600 dark:text-sky-400"
                                                        : "text-amber-700 dark:text-amber-400",
                                                    "font-semibold"
                                                )}>
                                                    {sOut}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Right Side: Divider, Duration, Status Badge, 3 Squircle Buttons */}
                                        <div className="flex items-center gap-2.5 shrink-0">
                                            {/* Vertical Separator */}
                                            <div className="h-5 w-[1px] bg-slate-200 dark:bg-slate-800 hidden sm:block" />

                                            {/* Duration Pill */}
                                            <div className="text-right">
                                                {isRejected ? (
                                                    <span className="text-xs font-bold">
                                                        <span className="line-through text-muted-foreground text-[10px] mr-1">{sDuration}</span>
                                                        <span className="text-rose-600 font-normal">0.00h</span>
                                                    </span>
                                                ) : (
                                                    <span className="text-xs font-semibold text-indigo-700 dark:text-indigo-400 tabular-nums">
                                                        {sDuration}
                                                    </span>
                                                )}
                                            </div>

                                            {/* Status Badge */}
                                            {isRejected ? (
                                                <Badge variant="destructive" className="text-[10px] py-0.5 px-2 font-normal uppercase tracking-tight rounded-full">
                                                    Rejected
                                                </Badge>
                                            ) : isVerified ? (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/80 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800">
                                                    <CheckCircle2 className="w-3 h-3 text-emerald-700 dark:text-emerald-400" />
                                                    VERIFIED
                                                </span>
                                            ) : isActive ? (
                                                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium bg-sky-50 text-sky-700 border border-sky-200/80 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800">
                                                    <span className="w-2 h-2 rounded-full bg-sky-500 inline-block animate-pulse" />
                                                    IN OFFICE
                                                </span>
                                            ) : (
                                                <Badge variant="secondary" className="text-[10px] py-0.5 px-2 font-normal uppercase tracking-tight rounded-full">
                                                    Done
                                                </Badge>
                                            )}

                                            {/* 3 Rounded Squircle Action Buttons */}
                                            {!isEditing ? (
                                                <TooltipProvider>
                                                    <div className="flex items-center gap-1">
                                                        {/* Button 1: UserX / UserCheck */}
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <ActionButton
                                                                    action={isVerified ? "deactivate" : "activate"}
                                                                    icon={isVerified ? UserX : UserCheck}
                                                                    variant="icon-only"
                                                                    size="sm"
                                                                    className="h-7 w-7"
                                                                    onClick={() => handleToggleVerify(sess.id)}
                                                                />
                                                            </TooltipTrigger>
                                                            <TooltipContent>
                                                                {isVerified ? "Mark Unverified" : "Approve & Verify"}
                                                            </TooltipContent>
                                                        </Tooltip>

                                                        {/* Button 2: Reject Button */}
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <ActionButton
                                                                    action="reject"
                                                                    variant="icon-only"
                                                                    size="sm"
                                                                    className="h-7 w-7"
                                                                    onClick={() => handleToggleReject(sess.id)}
                                                                />
                                                            </TooltipTrigger>
                                                            <TooltipContent>
                                                                {isRejected ? "Un-reject (Restore Duration)" : "Reject (Exclude Duration)"}
                                                            </TooltipContent>
                                                        </Tooltip>

                                                        {/* Button 3: Edit Button */}
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <EditButton
                                                                    variant="icon-only"
                                                                    size="sm"
                                                                    className="h-7 w-7"
                                                                    onClick={() => handleStartInlineEdit(sess)}
                                                                />
                                                            </TooltipTrigger>
                                                            <TooltipContent>Edit Time & Reason</TooltipContent>
                                                        </Tooltip>
                                                    </div>
                                                </TooltipProvider>
                                            ) : (
                                                <span className="text-[10px] font-bold text-primary animate-pulse pl-1.5 uppercase">
                                                    Editing...
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Remark Row with Speech Bubble Icon */}
                                    {sess.remarks && !isEditing && (
                                        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground italic leading-tight mt-1.5 ml-10">
                                            <MessageSquare className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0" />
                                            <span className="font-medium text-slate-500 dark:text-slate-400 not-italic">Remark:</span>
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
                                                className="border-t border-slate-200/80 dark:border-slate-800 bg-white/95 dark:bg-slate-950/95 px-3.5 py-3 space-y-2.5 mt-2.5 rounded-xl"
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
                                                            "h-8 px-2.5 rounded-lg border flex items-center justify-center text-xs font-semibold",
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
                                                                    "text-[10px] px-2 py-0.5 rounded-md border transition-all cursor-pointer",
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
                        <div className="py-12 text-center text-muted-foreground">
                            <AlertCircle className="w-8 h-8 mx-auto mb-2 text-muted-foreground/40" />
                            <p className="text-xs font-medium">No recorded punch sessions for this date.</p>
                        </div>
                    )}
                </div>

                {/* 5. Bottom Action Footer Bar: One-Click Verify All & Save */}
                <div className="shrink-0 px-6 py-3.5 border-t border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-950 flex items-center justify-between gap-3 shadow-sm">
                    {/* Left: Sync / Status Indicator */}
                    <div className="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-400">
                        <span className={cn(
                            "w-2 h-2 rounded-full inline-block",
                            hasUnsavedChanges || unverifiedCount > 0
                                ? "bg-amber-500 animate-pulse"
                                : "bg-emerald-500"
                        )} />
                        {hasUnsavedChanges ? (
                            <span className="text-amber-600 dark:text-amber-400 font-semibold">Pending Save</span>
                        ) : unverifiedCount > 0 ? (
                            <span>{unverifiedCount} session(s) pending verify</span>
                        ) : (
                            <span className="text-emerald-700 dark:text-emerald-400 font-semibold">All sessions verified</span>
                        )}
                    </div>

                    {/* Right: Close, optional Save Draft, and Primary One-Click Verify All */}
                    <div className="flex items-center gap-2">
                        <Button
                            size="sm"
                            variant="secondary"
                            className="h-9 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs cursor-pointer transition-colors"
                            onClick={() => onOpenChange(false)}
                            disabled={batchUpdateMutation.isPending}
                        >
                            Close
                        </Button>

                        {/* Optional Save Draft if user only edited notes/times without verifying */}
                        {hasUnsavedChanges && unverifiedCount > 0 && (
                            <Button
                                size="sm"
                                variant="outline"
                                className="h-9 px-3.5 rounded-xl border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                                onClick={handleSaveAll}
                                disabled={batchUpdateMutation.isPending}
                            >
                                <Save className="w-3.5 h-3.5 mr-1" />
                                Save Draft
                            </Button>
                        )}

                        {/* Primary One-Click Button: Verify All & Save directly to Database */}
                        <Button
                            size="sm"
                            className={cn(
                                "h-9 px-5 rounded-xl font-bold text-xs shadow-md flex items-center gap-1.5 cursor-pointer transition-all",
                                allValidSessionsAlreadyVerified && !hasUnsavedChanges && !hasOpenSession
                                    ? "bg-slate-100 dark:bg-slate-800 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 cursor-default shadow-none"
                                    : "bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-emerald-500/20"
                            )}
                            onClick={handleVerifyAllAndSave}
                            disabled={batchUpdateMutation.isPending || (allValidSessionsAlreadyVerified && !hasUnsavedChanges && !hasOpenSession)}
                        >
                            {batchUpdateMutation.isPending ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Verifying & Saving...
                                </>
                            ) : allValidSessionsAlreadyVerified && !hasUnsavedChanges && !hasOpenSession ? (
                                <>
                                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                    All Verified
                                </>
                            ) : (
                                <>
                                    <CheckCheck className="w-4 h-4 stroke-[2.5]" />
                                    Verify All {unverifiedCount > 0 ? `(${unverifiedCount})` : ""}
                                </>
                            )}
                        </Button>
                    </div>
                </div>
            </SheetContent>
        </Sheet>

        {/* Themed Confirmation Modal for Auto Punch-Out */}
        <Dialog
            open={confirmAutoOutModal.isOpen}
            onOpenChange={(open) => {
                if (!open) {
                    setConfirmAutoOutModal((prev) => ({ ...prev, isOpen: false }))
                }
            }}
        >
            <DialogContent className="max-w-[460px] w-[95vw] sm:w-full p-0 overflow-hidden rounded-2xl shadow-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-950">
                <DialogHeader className="shrink-0 px-6 pt-5 pb-3 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/30">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 ring-1 ring-amber-500/20 shrink-0">
                            <LogOut className="w-5 h-5" />
                        </div>
                        <div>
                            <DialogTitle className="text-base font-bold text-slate-900 dark:text-slate-100 leading-tight">
                                Auto Punch-Out Confirmation
                            </DialogTitle>
                            <DialogDescription className="text-xs font-medium text-muted-foreground mt-0.5">
                                Session has no recorded checkout time
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <div className="px-6 py-4 space-y-3.5 text-xs">
                    <p className="text-slate-600 dark:text-slate-300 leading-relaxed font-normal">
                        <strong className="text-slate-900 dark:text-slate-100 font-bold">{confirmAutoOutModal.sessionNumbers}</strong> is currently open with no punch-out time (<span className="text-sky-600 dark:text-sky-400 font-semibold">In Office</span>).
                    </p>

                    <div className="p-3.5 rounded-xl border border-amber-200/80 dark:border-amber-900/50 bg-amber-500/5 space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="text-muted-foreground font-medium text-[11px]">Proposed Punch-Out Time:</span>
                            <span className="font-bold text-amber-700 dark:text-amber-400 font-mono text-[13px]">
                                {confirmAutoOutModal.currentTimeFormatted}
                            </span>
                        </div>
                        <div className="flex items-center justify-between pt-1 border-t border-amber-200/40 dark:border-amber-900/40">
                            <span className="text-muted-foreground font-medium text-[11px]">Verification Action:</span>
                            <span className="font-bold text-emerald-700 dark:text-emerald-400">
                                Auto-close & Mark Verified
                            </span>
                        </div>
                    </div>

                    <p className="text-[11px] text-muted-foreground leading-normal">
                        Setting the checkout time will calculate the exact duration up to this moment and record an audit note on the session.
                    </p>
                </div>

                <DialogFooter className="px-6 py-3.5 bg-slate-50/80 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-end gap-2">
                    <Button
                        size="sm"
                        variant="secondary"
                        className="h-8 px-4 text-xs font-semibold rounded-lg cursor-pointer"
                        onClick={() => setConfirmAutoOutModal((prev) => ({ ...prev, isOpen: false }))}
                    >
                        Cancel
                    </Button>

                    <Button
                        size="sm"
                        className="h-8 px-4 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm flex items-center gap-1.5 cursor-pointer"
                        onClick={() => {
                            const cb = confirmAutoOutModal.onConfirm
                            setConfirmAutoOutModal((prev) => ({ ...prev, isOpen: false }))
                            cb()
                        }}
                    >
                        <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                        Confirm & Auto Punch-Out
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
        </>
    )
}
