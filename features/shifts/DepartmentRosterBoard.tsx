"use client"

import { useState, useMemo } from 'react'
import { trpc } from '@/lib/trpc/client'
import { CardShell } from '@/features/attendance/CardShell'
import {
    Calendar as CalendarIcon, Clock, Users, UserX, PlusCircle,
    ChevronLeft, ChevronRight, AlertTriangle, CheckCircle, ShieldAlert,
    Building2, Moon, Sparkles, FileText
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

export default function DepartmentRosterBoard() {
    // Current date state (defaults to Monday of current week)
    const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => {
        const d = new Date()
        const day = d.getDay()
        const diff = d.getDate() - day + (day === 0 ? -6 : 1) // adjust when day is sunday
        d.setDate(diff)
        d.setHours(0, 0, 0, 0)
        return d
    })

    const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>('')

    // Action dialog states
    const [allotModal, setAllotModal] = useState<{
        open: boolean
        userId: string
        userName: string
        date: string
        currentShiftId?: string | null
    }>({ open: false, userId: '', userName: '', date: '' })

    const [absentModal, setAbsentModal] = useState<{
        open: boolean
        userId: string
        userName: string
        date: string
    }>({ open: false, userId: '', userName: '', date: '' })

    const [extraShiftModal, setExtraShiftModal] = useState<{
        open: boolean
        userId: string
        userName: string
        date: string
    }>({ open: false, userId: '', userName: '', date: '' })

    const [leaveModal, setLeaveModal] = useState<{
        open: boolean
        userId: string
        userName: string
        date: string
    }>({ open: false, userId: '', userName: '', date: '' })

    // Form inputs for modals
    const [modalShiftId, setModalShiftId] = useState<string>('')
    const [modalNotes, setModalNotes] = useState<string>('')
    const [modalLeaveType, setModalLeaveType] = useState<string>('casual')
    const [modalLeaveReason, setModalLeaveReason] = useState<string>('')
    const [modalExtraShiftType, setModalExtraShiftType] = useState<'full' | 'half'>('full')

    const utils = trpc.useUtils()

    // Week dates calculation (7 days: Mon -> Sun)
    const weekDates = useMemo(() => {
        const dates: { dateStr: string; displayDay: string; displayDate: string; isToday: boolean }[] = []
        const todayStr = new Date().toISOString().split('T')[0]

        for (let i = 0; i < 7; i++) {
            const d = new Date(currentWeekStart)
            d.setDate(d.getDate() + i)
            const dateStr = d.toISOString().split('T')[0]
            const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
            dates.push({
                dateStr,
                displayDay: dayNames[d.getDay()],
                displayDate: `${d.getDate()} ${d.toLocaleString('default', { month: 'short' })}`,
                isToday: dateStr === todayStr,
            })
        }
        return dates
    }, [currentWeekStart])

    const startDateStr = weekDates[0].dateStr
    const endDateStr = weekDates[6].dateStr

    // Fetch user's managed department if any
    const { data: myDept } = trpc.departments.getMyManagedDepartment.useQuery()

    // Fetch all departments
    const { data: allDepts } = trpc.departments.getAll.useQuery()

    // Effective department ID
    const effectiveDeptId = useMemo(() => {
        if (selectedDepartmentId) return selectedDepartmentId
        if (myDept) return myDept.id
        if (allDepts && allDepts.length > 0) return allDepts[0].id
        return ''
    }, [selectedDepartmentId, myDept, allDepts])

    // Fetch roster grid
    const { data: rosterGrid, isLoading: rosterLoading } = trpc.shifts.getDepartmentRosterGrid.useQuery(
        {
            departmentId: effectiveDeptId,
            startDate: startDateStr,
            endDate: endDateStr,
        },
        { enabled: !!effectiveDeptId }
    )

    // Fetch shifts for dropdown
    const { data: shifts } = trpc.shifts.getShifts.useQuery()

    const members = useMemo(() => {
        if (!rosterGrid?.staff) return []
        return rosterGrid.staff.map(s => ({
            id: s.id,
            name: s.full_name || 'Unnamed Staff',
            designation: s.designation?.name || 'Staff'
        }))
    }, [rosterGrid])

    const rosterMap = useMemo(() => {
        if (!rosterGrid?.rosters) return {}
        const map: Record<string, Record<string, any>> = {}
        for (const r of rosterGrid.rosters) {
            if (!map[r.profile_id]) map[r.profile_id] = {}
            map[r.profile_id][r.date] = {
                shift: r.shift,
                status: r.status,
                isExtraShift: r.is_extra_shift,
                extraShiftType: (r as any).extra_shift_type,
                notes: r.notes,
            }
        }
        return map
    }, [rosterGrid])

    // Mutations
    const allotMutation = trpc.shifts.allotRoster.useMutation({
        onSuccess: () => {
            toast.success("Shift successfully allotted")
            utils.shifts.getDepartmentRosterGrid.invalidate()
            setAllotModal({ open: false, userId: '', userName: '', date: '' })
        },
        onError: (err) => toast.error(err.message || "Failed to allot shift")
    })

    const markAbsentMutation = trpc.shifts.markRosterAbsent.useMutation({
        onSuccess: () => {
            toast.success("Staff marked as Urgent Absent")
            utils.shifts.getDepartmentRosterGrid.invalidate()
            setAbsentModal({ open: false, userId: '', userName: '', date: '' })
        },
        onError: (err) => toast.error(err.message || "Failed to mark absent")
    })

    const callExtraMutation = trpc.shifts.callInExtraShift.useMutation({
        onSuccess: () => {
            toast.success("Staff successfully scheduled for Extra Shift!")
            utils.shifts.getDepartmentRosterGrid.invalidate()
            setExtraShiftModal({ open: false, userId: '', userName: '', date: '' })
        },
        onError: (err) => toast.error(err.message || "Failed to call in extra shift")
    })

    const applyLeaveMutation = trpc.attendance.applyLeave.useMutation({
        onSuccess: () => {
            toast.success("Leave successfully applied and approved on behalf of staff!")
            utils.shifts.getDepartmentRosterGrid.invalidate()
            setLeaveModal({ open: false, userId: '', userName: '', date: '' })
        },
        onError: (err) => toast.error(err.message || "Failed to apply leave")
    })

    // Week navigation
    const prevWeek = () => {
        const d = new Date(currentWeekStart)
        d.setDate(d.getDate() - 7)
        setCurrentWeekStart(d)
    }

    const nextWeek = () => {
        const d = new Date(currentWeekStart)
        d.setDate(d.getDate() + 7)
        setCurrentWeekStart(d)
    }

    const thisWeek = () => {
        const d = new Date()
        const day = d.getDay()
        const diff = d.getDate() - day + (day === 0 ? -6 : 1)
        d.setDate(diff)
        d.setHours(0, 0, 0, 0)
        setCurrentWeekStart(d)
    }

    // Modal submit handlers
    const handleAllotSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (!modalShiftId) {
            toast.error("Please select a shift")
            return
        }
        allotMutation.mutate({
            profileIds: [allotModal.userId],
            shiftId: modalShiftId,
            startDate: allotModal.date,
            endDate: allotModal.date,
            notes: modalNotes.trim() || undefined,
        })
    }

    const handleAbsentSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        markAbsentMutation.mutate({
            profileId: absentModal.userId,
            date: absentModal.date,
            reason: modalNotes.trim() || undefined,
        })
    }

    const handleExtraSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (!modalShiftId) {
            toast.error("Please select the extra shift")
            return
        }
        callExtraMutation.mutate({
            profileId: extraShiftModal.userId,
            shiftId: modalShiftId,
            date: extraShiftModal.date,
            extraShiftType: modalExtraShiftType,
            reason: modalNotes.trim() || undefined,
        })
    }

    const handleLeaveSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        applyLeaveMutation.mutate({
            profileId: leaveModal.userId,
            leaveType: modalLeaveType as any,
            startDate: leaveModal.date,
            endDate: leaveModal.date,
            reason: modalLeaveReason.trim() || `Applied by Department Manager`,
        })
    }

    return (
        <div className="space-y-6">
            {/* Top Bar: Dept Switcher & Week Navigator */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <Building2 className="h-5 w-5 text-primary" />
                    <Select
                        value={effectiveDeptId}
                        onValueChange={setSelectedDepartmentId}
                    >
                        <SelectTrigger className="w-[220px] font-semibold bg-white dark:bg-zinc-900">
                            <SelectValue placeholder="Select Department" />
                        </SelectTrigger>
                        <SelectContent>
                            {allDepts?.map((dept) => (
                                <SelectItem key={dept.id} value={dept.id}>
                                    {dept.name} {dept.manager_id ? `(${dept.manager_name || 'Manager'})` : ''}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={prevWeek} className="h-8 w-8 p-0">
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={thisWeek} className="h-8 text-xs font-medium">
                        Current Week
                    </Button>
                    <Button variant="outline" size="sm" onClick={nextWeek} className="h-8 w-8 p-0">
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 ml-2">
                        {weekDates[0].displayDate} - {weekDates[6].displayDate}
                    </span>
                </div>
            </div>

            {/* Department Roster Board */}
            <CardShell
                title="Department Weekly Duty & Shift Roster"
                description="Manage daily shift assignments, mark sudden absences, call in staff for extra shift duty, or apply leave on behalf of staff."
                icon={CalendarIcon}
                contentClassName="p-0 overflow-x-auto"
            >
                <table className="w-full text-sm text-left border-collapse min-w-[900px]">
                    <thead>
                        <tr className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 text-[11px] uppercase tracking-wider text-slate-600 dark:text-slate-400">
                            <th className="p-3 w-[220px] sticky left-0 bg-slate-50 dark:bg-slate-900 z-10 border-r border-slate-200 dark:border-slate-800">
                                Staff Member
                            </th>
                            {weekDates.map((w) => (
                                <th
                                    key={w.dateStr}
                                    className={cn(
                                        "p-3 text-center border-r border-slate-200 dark:border-slate-800 last:border-r-0",
                                        w.isToday && "bg-primary/5 text-primary font-bold"
                                    )}
                                >
                                    <div>{w.displayDay}</div>
                                    <div className="font-semibold text-xs mt-0.5">{w.displayDate}</div>
                                </th>
                            ))}
                        </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {rosterLoading ? (
                            <tr>
                                <td colSpan={8} className="p-12 text-center text-muted-foreground">
                                    Loading department staff & roster schedules...
                                </td>
                            </tr>
                        ) : !members || members.length === 0 ? (
                            <tr>
                                <td colSpan={8} className="p-12 text-center text-muted-foreground">
                                    No staff members found in this department. Assign employees to this department in User Management.
                                </td>
                            </tr>
                        ) : (
                            members.map((member) => (
                                <tr key={member.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                                    {/* Member info */}
                                    <td className="p-3 sticky left-0 bg-white dark:bg-zinc-900 z-10 border-r border-slate-200 dark:border-slate-800">
                                        <div className="font-semibold text-slate-900 dark:text-white text-xs">
                                            {member.name}
                                        </div>
                                        <div className="text-[11px] text-muted-foreground">
                                            {member.designation || 'Staff'}
                                        </div>
                                    </td>

                                    {/* 7 Days Cells */}
                                    {weekDates.map((w) => {
                                        const dateRoster = rosterMap[member.id]?.[w.dateStr]
                                        const shift = dateRoster?.shift
                                        const status = dateRoster?.status || 'scheduled'
                                        const isExtra = dateRoster?.isExtraShift

                                        return (
                                            <td
                                                key={w.dateStr}
                                                className={cn(
                                                    "p-2 text-center border-r border-slate-200 dark:border-slate-800 last:border-r-0 align-top",
                                                    w.isToday && "bg-primary/[0.02]"
                                                )}
                                            >
                                                {status === 'absent' ? (
                                                    <div className="p-2 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300">
                                                        <div className="flex items-center justify-center gap-1 text-[11px] font-bold uppercase">
                                                            <UserX className="h-3 w-3" />
                                                            Absent
                                                        </div>
                                                        <p className="text-[10px] text-rose-600 dark:text-rose-400 mt-0.5 truncate">
                                                            {dateRoster?.notes || 'Urgent'}
                                                        </p>
                                                    </div>
                                                ) : status === 'on_leave' ? (
                                                    <div className="p-2 rounded-lg bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-900/60 text-purple-700 dark:text-purple-300">
                                                        <div className="flex items-center justify-center gap-1 text-[11px] font-bold uppercase">
                                                            <FileText className="h-3 w-3" />
                                                            On Leave
                                                        </div>
                                                        <p className="text-[10px] text-purple-600 dark:text-purple-400 mt-0.5 truncate">
                                                            Approved
                                                        </p>
                                                    </div>
                                                ) : shift ? (
                                                    <div className={cn(
                                                        "p-2 rounded-lg border text-left space-y-1 relative group transition-all",
                                                        isExtra
                                                            ? "bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800"
                                                            : shift.is_overnight
                                                                ? "bg-indigo-50/70 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800"
                                                                : "bg-white dark:bg-zinc-800/80 border-slate-200 dark:border-slate-700 shadow-xs"
                                                    )}>
                                                        <div className="flex items-center justify-between">
                                                            <span className="font-bold text-[11px] text-slate-800 dark:text-slate-100 truncate">
                                                                {shift.name}
                                                            </span>
                                                            {isExtra && (
                                                                <Badge className="text-[9px] px-1 py-0 bg-amber-500 text-white font-medium">
                                                                    {dateRoster?.extraShiftType === 'half' ? 'Extra Half' : 'Extra Full'}
                                                                </Badge>
                                                            )}
                                                            {shift.is_overnight && !isExtra && (
                                                                <Moon className="h-3 w-3 text-indigo-500 shrink-0" />
                                                            )}
                                                        </div>

                                                        <div className="text-[10px] text-slate-500 dark:text-slate-400">
                                                            {shift.start_time} - {shift.end_time}
                                                        </div>

                                                        {/* Quick manager action buttons */}
                                                        <div className="pt-1 flex items-center justify-end gap-1 opacity-70 group-hover:opacity-100 transition-opacity">
                                                            <Button
                                                                size="sm"
                                                                variant="ghost"
                                                                className="h-5 px-1 text-[10px] text-primary"
                                                                onClick={() => {
                                                                    setModalShiftId(shift.id)
                                                                    setModalNotes('')
                                                                    setAllotModal({
                                                                        open: true,
                                                                        userId: member.id,
                                                                        userName: member.name,
                                                                        date: w.dateStr,
                                                                        currentShiftId: shift.id,
                                                                    })
                                                                }}
                                                            >
                                                                Swap
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                variant="ghost"
                                                                className="h-5 px-1 text-[10px] text-rose-600 hover:text-rose-700"
                                                                onClick={() => {
                                                                    setModalNotes('')
                                                                    setAbsentModal({
                                                                        open: true,
                                                                        userId: member.id,
                                                                        userName: member.name,
                                                                        date: w.dateStr,
                                                                    })
                                                                }}
                                                            >
                                                                Absent
                                                            </Button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="p-2 rounded-lg border border-dashed border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 text-center space-y-1">
                                                        <span className="text-[10px] text-muted-foreground">Off Duty</span>
                                                        <div className="flex items-center justify-center gap-1">
                                                            <Button
                                                                size="sm"
                                                                variant="ghost"
                                                                className="h-5 px-1 text-[10px] text-primary hover:bg-primary/10"
                                                                onClick={() => {
                                                                    setModalShiftId(shifts?.[0]?.id || '')
                                                                    setModalNotes('')
                                                                    setAllotModal({
                                                                        open: true,
                                                                        userId: member.id,
                                                                        userName: member.name,
                                                                        date: w.dateStr,
                                                                    })
                                                                }}
                                                            >
                                                                + Allot
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                variant="ghost"
                                                                className="h-5 px-1 text-[10px] text-amber-600 hover:bg-amber-50"
                                                                onClick={() => {
                                                                    setModalShiftId(shifts?.[0]?.id || '')
                                                                    setModalNotes('')
                                                                    setModalExtraShiftType('full')
                                                                    setExtraShiftModal({
                                                                        open: true,
                                                                        userId: member.id,
                                                                        userName: member.name,
                                                                        date: w.dateStr,
                                                                    })
                                                                }}
                                                            >
                                                                Extra
                                                            </Button>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* On-behalf leave trigger */}
                                                <div className="mt-1 flex justify-center">
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        className="h-4 px-1 text-[9px] text-slate-400 hover:text-purple-600"
                                                        onClick={() => {
                                                            setModalLeaveReason('')
                                                            setLeaveModal({
                                                                open: true,
                                                                userId: member.id,
                                                                userName: member.name,
                                                                date: w.dateStr,
                                                            })
                                                        }}
                                                    >
                                                        + Leave
                                                    </Button>
                                                </div>
                                            </td>
                                        )
                                    })}
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </CardShell>

            {/* Modal 1: Allot / Change Shift */}
            <Dialog open={allotModal.open} onOpenChange={(open) => !open && setAllotModal(prev => ({ ...prev, open: false }))}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Allot Shift for {allotModal.userName}</DialogTitle>
                        <DialogDescription>
                            Date: <strong>{allotModal.date}</strong>. Assign or change duty shift for this employee.
                        </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={handleAllotSubmit} className="space-y-4 py-2">
                        <div className="space-y-1.5">
                            <Label htmlFor="allot-shift">Select Shift *</Label>
                            <Select value={modalShiftId} onValueChange={setModalShiftId}>
                                <SelectTrigger id="allot-shift">
                                    <SelectValue placeholder="Choose shift" />
                                </SelectTrigger>
                                <SelectContent>
                                    {shifts?.map((s) => (
                                        <SelectItem key={s.id} value={s.id}>
                                            {s.name} ({s.start_time} - {s.end_time}) {s.is_overnight ? '🌙' : ''}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="allot-notes">Roster Notes (Optional)</Label>
                            <Input
                                id="allot-notes"
                                placeholder="e.g. Swapped with evening batch"
                                value={modalNotes}
                                onChange={(e) => setModalNotes(e.target.value)}
                            />
                        </div>

                        <DialogFooter className="pt-2">
                            <Button type="button" variant="outline" onClick={() => setAllotModal(prev => ({ ...prev, open: false }))}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={allotMutation.isPending}>
                                {allotMutation.isPending ? 'Allotting...' : 'Confirm Allotment'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Modal 2: Mark Urgent Absent */}
            <Dialog open={absentModal.open} onOpenChange={(open) => !open && setAbsentModal(prev => ({ ...prev, open: false }))}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-rose-600 flex items-center gap-2">
                            <UserX className="h-5 w-5" />
                            Mark Urgent Absent
                        </DialogTitle>
                        <DialogDescription>
                            Mark <strong>{absentModal.userName}</strong> as absent on <strong>{absentModal.date}</strong>.
                        </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={handleAbsentSubmit} className="space-y-4 py-2">
                        <div className="space-y-1.5">
                            <Label htmlFor="absent-reason">Absence Reason</Label>
                            <Input
                                id="absent-reason"
                                placeholder="e.g. Sudden medical emergency, no show"
                                value={modalNotes}
                                onChange={(e) => setModalNotes(e.target.value)}
                            />
                        </div>

                        <DialogFooter className="pt-2">
                            <Button type="button" variant="outline" onClick={() => setAbsentModal(prev => ({ ...prev, open: false }))}>
                                Cancel
                            </Button>
                            <Button type="submit" variant="destructive" disabled={markAbsentMutation.isPending}>
                                {markAbsentMutation.isPending ? 'Marking...' : 'Confirm Absence'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Modal 3: Call In for Extra Shift */}
            <Dialog open={extraShiftModal.open} onOpenChange={(open) => !open && setExtraShiftModal(prev => ({ ...prev, open: false }))}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-amber-600 flex items-center gap-2">
                            <Sparkles className="h-5 w-5" />
                            Call In for Extra Shift Work
                        </DialogTitle>
                        <DialogDescription>
                            Schedule <strong>{extraShiftModal.userName}</strong> for extra shift duty on <strong>{extraShiftModal.date}</strong>.
                            Hours will be recorded as extra working hours.
                        </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={handleExtraSubmit} className="space-y-4 py-2">
                        <div className="space-y-1.5">
                            <Label htmlFor="extra-shift">Select Extra Shift *</Label>
                            <Select value={modalShiftId} onValueChange={setModalShiftId}>
                                <SelectTrigger id="extra-shift">
                                    <SelectValue placeholder="Choose shift" />
                                </SelectTrigger>
                                <SelectContent>
                                    {shifts?.map((s) => (
                                        <SelectItem key={s.id} value={s.id}>
                                            {s.name} ({s.start_time} - {s.end_time})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-1.5">
                            <Label>Extra Shift Coverage</Label>
                            <div className="grid grid-cols-2 gap-2">
                                <Button
                                    type="button"
                                    variant={modalExtraShiftType === 'full' ? 'default' : 'outline'}
                                    className={cn(
                                        "h-9 text-xs font-semibold",
                                        modalExtraShiftType === 'full' ? "bg-amber-600 hover:bg-amber-700 text-white" : ""
                                    )}
                                    onClick={() => setModalExtraShiftType('full')}
                                >
                                    Full Shift (1.0x Day)
                                </Button>
                                <Button
                                    type="button"
                                    variant={modalExtraShiftType === 'half' ? 'default' : 'outline'}
                                    className={cn(
                                        "h-9 text-xs font-semibold",
                                        modalExtraShiftType === 'half' ? "bg-amber-600 hover:bg-amber-700 text-white" : ""
                                    )}
                                    onClick={() => setModalExtraShiftType('half')}
                                >
                                    Half Shift (0.5x Day)
                                </Button>
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="extra-notes">Notes</Label>
                            <Input
                                id="extra-notes"
                                placeholder="e.g. Covering banquet party surge"
                                value={modalNotes}
                                onChange={(e) => setModalNotes(e.target.value)}
                            />
                        </div>

                        <DialogFooter className="pt-2">
                            <Button type="button" variant="outline" onClick={() => setExtraShiftModal(prev => ({ ...prev, open: false }))}>
                                Cancel
                            </Button>
                            <Button type="submit" className="bg-amber-600 hover:bg-amber-700 text-white" disabled={callExtraMutation.isPending}>
                                {callExtraMutation.isPending ? 'Scheduling...' : 'Confirm Extra Shift'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Modal 4: Apply Leave On Behalf */}
            <Dialog open={leaveModal.open} onOpenChange={(open) => !open && setLeaveModal(prev => ({ ...prev, open: false }))}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-purple-600 flex items-center gap-2">
                            <FileText className="h-5 w-5" />
                            Apply Leave On Behalf of Staff
                        </DialogTitle>
                        <DialogDescription>
                            For lower hotel/hospital staff who cannot apply themselves. This leave will be auto-approved by the department manager.
                        </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={handleLeaveSubmit} className="space-y-4 py-2">
                        <div className="space-y-1.5">
                            <Label htmlFor="leave-type">Leave Type</Label>
                            <Select value={modalLeaveType} onValueChange={setModalLeaveType}>
                                <SelectTrigger id="leave-type">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="casual">Casual Leave (CL)</SelectItem>
                                    <SelectItem value="sick">Sick Leave (SL)</SelectItem>
                                    <SelectItem value="earned">Earned Leave (EL)</SelectItem>
                                    <SelectItem value="unpaid">Loss of Pay / Unpaid</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="leave-reason">Reason</Label>
                            <Textarea
                                id="leave-reason"
                                placeholder="Reason for staff leave..."
                                value={modalLeaveReason}
                                onChange={(e) => setModalLeaveReason(e.target.value)}
                                rows={2}
                            />
                        </div>

                        <DialogFooter className="pt-2">
                            <Button type="button" variant="outline" onClick={() => setLeaveModal(prev => ({ ...prev, open: false }))}>
                                Cancel
                            </Button>
                            <Button type="submit" className="bg-purple-600 hover:bg-purple-700 text-white" disabled={applyLeaveMutation.isPending}>
                                {applyLeaveMutation.isPending ? 'Applying...' : 'Apply & Approve Leave'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    )
}
