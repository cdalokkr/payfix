"use client"

import React, { useState, useMemo, useRef, useEffect, useCallback } from "react"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { trpc } from "@/lib/trpc/client"
import { toast } from "sonner"
import { IndianRupee, History, Users, Search, X, ChevronDown, ChevronUp, CheckCircle2, FileText, Clock, LayersPlus, Briefcase, Phone, CopyCheck, CalendarIcon } from "lucide-react"
import { CardShell } from "./CardShell"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    Accordion,
    AccordionItem,
    AccordionTrigger,
    AccordionContent,
} from "@/components/ui/accordion"
import { Calendar } from "@/components/ui/calendar"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { CompactMetricCard } from "@/components/dashboard/compact-metric-card"
import CreateUserButton from "@/components/ui/create-user-button"
import { CancelButton } from "@/components/ui/action-button"
import {
    Field,
    FieldLabel,
    FieldError,
} from "@/components/ui/field"
import { UserAvatarProfile } from "@/components/user-avatar-profile"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"

const MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
]

const salarySetupSchema = z.object({
    profileId: z.string().uuid("Please select an employee"),
    basicSalary: z.string().refine((val) => !isNaN(Number(val)) && Number(val) >= 0, { message: "Invalid basic salary" }),
    hra: z.string(),
    da: z.string(),
    ta: z.string(),
    specialAllowance: z.string(),
    incentive: z.string(),
    otherDeductions: z.string(),
    deductionRemark: z.string().optional(),
    effectiveFromMonth: z.number().min(1).max(12),
    effectiveFromYear: z.number().min(2000),
    changeReason: z.string().optional(),
})

type SalarySetupFormValues = z.infer<typeof salarySetupSchema>

export function SalarySetupManagement() {
    const [sheetOpen, setSheetOpen] = useState(false)
    const [historyDialogOpen, setHistoryDialogOpen] = useState(false)
    const [selectedProfileId, setSelectedProfileId] = useState<string>("")
    const [selectedProfileName, setSelectedProfileName] = useState<string>("")
    const [searchQuery, setSearchQuery] = useState("")
    const [filterStatus, setFilterStatus] = useState<string>("all")
    const [expandedEmployee, setExpandedEmployee] = useState<string | null>(null)
    const [editingId, setEditingId] = useState<string | null>(null)

    const [buttonAsyncState, setButtonAsyncState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
    const successTimerRef = useRef<NodeJS.Timeout | null>(null)
    const searchInputRef = useRef<HTMLInputElement>(null)

    const form = useForm<SalarySetupFormValues>({
        resolver: zodResolver(salarySetupSchema),
        defaultValues: {
            profileId: "",
            basicSalary: "",
            hra: "",
            da: "",
            ta: "",
            specialAllowance: "",
            incentive: "",
            otherDeductions: "",
            deductionRemark: "",
            effectiveFromMonth: new Date().getMonth() + 1,
            effectiveFromYear: new Date().getFullYear(),
            changeReason: "",
        },
    })

    const { control, handleSubmit, reset, watch, setValue, formState: { errors } } = form
    const formProfileId = watch("profileId")

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault()
                searchInputRef.current?.focus()
            }
        }
        document.addEventListener('keydown', handleKeyDown)
        return () => document.removeEventListener('keydown', handleKeyDown)
    }, [])

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && sheetOpen) {
                e.preventDefault()
                handleSubmit(onSubmit)()
            }
        }
        document.addEventListener('keydown', handleKeyDown)
        return () => document.removeEventListener('keydown', handleKeyDown)
    }, [sheetOpen, handleSubmit])

    useEffect(() => {
        return () => {
            if (successTimerRef.current) clearTimeout(successTimerRef.current)
        }
    }, [])

    const { data: salarySetups, isLoading, refetch } = trpc.salary.getSalarySetups.useQuery()
    const { data: salaryHistory } = trpc.salary.getSalaryHistory.useQuery(
        { profileId: selectedProfileId },
        { enabled: !!selectedProfileId && historyDialogOpen }
    )

    const upsertMutation = trpc.salary.upsertSalarySetup.useMutation({
        onSuccess: () => {
            setButtonAsyncState('success')
            toast.success("Salary setup saved successfully")

            if (successTimerRef.current) clearTimeout(successTimerRef.current)
            successTimerRef.current = setTimeout(() => {
                setButtonAsyncState('idle')
                setSheetOpen(false)
            }, 1000)

            refetch()
        },
        onError: (err) => {
            setButtonAsyncState('error')
            toast.error(err.message)
            if (successTimerRef.current) clearTimeout(successTimerRef.current)
            successTimerRef.current = setTimeout(() => {
                setButtonAsyncState('idle')
            }, 3000)
        },
    })

    const onSubmit = async (data: SalarySetupFormValues) => {
        setButtonAsyncState('loading')
        await upsertMutation.mutateAsync(data)
    }

    const resetForm = useCallback(() => {
        reset({
            profileId: "",
            basicSalary: "",
            hra: "",
            da: "",
            ta: "",
            specialAllowance: "",
            incentive: "",
            otherDeductions: "",
            deductionRemark: "",
            effectiveFromMonth: new Date().getMonth() + 1,
            effectiveFromYear: new Date().getFullYear(),
            changeReason: "",
        })
    }, [reset])

    const handleSheetClose = useCallback(() => {
        setSheetOpen(false)
        setEditingId(null)
        setButtonAsyncState('idle')
        if (successTimerRef.current) clearTimeout(successTimerRef.current)
        resetForm()
    }, [resetForm])

    const handleEdit = (employee: any) => {
        const setup = employee.salary_setup
        setEditingId(employee.id)
        reset({
            profileId: employee.id,
            basicSalary: setup?.basic_salary ? String(setup.basic_salary) : "",
            hra: setup?.hra ? String(setup.hra) : "",
            da: setup?.da ? String(setup.da) : "",
            ta: setup?.ta ? String(setup.ta) : "",
            specialAllowance: setup?.special_allowance ? String(setup.special_allowance) : "",
            incentive: setup?.incentive ? String(setup.incentive) : "",
            otherDeductions: setup?.other_deductions ? String(setup.other_deductions) : "",
            deductionRemark: setup?.deduction_remark ? String(setup.deduction_remark) : "",
            effectiveFromMonth: setup?.effective_from_month || new Date().getMonth() + 1,
            effectiveFromYear: setup?.effective_from_year || new Date().getFullYear(),
            changeReason: setup?.change_reason || (setup ? "Salary Revision" : "Initial Setup"),
        })
        setSheetOpen(true)
    }

    const handleNewSetup = useCallback(() => {
        setEditingId(null)
        resetForm()
        setSheetOpen(true)
    }, [resetForm])

    const handleViewHistory = (profileId: string, name: string) => {
        setSelectedProfileId(profileId)
        setSelectedProfileName(name)
        setHistoryDialogOpen(true)
    }

    const getGrossSalary = (setup: any) => {
        if (!setup) return 0
        return (Number(setup.basic_salary) || 0) + (Number(setup.hra) || 0) + (Number(setup.da) || 0) +
            (Number(setup.ta) || 0) + (Number(setup.special_allowance) || 0) + (Number(setup.incentive) || 0)
    }

    const filteredSetups = useMemo(() => {
        if (!salarySetups) return []
        let result = salarySetups

        if (filterStatus === 'configured') {
            result = result.filter(e => !!e.salary_setup)
        } else if (filterStatus === 'pending') {
            result = result.filter(e => !e.salary_setup)
        }

        if (searchQuery) {
            const q = searchQuery.toLowerCase()
            result = result.filter(e =>
                e.full_name?.toLowerCase().includes(q) ||
                e.email?.toLowerCase().includes(q)
            )
        }
        return result
    }, [salarySetups, searchQuery, filterStatus])

    const stats = useMemo(() => {
        if (!filteredSetups) return { all: 0, configured: 0, pending: 0, totalPayout: 0 }
        let configured = 0
        let totalPayout = 0
        filteredSetups.forEach(e => {
            const setup = e.salary_setup
            if (setup) {
                configured++
                totalPayout += getGrossSalary(setup)
            }
        })
        return {
            all: filteredSetups.length,
            configured,
            pending: filteredSetups.length - configured,
            totalPayout
        }
    }, [filteredSetups])

    const formatCurrency = (val: string | number | null | undefined) => {
        const num = Number(val) || 0
        return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(num)
    }

    const selectedEmployee = salarySetups?.find(e => e.id === formProfileId)

    return (
        <div className="space-y-6">
            {/* ── Metric Cards ─────────────────────────────────────── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <CompactMetricCard
                    label="Total Employees"
                    value={stats.all}
                    icon={Users}
                    theme="blue"
                    delay={0.1}
                    loading={isLoading}
                />
                <CompactMetricCard
                    label="Configured Setup"
                    value={stats.configured}
                    icon={CheckCircle2}
                    theme="green"
                    delay={0.2}
                    loading={isLoading}
                />
                <CompactMetricCard
                    label="Pending Setup"
                    value={stats.pending}
                    icon={Clock}
                    theme="amber"
                    delay={0.3}
                    loading={isLoading}
                />
                <CompactMetricCard
                    label="Total Payout/Mo"
                    value={stats.totalPayout > 0 ? formatCurrency(stats.totalPayout) : "0"}
                    icon={IndianRupee}
                    theme="purple"
                    delay={0.4}
                    loading={isLoading}
                />
            </div>

            {/* Main Content Card */}
            <CardShell
                title="Employee Salary Overview"
                description="Manage salary components for each employee"
                icon={IndianRupee}
                contentClassName="min-h-0 p-6 pt-2 h-full overflow-auto"
            >
                {/* Actions & FiltersToolbar */}
                <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center py-2 mb-4">
                    <div className="relative w-full max-w-sm group">
                        <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                            <Search className="h-4 w-4 text-muted-foreground group-focus-within:text-blue-500 transition-colors" />
                        </div>
                        <Input
                            ref={searchInputRef}
                            placeholder="Search employees... (Cmd/Ctrl+K)"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9 pr-14 shadow-sm transition-all focus-visible:ring-blue-500/30"
                        />
                        <div className="absolute inset-y-0 right-3 flex items-center gap-1.5 pointer-events-none">
                            {!searchQuery && (
                                <kbd className="hidden sm:inline-flex h-5 items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-60">
                                    <span className="text-xs">⌘</span>K
                                </kbd>
                            )}
                        </div>
                        {searchQuery && (
                            <Button
                                variant="ghost"
                                size="sm"
                                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent text-muted-foreground hover:text-foreground transition-colors"
                                onClick={() => setSearchQuery("")}
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <label className="text-sm font-medium whitespace-nowrap">Status:</label>
                        <Select value={filterStatus} onValueChange={setFilterStatus}>
                            <SelectTrigger className="w-40">
                                <SelectValue placeholder="All Status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Records</SelectItem>
                                <SelectItem value="configured">Configured Only</SelectItem>
                                <SelectItem value="pending">Pending Only</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="sm:ml-auto w-full sm:w-auto mt-2 sm:mt-0">
                        <CreateUserButton
                            onClick={handleNewSetup}
                            size="md"
                            className="w-full sm:w-auto"
                        >
                            New Setup
                        </CreateUserButton>
                    </div>
                </div>

                {isLoading ? (
                    <div className="space-y-4">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="h-20 bg-muted/30 rounded-xl animate-pulse" />
                        ))}
                    </div>
                ) : filteredSetups.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground border border-dashed rounded-xl mt-4">
                        <motion.div
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ duration: 0.5, type: "spring", bounce: 0.4 }}
                            className="h-20 w-20 bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100/50 rounded-full flex items-center justify-center mx-auto mb-5 shadow-inner"
                        >
                            <FileText className="h-8 w-8 text-blue-500 opacity-60" />
                        </motion.div>
                        <p className="font-medium text-lg text-foreground/80">No employees found</p>
                        <p className="text-sm mt-1">Adjust filters or search parameters</p>
                    </div>
                ) : (
                    <div className="border rounded-xl divide-y overflow-hidden shadow-sm">
                        {filteredSetups.map((employee) => {
                            const setup = employee.salary_setup
                            const gross = getGrossSalary(setup)
                            const isExpanded = expandedEmployee === employee.id

                            return (
                                <div key={employee.id} className="transition-colors hover:bg-muted/30 bg-card">
                                    <div
                                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 cursor-pointer select-none"
                                        onClick={() => setExpandedEmployee(isExpanded ? null : employee.id)}
                                    >
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className={cn(
                                                "h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0 transition-colors shadow-sm",
                                                setup ? "bg-primary/10 text-primary" : "bg-muted/50 text-muted-foreground"
                                            )}>
                                                <span className="text-sm font-bold uppercase">
                                                    {(employee.full_name || employee.email)?.[0]}
                                                </span>
                                            </div>
                                            <div className="min-w-0">
                                                <p className="font-semibold truncate leading-tight">{employee.full_name || employee.email}</p>
                                                <div className="flex items-center gap-1.5 mt-0.5">
                                                    <span className="text-xs text-muted-foreground truncate">{employee.email}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3 flex-shrink-0 mt-2 sm:mt-0">
                                            {setup ? (
                                                <div className="flex flex-col items-end">
                                                    <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20 font-black tracking-tight rounded-md px-2">
                                                        {formatCurrency(gross)} / mo
                                                    </Badge>
                                                    <span className="text-[10px] text-muted-foreground font-medium mt-1">Configured</span>
                                                </div>
                                            ) : (
                                                <Badge variant="outline" className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20 rounded-md">
                                                    Pending Setup
                                                </Badge>
                                            )}
                                            <div className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-muted/50 transition-colors">
                                                {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Expanded Details */}
                                    <AnimatePresence>
                                        {isExpanded && (
                                            <motion.div
                                                initial={{ opacity: 0, height: 0 }}
                                                animate={{ opacity: 1, height: "auto" }}
                                                exit={{ opacity: 0, height: 0 }}
                                                className="overflow-hidden bg-muted/10 border-t"
                                            >
                                                <div className="px-4 pb-4 pt-3 space-y-4">
                                                    {setup ? (
                                                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                                                            <div className="p-3 rounded-lg bg-background border shadow-sm">
                                                                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Basic</p>
                                                                <p className="text-sm font-bold">{formatCurrency(setup.basic_salary)}</p>
                                                            </div>
                                                            <div className="p-3 rounded-lg bg-background border shadow-sm">
                                                                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">HRA</p>
                                                                <p className="text-sm font-bold">{formatCurrency(setup.hra)}</p>
                                                            </div>
                                                            <div className="p-3 rounded-lg bg-background border shadow-sm">
                                                                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">DA</p>
                                                                <p className="text-sm font-bold">{formatCurrency(setup.da)}</p>
                                                            </div>
                                                            <div className="p-3 rounded-lg bg-background border shadow-sm">
                                                                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">TA</p>
                                                                <p className="text-sm font-bold">{formatCurrency(setup.ta)}</p>
                                                            </div>
                                                            <div className="p-3 rounded-lg bg-background border shadow-sm">
                                                                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Special</p>
                                                                <p className="text-sm font-bold">{formatCurrency(setup.special_allowance)}</p>
                                                            </div>
                                                            <div className="p-3 rounded-lg bg-background border shadow-sm">
                                                                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Incentive</p>
                                                                <p className="text-sm font-bold">{formatCurrency(setup.incentive)}</p>
                                                            </div>
                                                            <div className="p-3 rounded-lg bg-rose-50 border border-rose-100 dark:bg-rose-950/20 dark:border-rose-900/30 shadow-sm">
                                                                <p className="text-[10px] font-bold uppercase tracking-widest text-rose-500 mb-1">Deductions</p>
                                                                <p className="text-sm font-bold text-rose-700 dark:text-rose-400">{formatCurrency(setup.other_deductions)}</p>
                                                            </div>
                                                            <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 shadow-sm relative overflow-hidden group">
                                                                <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                                                <p className="text-[10px] font-bold uppercase tracking-widest text-primary/70 mb-1 relative z-10">Gross</p>
                                                                <p className="text-sm font-black text-primary relative z-10">{formatCurrency(gross)}</p>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="py-4 text-center border-2 border-dashed rounded-lg bg-background/50">
                                                            <p className="text-sm text-muted-foreground">No salary components configured yet.</p>
                                                        </div>
                                                    )}

                                                    <div className="flex flex-wrap gap-2 pt-2">
                                                        <Button
                                                            size="sm"
                                                            onClick={(e) => { e.stopPropagation(); handleEdit(employee) }}
                                                            className="shadow-sm font-medium"
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
                                                                className="shadow-sm font-medium hover:bg-muted"
                                                            >
                                                                <History className="h-3.5 w-3.5 mr-1" />
                                                                History
                                                            </Button>
                                                        )}
                                                    </div>
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            )
                        })}
                    </div>
                )}
            </CardShell>

            {/* ── Sheet: Add/Edit Form ───────────────────────── */}
            <Sheet open={sheetOpen} onOpenChange={(open) => {
                if (!open) handleSheetClose()
                else setSheetOpen(true)
            }}>
                <SheetContent side="right" className="w-full sm:max-w-2xl flex flex-col p-0 bg-background/95 backdrop-blur-xl border-l shadow-2xl">
                    <div className="flex-shrink-0 px-4 sm:px-6 border-b border-border/80 pb-3 mt-4">
                        <SheetHeader className="text-left pb-0">
                            <SheetTitle className="flex items-center gap-3 text-xl font-bold py-1">
                                <div className="p-2 rounded-lg bg-blue-100">
                                    <IndianRupee className="h-6 w-6 text-blue-600" />
                                </div>
                                <div className="flex flex-col">
                                    <span className="leading-tight text-blue-700">{editingId ? 'Edit Salary Setup' : 'New Salary Setup'}</span>
                                    <span className="text-xs font-medium text-muted-foreground mt-0 leading-tight">
                                        Configure salary components and deductions
                                    </span>
                                </div>
                            </SheetTitle>
                        </SheetHeader>
                    </div>

                    <div className="flex-1 overflow-y-auto mt-0">
                        <div className={cn("px-4 sm:px-6 lg:px-6", "pb-4", "space-y-6 pt-4")}>
                            <Card className="w-full max-w-2xl mx-auto bg-white shadow-lg border-2 border-border/60 rounded-lg">
                                <CardContent className="p-4">
                                    <form className="space-y-6" onSubmit={(e) => { e.preventDefault() }}>
                                        {/* Employee Information Section */}
                                        <Accordion type="multiple" defaultValue={["employee-info", "earnings"]} className="bg-white/80 backdrop-blur-sm rounded-lg border">
                                            <AccordionItem value="employee-info" className="border-b-0">
                                                <AccordionTrigger className={cn(
                                                    "px-4 py-3 rounded-t-lg hover:no-underline transition-colors",
                                                    editingId ? "bg-purple-50 hover:bg-purple-100" : "bg-blue-50 hover:bg-blue-100"
                                                )}>
                                                    <div className="flex items-center gap-3">
                                                        <Users className={cn("h-5 w-5", editingId ? "text-purple-600" : "text-blue-600")} />
                                                        <span className={cn("font-medium", editingId ? "text-purple-900" : "text-blue-900")}>Employee Information</span>
                                                    </div>
                                                </AccordionTrigger>
                                                <AccordionContent className="px-4 pb-4 pt-4 space-y-6">
                                                    <div className="space-y-4 pt-2">
                                                        <Controller
                                                            name="profileId"
                                                            control={control}
                                                            render={({ field, fieldState }) => (
                                                                <Field data-invalid={fieldState.invalid}>
                                                                    <div className="flex items-center gap-2 mb-2">
                                                                        <div className="h-6 w-6 rounded-md bg-blue-100 flex items-center justify-center text-blue-600">
                                                                            <Users className="h-3.5 w-3.5" />
                                                                        </div>
                                                                        <FieldLabel className="text-xs font-bold uppercase tracking-widest text-blue-900/60 m-0">Select Employee *</FieldLabel>
                                                                    </div>
                                                                    <Select
                                                                        value={field.value}
                                                                        onValueChange={field.onChange}
                                                                        disabled={!!editingId}
                                                                    >
                                                                        <SelectTrigger
                                                                            className={cn(
                                                                                "h-12 border-2 transition-all focus:ring-0",
                                                                                !!editingId && "opacity-60 cursor-not-allowed bg-muted/30",
                                                                                fieldState.invalid ? "border-destructive text-destructive" : "focus:border-blue-500"
                                                                            )}
                                                                        >
                                                                            <SelectValue placeholder="Choose employee..." />
                                                                        </SelectTrigger>
                                                                        <SelectContent className="max-h-[250px]">
                                                                            {salarySetups?.map(e => (
                                                                                <SelectItem key={e.id} value={e.id}>
                                                                                    {e.full_name || e.email}
                                                                                </SelectItem>
                                                                            ))}
                                                                        </SelectContent>
                                                                    </Select>
                                                                    {fieldState.invalid && fieldState.error && <FieldError errors={[fieldState.error]} className="mt-1" />}
                                                                </Field>
                                                            )}
                                                        />

                                                        {/* Detail Preview Card */}
                                                        <AnimatePresence>
                                                            {selectedEmployee && (
                                                                <motion.div
                                                                    initial={{ opacity: 0, height: 0, scale: 0.95 }}
                                                                    animate={{ opacity: 1, height: "auto", scale: 1 }}
                                                                    exit={{ opacity: 0, height: 0, scale: 0.95 }}
                                                                    className="overflow-hidden mt-4"
                                                                >
                                                                    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 rounded-2xl p-4 flex items-center gap-4 shadow-inner">
                                                                        <UserAvatarProfile
                                                                            user={selectedEmployee as any}
                                                                            className="h-14 w-14 rounded-xl border-2 border-white shadow-md"
                                                                        />
                                                                        <div className="flex-1">
                                                                            <div className="flex items-center gap-2 mb-1">
                                                                                <p className="font-black text-blue-900 uppercase tracking-tighter leading-none">
                                                                                    {selectedEmployee.full_name}
                                                                                </p>
                                                                                {(selectedEmployee as any).role && (
                                                                                    <Badge className="text-[9px] h-4 px-1.5 bg-blue-600 font-black tracking-widest uppercase">
                                                                                        {(selectedEmployee as any).role}
                                                                                    </Badge>
                                                                                )}
                                                                            </div>
                                                                            <div className="flex flex-wrap gap-x-4 gap-y-1">
                                                                                <span className="text-xs font-bold text-blue-700/70 flex items-center gap-1.5">
                                                                                    <Briefcase className="h-3.5 w-3.5" />
                                                                                    {(selectedEmployee as any).designation_name || 'Designation Pending'}
                                                                                </span>
                                                                                <span className="text-xs font-bold text-blue-700/70 flex items-center gap-1.5">
                                                                                    <Phone className="h-3.5 w-3.5" />
                                                                                    {(selectedEmployee as any).mobile_no || 'Contact Hidden'}
                                                                                </span>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </motion.div>
                                                            )}
                                                        </AnimatePresence>
                                                    </div>
                                                </AccordionContent>
                                            </AccordionItem>
                                        </Accordion>

                                        {/* Monthly Earnings Section */}
                                        <Accordion type="multiple" defaultValue={["earnings"]} className="bg-white/80 backdrop-blur-sm rounded-lg border">
                                            <AccordionItem value="earnings" className="border-b-0">
                                                <AccordionTrigger className={cn(
                                                    "px-4 py-3 rounded-t-lg hover:no-underline transition-colors",
                                                    "bg-emerald-50 hover:bg-emerald-100"
                                                )}>
                                                    <div className="flex items-center gap-3">
                                                        <IndianRupee className="h-5 w-5 text-emerald-600" />
                                                        <span className="font-medium text-emerald-900">Monthly Earnings</span>
                                                    </div>
                                                </AccordionTrigger>
                                                <AccordionContent className="px-4 pb-4 pt-4 space-y-6">
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6">
                                                        <Controller
                                                            name="basicSalary"
                                                            control={control}
                                                            render={({ field, fieldState }) => (
                                                                <Field data-invalid={fieldState.invalid}>
                                                                    <div className="flex items-center gap-2 mb-2">
                                                                        <FieldLabel className="text-xs font-bold uppercase tracking-widest text-emerald-900/60 m-0">Basic Salary *</FieldLabel>
                                                                    </div>
                                                                    <div className="relative">
                                                                        <Input
                                                                            type="number"
                                                                            placeholder="0"
                                                                            className={cn(
                                                                                "h-12 border-2 transition-all focus:ring-0 tracking-tighter text-lg",
                                                                                fieldState.invalid ? "border-destructive text-destructive" : "focus:border-emerald-500"
                                                                            )}
                                                                            {...field}
                                                                        />
                                                                    </div>
                                                                    {fieldState.invalid && fieldState.error && <FieldError errors={[fieldState.error]} className="mt-1" />}
                                                                </Field>
                                                            )}
                                                        />

                                                        <Controller
                                                            name="hra"
                                                            control={control}
                                                            render={({ field, fieldState }) => (
                                                                <Field>
                                                                    <div className="flex items-center gap-2 mb-2">
                                                                        <FieldLabel className="text-xs font-bold uppercase tracking-widest text-slate-500 m-0">HRA</FieldLabel>
                                                                    </div>
                                                                    <Input type="number" className="h-12 border-2 focus-visible:ring-0 focus-visible:border-emerald-500" placeholder="0" {...field} />
                                                                </Field>
                                                            )}
                                                        />

                                                        <Controller
                                                            name="da"
                                                            control={control}
                                                            render={({ field }) => (
                                                                <Field>
                                                                    <div className="flex items-center gap-2 mb-2">
                                                                        <FieldLabel className="text-xs font-bold uppercase tracking-widest text-slate-500 m-0">DA</FieldLabel>
                                                                    </div>
                                                                    <Input type="number" className="h-12 border-2 focus-visible:ring-0 focus-visible:border-emerald-500" placeholder="0" {...field} />
                                                                </Field>
                                                            )}
                                                        />

                                                        <Controller
                                                            name="ta"
                                                            control={control}
                                                            render={({ field }) => (
                                                                <Field>
                                                                    <div className="flex items-center gap-2 mb-2">
                                                                        <FieldLabel className="text-xs font-bold uppercase tracking-widest text-slate-500 m-0">TA</FieldLabel>
                                                                    </div>
                                                                    <Input type="number" className="h-12 border-2 focus-visible:ring-0 focus-visible:border-emerald-500" placeholder="0" {...field} />
                                                                </Field>
                                                            )}
                                                        />

                                                        <Controller
                                                            name="specialAllowance"
                                                            control={control}
                                                            render={({ field }) => (
                                                                <Field>
                                                                    <div className="flex items-center gap-2 mb-2">
                                                                        <FieldLabel className="text-xs font-bold uppercase tracking-widest text-slate-500 m-0">Special Allowance</FieldLabel>
                                                                    </div>
                                                                    <Input type="number" className="h-12 border-2 focus-visible:ring-0 focus-visible:border-emerald-500" placeholder="0" {...field} />
                                                                </Field>
                                                            )}
                                                        />

                                                        <Controller
                                                            name="incentive"
                                                            control={control}
                                                            render={({ field }) => (
                                                                <Field>
                                                                    <div className="flex items-center gap-2 mb-2">
                                                                        <FieldLabel className="text-xs font-bold uppercase tracking-widest text-slate-500 m-0">Incentive</FieldLabel>
                                                                    </div>
                                                                    <Input type="number" className="h-12 border-2 focus-visible:ring-0 focus-visible:border-emerald-500" placeholder="0" {...field} />
                                                                </Field>
                                                            )}
                                                        />
                                                    </div>
                                                </AccordionContent>
                                            </AccordionItem>
                                        </Accordion>

                                        {/* Deductions & Settings Section */}
                                        <Accordion type="multiple" defaultValue={["deductions"]} className="bg-white/80 backdrop-blur-sm rounded-lg border">
                                            <AccordionItem value="deductions" className="border-b-0">
                                                <AccordionTrigger className={cn(
                                                    "px-4 py-3 rounded-t-lg hover:no-underline transition-colors",
                                                    "bg-amber-50 hover:bg-amber-100"
                                                )}>
                                                    <div className="flex items-center gap-3">
                                                        <FileText className="h-5 w-5 text-amber-600" />
                                                        <span className="font-medium text-amber-900">Deductions & Settings</span>
                                                    </div>
                                                </AccordionTrigger>
                                                <AccordionContent className="px-4 pb-4 pt-4 space-y-6">
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6">
                                                        <Controller
                                                            name="otherDeductions"
                                                            control={control}
                                                            render={({ field }) => (
                                                                <Field>
                                                                    <div className="flex items-center gap-2 mb-2">
                                                                        <FieldLabel className="text-xs font-bold uppercase tracking-widest text-slate-500 m-0">Other Deductions <span className="text-muted-foreground font-medium normal-case">(PF, ESI, etc.)</span></FieldLabel>
                                                                    </div>
                                                                    <Input type="number" className="h-12 border-2 focus-visible:ring-0 focus-visible:border-amber-500" placeholder="0" {...field} />
                                                                </Field>
                                                            )}
                                                        />

                                                        <Controller
                                                            name="deductionRemark"
                                                            control={control}
                                                            render={({ field }) => (
                                                                <Field>
                                                                    <div className="flex items-center gap-2 mb-2">
                                                                        <FieldLabel className="text-xs font-bold uppercase tracking-widest text-slate-500 m-0">Deduction Remark</FieldLabel>
                                                                    </div>
                                                                    <Input
                                                                        className="h-12 border-2 focus-visible:ring-0 focus-visible:border-amber-500"
                                                                        placeholder="e.g. Loan deduction"
                                                                        {...field}
                                                                        value={field.value || ""}
                                                                    />
                                                                </Field>
                                                            )}
                                                        />
                                                    </div>

                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6">
                                                        <Controller
                                                            name="effectiveFromMonth"
                                                            control={control}
                                                            render={({ field: monthField }) => {
                                                                const year = watch("effectiveFromYear");
                                                                const month = watch("effectiveFromMonth");
                                                                const selectedDate = month && year ? new Date(year, month - 1) : undefined;

                                                                return (
                                                                    <Field>
                                                                        <div className="flex items-center gap-2 mb-2">
                                                                            <FieldLabel className="text-xs font-bold uppercase tracking-widest text-slate-500 m-0">Effective Month & Year</FieldLabel>
                                                                        </div>
                                                                        <Popover>
                                                                            <PopoverTrigger asChild>
                                                                                <Button
                                                                                    variant={"outline"}
                                                                                    className={cn(
                                                                                        "w-full h-12 justify-start text-left font-normal border-2 hover:bg-slate-50 focus:border-amber-500",
                                                                                        !selectedDate && "text-muted-foreground"
                                                                                    )}
                                                                                >
                                                                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                                                                    {selectedDate ? (
                                                                                        Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(selectedDate)
                                                                                    ) : (
                                                                                        <span>Pick a date</span>
                                                                                    )}
                                                                                </Button>
                                                                            </PopoverTrigger>
                                                                            <PopoverContent className="w-auto p-0" align="start">
                                                                                <div className="p-3 bg-white rounded-md shadow-md border">
                                                                                    <Calendar
                                                                                        mode="single"
                                                                                        selected={selectedDate}
                                                                                        onSelect={(date) => {
                                                                                            if (date) {
                                                                                                setValue('effectiveFromMonth', date.getMonth() + 1);
                                                                                                setValue('effectiveFromYear', date.getFullYear());
                                                                                            }
                                                                                        }}
                                                                                        defaultMonth={selectedDate}
                                                                                        initialFocus
                                                                                        captionLayout="dropdown"
                                                                                        fromYear={2000}
                                                                                        toYear={2100}
                                                                                        className="bg-transparent"
                                                                                    />
                                                                                </div>
                                                                            </PopoverContent>
                                                                        </Popover>
                                                                    </Field>
                                                                )
                                                            }}
                                                        />

                                                        <Controller
                                                            name="changeReason"
                                                            control={control}
                                                            render={({ field }) => (
                                                                <Field>
                                                                    <div className="flex items-center gap-2 mb-2">
                                                                        <FieldLabel className="text-xs font-bold uppercase tracking-widest text-slate-500 m-0">Effective Reason</FieldLabel>
                                                                    </div>
                                                                    <Input
                                                                        className="h-12 border-2 focus-visible:ring-0 focus-visible:border-amber-500"
                                                                        placeholder="e.g. Annual Increment, Setup"
                                                                        {...field}
                                                                        value={field.value || ""}
                                                                    />
                                                                </Field>
                                                            )}
                                                        />
                                                    </div>
                                                </AccordionContent>
                                            </AccordionItem>
                                        </Accordion>

                                        {/* Footer Actions / Bottom of form */}
                                        <div className="flex gap-4 pt-2 mt-8">
                                            <CancelButton
                                                onClick={handleSheetClose}
                                                className="flex-1 bg-rose-50 hover:bg-rose-100 font-bold text-rose-600 border border-rose-200 hover:border-rose-300 tracking-tight h-12 rounded-xl"
                                            >
                                                Cancel
                                            </CancelButton>
                                            <CreateUserButton
                                                onClick={handleSubmit(onSubmit)}
                                                size="lg"
                                                mode="create"
                                                icon={LayersPlus}
                                                asyncState={buttonAsyncState}
                                                loadingText="Saving..."
                                                successText="Saved Successfully!"
                                                className="flex-1 uppercase tracking-tight h-12 rounded-xl shadow-lg"
                                            >
                                                {editingId ? 'Update Salary' : 'Save Salary'}
                                            </CreateUserButton>
                                        </div>
                                    </form>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </SheetContent>
            </Sheet>

            {/* Salary History Dialog */}
            <Dialog open={historyDialogOpen} onOpenChange={setHistoryDialogOpen}>
                <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-xl pb-2 border-b">
                            <History className="h-5 w-5 text-primary" />
                            Salary History — <span className="text-muted-foreground ml-1">{selectedProfileName}</span>
                        </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4 pt-4 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-300 before:to-transparent">
                        {salaryHistory?.length === 0 ? (
                            <div className="py-12 bg-muted/20 rounded-xl text-center border-2 border-dashed relative z-10 mx-6">
                                <History className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                                <p className="text-sm font-medium text-muted-foreground">No history found</p>
                            </div>
                        ) : (
                            salaryHistory?.map((entry, index) => (
                                <div
                                    key={entry.id}
                                    className={cn(
                                        "relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active",
                                        entry.is_active ? 'opacity-100' : 'opacity-70'
                                    )}
                                >
                                    {/* Timeline dot */}
                                    <div className={cn(
                                        "flex items-center justify-center w-6 h-6 rounded-full border-4 border-white dark:border-background shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2",
                                        entry.is_active ? "bg-primary" : "bg-slate-300 dark:bg-slate-700"
                                    )}></div>

                                    <div className="w-[calc(100%-2.5rem)] md:w-[calc(50%-1.5rem)] p-4 rounded-xl border shadow-sm bg-card transition-all hover:shadow-md">
                                        <div className="flex items-center justify-between mb-3 border-b pb-2">
                                            <div className="flex items-center gap-2">
                                                {entry.is_active && (
                                                    <Badge className="bg-primary/10 text-primary border-primary/20 hover:bg-primary/20 text-[10px] font-bold shadow-sm">Active</Badge>
                                                )}
                                                <Badge variant="secondary" className="text-[10px] font-semibold bg-secondary/50">
                                                    {entry.change_reason || 'Initial Setup'}
                                                </Badge>
                                            </div>
                                        </div>
                                        <div className="mb-3">
                                            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                                {MONTHS[(entry.effective_from_month || 1) - 1]} {entry.effective_from_year}
                                                {entry.effective_to_month ? ` → ${MONTHS[(entry.effective_to_month || 1) - 1]} ${entry.effective_to_year}` : " → Present"}
                                            </span>
                                        </div>
                                        <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-xs bg-slate-50 dark:bg-slate-900 p-2.5 rounded-lg border">
                                            <div className="flex justify-between items-center"><span className="text-muted-foreground font-medium uppercase text-[9px] tracking-wider">Basic</span> <span className="font-bold">{formatCurrency(entry.basic_salary)}</span></div>
                                            <div className="flex justify-between items-center"><span className="text-muted-foreground font-medium uppercase text-[9px] tracking-wider">HRA</span> <span className="font-bold">{formatCurrency(entry.hra)}</span></div>
                                            <div className="flex justify-between items-center"><span className="text-muted-foreground font-medium uppercase text-[9px] tracking-wider">DA</span> <span className="font-bold">{formatCurrency(entry.da)}</span></div>
                                            <div className="flex justify-between items-center"><span className="text-muted-foreground font-medium uppercase text-[9px] tracking-wider">TA</span> <span className="font-bold">{formatCurrency(entry.ta)}</span></div>
                                        </div>
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
