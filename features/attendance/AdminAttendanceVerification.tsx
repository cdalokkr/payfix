"use client"

import React, { useState, useMemo, useEffect, useCallback, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { trpc } from "@/lib/trpc/client"
import { Search, Loader2, FileText, Save, Clock as ClockIcon, CheckCircle2 as CheckCircleIcon, XCircle as XCircleIcon, CalendarMinus as CalendarMinusIcon, Upload } from "lucide-react"
import { toast } from "sonner"
import { getEventBroadcaster } from "@/lib/events/event-broadcaster"
import { Label } from "@/components/ui/label"
import { CompactMetricCard } from "@/components/dashboard/compact-metric-card"
import { cn } from "@/lib/utils"
import { useSharedManagementChannel } from "@/hooks/use-shared-management-channel"
import { useProfile } from "@/lib/context/profile-context"

import { createAttendanceColumns } from "./attendance-columns"
import { DataTable } from "@/components/ui/data-table"
import { ProfileInfoCell } from "@/components/dashboard/profile-info-cell"
import { format } from "date-fns"
import { DateRange } from "react-day-picker"
import { generateCSV, generatePDF, downloadFile } from "@/lib/report-utils"
import { AttendanceTableToolbar } from "./attendance-table-toolbar"
import { AttendanceEditSheet } from "./attendance-edit-sheet"
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
    const [searchTerm, setSearchTerm] = useState("")
    const [isEditOpen, setIsEditOpen] = useState(false)
    const [isBulkUploadOpen, setIsBulkUploadOpen] = useState(false)
    const [selectedRecord, setSelectedRecord] = useState<any>(null)
    const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({})
    // Default to current date (IST) and all statuses for full logging visibility
    const [statusFilter, setStatusFilter] = useState('all')
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

    const bulkVerifyMutation = trpc.attendance.bulkVerifyAttendance.useMutation({
        onSuccess: () => {
            toast.success('Successfully updated records')
            setRowSelection({})
            utils.attendance.getAttendance.invalidate()
        },
        onError: (error) => toast.error(error.message)
    })
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
        }
    )
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

            // Invalidate/refetch in background in async mode
            utils.attendance.getAttendance.invalidate()

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

        for (let i = 0; i < selectedIds.length; i++) {
            const id = selectedIds[i]
            const record = attendance?.find(r => r.id === id)
            const employeeName = record?.profile?.full_name || 'Unknown'

            setBulkVerificationDialog(prev => ({
                ...prev,
                currentProgress: i,
                currentRecordName: employeeName
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

            // Sync/refresh in background after each record to keep UI up to date
            utils.attendance.getAttendance.invalidate()
        }

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
            // Small delay to show success state on button
            setTimeout(() => {
                handleOpenChange(false)
                utils.attendance.getAttendance.invalidate()
            }, 1000)
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
            const isSingleEmployee = uniqueNames.size === 1 && searchTerm.trim().length > 0

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

    const searchFilteredAttendance = useMemo(() => {
        return attendance?.filter(record => {
            const matchesSearch = !searchTerm ||
                record.profile?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                record.profile?.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                record.profile?.designation?.name?.toLowerCase().includes(searchTerm.toLowerCase())
            return matchesSearch
        })
    }, [attendance, searchTerm])

    const filteredAttendance = useMemo(() => {
        return searchFilteredAttendance?.filter(record => {
            const matchesStatus = statusFilter === 'all' ||
                (statusFilter === 'halfDay' ? record.is_half_day :
                    statusFilter === 'noOfficeOut' ? (record.check_in && !record.check_out) :
                        record.status === statusFilter)
            return matchesStatus
        })
    }, [searchFilteredAttendance, statusFilter])

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
        isVerifying: false, // Dialog handles its own loading status
        scheduledHoursMap
    }), [scheduledHoursMap, handleEdit])

    const getRowId = useCallback((row: any) => row.id, [])

    const stats = useMemo(() => ({
        pending: searchFilteredAttendance?.filter(a => a.status === 'pending').length || 0,
        verified: searchFilteredAttendance?.filter(a => a.status === 'verified').length || 0,
        halfDay: searchFilteredAttendance?.filter(a => a.is_half_day).length || 0,
        rejected: searchFilteredAttendance?.filter(a => a.status === 'rejected').length || 0,
        noOfficeOut: searchFilteredAttendance?.filter(a => a.check_in && !a.check_out).length || 0,
        absent: searchFilteredAttendance?.filter(a => a.status === 'absent').length || 0,
        leave: searchFilteredAttendance?.filter(a => a.status === 'leave').length || 0,
        weekly_off: searchFilteredAttendance?.filter(a => a.status === 'weekly_off').length || 0,
        all: searchFilteredAttendance?.length || 0,
    }), [searchFilteredAttendance])

    if (!mounted) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="size-8 animate-spin text-primary/20" />
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                <CompactMetricCard
                    label="Pending"
                    value={stats.pending}
                    icon={ClockIcon}
                    theme="blue"
                    delay={0.1}
                    loading={isLoading || isFetching}
                />
                <CompactMetricCard
                    label="Verified"
                    value={stats.verified}
                    icon={CheckCircleIcon}
                    theme="green"
                    delay={0.2}
                    loading={isLoading || isFetching}
                />
                <CompactMetricCard
                    label="No Office Out"
                    value={stats.noOfficeOut}
                    icon={ClockIcon}
                    theme="amber"
                    delay={0.3}
                    loading={isLoading || isFetching}
                />
                <CompactMetricCard
                    label="Half Day"
                    value={stats.halfDay}
                    icon={CalendarMinusIcon}
                    theme="indigo"
                    delay={0.4}
                    loading={isLoading || isFetching}
                />
                <CompactMetricCard
                    label="Rejected"
                    value={stats.rejected}
                    icon={XCircleIcon}
                    theme="red"
                    delay={0.5}
                    loading={isLoading || isFetching}
                />
            </div>

            <CardShell
                title="Attendance Logs"
                description="Review and verify employee attendance records for processing."
                icon={FileText}
                contentClassName="min-h-0 p-6 pt-2 h-full overflow-auto"
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
                <DataTable
                    columns={columns}
                    data={filteredAttendance || []}
                    isLoading={isLoading}
                    getRowId={getRowId}
                    rowSelection={rowSelection}
                    onRowSelectionChange={setRowSelection}
                    toolbar={(table) => (
                        <AttendanceTableToolbar
                            table={table}
                            searchTerm={searchTerm}
                            onSearchChange={setSearchTerm}
                            statusFilter={statusFilter}
                            onStatusFilterChange={setStatusFilter}
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
            </CardShell>

            <AttendanceEditSheet
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
                        remarks: data.remarks,
                        isHalfDay: data.isHalfDay
                    })
                }}
            />

            <BulkDailyUpload
                isOpen={isBulkUploadOpen}
                onOpenChange={setIsBulkUploadOpen}
            />

            <Dialog 
                open={verificationDialog.isOpen} 
                onOpenChange={(open) => {
                    if (verificationDialog.status === 'processing') return
                    setVerificationDialog(prev => ({ ...prev, isOpen: open }))
                }}
            >
                <DialogContent className="max-w-[480px] p-6 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-950">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-bold flex items-center gap-2">
                            {verificationDialog.action === 'verified' ? 'Verify Attendance Record' : 'Reject Attendance Record'}
                        </DialogTitle>
                        <DialogDescription className="text-sm text-muted-foreground mt-1">
                            Please review the employee details below to proceed.
                        </DialogDescription>
                    </DialogHeader>

                    {verificationDialog.record && (
                        <div className="space-y-4 my-4">
                            {/* Employee Card */}
                            <div className="flex items-center gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800/60">
                                <ProfileInfoCell profile={verificationDialog.record.profile} />
                            </div>

                            {/* Attendance details grid */}
                            <div className="grid grid-cols-2 gap-3 text-xs">
                                <div className="p-3 rounded-lg border border-slate-100 dark:border-slate-800 bg-card">
                                    <span className="text-muted-foreground block mb-0.5">Date</span>
                                    <span className="font-bold text-slate-800 dark:text-slate-200">
                                        {format(new Date(verificationDialog.record.date), 'MMMM dd, yyyy (EEEE)')}
                                    </span>
                                </div>
                                <div className="p-3 rounded-lg border border-slate-100 dark:border-slate-800 bg-card">
                                    <span className="text-muted-foreground block mb-0.5">Current Status</span>
                                    <Badge variant="secondary" className="capitalize font-bold text-[9px] tracking-tight px-1.5 h-4.5 border-none bg-muted text-muted-foreground">
                                        {verificationDialog.record.status}
                                    </Badge>
                                </div>
                                <div className="p-3 rounded-lg border border-slate-100 dark:border-slate-850 bg-card">
                                    <span className="text-muted-foreground block mb-0.5">Clock In</span>
                                    <span className="font-bold text-emerald-600">
                                        {verificationDialog.record.check_in 
                                            ? format(new Date(verificationDialog.record.check_in), 'hh:mm a') 
                                            : '—'}
                                    </span>
                                </div>
                                <div className="p-3 rounded-lg border border-slate-100 dark:border-slate-850 bg-card">
                                    <span className="text-muted-foreground block mb-0.5">Clock Out</span>
                                    <span className="font-bold text-amber-600">
                                        {verificationDialog.record.check_out 
                                            ? format(new Date(verificationDialog.record.check_out), 'hh:mm a') 
                                            : '—'}
                                    </span>
                                </div>
                                <div className="p-3 rounded-lg border border-slate-100 dark:border-slate-850 bg-card">
                                    <span className="text-muted-foreground block mb-0.5">Total Working Hours</span>
                                    <span className="font-black text-primary">
                                        {verificationDialog.record.working_hours 
                                            ? `${Number(verificationDialog.record.working_hours).toFixed(1)}h` 
                                            : '0.0h'}
                                    </span>
                                </div>
                                <div className="p-3 rounded-lg border border-slate-100 dark:border-slate-850 bg-card">
                                    <span className="text-muted-foreground block mb-0.5">Day Type</span>
                                    <span className="font-bold text-slate-800 dark:text-slate-200">
                                        {verificationDialog.record.is_half_day ? 'Half Day' : 'Full Day'}
                                    </span>
                                </div>
                            </div>

                            {/* Remarks / Leaves status */}
                            {verificationDialog.record.remarks && (
                                <div className="p-3 rounded-lg bg-orange-500/5 border border-orange-500/10 text-xs">
                                    <span className="text-orange-600 font-bold block mb-1">Remarks / Request Status</span>
                                    <span className="text-slate-650 dark:text-slate-300 font-medium">
                                        {verificationDialog.record.remarks}
                                    </span>
                                </div>
                            )}

                            {/* Process status details with spinner */}
                            {verificationDialog.status === 'processing' && (
                                <div className="flex flex-col items-center justify-center py-4 space-y-2">
                                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                    <span className="text-sm font-semibold text-muted-foreground animate-pulse">
                                        Updating records...
                                    </span>
                                </div>
                            )}

                            {verificationDialog.status === 'success' && (
                                <div className="flex flex-col items-center justify-center py-4 space-y-2 text-emerald-650">
                                    <CheckCircleIcon className="h-10 w-10 text-emerald-500" />
                                    <span className="text-sm font-bold">
                                        Successfully {verificationDialog.action === 'verified' ? 'Approved & Verified' : 'Rejected'}!
                                    </span>
                                    <span className="text-xs text-muted-foreground text-center">
                                        The table has been updated in the background.
                                    </span>
                                </div>
                            )}

                            {verificationDialog.status === 'error' && (
                                <div className="flex flex-col items-center justify-center py-4 space-y-2 text-rose-650">
                                    <XCircleIcon className="h-10 w-10 text-rose-500" />
                                    <span className="text-sm font-bold">Failed to update</span>
                                    <span className="text-xs text-muted-foreground text-center">
                                        {verificationDialog.message}
                                    </span>
                                </div>
                            )}
                        </div>
                    )}

                    <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
                        {verificationDialog.status === 'idle' ? (
                            <>
                                <Button 
                                    variant="outline" 
                                    onClick={() => setVerificationDialog(prev => ({ ...prev, isOpen: false }))}
                                >
                                    Cancel
                                </Button>
                                <Button 
                                    variant={verificationDialog.action === 'verified' ? 'default' : 'destructive'}
                                    onClick={() => handleExecuteVerification()}
                                >
                                    {verificationDialog.action === 'verified' ? 'Approve & Verify' : 'Confirm Reject'}
                                </Button>
                            </>
                        ) : (
                            <Button 
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
                }}
            >
                <DialogContent className="max-w-[480px] p-6 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-950">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-bold flex items-center gap-2">
                            {bulkVerificationDialog.action === 'verified' ? 'Bulk Verify Attendance' : 'Bulk Reject Attendance'}
                        </DialogTitle>
                        <DialogDescription className="text-sm text-muted-foreground mt-1">
                            You have selected {bulkVerificationDialog.totalRecords} record(s) for bulk processing.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 my-4">
                        {bulkVerificationDialog.status === 'idle' && (
                            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800/60 text-sm">
                                <span className="font-semibold text-slate-800 dark:text-slate-200">
                                    Are you sure you want to {bulkVerificationDialog.action === 'verified' ? 'approve and verify' : 'reject'} {bulkVerificationDialog.totalRecords} selected record(s)?
                                </span>
                                <p className="text-xs text-muted-foreground mt-2">
                                    This action will process each record and update the logs accordingly.
                                </p>
                            </div>
                        )}

                        {bulkVerificationDialog.status === 'processing' && (
                            <div className="space-y-4 py-4">
                                <div className="flex flex-col items-center justify-center space-y-2">
                                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                    <span className="text-sm font-bold text-slate-800 dark:text-slate-200">
                                        Processing {bulkVerificationDialog.currentProgress + 1} of {bulkVerificationDialog.totalRecords}
                                    </span>
                                    {bulkVerificationDialog.currentRecordName && (
                                        <span className="text-xs text-muted-foreground animate-pulse text-center">
                                            Currently processing: <span className="font-semibold">{bulkVerificationDialog.currentRecordName}</span>
                                        </span>
                                    )}
                                </div>

                                {/* Progress Bar */}
                                <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                                    <div 
                                        className="bg-primary h-full transition-all duration-300 ease-out"
                                        style={{ width: `${(bulkVerificationDialog.currentProgress / bulkVerificationDialog.totalRecords) * 100}%` }}
                                    />
                                </div>
                            </div>
                        )}

                        {bulkVerificationDialog.status === 'success' && (
                            <div className="flex flex-col items-center justify-center py-4 space-y-2 text-emerald-650">
                                <CheckCircleIcon className="h-10 w-10 text-emerald-500" />
                                <span className="text-sm font-bold text-emerald-600">Processing Completed!</span>
                                <span className="text-xs text-muted-foreground text-center">
                                    {bulkVerificationDialog.message}
                                </span>
                            </div>
                        )}

                        {bulkVerificationDialog.status === 'error' && (
                            <div className="flex flex-col items-center justify-center py-4 space-y-2 text-rose-650">
                                <XCircleIcon className="h-10 w-10 text-rose-500" />
                                <span className="text-sm font-bold text-rose-600">Processing Failed</span>
                                <span className="text-xs text-muted-foreground text-center">
                                    {bulkVerificationDialog.message}
                                </span>
                            </div>
                        )}
                    </div>

                    <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
                        {bulkVerificationDialog.status === 'idle' ? (
                            <>
                                <Button 
                                    variant="outline" 
                                    onClick={() => setBulkVerificationDialog(prev => ({ ...prev, isOpen: false }))}
                                >
                                    Cancel
                                </Button>
                                <Button 
                                    variant={bulkVerificationDialog.action === 'verified' ? 'default' : 'destructive'}
                                    onClick={() => handleExecuteBulkVerification()}
                                >
                                    {bulkVerificationDialog.action === 'verified' ? 'Approve & Verify' : 'Confirm Reject'}
                                </Button>
                            </>
                        ) : (
                            <Button 
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
