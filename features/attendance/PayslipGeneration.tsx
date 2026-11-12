"use client"

import React, { useState, useMemo, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { trpc } from "@/lib/trpc/client"
import { toast } from "sonner"
import { Receipt, Loader2, Printer, Eye, AlertTriangle, TrendingUp, TrendingDown, CreditCard, CheckCircle, Save, Calendar as CalendarIcon, FileSpreadsheet, Lock, Unlock, ShieldCheck, ShieldAlert, Banknote, Gift } from "lucide-react"
import { MonthlyBonusDialog } from "./MonthlyBonusDialog"
import { CardShell } from "./CardShell"
import { MetricCard } from "@/components/dashboard/metric-card"
import { Switch } from "@/components/ui/switch"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog"

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { AsyncButton } from "@/components/ui/async-button"

const MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
]

export interface PayslipGenerationProps {
    basePath: string
    controlledMonth?: number
    controlledYear?: number
    onMonthChange?: (m: number) => void
    onYearChange?: (y: number) => void
    onBackToAttendance?: () => void
    isUnified?: boolean
}

export function PayslipGeneration({
    basePath,
    controlledMonth,
    controlledYear,
    onMonthChange,
    onYearChange,
    onBackToAttendance,
    isUnified = false,
}: PayslipGenerationProps) {
    // Default to last completed month
    const currentDate = new Date()
    let defaultMonth = currentDate.getMonth()
    let defaultYear = currentDate.getFullYear()
    if (defaultMonth === 0) {
        defaultMonth = 12
        defaultYear -= 1
    }

    const [month, setMonth] = useState(defaultMonth)
    const [year, setYear] = useState(defaultYear)
    const [selectedIds, setSelectedIds] = useState<string[]>([])
    const [viewPayslipId, setViewPayslipId] = useState<string | null>(null)
    const payslipRef = useRef<HTMLDivElement>(null)

    const utils = trpc.useUtils()
    const [markPaidId, setMarkPaidId] = useState<string | null>(null)
    const [isCalendarOpen, setIsCalendarOpen] = useState(false)
    const [isBonusModalOpen, setIsBonusModalOpen] = useState(false)
    const [paidMode, setPaidMode] = useState<string>("bank_transfer")
    const [payDate, setPayDate] = useState<string>(new Date().toISOString().split('T')[0])
    const [payReferenceNo, setPayReferenceNo] = useState<string>("")
    const [paymentRemarks, setPaymentRemarks] = useState<string>("")
    const [paidAmount, setPaidAmount] = useState<string>("")

    const markPaidMutation = trpc.salary.markSalaryPaid.useMutation({
        onSuccess: () => {
            toast.success("Salary marked as paid successfully")
            setTimeout(() => {
                setMarkPaidId(null)
                setPayReferenceNo("")
                setPaymentRemarks("")
            }, 1500)
            refetch()
            utils.salary.getPayslipDetail.invalidate({ summaryId: viewPayslipId || "" })
            utils.salary.getMyPayslips.invalidate()
            utils.salary.getMyPayslipDetail.invalidate()
        },
        onError: (err) => {
            toast.error(err.message || "Failed to mark salary as paid")
        }
    })

    const handleOpenMarkPaid = (id: string, currentDetails?: any) => {
        setMarkPaidId(id)
        const summary = currentDetails || summaries?.find((s: any) => s.id === id)
        if (summary) {
            const netSalary = Number(summary.take_home) || 0
            const paidSoFar = summary.payments?.reduce((s: number, p: any) => s + (Number(p.amount) || 0), 0) || 0
            const remaining = netSalary - paidSoFar
            setPaidAmount(String(remaining > 0 ? remaining : 0))
        } else {
            setPaidAmount("")
        }

        if (currentDetails) {
            setPaidMode(currentDetails.paid_mode || "bank_transfer")
            setPayDate(currentDetails.pay_date || new Date().toISOString().split('T')[0])
            setPayReferenceNo(currentDetails.pay_reference_no || "")
            setPaymentRemarks(currentDetails.payment_remarks || "")
        } else {
            setPaidMode("bank_transfer")
            setPayDate(new Date().toISOString().split('T')[0])
            setPayReferenceNo("")
            setPaymentRemarks("")
        }
    }

    const { data: summaries, isLoading, refetch } = trpc.salary.getMonthlySummaries.useQuery(
        { month, year },
        { placeholderData: (prev: any) => prev }
    )

    const { data: payslipDetail } = trpc.salary.getPayslipDetail.useQuery(
        { summaryId: viewPayslipId || "" },
        { enabled: !!viewPayslipId }
    )

    const generateMutation = trpc.salary.generatePayslips.useMutation({
        onSuccess: (data: any[]) => {
            const errorCount = data.filter(d => Boolean(d.error)).length
            const successCount = data.length - errorCount

            if (successCount > 0) {
                toast.success(`Payslips generated for ${successCount} employees`)
            }
            if (errorCount > 0) {
                toast.error(`Failed to generate for ${errorCount} employees (Missing salary setup)`)
            }

            setSelectedIds([])
            refetch()
        },
        onError: (err) => toast.error(err.message),
    })

    const [isExportingExcel, setIsExportingExcel] = useState(false)

    // Access control query & mutations
    const { data: accessSettings, refetch: refetchAccess } = trpc.salary.getPayslipAccessSettings.useQuery()

    const toggleGlobalMutation = trpc.salary.toggleGlobalPayslipAccess.useMutation({
        onSuccess: () => {
            refetchAccess()
        }
    })

    const toggleEmployeeMutation = trpc.salary.toggleEmployeePayslipAccess.useMutation({
        onSuccess: () => {
            refetch()
        }
    })

    const bulkToggleMutation = trpc.salary.bulkToggleEmployeePayslipAccess.useMutation({
        onSuccess: (data) => {
            toast.success(`Access updated for ${data.count} employees`)
            setSelectedIds([])
            refetch()
        },
        onError: (err) => toast.error(err.message)
    })

    const isGlobalEnabled = accessSettings ? accessSettings.globalEnabled !== false : true

    const handleToggleGlobalAccess = (enabled: boolean) => {
        toggleGlobalMutation.mutate(
            { enabled },
            {
                onSuccess: (data) => {
                    toast.success(data.globalEnabled ? "Payslip access enabled for all employees" : "Payslip access disabled workspace-wide")
                    refetchAccess()
                    refetch()
                },
                onError: (err) => toast.error(err.message || "Failed to update global payslip access")
            }
        )
    }

    const handleToggleEmployeeAccess = (profileId: string, currentEnabled: boolean) => {
        toggleEmployeeMutation.mutate(
            { profileId, enabled: !currentEnabled },
            {
                onSuccess: (data) => {
                    toast.success(data.enabled ? "Payslip access enabled for employee" : "Payslip access disabled for employee")
                    refetch()
                },
                onError: (err) => toast.error(err.message || "Failed to update employee access")
            }
        )
    }

    const handleBulkToggle = (enabled: boolean) => {
        if (selectedIds.length === 0) return
        const selectedProfileIds = displaySummaries
            .filter((s: any) => selectedIds.includes(s.id) && s.profile_id)
            .map((s: any) => s.profile_id)
        if (selectedProfileIds.length === 0) return
        bulkToggleMutation.mutate(
            { profileIds: selectedProfileIds, enabled },
            {
                onSuccess: (data) => {
                    toast.success(`Payslip access ${enabled ? 'enabled' : 'disabled'} for ${data.count} employees`)
                    setSelectedIds([])
                    refetch()
                },
                onError: (err) => toast.error(err.message)
            }
        )
    }

    const displaySummaries = useMemo(() =>
        summaries?.filter((s: any) => s.status === 'set_for_salary' || s.status === 'payslip_generated') || [], [summaries]
    )

    const payrollStats = useMemo(() => {
        if (!displaySummaries || displaySummaries.length === 0) {
            return {
                totalNetSalary: 0,
                totalGrossSalary: 0,
                totalDeductions: 0,
                totalAdvanceRecovered: 0,
                generatedCount: 0,
                readyCount: 0,
                totalPaidAmount: 0,
                unpaidCount: 0,
            }
        }

        let net = 0
        let gross = 0
        let deductions = 0
        let advances = 0
        let generated = 0
        let ready = 0
        let paidAmt = 0
        let unpaid = 0

        displaySummaries.forEach((s: any) => {
            const bd = s.salary_breakdown as Record<string, any> | null
            const isGen = s.status === 'payslip_generated'

            if (isGen) {
                generated++
                net += Number(s.take_home) || 0
                gross += Number(s.gross_salary) || 0
                deductions += (Number(s.absence_deduction) || 0) + (Number(bd?.other_deductions) || 0) + (Number(s.advance_recovery) || 0)
                advances += Number(s.advance_recovery) || 0

                const paidSoFar = s.payments?.reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0) || 0
                paidAmt += paidSoFar
                if (paidSoFar < (Number(s.take_home) || 0)) {
                    unpaid++
                }
            } else {
                ready++
            }
        })

        return {
            totalNetSalary: net,
            totalGrossSalary: gross,
            totalDeductions: deductions,
            totalAdvanceRecovered: advances,
            generatedCount: generated,
            readyCount: ready,
            totalPaidAmount: paidAmt,
            unpaidCount: unpaid,
        }
    }, [displaySummaries])

    const selectedSummary = useMemo(() =>
        summaries?.find((s: any) => s.id === markPaidId), [summaries, markPaidId]
    )

    useEffect(() => {
        if (selectedSummary) {
            const netSalary = Number(selectedSummary.take_home) || 0
            const paidSoFar = selectedSummary.payments?.reduce((s: number, p: any) => s + (Number(p.amount) || 0), 0) || 0
            const remaining = netSalary - paidSoFar
            setPaidAmount(String(remaining > 0 ? remaining : 0))
        }
    }, [selectedSummary])

    const selectableSummaries = useMemo(() =>
        displaySummaries.filter((s: any) => s.status === 'set_for_salary' && s.has_salary_setup),
        [displaySummaries]
    )

    const toggleSelect = (id: string, s: any) => {
        if (!s.has_salary_setup) {
            toast.error("Cannot select employee without an active salary setup.")
            return
        }
        if (s.status === 'payslip_generated') {
            return
        }
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        )
    }

    const toggleSelectAll = () => {
        if (selectedIds.length === selectableSummaries.length) {
            setSelectedIds([])
        } else {
            setSelectedIds(selectableSummaries.map((s: any) => s.id))
        }
    }

    const formatCurrency = (val: string | number | null | undefined) => {
        const num = Number(val) || 0
        return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(num)
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

    const handlePrint = () => {
        if (payslipRef.current) {
            const printWindow = window.open('', '_blank')
            if (printWindow) {
                printWindow.document.write(`
                    <html>
                    <head><title>Salary Slip - ${payslipDetail?.profile?.full_name || 'Employee'} - ${MONTHS[month - 1]} ${year}</title>
                    <style>
                        @page { size: A4; margin: 20mm 18mm; }
                        * { box-sizing: border-box; margin: 0; padding: 0; }
                        body { font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; color: #1a1a1a; background: #fff; }
                        .slip-page { max-width: 760px; margin: 0 auto; padding: 0; }
                        .slip-header { text-align: center; padding-bottom: 16px; margin-bottom: 20px; border-bottom: 3px double #1a1a1a; }
                        .slip-header h1 { font-size: 22px; font-weight: 700; letter-spacing: 3px; text-transform: uppercase; margin-bottom: 4px; }
                        .slip-header .period { font-size: 14px; color: #555; font-weight: 500; }
                        .emp-details { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 40px; margin-bottom: 20px; padding: 14px 18px; border: 1px solid #ddd; border-radius: 4px; background: #fafafa; }
                        .emp-details .detail-item { display: flex; justify-content: space-between; font-size: 13px; padding: 3px 0; }
                        .emp-details .detail-label { color: #666; }
                        .emp-details .detail-value { font-weight: 600; text-align: right; }
                        .salary-table { width: 100%; border-collapse: collapse; margin-bottom: 0; }
                        .salary-table th { background: #f0f0f0; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; padding: 10px 14px; border: 1px solid #ccc; }
                        .salary-table td { padding: 7px 14px; border: 1px solid #ddd; font-size: 13px; vertical-align: top; }
                        .salary-table .amt { text-align: right; font-variant-numeric: tabular-nums; }
                        .salary-table .component { color: #333; }
                        .salary-table .deduction-text { color: #b91c1c; }
                        .salary-table .total-row td { font-weight: 700; background: #f5f5f5; border-top: 2px solid #999; font-size: 13px; }
                        .salary-table .empty-cell { border-left: none; border-right: none; border-bottom: none; }
                        .net-pay-box { margin-top: 16px; padding: 14px 18px; border: 2px solid #1a1a1a; border-radius: 4px; display: flex; justify-content: space-between; align-items: center; }
                        .net-pay-box .label { font-size: 15px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; }
                        .net-pay-box .value { font-size: 18px; font-weight: 800; }
                        .slip-footer { margin-top: 40px; padding-top: 12px; border-top: 1px solid #ccc; display: flex; justify-content: space-between; font-size: 11px; color: #888; }
                        @media print {
                            body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
                        }
                    </style>
                    </head>
                    <body>${payslipRef.current.innerHTML}</body>
                    </html>
                `)
                printWindow.document.close()
                printWindow.print()
            }
        }
    }

    const handleExportExcel = async () => {
        if (!displaySummaries || displaySummaries.length === 0) {
            toast.error("No payroll records available to export")
            return
        }

        setIsExportingExcel(true)
        try {
            const ExcelJS = (await import('exceljs')).default
            const workbook = new ExcelJS.Workbook()
            const monthName = MONTHS[month - 1]
            const worksheet = workbook.addWorksheet(`${monthName} ${year} Payroll`, {
                pageSetup: {
                    orientation: 'landscape',
                    paperSize: 9, // A4
                    fitToPage: true,
                    fitToWidth: 1,
                    fitToHeight: 0,
                    margins: {
                        left: 0.3,
                        right: 0.3,
                        top: 0.4,
                        bottom: 0.4,
                        header: 0.2,
                        footer: 0.2
                    }
                }
            })

            // 1. Title Block
            worksheet.mergeCells('A1:U1')
            const titleCell = worksheet.getCell('A1')
            titleCell.value = 'PAYFIX WORKSPACE - MONTHLY SALARY REGISTER'
            titleCell.font = { name: 'Calibri', size: 15, bold: true, color: { argb: 'FFFFFFFF' } }
            titleCell.alignment = { horizontal: 'center', vertical: 'middle' }
            titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF635BFF' } }
            worksheet.getRow(1).height = 28

            worksheet.mergeCells('A2:U2')
            const subTitleCell = worksheet.getCell('A2')
            subTitleCell.value = `Salary & Attendance Statement for the period of ${monthName} ${year} (Landscape A4)`
            subTitleCell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF334155' } }
            subTitleCell.alignment = { horizontal: 'center', vertical: 'middle' }
            subTitleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } }
            worksheet.getRow(2).height = 20

            worksheet.mergeCells('A3:U3')
            const dateCell = worksheet.getCell('A3')
            dateCell.value = `Generated on: ${format(new Date(), 'dd MMMM yyyy, HH:mm:ss')} | Total Records: ${displaySummaries.length}`
            dateCell.font = { name: 'Calibri', size: 9, italic: true, color: { argb: 'FF64748B' } }
            dateCell.alignment = { horizontal: 'center', vertical: 'middle' }
            worksheet.getRow(3).height = 16

            worksheet.getRow(4).height = 8

            // 2. Table Column Headers
            const columns = [
                { header: 'S.No', key: 'sno', width: 6 },
                { header: 'Employee Name', key: 'name', width: 22 },
                { header: 'Email ID', key: 'email', width: 24 },
                { header: 'Designation', key: 'designation', width: 16 },
                { header: 'Department', key: 'department', width: 16 },
                { header: 'Month Days', key: 'month_days', width: 11 },
                { header: 'Present', key: 'present', width: 9 },
                { header: 'Absent', key: 'absent', width: 9 },
                { header: 'Half Days', key: 'half_days', width: 10 },
                { header: 'Paid Leaves', key: 'leaves', width: 11 },
                { header: 'Extra Days', key: 'extra_days', width: 10 },
                { header: 'Basic Salary', key: 'basic', width: 14 },
                { header: 'Gross Earnings', key: 'gross', width: 15 },
                { header: 'Absent Deduct.', key: 'absent_deduct', width: 14 },
                { header: 'Half Day Deduct.', key: 'half_deduct', width: 14 },
                { header: 'Advance Rec.', key: 'adv_rec', width: 13 },
                { header: 'Other Deduct.', key: 'other_deduct', width: 13 },
                { header: 'Total Deductions', key: 'total_deduct', width: 15 },
                { header: 'Net Salary', key: 'net_salary', width: 16 },
                { header: 'Status', key: 'status', width: 12 },
                { header: 'Paid Details', key: 'pay_details', width: 22 },
            ]

            worksheet.columns = columns

            const headerRow = worksheet.getRow(5)
            headerRow.values = columns.map(c => c.header)
            headerRow.height = 24
            headerRow.eachCell((cell) => {
                cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } }
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } }
                cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
                cell.border = {
                    top: { style: 'thin', color: { argb: 'FF94A3B8' } },
                    bottom: { style: 'medium', color: { argb: 'FF0F172A' } },
                    left: { style: 'thin', color: { argb: 'FF94A3B8' } },
                    right: { style: 'thin', color: { argb: 'FF94A3B8' } },
                }
            })

            // 3. Data Rows
            displaySummaries.forEach((s: any, idx: number) => {
                const bd = s.salary_breakdown as Record<string, any> | null
                const isGenerated = s.status === 'payslip_generated'

                const basicSalary = Number(bd?.basic_salary || s.monthly_salary || 0)
                const grossEarnings = Number(s.gross_salary || bd?.gross_salary || 0)
                const absentDeduction = Number(bd?.absent_deduction || s.absence_deduction || 0)
                const halfDayDeduction = Number(bd?.half_day_deduction || 0)
                const advanceRecovery = Number(s.advance_recovery || bd?.advance_recovery || 0)
                const otherDeductions = Number(bd?.other_deductions || 0)
                const totalDeductions = Number(s.absence_deduction || 0) + Number(bd?.other_deductions || 0) + Number(s.advance_recovery || 0)
                const netSalary = Number(s.take_home || bd?.take_home || s.net_salary || 0)

                const paidSoFar = s.payments?.reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0) || 0
                const paymentStatus = !isGenerated ? 'Draft' : paidSoFar === 0 ? 'Unpaid' : paidSoFar >= netSalary ? 'Paid' : `Partial (${paidSoFar})`
                const payDetails = s.paid_mode ? `${s.paid_mode.toUpperCase()} on ${s.pay_date || 'N/A'}${s.pay_reference_no ? ` (${s.pay_reference_no})` : ''}` : '—'

                const row = worksheet.addRow({
                    sno: idx + 1,
                    name: s.profile?.full_name || '—',
                    email: s.profile?.email || '—',
                    designation: s.profile?.designation?.name || '—',
                    department: s.profile?.department?.name || '—',
                    month_days: s.total_working_days || 0,
                    present: s.total_present_days || 0,
                    absent: s.total_absent_days || 0,
                    half_days: s.total_half_days || 0,
                    leaves: Number(s.total_leaves || 0),
                    extra_days: Number(bd?.extra_days || 0),
                    basic: basicSalary,
                    gross: grossEarnings,
                    absent_deduct: absentDeduction,
                    half_deduct: halfDayDeduction,
                    adv_rec: advanceRecovery,
                    other_deduct: otherDeductions,
                    total_deduct: totalDeductions,
                    net_salary: netSalary,
                    status: paymentStatus,
                    pay_details: payDetails,
                })

                row.height = 20
                const isEven = idx % 2 === 0
                row.eachCell((cell, colNumber) => {
                    cell.font = { name: 'Calibri', size: 9.5 }
                    if (isEven) {
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } }
                    }
                    cell.border = {
                        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                    }

                    if ([6, 7, 8, 9, 10, 11].includes(colNumber)) {
                        cell.alignment = { horizontal: 'center', vertical: 'middle' }
                    } else if ([12, 13, 14, 15, 16, 17, 18, 19].includes(colNumber)) {
                        cell.numFmt = '₹#,##0.00'
                        cell.alignment = { horizontal: 'right', vertical: 'middle' }
                    } else if (colNumber === 1 || colNumber === 20) {
                        cell.alignment = { horizontal: 'center', vertical: 'middle' }
                    } else {
                        cell.alignment = { horizontal: 'left', vertical: 'middle' }
                    }
                })
            })

            // 4. Summary Totals Row
            const totalGross = displaySummaries.reduce((sum: number, s: any) => sum + Number(s.gross_salary || 0), 0)
            const totalAbsDeduct = displaySummaries.reduce((sum: number, s: any) => sum + Number((s.salary_breakdown as any)?.absent_deduction || s.absence_deduction || 0), 0)
            const totalHalfDeduct = displaySummaries.reduce((sum: number, s: any) => sum + Number((s.salary_breakdown as any)?.half_day_deduction || 0), 0)
            const totalAdvRec = displaySummaries.reduce((sum: number, s: any) => sum + Number(s.advance_recovery || 0), 0)
            const totalOtherDeduct = displaySummaries.reduce((sum: number, s: any) => sum + Number((s.salary_breakdown as any)?.other_deductions || 0), 0)
            const totalAllDeduct = displaySummaries.reduce((sum: number, s: any) => sum + Number(s.absence_deduction || 0) + Number((s.salary_breakdown as any)?.other_deductions || 0) + Number(s.advance_recovery || 0), 0)
            const totalNet = displaySummaries.reduce((sum: number, s: any) => sum + Number(s.take_home || (s.salary_breakdown as any)?.take_home || s.net_salary || 0), 0)

            const totalRow = worksheet.addRow({
                sno: '',
                name: 'TOTALS (ALL EMPLOYEES)',
                email: '',
                designation: '',
                department: '',
                month_days: '',
                present: '',
                absent: '',
                half_days: '',
                leaves: '',
                extra_days: '',
                basic: '',
                gross: totalGross,
                absent_deduct: totalAbsDeduct,
                half_deduct: totalHalfDeduct,
                adv_rec: totalAdvRec,
                other_deduct: totalOtherDeduct,
                total_deduct: totalAllDeduct,
                net_salary: totalNet,
                status: '',
                pay_details: '',
            })

            totalRow.height = 24
            totalRow.eachCell((cell, colNumber) => {
                cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF0F172A' } }
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } }
                cell.border = {
                    top: { style: 'thin', color: { argb: 'FF64748B' } },
                    bottom: { style: 'double', color: { argb: 'FF0F172A' } },
                    left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                    right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                }
                if ([13, 14, 15, 16, 17, 18, 19].includes(colNumber)) {
                    cell.numFmt = '₹#,##0.00'
                    cell.alignment = { horizontal: 'right', vertical: 'middle' }
                }
            })

            // 5. Download buffer
            const buffer = await workbook.xlsx.writeBuffer()
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
            const url = URL.createObjectURL(blob)
            const anchor = document.createElement('a')
            anchor.href = url
            anchor.download = `PAYROLL-REGISTER-${monthName.toUpperCase()}-${year}.xlsx`
            anchor.click()
            URL.revokeObjectURL(url)
            toast.success(`Exported detailed payroll report for ${monthName} ${year}`)
        } catch (err: any) {
            console.error('Excel export error:', err)
            toast.error('Failed to export Excel payroll sheet')
        } finally {
            setIsExportingExcel(false)
        }
    }

    const breakdown = payslipDetail?.salary_breakdown as Record<string, any> | null

    const viewedSummary = summaries?.find((s: any) => s.id === viewPayslipId) || null
    const displayPaidMode = payslipDetail?.paid_mode ?? viewedSummary?.paid_mode
    const displayPayDate = payslipDetail?.pay_date ?? viewedSummary?.pay_date
    const displayPayReferenceNo = payslipDetail?.pay_reference_no ?? viewedSummary?.pay_reference_no
    const displayPaymentRemarks = payslipDetail?.payment_remarks ?? viewedSummary?.payment_remarks

    // Compute totals for the columnar layout
    const totalEarnings = breakdown ? (
        Number(breakdown.basic_salary || 0) +
        Number(breakdown.hra || 0) +
        Number(breakdown.da || 0) +
        Number(breakdown.ta || 0) +
        Number(breakdown.special_allowance || 0) +
        Number(breakdown.incentive || 0) +
        Number(breakdown.monthly_bonus || 0) +
        Number(breakdown.extra_day_payment || 0) +
        Number(breakdown.extra_shift_payment || 0)
    ) : 0

    const totalDeductions = breakdown ? (
        Number(breakdown.absence_deduction || 0) +
        Number(breakdown.other_deductions || 0) +
        Number(breakdown.total_advance_recovery !== undefined ? breakdown.total_advance_recovery : (breakdown.advance_recovery || 0))
    ) : 0

    const earningsItems = breakdown ? [
        { label: 'Basic Salary', amount: breakdown.basic_salary },
        { label: 'HRA', amount: breakdown.hra },
        { label: 'DA', amount: breakdown.da },
        { label: 'TA', amount: breakdown.ta },
        { label: 'Special Allowance', amount: breakdown.special_allowance },
        { label: 'Incentive', amount: breakdown.incentive },
        ...(Number(breakdown.monthly_bonus) > 0 ? [{ label: breakdown.bonus_title || 'Monthly Bonus / Incentive', amount: breakdown.monthly_bonus }] : []),
        ...(Number(breakdown.extra_day_payment) > 0 ? [{ label: 'Extra Days Payment', amount: breakdown.extra_day_payment }] : []),
        ...(Number(breakdown.extra_shift_payment) > 0 ? [{ label: `Extra Shift Pay (${breakdown.extra_shift_equivalent_days || 1} shifts)`, amount: breakdown.extra_shift_payment }] : []),
    ].filter(e => Number(e.amount) > 0) : []

    const deductionItems = breakdown ? [
        ...(breakdown.absent_deduction !== undefined
            ? [
                { 
                    label: `Absent Deduction${Number(breakdown.absent_deduction_multiplier) > 1 ? ` (${breakdown.absent_deduction_multiplier}x)` : ''}`, 
                    amount: breakdown.absent_deduction 
                },
                { label: 'Half Day Deduction', amount: breakdown.half_day_deduction },
              ]
            : [
                { label: 'Absence Deduction', amount: breakdown.absence_deduction }
              ]
        ),
        { label: 'Other Deductions (PF/ESI/etc.)', amount: breakdown.other_deductions },
        ...(breakdown.carry_forward_recovery !== undefined
            ? [
                ...(Number(breakdown.carry_forward_recovery) > 0 ? [{ label: 'Salary Deficit Carry-Forward', amount: breakdown.carry_forward_recovery }] : []),
                ...(Number(breakdown.advance_recovery) > 0 ? [{ label: 'Advance Recovery', amount: breakdown.advance_recovery }] : []),
              ]
            : [
                ...(Number(breakdown.advance_recovery) > 0 ? [{ label: 'Advance Recovery', amount: breakdown.advance_recovery }] : []),
              ]
        ),
    ].filter(e => Number(e.amount) > 0 || ['Absent Deduction', 'Half Day Deduction'].some(lbl => e.label.startsWith(lbl))) : []

    // Convert number to words for Net Pay
    const numberToWords = (num: number): string => {
        if (num === 0) return 'Zero'
        const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
            'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen']
        const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']
        const scales = ['', 'Thousand', 'Lakh', 'Crore']

        const absNum = Math.abs(Math.round(num))
        if (absNum === 0) return 'Zero'

        // Split into Indian grouping: last 3, then groups of 2
        const groups: number[] = []
        let remaining = absNum
        groups.push(remaining % 1000)
        remaining = Math.floor(remaining / 1000)
        while (remaining > 0) {
            groups.push(remaining % 100)
            remaining = Math.floor(remaining / 100)
        }

        const twoDigitToWords = (n: number): string => {
            if (n === 0) return ''
            if (n < 20) return ones[n]
            return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '')
        }

        const threeDigitToWords = (n: number): string => {
            if (n === 0) return ''
            const h = Math.floor(n / 100)
            const rest = n % 100
            let result = ''
            if (h > 0) result = ones[h] + ' Hundred'
            if (rest > 0) result += (h > 0 ? ' ' : '') + twoDigitToWords(rest)
            return result
        }

        const parts: string[] = []
        for (let i = groups.length - 1; i >= 0; i--) {
            if (groups[i] === 0) continue
            const words = i === 0 ? threeDigitToWords(groups[i]) : twoDigitToWords(groups[i])
            if (words) parts.push(words + (scales[i] ? ' ' + scales[i] : ''))
        }

        return (num < 0 ? 'Minus ' : '') + parts.join(' ') + ' Rupees Only'
    }

    const maxRows = Math.max(earningsItems.length, deductionItems.length)

    return (
        <TooltipProvider>
            <div className="space-y-6">
                {/* Controls & Action Buttons */}
                {!isUnified && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                        <Select value={String(month)} onValueChange={(val) => setMonth(Number(val))}>
                            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                {MONTHS.map((m, i) => (
                                    <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Select value={String(year)} onValueChange={(val) => setYear(Number(val))}>
                            <SelectTrigger className="w-[100px]"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map(y => (
                                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
                        <Button
                            variant="outline"
                            onClick={handleExportExcel}
                            disabled={isExportingExcel || displaySummaries.length === 0}
                            className="font-medium gap-1.5 border-emerald-500/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10 shadow-xs"
                        >
                            {isExportingExcel ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <FileSpreadsheet className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                            )}
                            Export Detailed Payroll (Excel)
                        </Button>

                        {!isUnified && (
                            <Button
                                variant="outline"
                                size="sm"
                                className="gap-1.5 rounded-lg border-amber-300 dark:border-amber-800/60 text-amber-800 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/30 font-semibold"
                                onClick={() => setIsBonusModalOpen(true)}
                            >
                                <Gift className="h-4 w-4 text-amber-500" />
                                Bonus / Incentives
                            </Button>
                        )}

                        {selectedIds.length > 0 && (
                            <Button
                                onClick={() => generateMutation.mutate({ ids: selectedIds })}
                                disabled={generateMutation.isPending}
                            >
                                {generateMutation.isPending
                                    ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" />Generating...</>
                                    : <><Receipt className="h-4 w-4 mr-1" />Generate Payslips ({selectedIds.length})</>
                                }
                            </Button>
                        )}
                    </div>
                </div>
                )}

                {/* Top Payroll Summary Metric Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <MetricCard
                        title="Total Net Payout"
                        value={formatCurrency(payrollStats.totalNetSalary)}
                        description={`${payrollStats.generatedCount} payslips · ${payrollStats.unpaidCount} pending payout`}
                        icon={<Banknote className="h-4 w-4" />}
                        iconBgColor="bg-emerald-500/10"
                        iconColor="text-emerald-600 dark:text-emerald-400"
                        cardBgColor="bg-[#FFFFFF] dark:bg-zinc-900"
                        borderColor="border-x-gray-200/80 border-b-gray-200/80 dark:border-x-zinc-800 dark:border-b-zinc-800"
                        topBorderColor="border-t-emerald-600 dark:border-t-emerald-400"
                        hoverBorderColor="hover:border-t-emerald-600 hover:border-x-emerald-500/30 hover:border-b-emerald-500/30 dark:hover:border-t-emerald-400 dark:hover:border-x-emerald-500/40 dark:hover:border-b-emerald-500/40"
                        hoverShadowColor="hover:shadow-[0_8px_30px_rgba(16,185,129,0.12)] dark:hover:shadow-[0_8px_30px_rgba(52,211,153,0.2)]"
                        loading={isLoading}
                        delay={0.05}
                    />
                    <MetricCard
                        title="Total Gross Earnings"
                        value={formatCurrency(payrollStats.totalGrossSalary)}
                        description="Base salary + all allowances"
                        icon={<TrendingUp className="h-4 w-4" />}
                        iconBgColor="bg-blue-500/10"
                        iconColor="text-blue-600 dark:text-blue-400"
                        cardBgColor="bg-[#FFFFFF] dark:bg-zinc-900"
                        borderColor="border-x-gray-200/80 border-b-gray-200/80 dark:border-x-zinc-800 dark:border-b-zinc-800"
                        topBorderColor="border-t-blue-600 dark:border-t-blue-400"
                        hoverBorderColor="hover:border-t-blue-600 hover:border-x-blue-500/30 hover:border-b-blue-500/30 dark:hover:border-t-blue-400 dark:hover:border-x-blue-500/40 dark:hover:border-b-blue-500/40"
                        hoverShadowColor="hover:shadow-[0_8px_30px_rgba(59,130,246,0.12)] dark:hover:shadow-[0_8px_30px_rgba(96,165,250,0.2)]"
                        loading={isLoading}
                        delay={0.1}
                    />
                    <MetricCard
                        title="Total Deductions"
                        value={formatCurrency(payrollStats.totalDeductions)}
                        description={`Adv. Recovered: ${formatCurrency(payrollStats.totalAdvanceRecovered)}`}
                        icon={<TrendingDown className="h-4 w-4" />}
                        iconBgColor="bg-rose-500/10"
                        iconColor="text-rose-600 dark:text-rose-400"
                        cardBgColor="bg-[#FFFFFF] dark:bg-zinc-900"
                        borderColor="border-x-gray-200/80 border-b-gray-200/80 dark:border-x-zinc-800 dark:border-b-zinc-800"
                        topBorderColor="border-t-rose-600 dark:border-t-rose-400"
                        hoverBorderColor="hover:border-t-rose-600 hover:border-x-rose-500/30 hover:border-b-rose-500/30 dark:hover:border-t-rose-400 dark:hover:border-x-rose-500/40 dark:hover:border-b-rose-500/40"
                        hoverShadowColor="hover:shadow-[0_8px_30px_rgba(244,63,94,0.12)] dark:hover:shadow-[0_8px_30px_rgba(251,113,133,0.2)]"
                        loading={isLoading}
                        delay={0.15}
                    />
                    <MetricCard
                        title="Payslip Progress"
                        value={`${payrollStats.generatedCount} / ${displaySummaries.length}`}
                        description={payrollStats.readyCount > 0 ? `${payrollStats.readyCount} pending generation` : "All payslips generated"}
                        icon={<CheckCircle className="h-4 w-4" />}
                        iconBgColor="bg-purple-500/10"
                        iconColor="text-purple-600 dark:text-purple-400"
                        cardBgColor="bg-[#FFFFFF] dark:bg-zinc-900"
                        borderColor="border-x-gray-200/80 border-b-gray-200/80 dark:border-x-zinc-800 dark:border-b-zinc-800"
                        topBorderColor="border-t-purple-600 dark:border-t-purple-400"
                        hoverBorderColor="hover:border-t-purple-600 hover:border-x-purple-500/30 hover:border-b-purple-500/30 dark:hover:border-t-purple-400 dark:hover:border-x-purple-500/40 dark:hover:border-b-purple-500/40"
                        hoverShadowColor="hover:shadow-[0_8px_30px_rgba(168,85,247,0.12)] dark:hover:shadow-[0_8px_30px_rgba(192,132,252,0.2)]"
                        loading={isLoading}
                        delay={0.2}
                    />
                </div>

                {/* Workspace Payslip Access Control Bar */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-2xl border border-border/70 bg-card/70 backdrop-blur-md shadow-xs">
                    <div className="flex items-center gap-3">
                        <div className={`p-2.5 rounded-xl ${isGlobalEnabled ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'bg-rose-500/15 text-rose-600 dark:text-rose-400'}`}>
                            {isGlobalEnabled ? <ShieldCheck className="h-5 w-5" /> : <ShieldAlert className="h-5 w-5" />}
                        </div>
                        <div className="space-y-1">
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-bold">Employee Self-Service (Payslips & Salary Book)</span>
                                <Badge variant="outline" className={isGlobalEnabled ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/25 text-[10px] font-semibold" : "bg-rose-500/10 text-rose-600 border-rose-500/25 text-[10px] font-semibold"}>
                                    {isGlobalEnabled ? "Workspace Active" : "Workspace Disabled"}
                                </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground leading-snug">
                                {isGlobalEnabled
                                    ? "Active: Employees can access their payslips & passbook on PWA and Web (subject to individual toggles below)."
                                    : "Master Block Active: No employee can view or download payslips or passbook on either mobile app or web."}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 self-end md:self-center">
                        {selectedIds.length > 0 && (
                            <div className="flex items-center gap-1.5 mr-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleBulkToggle(true)}
                                    disabled={bulkToggleMutation.isPending}
                                    className="text-xs h-8 text-emerald-600 border-emerald-500/20 hover:bg-emerald-500/10"
                                >
                                    <Unlock className="h-3 w-3 mr-1" />
                                    Enable ({selectedIds.length})
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleBulkToggle(false)}
                                    disabled={bulkToggleMutation.isPending}
                                    className="text-xs h-8 text-rose-600 border-rose-500/20 hover:bg-rose-500/10"
                                >
                                    <Lock className="h-3 w-3 mr-1" />
                                    Disable ({selectedIds.length})
                                </Button>
                            </div>
                        )}

                        <div className="flex items-center gap-2 pl-2 border-l border-border/50">
                            <span className="text-xs font-semibold text-muted-foreground">Master Switch:</span>
                            <Switch
                                checked={isGlobalEnabled}
                                onCheckedChange={handleToggleGlobalAccess}
                                disabled={toggleGlobalMutation.isPending}
                            />
                        </div>
                    </div>
                </div>

                {displaySummaries.length > 0 && (
                    <CardShell
                        title="Payslips"
                        icon={Receipt}
                        description="Records confirmed for salary with payslip generation options"
                        headerActions={
                            <div className="flex items-center gap-2">
                                {selectedIds.length > 0 && (
                                    <Button
                                        size="sm"
                                        onClick={() => generateMutation.mutate({ ids: selectedIds })}
                                        disabled={generateMutation.isPending}
                                        className="h-8 text-xs font-bold gap-1.5"
                                    >
                                        {generateMutation.isPending
                                            ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Generating...</>
                                            : <><Receipt className="h-3.5 w-3.5" />Generate Payslips ({selectedIds.length})</>
                                        }
                                    </Button>
                                )}
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleExportExcel}
                                    disabled={isExportingExcel || displaySummaries.length === 0}
                                    className="font-semibold gap-1.5 border-emerald-500/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10 shadow-xs h-8 text-xs"
                                >
                                    {isExportingExcel ? (
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                        <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                                    )}
                                    Export Detailed Payroll (Excel)
                                </Button>
                            </div>
                        }
                        contentClassName="p-0"
                    >
                        {/* Mobile */}
                        <div className="divide-y divide-border/50 sm:hidden">
                            {displaySummaries.map((s: any) => {
                                const isGenerated = s.status === 'payslip_generated'
                                const bd = s.salary_breakdown as Record<string, any> | null
                                return (
                                <div key={s.id} className={`p-4 space-y-1 ${!s.has_salary_setup ? 'opacity-70 bg-muted/5' : ''}`}>
                                    <div className="flex items-start gap-3">
                                        <div className="mt-1">
                                            {!s.has_salary_setup ? (
                                                <Checkbox disabled={true} />
                                            ) : isGenerated ? (
                                                <Checkbox disabled={true} />
                                            ) : (
                                                <Checkbox
                                                    checked={selectedIds.includes(s.id)}
                                                    onCheckedChange={() => toggleSelect(s.id, s)}
                                                />
                                            )}
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex items-center justify-between">
                                                <div className="flex flex-col gap-1 items-start">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-semibold text-sm">{s.profile?.full_name || s.profile?.email}</span>
                                                        {roleBadge(s.profile?.role || 'employee')}
                                                    </div>
                                                    <Badge variant="outline" className="text-[9px] px-1 py-0 font-normal">
                                                        {s.profile?.designation?.name || 'No Designation'}
                                                    </Badge>
                                                </div>
                                                
                                                <div className="flex items-center gap-2">
                                                    {!s.has_salary_setup ? (
                                                        <Badge variant="outline" className="text-amber-600 bg-amber-500/10 border-amber-500/20 text-[10px] px-1 py-0 gap-1 rounded-sm">
                                                            <AlertTriangle className="h-2.5 w-2.5" /> Salary Not Setup
                                                        </Badge>
                                                    ) : isGenerated ? (
                                                        <div className="flex items-center gap-1">
                                                            {(() => {
                                                                const netSalary = Number(s.take_home) || 0
                                                                const paidSoFar = s.payments?.reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0) || 0
                                                                if (paidSoFar === 0) {
                                                                    return (
                                                                        <Badge 
                                                                            variant="outline" 
                                                                            className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-[10px] font-bold cursor-pointer hover:bg-amber-500/20"
                                                                            onClick={() => handleOpenMarkPaid(s.id, s)}
                                                                        >
                                                                            Unpaid
                                                                        </Badge>
                                                                    )
                                                                } else if (paidSoFar < netSalary) {
                                                                    return (
                                                                        <Badge 
                                                                            variant="outline" 
                                                                            className="bg-orange-500/10 text-orange-600 border-orange-500/20 text-[10px] font-bold cursor-pointer hover:bg-orange-500/20"
                                                                            onClick={() => handleOpenMarkPaid(s.id, s)}
                                                                        >
                                                                            Partially Paid ({formatCurrency(paidSoFar)})
                                                                        </Badge>
                                                                    )
                                                                } else {
                                                                    return (
                                                                        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px] font-bold">
                                                                            Paid
                                                                        </Badge>
                                                                    )
                                                                }
                                                            })()}
                                                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setViewPayslipId(s.id)}>
                                                                <Eye className="h-3.5 w-3.5" />
                                                            </Button>
                                                        </div>
                                                    ) : (
                                                        <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/20 text-[10px]">
                                                            Ready
                                                        </Badge>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="text-[10px] text-muted-foreground mt-2 grid grid-cols-3 gap-1 bg-muted/10 p-1.5 rounded-md">
                                                <div>Month: <span className="font-semibold">{s.total_working_days}</span></div>
                                                <div>Present: <span className="text-emerald-600 font-semibold">{s.total_present_days}</span></div>
                                                <div>Half: <span className="text-orange-500 font-semibold">{s.total_half_days}</span></div>
                                                <div>Leaves: <span className="font-semibold">{s.total_leaves}</span></div>
                                                <div>Absent: <span className="text-rose-600 font-semibold">{s.total_absent_days}</span></div>
                                                <div>Extra: <span className="text-amber-600 font-semibold">{(s.salary_breakdown as any)?.extra_days || 0}</span></div>
                                            </div>

                                            {isGenerated && (
                                                <div className="grid grid-cols-2 gap-y-2 gap-x-2 text-[10px] mt-2 bg-muted/20 p-2 rounded-md">
                                                    <div><span className="text-muted-foreground mr-1">Gross:</span><span className="font-medium">{formatCurrency(s.gross_salary)}</span></div>
                                                    <div><span className="text-muted-foreground mr-1">Deductions:</span><span className="font-medium text-rose-600">{formatCurrency(Number(s.absence_deduction || 0) + Number(bd?.other_deductions || 0))}</span></div>
                                                    <div><span className="text-muted-foreground mr-1">Adv. Rec:</span><span className="font-medium text-amber-600">{Number(s.advance_recovery) > 0 ? formatCurrency(s.advance_recovery) : '—'}</span></div>
                                                    <div><span className="text-muted-foreground mr-1">Take-Home:</span><span className="font-medium text-emerald-600">{formatCurrency(s.take_home)}</span></div>
                                                </div>
                                            )}

                                            <div className="flex items-center justify-between pt-2 mt-2 border-t border-border/30 text-xs">
                                                <div className="flex items-center gap-1.5 text-muted-foreground">
                                                    {s.profile?.payslip_enabled !== false ? (
                                                        <Unlock className="h-3.5 w-3.5 text-emerald-500" />
                                                    ) : (
                                                        <Lock className="h-3.5 w-3.5 text-rose-500" />
                                                    )}
                                                    <span className="text-[11px] font-medium">Payslip Access:</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Badge variant="outline" className={s.profile?.payslip_enabled !== false ? "text-[9px] px-1.5 py-0 bg-emerald-500/10 text-emerald-600 border-emerald-500/20" : "text-[9px] px-1.5 py-0 bg-rose-500/10 text-rose-600 border-rose-500/20"}>
                                                        {s.profile?.payslip_enabled !== false ? 'Enabled' : 'Disabled'}
                                                    </Badge>
                                                    <Switch
                                                        checked={s.profile?.payslip_enabled !== false}
                                                        disabled={!isGlobalEnabled || toggleEmployeeMutation.isPending}
                                                        onCheckedChange={() => handleToggleEmployeeAccess(s.profile_id, s.profile?.payslip_enabled !== false)}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )})}
                        </div>

                        {/* Desktop */}
                        <div className="hidden sm:block overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-border/50 bg-muted/30">
                                        <th className="p-3 text-left w-10">
                                            <Checkbox
                                                checked={selectedIds.length === selectableSummaries.length && selectableSummaries.length > 0}
                                                onCheckedChange={toggleSelectAll}
                                                disabled={selectableSummaries.length === 0}
                                            />
                                        </th>
                                        <th className="p-3 text-left font-semibold text-muted-foreground min-w-[200px]">Employee</th>
                                        <th className="p-3 text-center font-semibold text-muted-foreground">Month/Pr/Hd/Ab/Lv/Ex</th>
                                        <th className="p-3 text-right font-semibold text-muted-foreground">Gross Pay</th>
                                        <th className="p-3 text-right font-semibold text-muted-foreground">Deductions</th>
                                        <th className="p-3 text-right font-semibold text-muted-foreground">Adv. Rec.</th>
                                        <th className="p-3 text-right font-semibold text-muted-foreground">Take-Home</th>
                                        <th className="p-3 text-center font-semibold text-muted-foreground">Status</th>
                                        <th className="p-3 text-center font-semibold text-muted-foreground">Self-Service</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border/30">
                                    {displaySummaries.map((s: any) => {
                                        const isGenerated = s.status === 'payslip_generated'
                                        const bd = s.salary_breakdown as Record<string, any> | null
                                        return (
                                        <tr key={s.id} className={`hover:bg-muted/20 transition-colors ${!s.has_salary_setup ? 'bg-muted/5' : ''}`}>
                                            <td className="p-3">
                                                {!s.has_salary_setup ? (
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <div className="inline-block">
                                                                <Checkbox disabled={true} />
                                                            </div>
                                                        </TooltipTrigger>
                                                        <TooltipContent>
                                                            <p>Salary Not Setup</p>
                                                        </TooltipContent>
                                                    </Tooltip>
                                                ) : isGenerated ? (
                                                    <Checkbox disabled={true} />
                                                ) : (
                                                    <Checkbox
                                                        checked={selectedIds.includes(s.id)}
                                                        onCheckedChange={() => toggleSelect(s.id, s)}
                                                    />
                                                )}
                                            </td>
                                            <td className="p-3">
                                                <div className="flex flex-col gap-1 items-start">
                                                    <div className="flex items-center gap-2">
                                                        <span className={`font-medium ${!s.has_salary_setup ? 'opacity-60' : ''}`}>
                                                            {s.profile?.full_name || s.profile?.email}
                                                        </span>
                                                        {roleBadge(s.profile?.role || 'employee')}
                                                    </div>
                                                    <Badge variant="outline" className="text-[9px] px-1 py-0 font-normal">
                                                        {s.profile?.designation?.name || 'No Designation'}
                                                    </Badge>
                                                </div>
                                            </td>
                                            <td className="p-3 text-center">
                                                <span className="text-muted-foreground">{s.total_working_days}</span> / <span className="font-bold text-emerald-600">{s.total_present_days}</span> / <span className="text-orange-500 font-semibold">{s.total_half_days}</span> / <span className="font-bold text-rose-600">{s.total_absent_days}</span> / <span className="text-muted-foreground">{s.total_leaves}</span> / <span className="text-amber-600 font-semibold">{(s.salary_breakdown as any)?.extra_days || 0}</span>
                                            </td>
                                            <td className="p-3 text-right font-medium">
                                                {isGenerated ? formatCurrency(s.gross_salary) : <span className="text-muted-foreground/40">—</span>}
                                            </td>
                                            <td className="p-3 text-right font-medium text-rose-600">
                                                {isGenerated ? formatCurrency(Number(s.absence_deduction || 0) + Number(bd?.other_deductions || 0)) : <span className="text-muted-foreground/40">—</span>}
                                            </td>
                                            <td className="p-3 text-right font-medium text-amber-600">
                                                {isGenerated ? (Number(s.advance_recovery) > 0 ? formatCurrency(s.advance_recovery) : <span className="text-muted-foreground/40">—</span>) : <span className="text-muted-foreground/40">—</span>}
                                            </td>
                                            <td className="p-3 text-right font-bold text-emerald-600">
                                                {isGenerated ? formatCurrency(s.take_home) : <span className="text-muted-foreground/40">—</span>}
                                            </td>
                                            <td className="p-3 text-center">
                                                {!s.has_salary_setup ? (
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <div className="inline-block">
                                                                <Badge variant="outline" className="text-amber-600 bg-amber-500/10 border-amber-500/20 text-[10px] gap-1 px-1.5 py-0">
                                                                    <AlertTriangle className="h-2.5 w-2.5" /> Salary Not Setup
                                                                </Badge>
                                                            </div>
                                                        </TooltipTrigger>
                                                        <TooltipContent>
                                                            <p>Configure Salary Setup to generate payslip</p>
                                                        </TooltipContent>
                                                    </Tooltip>
                                                ) : isGenerated ? (
                                                    <div className="flex items-center justify-center gap-1">
                                                        {s.paid_mode ? (
                                                            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px] py-0 px-1.5 font-bold">
                                                                Paid
                                                            </Badge>
                                                        ) : (
                                                            <Badge 
                                                                variant="outline" 
                                                                className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-[10px] py-0 px-1.5 font-bold cursor-pointer hover:bg-amber-500/20"
                                                                onClick={() => handleOpenMarkPaid(s.id, s)}
                                                                title="Click to mark as paid"
                                                            >
                                                                Unpaid
                                                            </Badge>
                                                        )}
                                                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setViewPayslipId(s.id)}>
                                                            <Eye className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                ) : (
                                                    <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/20 text-[10px] py-0 px-1.5">
                                                        Ready
                                                    </Badge>
                                                )}
                                            </td>
                                            <td className="p-3 text-center">
                                                <div className="flex items-center justify-center gap-1.5">
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <div className="inline-flex items-center">
                                                                <Switch
                                                                    checked={s.profile?.payslip_enabled !== false}
                                                                    disabled={!isGlobalEnabled || toggleEmployeeMutation.isPending}
                                                                    onCheckedChange={() => handleToggleEmployeeAccess(s.profile_id, s.profile?.payslip_enabled !== false)}
                                                                />
                                                            </div>
                                                        </TooltipTrigger>
                                                        <TooltipContent>
                                                            {!isGlobalEnabled ? (
                                                                <p>Workspace master switch is disabled</p>
                                                            ) : s.profile?.payslip_enabled !== false ? (
                                                                <p>Self-service enabled. Click to disable for this employee.</p>
                                                            ) : (
                                                                <p>Self-service disabled. Click to enable for this employee.</p>
                                                            )}
                                                        </TooltipContent>
                                                    </Tooltip>
                                                    {s.profile?.payslip_enabled === false ? (
                                                        <Lock className="h-3.5 w-3.5 text-rose-500" />
                                                    ) : (
                                                        <Unlock className="h-3.5 w-3.5 text-emerald-500/60" />
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    )})}
                                </tbody>
                            </table>
                        </div>
                    </CardShell>
                )}

                {/* Empty State */}
                {!isLoading && (!summaries || displaySummaries.length === 0) && (
                    <CardShell
                        title="Payslips"
                        icon={Receipt}
                        description="No data for this period"
                        contentClassName="p-8"
                    >
                        <div className="text-center text-muted-foreground">
                            <Receipt className="h-12 w-12 mx-auto mb-3 opacity-30" />
                            <p className="font-medium">No records found</p>
                            <p className="text-sm">Compile and confirm monthly attendance first</p>
                        </div>
                    </CardShell>
                )}

                {/* Loading State */}
                {isLoading && (
                    <div className="p-6 space-y-3">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="h-24 bg-muted/30 rounded-xl animate-pulse" />
                        ))}
                    </div>
                )}

                {/* Payslip Detail Dialog — A4 Salary Slip */}
                <Dialog open={!!viewPayslipId} onOpenChange={(open) => !open && setViewPayslipId(null)}>
                    <DialogContent className="max-w-[820px] max-h-[90vh] flex flex-col p-0 overflow-hidden">
                        <DialogHeader className="px-6 pt-5 pb-3 border-b border-border/50 shrink-0">
                            <DialogTitle className="flex items-center gap-2">
                                <Receipt className="h-5 w-5 text-primary" />
                                Salary Slip
                            </DialogTitle>
                            <DialogDescription className="sr-only">
                                Detailed view of the employee salary slip.
                            </DialogDescription>
                        </DialogHeader>

                        {!payslipDetail || !breakdown ? (
                            <div className="flex-1 overflow-y-auto p-6 space-y-6 animate-pulse">
                                {/* Glassmorphic Header Skeleton */}
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-muted/30 border border-border/50 p-4 rounded-2xl animate-pulse">
                                    <div className="flex items-center gap-3">
                                        <div className="h-12 w-12 rounded-xl bg-muted/60 dark:bg-slate-800 animate-pulse" />
                                        <div className="space-y-2">
                                            <div className="h-4 w-32 bg-muted/60 dark:bg-slate-800 rounded" />
                                            <div className="h-3 w-24 bg-muted/60 dark:bg-slate-800 rounded" />
                                        </div>
                                    </div>
                                    <div className="space-y-2 flex flex-col md:items-end">
                                        <div className="h-5 w-20 bg-muted/60 dark:bg-slate-800 rounded-xl" />
                                        <div className="h-3 w-16 bg-muted/60 dark:bg-slate-800 rounded" />
                                    </div>
                                </div>
                                {/* Attendance Stats Cards Skeleton */}
                                <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
                                    {[...Array(6)].map((_, i) => (
                                        <div key={i} className="bg-card border border-border/40 p-3 rounded-xl min-h-[85px] animate-pulse flex flex-col justify-between">
                                            <div className="h-3 w-12 bg-muted/60 dark:bg-slate-800 rounded mx-auto" />
                                            <div className="h-5 w-8 bg-muted/60 dark:bg-slate-800 rounded mx-auto" />
                                        </div>
                                    ))}
                                </div>
                                {/* Table skeleton */}
                                <div className="space-y-3">
                                    <div className="h-10 bg-muted/40 dark:bg-slate-800 rounded-xl animate-pulse" />
                                    <div className="h-32 bg-muted/20 dark:bg-slate-800/50 rounded-xl animate-pulse" />
                                </div>
                                {/* Footer skeleton */}
                                <div className="flex justify-end gap-2 pt-3 border-t border-border/50">
                                    <div className="h-9 w-28 bg-muted/60 dark:bg-slate-800 rounded-lg animate-pulse" />
                                    <div className="h-9 w-20 bg-muted/60 dark:bg-slate-800 rounded-lg animate-pulse" />
                                </div>
                            </div>
                        ) : (
                            <>
                                {/* Hidden print container */}
                                <div style={{ display: 'none' }}>
                                    <div ref={payslipRef}>
                                        <div className="slip-page" style={{ padding: '32px 40px 40px' }}>
                                            {/* Slip Header */}
                                            <div style={{ textAlign: 'center', paddingBottom: '14px', marginBottom: '18px', borderBottom: '3px double currentColor' }}>
                                                <h1 style={{ fontSize: '20px', fontWeight: 700, letterSpacing: '3px', textTransform: 'uppercase' as const, marginBottom: '4px' }}>
                                                    SALARY SLIP
                                                </h1>
                                                <p style={{ fontSize: '14px', opacity: 0.6, fontWeight: 500 }}>
                                                    For the month of {MONTHS[month - 1]} {year}
                                                </p>
                                            </div>

                                            {/* Employee Details Grid */}
                                            <div style={{
                                                display: 'grid',
                                                gridTemplateColumns: '1fr 1fr',
                                                gap: '4px 36px',
                                                marginBottom: '22px',
                                                padding: '14px 18px',
                                                border: '1px solid',
                                                borderRadius: '4px',
                                                borderColor: 'var(--border, #ddd)',
                                                background: 'var(--muted, #fafafa)',
                                            }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', padding: '3px 0' }}>
                                                    <span style={{ opacity: 0.6 }}>Employee Name</span>
                                                    <span style={{ fontWeight: 600 }}>{payslipDetail.profile?.full_name || '—'}</span>
                                                </div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', padding: '3px 0' }}>
                                                    <span style={{ opacity: 0.6 }}>Designation</span>
                                                    <span style={{ fontWeight: 600 }}>{payslipDetail.profile?.designation?.name || '—'}</span>
                                                </div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', padding: '3px 0' }}>
                                                    <span style={{ opacity: 0.6 }}>Email</span>
                                                    <span style={{ fontWeight: 600, fontSize: '12px' }}>{payslipDetail.profile?.email || '—'}</span>
                                                </div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', padding: '3px 0' }}>
                                                    <span style={{ opacity: 0.6 }}>Month / Year</span>
                                                    <span style={{ fontWeight: 600 }}>{MONTHS[month - 1]} {year}</span>
                                                </div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', padding: '3px 0' }}>
                                                    <span style={{ opacity: 0.6 }}>Month Days</span>
                                                    <span style={{ fontWeight: 600 }}>{breakdown.total_working_days}</span>
                                                </div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', padding: '3px 0' }}>
                                                    <span style={{ opacity: 0.6 }}>Present Days</span>
                                                    <span style={{ fontWeight: 600, color: '#16a34a' }}>{payslipDetail.total_present_days}</span>
                                                </div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', padding: '3px 0' }}>
                                                    <span style={{ opacity: 0.6 }}>Half Days</span>
                                                    <span style={{ fontWeight: 600, color: '#d97706' }}>{breakdown.half_days || 0}</span>
                                                </div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', padding: '3px 0' }}>
                                                    <span style={{ opacity: 0.6 }}>Leaves</span>
                                                    <span style={{ fontWeight: 600 }}>{payslipDetail.total_leaves}</span>
                                                </div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', padding: '3px 0' }}>
                                                    <span style={{ opacity: 0.6 }}>Absent Days</span>
                                                    <span style={{ fontWeight: 600, color: '#dc2626' }}>{breakdown.absent_days}</span>
                                                </div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', padding: '3px 0' }}>
                                                    <span style={{ opacity: 0.6 }}>Extra Days</span>
                                                    <span style={{ fontWeight: 600, color: '#b45309' }}>{breakdown.extra_days || 0}</span>
                                                </div>
                                            </div>

                                            {/* Earnings & Deductions — Side by Side Table */}
                                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                                <thead>
                                                    <tr>
                                                        <th style={{ background: '#f0f0f0', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.8px', padding: '10px 14px', border: '1px solid #ccc', textAlign: 'left', width: '30%' }}>Earnings</th>
                                                        <th style={{ background: '#f0f0f0', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.8px', padding: '10px 14px', border: '1px solid #ccc', textAlign: 'right', width: '20%' }}>Amount (₹)</th>
                                                        <th style={{ background: '#f0f0f0', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.8px', padding: '10px 14px', border: '1px solid #ccc', textAlign: 'left', width: '30%' }}>Deductions</th>
                                                        <th style={{ background: '#f0f0f0', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.8px', padding: '10px 14px', border: '1px solid #ccc', textAlign: 'right', width: '20%' }}>Amount (₹)</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {Array.from({ length: maxRows }).map((_, i) => (
                                                        <tr key={i}>
                                                            <td style={{ padding: '7px 14px', border: '1px solid #ddd', fontSize: '13px', color: '#333' }}>
                                                                {earningsItems[i]?.label || ''}
                                                            </td>
                                                            <td style={{ padding: '7px 14px', border: '1px solid #ddd', fontSize: '13px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                                                                {earningsItems[i] ? formatCurrency(earningsItems[i].amount) : ''}
                                                            </td>
                                                            <td style={{ padding: '7px 14px', border: '1px solid #ddd', fontSize: '13px', color: '#b91c1c' }}>
                                                                {deductionItems[i]?.label || ''}
                                                            </td>
                                                            <td style={{ padding: '7px 14px', border: '1px solid #ddd', fontSize: '13px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#b91c1c' }}>
                                                                {deductionItems[i] ? formatCurrency(deductionItems[i].amount) : ''}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                    {/* Totals Row */}
                                                    <tr>
                                                        <td style={{ padding: '10px 14px', border: '1px solid #ccc', fontSize: '13px', fontWeight: 700, background: '#f5f5f5', borderTop: '2px solid #999' }}>
                                                            Total Earnings
                                                        </td>
                                                        <td style={{ padding: '10px 14px', border: '1px solid #ccc', fontSize: '13px', fontWeight: 700, background: '#f5f5f5', textAlign: 'right', borderTop: '2px solid #999', fontVariantNumeric: 'tabular-nums' }}>
                                                            {formatCurrency(totalEarnings)}
                                                        </td>
                                                        <td style={{ padding: '10px 14px', border: '1px solid #ccc', fontSize: '13px', fontWeight: 700, background: '#f5f5f5', borderTop: '2px solid #999', color: '#b91c1c' }}>
                                                            Total Deductions
                                                        </td>
                                                        <td style={{ padding: '10px 14px', border: '1px solid #ccc', fontSize: '13px', fontWeight: 700, background: '#f5f5f5', textAlign: 'right', borderTop: '2px solid #999', fontVariantNumeric: 'tabular-nums', color: '#b91c1c' }}>
                                                            {formatCurrency(totalDeductions)}
                                                        </td>
                                                    </tr>
                                                </tbody>
                                            </table>

                                            {/* Net Pay Box */}
                                            <div style={{
                                                marginTop: '20px',
                                                padding: '16px 20px',
                                                border: '2px solid currentColor',
                                                borderRadius: '4px',
                                            }}>
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                    <span style={{ fontSize: '15px', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '1px' }}>
                                                        Net Pay
                                                    </span>
                                                    <span style={{ fontSize: '20px', fontWeight: 800 }}>
                                                        {formatCurrency(breakdown.take_home)}
                                                    </span>
                                                </div>
                                                <div style={{ fontSize: '12px', opacity: 0.7, marginTop: '6px', fontStyle: 'italic' }}>
                                                    ({numberToWords(Number(breakdown.take_home || 0))})
                                                </div>
                                            </div>

                                            {/* Carry-Forward Notice */}
                                            {Number(breakdown.carry_forward || 0) > 0 && (
                                                <div style={{
                                                    marginTop: '12px',
                                                    padding: '12px 16px',
                                                    border: '1px solid #fca5a5',
                                                    borderRadius: '4px',
                                                    background: '#fef2f2',
                                                    color: '#991b1b',
                                                    fontSize: '12px',
                                                }}>
                                                    <strong>Note:</strong> Deductions exceeded earnings by {formatCurrency(breakdown.carry_forward)}.
                                                    This amount has been carried forward as an advance and will be adjusted in the next month&apos;s salary.
                                                </div>
                                            )}

                                            {/* Payment Details (Printed) */}
                                            {payslipDetail.paid_mode && (
                                                <div style={{
                                                    marginTop: '16px',
                                                    padding: '14px 18px',
                                                    border: '1px solid var(--border, #ddd)',
                                                    borderRadius: '4px',
                                                    background: 'var(--muted, #fafafa)',
                                                }}>
                                                    <div style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '8px', borderBottom: '1px solid #eee', paddingBottom: '4px' }}>
                                                        Payment Information
                                                    </div>
                                                    <div style={{
                                                        display: 'grid',
                                                        gridTemplateColumns: '1fr 1fr 1fr',
                                                        gap: '8px 16px',
                                                    }}>
                                                        <div style={{ fontSize: '13px' }}>
                                                            <span style={{ opacity: 0.6, fontSize: '11px', textTransform: 'uppercase', display: 'block' }}>Payment Mode</span>
                                                            <span style={{ fontWeight: 600, textTransform: 'capitalize' }}>{payslipDetail.paid_mode.replace('_', ' ')}</span>
                                                        </div>
                                                        <div style={{ fontSize: '13px' }}>
                                                            <span style={{ opacity: 0.6, fontSize: '11px', textTransform: 'uppercase', display: 'block' }}>Payment Date</span>
                                                            <span style={{ fontWeight: 600 }}>{payslipDetail.pay_date}</span>
                                                        </div>
                                                        {payslipDetail.pay_reference_no && (
                                                            <div style={{ fontSize: '13px' }}>
                                                                <span style={{ opacity: 0.6, fontSize: '11px', textTransform: 'uppercase', display: 'block' }}>Ref / Txn No</span>
                                                                <span style={{ fontWeight: 600 }}>{payslipDetail.pay_reference_no}</span>
                                                            </div>
                                                        )}
                                                        {payslipDetail.payment_remarks && (
                                                            <div style={{ fontSize: '13px', gridColumn: 'span 3', marginTop: '4px' }}>
                                                                <span style={{ opacity: 0.6, fontSize: '11px', textTransform: 'uppercase', display: 'block' }}>Remarks</span>
                                                                <span style={{ fontWeight: 600, whiteSpace: 'pre-wrap' }}>{payslipDetail.payment_remarks}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Authorized Signatory */}
                                            <div style={{
                                                marginTop: '60px',
                                                display: 'flex',
                                                justifyContent: 'flex-end',
                                            }}>
                                                <div style={{ textAlign: 'center', minWidth: '200px' }}>
                                                    <div style={{ borderBottom: '1px solid #999', marginBottom: '8px', height: '50px' }} />
                                                    <span style={{ fontSize: '13px', fontWeight: 600 }}>Authorized Signatory</span>
                                                </div>
                                            </div>

                                            {/* Footer */}
                                            <div style={{
                                                marginTop: '30px',
                                                paddingTop: '10px',
                                                borderTop: '1px solid #ccc',
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                fontSize: '11px',
                                                opacity: 0.5,
                                            }}>
                                                <span>This is a computer-generated salary slip.</span>
                                                <span>Generated on {new Date().toLocaleDateString('en-IN')}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Premium On-Screen Interactive Dashboard View */}
                                <div className="flex-1 overflow-y-auto p-6 pb-24 space-y-6">
                                    {/* Glassmorphic Header */}
                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-muted/30 border border-border/50 p-4 rounded-2xl">
                                        <div className="flex items-center gap-3">
                                            <div className="h-12 w-12 rounded-xl bg-orange-500/10 flex items-center justify-center border border-orange-500/20 text-orange-600 font-bold text-lg">
                                                {payslipDetail.profile?.full_name?.charAt(0) || 'E'}
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-base leading-none">{payslipDetail.profile?.full_name || '—'}</h3>
                                                <p className="text-xs text-muted-foreground mt-1">{payslipDetail.profile?.designation?.name || '—'}</p>
                                                <p className="text-[10px] text-muted-foreground mt-0.5">{payslipDetail.profile?.email}</p>
                                            </div>
                                        </div>
                                        <div className="flex flex-col md:items-end justify-center">
                                            <Badge variant="outline" className="bg-orange-500/10 text-orange-600 border-orange-500/25 text-[10px] px-2 py-0.5 font-bold tracking-widest uppercase">
                                                {MONTHS[month - 1]} {year}
                                            </Badge>
                                            <span className="text-[10px] text-muted-foreground mt-1">Status: Generated</span>
                                        </div>
                                    </div>

                                    {/* Attendance Stats Cards */}
                                    <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
                                        <div className="bg-card border border-border/40 p-3 rounded-xl text-center flex flex-col justify-between min-h-[85px]">
                                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider min-h-[28px] flex items-center justify-center leading-tight">Month Days</span>
                                            <span className="text-lg font-bold text-slate-800 dark:text-slate-200 mt-auto block">{breakdown.total_working_days}</span>
                                        </div>
                                        <div className="bg-card border border-border/40 p-3 rounded-xl text-center flex flex-col justify-between min-h-[85px]">
                                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider min-h-[28px] flex items-center justify-center leading-tight">Present</span>
                                            <span className="text-lg font-bold text-emerald-600 mt-auto block">{payslipDetail.total_present_days}</span>
                                        </div>
                                        <div className="bg-card border border-border/40 p-3 rounded-xl text-center flex flex-col justify-between min-h-[85px]">
                                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider min-h-[28px] flex items-center justify-center leading-tight">Half Days</span>
                                            <span className="text-lg font-bold text-orange-600 mt-auto block">{breakdown.half_days || 0}</span>
                                        </div>
                                        <div className="bg-card border border-border/40 p-3 rounded-xl text-center flex flex-col justify-between min-h-[85px]">
                                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider min-h-[28px] flex items-center justify-center leading-tight">Leaves</span>
                                            <span className="text-lg font-bold text-blue-600 mt-auto block">{payslipDetail.total_leaves}</span>
                                        </div>
                                        <div className="bg-card border border-border/40 p-3 rounded-xl text-center flex flex-col justify-between min-h-[85px]">
                                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider min-h-[28px] flex items-center justify-center leading-tight">Absent</span>
                                            <span className="text-lg font-bold text-rose-600 mt-auto block">{breakdown.absent_days}</span>
                                        </div>
                                        <div className="bg-card border border-border/40 p-3 rounded-xl text-center flex flex-col justify-between min-h-[85px]">
                                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider min-h-[28px] flex items-center justify-center leading-tight">Extra Days</span>
                                            <span className="text-lg font-bold text-amber-600 mt-auto block">{breakdown.extra_days || 0}</span>
                                        </div>
                                    </div>


                                    {/* Earnings & Deductions Tables */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {/* Earnings */}
                                        <div className="bg-emerald-50/10 dark:bg-emerald-500/5 rounded-2xl border border-emerald-500/10 overflow-hidden">
                                            <div className="bg-emerald-500/10 dark:bg-emerald-500/15 px-4 py-2 border-b border-emerald-500/10 font-bold text-xs text-emerald-700 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                                                <TrendingUp className="h-4 w-4" /> Earnings
                                            </div>
                                            <div className="divide-y divide-emerald-500/10">
                                                {earningsItems.map((item, i) => (
                                                    <div key={i} className="flex justify-between px-4 py-2.5 text-sm font-medium">
                                                        <span className="text-muted-foreground">{item.label}</span>
                                                        <span className="font-bold tabular-nums">{formatCurrency(item.amount)}</span>
                                                    </div>
                                                ))}
                                                <div className="flex justify-between px-4 py-3 bg-emerald-500/10 font-bold text-sm text-emerald-800 dark:text-emerald-400">
                                                    <span>Total Earnings</span>
                                                    <span className="tabular-nums">{formatCurrency(totalEarnings)}</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Deductions */}
                                        <div className="bg-rose-50/10 dark:bg-rose-500/5 rounded-2xl border border-rose-500/10 overflow-hidden">
                                            <div className="bg-rose-500/10 dark:bg-rose-500/15 px-4 py-2 border-b border-rose-500/10 font-bold text-xs text-rose-700 dark:text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
                                                <TrendingDown className="h-4 w-4" /> Deductions
                                            </div>
                                            <div className="divide-y divide-rose-500/10">
                                                {deductionItems.map((item, i) => (
                                                    <div key={i} className="flex justify-between px-4 py-2.5 text-sm font-medium">
                                                        <span className="text-muted-foreground">{item.label}</span>
                                                        <span className="font-bold text-rose-600 dark:text-rose-400 tabular-nums">{formatCurrency(item.amount)}</span>
                                                    </div>
                                                ))}
                                                <div className="flex justify-between px-4 py-3 bg-rose-500/10 font-bold text-sm text-rose-800 dark:text-rose-400">
                                                    <span>Total Deductions</span>
                                                    <span className="tabular-nums text-rose-600 dark:text-rose-400">{formatCurrency(totalDeductions)}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Net Pay Gradient Hero Card */}
                                    <div className="relative overflow-hidden bg-gradient-to-r from-orange-500 to-rose-600 p-5 rounded-2xl text-white shadow-lg shadow-orange-500/10 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                                        <div>
                                            <span className="text-[10px] font-black uppercase tracking-wider opacity-80 block mb-1">Net Take-Home Salary</span>
                                            <div className="flex items-baseline gap-3 flex-wrap">
                                                <h2 className="text-3xl font-black tracking-tight shrink-0">{formatCurrency(breakdown.take_home)}</h2>
                                                <p className="text-xs opacity-75 font-medium italic text-left break-words max-w-xs md:max-w-md">({numberToWords(Number(breakdown.take_home || 0))})</p>
                                            </div>
                                        </div>
                                        {Number(breakdown.carry_forward || 0) > 0 && (
                                            <div className="bg-white/10 border border-white/20 p-3 rounded-xl max-w-xs text-xs backdrop-blur-sm self-stretch md:self-auto">
                                                <strong>Note:</strong> Deductions exceeded earnings by {formatCurrency(breakdown.carry_forward)}. This amount is carried forward as a deficit.
                                            </div>
                                        )}
                                    </div>

                                    {/* Payment Details Card */}
                                    {displayPaidMode ? (
                                        <div className="bg-emerald-50/50 dark:bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-4 space-y-3">
                                            <div className="flex items-center justify-between">
                                                <h4 className="text-xs font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                                                    <CheckCircle className="h-4 w-4 text-emerald-600" /> Payment Recorded
                                                </h4>
                                                <Button 
                                                    variant="ghost" 
                                                    size="sm" 
                                                    className="h-7 text-xs text-emerald-700 hover:text-emerald-800 dark:text-emerald-400"
                                                    onClick={() => handleOpenMarkPaid(payslipDetail.id, {
                                                        ...payslipDetail,
                                                        paid_mode: displayPaidMode,
                                                        pay_date: displayPayDate,
                                                        pay_reference_no: displayPayReferenceNo,
                                                        payment_remarks: displayPaymentRemarks
                                                    })}
                                                >
                                                    Edit Details
                                                </Button>
                                            </div>
                                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm font-medium">
                                                <div>
                                                    <span className="text-[10px] text-muted-foreground uppercase block">Paid Mode</span>
                                                    <span className="font-bold capitalize">{displayPaidMode.replace('_', ' ')}</span>
                                                </div>
                                                <div>
                                                    <span className="text-[10px] text-muted-foreground uppercase block">Pay Date</span>
                                                    <span className="font-bold">{displayPayDate}</span>
                                                </div>
                                                {displayPayReferenceNo && (
                                                    <div>
                                                        <span className="text-[10px] text-muted-foreground uppercase block">Ref / Txn No</span>
                                                        <span className="font-bold">{displayPayReferenceNo}</span>
                                                    </div>
                                                )}
                                            </div>
                                            {displayPaymentRemarks && (
                                                <div className="pt-2.5 border-t border-emerald-500/10 dark:border-emerald-500/5 text-sm font-medium">
                                                    <span className="text-[10px] text-muted-foreground uppercase block">Remarks</span>
                                                    <span className="font-bold whitespace-pre-wrap block">{displayPaymentRemarks}</span>
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="bg-slate-500/5 border border-dashed border-border rounded-2xl p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                                            <div>
                                                <h4 className="text-xs font-black uppercase tracking-wider text-muted-foreground">Payment Pending</h4>
                                                <p className="text-xs text-muted-foreground mt-0.5">This generated payslip has not been marked as paid yet.</p>
                                            </div>
                                            <Button 
                                                size="sm"
                                                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                                                onClick={() => handleOpenMarkPaid(payslipDetail.id)}
                                            >
                                                Mark as Paid
                                            </Button>
                                        </div>
                                    )}
                                </div>

                                <div className="flex justify-end gap-2 px-6 pb-5 pt-3 border-t border-border/50 shrink-0">
                                    <Button variant="outline" size="sm" onClick={handlePrint}>
                                        <Printer className="h-4 w-4 mr-1" />Print A4 Slip
                                    </Button>
                                    <Button variant="secondary" size="sm" onClick={() => setViewPayslipId(null)}>
                                        Close
                                    </Button>
                                </div>
                            </>
                        )}
                    </DialogContent>
                </Dialog>

                {/* Mark Paid Dialog */}
                <Dialog open={!!markPaidId} onOpenChange={(open) => !open && setMarkPaidId(null)}>
                    <DialogContent className="max-w-[650px]">
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                                <CreditCard className="h-5 w-5 text-orange-500" />
                                Mark Salary as Paid
                            </DialogTitle>
                            <DialogDescription className="sr-only">
                                Record payment details for this payslip.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-3">
                            {/* Row 1: Employee Details styled like payslip view */}
                            <div className="flex items-center gap-3 bg-muted/30 border border-border/50 p-3.5 rounded-2xl">
                                <div className="h-12 w-12 rounded-xl bg-orange-500/10 flex items-center justify-center border border-orange-500/20 text-orange-600 font-bold text-lg shrink-0">
                                    {selectedSummary?.profile?.full_name?.charAt(0) || 'E'}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <h3 className="font-bold text-sm leading-none truncate">{selectedSummary?.profile?.full_name || '—'}</h3>
                                    <p className="text-xs text-muted-foreground mt-1 truncate">{selectedSummary?.profile?.designation?.name || 'No Designation'}</p>
                                    <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{selectedSummary?.profile?.email}</p>
                                </div>
                                <div className="flex flex-col items-end gap-1.5 shrink-0">
                                    <Badge variant="outline" className="bg-orange-500/10 text-orange-600 border-orange-500/25 text-[9px] px-2 py-0.5 font-bold tracking-widest uppercase">
                                        {MONTHS[month - 1]} {year}
                                    </Badge>
                                    <div className="text-right">
                                        <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground block">Net Salary</span>
                                        <span className="text-xs font-black text-emerald-600 block leading-none mt-0.5">{formatCurrency(selectedSummary?.take_home)}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Row 2: Payment Mode & Payment Date */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Payment Mode</label>
                                    <Select value={paidMode} onValueChange={(val) => setPaidMode(val)}>
                                        <SelectTrigger className="w-full h-10 text-xs">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                                            <SelectItem value="cash">Cash</SelectItem>
                                            <SelectItem value="cheque">Cheque</SelectItem>
                                            <SelectItem value="upi">UPI / Online</SelectItem>
                                            <SelectItem value="other">Other</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-1 flex flex-col justify-end">
                                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Payment Date</label>
                                    <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                                        <PopoverTrigger asChild>
                                            <Button
                                                variant="outline"
                                                className={cn(
                                                    "w-full h-10 pl-3 text-left font-normal border border-input bg-background hover:bg-muted/10 flex items-center justify-between",
                                                    !payDate && "text-muted-foreground"
                                                )}
                                            >
                                                {payDate ? (
                                                    format(new Date(payDate), "PPP")
                                                ) : (
                                                    <span>Pick a date</span>
                                                )}
                                                <CalendarIcon className="h-4 w-4 opacity-50" />
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0" align="start">
                                            <Calendar
                                                mode="single"
                                                selected={payDate ? new Date(payDate) : undefined}
                                                onSelect={(date) => {
                                                    if (date) {
                                                        setPayDate(format(date, 'yyyy-MM-dd'))
                                                    }
                                                    setIsCalendarOpen(false)
                                                }}
                                                initialFocus
                                            />
                                        </PopoverContent>
                                    </Popover>
                                </div>
                            </div>

                            {/* Summary metrics for partial payments */}
                            {(() => {
                                const netSalary = selectedSummary ? Number(selectedSummary.take_home) || 0 : 0
                                const paidSoFar = selectedSummary?.payments?.reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0) || 0
                                const remaining = netSalary - paidSoFar
                                return (
                                    <div className="grid grid-cols-3 gap-2 bg-muted/20 p-3 rounded-xl text-center text-[11px] font-semibold border border-border/40 mb-2">
                                        <div>
                                            <span className="text-[9px] text-muted-foreground block uppercase font-bold">Net Take Home</span>
                                            <span className="text-slate-700 dark:text-slate-300 font-bold">{formatCurrency(netSalary)}</span>
                                        </div>
                                        <div>
                                            <span className="text-[9px] text-muted-foreground block uppercase font-bold">Paid So Far</span>
                                            <span className="text-emerald-600 font-bold">{formatCurrency(paidSoFar)}</span>
                                        </div>
                                        <div>
                                            <span className="text-[9px] text-muted-foreground block uppercase font-bold">Remaining Balance</span>
                                            <span className="text-orange-500 font-bold">{formatCurrency(remaining)}</span>
                                        </div>
                                    </div>
                                )
                            })()}

                            {/* Row 3: Payment Amount & Transfer No */}
                            {(() => {
                                const netSalary = selectedSummary ? Number(selectedSummary.take_home) || 0 : 0
                                const paidSoFar = selectedSummary?.payments?.reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0) || 0
                                const remaining = netSalary - paidSoFar
                                const hasExceededLimit = Number(paidAmount) > remaining
                                return (
                                    <>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-1">
                                                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Payment Amount</label>
                                                <input 
                                                    type="number"
                                                    step="0.01"
                                                    min="0.01"
                                                    max={remaining}
                                                    value={paidAmount}
                                                    onChange={(e) => setPaidAmount(e.target.value)}
                                                    className="w-full flex h-10 rounded-md border border-input bg-background px-3 py-1 text-xs font-bold text-emerald-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                                    placeholder={`Max ${remaining}`}
                                                />
                                                {hasExceededLimit && (
                                                    <p className="text-[10px] text-rose-500 font-bold mt-0.5">
                                                        Cannot exceed remaining balance of {formatCurrency(remaining)}
                                                    </p>
                                                )}
                                            </div>

                                            <div className="space-y-1">
                                                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Transfer No.</label>
                                                <input 
                                                    type="text"
                                                    value={payReferenceNo}
                                                    onChange={(e) => setPayReferenceNo(e.target.value)}
                                                    placeholder="Enter bank reference, check no, or UPI txn id"
                                                    className="w-full flex h-10 rounded-md border border-input bg-background px-3 py-2 text-xs ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                                />
                                            </div>
                                        </div>

                                        {/* Row 4: Remarks */}
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Remarks</label>
                                            <textarea 
                                                value={paymentRemarks}
                                                onChange={(e) => setPaymentRemarks(e.target.value)}
                                                placeholder="Additional notes..."
                                                className="w-full flex min-h-[60px] rounded-md border border-input bg-background px-3 py-2 text-xs ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                            />
                                        </div>

                                        <div className="flex justify-end gap-2 pt-2">
                                            <Button variant="outline" size="sm" onClick={() => setMarkPaidId(null)}>Cancel</Button>
                                            <AsyncButton 
                                                disabled={!paidAmount || Number(paidAmount) <= 0 || hasExceededLimit || isNaN(Number(paidAmount))}
                                                onClick={async () => {
                                                    await markPaidMutation.mutateAsync({
                                                        summaryId: markPaidId!,
                                                        paidAmount: Number(paidAmount),
                                                        paidMode,
                                                        payDate,
                                                        payReferenceNo,
                                                        paymentRemarks,
                                                    })
                                                }}
                                                variant="primary"
                                                size="sm"
                                                loadingText="Recording..."
                                                successText="Payment Saved successfully!"
                                                icons={{ idle: <Save className="h-4 w-4" /> }}
                                                className="w-auto px-4"
                                            >
                                                Save Payment
                                            </AsyncButton>
                                        </div>
                                    </>
                                )
                            })()}
                        </div>
                    </DialogContent>
                </Dialog>

                <MonthlyBonusDialog
                    isOpen={isBonusModalOpen}
                    onOpenChange={setIsBonusModalOpen}
                    month={month}
                    year={year}
                    onSuccess={() => refetch()}
                />
            </div>
        </TooltipProvider>
    )
}
