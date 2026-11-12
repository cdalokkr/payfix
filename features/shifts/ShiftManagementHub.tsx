"use client"

import { useState, useMemo, useEffect } from 'react'
import { trpc } from '@/lib/trpc/client'
import { CardShell } from '@/features/attendance/CardShell'
import {
    Clock, Plus, Edit, Trash2, Moon, Sun, CheckCircle,
    RotateCw, Users, AlertCircle, Building2, MapPin, Check
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
    Tabs,
    TabsList,
    TabsTrigger,
    TabsContent
} from '@/components/ui/tabs'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription
} from '@/components/ui/dialog'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

export default function ShiftManagementHub() {
    const [activeTab, setActiveTab] = useState<'shifts' | 'assignments' | 'rotations'>('shifts')
    const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null)

    // Shift modal states
    const [isShiftModalOpen, setIsShiftModalOpen] = useState(false)
    const [editingShift, setEditingShift] = useState<any | null>(null)
    const [deletingShift, setDeletingShift] = useState<any | null>(null)

    // Shift form states
    const [shiftName, setShiftName] = useState('')
    const [shiftCode, setShiftCode] = useState('')
    const [startTime, setStartTime] = useState('09:00')
    const [endTime, setEndTime] = useState('17:00')
    const [breakMinutes, setBreakMinutes] = useState(60)
    const [minHalfDayHours, setMinHalfDayHours] = useState(4)
    const [minFullDayHours, setMinFullDayHours] = useState(8)
    const [isDefault, setIsDefault] = useState(false)
    const [locationIdForShift, setLocationIdForShift] = useState<string | null>(null)

    // Assignment form states
    const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
    const [assignmentMode, setAssignmentMode] = useState<'single' | 'multi'>('single')
    const [chosenShiftIds, setChosenShiftIds] = useState<string[]>([])
    const [dailyDutyHours, setDailyDutyHours] = useState(8)
    const [rotationType, setRotationType] = useState<'none' | 'weekly' | 'biweekly' | 'monthly'>('none')
    const [rotationShiftOrder, setRotationShiftOrder] = useState<string[]>([])
    const [filterDepartmentId, setFilterDepartmentId] = useState<string>('all')

    const utils = trpc.useUtils()

    // Fetch shifts
    const { data: shifts, isLoading: shiftsLoading } = trpc.shifts.getShifts.useQuery(
        selectedLocationId ? { locationId: selectedLocationId } : undefined
    )

    // Fetch office locations
    const { data: locations } = trpc.officeLocations.getAll.useQuery()

    // Fetch departments
    const { data: departments } = trpc.departments.getAll.useQuery()

    // Fetch users
    const { data: usersData } = trpc.admin.users.getUsers.useQuery({
        getAll: true,
    })
    const users = useMemo(() => (usersData as any)?.users || [], [usersData])

    // Fetch current user's assignments when selected
    const { data: userAssignments, refetch: refetchUserAssignments } = trpc.shifts.getEmployeeAssignments.useQuery(
        { userId: selectedUserId! },
        { enabled: !!selectedUserId }
    )

    // Calculate shift duration live
    const calculatedDuration = useMemo(() => {
        if (!startTime || !endTime) return 0
        const [sh, sm] = startTime.split(':').map(Number)
        const [eh, em] = endTime.split(':').map(Number)
        let sMins = sh * 60 + sm
        let eMins = eh * 60 + em
        if (eMins <= sMins) {
            eMins += 24 * 60 // Overnight
        }
        const gross = eMins - sMins
        const net = Math.max(0, gross - (breakMinutes || 0))
        return Math.round((net / 60) * 10) / 10
    }, [startTime, endTime, breakMinutes])

    const isOvernight = useMemo(() => {
        if (!startTime || !endTime) return false
        const [sh, sm] = startTime.split(':').map(Number)
        const [eh, em] = endTime.split(':').map(Number)
        return (eh * 60 + em) <= (sh * 60 + sm)
    }, [startTime, endTime])

    // Shift mutations
    const createShiftMutation = trpc.shifts.createShift.useMutation({
        onSuccess: () => {
            toast.success("Shift created successfully")
            utils.shifts.getShifts.invalidate()
            closeShiftModal()
        },
        onError: (err) => toast.error(err.message || "Failed to create shift")
    })

    const updateShiftMutation = trpc.shifts.updateShift.useMutation({
        onSuccess: () => {
            toast.success("Shift updated successfully")
            utils.shifts.getShifts.invalidate()
            closeShiftModal()
        },
        onError: (err) => toast.error(err.message || "Failed to update shift")
    })

    const deleteShiftMutation = trpc.shifts.deleteShift.useMutation({
        onSuccess: () => {
            toast.success("Shift deleted successfully")
            utils.shifts.getShifts.invalidate()
            setDeletingShift(null)
        },
        onError: (err) => toast.error(err.message || "Failed to delete shift")
    })

    const assignMutation = trpc.shifts.assignEmployeeShifts.useMutation({
        onSuccess: () => {
            toast.success("Shift assignments and rotation saved successfully!")
            refetchUserAssignments()
            utils.shifts.getDepartmentRosterGrid.invalidate()
        },
        onError: (err) => toast.error(err.message || "Failed to save assignments")
    })

    const openCreateShift = () => {
        setEditingShift(null)
        setShiftName('')
        setShiftCode('')
        setStartTime('09:00')
        setEndTime('17:00')
        setBreakMinutes(60)
        setMinHalfDayHours(4)
        setMinFullDayHours(8)
        setIsDefault(false)
        setLocationIdForShift(selectedLocationId)
        setIsShiftModalOpen(true)
    }

    const openEditShift = (shift: any) => {
        setEditingShift(shift)
        setShiftName(shift.name)
        setShiftCode(shift.code || '')
        setStartTime(shift.start_time)
        setEndTime(shift.end_time)
        setBreakMinutes(shift.break_minutes || 0)
        setMinHalfDayHours(Number(shift.min_half_day_hours) || 4)
        setMinFullDayHours(Number(shift.min_full_day_hours) || 8)
        setIsDefault(shift.is_default || false)
        setLocationIdForShift(shift.location_id || null)
        setIsShiftModalOpen(true)
    }

    const closeShiftModal = () => {
        setIsShiftModalOpen(false)
        setEditingShift(null)
    }

    const handleShiftSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (!shiftName.trim()) {
            toast.error("Shift name is required")
            return
        }

        const payload = {
            name: shiftName.trim(),
            code: shiftCode.trim() || null,
            startTime,
            endTime,
            durationHours: calculatedDuration || 8.0,
            breakMinutes: Number(breakMinutes) || 0,
            minHalfDayHours: Number(minHalfDayHours) || 4,
            minFullDayHours: Number(minFullDayHours) || 8,
            isDefault,
            isOvernight,
            locationId: locationIdForShift || null,
        }

        if (editingShift) {
            updateShiftMutation.mutate({
                id: editingShift.id,
                ...payload
            })
        } else {
            createShiftMutation.mutate(payload)
        }
    }

    // Handle user selection in Assignment tab
    const handleSelectUser = (userId: string) => {
        setSelectedUserId(userId)
        // Find existing assignments
        const user = users.find((u: any) => u.id === userId)
        if (user) {
            // Find assignments if loaded
            setDailyDutyHours(8)
            setChosenShiftIds([])
        }
    }

    // Update assignment form when userAssignments loads
    useEffect(() => {
        if (userAssignments && userAssignments.length > 0) {
            const first = userAssignments[0]
            setAssignmentMode(userAssignments.length > 1 ? 'multi' : 'single')
            setChosenShiftIds(userAssignments.map(a => a.shift_id))
            setDailyDutyHours(Number(first.total_duty_hours) || 8)
            setRotationType((first.rotation_cycle as any) || 'none')
            setRotationShiftOrder(first.rotation_shift_ids || [])
        } else if (selectedUserId) {
            setChosenShiftIds([])
            setDailyDutyHours(8)
            setRotationType('none')
            setRotationShiftOrder([])
        }
    }, [userAssignments, selectedUserId])

    // Calculate total hours of chosen shifts for multi-shift validation
    const totalChosenShiftHours = useMemo(() => {
        if (!shifts || chosenShiftIds.length === 0) return 0
        return chosenShiftIds.reduce((sum, sid) => {
            const sh = shifts.find(s => s.id === sid)
            return sum + (sh ? Number(sh.duration_hours) || 0 : 0)
        }, 0)
    }, [shifts, chosenShiftIds])

    const handleSaveAssignments = () => {
        if (!selectedUserId) {
            toast.error("Please select a staff member first")
            return
        }
        if (chosenShiftIds.length === 0) {
            toast.error("Please select at least one shift to assign")
            return
        }

        if (assignmentMode === 'multi' && Math.abs(totalChosenShiftHours - dailyDutyHours) > 0.1) {
            toast.error(`Multi-shift validation: Sum of shift hours (${totalChosenShiftHours}h) must equal Daily Duty Hours (${dailyDutyHours}h)`)
            return
        }

        assignMutation.mutate({
            userId: selectedUserId,
            shiftIds: chosenShiftIds,
            totalDutyHours: dailyDutyHours,
            rotationCycle: rotationType,
            rotationShiftIds: rotationType !== 'none' ? rotationShiftOrder : undefined,
            effectiveFrom: new Date().toISOString().split('T')[0],
        })
    }

    const filteredUsers = useMemo(() => {
        if (filterDepartmentId === 'all') return users
        return users.filter((u: any) => u.department_id === filterDepartmentId)
    }, [users, filterDepartmentId])

    return (
        <div className="space-y-6">
            {/* Top Navigation Tabs */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)} className="w-full sm:w-auto">
                    <TabsList className="bg-slate-100 dark:bg-zinc-800/80 p-1">
                        <TabsTrigger value="shifts" className="gap-2">
                            <Clock className="h-4 w-4" />
                            Office Location Shifts
                        </TabsTrigger>
                        <TabsTrigger value="assignments" className="gap-2">
                            <Users className="h-4 w-4" />
                            Staff Duty & Multi-Shift
                        </TabsTrigger>
                        <TabsTrigger value="rotations" className="gap-2">
                            <RotateCw className="h-4 w-4" />
                            Shift Rotation Setup
                        </TabsTrigger>
                    </TabsList>
                </Tabs>

                {activeTab === 'shifts' && (
                    <div className="flex items-center gap-3 w-full sm:w-auto">
                        <Select
                            value={selectedLocationId || "all"}
                            onValueChange={(val) => setSelectedLocationId(val === "all" ? null : val)}
                        >
                            <SelectTrigger className="w-[180px] bg-white dark:bg-zinc-900">
                                <SelectValue placeholder="All Locations" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Office Locations</SelectItem>
                                {locations?.map((loc) => (
                                    <SelectItem key={loc.id} value={loc.id}>
                                        {loc.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <Button onClick={openCreateShift} className="gap-2 bg-primary text-primary-foreground">
                            <Plus className="h-4 w-4" />
                            Create Shift
                        </Button>
                    </div>
                )}
            </div>

            {/* TAB 1: SHIFTS */}
            {activeTab === 'shifts' && (
                <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {shiftsLoading ? (
                            <div className="col-span-full py-12 text-center text-muted-foreground">
                                Loading office location shifts...
                            </div>
                        ) : shifts?.length === 0 ? (
                            <div className="col-span-full p-8 text-center rounded-xl border border-dashed border-slate-300 dark:border-slate-800">
                                <Clock className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                                <h3 className="font-semibold text-slate-800 dark:text-slate-200">No Shifts Configured</h3>
                                <p className="text-xs text-muted-foreground mt-1 mb-4">
                                    Create single or multiple shifts for this location (Morning, Evening, Night 🌙, Split shifts).
                                </p>
                                <Button onClick={openCreateShift} size="sm">
                                    <Plus className="h-4 w-4 mr-1.5" />
                                    Add First Shift
                                </Button>
                            </div>
                        ) : (
                            shifts?.map((shift) => (
                                <div
                                    key={shift.id}
                                    className={cn(
                                        "p-5 rounded-xl border transition-all duration-200 bg-white dark:bg-zinc-900 relative flex flex-col justify-between shadow-sm",
                                        shift.is_default
                                            ? "border-primary/50 dark:border-primary/40 ring-1 ring-primary/20"
                                            : "border-slate-200 dark:border-slate-800 hover:border-slate-300"
                                    )}
                                >
                                    <div>
                                        <div className="flex items-start justify-between gap-2 mb-2">
                                            <div className="flex items-center gap-2">
                                                <h4 className="font-bold text-slate-900 dark:text-white">
                                                    {shift.name}
                                                </h4>
                                                {shift.is_overnight && (
                                                    <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                                                        <Moon className="h-3 w-3" />
                                                        Overnight
                                                    </span>
                                                )}
                                            </div>
                                            {shift.is_default && (
                                                <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/20">
                                                    Default Shift
                                                </Badge>
                                            )}
                                        </div>

                                        {shift.code && (
                                            <span className="text-xs font-mono font-semibold text-slate-500 uppercase tracking-wider">
                                                Code: {shift.code}
                                            </span>
                                        )}

                                        <div className="mt-4 p-3 rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-100 dark:border-slate-800/80 space-y-2">
                                            <div className="flex items-center justify-between text-xs">
                                                <span className="text-slate-500">Working Timing:</span>
                                                <span className="font-semibold text-slate-800 dark:text-slate-200">
                                                    {shift.start_time} - {shift.end_time}
                                                </span>
                                            </div>

                                            <div className="flex items-center justify-between text-xs">
                                                <span className="text-slate-500">Net Working Duration:</span>
                                                <span className="font-bold text-primary">
                                                    {shift.duration_hours} Hours
                                                </span>
                                            </div>

                                            <div className="flex items-center justify-between text-xs">
                                                <span className="text-slate-500">Break Allowance:</span>
                                                <span className="text-slate-700 dark:text-slate-300">
                                                    {shift.break_minutes} Mins
                                                </span>
                                            </div>

                                            <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200/50 dark:border-slate-800">
                                                <span className="text-slate-500">Min Half / Full Day:</span>
                                                <span className="text-slate-700 dark:text-slate-300 font-medium">
                                                    {shift.min_half_day_hours}h / {shift.min_full_day_hours}h
                                                </span>
                                            </div>
                                        </div>

                                        {shift.is_overnight && (
                                            <p className="mt-2 text-[11px] text-amber-600 dark:text-amber-400 flex items-center gap-1.5 font-medium">
                                                <AlertCircle className="h-3 w-3 shrink-0" />
                                                Attendance date counted on Shift Start Date (Day 1).
                                            </p>
                                        )}
                                    </div>

                                    <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                                            <MapPin className="h-3 w-3" />
                                            {locations?.find(l => l.id === shift.location_id)?.name || "All Locations"}
                                        </span>

                                        <div className="flex items-center gap-1">
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                className="h-8 w-8 p-0"
                                                onClick={() => openEditShift(shift)}
                                            >
                                                <Edit className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                className="h-8 w-8 p-0 text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                                                onClick={() => setDeletingShift(shift)}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}

            {/* TAB 2 & 3: STAFF ASSIGNMENTS & ROTATIONS */}
            {(activeTab === 'assignments' || activeTab === 'rotations') && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    {/* Left: Staff Selector */}
                    <div className="lg:col-span-5 space-y-4">
                        <CardShell
                            title="Select Staff Member"
                            description="Filter by department and assign shift duty hours or rotation."
                            icon={Users}
                            contentClassName="p-3 space-y-3"
                        >
                            <div className="flex items-center gap-2">
                                <Label className="text-xs shrink-0">Dept:</Label>
                                <Select
                                    value={filterDepartmentId}
                                    onValueChange={setFilterDepartmentId}
                                >
                                    <SelectTrigger className="h-8 text-xs">
                                        <SelectValue placeholder="All Departments" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Departments</SelectItem>
                                        {departments?.map(d => (
                                            <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="max-h-[500px] overflow-y-auto space-y-1.5 pr-1 divide-y divide-slate-100 dark:divide-slate-800">
                                {filteredUsers.map((user: any) => {
                                    const isSelected = selectedUserId === user.id
                                    return (
                                        <div
                                            key={user.id}
                                            onClick={() => handleSelectUser(user.id)}
                                            className={cn(
                                                "p-3 rounded-lg cursor-pointer transition-all flex items-center justify-between text-left",
                                                isSelected
                                                    ? "bg-primary/10 border border-primary/30 text-primary font-semibold"
                                                    : "hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-800 dark:text-slate-200"
                                            )}
                                        >
                                            <div className="space-y-0.5">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm">
                                                        {user.first_name} {user.last_name}
                                                    </span>
                                                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 capitalize">
                                                        {user.role}
                                                    </span>
                                                </div>
                                                <p className="text-xs text-muted-foreground font-normal">
                                                    {user.department?.name || 'General Dept'} • {user.designation?.name || 'Staff'}
                                                </p>
                                            </div>

                                            {isSelected && (
                                                <CheckCircle className="h-4 w-4 text-primary shrink-0" />
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        </CardShell>
                    </div>

                    {/* Right: Duty Configuration */}
                    <div className="lg:col-span-7 space-y-4">
                        {!selectedUserId ? (
                            <div className="p-12 text-center rounded-xl border border-dashed border-slate-200 dark:border-slate-800 bg-white/40 dark:bg-zinc-900/40">
                                <Users className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
                                <h3 className="font-semibold text-slate-700 dark:text-slate-300">
                                    No Staff Member Selected
                                </h3>
                                <p className="text-xs text-muted-foreground mt-1">
                                    Choose a staff member on the left panel to configure their single/multi shift duty and rotation pattern.
                                </p>
                            </div>
                        ) : (
                            <CardShell
                                title="Shift Duty & Assignment Setup"
                                description="Configure daily duty hours, single or multi-shift allocation, and weekly/monthly rotations."
                                icon={Clock}
                                contentClassName="p-5 space-y-6"
                            >
                                {/* Single vs Multi-shift Switcher */}
                                <div className="space-y-2">
                                    <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                                        Shift Allocation Mode
                                    </Label>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div
                                            onClick={() => {
                                                setAssignmentMode('single')
                                                if (chosenShiftIds.length > 1) {
                                                    setChosenShiftIds([chosenShiftIds[0]])
                                                }
                                            }}
                                            className={cn(
                                                "p-3 rounded-xl border cursor-pointer text-center transition-all",
                                                assignmentMode === 'single'
                                                    ? "border-primary bg-primary/5 text-primary font-bold shadow-sm"
                                                    : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/30 text-slate-600 dark:text-slate-400"
                                            )}
                                        >
                                            <p className="text-sm">Single Shift</p>
                                            <p className="text-[11px] font-normal text-muted-foreground">Standard 1 shift per day</p>
                                        </div>

                                        <div
                                            onClick={() => setAssignmentMode('multi')}
                                            className={cn(
                                                "p-3 rounded-xl border cursor-pointer text-center transition-all",
                                                assignmentMode === 'multi'
                                                    ? "border-primary bg-primary/5 text-primary font-bold shadow-sm"
                                                    : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/30 text-slate-600 dark:text-slate-400"
                                            )}
                                        >
                                            <p className="text-sm">Multi-Shift (Split / Hotel / Hospital)</p>
                                            <p className="text-[11px] font-normal text-muted-foreground">2+ shifts summing to duty hours</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Daily Duty Hours */}
                                <div className="space-y-1.5 p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                                    <div className="flex items-center justify-between">
                                        <Label htmlFor="daily-duty" className="text-sm font-semibold">
                                            Total Daily Duty Hours (Mandatory)
                                        </Label>
                                        <span className="text-xs font-bold px-2 py-0.5 rounded bg-primary/10 text-primary">
                                            Target: {dailyDutyHours} Hours
                                        </span>
                                    </div>
                                    <Input
                                        id="daily-duty"
                                        type="number"
                                        step="0.5"
                                        min="1"
                                        max="24"
                                        value={dailyDutyHours}
                                        onChange={(e) => setDailyDutyHours(Number(e.target.value) || 0)}
                                        className="h-10 mt-1 font-semibold"
                                    />
                                    <p className="text-[11px] text-muted-foreground">
                                        Admin/Moderator configured target. If employee works less than this, attendance will automatically mark as <strong>Half Day (Amber Highlight)</strong>.
                                    </p>
                                </div>

                                {/* Choose Shifts */}
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                                            Select Assigned Shift(s)
                                        </Label>
                                        {assignmentMode === 'multi' && (
                                            <span className={cn(
                                                "text-xs font-bold px-2 py-0.5 rounded",
                                                Math.abs(totalChosenShiftHours - dailyDutyHours) < 0.1
                                                    ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300"
                                                    : "bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300"
                                            )}>
                                                Total Selected: {totalChosenShiftHours}h / {dailyDutyHours}h
                                            </span>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                        {shifts?.map((shift) => {
                                            const isChecked = chosenShiftIds.includes(shift.id)
                                            return (
                                                <div
                                                    key={shift.id}
                                                    onClick={() => {
                                                        if (assignmentMode === 'single') {
                                                            setChosenShiftIds([shift.id])
                                                        } else {
                                                            if (isChecked) {
                                                                setChosenShiftIds(chosenShiftIds.filter(id => id !== shift.id))
                                                            } else {
                                                                setChosenShiftIds([...chosenShiftIds, shift.id])
                                                            }
                                                        }
                                                    }}
                                                    className={cn(
                                                        "p-3 rounded-lg border cursor-pointer transition-all flex items-center justify-between",
                                                        isChecked
                                                            ? "bg-primary/5 border-primary text-primary font-semibold"
                                                            : "border-slate-200 dark:border-slate-800 hover:border-slate-300 text-slate-700 dark:text-slate-300"
                                                    )}
                                                >
                                                    <div className="space-y-0.5">
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="text-xs font-bold">{shift.name}</span>
                                                            {shift.is_overnight && <Moon className="h-3 w-3 text-indigo-500" />}
                                                        </div>
                                                        <p className="text-[11px] text-muted-foreground font-normal">
                                                            {shift.start_time} - {shift.end_time} ({shift.duration_hours}h)
                                                        </p>
                                                    </div>

                                                    <Checkbox
                                                        checked={isChecked}
                                                        onCheckedChange={() => {}}
                                                        className="pointer-events-none"
                                                    />
                                                </div>
                                            )
                                        })}
                                    </div>

                                    {/* Multi-shift Hours Warning */}
                                    {assignmentMode === 'multi' && Math.abs(totalChosenShiftHours - dailyDutyHours) > 0.1 && (
                                        <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 flex items-start gap-2.5 text-xs text-amber-800 dark:text-amber-300">
                                            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
                                            <div>
                                                <p className="font-semibold">Shift Hours Mismatch</p>
                                                <p className="mt-0.5">
                                                    For multi-shift staff, the sum of assigned shifts ({totalChosenShiftHours}h) must equal the total duty hours ({dailyDutyHours}h).
                                                    Please adjust the shift selection or target duty hours.
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Shift Rotation Config */}
                                <div className="space-y-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                                                Shift Rotation Cycle
                                            </Label>
                                            <p className="text-xs text-muted-foreground">
                                                Automatically rotate staff between shifts based on schedule
                                            </p>
                                        </div>
                                        <Select
                                            value={rotationType}
                                            onValueChange={(val: any) => setRotationType(val)}
                                        >
                                            <SelectTrigger className="w-[160px] h-8 text-xs">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="none">No Rotation</SelectItem>
                                                <SelectItem value="weekly">Weekly Rotation</SelectItem>
                                                <SelectItem value="biweekly">Bi-Weekly (15 Days)</SelectItem>
                                                <SelectItem value="monthly">Monthly Rotation</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    {rotationType !== 'none' && (
                                        <div className="p-3 rounded-lg bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40 space-y-2">
                                            <p className="text-xs font-semibold text-indigo-900 dark:text-indigo-200">
                                                Select Rotation Sequence (order of rotation cycles)
                                            </p>
                                            <div className="flex flex-wrap gap-2">
                                                {shifts?.map((shift) => {
                                                    const isOrder = rotationShiftOrder.includes(shift.id)
                                                    const orderIndex = rotationShiftOrder.indexOf(shift.id)
                                                    return (
                                                        <Button
                                                            key={shift.id}
                                                            size="sm"
                                                            type="button"
                                                            variant={isOrder ? "default" : "outline"}
                                                            className="h-7 text-xs"
                                                            onClick={() => {
                                                                if (isOrder) {
                                                                    setRotationShiftOrder(rotationShiftOrder.filter(id => id !== shift.id))
                                                                } else {
                                                                    setRotationShiftOrder([...rotationShiftOrder, shift.id])
                                                                }
                                                            }}
                                                        >
                                                            {isOrder && <span className="mr-1 font-bold">#{orderIndex + 1}</span>}
                                                            {shift.name}
                                                        </Button>
                                                    )
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="pt-4 flex justify-end">
                                    <Button
                                        onClick={handleSaveAssignments}
                                        disabled={assignMutation.isPending}
                                        className="gap-2 bg-primary text-primary-foreground font-semibold px-6"
                                    >
                                        <Check className="h-4 w-4" />
                                        {assignMutation.isPending ? 'Saving Setup...' : 'Save Shift & Duty Assignment'}
                                    </Button>
                                </div>
                            </CardShell>
                        )}
                    </div>
                </div>
            )}

            {/* Shift Create / Edit Modal */}
            <Dialog open={isShiftModalOpen} onOpenChange={setIsShiftModalOpen}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>{editingShift ? 'Edit Office Shift' : 'Create New Office Shift'}</DialogTitle>
                        <DialogDescription>
                            Configure shift hours, break allowances, and overnight parameters.
                        </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={handleShiftSubmit} className="space-y-4 py-2">
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label htmlFor="shift-name">Shift Name *</Label>
                                <Input
                                    id="shift-name"
                                    placeholder="e.g. Morning Shift, Night Duty"
                                    value={shiftName}
                                    onChange={(e) => setShiftName(e.target.value)}
                                    required
                                />
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="shift-code">Shift Code</Label>
                                <Input
                                    id="shift-code"
                                    placeholder="e.g. S1, NGT, EVE"
                                    value={shiftCode}
                                    onChange={(e) => setShiftCode(e.target.value.toUpperCase())}
                                    maxLength={10}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label htmlFor="shift-start">Start Time (24h) *</Label>
                                <Input
                                    id="shift-start"
                                    type="time"
                                    value={startTime}
                                    onChange={(e) => setStartTime(e.target.value)}
                                    required
                                />
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="shift-end">End Time (24h) *</Label>
                                <Input
                                    id="shift-end"
                                    type="time"
                                    value={endTime}
                                    onChange={(e) => setEndTime(e.target.value)}
                                    required
                                />
                            </div>
                        </div>

                        {/* Live Duration and Overnight Detection */}
                        <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
                            <div className="flex items-center justify-between text-xs font-semibold">
                                <span>Calculated Net Duration:</span>
                                <span className="text-primary font-bold text-sm">{calculatedDuration} Hours</span>
                            </div>
                            {isOvernight && (
                                <p className="text-[11px] text-indigo-600 dark:text-indigo-400 font-medium flex items-center gap-1.5 pt-1 border-t border-slate-200/60 dark:border-slate-800">
                                    <Moon className="h-3.5 w-3.5" />
                                    Detected as <strong>Overnight Shift</strong>. Attendance date will be strictly Day 1.
                                </p>
                            )}
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                            <div className="space-y-1.5">
                                <Label htmlFor="shift-break" className="text-xs">Break (Mins)</Label>
                                <Input
                                    id="shift-break"
                                    type="number"
                                    min="0"
                                    value={breakMinutes}
                                    onChange={(e) => setBreakMinutes(Number(e.target.value) || 0)}
                                />
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="shift-half" className="text-xs">Min Half Day (Hrs)</Label>
                                <Input
                                    id="shift-half"
                                    type="number"
                                    step="0.5"
                                    value={minHalfDayHours}
                                    onChange={(e) => setMinHalfDayHours(Number(e.target.value) || 0)}
                                />
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="shift-full" className="text-xs">Min Full Day (Hrs)</Label>
                                <Input
                                    id="shift-full"
                                    type="number"
                                    step="0.5"
                                    value={minFullDayHours}
                                    onChange={(e) => setMinFullDayHours(Number(e.target.value) || 0)}
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="shift-loc">Office Location</Label>
                            <Select
                                value={locationIdForShift || "all"}
                                onValueChange={(val) => setLocationIdForShift(val === "all" ? null : val)}
                            >
                                <SelectTrigger id="shift-loc">
                                    <SelectValue placeholder="All Locations" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Office Locations (Universal)</SelectItem>
                                    {locations?.map((loc) => (
                                        <SelectItem key={loc.id} value={loc.id}>
                                            {loc.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="flex items-center gap-2 pt-1">
                            <Checkbox
                                id="is-default-shift"
                                checked={isDefault}
                                onCheckedChange={(checked) => setIsDefault(!!checked)}
                            />
                            <Label htmlFor="is-default-shift" className="text-xs font-medium cursor-pointer">
                                Set as Default Shift for this Location
                            </Label>
                        </div>

                        <DialogFooter className="pt-2">
                            <Button type="button" variant="outline" onClick={closeShiftModal}>
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                disabled={createShiftMutation.isPending || updateShiftMutation.isPending}
                            >
                                {editingShift ? 'Update Shift' : 'Create Shift'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Shift Delete Modal */}
            <Dialog open={!!deletingShift} onOpenChange={(open) => !open && setDeletingShift(null)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-destructive flex items-center gap-2">
                            <Trash2 className="h-5 w-5" />
                            Delete Shift
                        </DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete shift <strong>{deletingShift?.name}</strong>?
                        </DialogDescription>
                    </DialogHeader>

                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button variant="outline" onClick={() => setDeletingShift(null)}>
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={() => deletingShift && deleteShiftMutation.mutate({ id: deletingShift.id })}
                            disabled={deleteShiftMutation.isPending}
                        >
                            {deleteShiftMutation.isPending ? 'Deleting...' : 'Confirm Delete'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
