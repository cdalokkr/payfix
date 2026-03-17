"use client"

import React, { useState, useMemo, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { trpc } from "@/lib/trpc/client"
import { toast } from "sonner"
import { Receipt, Loader2, Download, Printer, Eye, IndianRupee, ArrowDown, ArrowRight, AlertTriangle } from "lucide-react"
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
import { Separator } from "@/components/ui/separator"
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
                    <head><title>Payslip</title>
                    <style>
                        body { font-family: system-ui, sans-serif; padding: 24px; color: #333; }
                        .payslip { max-width: 600px; margin: 0 auto; }
                        .header { text-align: center; margin-bottom: 24px; border-bottom: 2px solid #333; padding-bottom: 12px; }
                        .header h2 { margin: 0; font-size: 20px; }
                        .header p { margin: 4px 0 0; color: #666; font-size: 14px; }
                        .info-row { display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 14px; }
                        .info-row .label { color: #666; }
                        .info-row .value { font-weight: 600; }
                        table { width: 100%; border-collapse: collapse; margin: 16px 0; }
                        th, td { text-align: left; padding:  8px 12px; border-bottom: 1px solid #eee; font-size: 13px; }
                        th { background: #f5f5f5; font-weight: 600; }
                        .amount { text-align: right; }
                        .total-row { font-weight: 700; background: #f0f9ff; border-top: 2px solid #333; }
                        .deduction { color: #dc2626; }
                        .net { color: #16a34a; font-size: 16px; }
                        @media print { body { padding: 0; } }
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

                {/* Payslip Detail Dialog */}
                <Dialog open={!!viewPayslipId} onOpenChange={(open) => !open && setViewPayslipId(null)}>
                    <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                                <Receipt className="h-5 w-5 text-primary" />
                                Payslip Detail
                            </DialogTitle>
                        </DialogHeader>

                        {payslipDetail && breakdown && (
                            <>
                                <div ref={payslipRef}>
                                    <div className="payslip">
                                        <div className="text-center mb-4 pb-3 border-b-2 border-foreground/20">
                                            <h2 className="text-lg font-bold">SALARY SLIP</h2>
                                            <p className="text-sm text-muted-foreground">{MONTHS[month - 1]} {year}</p>
                                        </div>

                                        <div className="space-y-1 mb-4 text-sm bg-muted/10 p-3 rounded-lg border border-border/50">
                                            <div className="flex justify-between items-center mb-1">
                                                <span className="text-muted-foreground">Employee:</span>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-semibold">{payslipDetail.profile?.full_name || payslipDetail.profile?.email}</span>
                                                    {roleBadge(payslipDetail.profile?.role || 'employee')}
                                                </div>
                                            </div>
                                            <div className="flex justify-between items-center mb-3">
                                                <span className="text-muted-foreground">Designation:</span>
                                                <span className="text-xs text-muted-foreground font-medium">{payslipDetail.profile?.designation?.name || '—'}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-muted-foreground">Working Days:</span>
                                                <span>{breakdown.total_working_days}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-muted-foreground">Present Days:</span>
                                                <span className="text-emerald-600 font-medium">{payslipDetail.total_present_days}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-muted-foreground">Absent Days:</span>
                                                <span className="text-rose-600 font-medium">{breakdown.absent_days}</span>
                                            </div>
                                        </div>

                                        <Separator className="my-3" />

                                        {/* Earnings */}
                                        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">Earnings</p>
                                        <div className="space-y-1 text-sm bg-background p-2">
                                            <div className="flex justify-between"><span>Basic Salary</span><span>{formatCurrency(breakdown.basic_salary)}</span></div>
                                            <div className="flex justify-between"><span>HRA</span><span>{formatCurrency(breakdown.hra)}</span></div>
                                            <div className="flex justify-between"><span>DA</span><span>{formatCurrency(breakdown.da)}</span></div>
                                            <div className="flex justify-between"><span>TA</span><span>{formatCurrency(breakdown.ta)}</span></div>
                                            <div className="flex justify-between"><span>Special Allowance</span><span>{formatCurrency(breakdown.special_allowance)}</span></div>
                                            <div className="flex justify-between"><span>Incentive</span><span>{formatCurrency(breakdown.incentive)}</span></div>
                                            <div className="flex justify-between font-bold border-t pt-2 mt-2 py-1">
                                                <span>Gross Salary</span>
                                                <span>{formatCurrency(breakdown.gross_salary)}</span>
                                            </div>
                                        </div>

                                        <Separator className="my-3" />

                                        {/* Deductions */}
                                        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">Deductions</p>
                                        <div className="space-y-2 text-sm bg-rose-500/5 p-3 rounded-md border border-rose-500/10">
                                            <div className="flex justify-between text-rose-600">
                                                <span>Absence Deduction ({breakdown.absent_days} days × {formatCurrency(breakdown.per_day_rate)}/day)</span>
                                                <span>−{formatCurrency(breakdown.absence_deduction)}</span>
                                            </div>
                                            <div className="flex justify-between text-rose-600">
                                                <span>Other Deductions (PF/ESI/etc.)</span>
                                                <span>−{formatCurrency(breakdown.other_deductions)}</span>
                                            </div>
                                        </div>

                                        <Separator className="my-3" />

                                        {/* Net Salary */}
                                        <div className="flex justify-between font-bold text-sm px-2">
                                            <span>Net Salary</span>
                                            <span>{formatCurrency(breakdown.net_salary)}</span>
                                        </div>

                                        {/* Advance Recovery */}
                                        {Number(breakdown.advance_recovery) > 0 && (
                                            <>
                                                <Separator className="my-3" />
                                                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">Advance Recovery</p>
                                                <div className="flex justify-between text-sm text-amber-600 bg-amber-500/5 p-3 rounded-md border border-amber-500/10">
                                                    <span>Advance/Loan Adjusted</span>
                                                    <span>−{formatCurrency(breakdown.advance_recovery)}</span>
                                                </div>
                                            </>
                                        )}

                                        <Separator className="my-3" />

                                        {/* Take-Home */}
                                        <div className="flex justify-between font-bold text-lg p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 mt-4">
                                            <span className="text-emerald-700 dark:text-emerald-500">Take-Home Amount</span>
                                            <span className="text-emerald-700 dark:text-emerald-400">{formatCurrency(breakdown.take_home)}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-border/50">
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
