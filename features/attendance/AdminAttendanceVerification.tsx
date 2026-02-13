"use client"

import React, { useState, useMemo, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { trpc } from "@/lib/trpc/client"
import { Search, Loader2, FileText, Save } from "lucide-react"
import { Clock as ClockIcon, CheckCircle as CheckCircleIcon, XCircle as XCircleIcon, CalendarMinus as CalendarMinusIcon } from "@phosphor-icons/react"
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
import { CardShell } from "./CardShell"

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
    const [selectedRecord, setSelectedRecord] = useState<any>(null)
    const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({})
    // Default to current date (IST) and pending status for faster, relevant loading
    const [statusFilter, setStatusFilter] = useState('pending')
    const [dateFilter, setDateFilter] = useState<DateRange | undefined>({
        from: new Date(),
        to: new Date()
    })
    const [mounted, setMounted] = useState(false)

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
            mode: !dateFilter ? 'default' : 'all',
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
            toast.success(`Attendance marked as ${data.status}`)
            utils.attendance.getAttendance.invalidate()
        },
        onError: (error) => toast.error(error.message)
    })

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
            const currentRole = profile?.role
            const startDate = dateFilter?.from ? format(dateFilter.from, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd')
            const endDate = dateFilter?.to ? format(dateFilter.to, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd')

            // Use utils.fetch() since the server defines this as a query, not a mutation
            const result = currentRole === 'admin'
                ? await utils.admin.reports.getDetailedAttendanceReport.fetch({ startDate, endDate })
                : await utils.moderator.reports.getDetailedAttendanceReport.fetch({ startDate, endDate })

            const headers = ['Sr', 'Employee', 'Date', 'Location', 'Clock In', 'Clock Out', 'Total Hours', 'Extra Hours', 'Status', 'Day Type', 'Remark']
            const rows = result.data.map(item => [
                String(item.sr),
                item.employeeName,
                item.date,
                item.markedOfficeLocation,
                item.clockIn,
                item.clockOut,
                item.totalHours,
                item.extraHours,
                item.status,
                item.markedDay,
                item.remark
            ])

            const filename = `attendance_report_${format(new Date(), 'yyyy-MM-dd_HH-mm')}`

            if (formatType === 'csv') {
                const csvContent = generateCSV(headers, rows)
                downloadFile(csvContent, `${filename}.csv`, 'text/csv')
            } else {
                generatePDF("Attendance Report", headers, rows, `${filename}.pdf`)
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

    const filteredAttendance = useMemo(() => {
        return attendance?.filter(record => {
            const matchesSearch = !searchTerm ||
                record.profile?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                record.profile?.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                record.profile?.designation?.name?.toLowerCase().includes(searchTerm.toLowerCase())

            const matchesStatus = statusFilter === 'all' ||
                (statusFilter === 'halfDay' ? record.is_half_day :

                    statusFilter === 'noOfficeOut' ? (record.check_in && !record.check_out) :
                        record.status === statusFilter)

            // Date filtering is handled by backend query now, but for client side safety:
            // const matchesDate = ... (Skipping as backend handles it)
            return matchesSearch && matchesStatus
        })
    }, [attendance, searchTerm, statusFilter, dateFilter])

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

    const handleBulkVerify = useCallback((status: 'verified' | 'rejected') => {
        const selectedIds = Object.keys(rowSelection)
        if (selectedIds.length === 0) return
        bulkVerifyMutation.mutate({ ids: selectedIds, status })
    }, [rowSelection, bulkVerifyMutation])

    const columns = useMemo(() => createAttendanceColumns({
        onVerify: (record) => verifyMutation.mutate({ id: record.id, status: 'verified', isHalfDay: record.is_half_day ?? undefined }),
        onReject: (record) => verifyMutation.mutate({ id: record.id, status: 'rejected' }),
        onEdit: handleEdit,
        isVerifying: verifyMutation.isPending,
        scheduledHoursMap
    }), [scheduledHoursMap, verifyMutation.isPending, handleEdit, verifyMutation.mutate])

    const getRowId = useCallback((row: any) => row.id, [])

    const stats = useMemo(() => ({
        pending: filteredAttendance?.filter(a => a.status === 'pending').length || 0,
        verified: filteredAttendance?.filter(a => a.status === 'verified').length || 0,
        halfDay: filteredAttendance?.filter(a => a.is_half_day).length || 0,
        rejected: filteredAttendance?.filter(a => a.status === 'rejected').length || 0,
        noOfficeOut: filteredAttendance?.filter(a => a.check_in && !a.check_out).length || 0,
        all: filteredAttendance?.length || 0,
    }), [filteredAttendance])

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
                            isBulkUpdating={bulkVerifyMutation.isPending}
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
        </div>
    )
}
