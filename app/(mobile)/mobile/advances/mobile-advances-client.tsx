"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { format } from "date-fns"
import { trpc } from "@/lib/trpc/client"
import { MobileHeader } from "@/app/(mobile)/mobile-header"
import {
    CircleDollarSign,
    Calendar,
    CalendarDays,
    FileText,
    History,
    CheckCircle2,
    Clock,
    WalletCards,
    ChevronLeft,
    Wallet
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import Link from "next/link"

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

export function MobileAdvancesClient({ profile }: { profile: any }) {
    const today = new Date()
    const [month, setMonth] = useState<number>(today.getMonth() + 1)
    const [year, setYear] = useState<number>(today.getFullYear())

    const { data, isLoading } = trpc.salary.getMyAdvances.useQuery({ month, year })
    const advances = data?.advances || []

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

    return (
        <div className="flex flex-col min-h-[100dvh] bg-slate-50 dark:bg-slate-950 pb-20">
            {/* Header */}
            <header className="sticky top-0 z-50 bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between px-4 h-16">
                    <Link href="/mobile">
                        <Button variant="ghost" size="icon" className="rounded-full shrink-0">
                            <ChevronLeft className="w-6 h-6" />
                        </Button>
                    </Link>
                    <div className="flex items-center gap-2">
                        <Wallet className="w-5 h-5 text-emerald-500" />
                        <h1 className="text-lg font-black tracking-tight">My Advances</h1>
                    </div>
                    <div className="w-10"></div>
                </div>
            </header>

            <main className="flex-1 overflow-y-auto p-4 space-y-6">

                {/* Summary Card */}
                <motion.div variants={itemVars} initial="hidden" animate="show">
                    <div className="relative overflow-hidden rounded-[1.5rem] bg-gradient-to-br from-emerald-500 to-teal-600 p-5 text-white shadow-xl shadow-emerald-500/20">
                        {/* Glass Decorations */}
                        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-xl" />
                        <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full -ml-12 -mb-12 blur-lg" />

                        <div className="relative">
                            <div className="flex items-center gap-2 mb-4 opacity-90">
                                <WalletCards className="w-4 h-4" />
                                <span className="text-xs font-black uppercase tracking-widest">Balance Summary</span>
                            </div>
                            <div className="flex items-end gap-2 mb-6">
                                <span className="text-3xl font-black tracking-tighter leading-none">
                                    {formatCurr(totalAdvances)}
                                </span>
                                <span className="text-sm font-medium opacity-80 mb-1">Total {format(new Date(year, month - 1), 'MMM yyyy')}</span>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-white/10 rounded-xl p-3 backdrop-blur-md border border-white/20">
                                    <div className="flex items-center gap-1.5 mb-1 opacity-80">
                                        <Clock className="w-3.5 h-3.5" />
                                        <span className="text-[10px] font-bold uppercase tracking-wider">Pending</span>
                                    </div>
                                    <span className="font-bold">{formatCurr(pendingAdvances)}</span>
                                </div>
                                <div className="bg-black/10 rounded-xl p-3 backdrop-blur-md border border-black/10">
                                    <div className="flex items-center gap-1.5 mb-1 opacity-80">
                                        <CheckCircle2 className="w-3.5 h-3.5" />
                                        <span className="text-[10px] font-bold uppercase tracking-wider">Adjusted</span>
                                    </div>
                                    <span className="font-bold">{formatCurr(adjustedAdvances)}</span>
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

                {/* List */}
                <div className="space-y-4 pt-2">
                    <div className="flex items-center justify-between px-1">
                        <h2 className="text-xs font-black uppercase tracking-widest text-slate-500">History</h2>
                        <Badge variant="secondary" className="bg-slate-200/50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-black rounded-lg">
                            {advances.length} Entries
                        </Badge>
                    </div>

                    {isLoading ? (
                        <div className="space-y-3">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="bg-slate-200/50 dark:bg-slate-800/50 animate-pulse h-28 rounded-2xl" />
                            ))}
                        </div>
                    ) : advances.length === 0 ? (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="bg-white dark:bg-slate-900 border dark:border-slate-800 rounded-[1.5rem] p-8 text-center flex flex-col items-center justify-center min-h-[200px]"
                        >
                            <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
                                <History className="w-8 h-8 text-slate-400" />
                            </div>
                            <h3 className="text-base font-black text-slate-900 dark:text-white mb-1">No Advances Found</h3>
                            <p className="text-[13px] font-medium text-slate-500 max-w-[200px] leading-snug">
                                Try changing the month or year to find older transactions.
                            </p>
                        </motion.div>
                    ) : (
                        <motion.div variants={containerVars} initial="hidden" animate="show" className="space-y-3">
                            <AnimatePresence>
                                {advances.map((advance: any) => (
                                    <motion.div
                                        key={advance.id}
                                        variants={itemVars}
                                        className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-800/50"
                                    >
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="flex items-center gap-2">
                                                <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center shrink-0">
                                                    <CircleDollarSign className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                                                </div>
                                                <div>
                                                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Date</div>
                                                    <div className="text-sm font-black text-slate-900 dark:text-white leading-none">
                                                        {format(new Date(advance.date), "dd MMM yyyy")}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Amount</div>
                                                <div className="text-lg font-black text-slate-900 dark:text-white tracking-tight leading-none">
                                                    {formatCurr(Number(advance.amount))}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-start gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                                            <div className="mt-0.5">
                                                <FileText className="w-3.5 h-3.5 text-slate-400" />
                                            </div>
                                            <p className="text-[13px] font-medium text-slate-600 dark:text-slate-400 leading-snug flex-1">
                                                {advance.particulars}
                                            </p>
                                        </div>

                                        <div className="mt-3 flex justify-end">
                                            {advance.status === 'adjusted' ? (
                                                <Badge variant="outline" className="border-emerald-200 text-emerald-600 bg-emerald-50/50 font-bold uppercase tracking-widest text-[9px] py-1 px-2 rounded-lg gap-1">
                                                    <CheckCircle2 className="w-3 h-3" /> Adjusted
                                                </Badge>
                                            ) : (
                                                <Badge variant="outline" className="border-amber-200 text-amber-600 bg-amber-50/50 font-bold uppercase tracking-widest text-[9px] py-1 px-2 rounded-lg gap-1">
                                                    <Clock className="w-3 h-3" /> Pending
                                                </Badge>
                                            )}
                                        </div>
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                        </motion.div>
                    )}
                </div>
            </main>
        </div>
    )
}
