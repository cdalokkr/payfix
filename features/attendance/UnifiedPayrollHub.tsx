"use client"

import React, { useState, useMemo, useEffect } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { trpc } from "@/lib/trpc/client"
import { toast } from "sonner"
import { 
    CalendarRange, 
    Receipt, 
    Sparkles, 
    CheckCircle2, 
    AlertTriangle, 
    Clock, 
    Users, 
    IndianRupee, 
    ArrowRight, 
    RefreshCw, 
    Lock, 
    FileSpreadsheet, 
    Zap, 
    FileUp,
    CheckCheck,
    CheckCircle,
    XCircle,
    Loader2,
    BookOpen
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Progress } from "@/components/ui/progress"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter
} from "@/components/ui/dialog"
import { MonthlyAttendanceCompilation } from "./MonthlyAttendanceCompilation"
import { PayslipGeneration } from "./PayslipGeneration"
import { MonthlyBonusDialog } from "./MonthlyBonusDialog"
import { BulkMonthlySummaryUpload } from "./BulkMonthlySummaryUpload"
import { SalaryPassbookView } from "@/features/payroll/SalaryPassbookView"

interface UnifiedPayrollHubProps {
    basePath: string
    defaultTab?: "attendance" | "payslips" | "salary_book"
}

const MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
]

export function UnifiedPayrollHub({ basePath, defaultTab = "attendance" }: UnifiedPayrollHubProps) {
    const searchParams = useSearchParams()
    const router = useRouter()

    // Determine current date and max allowed month & year
    // An ongoing or future month cannot be compiled/calculated for payroll
    const currentDate = new Date()
    const currentYear = currentDate.getFullYear()
    const currentMonth = currentDate.getMonth() + 1 // 1-12

    const maxCompletedMonth = currentMonth === 1 ? 12 : currentMonth - 1
    const maxCompletedYear = currentMonth === 1 ? currentYear - 1 : currentYear

    const availableYears = [maxCompletedYear - 2, maxCompletedYear - 1, maxCompletedYear]

    // URL params override if present
    const paramMonth = searchParams.get("month") ? Number(searchParams.get("month")) : null
    const paramYear = searchParams.get("year") ? Number(searchParams.get("year")) : null
    const paramTab = searchParams.get("tab") as "attendance" | "payslips" | "salary_book" | null

    const [month, setMonth] = useState<number>(
        paramMonth && paramMonth >= 1 && paramMonth <= 12 ? paramMonth : maxCompletedMonth
    )
    const [year, setYear] = useState<number>(
        paramYear && paramYear >= 2020 && paramYear <= maxCompletedYear ? paramYear : maxCompletedYear
    )
    const [activeTab, setActiveTab] = useState<"attendance" | "payslips" | "salary_book">(paramTab || defaultTab)
    const [isBonusModalOpen, setIsBonusModalOpen] = useState(false)
    const [isBulkUploadOpen, setIsBulkUploadOpen] = useState(false)
    const [isFastRunOpen, setIsFastRunOpen] = useState(false)
    const [isFastRunning, setIsFastRunning] = useState(false)
    const [fastRunStep, setFastRunStep] = useState<string>("")

    // Bulk Compilation Progress modal state
    const [isCompileConfirmOpen, setIsCompileConfirmOpen] = useState(false)
    const [isCompileModalOpen, setIsCompileModalOpen] = useState(false)
    const [compilationProgress, setCompilationProgress] = useState({
        total: 0,
        current: 0,
        percentage: 0,
        activeEmployeeName: "",
        logs: [] as Array<{ name: string; status: 'success' | 'info' | 'error'; message: string }>,
        isFinished: false
    })

    const utils = trpc.useUtils()

    // Sync tab when param changes or defaultTab changes
    useEffect(() => {
        if (paramTab && (paramTab === "attendance" || paramTab === "payslips" || paramTab === "salary_book")) {
            setActiveTab(paramTab)
        }
    }, [paramTab])

    const handleTabChange = (tab: "attendance" | "payslips" | "salary_book") => {
        setActiveTab(tab)
        const params = new URLSearchParams(window.location.search)
        params.set("tab", tab)
        params.set("month", String(month))
        params.set("year", String(year))
        window.history.replaceState(null, '', `?${params.toString()}`)
    }

    const handleYearChange = (newYear: number) => {
        setYear(newYear)
        if (newYear === currentYear && month > maxCompletedMonth) {
            setMonth(maxCompletedMonth)
        }
    }

    // Fetch summaries to compute global pipeline progress
    const { data: summaries, isLoading: isSummariesLoading, refetch: refetchSummaries } = trpc.salary.getMonthlySummaries.useQuery(
        { month, year },
        { placeholderData: (prev) => prev }
    )

    // Last compiled timestamp from summaries
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

    const formatLastCompiled = (date: Date) => {
        return date.toLocaleDateString('en-IN', {
            month: 'short', day: 'numeric'
        }) + ' at ' + date.toLocaleTimeString('en-IN', {
            hour: 'numeric', minute: '2-digit', hour12: true
        })
    }

    // Pipeline metrics
    const metrics = useMemo(() => {
        const total = summaries?.length || 0
        if (total === 0) {
            return {
                totalStaff: 0,
                compiledCount: 0,
                approvedCount: 0,
                payslipsCount: 0,
                staleCount: 0,
                releasedCount: 0,
                totalNetPay: 0,
                isAllAttendanceApproved: false,
                isAllPayslipsGenerated: false,
            }
        }

        let approved = 0
        let payslips = 0
        let stale = 0
        let released = 0
        let totalNet = 0

        summaries.forEach((s: any) => {
            if (s.status === 'set_for_salary' || s.status === 'payslip_generated') {
                approved++
            }
            if (s.status === 'payslip_generated') {
                payslips++
                totalNet += Number(s.take_home) || 0
            }
            if (s.needs_recompile) {
                stale++
            }
            if (s.released_to_employee) {
                released++
            }
        })

        return {
            totalStaff: total,
            compiledCount: total,
            approvedCount: approved,
            payslipsCount: payslips,
            staleCount: stale,
            releasedCount: released,
            totalNetPay: totalNet,
            isAllAttendanceApproved: approved > 0 && approved === total,
            isAllPayslipsGenerated: payslips > 0 && payslips === total,
        }
    }, [summaries])

    // Compilation mutations
    const compileSingleMutation = trpc.salary.compileMonthlyAttendance.useMutation()
    const { refetch: fetchActiveEmployees } = trpc.salary.getActiveEmployeesForCompilation.useQuery(undefined, { enabled: false })
    const setForSalaryMutation = trpc.salary.setForSalary.useMutation()
    const generatePayslipsMutation = trpc.salary.generatePayslips.useMutation()

    // Bulk Compilation Handler
    const handleStartBulkCompilation = async () => {
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
                        message: err.message || "Compilation failed"
                    })
                }

                completed++
            }

            setCompilationProgress(prev => ({
                ...prev,
                percentage: 100,
                activeEmployeeName: "Compilation completed!",
                logs: [...currentLogs],
                isFinished: true
            }))

            toast.success(`Successfully compiled attendance for ${completed} employees`)
            refetchSummaries()
            utils.salary.getMonthlySummaries.invalidate({ month, year })
        } catch (err: any) {
            toast.error(err.message || "Failed to compile attendance")
            setIsCompileModalOpen(false)
        }
    }

    // 1-Click Fast Run Handler
    const handleFastRunExecute = async () => {
        setIsFastRunning(true)
        try {
            setFastRunStep("1. Fetching active staff profiles...")
            const { data: employees } = await fetchActiveEmployees()
            if (!employees || employees.length === 0) {
                toast.error("No active employees found to process.")
                setIsFastRunning(false)
                setIsFastRunOpen(false)
                return
            }

            setFastRunStep(`2. Compiling attendance for ${employees.length} employees...`)
            const summaryIds: string[] = []
            for (const emp of employees) {
                const res = await compileSingleMutation.mutateAsync({
                    month,
                    year,
                    profileId: emp.id
                })
                if (res && res[0]?.id) {
                    summaryIds.push(res[0].id)
                }
            }

            setFastRunStep(`3. Confirming attendance summaries for payroll...`)
            if (summaryIds.length > 0) {
                await setForSalaryMutation.mutateAsync({ ids: summaryIds })
            }

            setFastRunStep(`4. Calculating gross salary, deductions, bonuses & generating payslips...`)
            if (summaryIds.length > 0) {
                await generatePayslipsMutation.mutateAsync({ ids: summaryIds })
            }

            toast.success(`1-Click Payroll Run complete! Generated payslips for ${summaryIds.length} staff.`)
            await refetchSummaries()
            utils.salary.getMonthlySummaries.invalidate({ month, year })
            setIsFastRunOpen(false)
            setActiveTab("payslips")
        } catch (err: any) {
            toast.error(err.message || "Failed to complete 1-Click Payroll Run")
        } finally {
            setIsFastRunning(false)
            setFastRunStep("")
        }
    }

    return (
        <div className="space-y-6">
            {/* Top Workspace Bar */}
            <div className="p-3 sm:p-4 rounded-2xl bg-gradient-to-br from-white via-slate-50 to-indigo-50/40 dark:from-zinc-900 dark:via-zinc-900/90 dark:to-indigo-950/20 border border-slate-200 dark:border-zinc-800 shadow-xs">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                    {/* Left: Month, Year, and when on Step 1: Compile & Upload Summary */}
                    <div className="flex items-center gap-2 flex-wrap">
                        {/* Clean Month & Year Selector (No Chevrons, Compact Gaps) */}
                        <div className="flex items-center gap-1 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-1.5 h-[42px] shadow-xs shrink-0">
                            <Select value={String(month)} onValueChange={(val) => setMonth(Number(val))}>
                                <SelectTrigger className="h-8 border-none font-bold text-sm bg-transparent px-1.5 w-auto gap-1 focus:ring-0">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {MONTHS.map((m, i) => {
                                        const mNum = i + 1
                                        const isFutureOrCurrent = year === currentYear && mNum > maxCompletedMonth
                                        return (
                                            <SelectItem key={i} value={String(mNum)} disabled={isFutureOrCurrent}>
                                                {m}
                                            </SelectItem>
                                        )
                                    })}
                                </SelectContent>
                            </Select>

                            <div className="h-4 w-[1px] bg-slate-200 dark:bg-zinc-700 mx-0.5" />

                            <Select value={String(year)} onValueChange={(val) => handleYearChange(Number(val))}>
                                <SelectTrigger className="h-8 border-none font-bold text-sm bg-transparent px-1.5 w-auto gap-1 focus:ring-0">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {availableYears.map(y => (
                                        <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Compile and Upload Summary in the SAME row! */}
                        {activeTab === "attendance" && (
                            <div className="flex items-center gap-2">
                                <Button
                                    onClick={() => setIsCompileConfirmOpen(true)}
                                    disabled={isCompileModalOpen && !compilationProgress.isFinished}
                                    className={`h-[42px] px-3.5 text-xs font-semibold rounded-xl flex flex-col items-center justify-center leading-tight gap-0.5 shadow-xs ${
                                        metrics.staleCount > 0 
                                            ? "bg-amber-600 hover:bg-amber-700 text-white" 
                                            : "bg-primary hover:bg-primary/90 text-white"
                                    }`}
                                >
                                    <div className="flex items-center gap-1.5">
                                        <RefreshCw className={`h-3 w-3 ${metrics.staleCount > 0 ? "animate-pulse" : ""}`} />
                                        <span>{metrics.staleCount > 0 ? `Re-compile (${metrics.staleCount})` : "Compile"}</span>
                                    </div>
                                    {lastCompiledAt && (
                                        <span className="text-[9.5px] font-normal opacity-85 tracking-tight">
                                            {formatLastCompiled(lastCompiledAt)}
                                        </span>
                                    )}
                                </Button>

                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-[42px] px-3 gap-1.5 rounded-xl text-xs font-semibold"
                                    onClick={() => setIsBulkUploadOpen(true)}
                                >
                                    <FileUp className="h-3.5 w-3.5" />
                                    Upload Summary
                                </Button>
                            </div>
                        )}
                    </div>

                    {/* Right: Actions */}
                    <div className="flex flex-wrap items-center gap-2">
                        <Button
                            variant="outline"
                            onClick={() => setIsBonusModalOpen(true)}
                            className="h-[42px] gap-1.5 rounded-xl border-purple-300 dark:border-purple-800 text-purple-700 dark:text-purple-300 bg-purple-50/70 dark:bg-purple-950/30 hover:bg-purple-100 dark:hover:bg-purple-900/40 text-xs font-bold"
                        >
                            <Sparkles className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
                            Bonus / Incentives
                        </Button>

                        <Button
                            onClick={() => setIsFastRunOpen(true)}
                            className="h-[42px] gap-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-bold text-xs shadow-sm"
                        >
                            <Zap className="h-3.5 w-3.5 fill-white text-white" />
                            1-Click Fast Run
                        </Button>

                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => refetchSummaries()}
                            className="h-[42px] w-[42px] p-0 rounded-xl text-slate-500 hover:text-slate-900 dark:hover:text-white"
                            title="Refresh Data"
                        >
                            <RefreshCw className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </div>

            {/* Seamless Single Tabs Switcher */}
            <Tabs value={activeTab} onValueChange={(val) => handleTabChange(val as "attendance" | "payslips" | "salary_book")} className="w-full space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-zinc-800 pb-2">
                    <TabsList className="bg-slate-100 dark:bg-zinc-800/80 p-1 rounded-xl h-11">
                        <TabsTrigger 
                            value="attendance" 
                            className="rounded-lg text-xs font-bold gap-2 data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-900 data-[state=active]:shadow-xs px-4 h-9"
                        >
                            <CalendarRange className="h-4 w-4 text-primary" />
                            Step 1: Attendance & Working Days
                        </TabsTrigger>

                        <TabsTrigger 
                            value="payslips" 
                            className="rounded-lg text-xs font-bold gap-2 data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-900 data-[state=active]:shadow-xs px-4 h-9"
                        >
                            <Receipt className="h-4 w-4 text-emerald-600" />
                            Step 2: Payslips & Distribution
                        </TabsTrigger>

                        <TabsTrigger 
                            value="salary_book" 
                            className="rounded-lg text-xs font-bold gap-2 data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-900 data-[state=active]:shadow-xs px-4 h-9"
                        >
                            <BookOpen className="h-4 w-4 text-blue-600" />
                            Step 3: Salary Book (Passbook)
                        </TabsTrigger>
                    </TabsList>
                </div>

                {/* Tab 1: Attendance Compilation */}
                <TabsContent value="attendance" className="mt-0 outline-hidden">
                    <MonthlyAttendanceCompilation
                        basePath={basePath}
                        controlledMonth={month}
                        controlledYear={year}
                        onMonthChange={setMonth}
                        onYearChange={setYear}
                        onProceedToPayslips={() => handleTabChange("payslips")}
                        isUnified={true}
                    />
                </TabsContent>

                {/* Tab 2: Payslip Generation */}
                <TabsContent value="payslips" className="mt-0 outline-hidden">
                    <PayslipGeneration
                        basePath={basePath}
                        controlledMonth={month}
                        controlledYear={year}
                        onMonthChange={setMonth}
                        onYearChange={setYear}
                        onBackToAttendance={() => handleTabChange("attendance")}
                        isUnified={true}
                    />
                </TabsContent>

                {/* Tab 3: Salary Book (Passbook) */}
                <TabsContent value="salary_book" className="mt-0 outline-hidden">
                    <SalaryPassbookView basePath={basePath} />
                </TabsContent>
            </Tabs>

            {/* Monthly Bonus Modal */}
            <MonthlyBonusDialog
                isOpen={isBonusModalOpen}
                onOpenChange={setIsBonusModalOpen}
                month={month}
                year={year}
                onSuccess={() => {
                    refetchSummaries()
                    utils.salary.getMonthlySummaries.invalidate({ month, year })
                }}
            />

            {/* Bulk Upload Modal */}
            <BulkMonthlySummaryUpload
                isOpen={isBulkUploadOpen}
                onOpenChange={setIsBulkUploadOpen}
                initialMonth={month}
                initialYear={year}
            />

            {/* Bulk Compilation Confirmation Modal */}
            <Dialog open={isCompileConfirmOpen} onOpenChange={setIsCompileConfirmOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-white">
                            <RefreshCw className="h-5 w-5 text-primary" />
                            Compile Monthly Attendance?
                        </DialogTitle>
                        <DialogDescription className="text-xs text-muted-foreground">
                            Attendance compilation for <strong>{MONTHS[month - 1]} {year}</strong>
                        </DialogDescription>
                    </DialogHeader>

                    <div className="py-2 space-y-2 text-xs text-muted-foreground bg-slate-50 dark:bg-zinc-800/60 p-3 rounded-xl border border-slate-200 dark:border-zinc-700">
                        <p className="font-semibold text-slate-800 dark:text-slate-200">
                            The following actions will be performed:
                        </p>
                        <ul className="list-disc pl-4 space-y-1">
                            <li>Process biometric machine punch logs, check-in & check-out times.</li>
                            <li>Calculate total present days, absent days, half-days & approved leaves.</li>
                            <li>Detect extra shifts from duty rosters & verify active incentives.</li>
                            <li>Generate or refresh draft monthly attendance records for all active staff.</li>
                        </ul>
                    </div>

                    <DialogFooter className="gap-2 sm:gap-0 pt-2">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setIsCompileConfirmOpen(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            onClick={() => {
                                setIsCompileConfirmOpen(false)
                                handleStartBulkCompilation()
                            }}
                            className="bg-primary hover:bg-primary/90 text-white font-semibold gap-1.5"
                        >
                            <RefreshCw className="h-3.5 w-3.5" />
                            Confirm & Compile
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Bulk Compilation Progress Modal */}
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
                            {compilationProgress.isFinished ? (
                                <CheckCircle className="h-5 w-5 text-emerald-500" />
                            ) : (
                                <RefreshCw className="h-5 w-5 animate-spin text-primary" />
                            )}
                            {compilationProgress.isFinished ? "Attendance Compilation Complete" : "Compiling Monthly Attendance"}
                        </DialogTitle>
                        <DialogDescription>
                            Period: <strong>{MONTHS[month - 1]} {year}</strong>
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-3">
                        <div className="space-y-1.5">
                            <div className="flex justify-between text-xs text-muted-foreground">
                                <span>{compilationProgress.activeEmployeeName}</span>
                                <span className="font-semibold">{compilationProgress.percentage}%</span>
                            </div>
                            <Progress value={compilationProgress.percentage} className="h-2" />
                            <div className="text-[11px] text-muted-foreground text-right">
                                {compilationProgress.current} / {compilationProgress.total} employees processed
                            </div>
                        </div>

                        {compilationProgress.logs.length > 0 && (
                            <div className="border rounded-lg bg-muted/20 p-2 max-h-48 overflow-y-auto space-y-1 text-xs">
                                {compilationProgress.logs.map((log, index) => (
                                    <div key={index} className="flex items-center justify-between py-1 border-b border-border/40 last:border-none">
                                        <span className="font-medium truncate max-w-[220px]">{log.name}</span>
                                        <div className="flex items-center gap-1">
                                            {log.status === 'success' && <CheckCircle className="h-3.5 w-3.5 text-emerald-500 shrink-0" />}
                                            {log.status === 'error' && <XCircle className="h-3.5 w-3.5 text-destructive shrink-0" />}
                                            <span className={`text-[10px] ${log.status === 'error' ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                                                {log.message}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <DialogFooter>
                        <Button 
                            disabled={!compilationProgress.isFinished}
                            onClick={() => setIsCompileModalOpen(false)}
                            className="w-full"
                        >
                            {compilationProgress.isFinished ? "Done" : "Compiling..."}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* 1-Click Fast Run Confirmation & Progress Modal */}
            <Dialog open={isFastRunOpen} onOpenChange={(open) => !isFastRunning && setIsFastRunOpen(open)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-amber-600 dark:text-amber-500">
                            <Zap className="h-5 w-5 fill-amber-500 text-amber-500" />
                            1-Click Complete Monthly Payroll Run
                        </DialogTitle>
                        <DialogDescription>
                            This will automatically compile attendance from all biometric devices, shift rosters & leaves, approve all summaries, and generate payslips for <strong>{MONTHS[month - 1]} {year}</strong> in a single automated step.
                        </DialogDescription>
                    </DialogHeader>

                    {isFastRunning ? (
                        <div className="py-6 space-y-3 text-center">
                            <RefreshCw className="h-8 w-8 text-amber-500 animate-spin mx-auto" />
                            <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                                Processing Payroll in Progress...
                            </p>
                            <p className="text-xs text-muted-foreground animate-pulse">
                                {fastRunStep}
                            </p>
                        </div>
                    ) : (
                        <div className="py-2 space-y-2 text-xs text-muted-foreground bg-amber-500/5 p-3 rounded-xl border border-amber-500/20">
                            <p className="font-semibold text-amber-800 dark:text-amber-200">
                                What this does:
                            </p>
                            <ul className="list-disc pl-4 space-y-1">
                                <li>Pulls all punch logs, roster extra shifts & approved leaves.</li>
                                <li>Calculates total present, half, absent & extra days (1.0x / 0.5x).</li>
                                <li>Syncs active monthly bonus/incentives into income breakdown.</li>
                                <li>Calculates gross salary, absence deductions & net take-home pay.</li>
                                <li>Automatically displays completed payslips in Step 2.</li>
                            </ul>
                        </div>
                    )}

                    <DialogFooter className="pt-2">
                        <Button 
                            type="button" 
                            variant="outline" 
                            onClick={() => setIsFastRunOpen(false)}
                            disabled={isFastRunning}
                        >
                            Cancel
                        </Button>
                        <Button 
                            onClick={handleFastRunExecute} 
                            disabled={isFastRunning}
                            className="bg-amber-600 hover:bg-amber-700 text-white font-bold gap-2"
                        >
                            {isFastRunning ? (
                                <>
                                    <RefreshCw className="h-4 w-4 animate-spin" />
                                    Processing...
                                </>
                            ) : (
                                <>
                                    <Zap className="h-4 w-4 fill-white" />
                                    Start Full Run
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
