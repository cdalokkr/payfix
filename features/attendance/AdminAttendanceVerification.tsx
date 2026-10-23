"use client"

import React, { useState, useMemo, useEffect, useCallback, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { trpc } from "@/lib/trpc/client"
import { Search, Loader2, FileText, Save, Clock as ClockIcon, CheckCircle2 as CheckCircleIcon, XCircle as XCircleIcon, CalendarMinus as CalendarMinusIcon, Upload, Users as UsersIcon, UserX as UserXIcon, LogIn as LogInIcon, LogOut as LogOutIcon, Fingerprint as FingerprintIcon, AlertCircle as AlertCircleIcon, Layers as LayersIcon } from "lucide-react"
import { toast } from "sonner"
import { getEventBroadcaster } from "@/lib/events/event-broadcaster"
import { Label } from "@/components/ui/label"
import { CompactMetricCard } from "@/components/dashboard/compact-metric-card"
import { cn } from "@/lib/utils"
import { useSharedManagementChannel } from "@/hooks/use-shared-management-channel"
import { useProfile } from "@/lib/context/profile-context"

import { createAttendanceColumns, getRecordDayType } from "./attendance-columns"
import { DataTable } from "@/components/ui/data-table"
import { ProfileInfoCell } from "@/components/dashboard/profile-info-cell"
import { format } from "date-fns"
import { DateRange } from "react-day-picker"
import { generateCSV, generatePDF, downloadFile } from "@/lib/report-utils"
import { AttendanceTableToolbar } from "./attendance-table-toolbar"
import { AttendanceEditDialog } from "./attendance-edit-dialog"
import { AttendanceSessionsDrawer } from "./attendance-sessions-drawer"
import { BulkDailyUpload } from "./BulkDailyUpload"
import { CardShell } from "./CardShell"
import { Badge } from "@/components/ui/badge"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"

// Helper to calculate scheduled hours from time strings
function calculateScheduledHours(checkIn: string, checkOut: string): number {
    const [inH, inM] = checkIn.split(':').map(Number)
    const [outH, outM] = checkOut.split(':').map(Number)
    const inMinutes = inH * 60 + inM
    const outMinutes = outH * 60 + outM
    return (outMinutes - inMinutes) / 60
}

export function AdminAttendanceVerification() {
    const [employeeFilter, setEmployeeFilter] = useState('all')
    const [searchQuery, setSearchQuery] = useState("")
    const [isEditOpen, setIsEditOpen] = useState(false)
    const [isBulkUploadOpen, setIsBulkUploadOpen] = useState(false)
    const [selectedRecord, setSelectedRecord] = useState<any>(null)
    const [sessionsDialogRecord, setSessionsDialogRecord] = useState<any>(null)
    const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({})
    // Default to current date (IST) and all statuses for full logging visibility
    const [verificationFilter, setVerificationFilter] = useState('all')
    const [dayTypeFilter, setDayTypeFilter] = useState('all')
    const [activeQuickFilter, setActiveQuickFilter] = useState<'all' | 'in_office' | 'checked_out' | 'verified' | 'pending' | 'rejected' | 'leave' | 'absent'>('all')
    const [isFiltering, setIsFiltering] = useState(false)

    // Helper wrappers for filter changes to simulate a quick tactile spinner
    const handleVerificationFilterChange = (val: string) => {
        setIsFiltering(true)
        setVerificationFilter(val)
        setTimeout(() => setIsFiltering(false), 200)
    }

    const handleDayTypeFilterChange = (val: string) => {
        setIsFiltering(true)
        setDayTypeFilter(val)
        setTimeout(() => setIsFiltering(false), 200)
    }

    const handleEmployeeFilterChange = (val: string) => {
        setIsFiltering(true)
        setEmployeeFilter(val)
        setTimeout(() => setIsFiltering(false), 200)
    }

    const handleSearchQueryChange = (val: string) => {
        setIsFiltering(true)
        setSearchQuery(val)
        setTimeout(() => setIsFiltering(false), 200)
    }

    const [dateFilter, setDateFilter] = useState<DateRange | undefined>({
        from: new Date(),
        to: new Date()
    })
    const [mounted, setMounted] = useState(false)
    const [verificationDialog, setVerificationDialog] = useState<{
        isOpen: boolean;
        record: any;
        action: 'verified' | 'rejected' | null;
        status: 'idle' | 'processing' | 'success' | 'error';
        message?: string;
    }>({
        isOpen: false,
        record: null,
        action: null,
        status: 'idle',
    })

    const [bulkVerificationDialog, setBulkVerificationDialog] = useState<{
        isOpen: boolean;
        selectedIds: string[];
        action: 'verified' | 'rejected' | null;
        status: 'idle' | 'processing' | 'success' | 'error';
        currentProgress: number;
        totalRecords: number;
        currentRecordName?: string;
        message?: string;
    }>({
        isOpen: false,
        selectedIds: [],
        action: null,
        status: 'idle',
        currentProgress: 0,
        totalRecords: 0,
        currentRecordName: '',
    })

    const isBulkProcessingRef = useRef(false)

    useEffect(() => {
        setMounted(true)
    }, [])

    const utils = trpc.useUtils()
    const { profile } = useProfile()
    const { subscribe } = useSharedManagementChannel()

    // Queries with real-time friendly settings - staleTime: 0 ensures immediate refetch on invalidation
    const { data: attendance, isLoading, isFetching, refetch: refetchAttendance } = trpc.attendance.getAttendance.useQuery(
        {
            mode: 'all',
            startDate: dateFilter?.from ? format(dateFilter.from, 'yyyy-MM-dd') : undefined,
            endDate: dateFilter?.to ? format(dateFilter.to, 'yyyy-MM-dd') : undefined,
        },
        {
            staleTime: 0, // Always consider stale so invalidation triggers immediate refetch
            refetchOnWindowFocus: false, // Rely on real-time instead
            placeholderData: (prev) => prev, // Retain old data on screen while background refetch runs
        }
    )

    const bulkVerifyMutation = trpc.attendance.bulkVerifyAttendance.useMutation({
        onSuccess: () => {
            toast.success('Successfully updated records')
            setRowSelection({})
            utils.attendance.getAttendance.invalidate()
            refetchAttendance()
        },
        onError: (error) => toast.error(error.message)
    })
    const { data: settings } = trpc.attendance.getOfficeSettings.useQuery()

    // Subscribe to shared management channel for real-time updates
    // Data table needs to update on ALL actions (clock-in, clock-out, verified, rejected)
    // because it shows checkout times and status changes
    useEffect(() => {
        if (!profile?.id) return

        const unsubscribe = subscribe((category, payload) => {
            if (category === 'attendance_update' || category === 'dashboard_sync') {
                const action = payload?.action || 'unknown'
                console.log(`[ATTENDANCE-VERIFICATION] Received ${action} via shared channel, refetching table...`)
                refetchAttendance()
            }
        })

        return unsubscribe
    }, [profile?.id, subscribe, refetchAttendance])

    const scheduledHoursMap = useMemo(() => {
        const map: Record<number, number> = {}
        if (!settings) return map

        const defaultScheduledHours = calculateScheduledHours(
            settings.default_check_in,
            settings.default_check_out
        )

        for (let i = 0; i < 7; i++) map[i] = defaultScheduledHours

        if (settings.daily_working_hours) {
            Object.entries(settings.daily_working_hours).forEach(([dayStr, times]: [string, any]) => {
                const day = parseInt(dayStr, 10)
                if (!isNaN(day) && times?.checkIn && times?.checkOut) {
                    map[day] = calculateScheduledHours(times.checkIn, times.checkOut)
                }
            })
        }
        return map
    }, [settings])

    const verifyMutation = trpc.attendance.verifyAttendance.useMutation({
        onSuccess: (data) => {
            if (!isBulkProcessingRef.current) {
                toast.success(`Attendance marked as ${data.status}`)
            }
            utils.attendance.getAttendance.invalidate()
            refetchAttendance()
        },
        onError: (error) => {
            if (!isBulkProcessingRef.current) {
                toast.error(error.message)
            }
        }
    })

    const handleExecuteVerification = async () => {
        if (!verificationDialog.record || !verificationDialog.action) return

        setVerificationDialog(prev => ({ ...prev, status: 'processing' }))

        try {
            await verifyMutation.mutateAsync({
                id: verificationDialog.record.id,
                status: verificationDialog.action,
                remarks: verificationDialog.record.remarks ?? undefined,
                isHalfDay: verificationDialog.record.is_half_day ?? undefined
            })

            // Mark verification dialog as success immediately
            setVerificationDialog(prev => ({ ...prev, status: 'success' }))

            // Invalidate/refetch immediately in active mode so KPI metric cards update
            await utils.attendance.getAttendance.invalidate()
            refetchAttendance()

        } catch (error: any) {
            setVerificationDialog(prev => ({
                ...prev,
                status: 'error',
                message: error?.message || 'Something went wrong'
            }))
        }
    }

    const handleExecuteBulkVerification = async () => {
        const { selectedIds, action } = bulkVerificationDialog
        if (selectedIds.length === 0 || !action) return

        isBulkProcessingRef.current = true
        setBulkVerificationDialog(prev => ({ ...prev, status: 'processing', currentProgress: 0 }))

        let successCount = 0
        let errorCount = 0

        for (const id of selectedIds) {
            const record = attendance?.find(r => r.id === id)
            setBulkVerificationDialog(prev => ({
                ...prev,
                currentRecordName: record?.profile?.full_name || 'Unknown'
            }))

            try {
                await verifyMutation.mutateAsync({
                    id,
                    status: action,
                    remarks: record?.remarks ?? undefined,
                    isHalfDay: record?.is_half_day ?? undefined
                })
                successCount++
            } catch (err) {
                console.error(`Failed to verify ${id}:`, err)
                errorCount++
            }

            setBulkVerificationDialog(prev => ({
                ...prev,
                currentProgress: prev.currentProgress + 1
            }))
        }

        // Sync/refresh immediately after all records complete
        await utils.attendance.getAttendance.invalidate()
        refetchAttendance()

        setBulkVerificationDialog(prev => ({
            ...prev,
            status: errorCount === 0 ? 'success' : errorCount === selectedIds.length ? 'error' : 'success',
            currentProgress: selectedIds.length,
            currentRecordName: '',
            message: `Successfully processed ${successCount} record(s).` + (errorCount > 0 ? ` Failed: ${errorCount}.` : '')
        }))

        // Reset row selection upon success
        if (successCount > 0) {
            setRowSelection({})
        }
        isBulkProcessingRef.current = false
    }

    const manualUpdateMutation = trpc.attendance.manualUpdate.useMutation({
        onSuccess: (data: any) => {
            toast.success("Record updated successfully")
            handleOpenChange(false)
            utils.attendance.getAttendance.invalidate()
            refetchAttendance()
        },
        onError: (error) => toast.error(error.message)
    })

    // Report Downloading Logic
    const [isDownloading, setIsDownloading] = useState(false)

    const handleDownloadReport = async (formatType: 'csv' | 'pdf') => {
        setIsDownloading(true)
        try {
            const dataToExport = filteredAttendance || []

            if (dataToExport.length === 0) {
                toast.error('No data to download')
                setIsDownloading(false)
                return
            }

            // Sort by date ascending
            const sortedData = [...dataToExport].sort((a: any, b: any) =>
                new Date(a.date).getTime() - new Date(b.date).getTime()
            )

            // Detect if all records belong to one employee (name-filtered)
            const uniqueNames = new Set(sortedData.map((r: any) => r.profile?.full_name))
            const isSingleEmployee = (uniqueNames.size === 1 && searchQuery.trim().length > 0) || employeeFilter !== 'all';

            let headers: string[]
            let rows: string[][]
            let metaRow: string[] | undefined

            if (isSingleEmployee) {
                const first = sortedData[0] as any
                const empName = first.profile?.full_name || 'Unknown'
                const empDesignation = first.profile?.designation?.name || 'N/A'
                // CSV cell positions: A1 empty, B1=Employee Name:, C1 empty, D1=value, E1 empty, F1=Designation:, G1 empty, H1=value
                metaRow = ['', 'Employee Name:', '', empName, '', 'Designation:', '', empDesignation]

                headers = ['Sr', 'Date', 'Clock In', 'Clock Out', 'Total Hours', 'Extra Hours', 'Status', 'Day Type', 'Office Location']
                rows = sortedData.map((record: any, index: number) => {
                    const workingHours = Number(record.working_hours) || 0
                    const dayOfWeek = new Date(record.date).getDay()
                    const scheduled = scheduledHoursMap[dayOfWeek] ?? 9
                    const extraHours = Math.max(0, workingHours - scheduled)

                    return [
                        String(index + 1),
                        record.date,
                        record.check_in ? new Date(record.check_in).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) : '-',
                        record.check_out ? new Date(record.check_out).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) : '-',
                        workingHours ? `${workingHours.toFixed(1)}h` : '-',
                        extraHours > 0 ? `+${extraHours.toFixed(1)}h` : '0h',
                        record.status || '-',
                        record.is_half_day ? 'Half Day' : 'Full Day',
                        record.checkin_location_name || '-'
                    ]
                })
            } else {
                headers = ['Sr', 'Employee', 'Designation', 'Date', 'Clock In', 'Clock Out', 'Total Hours', 'Extra Hours', 'Status', 'Day Type', 'Office Location']
                rows = sortedData.map((record: any, index: number) => {
                    const workingHours = Number(record.working_hours) || 0
                    const dayOfWeek = new Date(record.date).getDay()
                    const scheduled = scheduledHoursMap[dayOfWeek] ?? 9
                    const extraHours = Math.max(0, workingHours - scheduled)

                    return [
                        String(index + 1),
                        record.profile?.full_name || 'Unknown',
                        record.profile?.designation?.name || 'N/A',
                        record.date,
                        record.check_in ? new Date(record.check_in).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) : '-',
                        record.check_out ? new Date(record.check_out).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) : '-',
                        workingHours ? `${workingHours.toFixed(1)}h` : '-',
                        extraHours > 0 ? `+${extraHours.toFixed(1)}h` : '0h',
                        record.status || '-',
                        record.is_half_day ? 'Half Day' : 'Full Day',
                        record.checkin_location_name || '-'
                    ]
                })
            }

            const filename = `attendance_report_${format(new Date(), 'yyyy-MM-dd_HH-mm')}`

            if (formatType === 'csv') {
                const csvLines: string[] = []
                // Single-employee: first row has Employee Name at B1 and Designation at F1
                if (metaRow) csvLines.push(metaRow.map(cell => `"${(cell || '').replace(/"/g, '""')}"`).join(','))
                csvLines.push(headers.join(','))
                rows.forEach(row => csvLines.push(row.map(cell => `"${(cell || '').replace(/"/g, '""')}"`).join(',')))
                const csvContent = csvLines.join('\n')
                downloadFile(csvContent, `${filename}.csv`, 'text/csv')
            } else {
                const first = sortedData[0] as any
                const title = isSingleEmployee
                    ? `Attendance Report\nEmployee Name: ${first.profile?.full_name || 'Unknown'}  |  Designation: ${first.profile?.designation?.name || 'N/A'}`
                    : "Attendance Report"
                await generatePDF(title, headers, rows, `${filename}.pdf`)
            }

            toast.success(`${formatType.toUpperCase()} report downloaded successfully`)

        } catch (error: any) {
            toast.error(error.message || 'Failed to download report')
        } finally {
            setIsDownloading(false)
        }
    }

    const uniqueDates = useMemo(() => {
        if (!attendance) return []
        const dates = attendance.map(a => a.date)
        return Array.from(new Set(dates)).sort().reverse()
    }, [attendance])

    const uniqueEmployees = useMemo(() => {
        if (!attendance) return [];
        const seen = new Set<string>();
        const list: any[] = [];
        attendance.forEach(record => {
            if (record.profile) {
                const empId = record.profile.id || record.profile_id;
                if (empId && !seen.has(empId)) {
                    seen.add(empId);
                    list.push({
                        ...record.profile,
                        id: empId
                    });
                }
            }
        });
        return list.sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''));
    }, [attendance])

    const searchFilteredAttendance = useMemo(() => {
        return attendance?.filter(record => {
            const matchesEmployee = employeeFilter === 'all' || record.profile_id === employeeFilter;
            const matchesQuery = !searchQuery ||
                record.profile?.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                record.profile?.designation?.name?.toLowerCase().includes(searchQuery.toLowerCase());
            return matchesEmployee && matchesQuery;
        })
    }, [attendance, employeeFilter, searchQuery])

    const filteredAttendance = useMemo(() => {
        return searchFilteredAttendance?.filter(record => {
            // Match dynamic quick metric card filter
            if (activeQuickFilter !== 'all') {
                const sessions: any[] = record.sessions || [];
                const isCurrentlyIn = record.current_session_status === 'checked_in' || 
                    sessions.some((s: any) => !s.check_out && s.status !== 'rejected');
                const hasPunches = Boolean(record.check_in || sessions.length > 0);

                if (activeQuickFilter === 'in_office') {
                    if (!isCurrentlyIn) return false;
                } else if (activeQuickFilter === 'checked_out') {
                    if (isCurrentlyIn || !hasPunches) return false;
                } else if (activeQuickFilter === 'verified') {
                    const hasUnverified = record.status === 'pending' || sessions.some((s: any) => s.status !== 'verified' && s.status !== 'rejected');
                    if (record.status !== 'verified' || hasUnverified) return false;
                } else if (activeQuickFilter === 'pending') {
                    const hasUnverified = record.status === 'pending' || sessions.some((s: any) => s.status !== 'verified' && s.status !== 'rejected');
                    if (!hasPunches || !hasUnverified) return false;
                } else if (activeQuickFilter === 'rejected') {
                    const isRejected = record.status === 'rejected' || sessions.some((s: any) => s.status === 'rejected');
                    if (!isRejected) return false;
                } else if (activeQuickFilter === 'leave') {
                    if (getRecordDayType(record) !== 'On Leave') return false;
                } else if (activeQuickFilter === 'absent') {
                    if (getRecordDayType(record) !== 'Absent') return false;
                }
            }

            // Match verification dropdown filter
            let matchesVerification = true;
            const status = record.status as string;
            
            if (verificationFilter !== 'all') {
                if (verificationFilter === 'verified') {
                    matchesVerification = status === 'verified';
                } else if (verificationFilter === 'rejected') {
                    matchesVerification = status === 'rejected';
                } else if (verificationFilter === 'pending') {
                    matchesVerification = status === 'pending' || (!['verified', 'rejected', 'pending'].includes(status));
                }
            }
            
            // Match day type dropdown filter
            let matchesDayType = true;
            if (dayTypeFilter !== 'all') {
                matchesDayType = getRecordDayType(record) === dayTypeFilter;
            }
            
            return matchesVerification && matchesDayType;
        })
    }, [searchFilteredAttendance, activeQuickFilter, verificationFilter, dayTypeFilter])

    const handleEdit = useCallback((record: any) => {
        setRowSelection({ [record.id]: true })
        setSelectedRecord(record)
        setIsEditOpen(true)
    }, [])

    const handleOpenChange = useCallback((open: boolean) => {
        setIsEditOpen(open)
        if (!open) {
            setRowSelection({})
            setSelectedRecord(null)
            manualUpdateMutation.reset()
        }
    }, [manualUpdateMutation])

    const handleBulkVerify = useCallback((action: 'verified' | 'rejected') => {
        const selectedIds = Object.keys(rowSelection).filter(id => rowSelection[id])
        if (selectedIds.length === 0) return
        setBulkVerificationDialog({
            isOpen: true,
            selectedIds,
            action,
            status: 'idle',
            currentProgress: 0,
            totalRecords: selectedIds.length,
            currentRecordName: '',
        })
    }, [rowSelection])

    const columns = useMemo(() => createAttendanceColumns({
        onVerify: (record) => {
            setVerificationDialog({
                isOpen: true,
                record,
                action: 'verified',
                status: 'idle',
            })
        },
        onReject: (record) => {
            setVerificationDialog({
                isOpen: true,
                record,
                action: 'rejected',
                status: 'idle',
            })
        },
        onEdit: handleEdit,
        onViewSessions: (record) => setSessionsDialogRecord(record),
        isVerifying: false, // Dialog handles its own loading status
        scheduledHoursMap
    }), [scheduledHoursMap, handleEdit])

    const getRowId = useCallback((row: any) => row.id, [])

    const stats = useMemo(() => {
        const list = attendance || [];
        
        let inOffice = 0;       // Currently in office (active session open now)
        let checkedOut = 0;     // Punched today and currently checked out
        let verified = 0;       // Fully verified records
        let pending = 0;        // Needs verification (pending sessions or pending record)
        let rejected = 0;       // Rejected sessions or record
        let leave = 0;          // On leave
        let totalSessionsCount = 0; // Total punch sessions recorded across all employees today
        let halfDay = 0;
        let absent = 0;

        list.forEach(a => {
            const dayType = getRecordDayType(a);
            const status = a.status as string;
            const sessions: any[] = a.sessions || [];
            
            const hasPunches = Boolean(a.check_in || sessions.length > 0);
            const isCurrentlyIn = a.current_session_status === 'checked_in' || 
                sessions.some((s: any) => !s.check_out && s.status !== 'rejected');
            
            if (isCurrentlyIn) {
                inOffice++;
            } else if (hasPunches) {
                checkedOut++;
            }

            // Total sessions count across all employees
            totalSessionsCount += (sessions.length || (hasPunches ? 1 : 0));

            // Verification status:
            const hasUnverified = status === 'pending' || sessions.some((s: any) => s.status !== 'verified' && s.status !== 'rejected');
            if (status === 'verified' && !hasUnverified) {
                verified++;
            } else if (status === 'rejected') {
                rejected++;
            } else if (hasPunches && hasUnverified) {
                pending++;
            }

            if (a.is_half_day) halfDay++;
            if (dayType === 'On Leave') leave++;
            if (dayType === 'Absent') absent++;
        });

        return {
            inOffice,
            checkedOut,
            verified,
            pending,
            rejected,
            leave,
            totalSessionsCount,
            halfDay,
            absent,
            total: list.length,
            all: list.length,
            present: inOffice + checkedOut,
            weekly_off: 0,
            holiday: 0,
            extra_day: 0,
            noOfficeOut: 0
        };
    }, [attendance])

    if (!mounted) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="size-8 animate-spin text-primary/20" />
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
                <CompactMetricCard
                    label="In Office"
                    value={stats.inOffice}
                    icon={LogInIcon}
                    theme="emerald"
                    delay={0.05}
                    loading={isLoading || isFetching}
                    active={activeQuickFilter === 'in_office'}
                    onClick={() => setActiveQuickFilter(prev => prev === 'in_office' ? 'all' : 'in_office')}
                    subtitle={stats.inOffice === 1 ? "1 active in office" : `${stats.inOffice} active now`}
                />
                <CompactMetricCard
                    label="Checked Out"
                    value={stats.checkedOut}
                    icon={LogOutIcon}
                    theme="amber"
                    delay={0.1}
                    loading={isLoading || isFetching}
                    active={activeQuickFilter === 'checked_out'}
                    onClick={() => setActiveQuickFilter(prev => prev === 'checked_out' ? 'all' : 'checked_out')}
                    subtitle={stats.checkedOut === 1 ? "1 out now" : `${stats.checkedOut} completed`}
                />
                <CompactMetricCard
                    label="Verified"
                    value={stats.verified}
                    icon={CheckCircleIcon}
                    theme="green"
                    delay={0.15}
                    loading={isLoading || isFetching}
                    active={activeQuickFilter === 'verified'}
                    onClick={() => setActiveQuickFilter(prev => prev === 'verified' ? 'all' : 'verified')}
                    subtitle="Approved records"
                />
                <CompactMetricCard
                    label="Absent"
                    value={stats.absent}
                    icon={UserXIcon}
                    theme="rose"
                    delay={0.2}
                    loading={isLoading || isFetching}
                    active={activeQuickFilter === 'absent'}
                    onClick={() => setActiveQuickFilter(prev => prev === 'absent' ? 'all' : 'absent')}
                    subtitle={stats.absent === 1 ? "1 absent" : `${stats.absent} absent`}
                />
                <CompactMetricCard
                    label="Sessions Today"
                    value={stats.totalSessionsCount}
                    icon={FingerprintIcon}
                    theme="indigo"
                    delay={0.25}
                    loading={isLoading || isFetching}
                    active={activeQuickFilter === 'all'}
                    onClick={() => setActiveQuickFilter('all')}
                    subtitle="Multi-sessions"
                />
                <CompactMetricCard
                    label="On Leave"
                    value={stats.leave}
                    icon={CalendarMinusIcon}
                    theme="rose"
                    delay={0.3}
                    loading={isLoading || isFetching}
                    active={activeQuickFilter === 'leave'}
                    onClick={() => setActiveQuickFilter(prev => prev === 'leave' ? 'all' : 'leave')}
                    subtitle={stats.leave === 1 ? "1 on leave" : `${stats.leave} on leave`}
                />
            </div>

            <CardShell
                title="Attendance Logs"
                description="Review and verify employee attendance records for processing."
                icon={FileText}
                contentClassName="min-h-0 p-3 md:p-4 pt-1.5 md:pt-2 h-full overflow-auto"
                headerActions={
                    <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5 rounded-xl h-8 text-xs"
                        onClick={() => setIsBulkUploadOpen(true)}
                    >
                        <Upload className="h-3.5 w-3.5" />
                        Bulk Upload
                    </Button>
                }
            >
                                {activeQuickFilter !== 'all' && (
                    <div className="mb-3 flex items-center justify-between px-3 py-1.5 rounded-xl bg-primary/10 border border-primary/20 text-xs">
                        <span className="font-semibold text-primary flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                            Filtered by: <strong className="capitalize text-foreground">{activeQuickFilter.replace('_', ' ')}</strong> ({filteredAttendance?.length || 0} records)
                        </span>
                        <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 px-2 text-[11px] font-bold text-muted-foreground hover:text-foreground"
                            onClick={() => setActiveQuickFilter('all')}
                        >
                            Reset Filter (Show All)
                        </Button>
                    </div>
                )}
                <div className="relative">
                    {(isFiltering || (isFetching && !isLoading)) && (
                        <div className="absolute inset-0 bg-white/50 dark:bg-slate-950/50 backdrop-blur-[1px] flex items-center justify-center z-10 rounded-xl transition-all duration-200">
                            <div className="flex flex-col items-center gap-2 p-3 rounded-2xl bg-white dark:bg-slate-900 shadow-xl border border-slate-100 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-150">
                                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                                <span className="text-[10px] font-bold text-muted-foreground">
                                    {isFiltering ? "Filtering logs..." : "Refreshing attendance logs..."}
                                </span>
                            </div>
                        </div>
                    )}
                    <DataTable
                        columns={columns}
                        data={filteredAttendance || []}
                        isLoading={isLoading}
                        getRowId={getRowId}
                        rowSelection={rowSelection}
                        onRowSelectionChange={setRowSelection}
                        className="[&_td]:px-2.5 [&_th]:px-2.5 [&_td]:py-1.5 md:[&_td]:px-3 md:[&_th]:px-3 md:[&_td]:py-2"
                        toolbar={(table) => (
                            <AttendanceTableToolbar
                                table={table}
                                employeeFilter={employeeFilter}
                                onEmployeeFilterChange={handleEmployeeFilterChange}
                                uniqueEmployees={uniqueEmployees}
                                searchQuery={searchQuery}
                                onSearchQueryChange={handleSearchQueryChange}
                                verificationFilter={verificationFilter}
                                onVerificationFilterChange={handleVerificationFilterChange}
                                dayTypeFilter={dayTypeFilter}
                                onDayTypeFilterChange={handleDayTypeFilterChange}
                                dateFilter={dateFilter}
                                onDateFilterChange={setDateFilter}
                                uniqueDates={uniqueDates}
                                onBulkVerify={() => handleBulkVerify('verified')}
                                onBulkReject={() => handleBulkVerify('rejected')}
                                isBulkUpdating={bulkVerificationDialog.status === 'processing'}
                                stats={stats}
                                onDownload={handleDownloadReport}
                                isDownloading={isDownloading}
                            />
                        )}
                    />
                </div>
            </CardShell>

            <AttendanceSessionsDrawer
                isOpen={!!sessionsDialogRecord}
                onOpenChange={(open) => {
                    if (!open) {
                        setSessionsDialogRecord(null)
                        refetchAttendance()
                    }
                }}
                record={sessionsDialogRecord}
                onSessionUpdated={() => {
                    utils.attendance.getAttendance.invalidate()
                    refetchAttendance()
                }}
            />

            <AttendanceEditDialog
                isOpen={isEditOpen}
                onOpenChange={handleOpenChange}
                record={selectedRecord}
                isSaving={manualUpdateMutation.isPending}
                isSuccess={manualUpdateMutation.isSuccess}
                onSave={(data) => {
                    manualUpdateMutation.mutate({
                        id: selectedRecord.id,
                        checkIn: data.checkIn,
                        checkOut: data.checkOut,
                        status: data.status,
                        dayType: data.dayType,
                        remarks: data.remarks,
                        isHalfDay: data.isHalfDay,
                        isExtraDay: data.isExtraDay
                    })
                }}
            />

            <BulkDailyUpload
                isOpen={isBulkUploadOpen}
                onOpenChange={(open) => {
                    setIsBulkUploadOpen(open)
                    if (!open) {
                        refetchAttendance()
                    }
                }}
            />

            <Dialog 
                open={verificationDialog.isOpen} 
                onOpenChange={(open) => {
                    if (verificationDialog.status === 'processing') return
                    setVerificationDialog(prev => ({ ...prev, isOpen: open }))
                    if (!open) {
                        refetchAttendance()
                    }
                }}
            >
                <DialogContent className="max-w-[520px] w-[95vw] sm:w-full max-h-[90vh] flex flex-col p-0 overflow-hidden rounded-2xl shadow-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-950">
                    <DialogHeader className="shrink-0 px-5 pt-4 pb-3 border-b border-slate-100 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-900/30">
                        <DialogTitle className="text-base font-bold flex items-center gap-2">
                            <div className={cn("p-1.5 rounded-xl shadow-sm", verificationDialog.action === 'verified' ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-500" : "bg-rose-500/10 text-rose-600 dark:text-rose-500")}>
                                {verificationDialog.action === 'verified' ? <CheckCircleIcon className="w-4 h-4" /> : <XCircleIcon className="w-4 h-4" />}
                            </div>
                            {verificationDialog.action === 'verified' ? 'Verify Attendance Record' : 'Reject Attendance Record'}
                        </DialogTitle>
                        <DialogDescription className="text-xs font-medium text-muted-foreground ml-9 mt-0.5">
                            Please review the employee details below to proceed.
                        </DialogDescription>
                    </DialogHeader>

                    {verificationDialog.record && (
                        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-3.5 custom-scrollbar">
                            {/* Employee Card */}
                            <div className="flex items-center gap-3 p-2 rounded-xl bg-gradient-to-r from-slate-50 to-white dark:from-slate-900/80 dark:to-slate-900/40 border border-slate-200/60 dark:border-slate-800/80 shadow-sm transition-all hover:shadow-md">
                                <ProfileInfoCell profile={verificationDialog.record.profile} />
                            </div>

                            {/* Attendance details grid */}
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                                <div className="p-2.5 rounded-xl border border-slate-200/60 dark:border-slate-800/60 bg-white/50 dark:bg-slate-950/50 backdrop-blur-sm shadow-[0_2px_10px_-3px_rgba(6,81,237,0.05)] flex flex-col justify-center">
                                    <span className="text-[10px] font-semibold tracking-wider uppercase text-muted-foreground mb-0.5">Date</span>
                                    <span className="font-bold text-slate-800 dark:text-slate-200 text-[12px]">
                                        {format(new Date(verificationDialog.record.date), 'MMM dd, yyyy')}
                                    </span>
                                </div>
                                <div className="p-2.5 rounded-xl border border-slate-200/60 dark:border-slate-800/60 bg-white/50 dark:bg-slate-950/50 backdrop-blur-sm shadow-[0_2px_10px_-3px_rgba(6,81,237,0.05)] flex flex-col justify-center">
                                    <span className="text-[10px] font-semibold tracking-wider uppercase text-muted-foreground mb-0.5">Current Status</span>
                                    <Badge variant="secondary" className="w-max capitalize font-bold text-[9px] tracking-tight px-2 py-0.5 border-none bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                                        {verificationDialog.record.status}
                                    </Badge>
                                </div>
                                <div className="p-2.5 rounded-xl border border-slate-200/60 dark:border-slate-800/60 bg-white/50 dark:bg-slate-950/50 backdrop-blur-sm shadow-[0_2px_10px_-3px_rgba(6,81,237,0.05)] flex flex-col justify-center col-span-2 sm:col-span-1">
                                    <span className="text-[10px] font-semibold tracking-wider uppercase text-muted-foreground mb-0.5">Credited Work</span>
                                    <span className="font-black text-primary text-sm">
                                        {verificationDialog.record.working_hours 
                                            ? `${Number(verificationDialog.record.working_hours).toFixed(2)} hrs` 
                                            : '0.00 hrs'}
                                    </span>
                                </div>
                            </div>

                            {/* Multi-Session Breakdown List */}
                            {verificationDialog.record.sessions && verificationDialog.record.sessions.length > 0 ? (
                                <div className="p-3 rounded-xl border border-slate-200/70 dark:border-slate-800/70 bg-slate-50/50 dark:bg-slate-900/40 space-y-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[11px] font-extrabold text-foreground flex items-center gap-1.5">
                                            <ClockIcon className="w-3.5 h-3.5 text-primary" />
                                            Day Sessions ({verificationDialog.record.sessions.length})
                                        </span>
                                        <span className="text-[10px] font-semibold text-muted-foreground">
                                            {verificationDialog.record.current_session_status === 'checked_in' ? (
                                                <span className="text-emerald-600 font-bold animate-pulse">● Active Session</span>
                                            ) : (
                                                <span>All Punches Recorded</span>
                                            )}
                                        </span>
                                    </div>

                                    <div className="max-h-48 overflow-y-auto space-y-1.5 pr-0.5">
                                        {verificationDialog.record.sessions.map((sess: any, idx: number) => {
                                            const isRejected = sess.status === 'rejected'
                                            const isVerified = sess.status === 'verified'
                                            const isActive = sess.status === 'active' || (!sess.check_out && verificationDialog.record.current_session_status === 'checked_in')
                                            const sIn = sess.check_in ? format(new Date(sess.check_in), 'hh:mm:ss a') : '--:--'
                                            const sOut = sess.check_out ? format(new Date(sess.check_out), 'hh:mm:ss a') : (isActive ? 'Active' : '--:--')
                                            const sHours = sess.working_hours ? `${Number(sess.working_hours).toFixed(2)}h` : (isActive ? 'In Progress' : '--')

                                            return (
                                                <div 
                                                    key={sess.id || idx}
                                                    className={cn(
                                                        "p-2 rounded-lg border text-xs flex items-center justify-between transition-all",
                                                        isRejected
                                                            ? "bg-rose-500/5 border-rose-500/30 text-rose-800 dark:text-rose-300"
                                                            : isVerified
                                                            ? "bg-emerald-500/5 border-emerald-500/30"
                                                            : isActive
                                                            ? "bg-sky-500/5 border-sky-500/30"
                                                            : "bg-white dark:bg-slate-950 border-slate-200/80 dark:border-slate-800/80"
                                                    )}
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-extrabold text-[11px] text-foreground">
                                                            #{sess.session_number || idx + 1}
                                                        </span>
                                                        <div className="flex items-center gap-1 text-[11px]">
                                                            <span className="text-emerald-700 dark:text-emerald-400 font-semibold">{sIn}</span>
                                                            <span className="text-muted-foreground">→</span>
                                                            <span className={cn(
                                                                "font-semibold",
                                                                sess.check_out ? "text-amber-700 dark:text-amber-400" : "text-sky-600 italic"
                                                            )}>{sOut}</span>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-1.5">
                                                        <span className={cn(
                                                            "text-[10px] font-bold",
                                                            isRejected ? "line-through text-muted-foreground" : "text-foreground"
                                                        )}>
                                                            {sHours}
                                                        </span>

                                                        {isRejected ? (
                                                            <Badge variant="destructive" className="text-[8px] py-0 px-1.5 h-3.5 uppercase">Rejected (0h)</Badge>
                                                        ) : isVerified ? (
                                                            <Badge className="bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 text-[8px] py-0 px-1.5 h-3.5 uppercase font-bold">Verified</Badge>
                                                        ) : isActive ? (
                                                            <Badge className="bg-sky-500/20 text-sky-700 dark:text-sky-300 border-sky-500/30 text-[8px] py-0 px-1.5 h-3.5 uppercase font-bold">Active</Badge>
                                                        ) : (
                                                            <Badge variant="secondary" className="text-[8px] py-0 px-1.5 h-3.5 uppercase font-semibold">Done</Badge>
                                                        )}
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>

                                    {/* Clarification note */}
                                    {verificationDialog.record.sessions.some((s: any) => s.status === 'rejected') && (
                                        <p className="text-[10px] text-rose-600 dark:text-rose-400 font-medium pt-1">
                                            ⚠️ Rejected sessions remain excluded (0 hrs) and will not be credited.
                                        </p>
                                    )}
                                </div>
                            ) : (
                                /* Fallback for legacy single punch */
                                <div className="grid grid-cols-2 gap-2 text-xs">
                                    <div className="p-2 rounded-lg border bg-white/50 dark:bg-slate-950/50">
                                        <span className="text-[10px] font-semibold uppercase text-muted-foreground block">Clock In</span>
                                        <span className="font-bold text-emerald-600 text-xs">
                                            {verificationDialog.record.check_in ? format(new Date(verificationDialog.record.check_in), 'hh:mm a') : '—'}
                                        </span>
                                    </div>
                                    <div className="p-2 rounded-lg border bg-white/50 dark:bg-slate-950/50">
                                        <span className="text-[10px] font-semibold uppercase text-muted-foreground block">Clock Out</span>
                                        <span className="font-bold text-amber-600 text-xs">
                                            {verificationDialog.record.check_out ? format(new Date(verificationDialog.record.check_out), 'hh:mm a') : '—'}
                                        </span>
                                    </div>
                                </div>
                            )}

                            {/* Remarks / Leaves status */}
                            {verificationDialog.record.remarks && (
                                <div className="p-2.5 rounded-xl bg-orange-500/10 border border-orange-500/20 shadow-sm transition-all hover:shadow-md">
                                    <span className="text-[10px] font-bold tracking-wider uppercase text-orange-600 dark:text-orange-500 block mb-1">Remarks / Request Status</span>
                                    <span className="text-slate-700 dark:text-slate-200 font-medium text-xs">
                                        {verificationDialog.record.remarks}
                                    </span>
                                </div>
                            )}

                            {/* Process status details with spinner */}
                            {verificationDialog.status === 'processing' && (
                                <div className="flex flex-col items-center justify-center py-3 space-y-2">
                                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                                    <span className="text-xs font-semibold text-muted-foreground animate-pulse">
                                        Updating records...
                                    </span>
                                </div>
                            )}

                            {verificationDialog.status === 'success' && (
                                <div className="flex flex-col items-center justify-center py-3 space-y-1.5 text-emerald-650 dark:text-emerald-500">
                                    <CheckCircleIcon className="h-8 w-8 text-emerald-500" />
                                    <span className="text-sm font-bold text-emerald-600 dark:text-emerald-500">
                                        Successfully {verificationDialog.action === 'verified' ? 'Approved & Verified' : 'Rejected'}!
                                    </span>
                                    <span className="text-[10px] text-muted-foreground text-center">
                                        The table has been updated in the background.
                                    </span>
                                </div>
                            )}

                            {verificationDialog.status === 'error' && (
                                <div className="flex flex-col items-center justify-center py-3 space-y-1.5 text-rose-650 dark:text-rose-500">
                                    <XCircleIcon className="h-8 w-8 text-rose-500" />
                                    <span className="text-sm font-bold text-rose-600 dark:text-rose-500">Failed to update</span>
                                    <span className="text-[10px] text-muted-foreground text-center">
                                        {verificationDialog.message}
                                    </span>
                                </div>
                            )}
                        </div>
                    )}

                    <div className="shrink-0 px-5 py-3 border-t border-slate-100 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-900/30 flex flex-col-reverse sm:flex-row justify-end gap-2 rounded-b-2xl">
                        {verificationDialog.status === 'idle' ? (
                            <>
                                <Button 
                                    className="w-full sm:w-auto h-8 text-xs font-medium"
                                    variant="outline" 
                                    onClick={() => setVerificationDialog(prev => ({ ...prev, isOpen: false }))}
                                >
                                    Cancel
                                </Button>
                                <Button 
                                    className="w-full sm:w-auto h-8 text-xs font-bold shadow-md"
                                    variant={verificationDialog.action === 'verified' ? 'default' : 'destructive'}
                                    onClick={() => handleExecuteVerification()}
                                >
                                    {verificationDialog.action === 'verified' ? 'Final Verify All Sessions' : 'Confirm Reject'}
                                </Button>
                            </>
                        ) : (
                            <Button 
                                className="w-full sm:w-auto h-8 text-xs"
                                variant="secondary" 
                                disabled={verificationDialog.status === 'processing'}
                                onClick={() => setVerificationDialog(prev => ({ ...prev, isOpen: false }))}
                            >
                                Close
                            </Button>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog 
                open={bulkVerificationDialog.isOpen} 
                onOpenChange={(open) => {
                    if (bulkVerificationDialog.status === 'processing') return
                    setBulkVerificationDialog(prev => ({ ...prev, isOpen: open }))
                    if (!open) {
                        refetchAttendance()
                    }
                }}
            >
                <DialogContent className="max-w-[480px] w-[95vw] sm:w-full p-0 overflow-hidden rounded-2xl shadow-2xl border border-slate-200/60 dark:border-slate-800/60 bg-white dark:bg-slate-950">
                    <DialogHeader className="px-4 pt-4 pb-3 border-b border-slate-100 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-900/30">
                        <DialogTitle className="text-base font-bold flex items-center gap-2">
                            <div className={cn("p-1.5 rounded-xl shadow-sm", bulkVerificationDialog.action === 'verified' ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-500" : "bg-rose-500/10 text-rose-600 dark:text-rose-500")}>
                                {bulkVerificationDialog.action === 'verified' ? <CheckCircleIcon className="w-4 h-4" /> : <XCircleIcon className="w-4 h-4" />}
                            </div>
                            {bulkVerificationDialog.action === 'verified' ? 'Bulk Verify Attendance' : 'Bulk Reject Attendance'}
                        </DialogTitle>
                        <DialogDescription className="text-xs font-medium text-muted-foreground ml-9 mt-0.5">
                            You have selected {bulkVerificationDialog.totalRecords} record(s) for bulk processing.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="px-4 py-3.5 space-y-3">
                        {bulkVerificationDialog.status === 'idle' && (
                            <div className="p-3 rounded-xl bg-gradient-to-r from-slate-50 to-white dark:from-slate-900 dark:to-slate-900/50 border border-slate-200/80 dark:border-slate-800/80 shadow-sm transition-all hover:shadow-md">
                                <span className="font-bold text-slate-800 dark:text-slate-200 text-xs">
                                    Are you sure you want to {bulkVerificationDialog.action === 'verified' ? 'approve and verify' : 'reject'} {bulkVerificationDialog.totalRecords} selected record(s)?
                                </span>
                                <p className="text-[11px] text-muted-foreground mt-1.5 font-medium">
                                    This action will process each record and update the logs accordingly.
                                </p>
                            </div>
                        )}

                        {bulkVerificationDialog.status === 'processing' && (
                            <div className="space-y-3 py-3">
                                <div className="flex flex-col items-center justify-center space-y-2">
                                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                                        Processing {bulkVerificationDialog.currentProgress + 1} of {bulkVerificationDialog.totalRecords}
                                    </span>
                                    {bulkVerificationDialog.currentRecordName && (
                                        <span className="text-[10px] font-medium text-muted-foreground animate-pulse text-center">
                                            Currently processing: <span className="font-bold">{bulkVerificationDialog.currentRecordName}</span>
                                        </span>
                                    )}
                                </div>

                                {/* Progress Bar */}
                                <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden shadow-inner">
                                    <div 
                                        className="bg-primary h-full transition-all duration-300 ease-out"
                                        style={{ width: `${(bulkVerificationDialog.currentProgress / bulkVerificationDialog.totalRecords) * 100}%` }}
                                    />
                                </div>
                            </div>
                        )}

                        {bulkVerificationDialog.status === 'success' && (
                            <div className="flex flex-col items-center justify-center py-3 space-y-1.5 text-emerald-650 dark:text-emerald-500">
                                <CheckCircleIcon className="h-8 w-8 text-emerald-500" />
                                <span className="text-sm font-bold text-emerald-600 dark:text-emerald-500">Processing Completed!</span>
                                <span className="text-[10px] text-muted-foreground text-center">
                                    {bulkVerificationDialog.message}
                                </span>
                            </div>
                        )}

                        {bulkVerificationDialog.status === 'error' && (
                            <div className="flex flex-col items-center justify-center py-3 space-y-1.5 text-rose-650 dark:text-rose-500">
                                <XCircleIcon className="h-8 w-8 text-rose-500" />
                                <span className="text-sm font-bold text-rose-600 dark:text-rose-500">Processing Failed</span>
                                <span className="text-[10px] text-muted-foreground text-center">
                                    {bulkVerificationDialog.message}
                                </span>
                            </div>
                        )}
                    </div>

                    <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-900/30 flex flex-col-reverse sm:flex-row justify-end gap-2 rounded-b-2xl">
                        {bulkVerificationDialog.status === 'idle' ? (
                            <>
                                <Button 
                                    className="w-full sm:w-auto h-8 text-xs font-medium"
                                    variant="outline" 
                                    onClick={() => setBulkVerificationDialog(prev => ({ ...prev, isOpen: false }))}
                                >
                                    Cancel
                                </Button>
                                <Button 
                                    className="w-full sm:w-auto h-8 text-xs font-bold shadow-md"
                                    variant={bulkVerificationDialog.action === 'verified' ? 'default' : 'destructive'}
                                    onClick={() => handleExecuteBulkVerification()}
                                >
                                    {bulkVerificationDialog.action === 'verified' ? 'Approve & Verify' : 'Confirm Reject'}
                                </Button>
                            </>
                        ) : (
                            <Button 
                                className="w-full sm:w-auto h-8 text-xs"
                                variant="secondary" 
                                disabled={bulkVerificationDialog.status === 'processing'}
                                onClick={() => setBulkVerificationDialog(prev => ({ ...prev, isOpen: false }))}
                            >
                                Close
                            </Button>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}
