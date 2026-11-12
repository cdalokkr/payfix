"use client"

import { useState, useMemo } from 'react'
import { trpc } from '@/lib/trpc/client'
import { CardShell } from '@/features/attendance/CardShell'
import { Building2, Plus, Edit, Trash2, Users, Search, MapPin, UserCheck, History, ShieldCheck, Clock, Briefcase } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription
} from '@/components/ui/dialog'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import {
    Accordion,
    AccordionItem,
    AccordionTrigger,
    AccordionContent,
} from '@/components/ui/accordion'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface DepartmentManagementProps {
    onViewDesignations?: (departmentId?: string) => void
    embedded?: boolean
}

export default function DepartmentManagement({ onViewDesignations, embedded = false }: DepartmentManagementProps) {
    const [searchTerm, setSearchTerm] = useState('')
    const [isCreateOpen, setIsCreateOpen] = useState(false)
    const [editingDept, setEditingDept] = useState<any | null>(null)
    const [deletingDept, setDeletingDept] = useState<any | null>(null)
    const [historyDept, setHistoryDept] = useState<any | null>(null)
    const [historyTab, setHistoryTab] = useState<'tenure' | 'audit'>('tenure')
    const [assigningManagerDept, setAssigningManagerDept] = useState<any | null>(null)

    // Department Create / Edit Form state (Clean & Focused)
    const [name, setName] = useState('')
    const [code, setCode] = useState('')
    const [locationId, setLocationId] = useState<string | null>(null)

    // Manager Assignment Form state (Dedicated)
    const [managerId, setManagerId] = useState<string | null>(null)
    const [promoteManagerRole, setPromoteManagerRole] = useState(false)

    const utils = trpc.useUtils()

    // Fetch departments
    const { data: departments, isLoading } = trpc.departments.getAll.useQuery()

    // Fetch staff for manager assignment
    const { data: usersData } = trpc.admin.users.getUsers.useQuery({
        getAll: true,
    })
    const users = useMemo(() => (usersData as any)?.users || [], [usersData])

    // Fetch locations
    const { data: locations } = trpc.officeLocations.getAll.useQuery()

    const selectedLocation = useMemo(() => {
        if (!locationId || locationId === 'all') return null
        return locations?.find((loc) => loc.id === locationId) || null
    }, [locations, locationId])

    // Queries for history and audit (when history dialog is open)
    const { data: managerHistory, isLoading: isLoadingHistory } = trpc.departments.getManagerHistory.useQuery(
        { departmentId: historyDept?.id },
        { enabled: !!historyDept?.id }
    )

    const { data: departmentAuditLogs, isLoading: isLoadingAudit } = trpc.departments.getDepartmentAuditLogs.useQuery(
        { departmentId: historyDept?.id },
        { enabled: !!historyDept?.id }
    )

    const createMutation = trpc.departments.create.useMutation({
        onSuccess: () => {
            toast.success("Department created successfully")
            utils.departments.getAll.invalidate()
            utils.departments.invalidate()
            utils.admin.designation.invalidate()
            closeForm()
        },
        onError: (err) => {
            toast.error(err.message || "Failed to create department")
        }
    })

    const updateMutation = trpc.departments.update.useMutation({
        onSuccess: () => {
            toast.success("Department updated successfully")
            utils.departments.getAll.invalidate()
            utils.departments.invalidate()
            utils.admin.designation.invalidate()
            closeForm()
            setAssigningManagerDept(null)
        },
        onError: (err) => {
            toast.error(err.message || "Failed to update department")
        }
    })

    const deleteMutation = trpc.departments.delete.useMutation({
        onSuccess: () => {
            toast.success("Department deleted successfully")
            utils.departments.getAll.invalidate()
            setDeletingDept(null)
        },
        onError: (err) => {
            toast.error(err.message || "Failed to delete department")
        }
    })

    const openCreate = () => {
        setEditingDept(null)
        setName('')
        setCode('')
        setLocationId(null)
        setIsCreateOpen(true)
    }

    const openEdit = (dept: any) => {
        setEditingDept(dept)
        setName(dept.name || '')
        setCode(dept.code || '')
        setLocationId(dept.location_id || null)
        setIsCreateOpen(true)
    }

    const closeForm = () => {
        setIsCreateOpen(false)
        setEditingDept(null)
        setName('')
        setCode('')
        setLocationId(null)
    }

    const handleDepartmentSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (!name.trim()) {
            toast.error("Department name is required")
            return
        }

        if (editingDept) {
            updateMutation.mutate({
                id: editingDept.id,
                name: name.trim(),
                code: code.trim() || null,
                locationId: locationId || null,
            })
        } else {
            createMutation.mutate({
                name: name.trim(),
                code: code.trim() || null,
                locationId: locationId || null,
            })
        }
    }

    // Manager Assignment Modal Handlers
    const openAssignManager = (dept: any) => {
        setAssigningManagerDept(dept)
        setManagerId(dept.manager_id || null)
        setPromoteManagerRole(false)
    }

    const handleSaveManager = (e: React.FormEvent) => {
        e.preventDefault()
        if (!assigningManagerDept) return

        updateMutation.mutate({
            id: assigningManagerDept.id,
            name: assigningManagerDept.name,
            managerId: managerId === "none" ? null : managerId,
            promoteManagerRole: promoteManagerRole,
        })
    }

    const selectedManagerUser = useMemo(() => {
        if (!managerId || managerId === 'none') return null
        return users.find((u: any) => u.id === managerId) || null
    }, [managerId, users])

    const filteredDepartments = useMemo(() => {
        if (!departments) return []
        if (!searchTerm) return departments
        const lower = searchTerm.toLowerCase()
        return departments.filter(d =>
            d.name.toLowerCase().includes(lower) ||
            (d.code && d.code.toLowerCase().includes(lower)) ||
            (d.manager?.full_name && d.manager.full_name.toLowerCase().includes(lower)) ||
            (d.location?.name && d.location.name.toLowerCase().includes(lower))
        )
    }, [departments, searchTerm])

    const totalMembers = useMemo(() => {
        if (!departments) return 0
        return departments.reduce((acc, d) => acc + (d.member_count || 0), 0)
    }, [departments])

    const activeManagersCount = useMemo(() => {
        if (!departments) return 0
        return departments.filter(d => d.manager_id).length
    }, [departments])

    return (
        <div className="space-y-6">
            {/* KPI Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-card border border-border/60 rounded-xl p-4 flex items-center gap-4 shadow-sm">
                    <div className="h-12 w-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
                        <Building2 className="h-6 w-6" />
                    </div>
                    <div>
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Departments</p>
                        <h3 className="text-2xl font-bold text-foreground">{departments?.length || 0}</h3>
                    </div>
                </div>

                <div className="bg-card border border-border/60 rounded-xl p-4 flex items-center gap-4 shadow-sm">
                    <div className="h-12 w-12 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
                        <UserCheck className="h-6 w-6" />
                    </div>
                    <div>
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Active Managers</p>
                        <h3 className="text-2xl font-bold text-foreground">{activeManagersCount}</h3>
                    </div>
                </div>

                <div className="bg-card border border-border/60 rounded-xl p-4 flex items-center gap-4 shadow-sm">
                    <div className="h-12 w-12 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
                        <Users className="h-6 w-6" />
                    </div>
                    <div>
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Assigned Staff</p>
                        <h3 className="text-2xl font-bold text-foreground">{totalMembers}</h3>
                    </div>
                </div>
            </div>

            {/* Department Table Card */}
            <CardShell
                title="Departments Directory"
                description="Manage organizational units, assigned department managers, and staff rosters."
                icon={Building2}
                headerActions={
                    <Button onClick={openCreate} className="gap-2 shadow-sm font-semibold">
                        <Plus className="h-4 w-4" />
                        Add Department
                    </Button>
                }
            >
                <div className="p-4 border-b border-border/40 flex flex-col sm:flex-row items-center justify-between gap-3 bg-muted/20">
                    <div className="relative w-full sm:w-80">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search departments, code, manager..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-9 h-9 bg-background"
                        />
                    </div>
                    <div className="text-xs text-muted-foreground font-medium">
                        Showing {filteredDepartments.length} of {departments?.length || 0} departments
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-muted/40 text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b border-border/60">
                            <tr>
                                <th className="px-4 py-3">Office Location</th>
                                <th className="px-4 py-3">Department Name</th>
                                <th className="px-4 py-3">Code</th>
                                <th className="px-4 py-3">Department Manager</th>
                                <th className="px-4 py-3 text-center">Designations</th>
                                <th className="px-4 py-3 text-center">Staff Count</th>
                                <th className="px-4 py-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/40">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={7} className="text-center py-8 text-muted-foreground animate-pulse">
                                        Loading departments...
                                    </td>
                                </tr>
                            ) : filteredDepartments.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="text-center py-8 text-muted-foreground">
                                        No departments found. Create your first department above.
                                    </td>
                                </tr>
                            ) : (
                                filteredDepartments.map((dept) => {
                                    const managerName = dept.manager?.full_name || (dept.manager ? `${dept.manager.first_name || ''} ${dept.manager.last_name || ''}`.trim() : null)
                                    const managerRole = dept.manager?.role || null
                                    const designationsCount = dept.designations?.length || 0

                                    return (
                                        <tr key={dept.id} className="hover:bg-muted/30 transition-colors">
                                            <td className="px-4 py-3">
                                                {dept.location?.name ? (
                                                    <div className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300 font-medium">
                                                        <MapPin className="h-3.5 w-3.5 text-primary" />
                                                        <span>{dept.location.name}</span>
                                                    </div>
                                                ) : (
                                                    <span className="text-xs text-muted-foreground font-medium">All Locations</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 font-semibold text-foreground">
                                                <span className="text-slate-900 dark:text-white font-medium">{dept.name}</span>
                                            </td>
                                            <td className="px-4 py-3">
                                                {dept.code ? (
                                                    <span className="px-2 py-0.5 rounded text-xs font-mono font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                                                        {dept.code}
                                                    </span>
                                                ) : (
                                                    <span className="text-xs text-muted-foreground">-</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3">
                                                {managerName ? (
                                                    <div
                                                        className="flex items-center gap-2 group cursor-pointer"
                                                        onClick={() => openAssignManager(dept)}
                                                        title="Click to view or reassign department manager"
                                                    >
                                                        <div className="h-7 w-7 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 flex items-center justify-center text-xs font-bold">
                                                            {managerName.charAt(0)}
                                                        </div>
                                                        <div>
                                                            <div className="font-medium text-slate-800 dark:text-slate-200 text-xs flex items-center gap-1">
                                                                <span>{managerName}</span>
                                                                <Edit className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                                                            </div>
                                                            <span className={cn(
                                                                "inline-block px-1.5 py-0.2 rounded text-[10px] font-semibold uppercase tracking-wider",
                                                                managerRole === 'moderator' ? "text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40" :
                                                                managerRole === 'admin' ? "text-purple-700 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/40" :
                                                                "text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40"
                                                            )}>
                                                                {managerRole || 'Manager'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <button
                                                        onClick={() => openAssignManager(dept)}
                                                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:hover:bg-amber-900/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 transition-colors shadow-sm"
                                                    >
                                                        <UserCheck className="h-3.5 w-3.5" />
                                                        <span>Assign Manager</span>
                                                    </button>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <button
                                                    onClick={() => onViewDesignations && onViewDesignations(dept.id)}
                                                    className={cn(
                                                        "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border transition-colors",
                                                        designationsCount > 0
                                                            ? "bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/40 dark:hover:bg-purple-900/60 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800/40 cursor-pointer"
                                                            : "bg-slate-50 dark:bg-slate-900 text-slate-500 border-slate-200 dark:border-slate-800 cursor-default"
                                                    )}
                                                    title={onViewDesignations ? "Click to view designations for this department" : undefined}
                                                >
                                                    <Briefcase className="h-3 w-3" />
                                                    {designationsCount} Roles
                                                </button>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/40">
                                                    {dept.member_count || 0} Staff
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        title="Assign or Change Manager"
                                                        className="h-8 w-8 p-0 text-primary hover:text-primary hover:bg-primary/10"
                                                        onClick={() => openAssignManager(dept)}
                                                    >
                                                        <UserCheck className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        title="Manager Tenure History & Audit Logs"
                                                        className="h-8 w-8 p-0 text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                                                        onClick={() => setHistoryDept(dept)}
                                                    >
                                                        <History className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        title="Edit Department"
                                                        className="h-8 w-8 p-0 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                                                        onClick={() => openEdit(dept)}
                                                    >
                                                        <Edit className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        title="Delete Department"
                                                        className="h-8 w-8 p-0 text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                                                        onClick={() => setDeletingDept(dept)}
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    )
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </CardShell>

            {/* Create / Edit Department Dialog - Clean, Concise, No Clutter */}
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-xl font-bold">
                            <Building2 className="h-5 w-5 text-primary" />
                            {editingDept ? 'Edit Department' : 'Create New Department'}
                        </DialogTitle>
                        <DialogDescription>
                            Setup organizational department name, code, and office location.
                        </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={handleDepartmentSubmit} className="space-y-3 py-1">
                        <Accordion type="multiple" defaultValue={["office", "department"]} className="space-y-2.5">
                            {/* Accordion 1: Office Location */}
                            <AccordionItem value="office" className="border border-border/70 rounded-lg overflow-hidden bg-white/80 dark:bg-zinc-950/40">
                                <AccordionTrigger className="px-4 py-2.5 hover:no-underline bg-blue-50/80 hover:bg-blue-100/80 dark:bg-blue-950/20 dark:hover:bg-blue-950/40 transition-colors">
                                    <div className="flex items-center gap-2.5">
                                        <MapPin className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                                        <span className="font-semibold text-sm text-blue-900 dark:text-blue-200">
                                            Office Location
                                        </span>
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent className="px-4 py-3 space-y-2">
                                    {/* Row 1: Office Location */}
                                    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                                        <Label htmlFor="dept-location" className="font-semibold text-sm whitespace-nowrap shrink-0 sm:w-28">
                                            Office Location *
                                        </Label>
                                        <div className="flex-1 w-full">
                                            <Select
                                                value={locationId || "all"}
                                                onValueChange={(val) => setLocationId(val === "all" ? null : val)}
                                            >
                                                <SelectTrigger id="dept-location" className="h-9.5 bg-background w-full">
                                                    <SelectValue placeholder="All Locations (Company-wide)" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="all">All Locations (Company-wide / Universal)</SelectItem>
                                                    {locations?.map((loc) => (
                                                        <SelectItem key={loc.id} value={loc.id}>
                                                            {loc.name}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>

                                    {/* Row 2: Office Address - aligned directly under Office Location label and details */}
                                    {selectedLocation?.address && (
                                        <div className="flex flex-col sm:flex-row sm:items-start gap-3 pt-0.5">
                                            <Label className="font-semibold text-sm text-muted-foreground whitespace-nowrap shrink-0 sm:w-28 sm:pt-0.5">
                                                Office Address
                                            </Label>
                                            <div className="flex-1 w-full">
                                                <p className="text-xs text-muted-foreground leading-relaxed break-words">
                                                    {selectedLocation.address}
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                </AccordionContent>
                            </AccordionItem>

                            {/* Accordion 2: Department */}
                            <AccordionItem value="department" className="border border-border/70 rounded-lg overflow-hidden bg-white/80 dark:bg-zinc-950/40">
                                <AccordionTrigger className="px-4 py-2.5 hover:no-underline bg-blue-50/80 hover:bg-blue-100/80 dark:bg-blue-950/20 dark:hover:bg-blue-950/40 transition-colors">
                                    <div className="flex items-center gap-2.5">
                                        <Building2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                                        <span className="font-semibold text-sm text-blue-900 dark:text-blue-200">
                                            Department
                                        </span>
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent className="px-4 py-3 space-y-2.5">
                                    {/* Requirement 3: Rename "Department Name" -> "Name" and "Department Code" -> "Code" */}
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                        <div className="sm:col-span-2 space-y-1.5">
                                            <Label htmlFor="dept-name" className="font-semibold text-sm">
                                                Name *
                                            </Label>
                                            <Input
                                                id="dept-name"
                                                placeholder="e.g. Front Desk, Housekeeping, IT, Nursing"
                                                value={name}
                                                onChange={(e) => setName(e.target.value)}
                                                required
                                                className="h-10 bg-background"
                                            />
                                        </div>

                                        <div className="space-y-1.5">
                                            <Label htmlFor="dept-code" className="font-semibold text-sm">
                                                Code
                                            </Label>
                                            <Input
                                                id="dept-code"
                                                placeholder="e.g. FD, HK, IT"
                                                value={code}
                                                onChange={(e) => setCode(e.target.value.toUpperCase())}
                                                maxLength={10}
                                                className="h-10 uppercase font-mono bg-background"
                                            />
                                        </div>
                                    </div>
                                </AccordionContent>
                            </AccordionItem>
                        </Accordion>

                        <DialogFooter className="pt-3 border-t border-border/40 gap-2">
                            <Button type="button" variant="outline" onClick={closeForm}>
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                disabled={createMutation.isPending || updateMutation.isPending}
                                className="font-semibold shadow-sm"
                            >
                                {editingDept ? 'Update Department' : 'Create Department'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Dedicated Assign / Change Department Manager Dialog */}
            <Dialog open={!!assigningManagerDept} onOpenChange={(open) => !open && setAssigningManagerDept(null)}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-xl font-bold">
                            <UserCheck className="h-5 w-5 text-primary" />
                            Department Manager & Rights
                        </DialogTitle>
                        <DialogDescription>
                            Designate an employee or moderator to oversee shift rosters and duties for <strong>{assigningManagerDept?.name}</strong>.
                        </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={handleSaveManager} className="space-y-4 py-2">
                        <div className="space-y-1.5">
                            <Label htmlFor="assign-manager" className="font-semibold text-sm">
                                Designate Manager
                            </Label>
                            <Select
                                value={managerId || "none"}
                                onValueChange={(val) => setManagerId(val === "none" ? null : val)}
                            >
                                <SelectTrigger id="assign-manager" className="h-10 bg-background">
                                    <SelectValue placeholder="Select Staff Member" />
                                </SelectTrigger>
                                <SelectContent className="max-h-60">
                                    <SelectItem value="none">No Manager Assigned (Unassigned)</SelectItem>
                                    {users.map((u: any) => (
                                        <SelectItem key={u.id} value={u.id}>
                                            {u.first_name} {u.last_name} ({u.role})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Selected Manager Role Info & Promotion Checkbox */}
                        {selectedManagerUser && (
                            <div className="p-3 rounded-xl bg-muted/40 border border-border/60 space-y-2.5 shadow-sm">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-medium text-muted-foreground">Current System Role:</span>
                                    <span className={cn(
                                        "px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider",
                                        selectedManagerUser.role === 'moderator' ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300" :
                                        selectedManagerUser.role === 'admin' ? "bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300" :
                                        "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300"
                                    )}>
                                        {selectedManagerUser.role}
                                    </span>
                                </div>

                                {selectedManagerUser.role === 'employee' && (
                                    <div className="pt-2 border-t border-border/40 space-y-1">
                                        <label className="flex items-start gap-2.5 text-xs cursor-pointer group">
                                            <input
                                                type="checkbox"
                                                checked={promoteManagerRole}
                                                onChange={(e) => setPromoteManagerRole(e.target.checked)}
                                                className="rounded border-slate-300 text-primary focus:ring-primary mt-0.5"
                                            />
                                            <span className="text-foreground group-hover:text-primary transition-colors leading-tight">
                                                Promote user to <strong>Moderator Role</strong> for organization-wide supervisory access
                                            </span>
                                        </label>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Delegated Privileges Box */}
                        <div className="rounded-xl bg-blue-50/80 dark:bg-blue-950/30 p-3 text-xs text-blue-900 dark:text-blue-300 border border-blue-200/60 dark:border-blue-900/40 space-y-1.5">
                            <div className="flex items-center gap-1.5 font-semibold text-blue-800 dark:text-blue-200">
                                <ShieldCheck className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                                <span>Delegated Manager Privileges:</span>
                            </div>
                            <ul className="list-disc list-inside text-[11px] space-y-1 text-blue-800/90 dark:text-blue-300/90 pl-1">
                                <li>Allot & manage daily and weekly shift duty rosters for department staff</li>
                                <li>Review attendance logs, mark justified absences, and handle emergency call-ins</li>
                                <li>All manager appointments and transitions are permanently logged in tenure history</li>
                            </ul>
                        </div>

                        <DialogFooter className="pt-3 border-t border-border/40 gap-2">
                            <Button type="button" variant="outline" onClick={() => setAssigningManagerDept(null)}>
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                disabled={updateMutation.isPending}
                                className="font-semibold shadow-sm"
                            >
                                {updateMutation.isPending ? 'Saving...' : 'Save Manager Assignment'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Manager History & Audit Trail Dialog */}
            <Dialog open={!!historyDept} onOpenChange={(open) => !open && setHistoryDept(null)}>
                <DialogContent className="sm:max-w-2xl md:max-w-3xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-lg font-bold">
                            <History className="h-5 w-5 text-amber-600" />
                            Manager History & Audit Trail: <span className="text-primary">{historyDept?.name}</span>
                        </DialogTitle>
                        <DialogDescription>
                            View chronological manager appointments, tenures, and supervisory actions performed for this department.
                        </DialogDescription>
                    </DialogHeader>

                    {/* Sub-tabs */}
                    <div className="flex items-center gap-2 border-b border-border/60 pb-2 pt-1">
                        <button
                            onClick={() => setHistoryTab('tenure')}
                            className={cn(
                                "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5",
                                historyTab === 'tenure'
                                    ? "bg-primary text-primary-foreground shadow-sm"
                                    : "text-muted-foreground hover:bg-muted/50"
                            )}
                        >
                            <Clock className="h-3.5 w-3.5" />
                            Manager Tenure History ({managerHistory?.length || 0})
                        </button>
                        <button
                            onClick={() => setHistoryTab('audit')}
                            className={cn(
                                "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5",
                                historyTab === 'audit'
                                    ? "bg-primary text-primary-foreground shadow-sm"
                                    : "text-muted-foreground hover:bg-muted/50"
                            )}
                        >
                            <ShieldCheck className="h-3.5 w-3.5" />
                            Supervisory Action Logs ({departmentAuditLogs?.length || 0})
                        </button>
                    </div>

                    <div className="py-2 min-h-[240px]">
                        {historyTab === 'tenure' ? (
                            isLoadingHistory ? (
                                <div className="text-center py-10 text-muted-foreground animate-pulse">
                                    Loading manager history...
                                </div>
                            ) : !managerHistory || managerHistory.length === 0 ? (
                                <div className="text-center py-10 text-muted-foreground space-y-2">
                                    <Clock className="h-8 w-8 mx-auto text-muted-foreground/40" />
                                    <p>No manager changes recorded yet for this department.</p>
                                    <p className="text-xs text-muted-foreground/70">Future manager assignments and transfers will automatically log here.</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {managerHistory.map((item: any, idx: number) => {
                                        const isActive = item.status === 'active' && !item.end_date
                                        const managerName = item.manager?.full_name || 'Unknown User'

                                        return (
                                            <div
                                                key={item.id || idx}
                                                className={cn(
                                                    "p-3.5 rounded-xl border transition-all flex items-start justify-between gap-4",
                                                    isActive
                                                        ? "bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800"
                                                        : "bg-card border-border/60"
                                                )}
                                            >
                                                <div className="flex items-start gap-3">
                                                    <div className={cn(
                                                        "h-9 w-9 rounded-full flex items-center justify-center font-bold text-xs shrink-0 mt-0.5",
                                                        isActive
                                                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200"
                                                            : "bg-muted text-muted-foreground"
                                                    )}>
                                                        {managerName.charAt(0)}
                                                    </div>
                                                    <div className="space-y-1">
                                                        <div className="flex items-center gap-2">
                                                            <h5 className="font-semibold text-foreground text-sm">{managerName}</h5>
                                                            <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold uppercase bg-muted text-muted-foreground">
                                                                {item.manager?.role || 'Staff'}
                                                            </span>
                                                            {isActive && (
                                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                                                                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                                                    Current Active Manager
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1">
                                                            <span>From: <strong>{item.start_date ? new Date(item.start_date).toLocaleDateString() : 'N/A'}</strong></span>
                                                            <span>To: <strong>{item.end_date ? new Date(item.end_date).toLocaleDateString() : 'Present'}</strong></span>
                                                            {item.appointedBy?.full_name && (
                                                                <span>Appointed By: <em>{item.appointedBy.full_name}</em></span>
                                                            )}
                                                        </div>
                                                        {item.handover_notes && (
                                                            <p className="text-xs text-muted-foreground/90 italic pt-1">
                                                                &quot;{item.handover_notes}&quot;
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            )
                        ) : (
                            isLoadingAudit ? (
                                <div className="text-center py-10 text-muted-foreground animate-pulse">
                                    Loading audit logs...
                                </div>
                            ) : !departmentAuditLogs || departmentAuditLogs.length === 0 ? (
                                <div className="text-center py-10 text-muted-foreground space-y-2">
                                    <ShieldCheck className="h-8 w-8 mx-auto text-muted-foreground/40" />
                                    <p>No supervisory actions logged yet for this department.</p>
                                    <p className="text-xs text-muted-foreground/70">When a manager allots shifts, marks attendance, or changes rosters, actions will be recorded here.</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {departmentAuditLogs.map((log: any, idx: number) => (
                                        <div key={log.id || idx} className="p-3 rounded-lg border border-border/40 bg-card text-xs flex items-start justify-between gap-3">
                                            <div className="space-y-0.5">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-semibold text-foreground">{log.profile?.full_name || 'System / Admin'}</span>
                                                    <span className="px-1.5 py-0.2 rounded text-[10px] font-mono uppercase bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                                                        {log.module}
                                                    </span>
                                                </div>
                                                <p className="text-slate-700 dark:text-slate-300 font-medium">
                                                    {log.description}
                                                </p>
                                            </div>
                                            <div className="text-right text-[11px] text-muted-foreground shrink-0">
                                                {log.created_at ? new Date(log.created_at).toLocaleString() : ''}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )
                        )}
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setHistoryDept(null)}>
                            Close
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <Dialog open={!!deletingDept} onOpenChange={(open) => !open && setDeletingDept(null)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-destructive flex items-center gap-2">
                            <Trash2 className="h-5 w-5" />
                            Delete Department
                        </DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete <strong>{deletingDept?.name}</strong>?
                            Any users belonging to this department will have their department reset to unassigned.
                        </DialogDescription>
                    </DialogHeader>

                    <DialogFooter className="gap-2 pt-2">
                        <Button variant="outline" onClick={() => setDeletingDept(null)}>
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={() => deletingDept && deleteMutation.mutate({ id: deletingDept.id })}
                            disabled={deleteMutation.isPending}
                        >
                            {deleteMutation.isPending ? 'Deleting...' : 'Delete Department'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
