"use client"

import React, { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { trpc } from "@/lib/trpc/client"
import { toast } from "sonner"
import { IndianRupee, Plus, History, Users, Search, X, ChevronDown, ChevronUp } from "lucide-react"
import { CardShell } from "./CardShell"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"

const MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
]

export function SalarySetupManagement() {
    const [dialogOpen, setDialogOpen] = useState(false)
    const [historyDialogOpen, setHistoryDialogOpen] = useState(false)
    const [selectedProfileId, setSelectedProfileId] = useState<string>("")
    const [selectedProfileName, setSelectedProfileName] = useState<string>("")
    const [searchQuery, setSearchQuery] = useState("")
    const [expandedEmployee, setExpandedEmployee] = useState<string | null>(null)

    // Form state
    const [formData, setFormData] = useState({
        profileId: "",
        basicSalary: "",
        hra: "",
        da: "",
        ta: "",
        specialAllowance: "",
        incentive: "",
        otherDeductions: "",
        effectiveFromMonth: new Date().getMonth() + 1,
        effectiveFromYear: new Date().getFullYear(),
        changeReason: "",
    })

    const { data: salarySetups, isLoading, refetch } = trpc.salary.getSalarySetups.useQuery()
    const { data: salaryHistory } = trpc.salary.getSalaryHistory.useQuery(
        { profileId: selectedProfileId },
        { enabled: !!selectedProfileId && historyDialogOpen }
    )

    const upsertMutation = trpc.salary.upsertSalarySetup.useMutation({
        onSuccess: () => {
            toast.success("Salary setup saved successfully")
            setDialogOpen(false)
            refetch()
            resetForm()
        },
        onError: (err) => toast.error(err.message),
    })

    const resetForm = () => {
        setFormData({
            profileId: "",
            basicSalary: "",
            hra: "",
            da: "",
            ta: "",
            specialAllowance: "",
            incentive: "",
            otherDeductions: "",
            effectiveFromMonth: new Date().getMonth() + 1,
            effectiveFromYear: new Date().getFullYear(),
            changeReason: "",
        })
    }

    const handleEdit = (employee: any) => {
        const setup = employee.salary_setup
        setFormData({
            profileId: employee.id,
            basicSalary: setup?.basic_salary || "",
            hra: setup?.hra || "",
            da: setup?.da || "",
            ta: setup?.ta || "",
            specialAllowance: setup?.special_allowance || "",
            incentive: setup?.incentive || "",
            otherDeductions: setup?.other_deductions || "",
            effectiveFromMonth: new Date().getMonth() + 1,
            effectiveFromYear: new Date().getFullYear(),
            changeReason: setup ? "Salary Revision" : "Initial Setup",
        })
        setDialogOpen(true)
    }

    const handleNewSetup = (profileId: string) => {
        resetForm()
        setFormData(prev => ({ ...prev, profileId }))
        setDialogOpen(true)
    }

    const handleSubmit = () => {
        if (!formData.profileId || !formData.basicSalary) {
            toast.error("Please fill in required fields")
            return
        }
        upsertMutation.mutate(formData)
    }

    const handleViewHistory = (profileId: string, name: string) => {
        setSelectedProfileId(profileId)
        setSelectedProfileName(name)
        setHistoryDialogOpen(true)
    }

    const filteredSetups = useMemo(() => {
        if (!salarySetups) return []
        if (!searchQuery) return salarySetups
        const q = searchQuery.toLowerCase()
        return salarySetups.filter(e =>
            e.full_name?.toLowerCase().includes(q) ||
            e.email?.toLowerCase().includes(q)
        )
    }, [salarySetups, searchQuery])

    const formatCurrency = (val: string | number | null | undefined) => {
        const num = Number(val) || 0
        return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(num)
    }

    const getGrossSalary = (setup: any) => {
        if (!setup) return 0
        return (Number(setup.basic_salary) || 0) + (Number(setup.hra) || 0) + (Number(setup.da) || 0) +
            (Number(setup.ta) || 0) + (Number(setup.special_allowance) || 0) + (Number(setup.incentive) || 0)
    }

    return (
        <div className="space-y-6">
            {/* Header Actions */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search employees..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9"
                    />
                </div>
            </div>

            {/* Employee Salary Cards */}
            <CardShell
                title="Employee Salary Setup"
                icon={IndianRupee}
                description="Manage salary components for each employee"
                contentClassName="p-0"
            >
                {isLoading ? (
                    <div className="p-6 space-y-4">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="h-20 bg-muted/30 rounded-xl animate-pulse" />
                        ))}
                    </div>
                ) : filteredSetups.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground">
                        <Users className="h-12 w-12 mx-auto mb-3 opacity-30" />
                        <p className="font-medium">No employees found</p>
                    </div>
                ) : (
                    <div className="divide-y divide-border/50">
                        {filteredSetups.map((employee) => {
                            const setup = employee.salary_setup
                            const gross = getGrossSalary(setup)
                            const isExpanded = expandedEmployee === employee.id

                            return (
                                <div key={employee.id} className="transition-colors hover:bg-muted/30">
                                    <div
                                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 cursor-pointer"
                                        onClick={() => setExpandedEmployee(isExpanded ? null : employee.id)}
                                    >
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                                                <span className="text-sm font-bold text-primary">
                                                    {(employee.full_name || employee.email)?.[0]?.toUpperCase()}
                                                </span>
                                            </div>
                                            <div className="min-w-0">
                                                <p className="font-semibold truncate">{employee.full_name || employee.email}</p>
                                                <p className="text-xs text-muted-foreground truncate">{employee.email}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3 flex-shrink-0">
                                            {setup ? (
                                                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                                                    {formatCurrency(gross)}/mo
                                                </Badge>
                                            ) : (
                                                <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20">
                                                    Not Set
                                                </Badge>
                                            )}
                                            {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                                        </div>
                                    </div>

                                    {/* Expanded Details */}
                                    {isExpanded && (
                                        <div className="px-4 pb-4 space-y-4 animate-in slide-in-from-top-2 duration-200">
                                            {setup ? (
                                                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                                                    <div className="p-3 rounded-lg bg-muted/40">
                                                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Basic</p>
                                                        <p className="text-sm font-bold">{formatCurrency(setup.basic_salary)}</p>
                                                    </div>
                                                    <div className="p-3 rounded-lg bg-muted/40">
                                                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">HRA</p>
                                                        <p className="text-sm font-bold">{formatCurrency(setup.hra)}</p>
                                                    </div>
                                                    <div className="p-3 rounded-lg bg-muted/40">
                                                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">DA</p>
                                                        <p className="text-sm font-bold">{formatCurrency(setup.da)}</p>
                                                    </div>
                                                    <div className="p-3 rounded-lg bg-muted/40">
                                                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">TA</p>
                                                        <p className="text-sm font-bold">{formatCurrency(setup.ta)}</p>
                                                    </div>
                                                    <div className="p-3 rounded-lg bg-muted/40">
                                                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Special</p>
                                                        <p className="text-sm font-bold">{formatCurrency(setup.special_allowance)}</p>
                                                    </div>
                                                    <div className="p-3 rounded-lg bg-muted/40">
                                                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Incentive</p>
                                                        <p className="text-sm font-bold">{formatCurrency(setup.incentive)}</p>
                                                    </div>
                                                    <div className="p-3 rounded-lg bg-rose-500/5">
                                                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Deductions</p>
                                                        <p className="text-sm font-bold text-rose-600">{formatCurrency(setup.other_deductions)}</p>
                                                    </div>
                                                    <div className="p-3 rounded-lg bg-primary/5 border border-primary/10">
                                                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Gross</p>
                                                        <p className="text-sm font-bold text-primary">{formatCurrency(gross)}</p>
                                                    </div>
                                                </div>
                                            ) : (
                                                <p className="text-sm text-muted-foreground">No salary setup configured yet.</p>
                                            )}

                                            <div className="flex flex-wrap gap-2">
                                                <Button
                                                    size="sm"
                                                    onClick={(e) => { e.stopPropagation(); handleEdit(employee) }}
                                                >
                                                    <IndianRupee className="h-3.5 w-3.5 mr-1" />
                                                    {setup ? "Update Salary" : "Set Salary"}
                                                </Button>
                                                {setup && (
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            handleViewHistory(employee.id, employee.full_name || employee.email)
                                                        }}
                                                    >
                                                        <History className="h-3.5 w-3.5 mr-1" />
                                                        History
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                )}
            </CardShell>

            {/* Add/Edit Salary Dialog */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <IndianRupee className="h-5 w-5 text-primary" />
                            {formData.profileId ? "Update Salary Setup" : "New Salary Setup"}
                        </DialogTitle>
                        <DialogDescription>
                            Configure salary components for the employee
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-4 py-2">
                        {!formData.profileId && (
                            <div>
                                <Label>Employee</Label>
                                <Select
                                    value={formData.profileId}
                                    onValueChange={(val) => setFormData(prev => ({ ...prev, profileId: val }))}
                                >
                                    <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
                                    <SelectContent>
                                        {salarySetups?.map(e => (
                                            <SelectItem key={e.id} value={e.id}>
                                                {e.full_name || e.email}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <Label>Basic Salary *</Label>
                                <Input type="number" value={formData.basicSalary} onChange={e => setFormData(p => ({ ...p, basicSalary: e.target.value }))} placeholder="0" />
                            </div>
                            <div>
                                <Label>HRA</Label>
                                <Input type="number" value={formData.hra} onChange={e => setFormData(p => ({ ...p, hra: e.target.value }))} placeholder="0" />
                            </div>
                            <div>
                                <Label>DA</Label>
                                <Input type="number" value={formData.da} onChange={e => setFormData(p => ({ ...p, da: e.target.value }))} placeholder="0" />
                            </div>
                            <div>
                                <Label>TA</Label>
                                <Input type="number" value={formData.ta} onChange={e => setFormData(p => ({ ...p, ta: e.target.value }))} placeholder="0" />
                            </div>
                            <div>
                                <Label>Special Allowance</Label>
                                <Input type="number" value={formData.specialAllowance} onChange={e => setFormData(p => ({ ...p, specialAllowance: e.target.value }))} placeholder="0" />
                            </div>
                            <div>
                                <Label>Incentive</Label>
                                <Input type="number" value={formData.incentive} onChange={e => setFormData(p => ({ ...p, incentive: e.target.value }))} placeholder="0" />
                            </div>
                        </div>

                        <div>
                            <Label>Other Deductions (PF, ESI, etc.)</Label>
                            <Input type="number" value={formData.otherDeductions} onChange={e => setFormData(p => ({ ...p, otherDeductions: e.target.value }))} placeholder="0" />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <Label>Effective From Month</Label>
                                <Select
                                    value={String(formData.effectiveFromMonth)}
                                    onValueChange={(val) => setFormData(p => ({ ...p, effectiveFromMonth: Number(val) }))}
                                >
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {MONTHS.map((m, i) => (
                                            <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label>Year</Label>
                                <Input
                                    type="number"
                                    value={formData.effectiveFromYear}
                                    onChange={e => setFormData(p => ({ ...p, effectiveFromYear: Number(e.target.value) }))}
                                />
                            </div>
                        </div>

                        <div>
                            <Label>Reason for Change</Label>
                            <Input
                                value={formData.changeReason}
                                onChange={e => setFormData(p => ({ ...p, changeReason: e.target.value }))}
                                placeholder="e.g. Annual Increment, Promotion"
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                        <Button onClick={handleSubmit} disabled={upsertMutation.isPending}>
                            {upsertMutation.isPending ? "Saving..." : "Save Salary"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Salary History Dialog */}
            <Dialog open={historyDialogOpen} onOpenChange={setHistoryDialogOpen}>
                <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <History className="h-5 w-5 text-primary" />
                            Salary History — {selectedProfileName}
                        </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-3">
                        {salaryHistory?.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-4">No history found</p>
                        ) : (
                            salaryHistory?.map((entry, index) => (
                                <div
                                    key={entry.id}
                                    className={`p-3 rounded-lg border ${entry.is_active ? 'border-primary/20 bg-primary/5' : 'border-border/50 bg-muted/20'}`}
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                            {entry.is_active && (
                                                <Badge className="bg-primary text-primary-foreground text-[10px]">Active</Badge>
                                            )}
                                            <Badge variant="outline" className="text-[10px]">
                                                {entry.change_reason || 'N/A'}
                                            </Badge>
                                        </div>
                                        <span className="text-[10px] text-muted-foreground">
                                            {MONTHS[(entry.effective_from_month || 1) - 1]} {entry.effective_from_year}
                                            {entry.effective_to_month ? ` → ${MONTHS[(entry.effective_to_month || 1) - 1]} ${entry.effective_to_year}` : " → Present"}
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-4 gap-2 text-xs">
                                        <div><span className="text-muted-foreground">Basic:</span> {formatCurrency(entry.basic_salary)}</div>
                                        <div><span className="text-muted-foreground">HRA:</span> {formatCurrency(entry.hra)}</div>
                                        <div><span className="text-muted-foreground">DA:</span> {formatCurrency(entry.da)}</div>
                                        <div><span className="text-muted-foreground">TA:</span> {formatCurrency(entry.ta)}</div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}
