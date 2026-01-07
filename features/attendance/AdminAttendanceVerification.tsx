"use client"

import React, { useState, useMemo, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { trpc } from "@/lib/trpc/client"
import { Search, Loader2, Clock, CheckCircle2, XCircle, FileText, Save } from "lucide-react"
import { toast } from "sonner"
import { getEventBroadcaster } from "@/lib/events/event-broadcaster"
import { Label } from "@/components/ui/label"
import { MetricCard } from "@/components/dashboard/metric-card"
import { cn } from "@/lib/utils"
import { useUserRealtimeDashboard } from "@/hooks/use-realtime-dashboard-data"
import { useProfile } from "@/lib/context/profile-context"

import { createAttendanceColumns } from "./attendance-columns"
import { DataTable } from "@/components/ui/data-table"
import { ProfileInfoCell } from "@/components/dashboard/profile-info-cell"
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
    const [statusFilter, setStatusFilter] = useState('all')
    const [dateFilter, setDateFilter] = useState('all')
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
    }, [])

    const utils = trpc.useUtils()

    // Get profile from context (shared across all components)
    const { profile } = useProfile()

    // Enable real-time updates for managers (Admin/Moderator)
    // This will automatically invalidate queries when attendance or activities change
    const {
        refetch: dashboardRefetch
    } = useUserRealtimeDashboard(
        profile?.id || '',
        undefined,
        (profile?.role as any) || 'moderator'
    )

    const bulkVerifyMutation = trpc.attendance.bulkVerifyAttendance.useMutation({
        onSuccess: () => {
            toast.success('Successfully updated records')
            setRowSelection({})
            utils.attendance.getAttendance.invalidate()

            // High-priority dashboard refresh
            dashboardRefetch({ forceFresh: true })
        },
        onError: (error) => toast.error(error.message)
    })
    const { data: attendance, isLoading } = trpc.attendance.getAttendance.useQuery({})
    const { data: settings } = trpc.attendance.getOfficeSettings.useQuery()

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

            // High-priority dashboard refresh
            dashboardRefetch({ forceFresh: true })
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

                // High-priority dashboard refresh
                dashboardRefetch({ forceFresh: true })
            }, 1000)
        },
        onError: (error) => toast.error(error.message)
    })

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
                (statusFilter === 'halfDay' ? record.is_half_day : record.status === statusFilter)

            const matchesDate = dateFilter === 'all' || record.date === dateFilter

            return matchesSearch && matchesStatus && matchesDate
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

    const stats = {
        pending: attendance?.filter(a => a.status === 'pending').length || 0,
        verified: attendance?.filter(a => a.status === 'verified').length || 0,
        halfDay: attendance?.filter(a => a.is_half_day).length || 0,
        rejected: attendance?.filter(a => a.status === 'rejected').length || 0,
        all: attendance?.length || 0,
    }

    if (!mounted) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="size-8 animate-spin text-primary/20" />
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard
                    title="Pending"
                    value={stats.pending.toString()}
                    icon={<Clock />}
                    iconBgColor="bg-amber-500/20"
                    iconColor="text-amber-700 dark:text-amber-400"
                    borderColor="border-amber-200/50 dark:border-amber-900/50"
                    cardBgColor="bg-amber-50/50 dark:bg-amber-900/5"
                    delay={0.1}
                />
                <MetricCard
                    title="Verified"
                    value={stats.verified.toString()}
                    icon={<CheckCircle2 />}
                    iconBgColor="bg-emerald-500/20"
                    iconColor="text-emerald-700 dark:text-emerald-400"
                    borderColor="border-emerald-200/50 dark:border-emerald-900/50"
                    cardBgColor="bg-emerald-50/50 dark:bg-emerald-900/5"
                    delay={0.2}
                />
                <MetricCard
                    title="Half Day"
                    value={stats.halfDay.toString()}
                    icon={<Clock className="rotate-180" />}
                    iconBgColor="bg-indigo-500/20"
                    iconColor="text-indigo-700 dark:text-indigo-400"
                    borderColor="border-indigo-200/50 dark:border-indigo-900/50"
                    cardBgColor="bg-indigo-50/50 dark:bg-indigo-900/5"
                    delay={0.3}
                />
                <MetricCard
                    title="Rejected"
                    value={stats.rejected.toString()}
                    icon={<XCircle />}
                    iconBgColor="bg-rose-500/20"
                    iconColor="text-rose-700 dark:text-rose-400"
                    borderColor="border-rose-200/50 dark:border-rose-900/50"
                    cardBgColor="bg-rose-50/50 dark:bg-rose-900/5"
                    delay={0.4}
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
