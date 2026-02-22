"use client"

import React, { useState, useMemo, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { trpc } from "@/lib/trpc/client"
import { toast } from "sonner"
import { Receipt, Loader2, Download, Printer, Eye, IndianRupee, ArrowDown, ArrowRight } from "lucide-react"
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

const MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
]

export function PayslipGeneration({ basePath }: { basePath: string }) {
    const [month, setMonth] = useState(new Date().getMonth() + 1)
    const [year, setYear] = useState(new Date().getFullYear())
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
        onSuccess: (data) => {
            toast.success(`Payslips generated for ${data.length} employees`)
            setSelectedIds([])
            refetch()
        },
        onError: (err) => toast.error(err.message),
    })

    const setForSalarySummaries = useMemo(() =>
        summaries?.filter((s: any) => s.status === 'set_for_salary') || [], [summaries]
    )

    const payslipSummaries = useMemo(() =>
        summaries?.filter((s: any) => s.status === 'payslip_generated') || [], [summaries]
    )

    const toggleSelect = (id: string) => {
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        )
    }

    const toggleSelectAll = () => {
        if (selectedIds.length === setForSalarySummaries.length) {
            setSelectedIds([])
        } else {
            setSelectedIds(setForSalarySummaries.map((s: any) => s.id))
        }
    }

    const formatCurrency = (val: string | number | null | undefined) => {
        const num = Number(val) || 0
        return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(num)
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
                        th, td { text-align: left; padding: 8px 12px; border-bottom: 1px solid #eee; font-size: 13px; }
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

            {/* Pending for Payslip */}
            {setForSalarySummaries.length > 0 && (
                <CardShell
                    title="Ready for Payslip Generation"
                    icon={Receipt}
                    description="Records confirmed for salary — select and generate payslips"
                    contentClassName="p-0"
                >
                    {/* Mobile */}
                    <div className="divide-y divide-border/50 sm:hidden">
                        {setForSalarySummaries.map((s: any) => (
                            <div key={s.id} className="p-4 space-y-1">
                                <div className="flex items-center gap-3">
                                    <Checkbox
                                        checked={selectedIds.includes(s.id)}
                                        onCheckedChange={() => toggleSelect(s.id)}
                                    />
                                    <div>
                                        <p className="font-semibold text-sm">{s.profile?.full_name || s.profile?.email}</p>
                                        <p className="text-xs text-muted-foreground">
                                            Present: {s.total_present_days} | Absent: {s.total_absent_days} | Leaves: {s.total_leaves}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Desktop */}
                    <div className="hidden sm:block overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-border/50 bg-muted/30">
                                    <th className="p-3 text-left w-10">
                                        <Checkbox
                                            checked={selectedIds.length === setForSalarySummaries.length && setForSalarySummaries.length > 0}
                                            onCheckedChange={toggleSelectAll}
                                        />
                                    </th>
                                    <th className="p-3 text-left font-semibold text-muted-foreground">Employee</th>
                                    <th className="p-3 text-center font-semibold text-muted-foreground">Working Days</th>
                                    <th className="p-3 text-center font-semibold text-muted-foreground">Present</th>
                                    <th className="p-3 text-center font-semibold text-muted-foreground">Absent</th>
                                    <th className="p-3 text-center font-semibold text-muted-foreground">Leaves</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border/30">
                                {setForSalarySummaries.map((s: any) => (
                                    <tr key={s.id} className="hover:bg-muted/20 transition-colors">
                                        <td className="p-3">
                                            <Checkbox checked={selectedIds.includes(s.id)} onCheckedChange={() => toggleSelect(s.id)} />
                                        </td>
                                        <td className="p-3 font-medium">{s.profile?.full_name || s.profile?.email}</td>
                                        <td className="p-3 text-center">{s.total_working_days}</td>
                                        <td className="p-3 text-center font-bold text-emerald-600">{s.total_present_days}</td>
                                        <td className="p-3 text-center font-bold text-rose-600">{s.total_absent_days}</td>
                                        <td className="p-3 text-center">{s.total_leaves}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </CardShell>
            )}

            {/* Generated Payslips */}
            {payslipSummaries.length > 0 && (
                <CardShell
                    title="Generated Payslips"
                    icon={IndianRupee}
                    description="Payslips with full salary breakdown"
                    contentClassName="p-4"
                >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {payslipSummaries.map((s: any) => {
                            const bd = s.salary_breakdown as Record<string, any> | null
                            return (
                                <div
                                    key={s.id}
                                    className="p-4 rounded-xl border border-border/50 bg-muted/10 hover:bg-muted/20 transition-all cursor-pointer group"
                                    onClick={() => setViewPayslipId(s.id)}
                                >
                                    <div className="flex items-center justify-between mb-3">
                                        <div>
                                            <p className="font-bold">{s.profile?.full_name || s.profile?.email}</p>
                                            <p className="text-xs text-muted-foreground">{MONTHS[month - 1]} {year}</p>
                                        </div>
                                        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                                            Generated
                                        </Badge>
                                    </div>

                                    <div className="grid grid-cols-3 gap-2 text-xs mb-3">
                                        <div className="text-center p-2 rounded-lg bg-background/60">
                                            <p className="text-muted-foreground">Gross</p>
                                            <p className="font-bold">{formatCurrency(s.gross_salary)}</p>
                                        </div>
                                        <div className="text-center p-2 rounded-lg bg-rose-500/5">
                                            <p className="text-muted-foreground">Deductions</p>
                                            <p className="font-bold text-rose-600">{formatCurrency(Number(s.absence_deduction || 0) + Number(bd?.other_deductions || 0))}</p>
                                        </div>
                                        <div className="text-center p-2 rounded-lg bg-emerald-500/5">
                                            <p className="text-muted-foreground">Take-Home</p>
                                            <p className="font-bold text-emerald-600">{formatCurrency(s.take_home)}</p>
                                        </div>
                                    </div>

                                    {Number(s.advance_recovery) > 0 && (
                                        <div className="text-xs text-amber-600 flex items-center gap-1">
                                            <ArrowDown className="h-3 w-3" />
                                            Advance recovered: {formatCurrency(s.advance_recovery)}
                                        </div>
                                    )}

                                    <div className="flex items-center gap-1 text-xs text-primary mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Eye className="h-3 w-3" />View Full Payslip
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </CardShell>
            )}

            {/* Empty State */}
            {!isLoading && (!summaries || summaries.length === 0) && (
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

                                    <div className="space-y-1 mb-4 text-sm">
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">Employee:</span>
                                            <span className="font-semibold">{payslipDetail.profile?.full_name || payslipDetail.profile?.email}</span>
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
                                    <div className="space-y-1 text-sm">
                                        <div className="flex justify-between"><span>Basic Salary</span><span>{formatCurrency(breakdown.basic_salary)}</span></div>
                                        <div className="flex justify-between"><span>HRA</span><span>{formatCurrency(breakdown.hra)}</span></div>
                                        <div className="flex justify-between"><span>DA</span><span>{formatCurrency(breakdown.da)}</span></div>
                                        <div className="flex justify-between"><span>TA</span><span>{formatCurrency(breakdown.ta)}</span></div>
                                        <div className="flex justify-between"><span>Special Allowance</span><span>{formatCurrency(breakdown.special_allowance)}</span></div>
                                        <div className="flex justify-between"><span>Incentive</span><span>{formatCurrency(breakdown.incentive)}</span></div>
                                        <div className="flex justify-between font-bold border-t pt-1 mt-1">
                                            <span>Gross Salary</span>
                                            <span>{formatCurrency(breakdown.gross_salary)}</span>
                                        </div>
                                    </div>

                                    <Separator className="my-3" />

                                    {/* Deductions */}
                                    <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">Deductions</p>
                                    <div className="space-y-1 text-sm">
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
                                    <div className="flex justify-between font-bold text-sm">
                                        <span>Net Salary</span>
                                        <span>{formatCurrency(breakdown.net_salary)}</span>
                                    </div>

                                    {/* Advance Recovery */}
                                    {Number(breakdown.advance_recovery) > 0 && (
                                        <>
                                            <Separator className="my-3" />
                                            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">Advance Recovery</p>
                                            <div className="flex justify-between text-sm text-amber-600">
                                                <span>Advance/Loan Adjusted</span>
                                                <span>−{formatCurrency(breakdown.advance_recovery)}</span>
                                            </div>
                                        </>
                                    )}

                                    <Separator className="my-3" />

                                    {/* Take-Home */}
                                    <div className="flex justify-between font-bold text-lg p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                                        <span className="text-emerald-700">Take-Home Amount</span>
                                        <span className="text-emerald-700">{formatCurrency(breakdown.take_home)}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-end gap-2 mt-4">
                                <Button variant="outline" size="sm" onClick={handlePrint}>
                                    <Printer className="h-4 w-4 mr-1" />Print
                                </Button>
                            </div>
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    )
}
