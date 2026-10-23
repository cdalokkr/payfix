"use client"

import React, { useState, useMemo, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import { Badge } from "@/components/ui/badge"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { toast } from "sonner"
import { format } from "date-fns"
import {
    MapPin,
    Building2,
    CalendarClock,
    Palmtree,
    Plus,
    Pencil,
    Trash2,
    Loader2,
    LocateFixed,
    CheckCircle2,
    XCircle,
    Clock,
    Calendar as CalendarIcon,
    AlertCircle,
    Check,
    X,
    Sparkles,
    ShieldCheck,
    Globe,
    Layers,
    SlidersHorizontal,
    Search
} from "lucide-react"
import { trpc } from "@/lib/trpc/client"
import { type OfficeLocation } from "@/lib/services/geofence.service"
import { cn } from "@/lib/utils"

const DAYS = [
    { label: 'Sunday', short: 'Sun', value: 0 },
    { label: 'Monday', short: 'Mon', value: 1 },
    { label: 'Tuesday', short: 'Tue', value: 2 },
    { label: 'Wednesday', short: 'Wed', value: 3 },
    { label: 'Thursday', short: 'Thu', value: 4 },
    { label: 'Friday', short: 'Fri', value: 5 },
    { label: 'Saturday', short: 'Sat', value: 6 },
]

const DAY_INDEX_TO_NAME: Record<number, string> = {
    0: 'sunday', 1: 'monday', 2: 'tuesday', 3: 'wednesday',
    4: 'thursday', 5: 'friday', 6: 'saturday'
}

function formatShiftDisplay(timeStr?: string | null) {
    if (!timeStr) return '--:--'
    const parts = timeStr.split(':')
    const h = parseInt(parts[0], 10)
    const m = parseInt(parts[1], 10)
    if (isNaN(h) || isNaN(m)) return timeStr
    const period = h >= 12 ? 'PM' : 'AM'
    const displayH = h % 12 === 0 ? 12 : h % 12
    return `${displayH}:${String(m).padStart(2, '0')} ${period}`
}

function formatScheduleSummary(offDays?: number[] | null) {
    const list = offDays || [0]
    if (list.length === 0) return '7 Days (24x7) • No Off'
    if (list.length === 1 && list.includes(0)) return 'Mon–Sat (6 Days) • Sun Off'
    if (list.length === 2 && list.includes(0) && list.includes(6)) return 'Mon–Fri (5 Days) • Sat & Sun Off'
    const names = list.map(d => DAYS.find(day => day.value === d)?.short || String(d))
    return `${names.join(', ')} Off`
}

function formatAbsentRuleSummary(multiplier?: number | null, defaultMultiplier: number = 1) {
    if (multiplier === null || multiplier === undefined) {
        return `1 Absent = ${defaultMultiplier}d (Default)`
    }
    return `1 Absent = ${multiplier}d`
}

interface LocationForm {
    name: string
    address: string
    latitude: string
    longitude: string
    radiusMeters: number
    isActive: boolean
    checkInTime: string
    checkOutTime: string
    bufferMinutes: number
    absentDeductionMultiplier: string // 'inherit' | '1' | '1.5' | '2' | '3'
    useCustomSchedule: boolean
    offDays: number[]
    dailyWorkingHours: Record<string, { checkIn: string, checkOut: string }>
}

const defaultLocationForm: LocationForm = {
    name: '',
    address: '',
    latitude: '',
    longitude: '',
    radiusMeters: 200,
    isActive: true,
    checkInTime: '10:00:00',
    checkOutTime: '19:00:00',
    bufferMinutes: 15,
    absentDeductionMultiplier: 'inherit',
    useCustomSchedule: false,
    offDays: [0],
    dailyWorkingHours: {},
}

export function AdminOfficeHub() {
    const [activeTab, setActiveTab] = useState<'branches' | 'schedule' | 'holidays'>('branches')
    const [searchBranch, setSearchBranch] = useState('')
    
    // Modal states
    const [isLocationDialogOpen, setIsLocationDialogOpen] = useState(false)
    const [editingLocationId, setEditingLocationId] = useState<string | null>(null)
    const [locationForm, setLocationForm] = useState<LocationForm>(defaultLocationForm)
    const [locationDialogTab, setLocationDialogTab] = useState<'geo' | 'timing' | 'schedule' | 'holidays'>('geo')
    const [isGettingLocation, setIsGettingLocation] = useState(false)

    // Schedule Planner View State
    const [selectedScheduleScope, setSelectedScheduleScope] = useState<string>('global') // 'global' or location.id
    const [scheduleOffDays, setScheduleOffDays] = useState<number[]>([0])
    const [scheduleDailyHours, setScheduleDailyHours] = useState<Record<string, { checkIn: string, checkOut: string }>>({})
    const [scheduleAbsentMultiplier, setScheduleAbsentMultiplier] = useState<string>('1')

    // Holiday View & Add Modal State
    const [holidayBranchFilter, setHolidayBranchFilter] = useState<string>('all')
    const [isHolidayDialogOpen, setIsHolidayDialogOpen] = useState(false)
    const [newHolidayDate, setNewHolidayDate] = useState('')
    const [newHolidayReason, setNewHolidayReason] = useState('')
    const [newHolidayType, setNewHolidayType] = useState<'holiday' | 'closed'>('holiday')
    const [newHolidayLocationId, setNewHolidayLocationId] = useState<string>('global') // 'global' or location.id

    const utils = trpc.useUtils()

    // Queries
    const { data: locations, isLoading: isLoadingLocations } = trpc.admin.officeLocations.getAll.useQuery()
    const { data: settings, isLoading: isLoadingSettings } = trpc.attendance.getOfficeSettings.useQuery()
    const { data: closures, isLoading: isLoadingClosures } = trpc.attendance.getOfficeClosures.useQuery()

    // Locations map for quick lookup
    const locationsMap = useMemo(() => {
        const map = new Map<string, OfficeLocation>()
        locations?.forEach(loc => map.set(loc.id, loc))
        return map
    }, [locations])

    // Sync Schedule Planner state when selected scope or data changes
    React.useEffect(() => {
        if (selectedScheduleScope === 'global') {
            if (settings) {
                setScheduleOffDays(settings.off_days || [0])
                setScheduleDailyHours((settings.daily_working_hours as any) || {})
                setScheduleAbsentMultiplier(String(settings.absent_deduction_multiplier ?? 1))
            }
        } else {
            const loc = locationsMap.get(selectedScheduleScope)
            if (loc) {
                setScheduleOffDays(loc.offDays || (settings?.off_days || [0]))
                setScheduleDailyHours(loc.dailyWorkingHours || (settings?.daily_working_hours as any) || {})
                setScheduleAbsentMultiplier(
                    loc.absentDeductionMultiplier !== null && loc.absentDeductionMultiplier !== undefined
                        ? String(loc.absentDeductionMultiplier)
                        : 'inherit'
                )
            }
        }
    }, [selectedScheduleScope, settings, locationsMap])

    // Mutations
    const addLocationMutation = trpc.admin.officeLocations.add.useMutation({
        onSuccess: () => {
            toast.success("Office branch created successfully!")
            utils.admin.officeLocations.getAll.invalidate()
            setIsLocationDialogOpen(false)
            setLocationForm(defaultLocationForm)
        },
        onError: (err) => toast.error(err.message || "Failed to create location")
    })

    const updateLocationMutation = trpc.admin.officeLocations.update.useMutation({
        onSuccess: () => {
            toast.success("Office branch settings updated!")
            utils.admin.officeLocations.getAll.invalidate()
            setIsLocationDialogOpen(false)
            setLocationForm(defaultLocationForm)
            setEditingLocationId(null)
        },
        onError: (err) => toast.error(err.message || "Failed to update location")
    })

    const deleteLocationMutation = trpc.admin.officeLocations.delete.useMutation({
        onSuccess: () => {
            toast.success("Office location removed")
            utils.admin.officeLocations.getAll.invalidate()
        },
        onError: (err) => toast.error(err.message || "Failed to delete location")
    })

    const updateGlobalSettingsMutation = trpc.attendance.updateOfficeSettings.useMutation({
        onSuccess: () => {
            toast.success("Company schedule & absent configuration updated!")
            utils.attendance.getOfficeSettings.invalidate()
        },
        onError: (err) => toast.error(err.message || "Failed to update schedule")
    })

    const addClosureMutation = trpc.attendance.addOfficeClosure.useMutation({
        onSuccess: () => {
            toast.success("Holiday / closure added successfully!")
            utils.attendance.getOfficeClosures.invalidate()
            setIsHolidayDialogOpen(false)
            setNewHolidayDate('')
            setNewHolidayReason('')
            setNewHolidayType('holiday')
            setNewHolidayLocationId('global')
        },
        onError: (err) => toast.error(err.message || "Failed to add holiday")
    })

    const deleteClosureMutation = trpc.attendance.deleteOfficeClosure.useMutation({
        onSuccess: () => {
            toast.success("Holiday removed")
            utils.attendance.getOfficeClosures.invalidate()
        },
        onError: (err) => toast.error(err.message || "Failed to remove holiday")
    })

    // Handler: Open Edit Location Modal
    const handleEditLocation = useCallback((loc: OfficeLocation) => {
        setEditingLocationId(loc.id)
        setLocationForm({
            name: loc.name,
            address: loc.address || '',
            latitude: String(loc.latitude),
            longitude: String(loc.longitude),
            radiusMeters: loc.radiusMeters,
            isActive: loc.isActive,
            checkInTime: loc.checkInTime || '10:00:00',
            checkOutTime: loc.checkOutTime || '19:00:00',
            bufferMinutes: loc.bufferMinutes ?? 15,
            absentDeductionMultiplier: loc.absentDeductionMultiplier !== null && loc.absentDeductionMultiplier !== undefined
                ? String(loc.absentDeductionMultiplier)
                : 'inherit',
            useCustomSchedule: Boolean(loc.offDays && loc.offDays.length > 0),
            offDays: loc.offDays || (settings?.off_days || [0]),
            dailyWorkingHours: loc.dailyWorkingHours || {},
        })
        setLocationDialogTab('geo')
        setIsLocationDialogOpen(true)
    }, [settings])

    // Handler: Get GPS Location
    const handleGetCurrentLocation = useCallback(async () => {
        if (!navigator.geolocation) {
            toast.error('Geolocation is not supported by this browser')
            return
        }
        setIsGettingLocation(true)
        try {
            const position = await new Promise<GeolocationPosition>((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, {
                    enableHighAccuracy: true,
                    timeout: 15000,
                    maximumAge: 0,
                })
            })
            setLocationForm(prev => ({
                ...prev,
                latitude: position.coords.latitude.toFixed(7),
                longitude: position.coords.longitude.toFixed(7),
            }))
            toast.success('Current GPS location captured!')
        } catch {
            toast.error('Unable to capture location. Please enter coordinates manually.')
        } finally {
            setIsGettingLocation(false)
        }
    }, [])

    // Handler: Save Location Modal
    const handleSaveLocation = useCallback(() => {
        const lat = parseFloat(locationForm.latitude)
        const lng = parseFloat(locationForm.longitude)

        if (!locationForm.name.trim()) {
            toast.error('Please enter a location name')
            return
        }
        if (isNaN(lat) || lat < -90 || lat > 90 || isNaN(lng) || lng < -180 || lng > 180) {
            toast.error('Please enter valid GPS coordinates')
            return
        }

        const absentMultiplierValue = locationForm.absentDeductionMultiplier === 'inherit'
            ? null
            : parseFloat(locationForm.absentDeductionMultiplier)

        const payload = {
            name: locationForm.name,
            address: locationForm.address || undefined,
            latitude: lat,
            longitude: lng,
            radiusMeters: locationForm.radiusMeters,
            checkInTime: locationForm.checkInTime,
            checkOutTime: locationForm.checkOutTime,
            bufferMinutes: locationForm.bufferMinutes,
            absentDeductionMultiplier: absentMultiplierValue,
            offDays: locationForm.useCustomSchedule ? locationForm.offDays : undefined,
            dailyWorkingHours: locationForm.useCustomSchedule ? locationForm.dailyWorkingHours : undefined,
        }

        if (editingLocationId) {
            updateLocationMutation.mutate({
                id: editingLocationId,
                ...payload,
                isActive: locationForm.isActive,
            })
        } else {
            addLocationMutation.mutate(payload)
        }
    }, [locationForm, editingLocationId, addLocationMutation, updateLocationMutation])

    // Handler: Save Schedule Planner
    const handleSaveSchedulePlanner = useCallback(() => {
        // Build daily hours for ALL days
        const formattedDailyHours: Record<string, { checkIn: string, checkOut: string }> = {}
        const defaultCheckIn = settings?.default_check_in.split(':').slice(0, 2).join(':') || "10:00"
        const defaultCheckOut = settings?.default_check_out.split(':').slice(0, 2).join(':') || "19:00"

        for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
            const dayName = DAY_INDEX_TO_NAME[dayIndex]
            const stateHours = scheduleDailyHours[dayIndex] || scheduleDailyHours[dayName]
            if (stateHours && typeof stateHours === 'object' && 'checkIn' in stateHours) {
                formattedDailyHours[dayName] = stateHours as { checkIn: string, checkOut: string }
            } else {
                formattedDailyHours[dayName] = { checkIn: defaultCheckIn, checkOut: defaultCheckOut }
            }
        }

        if (selectedScheduleScope === 'global') {
            updateGlobalSettingsMutation.mutate({
                defaultCheckIn: settings?.default_check_in || "10:00:00",
                defaultCheckOut: settings?.default_check_out || "19:00:00",
                offDays: scheduleOffDays,
                dailyWorkingHours: formattedDailyHours,
                absentDeductionMultiplier: parseInt(scheduleAbsentMultiplier, 10) || 1,
            })
        } else {
            // Update location specific schedule & absent multiplier
            const multiplierVal = scheduleAbsentMultiplier === 'inherit' ? null : parseInt(scheduleAbsentMultiplier, 10)
            updateLocationMutation.mutate({
                id: selectedScheduleScope,
                offDays: scheduleOffDays,
                dailyWorkingHours: formattedDailyHours,
                absentDeductionMultiplier: multiplierVal,
            })
        }
    }, [selectedScheduleScope, settings, scheduleOffDays, scheduleDailyHours, scheduleAbsentMultiplier, updateGlobalSettingsMutation, updateLocationMutation])

    // Filtered branches for View 1
    const filteredLocations = useMemo(() => {
        if (!locations) return []
        if (!searchBranch.trim()) return locations
        const q = searchBranch.toLowerCase()
        return locations.filter(l => l.name.toLowerCase().includes(q) || l.address?.toLowerCase().includes(q))
    }, [locations, searchBranch])

    // Filtered closures for View 3
    const filteredClosures = useMemo(() => {
        if (!closures) return []
        if (holidayBranchFilter === 'all') return closures
        if (holidayBranchFilter === 'global') return closures.filter(c => !c.location_id)
        return closures.filter(c => c.location_id === holidayBranchFilter)
    }, [closures, holidayBranchFilter])

    // Counts for KPI pills
    const totalBranchesCount = locations?.length || 0
    const globalHolidaysCount = closures?.filter(c => !c.location_id).length || 0
    const branchSpecificHolidaysCount = closures?.filter(c => c.location_id).length || 0

    return (
        <div className="space-y-3.5">
            {/* Top KPI Summary & Action Banner (Compact Height, Bold Values) */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                <Card className="bg-gradient-to-br from-indigo-50/60 to-white dark:from-slate-900 dark:to-slate-900/60 border border-indigo-100/80 dark:border-indigo-950 p-2.5 sm:p-3 shadow-xs">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Office Branches</p>
                            <h3 className="text-2xl font-black text-indigo-700 dark:text-indigo-400 leading-none mt-0.5">{totalBranchesCount}</h3>
                        </div>
                        <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                            <Building2 className="w-4 h-4" />
                        </div>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5 font-medium leading-none">
                        Geofenced & Monitored
                    </p>
                </Card>

                <Card className="bg-gradient-to-br from-emerald-50/60 to-white dark:from-slate-900 dark:to-slate-900/60 border border-emerald-100/80 dark:border-emerald-950 p-2.5 sm:p-3 shadow-xs">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Default Shift</p>
                            <h3 className="text-sm font-bold text-emerald-700 dark:text-emerald-400 leading-none mt-1 truncate">
                                {formatShiftDisplay(settings?.default_check_in || '10:00:00')} - {formatShiftDisplay(settings?.default_check_out || '19:00:00')}
                            </h3>
                        </div>
                        <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                            <Clock className="w-4 h-4" />
                        </div>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5 font-medium leading-none">
                        ±15m Overtime Buffer
                    </p>
                </Card>

                <Card className="bg-gradient-to-br from-amber-50/60 to-white dark:from-slate-900 dark:to-slate-900/60 border border-amber-100/80 dark:border-amber-950 p-2.5 sm:p-3 shadow-xs">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Default Schedule</p>
                            <h3 className="text-sm font-bold text-amber-700 dark:text-amber-400 leading-none mt-1 truncate">
                                {formatScheduleSummary(settings?.off_days)}
                            </h3>
                        </div>
                        <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                            <CalendarClock className="w-4 h-4" />
                        </div>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5 font-medium leading-none">
                        {settings?.absent_deduction_multiplier ?? 1}x Absent Deduction
                    </p>
                </Card>

                <Card className="bg-gradient-to-br from-rose-50/60 to-white dark:from-slate-900 dark:to-slate-900/60 border border-rose-100/80 dark:border-rose-950 p-2.5 sm:p-3 shadow-xs">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Annual Holidays</p>
                            <h3 className="text-2xl font-black text-rose-700 dark:text-rose-400 leading-none mt-0.5">{closures?.length || 0}</h3>
                        </div>
                        <div className="p-1.5 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400">
                            <Palmtree className="w-4 h-4" />
                        </div>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5 font-medium leading-none">
                        {globalHolidaysCount} National • {branchSpecificHolidaysCount} Regional
                    </p>
                </Card>
            </div>

            {/* Navigation Tabs Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
                <Tabs value={activeTab} onValueChange={(val: any) => setActiveTab(val)} className="w-full sm:w-auto">
                    <TabsList className="bg-muted/70 p-1 rounded-xl h-9 gap-1 border border-border">
                        <TabsTrigger value="branches" className="py-1.5 px-3.5 font-semibold text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm gap-2">
                            <Building2 className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                            Office Branches & Shift Timings
                        </TabsTrigger>
                        <TabsTrigger value="schedule" className="py-1.5 px-3.5 font-semibold text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm gap-2">
                            <CalendarClock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                            Weekly Schedule & Absent Rule
                        </TabsTrigger>
                        <TabsTrigger value="holidays" className="py-1.5 px-3.5 font-semibold text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm gap-2">
                            <Palmtree className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                            Holidays & Closures ({closures?.length || 0})
                        </TabsTrigger>
                    </TabsList>
                </Tabs>

                <div className="flex items-center gap-2 self-end sm:self-auto">
                    {activeTab === 'holidays' ? (
                        <Button 
                            onClick={() => setIsHolidayDialogOpen(true)}
                            size="sm" 
                            className="gap-1.5 h-8 rounded-lg text-xs font-semibold shadow-sm"
                        >
                            <Plus className="w-3.5 h-3.5" />
                            Add Holiday
                        </Button>
                    ) : (
                        <Button 
                            onClick={() => {
                                setEditingLocationId(null)
                                setLocationForm(defaultLocationForm)
                                setLocationDialogTab('geo')
                                setIsLocationDialogOpen(true)
                            }}
                            size="sm" 
                            className="gap-1.5 h-8 rounded-lg text-xs font-semibold shadow-sm"
                        >
                            <Plus className="w-3.5 h-3.5" />
                            Add Location
                        </Button>
                    )}
                </div>
            </div>

            {/* TAB 1: Office Branches Table View */}
            {activeTab === 'branches' && (
                <Card className="border border-border/80 shadow-sm overflow-hidden">
                    <CardHeader className="px-4 py-2.5 bg-card border-b border-border/60">
                        <div className="flex items-center gap-2">
                            <Building2 className="w-4 h-4 text-primary" />
                            <CardTitle className="text-xs sm:text-sm font-bold">
                                Registered Office Branches
                            </CardTitle>
                            <Badge variant="secondary" className="text-[10px] font-bold h-5 px-1.5">
                                {filteredLocations.length}
                            </Badge>
                            <span className="hidden md:inline text-[11px] text-muted-foreground ml-1">
                                • Geofence boundaries, individual shift hours & branch rules
                            </span>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        {/* Search Toolbar directly above data table */}
                        <div className="p-2.5 border-b border-border/60 bg-muted/20 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                            <div className="relative w-full sm:w-80">
                                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                                <Input
                                    placeholder="Search branch name or address..."
                                    value={searchBranch}
                                    onChange={(e) => setSearchBranch(e.target.value)}
                                    className="h-8 pl-8 text-xs rounded-lg bg-background"
                                />
                            </div>
                            <div className="text-xs font-medium text-muted-foreground">
                                Showing <span className="font-bold text-foreground">{filteredLocations.length}</span> of {totalBranchesCount} branches
                            </div>
                        </div>
                        {isLoadingLocations ? (
                            <div className="flex justify-center py-12">
                                <Loader2 className="w-6 h-6 animate-spin text-primary" />
                            </div>
                        ) : filteredLocations.length === 0 ? (
                            <div className="text-center py-12 text-muted-foreground space-y-2">
                                <Building2 className="w-10 h-10 mx-auto opacity-30" />
                                <p className="text-sm font-semibold">No office locations found</p>
                                <p className="text-xs">Click &quot;Add Location&quot; to register your first office location</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader className="bg-muted/40">
                                        <TableRow>
                                            <TableHead className="font-bold text-xs">Branch Name & Address</TableHead>
                                            <TableHead className="font-bold text-xs">Shift Timings & Grace</TableHead>
                                            <TableHead className="font-bold text-xs">Weekly Schedule & Absent Rule</TableHead>
                                            <TableHead className="font-bold text-xs">Coordinates & Radius</TableHead>
                                            <TableHead className="font-bold text-xs">Status</TableHead>
                                            <TableHead className="font-bold text-xs text-right pr-4">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredLocations.map((loc) => {
                                            const shiftIn = loc.checkInTime || '10:00:00'
                                            const shiftOut = loc.checkOutTime || '19:00:00'
                                            const buffer = loc.bufferMinutes ?? 15

                                            return (
                                                <TableRow key={loc.id} className="hover:bg-muted/30 transition-colors">
                                                    <TableCell className="font-medium">
                                                        <div className="font-bold text-foreground text-xs">{loc.name}</div>
                                                        <div className="text-[11px] text-muted-foreground truncate max-w-[220px]">
                                                            {loc.address || 'Address not specified'}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-xs">
                                                        <div className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                                                            <Clock className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                                                            <span>{formatShiftDisplay(shiftIn)} - {formatShiftDisplay(shiftOut)}</span>
                                                        </div>
                                                        <div className="text-[10px] text-muted-foreground pl-5">
                                                            ±{buffer}m extra hrs buffer
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-xs space-y-1.5 py-3">
                                                        <div className="font-semibold text-foreground flex items-center gap-1.5">
                                                            <CalendarClock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                                                            <span>{formatScheduleSummary(loc.offDays)}</span>
                                                        </div>
                                                        <div>
                                                            <Badge variant="outline" className={cn(
                                                                "text-[9px] font-bold px-2 py-0.5",
                                                                loc.absentDeductionMultiplier && loc.absentDeductionMultiplier > 1
                                                                    ? "border-rose-200 bg-rose-50/50 text-rose-700 dark:text-rose-400"
                                                                    : "border-slate-200 bg-slate-50 text-slate-700 dark:text-slate-300"
                                                            )}>
                                                                {formatAbsentRuleSummary(loc.absentDeductionMultiplier, settings?.absent_deduction_multiplier ?? 1)}
                                                            </Badge>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-xs space-y-1 py-3">
                                                        <div className="font-mono text-xs text-foreground font-semibold">
                                                            {loc.latitude.toFixed(4)}, {loc.longitude.toFixed(4)}
                                                        </div>
                                                        <div className="text-[10px] text-muted-foreground font-semibold flex items-center gap-1">
                                                            <LocateFixed className="w-3 h-3 text-primary shrink-0" />
                                                            <span>Radius: {loc.radiusMeters}m</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        {loc.isActive ? (
                                                            <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold text-xs">
                                                                <CheckCircle2 className="w-3.5 h-3.5" />
                                                                Active
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1 text-muted-foreground font-semibold text-xs">
                                                                <XCircle className="w-3.5 h-3.5" />
                                                                Inactive
                                                            </span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-right pr-4">
                                                        <div className="flex justify-end gap-1.5">
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-8 w-8 rounded-lg hover:bg-primary/10 hover:text-primary"
                                                                onClick={() => handleEditLocation(loc)}
                                                                title="Edit Branch Settings"
                                                            >
                                                                <Pencil className="w-3.5 h-3.5" />
                                                            </Button>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-8 w-8 rounded-lg text-destructive hover:bg-destructive/10"
                                                                onClick={() => {
                                                                    if (confirm(`Are you sure you want to delete "${loc.name}"?`)) {
                                                                        deleteLocationMutation.mutate({ id: loc.id })
                                                                    }
                                                                }}
                                                                disabled={deleteLocationMutation.isPending}
                                                                title="Delete Branch"
                                                            >
                                                                <Trash2 className="w-3.5 h-3.5" />
                                                            </Button>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            )
                                        })}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* TAB 2: Weekly Schedule & Absent Rule Planner */}
            {activeTab === 'schedule' && (
                <Card className="border border-border/80 shadow-sm overflow-hidden">
                    <CardHeader className="px-4 py-2.5 bg-card border-b border-border/60">
                        <div className="flex items-center gap-2">
                            <CalendarClock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                            <CardTitle className="text-xs sm:text-sm font-bold">
                                Working Schedule & Absent Deduction Planner
                            </CardTitle>
                            <span className="hidden md:inline text-[11px] text-muted-foreground ml-1">
                                • Configure weekly off-days, daily shift hours & absent multipliers
                            </span>
                        </div>
                    </CardHeader>
                    <CardContent className="p-3.5 space-y-3.5">
                        {/* Scope Selector & Save Toolbar right above table */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-2.5 rounded-xl bg-muted/30 border border-border/80">
                            <div className="flex items-center gap-2.5">
                                <Label htmlFor="scheduleScopeSelect" className="text-xs font-bold whitespace-nowrap flex items-center gap-1.5 text-foreground">
                                    <SlidersHorizontal className="w-3.5 h-3.5 text-primary" />
                                    <span>Configure For:</span>
                                </Label>
                                <Select value={selectedScheduleScope} onValueChange={setSelectedScheduleScope}>
                                    <SelectTrigger id="scheduleScopeSelect" className="w-[280px] h-8 text-xs font-bold rounded-lg bg-background">
                                        <SelectValue placeholder="Select Location" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="global" className="font-bold text-primary">
                                            🏢 All Locations (Company Default)
                                        </SelectItem>
                                        {locations?.map((loc) => (
                                            <SelectItem key={loc.id} value={loc.id}>
                                                📍 {loc.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <Button 
                                onClick={handleSaveSchedulePlanner}
                                disabled={updateGlobalSettingsMutation.isPending || updateLocationMutation.isPending}
                                size="sm" 
                                className="h-8 text-xs font-bold gap-1.5 shadow-sm rounded-lg"
                            >
                                {(updateGlobalSettingsMutation.isPending || updateLocationMutation.isPending) && (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                )}
                                Save Schedule & Rules
                            </Button>
                        </div>

                        {/* Day-wise table */}
                        <div className="rounded-xl border border-border overflow-hidden">
                            <Table>
                                <TableHeader className="bg-muted/40">
                                    <TableRow>
                                        <TableHead className="w-[100px] text-xs font-bold">Action</TableHead>
                                        <TableHead className="w-[140px] text-xs font-bold">Day</TableHead>
                                        <TableHead className="text-xs font-bold">Day Status</TableHead>
                                        <TableHead className="text-xs font-bold">Check-In Time</TableHead>
                                        <TableHead className="text-xs font-bold">Check-Out Time</TableHead>
                                        <TableHead className="text-xs font-bold text-right pr-6">Status</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {DAYS.map((day) => {
                                        const isOffDay = scheduleOffDays.includes(day.value)
                                        const isWorkingDay = !isOffDay
                                        const hours = scheduleDailyHours[day.value] || scheduleDailyHours[DAY_INDEX_TO_NAME[day.value]] || {
                                            checkIn: settings?.default_check_in.split(':').slice(0, 2).join(':') || "10:00",
                                            checkOut: settings?.default_check_out.split(':').slice(0, 2).join(':') || "19:00"
                                        }

                                        return (
                                            <TableRow 
                                                key={day.value}
                                                className={cn(
                                                    "transition-colors",
                                                    isWorkingDay ? "hover:bg-muted/20" : "bg-rose-50/20 dark:bg-rose-950/10 hover:bg-rose-50/40"
                                                )}
                                            >
                                                <TableCell>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setScheduleOffDays(prev =>
                                                                prev.includes(day.value)
                                                                    ? prev.filter(d => d !== day.value)
                                                                    : [...prev, day.value]
                                                            )
                                                        }}
                                                        className={cn(
                                                            "flex items-center justify-center size-7 rounded-lg border transition-all",
                                                            isWorkingDay
                                                                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20"
                                                                : "bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20"
                                                        )}
                                                        title={isWorkingDay ? "Click to set as Off Day" : "Click to set as Working Day"}
                                                    >
                                                        {isWorkingDay ? <Check className="size-4" /> : <X className="size-4" />}
                                                    </button>
                                                </TableCell>
                                                <TableCell className="font-bold text-xs">
                                                    {day.label}
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant="outline" className={cn(
                                                        "text-[10px] font-bold uppercase",
                                                        isWorkingDay ? "border-emerald-500/30 text-emerald-600 bg-emerald-500/5" : "border-rose-500/30 text-rose-600 bg-rose-500/5"
                                                    )}>
                                                        {isWorkingDay ? 'Working Day' : 'Weekly Off'}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    <Input
                                                        type="time"
                                                        disabled={isOffDay}
                                                        value={hours.checkIn || '10:00'}
                                                        onChange={(e) => {
                                                            const val = e.target.value
                                                            setScheduleDailyHours(prev => ({
                                                                ...prev,
                                                                [day.value]: {
                                                                    ...(prev[day.value] || hours),
                                                                    checkIn: val
                                                                }
                                                            }))
                                                        }}
                                                        className="w-32 h-8 text-xs font-mono disabled:opacity-40"
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    <Input
                                                        type="time"
                                                        disabled={isOffDay}
                                                        value={hours.checkOut || '19:00'}
                                                        onChange={(e) => {
                                                            const val = e.target.value
                                                            setScheduleDailyHours(prev => ({
                                                                ...prev,
                                                                [day.value]: {
                                                                    ...(prev[day.value] || hours),
                                                                    checkOut: val
                                                                }
                                                            }))
                                                        }}
                                                        className="w-32 h-8 text-xs font-mono disabled:opacity-40"
                                                    />
                                                </TableCell>
                                                <TableCell className="text-right pr-6 font-bold text-xs">
                                                    {isWorkingDay ? (
                                                        <span className="text-emerald-600 dark:text-emerald-400">ACTIVE</span>
                                                    ) : (
                                                        <span className="text-rose-500 dark:text-rose-400">OFF DAY</span>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        )
                                    })}
                                </TableBody>
                            </Table>
                        </div>

                        {/* Absent Deduction Multiplier Box */}
                        <div className="p-4 rounded-xl border border-indigo-100 dark:border-indigo-950 bg-gradient-to-r from-indigo-50/30 to-white dark:from-slate-900/60 dark:to-slate-900/30 space-y-2">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <div>
                                    <div className="text-xs font-bold text-foreground flex items-center gap-2">
                                        <AlertCircle className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                                        Absent Deduction Rule ({selectedScheduleScope === 'global' ? 'Company Default' : 'Branch Specific'})
                                    </div>
                                    <p className="text-[11px] text-muted-foreground mt-0.5">
                                        Specify the multiplier of per-day rate deducted for every unexcused absent day for this scope.
                                    </p>
                                </div>
                                <Select value={scheduleAbsentMultiplier} onValueChange={setScheduleAbsentMultiplier}>
                                    <SelectTrigger className="w-[260px] h-8 text-xs font-bold bg-background">
                                        <SelectValue placeholder="Select Absent Rule" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {selectedScheduleScope !== 'global' && (
                                            <SelectItem value="inherit" className="font-bold text-primary">
                                                🏢 Inherit Company Default ({settings?.absent_deduction_multiplier ?? 1}x)
                                            </SelectItem>
                                        )}
                                        <SelectItem value="1">1 Absent = 1 Day Deduction (1.0x)</SelectItem>
                                        <SelectItem value="2">1 Absent = 2 Days Deduction (2.0x)</SelectItem>
                                        <SelectItem value="3">1 Absent = 3 Days Deduction (3.0x)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* TAB 3: Holidays & Closures View */}
            {activeTab === 'holidays' && (
                <Card className="border border-border/80 shadow-sm overflow-hidden">
                    <CardHeader className="px-4 py-2.5 bg-card border-b border-border/60">
                        <div className="flex items-center gap-2">
                            <Palmtree className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                            <CardTitle className="text-xs sm:text-sm font-bold">
                                Public Holidays & Office Closures
                            </CardTitle>
                            <Badge variant="secondary" className="text-[10px] font-bold h-5 px-1.5">
                                {filteredClosures.length}
                            </Badge>
                            <span className="hidden md:inline text-[11px] text-muted-foreground ml-1">
                                • National paid holidays and regional branch closures
                            </span>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        {/* Filter Branch Toolbar directly above table */}
                        <div className="p-2.5 border-b border-border/60 bg-muted/20 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                            <div className="flex items-center gap-2.5">
                                <Label htmlFor="holidayBranchFilterSelect" className="text-xs font-bold whitespace-nowrap flex items-center gap-1.5 text-foreground">
                                    <SlidersHorizontal className="w-3.5 h-3.5 text-primary" />
                                    <span>Filter Branch:</span>
                                </Label>
                                <Select value={holidayBranchFilter} onValueChange={setHolidayBranchFilter}>
                                    <SelectTrigger id="holidayBranchFilterSelect" className="w-[240px] h-8 text-xs font-bold rounded-lg bg-background">
                                        <SelectValue placeholder="Filter Branch" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">🌐 All Locations & Branches</SelectItem>
                                        <SelectItem value="global">🏢 National / Company-wide Only</SelectItem>
                                        {locations?.map((loc) => (
                                            <SelectItem key={loc.id} value={loc.id}>
                                                📍 {loc.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="text-xs font-medium text-muted-foreground">
                                Showing <span className="font-bold text-foreground">{filteredClosures.length}</span> of {closures?.length || 0} holidays
                            </div>
                        </div>

                        {isLoadingClosures ? (
                            <div className="flex justify-center py-12">
                                <Loader2 className="w-6 h-6 animate-spin text-primary" />
                            </div>
                        ) : filteredClosures.length === 0 ? (
                            <div className="text-center py-12 text-muted-foreground space-y-2">
                                <Palmtree className="w-10 h-10 mx-auto opacity-30" />
                                <p className="text-sm font-semibold">No holidays recorded for this filter</p>
                                <p className="text-xs">Click &quot;Add Holiday&quot; above to schedule national or regional closures</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader className="bg-muted/40">
                                        <TableRow>
                                            <TableHead className="font-bold text-xs pl-6">Date</TableHead>
                                            <TableHead className="font-bold text-xs">Holiday Name / Reason</TableHead>
                                            <TableHead className="font-bold text-xs">Type</TableHead>
                                            <TableHead className="font-bold text-xs">Applies To Scope</TableHead>
                                            <TableHead className="font-bold text-xs text-right pr-6">Action</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredClosures.map((c: any) => {
                                            const locName = c.location_id ? locationsMap.get(c.location_id)?.name || 'Branch Specific' : null

                                            return (
                                                <TableRow key={c.id} className="hover:bg-muted/20 transition-colors">
                                                    <TableCell className="font-bold text-xs pl-6">
                                                        <div className="flex items-center gap-2">
                                                            <div className="p-1.5 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400">
                                                                <CalendarIcon className="w-3.5 h-3.5" />
                                                            </div>
                                                            <span>{format(new Date(c.date), 'MMM dd, yyyy')}</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="font-bold text-xs text-foreground">
                                                        {c.reason}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge variant="outline" className={cn(
                                                            "text-[10px] uppercase font-bold",
                                                            c.type === 'holiday' ? "border-amber-500/30 text-amber-600 bg-amber-500/5" : "border-rose-500/30 text-rose-600 bg-rose-500/5"
                                                        )}>
                                                            {c.type === 'holiday' ? 'Festival Holiday' : 'Office Closed'}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell>
                                                        {locName ? (
                                                            <Badge className="bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/30 font-semibold text-[10px] gap-1">
                                                                <MapPin className="w-3 h-3" />
                                                                📍 {locName}
                                                            </Badge>
                                                        ) : (
                                                            <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 font-semibold text-[10px] gap-1">
                                                                <Globe className="w-3 h-3" />
                                                                🌐 All Branches (National)
                                                            </Badge>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-right pr-6">
                                                        <Button
                                                            size="icon"
                                                            variant="ghost"
                                                            className="text-destructive hover:bg-destructive/10 h-7 w-7 rounded-lg"
                                                            onClick={() => {
                                                                if (confirm(`Remove "${c.reason}" holiday?`)) {
                                                                    deleteClosureMutation.mutate({ id: c.id })
                                                                }
                                                            }}
                                                            disabled={deleteClosureMutation.isPending}
                                                            title="Delete Holiday"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            )
                                        })}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Comprehensive Location Edit/Create Dialog */}
            <Dialog open={isLocationDialogOpen} onOpenChange={setIsLocationDialogOpen}>
                <DialogContent className="sm:max-w-[560px] max-h-[92vh] flex flex-col p-0 overflow-hidden rounded-2xl shadow-2xl border border-border">
                    <DialogHeader className="px-5 pt-4 pb-3 border-b border-border/60 bg-muted/20">
                        <DialogTitle className="text-base font-bold flex items-center gap-2">
                            <Building2 className="w-4 h-4 text-primary" />
                            {editingLocationId ? 'Edit Office Branch & Settings' : 'Add New Office Branch'}
                        </DialogTitle>
                        <DialogDescription className="text-xs">
                            Configure branch geofence boundary, shift timings, weekly schedule, and absent deduction rule
                        </DialogDescription>
                    </DialogHeader>

                    {/* Modal Sub-Tabs */}
                    <div className="px-5 pt-2 border-b border-border/40">
                        <Tabs value={locationDialogTab} onValueChange={(val: any) => setLocationDialogTab(val)} className="w-full">
                            <TabsList className="bg-muted/60 p-0.5 rounded-lg h-8 w-full grid grid-cols-3 text-xs">
                                <TabsTrigger value="geo" className="text-[11px] font-bold">1. Geofence & Location</TabsTrigger>
                                <TabsTrigger value="timing" className="text-[11px] font-bold">2. Timings & Absent</TabsTrigger>
                                <TabsTrigger value="schedule" className="text-[11px] font-bold">3. Weekly Schedule</TabsTrigger>
                            </TabsList>
                        </Tabs>
                    </div>

                    <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
                        {/* TAB 1: Geofence & Location */}
                        {locationDialogTab === 'geo' && (
                            <div className="space-y-4">
                                <div className="space-y-1.5">
                                    <Label htmlFor="branchName" className="text-xs font-bold">Branch Name *</Label>
                                    <Input
                                        id="branchName"
                                        value={locationForm.name}
                                        onChange={(e) => setLocationForm(prev => ({ ...prev, name: e.target.value }))}
                                        placeholder="e.g., KANISHKAM ENTERPRISES, Noida Authority"
                                        className="h-8 text-xs font-medium"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <Label htmlFor="branchAddress" className="text-xs font-bold">Branch Address</Label>
                                    <Input
                                        id="branchAddress"
                                        value={locationForm.address}
                                        onChange={(e) => setLocationForm(prev => ({ ...prev, address: e.target.value }))}
                                        placeholder="Full address, landmarks, city"
                                        className="h-8 text-xs font-medium"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1.5">
                                        <Label htmlFor="branchLat" className="text-xs font-bold">Latitude *</Label>
                                        <Input
                                            id="branchLat"
                                            value={locationForm.latitude}
                                            onChange={(e) => setLocationForm(prev => ({ ...prev, latitude: e.target.value }))}
                                            placeholder="28.6139000"
                                            type="number"
                                            step="0.0000001"
                                            className="h-8 text-xs font-mono"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label htmlFor="branchLng" className="text-xs font-bold">Longitude *</Label>
                                        <Input
                                            id="branchLng"
                                            value={locationForm.longitude}
                                            onChange={(e) => setLocationForm(prev => ({ ...prev, longitude: e.target.value }))}
                                            placeholder="77.2090000"
                                            type="number"
                                            step="0.0000001"
                                            className="h-8 text-xs font-mono"
                                        />
                                    </div>
                                </div>

                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={handleGetCurrentLocation}
                                    disabled={isGettingLocation}
                                    className="w-full h-8 text-xs font-semibold gap-2"
                                >
                                    {isGettingLocation ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LocateFixed className="w-3.5 h-3.5" />}
                                    Use My Current GPS Location
                                </Button>

                                <div className="space-y-2 pt-2">
                                    <div className="flex justify-between items-center">
                                        <Label className="text-xs font-bold">Geofence Radius</Label>
                                        <span className="text-xs font-mono font-bold text-primary">{locationForm.radiusMeters}m</span>
                                    </div>
                                    <Slider
                                        value={[locationForm.radiusMeters]}
                                        onValueChange={(values: number[]) => setLocationForm(prev => ({ ...prev, radiusMeters: values[0] }))}
                                        min={50}
                                        max={1000}
                                        step={50}
                                    />
                                    <p className="text-[10px] text-muted-foreground">
                                        Employees within this radius from coordinates can record mobile check-in.
                                    </p>
                                </div>

                                {editingLocationId && (
                                    <div className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border border-border mt-3">
                                        <div>
                                            <p className="text-xs font-bold">Active Branch Status</p>
                                            <p className="text-[10px] text-muted-foreground">Inactive branches prevent attendance marking</p>
                                        </div>
                                        <Switch
                                            checked={locationForm.isActive}
                                            onCheckedChange={(checked) => setLocationForm(prev => ({ ...prev, isActive: checked }))}
                                        />
                                    </div>
                                )}
                            </div>
                        )}

                        {/* TAB 2: Shift Timings, Grace Buffer & Absent Rule */}
                        {locationDialogTab === 'timing' && (
                            <div className="space-y-4">
                                <div className="p-3.5 rounded-xl border border-indigo-100 dark:border-indigo-950 bg-indigo-50/40 dark:bg-indigo-950/20 space-y-3">
                                    <div className="flex items-center gap-2">
                                        <Clock className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                                        <span className="text-xs font-bold text-foreground">Office Timing & Extra Hours Grace Setup</span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1.5">
                                            <Label htmlFor="locCheckIn" className="text-xs font-semibold">Office Start (In Time)</Label>
                                            <Input
                                                id="locCheckIn"
                                                type="time"
                                                step="1"
                                                value={locationForm.checkInTime.slice(0, 8)}
                                                onChange={(e) => setLocationForm(prev => ({ ...prev, checkInTime: e.target.value.length === 5 ? `${e.target.value}:00` : e.target.value }))}
                                                className="h-8 text-xs font-mono"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label htmlFor="locCheckOut" className="text-xs font-semibold">Office End (Out Time)</Label>
                                            <Input
                                                id="locCheckOut"
                                                type="time"
                                                step="1"
                                                value={locationForm.checkOutTime.slice(0, 8)}
                                                onChange={(e) => setLocationForm(prev => ({ ...prev, checkOutTime: e.target.value.length === 5 ? `${e.target.value}:00` : e.target.value }))}
                                                className="h-8 text-xs font-mono"
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-1.5 pt-1">
                                        <div className="flex justify-between items-center">
                                            <Label htmlFor="locBuffer" className="text-xs font-semibold">Overtime Grace / Buffer</Label>
                                            <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">±{locationForm.bufferMinutes} mins</span>
                                        </div>
                                        <Input
                                            id="locBuffer"
                                            type="number"
                                            min="0"
                                            max="180"
                                            value={locationForm.bufferMinutes}
                                            onChange={(e) => setLocationForm(prev => ({ ...prev, bufferMinutes: parseInt(e.target.value, 10) || 0 }))}
                                            className="h-8 text-xs font-mono"
                                        />
                                        <p className="text-[10px] text-muted-foreground leading-tight">
                                            Punches within {locationForm.bufferMinutes} min of shift time will not count as extra hours. Exceeding {locationForm.bufferMinutes} min counts full early/late time as extra hours.
                                        </p>
                                    </div>
                                </div>

                                {/* Absent Deduction Setting */}
                                <div className="p-3.5 rounded-xl border border-rose-100 dark:border-rose-950 bg-rose-50/30 dark:bg-rose-950/20 space-y-2">
                                    <Label className="text-xs font-bold text-foreground flex items-center gap-2">
                                        <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                                        Absent Deduction Rule for this Branch
                                    </Label>
                                    <p className="text-[10px] text-muted-foreground">
                                        Choose whether this location uses the company-wide default or has a dedicated absent deduction multiplier.
                                    </p>
                                    <Select 
                                        value={locationForm.absentDeductionMultiplier} 
                                        onValueChange={(val) => setLocationForm(prev => ({ ...prev, absentDeductionMultiplier: val }))}
                                    >
                                        <SelectTrigger className="w-full h-8 text-xs font-bold bg-background">
                                            <SelectValue placeholder="Select Absent Rule" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="inherit" className="font-bold text-primary">
                                                🏢 Inherit Company Default ({settings?.absent_deduction_multiplier ?? 1}x)
                                            </SelectItem>
                                            <SelectItem value="1">1 Absent = 1 Day Deduction (1.0x)</SelectItem>
                                            <SelectItem value="2">1 Absent = 2 Days Deduction (2.0x)</SelectItem>
                                            <SelectItem value="3">1 Absent = 3 Days Deduction (3.0x)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        )}

                        {/* TAB 3: Weekly Working Schedule */}
                        {locationDialogTab === 'schedule' && (
                            <div className="space-y-3">
                                <div className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border border-border">
                                    <div>
                                        <p className="text-xs font-bold">Custom Weekly Schedule</p>
                                        <p className="text-[10px] text-muted-foreground">
                                            Enable to set specific working/off days for this branch instead of company default.
                                        </p>
                                    </div>
                                    <Switch
                                        checked={locationForm.useCustomSchedule}
                                        onCheckedChange={(checked) => setLocationForm(prev => ({ ...prev, useCustomSchedule: checked }))}
                                    />
                                </div>

                                {locationForm.useCustomSchedule ? (
                                    <div className="space-y-1.5 border border-border rounded-xl p-2.5 bg-background">
                                        {DAYS.map((day) => {
                                            const isOff = locationForm.offDays.includes(day.value)
                                            const isWorking = !isOff
                                            return (
                                                <div 
                                                    key={day.value}
                                                    className={cn(
                                                        "flex items-center justify-between p-2 rounded-lg text-xs transition-colors",
                                                        isWorking ? "bg-muted/30" : "bg-rose-50/50 dark:bg-rose-950/20"
                                                    )}
                                                >
                                                    <span className="font-bold">{day.label}</span>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setLocationForm(prev => ({
                                                                ...prev,
                                                                offDays: prev.offDays.includes(day.value)
                                                                    ? prev.offDays.filter(d => d !== day.value)
                                                                    : [...prev.offDays, day.value]
                                                            }))
                                                        }}
                                                        className={cn(
                                                            "px-2.5 py-1 rounded-md text-[10px] font-bold uppercase transition-all",
                                                            isWorking
                                                                ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                                                                : "bg-rose-500/10 text-rose-600 border border-rose-500/20"
                                                        )}
                                                    >
                                                        {isWorking ? '🟢 Working Day' : '🔴 Off Day'}
                                                    </button>
                                                </div>
                                            )
                                        })}
                                    </div>
                                ) : (
                                    <div className="p-4 text-center rounded-xl border border-dashed text-xs text-muted-foreground space-y-1">
                                        <CalendarClock className="w-6 h-6 mx-auto opacity-40 mb-1" />
                                        <p className="font-semibold text-foreground">Inheriting Company Default Schedule</p>
                                        <p className="text-[11px]">{formatScheduleSummary(settings?.off_days)}</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <DialogFooter className="px-5 py-3 border-t border-border/60 bg-muted/20 flex justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => setIsLocationDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button 
                            size="sm" 
                            onClick={handleSaveLocation}
                            disabled={addLocationMutation.isPending || updateLocationMutation.isPending}
                            className="font-bold text-xs"
                        >
                            {(addLocationMutation.isPending || updateLocationMutation.isPending) && (
                                <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                            )}
                            {editingLocationId ? 'Update Branch' : 'Create Branch'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Quick Add Holiday Modal */}
            <Dialog open={isHolidayDialogOpen} onOpenChange={setIsHolidayDialogOpen}>
                <DialogContent className="sm:max-w-[440px] p-0 overflow-hidden rounded-2xl shadow-xl border border-border">
                    <DialogHeader className="px-5 pt-4 pb-3 border-b border-border/60 bg-muted/20">
                        <DialogTitle className="text-base font-bold flex items-center gap-2">
                            <Palmtree className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                            Add Public Holiday or Closure
                        </DialogTitle>
                        <DialogDescription className="text-xs">
                            Define date and assign whether it applies company-wide or to a specific branch
                        </DialogDescription>
                    </DialogHeader>

                    <div className="p-5 space-y-3.5">
                        <div className="space-y-1.5">
                            <Label htmlFor="holidayDate" className="text-xs font-bold">Holiday Date *</Label>
                            <Input
                                id="holidayDate"
                                type="date"
                                value={newHolidayDate}
                                onChange={(e) => setNewHolidayDate(e.target.value)}
                                className="h-8 text-xs font-mono"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="holidayReason" className="text-xs font-bold">Holiday Name / Reason *</Label>
                            <Input
                                id="holidayReason"
                                placeholder="e.g., Independence Day, Chhath Puja, State Holiday"
                                value={newHolidayReason}
                                onChange={(e) => setNewHolidayReason(e.target.value)}
                                className="h-8 text-xs"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="holidayType" className="text-xs font-bold">Closure Type</Label>
                            <Select value={newHolidayType} onValueChange={(val: any) => setNewHolidayType(val)}>
                                <SelectTrigger id="holidayType" className="h-8 text-xs bg-background">
                                    <SelectValue placeholder="Select Type" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="holiday">Festival Holiday (Paid)</SelectItem>
                                    <SelectItem value="closed">Office Closure / Maintenance</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="holidayScope" className="text-xs font-bold">Applies To</Label>
                            <Select value={newHolidayLocationId} onValueChange={setNewHolidayLocationId}>
                                <SelectTrigger id="holidayScope" className="h-8 text-xs font-bold bg-background">
                                    <SelectValue placeholder="Select Scope" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="global" className="font-bold text-primary">
                                        🌐 All Locations (National / Company-wide)
                                    </SelectItem>
                                    {locations?.map((loc) => (
                                        <SelectItem key={loc.id} value={loc.id}>
                                            📍 {loc.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <DialogFooter className="px-5 py-3 border-t border-border/60 bg-muted/20 flex justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => setIsHolidayDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button
                            size="sm"
                            disabled={!newHolidayDate || !newHolidayReason.trim() || addClosureMutation.isPending}
                            onClick={() => {
                                addClosureMutation.mutate({
                                    date: newHolidayDate,
                                    reason: newHolidayReason.trim(),
                                    type: newHolidayType,
                                    locationId: newHolidayLocationId === 'global' ? null : newHolidayLocationId,
                                })
                            }}
                            className="font-bold text-xs"
                        >
                            {addClosureMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />}
                            Save Holiday
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}

export default AdminOfficeHub
