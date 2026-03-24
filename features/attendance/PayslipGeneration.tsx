"use client"

import React, { useState, useMemo, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { trpc } from "@/lib/trpc/client"
import { toast } from "sonner"
import { Receipt, Loader2, Printer, Eye, AlertTriangle } from "lucide-react"
import { CardShell } from "./CardShell"
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
        Number(breakdown.incentive || 0)
    ) : 0

    const totalDeductions = breakdown ? (
        Number(breakdown.absence_deduction || 0) +
        Number(breakdown.other_deductions || 0) +
        Number(breakdown.advance_recovery || 0)
    ) : 0

    const earningsItems = breakdown ? [
        { label: 'Basic Salary', amount: breakdown.basic_salary },
        { label: 'HRA', amount: breakdown.hra },
        { label: 'DA', amount: breakdown.da },
        { label: 'TA', amount: breakdown.ta },
        { label: 'Special Allowance', amount: breakdown.special_allowance },
        { label: 'Incentive', amount: breakdown.incentive },
    ] : []

    const deductionItems = breakdown ? [
        { label: 'Absence Deduction', amount: breakdown.absence_deduction },
        { label: 'Other Deductions (PF/ESI/etc.)', amount: breakdown.other_deductions },
        ...(Number(breakdown.advance_recovery) > 0 ? [{ label: 'Advance Recovery', amount: breakdown.advance_recovery }] : []),
    ] : []

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
                                                            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px]">
                                                                Generated
                                                            </Badge>
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

                                            <div className="text-xs text-muted-foreground mt-2">
                                                Present: <span className="text-emerald-600 font-medium">{s.total_present_days}</span> | Absent: <span className="text-rose-600 font-medium">{s.total_absent_days}</span> | Leaves: {s.total_leaves}
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
                                        <th className="p-3 text-center font-semibold text-muted-foreground">Work/Pr/Ab/Lv</th>
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
                                                <span className="text-muted-foreground">{s.total_working_days}</span> / <span className="font-bold text-emerald-600">{s.total_present_days}</span> / <span className="font-bold text-rose-600">{s.total_absent_days}</span> / <span className="text-muted-foreground">{s.total_leaves}</span>
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
                                                        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px] py-0 px-1.5">
                                                            Generated
                                                        </Badge>
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

                        {payslipDetail && breakdown && (
                            <>
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
                                                <span style={{ opacity: 0.6 }}>Working Days</span>
                                                <span style={{ fontWeight: 600 }}>{breakdown.total_working_days}</span>
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', padding: '3px 0' }}>
                                                <span style={{ opacity: 0.6 }}>Present Days</span>
                                                <span style={{ fontWeight: 600, color: '#16a34a' }}>{payslipDetail.total_present_days}</span>
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', padding: '3px 0' }}>
                                                <span style={{ opacity: 0.6 }}>Absent Days</span>
                                                <span style={{ fontWeight: 600, color: '#dc2626' }}>{breakdown.absent_days}</span>
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', padding: '3px 0' }}>
                                                <span style={{ opacity: 0.6 }}>Leaves</span>
                                                <span style={{ fontWeight: 600 }}>{payslipDetail.total_leaves}</span>
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
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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

                                <div className="flex justify-end gap-2 px-6 pb-5 pt-3 border-t border-border/50">
                                    <Button variant="outline" size="sm" onClick={handlePrint}>
                                        <Printer className="h-4 w-4 mr-1" />Print
                                    </Button>
                                    <Button variant="secondary" size="sm" onClick={() => setViewPayslipId(null)}>
                                        Close
                                    </Button>
                                </div>
                            </>
                        )}
                    </DialogContent>
                </Dialog>
            </div>
        </TooltipProvider>
    )
}
