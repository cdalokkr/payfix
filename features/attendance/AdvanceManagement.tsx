"use client"

import React, { useState, useMemo, useCallback, useRef, useEffect } from "react"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { format } from "date-fns"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { trpc } from "@/lib/trpc/client"
import { toast } from "sonner"
import {
    HandCoins,
    Trash2,
    Users,
    UserCog,
    Phone,
    Briefcase,
    Calendar as CalendarIcon,
    Wallet,
    FileText,
    Search,
    X,
    CheckCircle2,
    CopyCheck,
    LayersPlus,
    Clock as ClockIcon,
    CircleDollarSign,
    CheckCircle as CheckCircleIcon,
    WalletCards,
} from "lucide-react"
import { DataTable } from "@/components/ui/data-table"
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header"
import { ColumnDef } from "@tanstack/react-table"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import CreateUserButton from "@/components/ui/create-user-button"
import { CancelButton, EditButton, DeleteButton } from "@/components/ui/action-button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { UserAvatarProfile } from "@/components/user-avatar-profile"
import {
    Accordion,
    AccordionItem,
    AccordionTrigger,
    AccordionContent,
} from "@/components/ui/accordion"
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
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
    Field,
    FieldLabel,
    FieldError,
} from "@/components/ui/field"
import { cn } from "@/lib/utils"
import { motion, AnimatePresence } from "framer-motion"
import { CompactMetricCard } from "@/components/dashboard/compact-metric-card"
import { CardShell } from "./CardShell"
import { ProfileInfoCell } from "@/components/dashboard/profile-info-cell"

// ─── Zod Schema ────────────────────────────────────────────────────────
const advanceSchema = z.object({
    profileId: z.string().uuid("Please select an employee"),
    date: z.string().min(1, "Date is required"),
    amount: z.string()
        .refine((val) => !isNaN(Number(val)) && Number(val) > 0, {
            message: "Amount must be a positive number",
        }),
    particulars: z.string().min(3, "Particulars must be at least 3 characters").max(200, "Particulars too long"),
})

type AdvanceFormValues = z.infer<typeof advanceSchema>

// ─── Component ─────────────────────────────────────────────────────────
export function AdvanceManagement() {
    const [sheetOpen, setSheetOpen] = useState(false)
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
    const [deleteId, setDeleteId] = useState<string>("")
    const [editingId, setEditingId] = useState<string | null>(null)
    const [searchQuery, setSearchQuery] = useState("")
    const [filterStatus, setFilterStatus] = useState<string>("all")

    // Role-based employee selection
    const [roleGroup, setRoleGroup] = useState<"staff" | "employee">("employee")

    // Multi-advance session tracking
    const [sessionCount, setSessionCount] = useState(0)
    const [buttonAsyncState, setButtonAsyncState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
    const successTimerRef = useRef<NodeJS.Timeout | null>(null)

    // Derived: lock employee selection after first save
    const isEmployeeLocked = sessionCount > 0

    // React Hook Form setup
    const form = useForm<AdvanceFormValues>({
        resolver: zodResolver(advanceSchema),
        defaultValues: {
            profileId: "",
            date: new Date().toISOString().split('T')[0],
            amount: "",
            particulars: "",
        },
    })

    const { control, handleSubmit, reset, watch, setValue, formState: { errors } } = form
    // react-hook-form's watch API is intentionally live and is not React Compiler-memoizable.
    // eslint-disable-next-line react-hooks/incompatible-library
    const selectedProfileId = watch("profileId")

    // Get employees filtered by role group
    const { data: employees, isLoading: employeesLoading } = trpc.salary.getEmployeesByRole.useQuery(
        { roleGroup },
        { placeholderData: (prev: any) => prev }
    )

    const { data: advancesData, isLoading, refetch } = trpc.salary.getAdvances.useQuery(
        {
            status: filterStatus === 'pending' || filterStatus === 'adjusted' ? filterStatus as 'pending' | 'adjusted' : undefined,
            limit: 1000, // Fetch all for client-side pagination/sorting to match Admin UI pattern
        },
        { placeholderData: (prev: any) => prev }
    )

    const advancesFromQuery = advancesData?.advances
    const advances = useMemo(() => advancesFromQuery || [], [advancesFromQuery])

    const updateMutation = trpc.salary.updateAdvance.useMutation({
        onSuccess: () => {
            toast.success("Advance updated successfully")
            setSheetOpen(false)
            setEditingId(null)
            reset()
            refetch()
        },
        onError: (err) => toast.error(err.message),
    })

    // Keyboard shortcut for Search (Cmd/Ctrl + K)
    const searchInputRef = useRef<HTMLInputElement>(null)

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

    // Keyboard shortcut for Form Submit (Cmd/Ctrl + Enter)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && sheetOpen) {
                e.preventDefault()
                handleSubmit(onSubmit)()
            }
        }
        document.addEventListener('keydown', handleKeyDown)
        return () => document.removeEventListener('keydown', handleKeyDown)
    // onSubmit is declared below and the shortcut is intentionally tied to the
    // open state rather than recreated as mutation handlers change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sheetOpen, handleSubmit])

    // Cleanup timer on unmount
    useEffect(() => {
        return () => {
            if (successTimerRef.current) clearTimeout(successTimerRef.current)
        }
    }, [])

    const addMutation = trpc.salary.addAdvance.useMutation({
        onSuccess: () => {
            const newCount = sessionCount + 1
            setSessionCount(newCount)
            toast.success(`Entry #${newCount} saved — add another or click Done`, { duration: 3000 })

            // Show success state on button
            setButtonAsyncState('success')

            // Reset button back to idle after 3 seconds
            if (successTimerRef.current) clearTimeout(successTimerRef.current)
            successTimerRef.current = setTimeout(() => {
                setButtonAsyncState('idle')
            }, 3000)

            // Keep profileId and roleGroup, only clear transaction fields
            const currentProfileId = form.getValues("profileId")
            reset({
                profileId: currentProfileId,
                date: new Date().toISOString().split('T')[0],
                amount: "",
                particulars: "",
            })

            // Background refresh — table updates silently
            refetch()
        },
        onError: (err) => {
            setButtonAsyncState('error')
            toast.error(err.message)
            // Reset button after 4s on error
            if (successTimerRef.current) clearTimeout(successTimerRef.current)
            successTimerRef.current = setTimeout(() => {
                setButtonAsyncState('idle')
            }, 4000)
        },
    })

    const deleteMutation = trpc.salary.deleteAdvance.useMutation({
        onSuccess: () => {
            toast.success("Advance deleted")
            setDeleteDialogOpen(false)
            refetch()
        },
        onError: (err) => toast.error(err.message),
    })

    const onSubmit = async (data: AdvanceFormValues) => {
        setButtonAsyncState('loading')
        if (editingId) {
            await updateMutation.mutateAsync({ id: editingId, ...data })
        } else {
            await addMutation.mutateAsync(data)
        }
    }

    const handleDelete = (id: string) => {
        setDeleteId(id)
        setDeleteDialogOpen(true)
    }

    const handleEdit = useCallback((advance: any) => {
        setEditingId(advance.id)
        // Map role correctly: admin/moderator -> 'staff', employee -> 'employee'
        const role = advance.profile?.role
        setRoleGroup(role === 'employee' ? 'employee' : 'staff')
        // Use setTimeout to ensure roleGroup state is updated before setting profileId
        setTimeout(() => {
            reset({
                profileId: advance.profile_id,
                date: advance.date,
                amount: String(advance.amount),
                particulars: advance.particulars,
            })
        }, 0)
        setSheetOpen(true)
    }, [reset])

    // Reset employee selection when role group changes (only when not locked)
    const handleRoleGroupChange = (value: "staff" | "employee") => {
        if (isEmployeeLocked) return
        setRoleGroup(value)
        setValue("profileId", "")
    }

    // "Done" handler: reset employee selection and session, stay in sheet
    const handleDone = useCallback(() => {
        setSessionCount(0)
        setButtonAsyncState('idle')
        if (successTimerRef.current) clearTimeout(successTimerRef.current)
        reset({
            profileId: "",
            date: new Date().toISOString().split('T')[0],
            amount: "",
            particulars: "",
        })
        setRoleGroup("employee")
    }, [reset])

    // Close the sheet and fully reset state
    const handleSheetClose = useCallback(() => {
        setSheetOpen(false)
        setSessionCount(0)
        setEditingId(null)
        setButtonAsyncState('idle')
        if (successTimerRef.current) clearTimeout(successTimerRef.current)
        reset({
            profileId: "",
            date: new Date().toISOString().split('T')[0],
            amount: "",
            particulars: "",
        })
        setRoleGroup("employee")
    }, [reset])

    // Open sheet for new record
    const handleAddClick = useCallback(() => {
        setEditingId(null)
        setSessionCount(0)
        reset({
            profileId: "",
            date: new Date().toISOString().split('T')[0],
            amount: "",
            particulars: "",
        })
        setRoleGroup("employee")
        setSheetOpen(true)
    }, [reset])

    // Pre-calculate pending balances per employee for the new column
    const employeeBalances = useMemo(() => {
        const balances: Record<string, number> = {}
        if (!advances) return balances
        advances.forEach((a: any) => {
            if (a.status === 'pending') {
                balances[a.profile_id] = (balances[a.profile_id] || 0) + (Number(a.amount) || 0)
            }
        })
        return balances
    }, [advances])

    // ── Table Columns ────────────────────────────────────────────────
    const columns = useMemo<ColumnDef<any>[]>(() => [
        {
            accessorKey: "profile.full_name",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Employee" />
            ),
            cell: ({ row }) => <ProfileInfoCell profile={row.original.profile} showRole={false} className="max-w-[180px]" />,
            size: 200,
        },
        {
            id: "pending_balance",
            header: () => <div className="text-right pr-4">Balance</div>,
            cell: ({ row }) => {
                const balance = employeeBalances[row.original.profile_id] || 0;
                return (
                    <div className="text-right pr-4">
                        {balance > 0 ? (
                            <span className="font-black text-amber-600 text-[11px] tabular-nums bg-amber-50 dark:bg-amber-900/20 px-1.5 py-0.5 rounded-md border border-amber-200/50">
                                ₹{balance.toLocaleString('en-IN')}
                            </span>
                        ) : (
                            <span className="text-muted-foreground/30 text-[10px]">--</span>
                        )}
                    </div>
                )
            },
            size: 90,
        },
        {
            accessorKey: "date",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Date" />
            ),
            cell: ({ row }) => {
                const date = new Date(row.original.date)
                return (
                    <div className="flex flex-col text-xs leading-tight">
                        <span className="font-bold">{format(date, 'MMM dd, yy')}</span>
                        <span className="text-[9px] text-muted-foreground font-medium">{format(date, 'EEE')}</span>
                    </div>
                )
            },
            size: 70,
        },
        {
            accessorKey: "amount",
            header: () => <div className="text-right pr-4">Amount</div>,
            cell: ({ row }) => (
                <div className="text-right pr-4">
                    <Badge variant="secondary" className="font-black tabular-nums bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/10 h-5 px-1.5 text-[11px]">
                        ₹{Number(row.original.amount).toLocaleString('en-IN')}
                    </Badge>
                </div>
            ),
            size: 80,
        },
        {
            accessorKey: "particulars",
            header: "Particulars",
            cell: ({ row }) => (
                <div className="max-w-[200px] truncate text-muted-foreground text-xs font-medium" title={row.original.particulars}>
                    {row.original.particulars}
                </div>
            ),
            size: 180,
        },
        {
            accessorKey: "status",
            header: "Status",
            cell: ({ row }) => {
                const status = row.original.status
                return (
                    <Badge
                        variant="secondary"
                        className={cn(
                            "capitalize font-black text-[9px] tracking-tight px-1.5 h-4 border-none",
                            status === 'pending' && "bg-amber-500/15 text-amber-700 dark:text-amber-400",
                            status === 'adjusted' && "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
                        )}
                    >
                        {status}
                    </Badge>
                )
            },
            size: 62,
        },
        {
            id: "actions",
            header: "Actions",
            cell: ({ row }) => {
                const advance = row.original
                const isPending = advance.status === 'pending'
                const isCarryForward = advance.particulars?.startsWith('Salary deficit carry-forward from')

                return (
                    <div className="flex items-center justify-end gap-1">
                        <TooltipProvider>
                            {isPending && !isCarryForward && (
                                <>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <EditButton
                                                variant="icon-only"
                                                size="sm"
                                                onClick={() => handleEdit(advance)}
                                                className="h-7 w-7 active:scale-[0.92] transition-transform"
                                            />
                                        </TooltipTrigger>
                                        <TooltipContent>Edit</TooltipContent>
                                    </Tooltip>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <DeleteButton
                                                variant="icon-only"
                                                size="sm"
                                                onClick={() => handleDelete(advance.id)}
                                                className="h-7 w-7 active:scale-[0.92] transition-transform"
                                            />
                                        </TooltipTrigger>
                                        <TooltipContent>Delete</TooltipContent>
                                    </Tooltip>
                                </>
                            )}
                            {isPending && isCarryForward && (
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Badge variant="outline" className="text-[9px] px-1.5 py-0 bg-violet-500/10 text-violet-600 border-violet-500/20 font-medium cursor-default">
                                            System
                                        </Badge>
                                    </TooltipTrigger>
                                    <TooltipContent>System-generated carry-forward — cannot be edited or deleted</TooltipContent>
                                </Tooltip>
                            )}
                            {!isPending && (
                                <span className="text-[9px] text-muted-foreground/50 italic">Adjusted</span>
                            )}
                        </TooltipProvider>
                    </div>
                )
            },
            size: 80,
        },
    ], [employeeBalances, handleEdit])

    const filteredAdvances = useMemo(() => {
        if (!advances) return []
        let result = advances
        if (searchQuery) {
            const q = searchQuery.toLowerCase()
            result = result.filter((a: any) =>
                a.profile?.full_name?.toLowerCase().includes(q) ||
                a.profile?.email?.toLowerCase().includes(q) ||
                a.particulars?.toLowerCase().includes(q)
            )
        }
        return result
    }, [advances, searchQuery])

    const totalPending = useMemo(() => {
        return filteredAdvances
            .filter((a: any) => a.status === 'pending')
            .reduce((sum: number, a: any) => sum + (Number(a.amount) || 0), 0)
    }, [filteredAdvances])

    const totalAdjusted = useMemo(() => {
        return filteredAdvances
            .filter((a: any) => a.status === 'adjusted')
            .reduce((sum: number, a: any) => sum + (Number(a.amount) || 0), 0)
    }, [filteredAdvances])

    const stats = useMemo(() => ({
        pending: filteredAdvances.filter((a: any) => a.status === 'pending').length,
        adjusted: filteredAdvances.filter((a: any) => a.status === 'adjusted').length,
        totalAmount: filteredAdvances.reduce((sum: number, a: any) => sum + (Number(a.amount) || 0), 0),
        all: filteredAdvances.length,
    }), [filteredAdvances])

    // Currently selected employee for the preview card
    const selectedEmployee = employees?.find(e => e.id === selectedProfileId)

    const selectedEmployeePending = useMemo(() => {
        if (!selectedProfileId || !advances) return 0;
        return advances
            .filter((a: any) => a.profile_id === selectedProfileId && a.status === 'pending')
            .reduce((sum: number, a: any) => sum + (Number(a.amount) || 0), 0);
    }, [selectedProfileId, advances]);

    const formatCurrency = (val: string | number | null | undefined) => {
        const num = Number(val) || 0
        return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(num)
    }

    return (
        <div className="space-y-6">

            {/* ── Metric Cards ─────────────────────────────────────── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <CompactMetricCard
                    label="Pending"
                    value={stats.pending}
                    icon={ClockIcon}
                    theme="amber"
                    delay={0.1}
                    loading={isLoading}
                />
                <CompactMetricCard
                    label="Adjusted"
                    value={stats.adjusted}
                    icon={CheckCircleIcon}
                    theme="green"
                    delay={0.2}
                    loading={isLoading}
                />
                <CompactMetricCard
                    label="Outstanding"
                    value={formatCurrency(totalPending)}
                    icon={HandCoins}
                    theme="rose"
                    delay={0.3}
                    loading={isLoading}
                />
                <CompactMetricCard
                    label="Total Records"
                    value={stats.all}
                    icon={WalletCards}
                    theme="blue"
                    delay={0.4}
                    loading={isLoading}
                />
            </div>

            {/* ── Main Ledger Card ────────────────────────────────── */}
            <CardShell
                title="Advance & Loan Ledger"
                description="View and manage employee financial advances."
                icon={HandCoins}
                contentClassName="min-h-0 p-6 pt-2 h-full overflow-auto"
            >
                <DataTable
                    columns={columns}
                    data={filteredAdvances}
                    isLoading={isLoading}
                    emptyIcon={
                        <motion.div
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ duration: 0.5, type: "spring", bounce: 0.4 }}
                            className="h-20 w-20 bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100/50 rounded-full flex items-center justify-center mb-5 shadow-inner"
                        >
                            <FileText className="h-8 w-8 text-blue-500 opacity-60" />
                        </motion.div>
                    }
                    emptyMessage="No advances match your search. Record a new entry using the button above."
                    toolbar={(table) => (
                        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center py-2">
                            <div className="relative w-full max-w-sm group">
                                <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                                    <Search className="h-4 w-4 text-muted-foreground group-focus-within:text-blue-500 transition-colors" />
                                </div>
                                <Input
                                    ref={searchInputRef}
                                    placeholder="Search by employee... (Cmd/Ctrl+K)"
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
                                        <SelectItem value="pending">Pending Only</SelectItem>
                                        <SelectItem value="adjusted">Adjusted Only</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="sm:ml-auto w-full sm:w-auto mt-2 sm:mt-0">
                                <CreateUserButton
                                    onClick={handleAddClick}
                                    size="md"
                                    className="w-full sm:w-auto"
                                >
                                    Record Advance
                                </CreateUserButton>
                            </div>
                        </div>
                    )}
                />
            </CardShell>

            {/* ── Sheet: Multi-Advance Form ───────────────────────── */}
            < Sheet open={sheetOpen} onOpenChange={(open) => {
                if (!open) handleSheetClose()
                else setSheetOpen(true)
            }
            }>
                <SheetContent side="right" className="w-full sm:max-w-2xl flex flex-col p-0 bg-background/95 backdrop-blur-xl border-l shadow-2xl">
                    {/* Header */}
                    <div className="flex-shrink-0 px-4 sm:px-6 border-b border-border/80 pb-3 mt-4">
                        <SheetHeader className="text-left pb-0">
                            <SheetTitle className="flex items-center gap-3 text-xl font-bold py-1">
                                <div className="p-2 rounded-lg bg-blue-100">
                                    <HandCoins className="h-6 w-6 text-blue-600" />
                                </div>
                                <div className="flex flex-col">
                                    <span className="leading-tight text-blue-700">{editingId ? 'Edit Advance' : 'Record Advance'}</span>
                                    <span className="text-xs font-medium text-muted-foreground mt-0 leading-tight">
                                        {editingId ? 'Update the advance entry details below' : 'Select an employee once and add multiple entries'}
                                    </span>
                                </div>
                            </SheetTitle>
                        </SheetHeader>
                    </div>

                    {/* Scrollable Body */}
                    <div className="flex-1 overflow-y-auto mt-0">
                        <div className={cn("px-4 sm:px-6 lg:px-6", "pb-4", "space-y-6 pt-4")}>
                            <Card className="w-full max-w-2xl mx-auto bg-white shadow-lg border-2 border-border/60 rounded-lg">
                                <CardContent className="p-4">

                                    {/* Session counter banner */}
                                    <AnimatePresence>
                                        {sessionCount > 0 && (
                                            <motion.div
                                                initial={{ opacity: 0, y: -8 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, y: -8 }}
                                                className="flex items-center gap-3 p-3 mb-6 rounded-xl bg-emerald-50 border border-emerald-200"
                                            >
                                                <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0" />
                                                <span className="text-sm font-bold text-emerald-800">
                                                    {sessionCount} {sessionCount === 1 ? 'entry' : 'entries'} saved this session
                                                </span>
                                                <span className="text-xs text-emerald-600 ml-auto font-medium">Add more below ↓</span>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>

                                    <form className="space-y-6" onSubmit={(e) => { e.preventDefault() }}>
                                        {/* Employee Information Section */}
                                        <Accordion type="multiple" defaultValue={["employee-info", "transaction-details"]} className="bg-white/80 backdrop-blur-sm rounded-lg border">
                                            <AccordionItem value="employee-info" className="border-b-0">
                                                <AccordionTrigger className={cn(
                                                    "px-4 py-3 rounded-t-lg hover:no-underline transition-colors",
                                                    editingId
                                                        ? "bg-purple-50 hover:bg-purple-100"
                                                        : "bg-blue-50 hover:bg-blue-100"
                                                )}>
                                                    <div className="flex items-center gap-3">
                                                        <Users className={cn(
                                                            "h-5 w-5",
                                                            editingId ? "text-purple-600" : "text-blue-600"
                                                        )} />
                                                        <span className={cn(
                                                            "font-medium",
                                                            editingId ? "text-purple-900" : "text-blue-900"
                                                        )}>Employee Information</span>
                                                    </div>
                                                </AccordionTrigger>
                                                <AccordionContent className="px-4 pb-4 pt-4 space-y-6">
                                                    {/* Target Category */}
                                                    <div className="space-y-4">
                                                        <div className="flex items-center gap-2 mb-2">
                                                            <div className="h-6 w-6 rounded-md bg-indigo-100 flex items-center justify-center text-indigo-600">
                                                                <UserCog className="h-3.5 w-3.5" />
                                                            </div>
                                                            <Label className="text-xs font-bold uppercase tracking-widest text-indigo-900/60">Target Category</Label>
                                                        </div>

                                                        <RadioGroup
                                                            value={roleGroup}
                                                            onValueChange={handleRoleGroupChange as (val: string) => void}
                                                            className="grid grid-cols-2 gap-3"
                                                            disabled={isEmployeeLocked || !!editingId}
                                                        >
                                                            <label
                                                                className={cn(
                                                                    "relative flex items-center gap-3 p-3 rounded-xl border-2 transition-all",
                                                                    isEmployeeLocked || !!editingId ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:border-blue-200",
                                                                    roleGroup === 'staff' ? "border-blue-500 bg-blue-50/50" : "border-border"
                                                                )}
                                                            >
                                                                <RadioGroupItem value="staff" disabled={isEmployeeLocked || !!editingId} className={cn(
                                                                    "h-4 w-4",
                                                                    roleGroup === 'staff' ? "border-blue-600 text-blue-600" : ""
                                                                )} />
                                                                <span className="text-sm font-bold text-foreground leading-none">Admin and Moderator</span>
                                                            </label>

                                                            <label
                                                                className={cn(
                                                                    "relative flex items-center gap-3 p-3 rounded-xl border-2 transition-all",
                                                                    isEmployeeLocked || !!editingId ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:border-emerald-200",
                                                                    roleGroup === 'employee' ? "border-emerald-500 bg-emerald-50/50" : "border-border"
                                                                )}
                                                            >
                                                                <RadioGroupItem value="employee" disabled={isEmployeeLocked || !!editingId} className={cn(
                                                                    "h-4 w-4",
                                                                    roleGroup === 'employee' ? "border-emerald-600 text-emerald-600" : ""
                                                                )} />
                                                                <span className="text-sm font-bold text-foreground leading-none">General Employee</span>
                                                            </label>
                                                        </RadioGroup>
                                                    </div>

                                                    {/* Employee Selection */}
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
                                                                        disabled={isEmployeeLocked || !!editingId}
                                                                    >
                                                                        <SelectTrigger
                                                                            className={cn(
                                                                                "h-12 border-2 transition-all focus:ring-0",
                                                                                (isEmployeeLocked || editingId) && "opacity-60 cursor-not-allowed bg-muted/30",
                                                                                fieldState.invalid ? "border-destructive text-destructive" : "focus:border-blue-500"
                                                                            )}
                                                                        >
                                                                            <SelectValue placeholder={employeesLoading ? "Searching database..." : "Choose employee..."} />
                                                                        </SelectTrigger>
                                                                        <SelectContent className="max-h-[250px]">
                                                                            {employees?.map(e => (
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
                                                                                <Badge className="text-[9px] h-4 px-1.5 bg-blue-600 font-black tracking-widest uppercase">
                                                                                    {selectedEmployee.role}
                                                                                </Badge>
                                                                            </div>
                                                                            <div className="flex flex-wrap gap-x-4 gap-y-1">
                                                                                <span className="text-xs font-bold text-blue-700/70 flex items-center gap-1.5">
                                                                                    <Briefcase className="h-3.5 w-3.5" />
                                                                                    {selectedEmployee.designation_name || 'Designation Pending'}
                                                                                </span>
                                                                                <span className="text-xs font-bold text-blue-700/70 flex items-center gap-1.5">
                                                                                    <Phone className="h-3.5 w-3.5" />
                                                                                    {selectedEmployee.mobile_no || 'Contact Hidden'}
                                                                                </span>
                                                                            </div>
                                                                            <div className="mt-2 pt-2 border-t border-blue-200/50 flex items-center justify-between">
                                                                                <div className="flex items-center gap-1.5 text-xs font-bold text-amber-700">
                                                                                    <HandCoins className="h-3.5 w-3.5" />
                                                                                    <span>Pending Advances Balance:</span>
                                                                                </div>
                                                                                <span className="font-black text-amber-700 text-sm">
                                                                                    {formatCurrency(selectedEmployeePending)}
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

                                        {/* Transaction Details Section */}
                                        <Accordion type="multiple" defaultValue={["transaction-details"]} className="bg-white/80 backdrop-blur-sm rounded-lg border">
                                            <AccordionItem value="transaction-details" className="border-b-0">
                                                <AccordionTrigger className={cn(
                                                    "px-4 py-3 rounded-t-lg hover:no-underline transition-colors",
                                                    editingId
                                                        ? "bg-emerald-50 hover:bg-emerald-100"
                                                        : "bg-emerald-50 hover:bg-emerald-100"
                                                )}>
                                                    <div className="flex items-center gap-3">
                                                        <Wallet className="h-5 w-5 text-emerald-600" />
                                                        <span className="font-medium text-emerald-900">Transaction Details</span>
                                                    </div>
                                                </AccordionTrigger>
                                                <AccordionContent className="px-4 pb-4 pt-4 space-y-6">
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6">
                                                        <Controller
                                                            name="date"
                                                            control={control}
                                                            render={({ field, fieldState }) => (
                                                                <Field data-invalid={fieldState.invalid}>
                                                                    <div className="flex items-center gap-2 mb-2">
                                                                        <div className="h-6 w-6 rounded-md bg-purple-100 flex items-center justify-center text-purple-600">
                                                                            <CalendarIcon className="h-3.5 w-3.5" />
                                                                        </div>
                                                                        <FieldLabel className="text-xs font-bold uppercase tracking-widest text-purple-900/60 m-0">Date *</FieldLabel>
                                                                    </div>
                                                                    <Input
                                                                        type="date"
                                                                        className={cn(
                                                                            "h-12 border-2 transition-all focus:ring-0 font-medium",
                                                                            fieldState.invalid ? "border-destructive" : "focus:border-purple-500"
                                                                        )}
                                                                        {...field}
                                                                    />
                                                                    {fieldState.invalid && fieldState.error && <FieldError errors={[fieldState.error]} className="mt-1" />}
                                                                </Field>
                                                            )}
                                                        />

                                                        <Controller
                                                            name="amount"
                                                            control={control}
                                                            render={({ field, fieldState }) => (
                                                                <Field data-invalid={fieldState.invalid}>
                                                                    <div className="flex items-center gap-2 mb-2">
                                                                        <div className="h-6 w-6 rounded-md bg-emerald-100 flex items-center justify-center text-emerald-600">
                                                                            <Wallet className="h-3.5 w-3.5" />
                                                                        </div>
                                                                        <FieldLabel className="text-xs font-bold uppercase tracking-widest text-emerald-900/60 m-0">Amount *</FieldLabel>
                                                                    </div>
                                                                    <div className="relative">
                                                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-emerald-600 text-lg">₹</span>
                                                                        <Input
                                                                            placeholder="0.00"
                                                                            className={cn(
                                                                                "h-12 pl-9 border-2 transition-all focus:ring-0 font-black text-xl tracking-tighter",
                                                                                fieldState.invalid ? "border-destructive text-destructive" : "focus:border-emerald-500"
                                                                            )}
                                                                            {...field}
                                                                        />
                                                                    </div>
                                                                    {fieldState.invalid && fieldState.error && <FieldError errors={[fieldState.error]} className="mt-1" />}
                                                                </Field>
                                                            )}
                                                        />
                                                    </div>

                                                    <Controller
                                                        name="particulars"
                                                        control={control}
                                                        render={({ field, fieldState }) => (
                                                            <Field data-invalid={fieldState.invalid}>
                                                                <div className="flex items-center gap-2 mb-2">
                                                                    <div className="h-6 w-6 rounded-md bg-amber-100 flex items-center justify-center text-amber-600">
                                                                        <FileText className="h-3.5 w-3.5" />
                                                                    </div>
                                                                    <FieldLabel className="text-xs font-bold uppercase tracking-widest text-amber-900/60 m-0">Particulars *</FieldLabel>
                                                                </div>
                                                                <textarea
                                                                    placeholder="Write a clear reason for this financial advance..."
                                                                    className={cn(
                                                                        "w-full min-h-[120px] p-4 rounded-2xl border-2 bg-transparent text-sm font-medium focus:outline-none transition-all focus:ring-0 resize-none",
                                                                        fieldState.invalid ? "border-destructive bg-destructive/5" : "border-border focus:border-amber-500"
                                                                    )}
                                                                    {...field}
                                                                />
                                                                <div className="flex items-center justify-between mt-1.5">
                                                                    {fieldState.invalid && fieldState.error ? <FieldError errors={[fieldState.error]} /> : <div />}
                                                                    <span className="text-[10px] font-black text-muted-foreground uppercase opacity-60 tracking-widest">
                                                                        {field.value.length} / 200 CHARS
                                                                    </span>
                                                                </div>
                                                            </Field>
                                                        )}
                                                    />
                                                </AccordionContent>
                                            </AccordionItem>
                                        </Accordion>

                                        {/* Footer Actions / Bottom of form */}
                                        <div className="flex gap-4 pt-2 mt-8">
                                            {isEmployeeLocked ? (
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    onClick={handleDone}
                                                    className="flex-1 bg-green-50/50 hover:bg-green-100/50 hover:border-green-500 text-green-800 dark:text-green-400 border-green-200/60 font-bold tracking-tight h-12 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                                                >
                                                    <CopyCheck className="h-4 w-4 text-green-600" />
                                                    Done ({sessionCount} saved)
                                                </Button>
                                            ) : (
                                                <CancelButton
                                                    onClick={handleSheetClose}
                                                    className="flex-1 bg-rose-50 hover:bg-rose-100 font-bold text-rose-600 border border-rose-200 hover:border-rose-300 tracking-tight h-12 rounded-xl"
                                                >
                                                    {editingId ? 'Cancel' : (sessionCount > 0 ? `Done (${sessionCount} saved)` : 'Cancel')}
                                                </CancelButton>
                                            )}
                                            <CreateUserButton
                                                onClick={handleSubmit(onSubmit)}
                                                size="lg"
                                                mode="create"
                                                icon={LayersPlus}
                                                asyncState={buttonAsyncState}
                                                loadingText="Saving..."
                                                successText="Saved! Add more ↓"
                                                className="flex-1 uppercase tracking-tight h-12 rounded-xl shadow-lg"
                                            >
                                                {editingId ? 'Update Entry' : (sessionCount > 0 ? `Add Entry #${sessionCount + 1}` : 'Add Entry')}
                                            </CreateUserButton>
                                        </div>
                                    </form>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </SheetContent>
            </Sheet >

            {/* ── Delete Confirmation ─────────────────────────────── */}
            < AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen} >
                <AlertDialogContent className="max-w-[400px] border-2 rounded-3xl">
                    <AlertDialogHeader className="items-center text-center">
                        <div className="h-20 w-20 bg-rose-50 rounded-full flex items-center justify-center mb-4">
                            <Trash2 className="h-10 w-10 text-rose-500 animate-bounce" />
                        </div>
                        <AlertDialogTitle className="text-2xl font-black text-rose-900 leading-tight">Revoke Advance?</AlertDialogTitle>
                        <AlertDialogDescription className="text-muted-foreground text-sm font-bold opacity-80 px-4">
                            This transaction will be erased permanently. This operation cannot be reversed.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="flex-col sm:flex-row gap-3 mt-6">
                        <AlertDialogCancel className="w-full sm:flex-1 border-2 font-bold rounded-xl h-12">Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            className="w-full sm:flex-1 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl h-12 shadow-lg shadow-rose-500/20 active:scale-95 transition-all"
                            onClick={() => deleteMutation.mutate({ id: deleteId })}
                            disabled={deleteMutation.isPending}
                        >
                            {deleteMutation.isPending ? "Erasing..." : "Yes, Erase"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog >
        </div >
    )
}
