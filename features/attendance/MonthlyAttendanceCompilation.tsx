"use client"

import React, { useState, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { trpc } from "@/lib/trpc/client"
import { toast } from "sonner"
import { CalendarRange, RefreshCw, CheckCircle, Loader2, ArrowRight, Users, TrendingUp, FileEdit, Clock, FileUp } from "lucide-react"
import { CardShell } from "./CardShell"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { useRouter } from "next/navigation"
import { BulkMonthlySummaryUpload } from "./BulkMonthlySummaryUpload"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"

const MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
]

export function MonthlyAttendanceCompilation({ basePath }: { basePath: string }) {
    const router = useRouter()
    
    // Default to last completed month
    const currentDate = new Date()
    let defaultMonth = currentDate.getMonth() // 0-based, so current month - 1 is the 1-based previous month
    let defaultYear = currentDate.getFullYear()
    if (defaultMonth === 0) {
        defaultMonth = 12
        defaultYear -= 1
    }

    const [month, setMonth] = useState(defaultMonth)
    const [year, setYear] = useState(defaultYear)
    const [selectedIds, setSelectedIds] = useState<string[]>([])
    const [isBulkUploadOpen, setIsBulkUploadOpen] = useState(false)

    // Progress compilation states
    const [isCompileModalOpen, setIsCompileModalOpen] = useState(false)
    const [compilationProgress, setCompilationProgress] = useState({
        total: 0,
        current: 0,
        percentage: 0,
        activeEmployeeName: "",
        logs: [] as Array<{ name: string; status: 'success' | 'info' | 'error'; message: string }>,
        isFinished: false
    })

    const { data: summaries, isLoading, refetch } = trpc.salary.getMonthlySummaries.useQuery(
        { month, year },
        { placeholderData: (prev: any) => prev }
    )

    const compileSingleMutation = trpc.salary.compileMonthlyAttendance.useMutation()
    const { refetch: fetchActiveEmployees } = trpc.salary.getActiveEmployeesForCompilation.useQuery(undefined, { enabled: false })

    const handleStartCompilation = async () => {
        setIsCompileModalOpen(true)
        setCompilationProgress({
            total: 0,
            current: 0,
            percentage: 0,
            activeEmployeeName: "Fetching active employees...",
            logs: [],
            isFinished: false
        })

        try {
            const { data: employees } = await fetchActiveEmployees()
            if (!employees || employees.length === 0) {
                setCompilationProgress(prev => ({
                    ...prev,
                    activeEmployeeName: "No active employees found.",
                    isFinished: true
                }))
                return
            }

            setCompilationProgress(prev => ({
                ...prev,
                total: employees.length,
                activeEmployeeName: `Starting compilation for ${employees.length} employees...`
            }))

            let completed = 0
            const currentLogs: typeof compilationProgress.logs = []

            for (const employee of employees) {
                setCompilationProgress(prev => ({
                    ...prev,
                    current: completed + 1,
                    percentage: Math.round((completed / employees.length) * 100),
                    activeEmployeeName: employee.full_name || employee.email,
                    logs: [...currentLogs]
                }))

                try {
                    const result = await compileSingleMutation.mutateAsync({
                        month,
                        year,
                        profileId: employee.id
                    })

                    const summary = result[0]
                    let detailMsg = "Up to date"
                    if (summary) {
                        if (summary.status === 'draft') {
                            detailMsg = "Compiled (Draft)"
                        } else if (summary.status === 'payslip_generated') {
                            detailMsg = "Recalculated Payslip"
                        } else if (summary.status === 'set_for_salary') {
                            detailMsg = "Updated Summary"
                        }
                    }

                    currentLogs.push({
                        name: employee.full_name || employee.email,
                        status: 'success',
                        message: detailMsg
                    })
                } catch (err: any) {
                    currentLogs.push({
                        name: employee.full_name || employee.email,
                        status: 'error',
                        message: err.message || "Failed"
                    })
                }

                completed++
            }

            setCompilationProgress(prev => ({
                ...prev,
                current: completed,
                percentage: 100,
                activeEmployeeName: "Compilation finished.",
                logs: [...currentLogs],
                isFinished: true
            }))

            toast.success(`Completed attendance compilation for ${employees.length} employees`)
            refetch()
        } catch (err: any) {
            toast.error(err.message || "Compilation failed")
            setIsCompileModalOpen(false)
        }
    }

    const setForSalaryMutation = trpc.salary.setForSalary.useMutation({
        onSuccess: (data) => {
            toast.success(`${data.length} records confirmed for salary`)
            setSelectedIds([])
            refetch()
        },
        onError: (err) => toast.error(err.message),
    })

    const draftSummaries = useMemo(() =>
        summaries?.filter((s: any) => s.status === 'draft') || [], [summaries]
    )

    // Compute last compiled timestamp from summaries
    const lastCompiledAt = useMemo(() => {
        if (!summaries || summaries.length === 0) return null
        const maxDate = summaries.reduce((latest: string | null, s: any) => {
            const d = s.updated_at
            if (!d) return latest
            if (!latest) return d
            return new Date(d) > new Date(latest) ? d : latest
        }, null)
        return maxDate ? new Date(maxDate) : null
    }, [summaries])

    // Compute summary stats
    const summaryStats = useMemo(() => {
        if (!summaries || summaries.length === 0) return null
        const totalEmployees = summaries.length
        const avgPresent = summaries.reduce((sum: number, s: any) => {
            const wd = s.total_working_days || 1
            return sum + ((s.total_present_days || 0) / wd) * 100
        }, 0) / totalEmployees
        const draftCount = summaries.filter((s: any) => s.status === 'draft').length
        const setForSalaryCount = summaries.filter((s: any) => s.status === 'set_for_salary').length
        const payslipCount = summaries.filter((s: any) => s.status === 'payslip_generated').length
        return { totalEmployees, avgPresent: Math.round(avgPresent), draftCount, setForSalaryCount, payslipCount }
    }, [summaries])

    const toggleSelect = (id: string) => {
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        )
    }

    const toggleSelectAll = () => {
        if (selectedIds.length === draftSummaries.length) {
            setSelectedIds([])
        } else {
            setSelectedIds(draftSummaries.map((s: any) => s.id))
        }
    }

    const statusBadge = (status: string) => {
        switch (status) {
            case 'draft':
                return <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/20 text-[10px]">Draft</Badge>
            case 'set_for_salary':
                return <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-[10px]">Set for Salary</Badge>
            case 'payslip_generated':
                return <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px]">Payslip Generated</Badge>
            default:
                return <Badge variant="outline" className="text-[10px]">{status}</Badge>
        }
    }

    const roleBadge = (role: string) => {
        switch (role) {
            case 'admin':
                return <Badge className="bg-purple-500/15 text-purple-600 border-purple-500/25 text-[9px] px-1.5 py-0 font-medium hover:bg-purple-500/15">Admin</Badge>
            case 'moderator':
                return <Badge className="bg-sky-500/15 text-sky-600 border-sky-500/25 text-[9px] px-1.5 py-0 font-medium hover:bg-sky-500/15">Moderator</Badge>
            default:
                return <Badge className="bg-slate-500/10 text-slate-500 border-slate-500/20 text-[9px] px-1.5 py-0 font-medium hover:bg-slate-500/10">Employee</Badge>
        }
    }

    const attendancePercent = (present: number, workingDays: number) => {
        if (workingDays === 0) return 0
        return Math.round((present / workingDays) * 100)
    }

    const percentColor = (pct: number) => {
        if (pct >= 90) return 'text-emerald-600'
        if (pct >= 75) return 'text-amber-600'
        return 'text-rose-600'
    }

    const formatLastCompiled = (date: Date) => {
        return date.toLocaleDateString('en-IN', {
            month: 'short', day: 'numeric', year: 'numeric'
        }) + ' at ' + date.toLocaleTimeString('en-IN', {
            hour: 'numeric', minute: '2-digit', hour12: true
        })
    }

    // Utility to determine if a month is in the future or current month
    const isMonthDisabled = (mIndex: number, selectedYear: number) => {
        const currentM = currentDate.getMonth() + 1 // 1-12
        const currentY = currentDate.getFullYear()
        
        if (selectedYear > currentY) return true
        if (selectedYear === currentY && mIndex >= currentM) return true
        return false
    }

    return (
        <div className="space-y-6">
            {/* Controls */}
            <div className="flex flex-col sm:flex-row sm:items-end gap-4">
                <div className="flex items-center gap-2 flex-wrap">
                    <Select value={String(month)} onValueChange={(val) => setMonth(Number(val))}>
                        <SelectTrigger className="w-[140px]">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {MONTHS.map((m, i) => {
                                const mNum = i + 1
                                return (
                                    <SelectItem 
                                        key={i} 
                                        value={String(mNum)}
                                        disabled={isMonthDisabled(mNum, year)}
                                    >
                                        {m}
                                    </SelectItem>
                                )
                            })}
                        </SelectContent>
                    </Select>
                    <Select value={String(year)} onValueChange={(val) => {
                        const newYear = Number(val)
                        setYear(newYear)
                        if (isMonthDisabled(month, newYear)) {
                            setMonth(1)
                            if (newYear === currentDate.getFullYear()) {
                                setMonth(Math.max(1, currentDate.getMonth()))
                            }
                        }
                    }}>
                        <SelectTrigger className="w-[100px]">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {Array.from({ length: 5 }, (_, i) => currentDate.getFullYear() - 2 + i)
                                .filter(y => y <= currentDate.getFullYear())
                                .map(y => (
                                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                                ))}
                        </SelectContent>
                    </Select>
                    <div className="flex items-center gap-2">
                        <Button
                            onClick={handleStartCompilation}
                            disabled={isCompileModalOpen && !compilationProgress.isFinished}
                        >
                            <RefreshCw className="h-4 w-4 mr-1" />Compile
                        </Button>
                        {lastCompiledAt && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1 whitespace-nowrap">
                                <Clock className="h-3 w-3" />
                                {formatLastCompiled(lastCompiledAt)}
                            </span>
                        )}
                        <Button
                            variant="outline"
                            size="sm"
                            className="gap-1.5 rounded-lg"
                            onClick={() => setIsBulkUploadOpen(true)}
                        >
                            <FileUp className="h-4 w-4" />
                            Upload Summary
                        </Button>
                    </div>
                </div>

                <div className="flex items-center gap-2 sm:ml-auto">
                    {selectedIds.length > 0 && (
                        <Button
                            variant="default"
                            onClick={() => setForSalaryMutation.mutate({ ids: selectedIds })}
                            disabled={setForSalaryMutation.isPending}
                        >
                            {setForSalaryMutation.isPending
                                ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" />Processing...</>
                                : <><CheckCircle className="h-4 w-4 mr-1" />Set for Salary ({selectedIds.length})</>
                            }
                        </Button>
                    )}
                    {summaries?.some((s: any) => s.status === 'set_for_salary') && (
                        <Button
                            variant="outline"
                            onClick={() => router.push(`${basePath}/payslips`)}
                        >
                            <ArrowRight className="h-4 w-4 mr-1" />
                            Go to Payslips
                        </Button>
                    )}
                </div>
            </div>

            {/* Summary Stats Bar */}
            {summaryStats && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border/50 shadow-sm">
                        <div className="p-2 rounded-lg bg-primary/10">
                            <Users className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                            <p className="text-lg font-bold leading-none">{summaryStats.totalEmployees}</p>
                            <p className="text-[11px] text-muted-foreground mt-0.5">Employees</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border/50 shadow-sm">
                        <div className="p-2 rounded-lg bg-emerald-500/10">
                            <TrendingUp className="h-4 w-4 text-emerald-600" />
                        </div>
                        <div>
                            <p className="text-lg font-bold leading-none">{summaryStats.avgPresent}%</p>
                            <p className="text-[11px] text-muted-foreground mt-0.5">Avg Attendance</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border/50 shadow-sm">
                        <div className="p-2 rounded-lg bg-blue-500/10">
                            <FileEdit className="h-4 w-4 text-blue-600" />
                        </div>
                        <div>
                            <p className="text-lg font-bold leading-none">{summaryStats.draftCount}</p>
                            <p className="text-[11px] text-muted-foreground mt-0.5">Drafts</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border/50 shadow-sm">
                        <div className="p-2 rounded-lg bg-amber-500/10">
                            <CheckCircle className="h-4 w-4 text-amber-600" />
                        </div>
                        <div>
                            <p className="text-lg font-bold leading-none">{summaryStats.setForSalaryCount}</p>
                            <p className="text-[11px] text-muted-foreground mt-0.5">Set for Salary</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Summary Table */}
            <CardShell
                title={`Monthly Attendance — ${MONTHS[month - 1]} ${year}`}
                icon={CalendarRange}
                description="Compiled attendance summary for all employees"
                contentClassName="p-0"
            >
                {isLoading ? (
                    <div className="p-6 space-y-3">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="h-14 bg-muted/30 rounded-lg animate-pulse" />
                        ))}
                    </div>
                ) : !summaries || summaries.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground">
                        <CalendarRange className="h-12 w-12 mx-auto mb-3 opacity-30" />
                        <p className="font-medium">No data yet</p>
                        <p className="text-sm">Click "Compile" to generate monthly attendance</p>
                    </div>
                ) : (
                    <>
                        {/* Mobile Cards */}
                        <div className="divide-y divide-border/50 sm:hidden">
                            {summaries.map((s: any, index: number) => (
                                <div key={s.id} className="p-4 space-y-2">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            {s.status === 'draft' && (
                                                <Checkbox
                                                    checked={selectedIds.includes(s.id)}
                                                    onCheckedChange={() => toggleSelect(s.id)}
                                                />
                                            )}
                                            <div className="flex flex-col">
                                                <span className="font-semibold text-sm">{s.profile?.full_name || s.profile?.email}</span>
                                                <div className="flex items-center gap-1.5 mt-0.5">
                                                    <span className="text-[11px] text-muted-foreground">
                                                        {s.profile?.designation?.name || '—'}
                                                    </span>
                                                    {roleBadge(s.profile?.role || 'employee')}
                                                </div>
                                            </div>
                                        </div>
                                        {statusBadge(s.status)}
                                    </div>
                                    <div className="grid grid-cols-3 gap-2 text-xs">
                                         <div className="text-center p-1.5 rounded-md bg-slate-500/5">
                                             <p className="font-bold text-slate-700 dark:text-slate-300">{s.total_working_days}</p>
                                             <p className="text-[10px] text-muted-foreground">Month Days</p>
                                         </div>
                                         <div className="text-center p-1.5 rounded-md bg-emerald-500/5">
                                             <p className="font-bold text-emerald-600">{s.total_present_days}</p>
                                             <p className="text-[10px] text-muted-foreground">Present</p>
                                         </div>
                                         <div className="text-center p-1.5 rounded-md bg-rose-500/5">
                                             <p className="font-bold text-rose-600">{s.total_absent_days}</p>
                                             <p className="text-[10px] text-muted-foreground">Absent</p>
                                         </div>
                                         <div className="text-center p-1.5 rounded-md bg-orange-500/5">
                                             <p className="font-bold text-orange-600">{s.total_half_days}</p>
                                             <p className="text-[10px] text-muted-foreground">Half Days</p>
                                         </div>
                                         <div className="text-center p-1.5 rounded-md bg-blue-500/5">
                                             <p className="font-bold text-blue-600">{s.total_leaves}</p>
                                             <p className="text-[10px] text-muted-foreground">Leaves</p>
                                         </div>
                                         <div className="text-center p-1.5 rounded-md bg-amber-500/5">
                                             <p className="font-bold text-amber-600">{(s.salary_breakdown as any)?.extra_days || 0}</p>
                                             <p className="text-[10px] text-muted-foreground">Extra Days</p>
                                         </div>
                                     </div>
                                </div>
                            ))}
                        </div>

                        {/* Desktop Table */}
                        <div className="hidden sm:block overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-border/50 bg-muted/30">
                                        <th className="p-3 text-left w-10">
                                            {draftSummaries.length > 0 && (
                                                <Checkbox
                                                    checked={selectedIds.length === draftSummaries.length && draftSummaries.length > 0}
                                                    onCheckedChange={toggleSelectAll}
                                                />
                                            )}
                                        </th>
                                        <th className="p-3 text-center font-semibold text-muted-foreground w-10">#</th>
                                        <th className="p-3 text-left font-semibold text-muted-foreground">Employee</th>
                                        <th className="p-3 text-left font-semibold text-muted-foreground">Designation</th>
                                        <th className="p-3 text-center font-semibold text-muted-foreground">Calendar Days</th>
                                        <th className="p-3 text-center font-semibold text-muted-foreground">Present</th>
                                        <th className="p-3 text-center font-semibold text-muted-foreground">Absent</th>
                                        <th className="p-3 text-center font-semibold text-muted-foreground">Half Days</th>
                                        <th className="p-3 text-center font-semibold text-muted-foreground">Leaves</th>
                                        <th className="p-3 text-center font-semibold text-muted-foreground">Extra Days</th>
                                        <th className="p-3 text-center font-semibold text-muted-foreground">Hours</th>
                                        <th className="p-3 text-center font-semibold text-muted-foreground">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border/30">
                                    {summaries.map((s: any, index: number) => {
                                        const pct = attendancePercent(s.total_present_days, s.total_working_days)
                                        return (
                                            <tr key={s.id} className="hover:bg-muted/20 transition-colors">
                                                <td className="p-3">
                                                    {s.status === 'draft' && (
                                                        <Checkbox
                                                            checked={selectedIds.includes(s.id)}
                                                            onCheckedChange={() => toggleSelect(s.id)}
                                                        />
                                                    )}
                                                </td>
                                                <td className="p-3 text-center text-muted-foreground text-xs">{index + 1}</td>
                                                <td className="p-3">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-medium">{s.profile?.full_name || s.profile?.email}</span>
                                                        {roleBadge(s.profile?.role || 'employee')}
                                                    </div>
                                                </td>
                                                <td className="p-3 text-muted-foreground text-xs">
                                                    {s.profile?.designation?.name || <span className="opacity-40">—</span>}
                                                </td>
                                                <td className="p-3 text-center">{s.total_working_days}</td>
                                                <td className="p-3 text-center">
                                                    <div className="flex flex-col items-center">
                                                        <span className="font-bold text-emerald-600">{s.total_present_days}</span>
                                                        <span className={`text-[10px] ${percentColor(pct)}`}>{pct}%</span>
                                                    </div>
                                                </td>
                                                <td className="p-3 text-center">
                                                    <span className="font-bold text-rose-600">{s.total_absent_days}</span>
                                                </td>
                                                <td className="p-3 text-center">{s.total_half_days}</td>
                                                <td className="p-3 text-center">{s.total_leaves}</td>
                                                <td className="p-3 text-center">
                                                    <span className="font-bold text-amber-600">{(s.salary_breakdown as any)?.extra_days || 0}</span>
                                                </td>
                                                <td className="p-3 text-center text-muted-foreground">{s.total_working_hours || 0}h</td>
                                                <td className="p-3 text-center">{statusBadge(s.status)}</td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}
            </CardShell>

            <BulkMonthlySummaryUpload
                isOpen={isBulkUploadOpen}
                onOpenChange={setIsBulkUploadOpen}
                initialMonth={month}
                initialYear={year}
            />

            <Dialog 
                open={isCompileModalOpen} 
                onOpenChange={(open) => {
                    if (!compilationProgress.isFinished) return
                    setIsCompileModalOpen(open)
                }}
            >
                <DialogContent className="max-w-[480px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <RefreshCw className={`h-5 w-5 text-orange-500 ${!compilationProgress.isFinished ? 'animate-spin' : ''}`} />
                            Attendance Compilation
                        </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4 py-2">
                        <div className="flex justify-between items-center text-sm font-medium">
                            <span className="text-muted-foreground">
                                {!compilationProgress.isFinished 
                                    ? `Processing ${compilationProgress.current} of ${compilationProgress.total}`
                                    : "Compilation Complete"
                                }
                            </span>
                            <span className="text-orange-500 font-bold">{compilationProgress.percentage}%</span>
                        </div>

                        <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 bg-muted overflow-hidden">
                            <div 
                                className="bg-gradient-to-r from-orange-500 to-rose-500 h-full transition-all duration-300"
                                style={{ width: `${compilationProgress.percentage}%` }}
                            />
                        </div>

                        <div className="bg-slate-50 dark:bg-slate-900 border border-border/50 rounded-xl p-3 flex items-center gap-3">
                            {!compilationProgress.isFinished ? (
                                <Loader2 className="h-4 w-4 animate-spin text-orange-500 shrink-0" />
                            ) : (
                                <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />
                            )}
                            <span className="text-xs font-semibold truncate leading-none">
                                {compilationProgress.activeEmployeeName}
                            </span>
                        </div>

                        <div className="border border-border/50 rounded-xl bg-slate-50/50 dark:bg-slate-900/50 overflow-hidden">
                            <div className="bg-muted/50 px-3 py-2 border-b border-border/50 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                                Process Logs
                            </div>
                            <div className="h-[180px] overflow-y-auto p-3 space-y-2 text-xs font-medium scroll-smooth">
                                {compilationProgress.logs.map((log, index) => (
                                    <div key={index} className="flex justify-between items-center bg-card p-2 rounded-lg border border-border/30">
                                        <span className="font-semibold truncate pr-2">{log.name}</span>
                                        <span className={`text-[10px] font-black uppercase tracking-wider shrink-0 px-2 py-0.5 rounded-md ${
                                            log.status === 'success' 
                                                ? log.message === 'Up to date' 
                                                    ? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                                                    : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400'
                                                : 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400'
                                        }`}>
                                            {log.message}
                                        </span>
                                    </div>
                                ))}
                                {compilationProgress.logs.length === 0 && (
                                    <div className="text-center text-muted-foreground py-12 text-xs">
                                        Waiting to start...
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="flex justify-end pt-2">
                            <Button 
                                onClick={() => setIsCompileModalOpen(false)}
                                disabled={!compilationProgress.isFinished}
                            >
                                Done
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}
