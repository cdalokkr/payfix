"use client"

import React, { useState, useMemo, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { trpc } from "@/lib/trpc/client"
import { toast } from "sonner"
import { Receipt, Loader2, Printer, Eye, AlertTriangle, TrendingUp, TrendingDown, CreditCard, CheckCircle, Save, Calendar as CalendarIcon } from "lucide-react"
import { CardShell } from "./CardShell"
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
} from "@/components/ui/dialog"

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { AsyncButton } from "@/components/ui/async-button"

const MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
]

export function PayslipGeneration({ basePath }: { basePath: string }) {
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
    const [paidMode, setPaidMode] = useState<string>("bank_transfer")
    const [payDate, setPayDate] = useState<string>(new Date().toISOString().split('T')[0])
    const [payReferenceNo, setPayReferenceNo] = useState<string>("")
    const [paymentRemarks, setPaymentRemarks] = useState<string>("")

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
        },
        onError: (err) => {
            toast.error(err.message || "Failed to mark salary as paid")
        }
    })

    const handleOpenMarkPaid = (id: string, currentDetails?: any) => {
        setMarkPaidId(id)
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

    const displaySummaries = useMemo(() =>
        summaries?.filter((s: any) => s.status === 'set_for_salary' || s.status === 'payslip_generated') || [], [summaries]
    )

    const selectedSummary = useMemo(() =>
        summaries?.find((s: any) => s.id === markPaidId), [summaries, markPaidId]
    )

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

    const breakdown = payslipDetail?.salary_breakdown as Record<string, any> | null

    // Compute totals for the columnar layout
    const totalEarnings = breakdown ? (
        Number(breakdown.basic_salary || 0) +
        Number(breakdown.hra || 0) +
        Number(breakdown.da || 0) +
        Number(breakdown.ta || 0) +
        Number(breakdown.special_allowance || 0) +
        Number(breakdown.incentive || 0) +
        Number(breakdown.extra_day_payment || 0)
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
        ...(Number(breakdown.extra_day_payment) > 0 ? [{ label: 'Extra Days Payment', amount: breakdown.extra_day_payment }] : []),
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
                {/* Controls */}
                <div className="flex flex-col sm:flex-row sm:items-end gap-4">
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

                    {selectedIds.length > 0 && (
                        <Button
                            onClick={() => generateMutation.mutate({ ids: selectedIds })}
                            disabled={generateMutation.isPending}
                            className="sm:ml-auto"
                        >
                            {generateMutation.isPending
                                ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" />Generating...</>
                                : <><Receipt className="h-4 w-4 mr-1" />Generate Payslips ({selectedIds.length})</>
                            }
                        </Button>
                    )}
                </div>

                {displaySummaries.length > 0 && (
                    <CardShell
                        title="Payslips"
                        icon={Receipt}
                        description="Records confirmed for salary with payslip generation options"
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
                                                            {s.paid_mode ? (
                                                                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px] font-bold">
                                                                    Paid
                                                                </Badge>
                                                            ) : (
                                                                <Badge 
                                                                    variant="outline" 
                                                                    className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-[10px] font-bold cursor-pointer hover:bg-amber-500/20"
                                                                    onClick={() => handleOpenMarkPaid(s.id, s)}
                                                                >
                                                                    Unpaid
                                                                </Badge>
                                                            )}
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
                    <DialogContent className="max-w-[820px] max-h-[95vh] overflow-y-auto p-0">
                        <DialogHeader className="px-6 pt-5 pb-0">
                            <DialogTitle className="flex items-center gap-2">
                                <Receipt className="h-5 w-5 text-primary" />
                                Salary Slip
                            </DialogTitle>
                        </DialogHeader>

                        {!payslipDetail || !breakdown ? (
                            <div className="p-6 space-y-6">
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
                                                {payslipDetail.paid_mode && (
                                                    <>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', padding: '3px 0' }}>
                                                            <span style={{ opacity: 0.6 }}>Payment Mode</span>
                                                            <span style={{ fontWeight: 600, textTransform: 'capitalize' }}>{payslipDetail.paid_mode.replace('_', ' ')}</span>
                                                        </div>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', padding: '3px 0' }}>
                                                            <span style={{ opacity: 0.6 }}>Payment Date</span>
                                                            <span style={{ fontWeight: 600 }}>{payslipDetail.pay_date}</span>
                                                        </div>
                                                        {payslipDetail.pay_reference_no && (
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', padding: '3px 0', gridColumn: 'span 2' }}>
                                                                <span style={{ opacity: 0.6 }}>Ref / Txn No</span>
                                                                <span style={{ fontWeight: 600 }}>{payslipDetail.pay_reference_no}</span>
                                                            </div>
                                                        )}
                                                    </>
                                                )}
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
                                <div className="p-6 space-y-6">
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

                                    {/* Payment Details Card */}
                                    {payslipDetail.paid_mode ? (
                                        <div className="bg-emerald-50/50 dark:bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-4 space-y-3">
                                            <div className="flex items-center justify-between">
                                                <h4 className="text-xs font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                                                    <CheckCircle className="h-4 w-4 text-emerald-600" /> Payment Recorded
                                                </h4>
                                                <Button 
                                                    variant="ghost" 
                                                    size="sm" 
                                                    className="h-7 text-xs text-emerald-700 hover:text-emerald-800 dark:text-emerald-400"
                                                    onClick={() => handleOpenMarkPaid(payslipDetail.id, payslipDetail)}
                                                >
                                                    Edit Details
                                                </Button>
                                            </div>
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm font-medium">
                                                <div>
                                                    <span className="text-[10px] text-muted-foreground uppercase block">Paid Mode</span>
                                                    <span className="font-bold capitalize">{payslipDetail.paid_mode.replace('_', ' ')}</span>
                                                </div>
                                                <div>
                                                    <span className="text-[10px] text-muted-foreground uppercase block">Pay Date</span>
                                                    <span className="font-bold">{payslipDetail.pay_date}</span>
                                                </div>
                                                {payslipDetail.pay_reference_no && (
                                                    <div>
                                                        <span className="text-[10px] text-muted-foreground uppercase block">Ref / Txn No</span>
                                                        <span className="font-bold">{payslipDetail.pay_reference_no}</span>
                                                    </div>
                                                )}
                                                {payslipDetail.payment_remarks && (
                                                    <div className="col-span-2 md:col-span-1">
                                                        <span className="text-[10px] text-muted-foreground uppercase block">Remarks</span>
                                                        <span className="font-bold truncate block">{payslipDetail.payment_remarks}</span>
                                                    </div>
                                                )}
                                            </div>
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
                                            <span className="text-[10px] font-black uppercase tracking-wider opacity-80">Net Take-Home Salary</span>
                                            <h2 className="text-3xl font-black mt-1 tracking-tight">{formatCurrency(breakdown.take_home)}</h2>
                                            <div className="text-[11px] opacity-90 mt-1.5 font-semibold bg-white/10 px-2.5 py-1 rounded-lg inline-block backdrop-blur-sm">
                                                Formula: Total Earnings ({formatCurrency(totalEarnings)}) - Total Deductions ({formatCurrency(totalDeductions)})
                                            </div>
                                            <p className="text-xs opacity-75 font-medium italic mt-2">({numberToWords(Number(breakdown.take_home || 0))})</p>
                                        </div>
                                        {Number(breakdown.carry_forward || 0) > 0 && (
                                            <div className="bg-white/10 border border-white/20 p-3 rounded-xl max-w-xs text-xs backdrop-blur-sm self-stretch md:self-auto">
                                                <strong>Note:</strong> Deductions exceeded earnings by {formatCurrency(breakdown.carry_forward)}. This amount is carried forward as a deficit.
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="flex justify-end gap-2 px-6 pb-5 pt-3 border-t border-border/50">
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

                            {/* Row 3: Payment Amount & Transfer No */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Payment Amount</label>
                                    <input 
                                        type="text"
                                        value={selectedSummary ? formatCurrency(selectedSummary.take_home) : '—'}
                                        disabled
                                        className="w-full flex h-10 rounded-md border border-input bg-muted px-3 py-1 text-xs font-bold text-emerald-600 disabled:opacity-80"
                                    />
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
                                    onClick={async () => {
                                        await markPaidMutation.mutateAsync({
                                            summaryId: markPaidId!,
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
                        </div>
                    </DialogContent>
                </Dialog>
            </div>
        </TooltipProvider>
    )
}
