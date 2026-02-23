"use client"

import { useState, useEffect, useRef, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { format } from "date-fns"
import { trpc } from "@/lib/trpc/client"
import { cn } from "@/lib/utils"
import {
    CircleDollarSign,
    History,
    CheckCircle2,
    Clock,
    WalletCards,
    FileText,
    CalendarCheck as CalendarCheckIcon,
    CalendarMinus as CalendarMinusIcon,
    Banknote,
    RefreshCw,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent } from "@/components/ui/card"
import { CompactMetricCard } from "@/components/dashboard/compact-metric-card"
import { DataTable } from "@/components/ui/data-table"
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header"
import { CardShell } from "./CardShell"
import { ColumnDef } from "@tanstack/react-table"

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

export function EmployeeAdvancesDashboard() {
    const today = new Date()

    // UI selections
    const [month, setMonth] = useState<number>(today.getMonth() + 1)
    const [year, setYear] = useState<number>(today.getFullYear())

    // Fetched state
    const [fetchMonth, setFetchMonth] = useState<number>(today.getMonth() + 1)
    const [fetchYear, setFetchYear] = useState<number>(today.getFullYear())

    // Async button state
    const [buttonState, setButtonState] = useState<'idle' | 'loading' | 'success'>('idle')
    const successTimerRef = useRef<NodeJS.Timeout | null>(null)

    const { data, isLoading, isFetching, refetch } = trpc.salary.getMyAdvances.useQuery({
        month: fetchMonth,
        year: fetchYear
    })

    const advances = useMemo(() => data?.advances || [], [data?.advances])
    const isDataLoading = isLoading || isFetching

    useEffect(() => {
        if (isDataLoading) {
            setButtonState('loading')
        } else {
            setButtonState((prev) => {
                if (prev === 'loading') {
                    if (successTimerRef.current) clearTimeout(successTimerRef.current)
                    successTimerRef.current = setTimeout(() => {
                        setButtonState('idle')
                    }, 2000)
                    return 'success'
                }
                return prev
            })
        }
        return () => {
            if (successTimerRef.current) clearTimeout(successTimerRef.current)
        }
    }, [isDataLoading])

    const handleGetData = () => {
        if (month === fetchMonth && year === fetchYear) {
            // Force refetch to trigger loading effect
            refetch()
        } else {
            setFetchMonth(month)
            setFetchYear(year)
        }
    }

    // Derived values for summary
    const totalAdvances = advances.reduce((sum: number, adv: any) => sum + Number(adv.amount), 0)
    const pendingAdvances = advances.filter((a: any) => a.status === 'pending').reduce((sum: number, adv: any) => sum + Number(adv.amount), 0)
    const adjustedAdvances = advances.filter((a: any) => a.status === 'adjusted').reduce((sum: number, adv: any) => sum + Number(adv.amount), 0)

    const formatCurr = (amount: number) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0,
        }).format(amount)
    }

    const months = Array.from({ length: 12 }, (_, i) => ({
        value: i + 1,
        label: format(new Date(2024, i, 1), "MMMM")
    }))

    const years = Array.from({ length: 5 }, (_, i) => year - 2 + i)

    const columns = useMemo<ColumnDef<any>[]>(() => [
        {
            accessorKey: "date",
            header: ({ column }: { column: any }) => <DataTableColumnHeader column={column} title="Date" />,
            cell: ({ row }: { row: any }) => {
                const date = row.getValue("date") as string
                return (
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg">
                            <Clock className="w-4 h-4 text-slate-500" />
                        </div>
                        <span className="font-medium">{format(new Date(date), "MMM dd, yyyy")}</span>
                    </div>
                )
            },
        },
        {
            accessorKey: "amount",
            header: ({ column }: { column: any }) => <DataTableColumnHeader column={column} title="Amount" />,
            cell: ({ row }: { row: any }) => {
                const amount = Number(row.getValue("amount"))
                return <div className="font-bold text-slate-900 dark:text-slate-100">{formatCurr(amount)}</div>
            },
        },
        {
            accessorKey: "particulars",
            header: ({ column }: { column: any }) => <DataTableColumnHeader column={column} title="Particulars" />,
            cell: ({ row }: { row: any }) => {
                return <span className="text-muted-foreground">{row.getValue("particulars") || "No details provided"}</span>
            },
        },
        {
            accessorKey: "status",
            header: ({ column }: { column: any }) => <DataTableColumnHeader column={column} title="Status" />,
            cell: ({ row }: { row: any }) => {
                const status = row.getValue("status") as string
                if (status === 'adjusted') {
                    return (
                        <Badge variant="outline" className="bg-emerald-50 text-emerald-600 border-emerald-200 gap-1.5 px-2.5 py-0.5">
                            <CheckCircle2 className="w-3 h-3" /> Adjusted
                        </Badge>
                    )
                }
                return (
                    <Badge variant="outline" className="bg-amber-50 text-amber-600 border-amber-200 gap-1.5 px-2.5 py-0.5">
                        <Clock className="w-3 h-3" /> Pending
                    </Badge>
                )
            },
        },
    ], [])

    return (
        <div className="space-y-6">
            {/* Filters Bar */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-48">
                        <Select value={month.toString()} onValueChange={(val) => setMonth(parseInt(val))}>
                            <SelectTrigger className="w-full bg-white dark:bg-slate-900 shadow-sm rounded-xl h-11 font-bold">
                                <SelectValue placeholder="Month" />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl shadow-xl">
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
                            <SelectTrigger className="w-full bg-white dark:bg-slate-900 shadow-sm rounded-xl h-11 font-bold">
                                <SelectValue placeholder="Year" />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl shadow-xl">
                                {years.map(y => (
                                    <SelectItem key={y} value={y.toString()} className="font-medium">
                                        {y}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <Button
                        onClick={handleGetData}
                        disabled={buttonState === 'loading' || isDataLoading}
                        className={cn(
                            "h-11 px-6 rounded-xl font-bold shadow-sm transition-all duration-300 min-w-[140px]",
                            buttonState === 'success'
                                ? "bg-emerald-500 hover:bg-emerald-600 text-white"
                                : "bg-primary hover:bg-primary/90 text-primary-foreground"
                        )}
                    >
                        <AnimatePresence mode="wait">
                            {buttonState === 'loading' ? (
                                <motion.div
                                    key="loading"
                                    initial={{ opacity: 0, scale: 0.8 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.8 }}
                                    className="flex items-center gap-2"
                                >
                                    <RefreshCw className="w-4 h-4 animate-spin" />
                                    <span>Fetching...</span>
                                </motion.div>
                            ) : buttonState === 'success' ? (
                                <motion.div
                                    key="success"
                                    initial={{ opacity: 0, scale: 0.8 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.8 }}
                                    className="flex items-center gap-2"
                                >
                                    <CheckCircle2 className="w-4 h-4" />
                                    <span>Updated!</span>
                                </motion.div>
                            ) : (
                                <motion.div
                                    key="idle"
                                    initial={{ opacity: 0, scale: 0.8 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.8 }}
                                    className="flex items-center gap-2"
                                >
                                    <RefreshCw className="w-4 h-4" />
                                    <span>Get Data</span>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </Button>
                </div>
            </div>

            {/* Summary Cards Row using CompactMetricCard */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <CompactMetricCard
                    label={`Total Advances (${format(new Date(fetchYear, fetchMonth - 1), 'MMM')})`}
                    value={formatCurr(totalAdvances)}
                    icon={Banknote}
                    theme="primary"
                    delay={0.1}
                    loading={isDataLoading}
                />
                <CompactMetricCard
                    label="Pending Balance"
                    value={formatCurr(pendingAdvances)}
                    icon={Clock}
                    theme="amber"
                    delay={0.15}
                    loading={isDataLoading}
                />
                <CompactMetricCard
                    label="Adjusted (Settled)"
                    value={formatCurr(adjustedAdvances)}
                    icon={CheckCircle2}
                    theme="emerald"
                    delay={0.2}
                    loading={isDataLoading}
                />
            </div>

            {/* Advanced List Desktop - DataTable */}
            <CardShell
                title="Transaction History"
                description={`Showing requested advance logs for ${format(new Date(fetchYear, fetchMonth - 1), 'MMMM yyyy')}`}
                icon={History}
                contentClassName="p-0 overflow-auto"
            >
                <div className="w-full overflow-hidden [&_th]:px-2 [&_td]:px-2 [&_th:first-child]:pl-4 [&_td:first-child]:pl-4 [&_th:last-child]:pr-4 [&_td:last-child]:pr-4 [&_td]:text-xs [&_th]:text-[10px] [&_th]:uppercase [&_th]:tracking-wider">
                    <DataTable
                        columns={columns}
                        data={advances}
                        isLoading={isDataLoading}
                        emptyIcon={<History className="size-10 text-muted-foreground/20" />}
                        emptyMessage="No advances or loans recorded for this month."
                    />
                </div>
            </CardShell>
        </div>
    )
}
