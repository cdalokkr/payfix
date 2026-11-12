"use client"

import React, { useState, useMemo, useRef } from "react"
import { trpc } from "@/lib/trpc/client"
import { toast } from "sonner"
import { 
    BookOpen, 
    Printer, 
    Download, 
    RefreshCw, 
    User, 
    Building2, 
    Briefcase, 
    Calendar, 
    CheckCircle2, 
    AlertCircle, 
    Clock, 
    FileText, 
    Filter,
    ArrowLeft,
    Receipt,
    Wallet,
    IndianRupee,
    CreditCard
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
    Select, 
    SelectContent, 
    SelectItem, 
    SelectTrigger, 
    SelectValue 
} from "@/components/ui/select"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

interface SalaryPassbookViewProps {
    basePath?: string
    initialProfileId?: string | null
}

const formatCurrency = (amt?: number | string | null): string => {
    const val = Number(amt) || 0
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 2,
    }).format(val)
}

export function SalaryPassbookView({ basePath = "/admin/payroll", initialProfileId = null }: SalaryPassbookViewProps) {
    const [selectedProfileId, setSelectedProfileId] = useState<string | null>(initialProfileId)
    const [selectedYear, setSelectedYear] = useState<number | null>(null)
    const [statusFilter, setStatusFilter] = useState<string>("all")
    const printRef = useRef<HTMLDivElement>(null)

    // Query salary book data
    const { data: salaryBookData, isLoading, refetch, isFetching } = trpc.salary.getSalaryBook.useQuery({
        profileId: selectedProfileId || undefined,
        year: selectedYear || undefined,
        status: statusFilter === "all" ? undefined : statusFilter,
    }, {
        staleTime: 10000,
        refetchOnWindowFocus: false,
    })

    // Fetch all employees for dropdown selector
    const { data: allEmployeesData } = trpc.salary.getEmployeesByRole.useQuery({
        roleGroup: 'employee',
    })

    const employees = useMemo(() => {
        return allEmployeesData || []
    }, [allEmployeesData])

    // Find currently selected employee object with normalized fields
    const selectedEmployee = useMemo(() => {
        if (!selectedProfileId) return null
        const fromList = employees.find(e => e.id === selectedProfileId)
        const fromRecords = salaryBookData?.records?.find(r => r.profileId === selectedProfileId)?.profile
        const fromLedger = salaryBookData?.employeeLedger?.find(l => l.profile.id === selectedProfileId)?.profile

        const emp: any = fromList || fromRecords || fromLedger
        if (!emp) return null

        const rawName = emp.fullName || emp.full_name || emp.name || emp.email || 'Employee'
        const rawMobile = emp.mobileNo || emp.mobile_no || '--'
        const rawDesignation = emp.designationName || emp.designation_name || emp.designation?.name || 'Staff'
        const rawDepartment = emp.departmentName || emp.department_name || emp.department?.name || 'General'
        const rawAvatar = emp.avatarUrl || emp.avatar_url || null

        return {
            ...emp,
            fullName: rawName,
            full_name: rawName,
            mobileNo: rawMobile,
            mobile_no: rawMobile,
            designationName: rawDesignation,
            designation_name: rawDesignation,
            departmentName: rawDepartment,
            department_name: rawDepartment,
            avatarUrl: rawAvatar,
            avatar_url: rawAvatar,
        }
    }, [selectedProfileId, employees, salaryBookData])

    // Filtered ledger list
    const filteredEmployeeLedger = useMemo(() => {
        return salaryBookData?.employeeLedger || []
    }, [salaryBookData?.employeeLedger])

    // Filtered monthly records for individual passbook
    const filteredRecords = useMemo(() => {
        return salaryBookData?.records || []
    }, [salaryBookData?.records])

    const grandTotals = salaryBookData?.grandTotals || {
        totalPayslips: 0,
        totalGross: 0,
        totalAbsenceDeductions: 0,
        totalNet: 0,
        totalAdvanceRecovery: 0,
        totalTakeHome: 0,
        totalPaid: 0,
        totalBalanceDue: 0,
    }

    // Print Passbook Statement
    const handlePrint = () => {
        window.print()
    }

    // Export to Excel using exceljs
    const handleExportExcel = async (targetProfileId?: string) => {
        try {
            toast.loading("Generating Passbook Excel...")
            const ExcelJS = (await import('exceljs')).default
            const workbook = new ExcelJS.Workbook()
            workbook.creator = 'PayFix'
            workbook.created = new Date()

            const activeProfileId = targetProfileId || selectedProfileId
            const activeEmployee = targetProfileId
                ? (salaryBookData?.employeeLedger?.find(l => l.profile.id === targetProfileId)?.profile || 
                   employees.find(e => e.id === targetProfileId) || 
                   salaryBookData?.records?.find(r => r.profileId === targetProfileId)?.profile)
                : selectedEmployee

            const rawEmpName = activeEmployee?.fullName || (activeEmployee as any)?.full_name || 'Staff'
            const cleanEmpName = rawEmpName
                .trim()
                .replace(/\s+/g, '_')
                .replace(/[^a-zA-Z0-9_\-]/g, '') || 'Staff'

            const sheetTitle = activeProfileId 
                ? `${cleanEmpName.slice(0, 20)} Passbook` 
                : 'Master Salary Book'

            const worksheet = workbook.addWorksheet(sheetTitle, {
                views: [{ showGridLines: true }]
            })

            if (activeProfileId && activeEmployee) {
                // Individual Passbook Sheet
                worksheet.addRow(['EMPLOYEE SALARY PASSBOOK STATEMENT'])
                worksheet.addRow([`Employee Name:`, rawEmpName, `Role:`, (activeEmployee as any).role || 'employee'])
                worksheet.addRow([`Mobile:`, (activeEmployee as any).mobileNo || (activeEmployee as any).mobile_no || '--', `Designation:`, (activeEmployee as any).designationName || (activeEmployee as any).designation_name || '--'])
                worksheet.addRow([`Export Date:`, new Date().toLocaleDateString('en-GB')])
                worksheet.addRow([]) // Spacer

                // Table Header
                const headers = [
                    'Month & Year',
                    'Working Days',
                    'Present',
                    'Half Days',
                    'Absent',
                    'Leaves',
                    'Extra Hours',
                    'Gross Salary (₹)',
                    'Absence Deduct (₹)',
                    'Advance Deduct (₹)',
                    'Net Take Home (₹)',
                    'Paid Amount (₹)',
                    'Balance Due (₹)',
                    'Payment Status',
                    'Pay Date',
                    'Payment Mode',
                    'Reference No',
                ]
                const headerRow = worksheet.addRow(headers)
                headerRow.eachCell((cell) => {
                    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } }
                    cell.alignment = { vertical: 'middle', horizontal: 'center' }
                })

                const recordsToExport = targetProfileId 
                    ? (salaryBookData?.records || []).filter(r => r.profileId === targetProfileId)
                    : filteredRecords

                let totalGross = 0
                let totalAbsence = 0
                let totalAdvance = 0
                let totalTakeHome = 0
                let totalPaid = 0
                let totalDue = 0

                recordsToExport.forEach(r => {
                    totalGross += Number(r.grossSalary) || 0
                    totalAbsence += Number(r.absenceDeduction) || 0
                    totalAdvance += Number(r.advanceRecovery) || 0
                    totalTakeHome += Number(r.takeHome) || 0
                    totalPaid += Number(r.paidAmount) || 0
                    totalDue += Number(r.balanceDue) || 0

                    worksheet.addRow([
                        r.monthName,
                        r.totalWorkingDays,
                        r.totalPresentDays,
                        r.totalHalfDays,
                        r.totalAbsentDays,
                        r.totalLeaves,
                        r.totalExtraHours,
                        r.grossSalary,
                        r.absenceDeduction,
                        r.advanceRecovery,
                        r.takeHome,
                        r.paidAmount,
                        r.balanceDue,
                        r.paymentStatus.toUpperCase(),
                        r.payDate || '--',
                        r.paidMode || '--',
                        r.payReferenceNo || '--',
                    ])
                })

                // Grand Total Row
                const totalRow = worksheet.addRow([
                    'GRAND TOTAL',
                    '', '', '', '', '', '',
                    parseFloat(totalGross.toFixed(2)),
                    parseFloat(totalAbsence.toFixed(2)),
                    parseFloat(totalAdvance.toFixed(2)),
                    parseFloat(totalTakeHome.toFixed(2)),
                    parseFloat(totalPaid.toFixed(2)),
                    parseFloat(totalDue.toFixed(2)),
                    '', '', '', ''
                ])
                totalRow.eachCell((cell) => {
                    cell.font = { bold: true, color: { argb: 'FF0F172A' } }
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } }
                })
            } else {
                // All Employees Ledger Sheet
                worksheet.addRow(['EMPLOYEE MASTER SALARY PASSBOOK LEDGER'])
                worksheet.addRow([`Export Date:`, new Date().toLocaleDateString('en-GB'), `Total Staff:`, filteredEmployeeLedger.length])
                worksheet.addRow([])

                const headers = [
                    '#',
                    'Employee Name',
                    'Email',
                    'Mobile No',
                    'Designation',
                    'Department',
                    'Total Payslips',
                    'Total Gross (₹)',
                    'Total Deductions (₹)',
                    'Total Net Take-Home (₹)',
                    'Total Paid (₹)',
                    'Balance Due (₹)',
                    'Latest Month'
                ]
                const headerRow = worksheet.addRow(headers)
                headerRow.eachCell((cell) => {
                    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } }
                    cell.alignment = { vertical: 'middle', horizontal: 'center' }
                })

                filteredEmployeeLedger.forEach((emp, idx) => {
                    worksheet.addRow([
                        idx + 1,
                        emp.profile.fullName,
                        emp.profile.email,
                        emp.profile.mobileNo || '--',
                        emp.profile.designationName || '--',
                        emp.profile.departmentName || '--',
                        emp.payslipCount,
                        emp.totalGross,
                        emp.totalDeductions,
                        emp.totalTakeHome,
                        emp.totalPaid,
                        emp.totalBalanceDue,
                        emp.latestMonthYear || '--'
                    ])
                })

                const totalRow = worksheet.addRow([
                    'GRAND TOTAL',
                    '', '', '', '', '',
                    grandTotals.totalPayslips,
                    grandTotals.totalGross,
                    grandTotals.totalAbsenceDeductions + grandTotals.totalAdvanceRecovery,
                    grandTotals.totalTakeHome,
                    grandTotals.totalPaid,
                    grandTotals.totalBalanceDue,
                    ''
                ])
                totalRow.eachCell((cell) => {
                    cell.font = { bold: true, color: { argb: 'FF0F172A' } }
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } }
                })
            }

            worksheet.columns.forEach(col => {
                col.width = 16
            })

            const buffer = await workbook.xlsx.writeBuffer()
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
            const url = window.URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            const fileName = activeProfileId 
                ? `Salary_Passbook_${cleanEmpName}.xlsx`
                : `Master_Salary_Book_${selectedYear || new Date().getFullYear()}.xlsx`
            a.download = fileName
            a.click()
            window.URL.revokeObjectURL(url)
            toast.dismiss()
            toast.success(`Passbook exported: ${fileName}`)
        } catch (err: any) {
            toast.dismiss()
            toast.error(err.message || "Failed to export passbook")
        }
    }

    return (
        <div className="space-y-6 print:space-y-4 print:p-0">
            {/* Control & Filter Header */}
            <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-card p-4 sm:p-5 shadow-xs print:hidden space-y-3.5">
                {/* Heading Row */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        {selectedProfileId ? (
                            <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={() => setSelectedProfileId(null)}
                                className="h-8 gap-1.5 rounded-xl font-semibold text-xs"
                            >
                                <ArrowLeft className="h-3.5 w-3.5" />
                                All Staff Ledger
                            </Button>
                        ) : null}

                        <div className="flex items-center gap-2">
                            <BookOpen className="h-5 w-5 text-primary" />
                            <h2 className="text-base font-bold tracking-tight text-foreground">
                                {selectedProfileId ? "Employee Salary Passbook" : "Salary Book — Master Ledger"}
                            </h2>
                        </div>
                    </div>
                </div>

                {/* Filter & Action Buttons Row (Unified Single Row) */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1 border-t border-slate-100 dark:border-zinc-800/60">
                    {/* Left: Employee Selector, Year Selector, Status Filter */}
                    <div className="flex flex-wrap items-center gap-2.5">
                        {/* Employee Picker Dropdown */}
                        <div className="w-[240px] sm:w-[260px]">
                            <Select 
                                value={selectedProfileId || "all"} 
                                onValueChange={(val) => setSelectedProfileId(val === "all" ? null : val)}
                            >
                                <SelectTrigger className="h-9 rounded-xl text-xs font-semibold bg-background">
                                    <SelectValue placeholder="Select Employee..." />
                                </SelectTrigger>
                                <SelectContent className="max-h-[300px]">
                                    <SelectItem value="all" className="font-bold text-xs">
                                        All Employees (Master Ledger)
                                    </SelectItem>
                                    {employees.map(emp => (
                                        <SelectItem key={emp.id} value={emp.id} className="text-xs">
                                            {emp.full_name || emp.email} {emp.designation_name ? `(${emp.designation_name})` : ''}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Year Selector */}
                        <Select 
                            value={selectedYear ? String(selectedYear) : "all"} 
                            onValueChange={(val) => setSelectedYear(val === "all" ? null : Number(val))}
                        >
                            <SelectTrigger className="h-9 w-[110px] rounded-xl text-xs font-semibold bg-background">
                                <SelectValue placeholder="Year" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all" className="text-xs">All Years</SelectItem>
                                {(salaryBookData?.availableYears || [2026, 2025, 2024]).map(y => (
                                    <SelectItem key={y} value={String(y)} className="text-xs">{y}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        {/* Status Filter */}
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="h-9 w-[120px] rounded-xl text-xs font-semibold bg-background">
                                <SelectValue placeholder="Status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all" className="text-xs">All Statuses</SelectItem>
                                <SelectItem value="paid" className="text-xs text-emerald-600 font-semibold">Paid</SelectItem>
                                <SelectItem value="partially_paid" className="text-xs text-amber-600 font-semibold">Partially Paid</SelectItem>
                                <SelectItem value="unpaid" className="text-xs text-rose-600 font-semibold">Unpaid / Due</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Right: Action Buttons (Excel, Print, Refresh) */}
                    <div className="flex items-center gap-2 justify-end">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleExportExcel()}
                            className="h-9 gap-1.5 rounded-xl text-xs font-semibold border-slate-200 dark:border-zinc-800 bg-background"
                        >
                            <Download className="h-3.5 w-3.5 text-emerald-600" />
                            Excel
                        </Button>

                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handlePrint}
                            className="h-9 gap-1.5 rounded-xl text-xs font-semibold border-slate-200 dark:border-zinc-800 bg-background"
                        >
                            <Printer className="h-3.5 w-3.5 text-blue-600" />
                            Print
                        </Button>

                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => refetch()}
                            className="h-9 w-9 p-0 rounded-xl border-slate-200 dark:border-zinc-800 bg-background"
                            title="Refresh"
                        >
                            <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
                        </Button>
                    </div>
                </div>
            </div>

            {/* Print Header (Visible only when printing) */}
            <div className="hidden print:block mb-4 border-b pb-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-xl font-bold">PayFix Employee Salary Passbook</h1>
                        <p className="text-xs text-muted-foreground">Certified Salary & Payment Statement</p>
                    </div>
                    <div className="text-right text-xs">
                        <p>Date: {new Date().toLocaleDateString('en-GB')}</p>
                        {selectedEmployee && <p>Staff: {selectedEmployee.fullName || (selectedEmployee as any).full_name}</p>}
                    </div>
                </div>
            </div>

            {/* Individual Employee Profile Card (When an employee is selected) */}
            {selectedProfileId && selectedEmployee && (
                <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 p-4 sm:p-5 border-l-4 border-l-primary bg-card shadow-xs">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <Avatar className="h-12 w-12 border-2 border-primary/20">
                                <AvatarImage src={(selectedEmployee as any).avatarUrl || (selectedEmployee as any).avatar_url} />
                                <AvatarFallback className="font-bold bg-primary/10 text-primary">
                                    {(selectedEmployee.fullName || (selectedEmployee as any).full_name || 'U').charAt(0)}
                                </AvatarFallback>
                            </Avatar>
                            <div>
                                <h3 className="font-bold text-base text-foreground leading-tight">
                                    {selectedEmployee.fullName || (selectedEmployee as any).full_name}
                                </h3>
                                <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-muted-foreground">
                                    <span className="flex items-center gap-1 font-medium text-foreground/80">
                                        <Briefcase className="h-3 w-3" />
                                        {(selectedEmployee as any).designationName || (selectedEmployee as any).designation_name || 'Staff'}
                                    </span>
                                    <span>•</span>
                                    <span>{(selectedEmployee as any).departmentName || 'General'}</span>
                                    <span>•</span>
                                    <span>{selectedEmployee.mobileNo || (selectedEmployee as any).mobile_no || selectedEmployee.email}</span>
                                </div>
                            </div>
                        </div>

                        {/* Employee Quick Stats */}
                        <div className="flex flex-wrap items-center gap-2 sm:gap-4 w-full sm:w-auto">
                            <div className="bg-slate-50 dark:bg-zinc-900/60 p-2.5 rounded-xl border border-slate-100 dark:border-zinc-800 text-center min-w-[90px]">
                                <span className="text-[10px] text-muted-foreground uppercase font-semibold block">Total Months</span>
                                <span className="text-sm font-bold text-foreground">{filteredRecords.length}</span>
                            </div>
                            <div className="bg-emerald-50/70 dark:bg-emerald-950/20 p-2.5 rounded-xl border border-emerald-100 dark:border-emerald-900/30 text-center min-w-[110px]">
                                <span className="text-[10px] text-emerald-700 dark:text-emerald-400 uppercase font-semibold block">Total Paid</span>
                                <span className="text-sm font-bold text-emerald-700 dark:text-emerald-400">
                                    {formatCurrency(grandTotals.totalPaid)}
                                </span>
                            </div>
                            <div className="bg-rose-50/70 dark:bg-rose-950/20 p-2.5 rounded-xl border border-rose-100 dark:border-rose-900/30 text-center min-w-[110px]">
                                <span className="text-[10px] text-rose-700 dark:text-rose-400 uppercase font-semibold block">Balance Due</span>
                                <span className="text-sm font-bold text-rose-700 dark:text-rose-400">
                                    {formatCurrency(grandTotals.totalBalanceDue)}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Passbook / Ledger Content Table */}
            <div className="rounded-2xl p-0 overflow-hidden border border-slate-200 dark:border-zinc-800 bg-card shadow-xs">
                {isLoading ? (
                    <div className="p-12 text-center text-muted-foreground flex flex-col items-center justify-center gap-2">
                        <RefreshCw className="h-6 w-6 animate-spin text-primary" />
                        <p className="text-sm font-medium">Loading passbook entries...</p>
                    </div>
                ) : selectedProfileId ? (
                    /* VIEW 1: Individual Employee Monthly Passbook */
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                            <thead>
                                <tr className="bg-slate-50 dark:bg-zinc-900/80 border-b border-slate-200 dark:border-zinc-800 text-muted-foreground font-semibold">
                                    <th className="py-3 px-3.5">Month & Year</th>
                                    <th className="py-3 px-3 text-center">Working Days</th>
                                    <th className="py-3 px-3 text-center">P / H / A</th>
                                    <th className="py-3 px-3 text-right">Gross (₹)</th>
                                    <th className="py-3 px-3 text-right">Deductions (₹)</th>
                                    <th className="py-3 px-3 text-right font-bold text-foreground">Take Home (₹)</th>
                                    <th className="py-3 px-3 text-right text-emerald-600 font-bold">Paid (₹)</th>
                                    <th className="py-3 px-3 text-right text-rose-600 font-bold">Due (₹)</th>
                                    <th className="py-3 px-3 text-center">Payment Status</th>
                                    <th className="py-3 px-3.5">Payment Details</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60 font-medium text-foreground">
                                {filteredRecords.length === 0 ? (
                                    <tr>
                                        <td colSpan={10} className="py-12 text-center text-muted-foreground">
                                            No payslip records found for this employee.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredRecords.map((r) => {
                                        const totalDeductions = r.absenceDeduction + r.advanceRecovery
                                        return (
                                            <tr key={r.id} className="hover:bg-slate-50/70 dark:hover:bg-zinc-900/40 transition-colors">
                                                <td className="py-3 px-3.5 font-bold whitespace-nowrap text-foreground">
                                                    {r.monthName}
                                                </td>
                                                <td className="py-3 px-3 text-center tabular-nums text-muted-foreground">
                                                    {r.totalWorkingDays}d
                                                </td>
                                                <td className="py-3 px-3 text-center tabular-nums whitespace-nowrap">
                                                    <span className="text-emerald-600 font-semibold">{r.totalPresentDays}P</span>
                                                    {r.totalHalfDays > 0 && <span className="text-amber-600 ml-1">/{r.totalHalfDays}H</span>}
                                                    {r.totalAbsentDays > 0 && <span className="text-rose-600 ml-1">/{r.totalAbsentDays}A</span>}
                                                    {r.totalLeaves > 0 && <span className="text-blue-600 ml-1">/{r.totalLeaves}L</span>}
                                                </td>
                                                <td className="py-3 px-3 text-right tabular-nums whitespace-nowrap">
                                                    {formatCurrency(r.grossSalary)}
                                                </td>
                                                <td className="py-3 px-3 text-right tabular-nums whitespace-nowrap text-rose-600 font-medium">
                                                    {totalDeductions > 0 ? `-${formatCurrency(totalDeductions)}` : '₹0'}
                                                </td>
                                                <td className="py-3 px-3 text-right tabular-nums font-bold text-foreground whitespace-nowrap bg-primary/5 dark:bg-primary/10">
                                                    {formatCurrency(r.takeHome)}
                                                </td>
                                                <td className="py-3 px-3 text-right tabular-nums font-bold text-emerald-600 whitespace-nowrap">
                                                    {formatCurrency(r.paidAmount)}
                                                </td>
                                                <td className="py-3 px-3 text-right tabular-nums font-bold text-rose-600 whitespace-nowrap">
                                                    {r.balanceDue > 0 ? formatCurrency(r.balanceDue) : <span className="text-muted-foreground/40 font-normal">--</span>}
                                                </td>
                                                <td className="py-3 px-3 text-center whitespace-nowrap">
                                                    <Badge 
                                                        variant="outline" 
                                                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                                            r.paymentStatus === 'paid' 
                                                                ? 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800' 
                                                                : r.paymentStatus === 'partially_paid'
                                                                ? 'bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800'
                                                                : 'bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800'
                                                        }`}
                                                    >
                                                        {r.paymentStatus === 'paid' ? 'PAID' : r.paymentStatus === 'partially_paid' ? 'PARTIAL' : 'DUE'}
                                                    </Badge>
                                                </td>
                                                <td className="py-3 px-3.5 text-xs text-muted-foreground whitespace-nowrap">
                                                    {r.payDate ? (
                                                        <div className="flex flex-col gap-0.5">
                                                            <span className="font-semibold text-foreground text-[11px]">
                                                                {r.paidMode?.toUpperCase() || 'PAID'} • {r.payDate}
                                                            </span>
                                                            {r.payReferenceNo && (
                                                                <span className="text-[10px] text-muted-foreground/80 font-mono">
                                                                    Ref: {r.payReferenceNo}
                                                                </span>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <span className="text-muted-foreground/30 text-[11px]">Not disbursed</span>
                                                    )}
                                                </td>
                                            </tr>
                                        )
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    /* VIEW 2: Master All Employees Passbook Ledger */
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                            <thead>
                                <tr className="bg-slate-50 dark:bg-zinc-900/80 border-b border-slate-200 dark:border-zinc-800 text-muted-foreground font-semibold">
                                    <th className="py-3 px-3 text-center w-10">#</th>
                                    <th className="py-3 px-3.5">Employee</th>
                                    <th className="py-3 px-3">Designation & Dept</th>
                                    <th className="py-3 px-3 text-center">Payslips</th>
                                    <th className="py-3 px-3 text-right">Total Gross (₹)</th>
                                    <th className="py-3 px-3 text-right">Deductions (₹)</th>
                                    <th className="py-3 px-3 text-right font-bold text-foreground">Total Net (₹)</th>
                                    <th className="py-3 px-3 text-right text-emerald-600 font-bold">Total Paid (₹)</th>
                                    <th className="py-3 px-3 text-right text-rose-600 font-bold">Balance Due (₹)</th>
                                    <th className="py-3 px-3.5 text-center">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60 font-medium text-foreground">
                                {filteredEmployeeLedger.length === 0 ? (
                                    <tr>
                                        <td colSpan={10} className="py-12 text-center text-muted-foreground">
                                            No employee passbook records found matching your filters.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredEmployeeLedger.map((emp, idx) => (
                                        <tr key={emp.profile.id} className="hover:bg-slate-50/70 dark:hover:bg-zinc-900/40 transition-colors">
                                            <td className="py-3 px-3 text-center text-muted-foreground/60 tabular-nums">
                                                {idx + 1}
                                            </td>
                                            <td className="py-3 px-3.5">
                                                <div className="flex items-center gap-2.5">
                                                    <Avatar className="h-8 w-8 border border-slate-200 dark:border-zinc-800">
                                                        <AvatarImage src={emp.profile.avatarUrl} />
                                                        <AvatarFallback className="text-[11px] font-bold bg-primary/10 text-primary">
                                                            {emp.profile.fullName?.charAt(0) || 'U'}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <div>
                                                        <button 
                                                            onClick={() => setSelectedProfileId(emp.profile.id)}
                                                            className="font-bold text-foreground hover:text-primary transition-colors text-left"
                                                        >
                                                            {emp.profile.fullName}
                                                        </button>
                                                        <p className="text-[10.5px] text-muted-foreground">{emp.profile.mobileNo || emp.profile.email}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="py-3 px-3">
                                                <div className="flex flex-col gap-0.5">
                                                    <span className="font-semibold text-foreground text-xs">{emp.profile.designationName || 'Staff'}</span>
                                                    <span className="text-[10px] text-muted-foreground">{emp.profile.departmentName || 'General'}</span>
                                                </div>
                                            </td>
                                            <td className="py-3 px-3 text-center tabular-nums font-bold">
                                                <Badge variant="secondary" className="text-[10.5px] font-bold px-2 py-0.5 rounded-full">
                                                    {emp.payslipCount}
                                                </Badge>
                                            </td>
                                            <td className="py-3 px-3 text-right tabular-nums whitespace-nowrap">
                                                {formatCurrency(emp.totalGross)}
                                            </td>
                                            <td className="py-3 px-3 text-right tabular-nums whitespace-nowrap text-rose-600">
                                                {emp.totalDeductions > 0 ? `-${formatCurrency(emp.totalDeductions)}` : '₹0'}
                                            </td>
                                            <td className="py-3 px-3 text-right tabular-nums font-bold text-foreground whitespace-nowrap bg-primary/5 dark:bg-primary/10">
                                                {formatCurrency(emp.totalTakeHome)}
                                            </td>
                                            <td className="py-3 px-3 text-right tabular-nums font-bold text-emerald-600 whitespace-nowrap">
                                                {formatCurrency(emp.totalPaid)}
                                            </td>
                                            <td className="py-3 px-3 text-right tabular-nums font-bold text-rose-600 whitespace-nowrap">
                                                {emp.totalBalanceDue > 0 ? formatCurrency(emp.totalBalanceDue) : <span className="text-muted-foreground/40 font-normal">--</span>}
                                            </td>
                                            <td className="py-3 px-3.5 text-center">
                                                <div className="flex items-center justify-center gap-1.5">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => setSelectedProfileId(emp.profile.id)}
                                                        className="h-7 px-2.5 text-xs text-primary hover:text-primary hover:bg-primary/10 font-bold rounded-lg gap-1"
                                                    >
                                                        <BookOpen className="h-3 w-3" />
                                                        Passbook
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => handleExportExcel(emp.profile.id)}
                                                        className="h-7 w-7 p-0 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-lg"
                                                        title={`Download ${emp.profile.fullName} Passbook (.xlsx)`}
                                                    >
                                                        <Download className="h-3.5 w-3.5" />
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Grand Total Footer Bar */}
                <div className="bg-slate-100 dark:bg-zinc-900 border-t border-slate-200 dark:border-zinc-800 p-4">
                    <div className="flex flex-col lg:flex-row items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                            <Wallet className="h-5 w-5 text-primary" />
                            <div>
                                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
                                    Grand Total Summary
                                </span>
                                <span className="text-xs text-muted-foreground">
                                    Cumulative totals across {grandTotals.totalPayslips} generated payslip records
                                </span>
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-3 sm:gap-6 justify-end w-full lg:w-auto">
                            <div className="text-right">
                                <span className="text-[10px] text-muted-foreground block font-semibold uppercase">Total Gross</span>
                                <span className="text-xs font-bold text-foreground tabular-nums">
                                    {formatCurrency(grandTotals.totalGross)}
                                </span>
                            </div>

                            <div className="text-right">
                                <span className="text-[10px] text-muted-foreground block font-semibold uppercase">Total Deductions</span>
                                <span className="text-xs font-bold text-rose-600 tabular-nums">
                                    {formatCurrency(grandTotals.totalAbsenceDeductions + grandTotals.totalAdvanceRecovery)}
                                </span>
                            </div>

                            <div className="text-right bg-primary/10 dark:bg-primary/20 px-3 py-1.5 rounded-xl border border-primary/20">
                                <span className="text-[10px] text-primary block font-semibold uppercase">Total Net Payable</span>
                                <span className="text-sm font-bold text-primary tabular-nums">
                                    {formatCurrency(grandTotals.totalTakeHome)}
                                </span>
                            </div>

                            <div className="text-right bg-emerald-50 dark:bg-emerald-950/30 px-3 py-1.5 rounded-xl border border-emerald-200 dark:border-emerald-800/40">
                                <span className="text-[10px] text-emerald-700 dark:text-emerald-400 block font-semibold uppercase">Total Paid</span>
                                <span className="text-sm font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
                                    {formatCurrency(grandTotals.totalPaid)}
                                </span>
                            </div>

                            <div className="text-right bg-rose-50 dark:bg-rose-950/30 px-3 py-1.5 rounded-xl border border-rose-200 dark:border-rose-800/40">
                                <span className="text-[10px] text-rose-700 dark:text-rose-400 block font-semibold uppercase">Balance Due</span>
                                <span className="text-sm font-bold text-rose-700 dark:text-rose-400 tabular-nums">
                                    {formatCurrency(grandTotals.totalBalanceDue)}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
