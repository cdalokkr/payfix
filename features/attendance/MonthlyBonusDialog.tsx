"use client"

import React, { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { trpc } from "@/lib/trpc/client"
import { toast } from "sonner"
import { Sparkles, Gift, Users, IndianRupee, Trash2, CheckCircle2, Search, Edit3 } from "lucide-react"
import { UserAvatarProfile } from "@/components/user-avatar-profile"

interface MonthlyBonusDialogProps {
    isOpen: boolean
    onOpenChange: (open: boolean) => void
    month: number
    year: number
    onSuccess?: () => void
}

const MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
]

const PRESET_TITLES = [
    "Diwali Bonus",
    "Festival Bonus",
    "Monthly Incentive",
    "Performance Bonus",
    "Quarterly Bonus",
    "Attendance Incentive"
]

export function MonthlyBonusDialog({
    isOpen,
    onOpenChange,
    month,
    year,
    onSuccess
}: MonthlyBonusDialogProps) {
    const utils = trpc.useUtils()
    const [activeTab, setActiveTab] = useState<"bulk" | "individual">("bulk")
    
    // Bulk Form State
    const [bulkTitle, setBulkTitle] = useState("Festival Bonus")
    const [customTitle, setCustomTitle] = useState("")
    const [bulkAmount, setBulkAmount] = useState("")
    const [bulkRemarks, setBulkRemarks] = useState("")

    // Individual State
    const [searchQuery, setSearchQuery] = useState("")
    const [editingUserId, setEditingUserId] = useState<string | null>(null)
    const [editAmount, setEditAmount] = useState("")
    const [editTitle, setEditTitle] = useState("")

    // Fetch active employees for total count
    const { data: activeEmployees } = trpc.salary.getActiveEmployeesForCompilation.useQuery(undefined, {
        enabled: isOpen,
    })

    // Fetch existing bonuses for this month
    const { data: existingBonuses, isLoading: bonusesLoading, refetch: refetchBonuses } = trpc.salary.getMonthlyBonuses.useQuery(
        { month, year },
        { enabled: isOpen }
    )

    // Mutations
    const bulkMutation = trpc.salary.setBulkMonthlyBonus.useMutation({
        onSuccess: (data) => {
            toast.success(`Successfully assigned bonus to ${data.length} staff members!`)
            refetchBonuses()
            utils.salary.getMonthlySummaries.invalidate({ month, year })
            onSuccess?.()
        },
        onError: (err) => toast.error(err.message || "Failed to set bulk bonus")
    })

    const individualMutation = trpc.salary.upsertIndividualBonus.useMutation({
        onSuccess: () => {
            toast.success("Staff bonus updated successfully")
            setEditingUserId(null)
            refetchBonuses()
            utils.salary.getMonthlySummaries.invalidate({ month, year })
            onSuccess?.()
        },
        onError: (err) => toast.error(err.message || "Failed to update bonus")
    })

    const deleteMutation = trpc.salary.deleteMonthlyBonus.useMutation({
        onSuccess: () => {
            toast.success("Bonus removed successfully")
            refetchBonuses()
            utils.salary.getMonthlySummaries.invalidate({ month, year })
            onSuccess?.()
        },
        onError: (err) => toast.error(err.message || "Failed to remove bonus")
    })

    const effectiveTitle = bulkTitle === "Custom" ? customTitle : bulkTitle
    const totalStaffCount = activeEmployees?.length || 0
    const parsedAmount = parseFloat(bulkAmount) || 0
    const totalDisbursement = parsedAmount * totalStaffCount

    const handleApplyBulk = () => {
        if (!effectiveTitle.trim()) {
            toast.error("Please enter a bonus title")
            return
        }
        if (parsedAmount <= 0) {
            toast.error("Please enter a valid bonus amount greater than 0")
            return
        }

        bulkMutation.mutate({
            month,
            year,
            title: effectiveTitle.trim(),
            amount: parsedAmount,
            remarks: bulkRemarks.trim() || undefined,
            bonusType: 'festival_bonus'
        })
    }

    const handleSaveIndividual = (profileId: string) => {
        const amt = parseFloat(editAmount)
        if (isNaN(amt) || amt < 0) {
            toast.error("Please enter a valid amount")
            return
        }
        individualMutation.mutate({
            profileId,
            month,
            year,
            amount: amt,
            title: editTitle.trim() || "Monthly Bonus",
            bonusType: 'incentive'
        })
    }

    // Filter employees for Tab 2
    const filteredEmployees = (activeEmployees || []).filter(e => {
        const query = searchQuery.toLowerCase()
        return (e.full_name || '').toLowerCase().includes(query) || (e.email || '').toLowerCase().includes(query)
    })

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl p-6 sm:p-7 bg-white dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 shadow-2xl">
                <DialogHeader className="space-y-2">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shadow-inner">
                            <Sparkles className="w-5 h-5" />
                        </div>
                        <div>
                            <DialogTitle className="text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                                Monthly Bonus & Incentive
                                <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 font-semibold px-2 py-0.5 text-xs">
                                    {MONTHS[month - 1]} {year}
                                </Badge>
                            </DialogTitle>
                            <DialogDescription className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                                Allocate bonus or incentives to all staff in 1-click or customize individual amounts. Appears on that month&apos;s payslip.
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <Tabs value={activeTab} onValueChange={(val: any) => setActiveTab(val)} className="mt-4">
                    <TabsList className="grid grid-cols-2 p-1 bg-slate-100 dark:bg-slate-900 rounded-2xl">
                        <TabsTrigger value="bulk" className="rounded-xl font-bold text-xs sm:text-sm gap-2">
                            <Gift className="w-4 h-4 text-amber-500" />
                            1-Click Bulk to All Staff
                        </TabsTrigger>
                        <TabsTrigger value="individual" className="rounded-xl font-bold text-xs sm:text-sm gap-2">
                            <Users className="w-4 h-4 text-indigo-500" />
                            Individual Adjustments ({existingBonuses?.length || 0})
                        </TabsTrigger>
                    </TabsList>

                    {/* TAB 1: 1-CLICK BULK BONUS */}
                    <TabsContent value="bulk" className="space-y-5 pt-3">
                        <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-50/60 to-orange-50/40 dark:from-amber-950/20 dark:to-orange-950/10 border border-amber-200/60 dark:border-amber-800/40 space-y-4">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                                    <Gift className="w-3.5 h-3.5" /> Target Recipients
                                </span>
                                <Badge className="bg-amber-600 text-white font-black text-xs px-2.5 py-0.5">
                                    {totalStaffCount} Active Staff
                                </Badge>
                            </div>
                            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                                This will apply the bonus amount to <strong>all active employees and moderators</strong> for the month of <strong>{MONTHS[month - 1]} {year}</strong>. It will automatically reflect in each user&apos;s payslip income details.
                            </p>
                        </div>

                        {/* Bonus Title Selection */}
                        <div className="space-y-2">
                            <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                Bonus Title / Occasion
                            </Label>
                            <div className="flex flex-wrap gap-2">
                                {PRESET_TITLES.map((t) => (
                                    <button
                                        key={t}
                                        type="button"
                                        onClick={() => {
                                            setBulkTitle(t)
                                        }}
                                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                                            bulkTitle === t
                                                ? "bg-amber-500 text-white shadow-md shadow-amber-500/20"
                                                : "bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300"
                                        }`}
                                    >
                                        {t}
                                    </button>
                                ))}
                                <button
                                    type="button"
                                    onClick={() => setBulkTitle("Custom")}
                                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                                        bulkTitle === "Custom"
                                            ? "bg-amber-500 text-white shadow-md shadow-amber-500/20"
                                            : "bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300"
                                    }`}
                                >
                                    + Custom Title
                                </button>
                            </div>

                            {bulkTitle === "Custom" && (
                                <Input
                                    value={customTitle}
                                    onChange={(e) => setCustomTitle(e.target.value)}
                                    placeholder="e.g. Founder's Day Special Bonus"
                                    className="mt-2 rounded-xl"
                                />
                            )}
                        </div>

                        {/* Amount per person */}
                        <div className="space-y-2">
                            <Label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                                Bonus Amount per Person (<IndianRupee className="w-3 h-3" />)
                            </Label>
                            <div className="relative">
                                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₹</span>
                                <Input
                                    type="number"
                                    min="0"
                                    step="100"
                                    value={bulkAmount}
                                    onChange={(e) => setBulkAmount(e.target.value)}
                                    placeholder="e.g. 3000"
                                    className="pl-8 rounded-xl font-bold text-base h-11"
                                />
                            </div>
                        </div>

                        {/* Optional Remarks */}
                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold text-slate-500">Remarks / Note (Optional)</Label>
                            <Input
                                value={bulkRemarks}
                                onChange={(e) => setBulkRemarks(e.target.value)}
                                placeholder="e.g. Festive gift on occasion of Diwali"
                                className="rounded-xl text-xs"
                            />
                        </div>

                        {/* Total Projection Card */}
                        {parsedAmount > 0 && totalStaffCount > 0 && (
                            <div className="p-3.5 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200/70 dark:border-emerald-800/40 flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                                        Estimated Total Payout
                                    </span>
                                    <p className="text-xs text-slate-600 dark:text-slate-400">
                                        {totalStaffCount} staff × ₹{parsedAmount.toLocaleString("en-IN")}
                                    </p>
                                </div>
                                <span className="text-lg font-black text-emerald-700 dark:text-emerald-300">
                                    ₹{totalDisbursement.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                                </span>
                            </div>
                        )}

                        <Button
                            onClick={handleApplyBulk}
                            disabled={bulkMutation.isPending || parsedAmount <= 0}
                            className="w-full h-11 rounded-2xl font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-lg shadow-amber-600/20 gap-2"
                        >
                            {bulkMutation.isPending ? "Applying to All Staff..." : `Apply ₹${parsedAmount || 0} Bonus to All ${totalStaffCount} Staff`}
                        </Button>
                    </TabsContent>

                    {/* TAB 2: INDIVIDUAL STAFF ADJUSTMENTS */}
                    <TabsContent value="individual" className="space-y-4 pt-3">
                        <div className="relative">
                            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                            <Input
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search employee or moderator by name/email..."
                                className="pl-9 rounded-2xl text-xs h-10"
                            />
                        </div>

                        <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[360px] overflow-y-auto pr-1">
                            {filteredEmployees.map((emp) => {
                                const currentBonus = existingBonuses?.find(b => b.profile_id === emp.id)
                                const isEditing = editingUserId === emp.id

                                return (
                                    <div key={emp.id} className="py-3 flex items-center justify-between gap-3">
                                        <div className="flex items-center gap-2.5 min-w-0">
                                            <UserAvatarProfile user={emp} className="h-8 w-8 shrink-0" />
                                            <div className="min-w-0">
                                                <div className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white truncate flex items-center gap-1.5">
                                                    {emp.full_name}
                                                    <Badge variant="outline" className="text-[10px] uppercase font-bold py-0 px-1.5">
                                                        {emp.role || 'staff'}
                                                    </Badge>
                                                </div>
                                                <div className="text-[11px] text-slate-500 truncate">{emp.email}</div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2 shrink-0">
                                            {isEditing ? (
                                                <div className="flex items-center gap-1.5">
                                                    <Input
                                                        type="number"
                                                        value={editAmount}
                                                        onChange={(e) => setEditAmount(e.target.value)}
                                                        placeholder="₹"
                                                        className="w-24 h-8 rounded-xl text-xs font-bold"
                                                    />
                                                    <Button
                                                        size="sm"
                                                        onClick={() => handleSaveIndividual(emp.id)}
                                                        disabled={individualMutation.isPending}
                                                        className="h-8 px-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold"
                                                    >
                                                        Save
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        onClick={() => setEditingUserId(null)}
                                                        className="h-8 px-2 rounded-xl text-xs"
                                                    >
                                                        Cancel
                                                    </Button>
                                                </div>
                                            ) : (
                                                <>
                                                    {currentBonus ? (
                                                        <div className="text-right">
                                                            <div className="font-black text-xs sm:text-sm text-emerald-700 dark:text-emerald-400">
                                                                +₹{Number(currentBonus.amount).toLocaleString("en-IN")}
                                                            </div>
                                                            <div className="text-[10px] text-slate-400 font-semibold truncate max-w-[120px]">
                                                                {currentBonus.title}
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <span className="text-xs text-slate-400 italic">No bonus</span>
                                                    )}

                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => {
                                                            setEditingUserId(emp.id)
                                                            setEditAmount(currentBonus ? String(currentBonus.amount) : "")
                                                            setEditTitle(currentBonus ? currentBonus.title : "Monthly Incentive")
                                                        }}
                                                        className="h-8 w-8 p-0 rounded-xl text-slate-500 hover:text-slate-900 dark:hover:text-white"
                                                    >
                                                        <Edit3 className="w-3.5 h-3.5" />
                                                    </Button>

                                                    {currentBonus && (
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => deleteMutation.mutate({ id: currentBonus.id })}
                                                            disabled={deleteMutation.isPending}
                                                            className="h-8 w-8 p-0 rounded-xl text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </Button>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    </div>
                                )
                            })}

                            {filteredEmployees.length === 0 && (
                                <div className="py-8 text-center text-xs text-slate-400">
                                    No staff found matching &quot;{searchQuery}&quot;
                                </div>
                            )}
                        </div>
                    </TabsContent>
                </Tabs>
            </DialogContent>
        </Dialog>
    )
}
