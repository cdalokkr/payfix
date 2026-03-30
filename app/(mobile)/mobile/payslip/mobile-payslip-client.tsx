"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { format } from "date-fns"
import { trpc } from "@/lib/trpc/client"
import {
    Receipt,
    FileText,
    X,
    TrendingDown,
    TrendingUp,
    IndianRupee,
    Loader2,
    Download
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"


const containerVars = {
    hidden: { opacity: 0 },
    show: {
        opacity: 1,
        transition: { staggerChildren: 0.1 }
    }
}

const itemVars = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
}

const MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
]

const formatCurr = (amount: number | string | null | undefined) => {
    const num = Number(amount) || 0
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0,
    }).format(num)
}

const numberToWords = (num: number): string => {
    if (num === 0) return 'Zero'
    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
        'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen']
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']
    const scales = ['', 'Thousand', 'Lakh', 'Crore']

    const absNum = Math.abs(Math.round(num))
    if (absNum === 0) return 'Zero'

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

export function MobilePayslipClient({ profile }: { profile: any }) {
    // Default to last completed month
    const currentDate = new Date()
    let defaultMonth = currentDate.getMonth()
    let defaultYear = currentDate.getFullYear()
    if (defaultMonth === 0) {
        defaultMonth = 12
        defaultYear -= 1
    }

    const [month, setMonth] = useState<number>(defaultMonth)
    const [year, setYear] = useState<number>(defaultYear)
    const [viewPayslipId, setViewPayslipId] = useState<string | null>(null)
    const [isDownloading, setIsDownloading] = useState<string | null>(null)


    const { data: payslips, isLoading, isFetching } = trpc.salary.getMyPayslips.useQuery({ month, year })

    const { data: payslipDetail } = trpc.salary.getMyPayslipDetail.useQuery(
        { summaryId: viewPayslipId || "" },
        { enabled: !!viewPayslipId }
    )

    const months = Array.from({ length: 12 }, (_, i) => ({
        value: i + 1,
        label: format(new Date(2024, i, 1), "MMMM")
    }))

    const years = Array.from({ length: 5 }, (_, i) => year - 2 + i)

    // Payslip detail breakdown
    const breakdown = payslipDetail?.salary_breakdown as Record<string, any> | null

    const earningsItems = breakdown ? [
        { label: 'Basic Salary', amount: breakdown.basic_salary },
        { label: 'HRA', amount: breakdown.hra },
        { label: 'DA', amount: breakdown.da },
        { label: 'TA', amount: breakdown.ta },
        { label: 'Special Allowance', amount: breakdown.special_allowance },
        { label: 'Incentive', amount: breakdown.incentive },
    ].filter(e => Number(e.amount) > 0) : []

    const deductionItems = breakdown ? [
        { label: 'Absence Deduction', amount: breakdown.absence_deduction },
        { label: 'Other Deductions', amount: breakdown.other_deductions },
        ...(Number(breakdown.advance_recovery) > 0 ? [{ label: 'Advance Recovery', amount: breakdown.advance_recovery }] : []),
    ].filter(e => Number(e.amount) > 0) : []

    const totalEarnings = earningsItems.reduce((s, e) => s + Number(e.amount || 0), 0)
    const totalDeductions = deductionItems.reduce((s, e) => s + Number(e.amount || 0), 0)

    const handleDownloadPdf = async (slip: any, e: React.MouseEvent) => {
        e.stopPropagation();
        setIsDownloading(slip.id);
        
        try {
            const bd = slip.salary_breakdown as Record<string, any>;
            const monthName = MONTHS[slip.month - 1];
            
            const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
                import('jspdf'),
                import('jspdf-autotable'),
            ]);
            
            const doc = new jsPDF();
            
            doc.setFontSize(20);
            doc.text("SALARY SLIP", 105, 20, { align: "center" });
            
            doc.setFontSize(10);
            doc.text(`For the month of ${monthName} ${slip.year}`, 105, 28, { align: "center" });
            
            autoTable(doc, {
                startY: 40,
                body: [
                    ['Employee Name', profile.full_name || '—', 'Working Days', bd?.total_working_days || '—'],
                    ['Designation', profile.designation?.name || '—', 'Present Days', slip.total_present_days || '—'],
                    ['Email', profile.email || '—', 'Absent Days', bd?.absent_days || '—'],
                    ['Month / Year', `${monthName} ${slip.year}`, 'Leaves', slip.total_leaves || '—'],
                ],
                theme: 'grid',
                styles: { fontSize: 9, cellPadding: 3 },
                columnStyles: {
                    0: { fontStyle: 'bold', fillColor: [245, 245, 245] },
                    2: { fontStyle: 'bold', fillColor: [245, 245, 245] }
                }
            });
            
            const eItems = bd ? [
                { label: 'Basic Salary', amount: bd.basic_salary },
                { label: 'HRA', amount: bd.hra },
                { label: 'DA', amount: bd.da },
                { label: 'TA', amount: bd.ta },
                { label: 'Special Allowance', amount: bd.special_allowance },
                { label: 'Incentive', amount: bd.incentive },
            ].filter(ev => Number(ev.amount) > 0) : [];
            
            const dItems = bd ? [
                { label: 'Absence Deduction', amount: bd.absence_deduction },
                { label: 'Other Deductions', amount: bd.other_deductions },
                ...(Number(bd.advance_recovery) > 0 ? [{ label: 'Advance Recovery', amount: bd.advance_recovery }] : []),
            ].filter(ev => Number(ev.amount) > 0) : [];
            
            const tEarn = eItems.reduce((s, ev) => s + Number(ev.amount || 0), 0);
            const tDed = dItems.reduce((s, ev) => s + Number(ev.amount || 0), 0);
            
            const maxRows = Math.max(eItems.length, dItems.length);
            const tableBody: any[] = [];
            for (let i = 0; i < maxRows; i++) {
                tableBody.push([
                    eItems[i]?.label || '',
                    eItems[i] ? `Rs. ${Number(eItems[i].amount).toFixed(2)}` : '',
                    dItems[i]?.label || '',
                    dItems[i] ? `Rs. ${Number(dItems[i].amount).toFixed(2)}` : ''
                ]);
            }
            
            tableBody.push([
                { content: 'Total Earnings', styles: { fontStyle: 'bold' } },
                { content: `Rs. ${Number(tEarn).toFixed(2)}`, styles: { fontStyle: 'bold' } },
                { content: 'Total Deductions', styles: { fontStyle: 'bold' } },
                { content: `Rs. ${Number(tDed).toFixed(2)}`, styles: { fontStyle: 'bold' } }
            ]);
            
            let finalY = (doc as any).lastAutoTable.finalY + 10;
            
            autoTable(doc, {
                startY: finalY,
                head: [['Earnings', 'Amount', 'Deductions', 'Amount']],
                body: tableBody,
                theme: 'grid',
                headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' },
                styles: { fontSize: 9, cellPadding: 3 },
                columnStyles: {
                    1: { halign: 'right' },
                    3: { halign: 'right' }
                }
            });
            
            finalY = (doc as any).lastAutoTable.finalY + 15;
            
            doc.setFontSize(16);
            doc.setFont('helvetica', 'bold');
            doc.text(`NET PAY: Rs. ${Number(slip.take_home).toFixed(2)}`, 14, finalY);
            
            doc.setFontSize(9);
            doc.setFont('helvetica', 'italic');
            doc.text(`(${numberToWords(Number(slip.take_home))})`, 14, finalY + 6);
            
            const fileName = `Salary_Slip_${profile.full_name?.replace(/\s+/g, '_')}_${monthName}_${slip.year}.pdf`;
            doc.save(fileName);
        } catch (error) {
            console.error("Failed to generate PDF", error);
        } finally {
            setIsDownloading(null);
        }
    }



    // Determine first payslip summary data for the hero card
    const firstPayslip = payslips?.[0]

    return (
        <div className="flex flex-col h-[calc(100dvh-5rem-5rem)] -mx-4 -mt-4 bg-slate-50 dark:bg-slate-950">
            {/* Fixed Top Section */}
            <div className="flex-none px-4 pt-1 pb-2 space-y-3 z-10 bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 shadow-sm relative">
                {/* Header */}
                <header className="flex items-center gap-2">
                    <Receipt className="w-5 h-5 text-orange-500" />
                    <h1 className="text-lg font-black tracking-tight flex items-center gap-2">
                        My PaySlips
                        {isFetching && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
                    </h1>
                </header>

                {/* Summary Card */}
                <motion.div variants={itemVars} initial="hidden" animate="show">
                    <div className="relative overflow-hidden rounded-[1.5rem] bg-gradient-to-br from-orange-500 to-rose-600 p-5 text-white shadow-xl shadow-orange-500/20">
                        {/* Glass Decorations */}
                        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-xl" />
                        <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full -ml-12 -mb-12 blur-lg" />

                        <div className="relative">
                            <div className="flex items-center gap-2 mb-4 opacity-90">
                                <IndianRupee className="w-4 h-4" />
                                <span className="text-xs font-black uppercase tracking-widest">Take-Home Pay</span>
                            </div>
                            <div className="flex items-end gap-2 mb-6">
                                <span className="text-3xl font-black tracking-tighter leading-none">
                                    {firstPayslip ? formatCurr(firstPayslip.take_home) : '—'}
                                </span>
                                <span className="text-sm font-medium opacity-80 mb-1">
                                    {format(new Date(year, month - 1), 'MMM yyyy')}
                                </span>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-white/10 rounded-xl p-3 backdrop-blur-md border border-white/20">
                                    <div className="flex items-center gap-1.5 mb-1 opacity-80">
                                        <TrendingUp className="w-3.5 h-3.5" />
                                        <span className="text-[10px] font-bold uppercase tracking-wider">Gross</span>
                                    </div>
                                    <span className="font-bold">
                                        {firstPayslip ? formatCurr(firstPayslip.gross_salary) : '—'}
                                    </span>
                                </div>
                                <div className="bg-black/10 rounded-xl p-3 backdrop-blur-md border border-black/10">
                                    <div className="flex items-center gap-1.5 mb-1 opacity-80">
                                        <TrendingDown className="w-3.5 h-3.5" />
                                        <span className="text-[10px] font-bold uppercase tracking-wider">Deductions</span>
                                    </div>
                                    <span className="font-bold">
                                        {firstPayslip ? formatCurr(
                                            Number(firstPayslip.absence_deduction || 0) +
                                            Number((firstPayslip.salary_breakdown as any)?.other_deductions || 0) +
                                            Number(firstPayslip.advance_recovery || 0)
                                        ) : '—'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </motion.div>

                {/* Filters */}
                <motion.div variants={itemVars} initial="hidden" animate="show" className="flex items-center gap-3">
                    <div className="flex-1">
                        <Select value={month.toString()} onValueChange={(val) => setMonth(parseInt(val))}>
                            <SelectTrigger className="w-full bg-white dark:bg-slate-900 border-none shadow-sm rounded-xl h-11 font-bold">
                                <SelectValue placeholder="Month" />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl border-none shadow-xl">
                                {months.map(m => (
                                    <SelectItem key={m.value} value={m.value.toString()} className="font-medium">
                                        {m.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="w-32">
                        <Select value={year.toString()} onValueChange={(val) => setYear(parseInt(val))}>
                            <SelectTrigger className="w-full bg-white dark:bg-slate-900 border-none shadow-sm rounded-xl h-11 font-bold">
                                <SelectValue placeholder="Year" />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl border-none shadow-xl">
                                {years.map(y => (
                                    <SelectItem key={y} value={y.toString()} className="font-medium">
                                        {y}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </motion.div>
            </div>

            {/* Scrollable List */}
            <div className="flex-1 overflow-y-auto px-4 pb-4 pt-4 space-y-4 hide-scrollbar">
                <div className="space-y-4">
                    <div className="flex items-center justify-between px-1">
                        <h2 className="text-xs font-black uppercase tracking-widest text-slate-500">Salary Slips</h2>
                        <Badge variant="secondary" className="bg-slate-200/50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-black rounded-lg">
                            {payslips?.length || 0} Found
                        </Badge>
                    </div>

                    {isLoading ? (
                        <div className="space-y-3">
                            {[1, 2].map(i => (
                                <div key={i} className="bg-slate-200/50 dark:bg-slate-800/50 animate-pulse h-36 rounded-2xl" />
                            ))}
                        </div>
                    ) : !payslips || payslips.length === 0 ? (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="bg-white dark:bg-slate-900 border dark:border-slate-800 rounded-[1.5rem] p-8 text-center flex flex-col items-center justify-center min-h-[200px]"
                        >
                            <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
                                <Receipt className="w-8 h-8 text-slate-400" />
                            </div>
                            <h3 className="text-base font-black text-slate-900 dark:text-white mb-1">No PaySlips Found</h3>
                            <p className="text-[13px] font-medium text-slate-500 max-w-[220px] leading-snug">
                                No salary slips have been generated for {MONTHS[month - 1]} {year} yet.
                            </p>
                        </motion.div>
                    ) : (
                        <motion.div variants={containerVars} initial="hidden" animate="show" className="space-y-3">
                            {payslips.map((slip: any) => {
                                const bd = slip.salary_breakdown as Record<string, any> | null
                                const cardEarnings = bd ? [
                                    { label: 'Basic', amount: bd.basic_salary },
                                    { label: 'HRA', amount: bd.hra },
                                    { label: 'DA', amount: bd.da },
                                    { label: 'TA', amount: bd.ta },
                                    { label: 'Special Allow.', amount: bd.special_allowance },
                                    { label: 'Incentive', amount: bd.incentive },
                                ].filter(e => Number(e.amount) > 0) : []
                                const cardDeductions = bd ? [
                                    { label: 'Absence Ded.', amount: bd.absence_deduction },
                                    { label: 'Other Ded.', amount: bd.other_deductions },
                                    ...(Number(bd.advance_recovery) > 0 ? [{ label: 'Adv. Recovery', amount: bd.advance_recovery }] : []),
                                ].filter(e => Number(e.amount) > 0) : []
                                const cardTotalEarnings = cardEarnings.reduce((s: number, e: any) => s + Number(e.amount || 0), 0)
                                const cardTotalDeductions = cardDeductions.reduce((s: number, e: any) => s + Number(e.amount || 0), 0)
                                return (
                                    <motion.div
                                        key={slip.id}
                                        variants={itemVars}
                                        whileTap={{ scale: 0.98 }}
                                        onClick={() => setViewPayslipId(slip.id)}
                                        className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-800/50 cursor-pointer active:bg-slate-50 dark:active:bg-slate-800/50 transition-colors"
                                    >
                                        {/* Header: Month + Generated Badge */}
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="flex items-center gap-2">
                                                <div className="w-10 h-10 rounded-xl bg-orange-50 dark:bg-orange-500/10 flex items-center justify-center shrink-0">
                                                    <Receipt className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                                                </div>
                                                <div className="text-sm font-black text-slate-900 dark:text-white leading-none">
                                                    {MONTHS[slip.month - 1]} {slip.year}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <Badge variant="outline" className="border-emerald-200 text-emerald-600 bg-emerald-50/50 font-bold uppercase tracking-widest text-[9px] py-1 px-2 rounded-lg gap-1">
                                                    <FileText className="w-3 h-3" /> Generated
                                                </Badge>
                                                <Button 
                                                    variant="ghost" 
                                                    size="icon" 
                                                    className="w-8 h-8 rounded-full text-slate-400 hover:text-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700" 
                                                    onClick={(e) => handleDownloadPdf(slip, e)}
                                                    disabled={isDownloading === slip.id}
                                                >
                                                    {isDownloading === slip.id ? <Loader2 className="w-4 h-4 animate-spin"/> : <Download className="w-4 h-4" />}
                                                </Button>
                                            </div>
                                        </div>

                                        {/* Attendance Stats */}
                                        <div className="grid grid-cols-4 gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                                            <div className="text-center">
                                                <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Working</div>
                                                <div className="text-[13px] font-bold text-slate-700 dark:text-slate-300">{bd?.total_working_days ?? slip.total_working_days ?? '—'}</div>
                                            </div>
                                            <div className="text-center">
                                                <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Absent</div>
                                                <div className="text-[13px] font-bold text-rose-600">{bd?.absent_days ?? slip.total_absent_days ?? '—'}</div>
                                            </div>
                                            <div className="text-center">
                                                <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Leave</div>
                                                <div className="text-[13px] font-bold text-amber-600">{slip.total_leaves ?? '—'}</div>
                                            </div>
                                            <div className="text-center">
                                                <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Present</div>
                                                <div className="text-[13px] font-bold text-emerald-600">{slip.total_present_days ?? '—'}</div>
                                            </div>
                                        </div>

                                        {/* Earnings & Deductions */}
                                        <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-3">
                                            {cardEarnings.length > 0 && (
                                                <div>
                                                    <div className="text-[9px] font-black uppercase tracking-widest text-emerald-600 mb-1.5 flex items-center gap-1">
                                                        <TrendingUp className="w-3 h-3" /> Earnings
                                                    </div>
                                                    <div className="bg-emerald-50/50 dark:bg-emerald-500/5 rounded-xl border border-emerald-100/50 dark:border-emerald-500/10 overflow-hidden">
                                                        {cardEarnings.map((item, i) => (
                                                            <div key={i} className={`flex justify-between px-3 py-1.5 text-[11px] ${i > 0 ? 'border-t border-emerald-100/50 dark:border-emerald-500/10' : ''}`}>
                                                                <span className="text-slate-500 font-medium">{item.label}</span>
                                                                <span className="font-bold tabular-nums text-slate-700 dark:text-slate-300">{formatCurr(item.amount)}</span>
                                                            </div>
                                                        ))}
                                                        <div className="flex justify-between px-3 py-1.5 text-[11px] border-t-2 border-emerald-200/60 dark:border-emerald-500/20 bg-emerald-100/40 dark:bg-emerald-500/10">
                                                            <span className="font-black text-emerald-700 dark:text-emerald-400">Total Earnings</span>
                                                            <span className="font-black text-emerald-700 dark:text-emerald-400 tabular-nums">{formatCurr(cardTotalEarnings)}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                            {cardDeductions.length > 0 && (
                                                <div>
                                                    <div className="text-[9px] font-black uppercase tracking-widest text-rose-600 mb-1.5 flex items-center gap-1">
                                                        <TrendingDown className="w-3 h-3" /> Deductions
                                                    </div>
                                                    <div className="bg-rose-50/50 dark:bg-rose-500/5 rounded-xl border border-rose-100/50 dark:border-rose-500/10 overflow-hidden">
                                                        {cardDeductions.map((item, i) => (
                                                            <div key={i} className={`flex justify-between px-3 py-1.5 text-[11px] ${i > 0 ? 'border-t border-rose-100/50 dark:border-rose-500/10' : ''}`}>
                                                                <span className="text-slate-500 font-medium">{item.label}</span>
                                                                <span className="font-bold tabular-nums text-rose-600">{formatCurr(item.amount)}</span>
                                                            </div>
                                                        ))}
                                                        <div className="flex justify-between px-3 py-1.5 text-[11px] border-t-2 border-rose-200/60 dark:border-rose-500/20 bg-rose-100/40 dark:bg-rose-500/10">
                                                            <span className="font-black text-rose-700 dark:text-rose-400">Total Deductions</span>
                                                            <span className="font-black text-rose-700 dark:text-rose-400 tabular-nums">{formatCurr(cardTotalDeductions)}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* Net Pay */}
                                        <div className="mt-3 pt-3 border-t border-dashed border-slate-200 dark:border-slate-700 flex justify-between items-center">
                                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Net Pay</span>
                                            <span className="text-base font-black text-emerald-600 dark:text-emerald-400 tracking-tight">{formatCurr(slip.take_home)}</span>
                                        </div>
                                    </motion.div>
                                )
                            })}
                        </motion.div>
                    )}
                </div>
            </div>

            {/* PaySlip Detail Bottom Sheet */}
            <AnimatePresence>
                {viewPayslipId && payslipDetail && breakdown && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm"
                        onClick={() => setViewPayslipId(null)}
                    >
                        <motion.div
                            initial={{ y: "100%" }}
                            animate={{ y: 0 }}
                            exit={{ y: "100%" }}
                            transition={{ type: "spring", damping: 30, stiffness: 300 }}
                            className="absolute bottom-0 left-0 right-0 bg-white dark:bg-slate-950 rounded-t-[2rem] max-h-[92vh] overflow-y-auto shadow-2xl"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* Sheet Handle */}
                            <div className="sticky top-0 z-10 bg-white dark:bg-slate-950 pt-3 pb-2 px-4 rounded-t-[2rem]">
                                <div className="w-10 h-1 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mb-3" />
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Receipt className="w-5 h-5 text-orange-500" />
                                        <h2 className="text-base font-black tracking-tight">Salary Slip</h2>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => setViewPayslipId(null)}>
                                            <X className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </div>
                            </div>

                            {/* Visible Payslip Content + Hidden Print Content */}
                            <div className="px-4 pb-8 space-y-5">
                                {/* Period Badge */}
                                <div className="flex justify-center">
                                    <Badge className="bg-orange-500/10 text-orange-600 border-orange-200 dark:border-orange-500/30 font-black uppercase tracking-widest text-[10px] py-1.5 px-4 rounded-xl">
                                        {MONTHS[month - 1]} {year}
                                    </Badge>
                                </div>

                                {/* Employee Info */}
                                <div className="bg-slate-50 dark:bg-slate-900/50 rounded-2xl p-4 space-y-2 border border-slate-100 dark:border-slate-800">
                                    <div className="flex justify-between text-[13px]">
                                        <span className="text-slate-500 font-medium">Name</span>
                                        <span className="font-bold">{payslipDetail.profile?.full_name || '—'}</span>
                                    </div>
                                    <div className="flex justify-between text-[13px]">
                                        <span className="text-slate-500 font-medium">Designation</span>
                                        <span className="font-bold">{payslipDetail.profile?.designation?.name || '—'}</span>
                                    </div>
                                    <div className="flex justify-between text-[13px]">
                                        <span className="text-slate-500 font-medium">Working Days</span>
                                        <span className="font-bold">{breakdown.total_working_days}</span>
                                    </div>
                                    <div className="flex justify-between text-[13px]">
                                        <span className="text-slate-500 font-medium">Present</span>
                                        <span className="font-bold text-emerald-600">{payslipDetail.total_present_days}</span>
                                    </div>
                                    <div className="flex justify-between text-[13px]">
                                        <span className="text-slate-500 font-medium">Absent</span>
                                        <span className="font-bold text-rose-600">{breakdown.absent_days}</span>
                                    </div>
                                    <div className="flex justify-between text-[13px]">
                                        <span className="text-slate-500 font-medium">Leaves</span>
                                        <span className="font-bold">{payslipDetail.total_leaves}</span>
                                    </div>
                                </div>

                                {/* Earnings */}
                                <div>
                                    <h3 className="text-[10px] font-black uppercase tracking-widest text-emerald-600 mb-2 px-1 flex items-center gap-1.5">
                                        <TrendingUp className="w-3.5 h-3.5" /> Earnings
                                    </h3>
                                    <div className="bg-emerald-50/50 dark:bg-emerald-500/5 rounded-2xl border border-emerald-100 dark:border-emerald-500/10 overflow-hidden">
                                        {earningsItems.map((item, i) => (
                                            <div key={i} className={`flex justify-between px-4 py-2.5 text-[13px] ${i > 0 ? 'border-t border-emerald-100 dark:border-emerald-500/10' : ''}`}>
                                                <span className="text-slate-600 dark:text-slate-400 font-medium">{item.label}</span>
                                                <span className="font-bold tabular-nums">{formatCurr(item.amount)}</span>
                                            </div>
                                        ))}
                                        <div className="flex justify-between px-4 py-3 text-[13px] border-t-2 border-emerald-200 dark:border-emerald-500/20 bg-emerald-100/50 dark:bg-emerald-500/10">
                                            <span className="font-black text-emerald-700 dark:text-emerald-400">Total Earnings</span>
                                            <span className="font-black text-emerald-700 dark:text-emerald-400 tabular-nums">{formatCurr(totalEarnings)}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Deductions */}
                                {deductionItems.length > 0 && (
                                    <div>
                                        <h3 className="text-[10px] font-black uppercase tracking-widest text-rose-600 mb-2 px-1 flex items-center gap-1.5">
                                            <TrendingDown className="w-3.5 h-3.5" /> Deductions
                                        </h3>
                                        <div className="bg-rose-50/50 dark:bg-rose-500/5 rounded-2xl border border-rose-100 dark:border-rose-500/10 overflow-hidden">
                                            {deductionItems.map((item, i) => (
                                                <div key={i} className={`flex justify-between px-4 py-2.5 text-[13px] ${i > 0 ? 'border-t border-rose-100 dark:border-rose-500/10' : ''}`}>
                                                    <span className="text-slate-600 dark:text-slate-400 font-medium">{item.label}</span>
                                                    <span className="font-bold text-rose-600 tabular-nums">{formatCurr(item.amount)}</span>
                                                </div>
                                            ))}
                                            <div className="flex justify-between px-4 py-3 text-[13px] border-t-2 border-rose-200 dark:border-rose-500/20 bg-rose-100/50 dark:bg-rose-500/10">
                                                <span className="font-black text-rose-700 dark:text-rose-400">Total Deductions</span>
                                                <span className="font-black text-rose-700 dark:text-rose-400 tabular-nums">{formatCurr(totalDeductions)}</span>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Net Pay */}
                                <div className="bg-gradient-to-br from-orange-500 to-rose-600 rounded-2xl p-5 text-white shadow-lg shadow-orange-500/20">
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="text-xs font-black uppercase tracking-widest opacity-90">Net Pay (Take-Home)</span>
                                        <span className="text-2xl font-black tracking-tight">{formatCurr(breakdown.take_home)}</span>
                                    </div>
                                    <p className="text-[11px] opacity-70 font-medium italic">
                                        ({numberToWords(Number(breakdown.take_home || 0))})
                                    </p>
                                </div>

                                {/* Carry-Forward Notice */}
                                {Number(breakdown.carry_forward || 0) > 0 && (
                                    <div className="bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 rounded-xl p-3">
                                        <p className="text-[12px] text-rose-700 dark:text-rose-400 font-medium">
                                            <strong>Note:</strong> Deductions exceeded earnings by {formatCurr(breakdown.carry_forward)}.
                                            This amount has been carried forward as an advance.
                                        </p>
                                    </div>
                                )}
                            </div>

                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}
