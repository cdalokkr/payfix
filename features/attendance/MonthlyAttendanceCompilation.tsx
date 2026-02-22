"use client"

import React, { useState, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { trpc } from "@/lib/trpc/client"
import { toast } from "sonner"
import { CalendarRange, RefreshCw, CheckCircle, Loader2, ArrowRight } from "lucide-react"
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

const MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
]

export function MonthlyAttendanceCompilation({ basePath }: { basePath: string }) {
    const router = useRouter()
    const [month, setMonth] = useState(new Date().getMonth() + 1)
    const [year, setYear] = useState(new Date().getFullYear())
    const [selectedIds, setSelectedIds] = useState<string[]>([])

    const { data: summaries, isLoading, refetch } = trpc.salary.getMonthlySummaries.useQuery(
        { month, year },
        { placeholderData: (prev: any) => prev }
    )

    const compileMutation = trpc.salary.compileMonthlyAttendance.useMutation({
        onSuccess: (data) => {
            toast.success(`Compiled attendance for ${data.length} employees`)
            refetch()
        },
        onError: (err) => toast.error(err.message),
    })

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
                            {MONTHS.map((m, i) => (
                                <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Select value={String(year)} onValueChange={(val) => setYear(Number(val))}>
                        <SelectTrigger className="w-[100px]">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map(y => (
                                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Button
                        onClick={() => compileMutation.mutate({ month, year })}
                        disabled={compileMutation.isPending}
                    >
                        {compileMutation.isPending
                            ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" />Compiling...</>
                            : <><RefreshCw className="h-4 w-4 mr-1" />Compile</>
                        }
                    </Button>
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
                            {summaries.map((s: any) => (
                                <div key={s.id} className="p-4 space-y-2">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            {s.status === 'draft' && (
                                                <Checkbox
                                                    checked={selectedIds.includes(s.id)}
                                                    onCheckedChange={() => toggleSelect(s.id)}
                                                />
                                            )}
                                            <span className="font-semibold text-sm">{s.profile?.full_name || s.profile?.email}</span>
                                        </div>
                                        {statusBadge(s.status)}
                                    </div>
                                    <div className="grid grid-cols-3 gap-2 text-xs">
                                        <div className="text-center p-2 rounded-md bg-emerald-500/5">
                                            <p className="font-bold text-emerald-600">{s.total_present_days}</p>
                                            <p className="text-muted-foreground">Present</p>
                                        </div>
                                        <div className="text-center p-2 rounded-md bg-rose-500/5">
                                            <p className="font-bold text-rose-600">{s.total_absent_days}</p>
                                            <p className="text-muted-foreground">Absent</p>
                                        </div>
                                        <div className="text-center p-2 rounded-md bg-blue-500/5">
                                            <p className="font-bold text-blue-600">{s.total_leaves}</p>
                                            <p className="text-muted-foreground">Leaves</p>
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
                                        <th className="p-3 text-left font-semibold text-muted-foreground">Employee</th>
                                        <th className="p-3 text-center font-semibold text-muted-foreground">Working Days</th>
                                        <th className="p-3 text-center font-semibold text-muted-foreground">Present</th>
                                        <th className="p-3 text-center font-semibold text-muted-foreground">Absent</th>
                                        <th className="p-3 text-center font-semibold text-muted-foreground">Half Days</th>
                                        <th className="p-3 text-center font-semibold text-muted-foreground">Leaves</th>
                                        <th className="p-3 text-center font-semibold text-muted-foreground">Hours</th>
                                        <th className="p-3 text-center font-semibold text-muted-foreground">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border/30">
                                    {summaries.map((s: any) => (
                                        <tr key={s.id} className="hover:bg-muted/20 transition-colors">
                                            <td className="p-3">
                                                {s.status === 'draft' && (
                                                    <Checkbox
                                                        checked={selectedIds.includes(s.id)}
                                                        onCheckedChange={() => toggleSelect(s.id)}
                                                    />
                                                )}
                                            </td>
                                            <td className="p-3 font-medium">{s.profile?.full_name || s.profile?.email}</td>
                                            <td className="p-3 text-center">{s.total_working_days}</td>
                                            <td className="p-3 text-center">
                                                <span className="font-bold text-emerald-600">{s.total_present_days}</span>
                                            </td>
                                            <td className="p-3 text-center">
                                                <span className="font-bold text-rose-600">{s.total_absent_days}</span>
                                            </td>
                                            <td className="p-3 text-center">{s.total_half_days}</td>
                                            <td className="p-3 text-center">{s.total_leaves}</td>
                                            <td className="p-3 text-center text-muted-foreground">{s.total_working_hours || 0}h</td>
                                            <td className="p-3 text-center">{statusBadge(s.status)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}
            </CardShell>
        </div>
    )
}
