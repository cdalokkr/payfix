"use client"

import React, { useState, useRef, useMemo } from "react"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select"
import {
    Upload,
    Download,
    FileSpreadsheet,
    CheckCircle2,
    AlertCircle,
    Trash2,
    Users,
    Shield,
    Sparkles,
    Loader2,
    Info,
    Check,
    X
} from "lucide-react"
import { trpc } from "@/lib/trpc/client"
import { toast } from "sonner"

interface BulkUserImportDialogProps {
    isOpen: boolean
    onOpenChange: (open: boolean) => void
    onSuccess?: () => void
}

interface ParsedUserRow {
    id: string
    name: string
    mobileNo: string
    dateOfBirth: string
    sex: 'male' | 'female'
    email: string
    departmentId: string | null
    role: 'admin' | 'moderator' | 'employee'
    designationId: string | null
    isValid: boolean
    errorMessage?: string
}

export function BulkUserImportDialog({ isOpen, onOpenChange, onSuccess }: BulkUserImportDialogProps) {
    const [step, setStep] = useState<'upload' | 'mapping' | 'results'>('upload')
    const [parsedUsers, setParsedUsers] = useState<ParsedUserRow[]>([])
    const [fileName, setFileName] = useState<string>("")
    const [isParsing, setIsParsing] = useState(false)
    const [results, setResults] = useState<{
        successCount: number
        skippedCount: number
        skippedRecords: Array<{ name: string; mobileNo: string; email?: string; reason: string }>
    } | null>(null)

    const fileInputRef = useRef<HTMLInputElement>(null)
    const utils = trpc.useUtils()

    // Fetch active departments & designations for mapping
    const { data: departmentsData } = trpc.departments.getAll.useQuery()
    const { data: designationsData } = trpc.admin.designation.getDesignations.useQuery()

    const departments = useMemo(() => departmentsData || [], [departmentsData])
    const designations = useMemo(() => designationsData || [], [designationsData])

    // Bulk creation mutation
    const bulkCreateMutation = trpc.admin.users.bulkCreateUsers.useMutation({
        onSuccess: (data) => {
            setResults(data)
            setStep('results')
            utils.admin.users.getUsers.invalidate()
            toast.success(`Successfully created ${data.successCount} users!`)
            onSuccess?.()
        },
        onError: (err) => {
            toast.error(err.message || "Failed to bulk create users")
        }
    })

    // Reset dialog state
    const handleReset = () => {
        setStep('upload')
        setParsedUsers([])
        setFileName("")
        setResults(null)
        if (fileInputRef.current) fileInputRef.current.value = ""
    }

    // Download Sample Template (.xlsx)
    const handleDownloadTemplate = async () => {
        try {
            toast.loading("Generating sample template...")
            const ExcelJS = (await import('exceljs')).default
            const workbook = new ExcelJS.Workbook()
            workbook.creator = 'PayFix'
            workbook.created = new Date()

            const worksheet = workbook.addWorksheet('Staff Template', {
                views: [{ showGridLines: true }]
            })

            const headers = ['Name', 'Mobile No', 'Date of Birth', 'Sex', 'Email']
            const headerRow = worksheet.addRow(headers)
            headerRow.eachCell((cell) => {
                cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } }
                cell.alignment = { vertical: 'middle', horizontal: 'center' }
            })

            // Sample rows
            worksheet.addRow(['Rahul Sharma', '9876543210', '1995-08-15', 'Male', 'rahul.sharma@example.com'])
            worksheet.addRow(['Priya Singh', '9812345678', '1998-04-22', 'Female', ''])
            worksheet.addRow(['Amit Verma', '9898989898', '1992-11-05', 'Male', 'amit.verma@example.com'])

            worksheet.columns = [
                { width: 22 },
                { width: 16 },
                { width: 16 },
                { width: 12 },
                { width: 28 },
            ]

            const buffer = await workbook.xlsx.writeBuffer()
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
            const url = window.URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = 'PayFix_Bulk_User_Import_Template.xlsx'
            a.click()
            window.URL.revokeObjectURL(url)
            toast.dismiss()
            toast.success("Sample template downloaded!")
        } catch (err: any) {
            toast.dismiss()
            toast.error(err.message || "Failed to download template")
        }
    }

    // Parse Excel File on upload
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        setIsParsing(true)
        setFileName(file.name)

        try {
            const ExcelJS = (await import('exceljs')).default
            const workbook = new ExcelJS.Workbook()
            const arrayBuffer = await file.arrayBuffer()
            await workbook.xlsx.load(arrayBuffer)

            const worksheet = workbook.worksheets[0]
            if (!worksheet) {
                throw new Error("Excel worksheet is empty")
            }

            const rows: ParsedUserRow[] = []
            let headerFound = false
            let colMap = { name: 1, mobile: 2, dob: 3, sex: 4, email: 5 }

            worksheet.eachRow((row, rowNumber) => {
                const values = row.values as any[]
                if (!values || values.length <= 1) return

                // Detect headers on first non-empty row
                if (!headerFound) {
                    const rowText = values.map(v => String(v || '').toLowerCase())
                    const nameIdx = rowText.findIndex(t => t.includes('name'))
                    const mobileIdx = rowText.findIndex(t => t.includes('mobile') || t.includes('phone'))
                    const dobIdx = rowText.findIndex(t => t.includes('birth') || t.includes('dob'))
                    const sexIdx = rowText.findIndex(t => t.includes('sex') || t.includes('gender'))
                    const emailIdx = rowText.findIndex(t => t.includes('email'))

                    if (nameIdx !== -1 && mobileIdx !== -1) {
                        colMap = {
                            name: nameIdx,
                            mobile: mobileIdx,
                            dob: dobIdx !== -1 ? dobIdx : 3,
                            sex: sexIdx !== -1 ? sexIdx : 4,
                            email: emailIdx !== -1 ? emailIdx : 5,
                        }
                        headerFound = true
                        return
                    }
                    headerFound = true // fallback to default positional column mapping
                    return
                }

                const rawName = String(values[colMap.name] || '').trim()
                const rawMobile = String(values[colMap.mobile] || '').replace(/\D/g, '').slice(-10)
                let rawDob = ''
                if (values[colMap.dob]) {
                    const val = values[colMap.dob]
                    if (val instanceof Date) {
                        rawDob = val.toISOString().split('T')[0]
                    } else {
                        rawDob = String(val).trim()
                    }
                }
                const rawSexText = String(values[colMap.sex] || '').toLowerCase().trim()
                const sex: 'male' | 'female' = rawSexText.startsWith('f') ? 'female' : 'male'
                const rawEmail = String(values[colMap.email] || '').trim()

                if (!rawName && !rawMobile) return // skip completely blank trailing rows

                let isValid = true
                let errorMessage: string | undefined

                if (!rawName) {
                    isValid = false
                    errorMessage = "Name is required"
                } else if (rawMobile.length < 10) {
                    isValid = false
                    errorMessage = "Mobile must be 10 digits"
                }

                rows.push({
                    id: `user-${rowNumber}-${Date.now()}-${Math.random()}`,
                    name: rawName,
                    mobileNo: rawMobile,
                    dateOfBirth: rawDob,
                    sex,
                    email: rawEmail,
                    departmentId: null,
                    role: 'employee',
                    designationId: null,
                    isValid,
                    errorMessage,
                })
            })

            if (rows.length === 0) {
                throw new Error("No data rows found in the uploaded file.")
            }

            setParsedUsers(rows)
            setStep('mapping')
            toast.success(`Parsed ${rows.length} users successfully! Please review and map roles.`)
        } catch (err: any) {
            toast.error(err.message || "Failed to parse Excel file")
        } finally {
            setIsParsing(false)
        }
    }

    // Bulk Apply Handlers
    const handleBulkDepartmentChange = (deptId: string) => {
        const targetId = deptId === 'none' ? null : deptId
        setParsedUsers(prev => prev.map(u => ({ ...u, departmentId: targetId })))
        toast.info("Department applied to all rows")
    }

    const handleBulkRoleChange = (role: 'admin' | 'moderator' | 'employee') => {
        setParsedUsers(prev => prev.map(u => ({ ...u, role })))
        toast.info(`Role set to ${role} for all rows`)
    }

    const handleBulkDesignationChange = (desigId: string) => {
        const targetId = desigId === 'none' ? null : desigId
        setParsedUsers(prev => prev.map(u => ({ ...u, designationId: targetId })))
        toast.info("Designation applied to all rows")
    }

    // Row-specific Handlers
    const handleUpdateRow = (id: string, updates: Partial<ParsedUserRow>) => {
        setParsedUsers(prev => prev.map(u => u.id === id ? { ...u, ...updates } : u))
    }

    const handleDeleteRow = (id: string) => {
        setParsedUsers(prev => prev.filter(u => u.id !== id))
    }

    // Submission handler
    const handleSubmit = async () => {
        const validUsers = parsedUsers.filter(u => u.isValid)
        if (validUsers.length === 0) {
            toast.error("No valid users to import. Please fix row errors.")
            return
        }

        bulkCreateMutation.mutate({
            users: validUsers.map(u => ({
                name: u.name,
                mobileNo: u.mobileNo,
                dateOfBirth: u.dateOfBirth || null,
                sex: u.sex,
                email: u.email || null,
                departmentId: u.departmentId || null,
                designationId: u.designationId || null,
                role: u.role,
            }))
        })
    }

    const validCount = parsedUsers.filter(u => u.isValid).length
    const invalidCount = parsedUsers.length - validCount

    return (
        <Dialog open={isOpen} onOpenChange={(open) => {
            if (!open) handleReset()
            onOpenChange(open)
        }}>
            <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden rounded-2xl">
                <DialogHeader className="p-5 border-b border-slate-200 dark:border-zinc-800 bg-slate-50/70 dark:bg-zinc-900/60">
                    <div className="flex items-center gap-2.5">
                        <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
                            <Upload className="h-5 w-5" />
                        </div>
                        <div>
                            <DialogTitle className="text-base font-bold text-foreground">
                                Bulk User Creation with Excel
                            </DialogTitle>
                            <DialogDescription className="text-xs text-muted-foreground">
                                Upload an Excel file to create staff accounts with default password <span className="font-mono font-bold text-foreground">#User@1234$</span> and forced first-time password reset.
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto p-5">
                    {/* STEP 1: UPLOAD */}
                    {step === 'upload' && (
                        <div className="space-y-6">
                            {/* Security Notice */}
                            <div className="bg-indigo-50/70 dark:bg-indigo-950/20 p-4 rounded-xl border border-indigo-200 dark:border-indigo-800/40 flex items-start gap-3">
                                <Sparkles className="h-5 w-5 text-indigo-600 dark:text-indigo-400 mt-0.5 shrink-0" />
                                <div className="text-xs text-indigo-900 dark:text-indigo-300">
                                    <p className="font-bold text-sm">Security & First-Time Login Enforced</p>
                                    <p className="mt-0.5 text-indigo-700/80 dark:text-indigo-400">
                                        All newly imported staff will receive the initial password <span className="font-mono font-bold">#User@1234$</span>. When they first log in via Web or Mobile PWA app, they will be required to set their personal password before accessing their dashboard.
                                    </p>
                                </div>
                            </div>

                            {/* Upload Dropzone */}
                            <div 
                                onClick={() => fileInputRef.current?.click()}
                                className="border-2 border-dashed border-slate-200 dark:border-zinc-800 hover:border-primary/60 dark:hover:border-primary/60 rounded-2xl p-8 text-center cursor-pointer transition-colors bg-slate-50/30 dark:bg-zinc-900/20 flex flex-col items-center justify-center gap-3"
                            >
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept=".xlsx,.xls"
                                    onChange={handleFileUpload}
                                    className="hidden"
                                />
                                <div className="h-12 w-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                                    {isParsing ? <Loader2 className="h-6 w-6 animate-spin" /> : <FileSpreadsheet className="h-6 w-6" />}
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-foreground">
                                        {isParsing ? "Parsing Excel File..." : "Click or drag your Excel file here (.xlsx)"}
                                    </p>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        Must include columns: Name, Mobile No, Date of Birth, Sex, Email (optional)
                                    </p>
                                </div>
                            </div>

                            {/* Download Template Bar */}
                            <div className="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-800">
                                <div className="flex items-center gap-2">
                                    <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                                    <span className="text-xs font-semibold text-foreground">
                                        Need the exact Excel format?
                                    </span>
                                </div>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleDownloadTemplate}
                                    className="h-8 gap-1.5 rounded-lg text-xs font-bold border-slate-300 dark:border-zinc-700 hover:bg-slate-100 dark:hover:bg-zinc-800"
                                >
                                    <Download className="h-3.5 w-3.5 text-emerald-600" />
                                    Download Template (.xlsx)
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* STEP 2: REVIEW & BULK MAPPING TABLE */}
                    {step === 'mapping' && (
                        <div className="space-y-4">
                            {/* Summary & Global Bulk Mapper Bar */}
                            <div className="bg-slate-50 dark:bg-zinc-900/80 p-3.5 rounded-xl border border-slate-200 dark:border-zinc-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
                                <div>
                                    <span className="text-xs font-bold text-foreground block">
                                        {parsedUsers.length} Users Parsed from &quot;{fileName}&quot;
                                    </span>
                                    <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                                        <span className="text-emerald-600 font-semibold">{validCount} Ready</span>
                                        {invalidCount > 0 && <span className="text-rose-600 font-semibold">• {invalidCount} with errors</span>}
                                    </div>
                                </div>

                                {/* Global Bulk Selectors */}
                                <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                                    {/* Set Department for all */}
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-[11px] font-semibold text-muted-foreground whitespace-nowrap">Apply Dept:</span>
                                        <Select onValueChange={handleBulkDepartmentChange}>
                                            <SelectTrigger className="h-8 w-[140px] rounded-lg text-xs font-semibold">
                                                <SelectValue placeholder="All Depts..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="none" className="text-xs">None</SelectItem>
                                                {departments.map(d => (
                                                    <SelectItem key={d.id} value={d.id} className="text-xs">{d.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    {/* Set Role for all */}
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-[11px] font-semibold text-muted-foreground whitespace-nowrap">Apply Role:</span>
                                        <Select onValueChange={(val) => handleBulkRoleChange(val as any)}>
                                            <SelectTrigger className="h-8 w-[120px] rounded-lg text-xs font-semibold">
                                                <SelectValue placeholder="All Roles..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="employee" className="text-xs">Employee</SelectItem>
                                                <SelectItem value="moderator" className="text-xs">Moderator</SelectItem>
                                                <SelectItem value="admin" className="text-xs">Admin</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    {/* Set Designation for all */}
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-[11px] font-semibold text-muted-foreground whitespace-nowrap">Apply Desig:</span>
                                        <Select onValueChange={handleBulkDesignationChange}>
                                            <SelectTrigger className="h-8 w-[140px] rounded-lg text-xs font-semibold">
                                                <SelectValue placeholder="All Desig..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="none" className="text-xs">None</SelectItem>
                                                {designations.map(d => (
                                                    <SelectItem key={d.id} value={d.id} className="text-xs">{d.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            </div>

                            {/* Editable Mapping Table */}
                            <div className="overflow-x-auto border border-slate-200 dark:border-zinc-800 rounded-xl">
                                <table className="w-full text-left text-xs border-collapse">
                                    <thead>
                                        <tr className="bg-slate-50 dark:bg-zinc-900 border-b border-slate-200 dark:border-zinc-800 text-muted-foreground font-semibold">
                                            <th className="py-2.5 px-3">#</th>
                                            <th className="py-2.5 px-3">Name</th>
                                            <th className="py-2.5 px-3">Mobile No</th>
                                            <th className="py-2.5 px-3">DOB / Sex</th>
                                            <th className="py-2.5 px-3">Email (Optional)</th>
                                            <th className="py-2.5 px-3">Department</th>
                                            <th className="py-2.5 px-3">Role</th>
                                            <th className="py-2.5 px-3">Designation</th>
                                            <th className="py-2.5 px-2 text-center w-10"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60 font-medium">
                                        {parsedUsers.map((u, idx) => (
                                            <tr key={u.id} className={`hover:bg-slate-50/50 dark:hover:bg-zinc-900/40 ${!u.isValid ? 'bg-rose-50/30 dark:bg-rose-950/20' : ''}`}>
                                                <td className="py-2 px-3 text-muted-foreground tabular-nums text-[11px]">
                                                    {idx + 1}
                                                </td>
                                                <td className="py-2 px-3 font-bold text-foreground whitespace-nowrap">
                                                    <Input
                                                        value={u.name}
                                                        onChange={(e) => handleUpdateRow(u.id, { name: e.target.value, isValid: !!e.target.value && u.mobileNo.length >= 10 })}
                                                        className="h-7 text-xs font-semibold px-2 w-[130px]"
                                                    />
                                                </td>
                                                <td className="py-2 px-3 whitespace-nowrap">
                                                    <Input
                                                        value={u.mobileNo}
                                                        onChange={(e) => handleUpdateRow(u.id, { mobileNo: e.target.value.replace(/\D/g, '').slice(-10), isValid: !!u.name && e.target.value.length >= 10 })}
                                                        className={`h-7 text-xs font-mono px-2 w-[110px] ${u.mobileNo.length < 10 ? 'border-rose-500 bg-rose-50 dark:bg-rose-950/40' : ''}`}
                                                    />
                                                    {u.mobileNo.length < 10 && (
                                                        <span className="text-[9px] text-rose-600 block mt-0.5">10 digits required</span>
                                                    )}
                                                </td>
                                                <td className="py-2 px-3 whitespace-nowrap text-muted-foreground">
                                                    <span className="text-[11px] block">{u.dateOfBirth || '--'}</span>
                                                    <Badge variant="outline" className="text-[9.5px] px-1 py-0 uppercase">
                                                        {u.sex}
                                                    </Badge>
                                                </td>
                                                <td className="py-2 px-3 whitespace-nowrap">
                                                    <Input
                                                        value={u.email}
                                                        placeholder="Auto internal"
                                                        onChange={(e) => handleUpdateRow(u.id, { email: e.target.value })}
                                                        className="h-7 text-xs px-2 w-[150px] text-muted-foreground"
                                                    />
                                                </td>
                                                <td className="py-2 px-3 whitespace-nowrap">
                                                    <Select 
                                                        value={u.departmentId || "none"} 
                                                        onValueChange={(val) => handleUpdateRow(u.id, { departmentId: val === "none" ? null : val })}
                                                    >
                                                        <SelectTrigger className="h-7 w-[125px] text-xs">
                                                            <SelectValue placeholder="Dept..." />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="none" className="text-xs">None</SelectItem>
                                                            {departments.map(d => (
                                                                <SelectItem key={d.id} value={d.id} className="text-xs">{d.name}</SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </td>
                                                <td className="py-2 px-3 whitespace-nowrap">
                                                    <Select 
                                                        value={u.role} 
                                                        onValueChange={(val) => handleUpdateRow(u.id, { role: val as any })}
                                                    >
                                                        <SelectTrigger className="h-7 w-[105px] text-xs font-bold">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="employee" className="text-xs">Employee</SelectItem>
                                                            <SelectItem value="moderator" className="text-xs">Moderator</SelectItem>
                                                            <SelectItem value="admin" className="text-xs">Admin</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </td>
                                                <td className="py-2 px-3 whitespace-nowrap">
                                                    <Select 
                                                        value={u.designationId || "none"} 
                                                        onValueChange={(val) => handleUpdateRow(u.id, { designationId: val === "none" ? null : val })}
                                                    >
                                                        <SelectTrigger className="h-7 w-[125px] text-xs">
                                                            <SelectValue placeholder="Desig..." />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="none" className="text-xs">None</SelectItem>
                                                            {designations.map(d => (
                                                                <SelectItem key={d.id} value={d.id} className="text-xs">{d.name}</SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </td>
                                                <td className="py-2 px-2 text-center">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => handleDeleteRow(u.id)}
                                                        className="h-7 w-7 p-0 text-muted-foreground hover:text-rose-600 rounded-lg"
                                                        title="Remove user row"
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </Button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* STEP 3: RESULTS SUMMARY */}
                    {step === 'results' && results && (
                        <div className="space-y-5 text-center py-4">
                            <div className="h-14 w-14 rounded-full bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center mx-auto">
                                <CheckCircle2 className="h-8 w-8" />
                            </div>

                            <div>
                                <h3 className="text-lg font-bold text-foreground">
                                    Bulk Import Completed
                                </h3>
                                <p className="text-xs text-muted-foreground mt-1">
                                    <span className="font-bold text-emerald-600">{results.successCount} users</span> created successfully with temporary password <span className="font-mono font-bold text-foreground">#User@1234$</span>.
                                </p>
                            </div>

                            {results.skippedRecords.length > 0 && (
                                <div className="text-left bg-amber-50/70 dark:bg-amber-950/20 p-4 rounded-xl border border-amber-200 dark:border-amber-800/40 max-h-[220px] overflow-y-auto">
                                    <span className="text-xs font-bold text-amber-800 dark:text-amber-300 block mb-2">
                                        {results.skippedRecords.length} Users Skipped (Already Registered or Invalid)
                                    </span>
                                    <ul className="space-y-1.5 text-xs text-amber-900 dark:text-amber-200 divide-y divide-amber-200/50 dark:divide-amber-800/30">
                                        {results.skippedRecords.map((s, idx) => (
                                            <li key={idx} className="pt-1 flex items-center justify-between">
                                                <span className="font-semibold">{s.name} ({s.mobileNo})</span>
                                                <span className="text-[11px] text-amber-700/80 dark:text-amber-400">{s.reason}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer Buttons */}
                <DialogFooter className="p-4 border-t border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/40 flex items-center justify-between">
                    {step === 'upload' ? (
                        <>
                            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} className="rounded-xl text-xs">
                                Cancel
                            </Button>
                            <span className="text-xs text-muted-foreground">Select an .xlsx file to continue</span>
                        </>
                    ) : step === 'mapping' ? (
                        <>
                            <Button variant="outline" size="sm" onClick={handleReset} className="rounded-xl text-xs font-semibold">
                                Re-upload File
                            </Button>
                            <div className="flex items-center gap-2">
                                <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} className="rounded-xl text-xs">
                                    Cancel
                                </Button>
                                <Button
                                    onClick={handleSubmit}
                                    disabled={validCount === 0 || bulkCreateMutation.isPending}
                                    className="rounded-xl text-xs font-bold gap-1.5 bg-primary text-white shadow-xs"
                                >
                                    {bulkCreateMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                                    Create {validCount} Users
                                </Button>
                            </div>
                        </>
                    ) : (
                        <div className="w-full flex justify-end">
                            <Button 
                                onClick={() => {
                                    handleReset()
                                    onOpenChange(false)
                                }} 
                                className="rounded-xl text-xs font-bold"
                            >
                                Done
                            </Button>
                        </div>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
