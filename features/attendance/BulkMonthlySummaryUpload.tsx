"use client"

import React, { useState } from "react"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    Download,
    Upload,
    FileSpreadsheet,
    Loader2,
    CheckCircle2,
    AlertCircle,
    FileUp,
    X,
    Info,
} from "lucide-react"
import { toast } from "sonner"
import { trpc } from "@/lib/trpc/client"
import { cn } from "@/lib/utils"

const MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
]

interface BulkMonthlySummaryUploadProps {
    isOpen: boolean
    onOpenChange: (open: boolean) => void
    initialMonth?: number
    initialYear?: number
}

type UploadResult = {
    preview?: boolean
    success?: number
    skipped: number
    errors: string[]
    toInsert?: number
    toUpdate?: number
    verifiedRecords?: Array<{
        employeeName: string
        email: string
        action: 'Insert' | 'Update'
        details: string
    }>
    skippedRecords?: Array<{
        rowNum: number
        employeeName: string
        email: string
        reason: string
    }>
} | null

export function BulkMonthlySummaryUpload({
    isOpen,
    onOpenChange,
    initialMonth,
    initialYear
}: BulkMonthlySummaryUploadProps) {
    const currentDate = new Date()
    let defaultMonth = initialMonth || currentDate.getMonth()
    let defaultYear = initialYear || currentDate.getFullYear()
    if (defaultMonth === 0 && !initialMonth) {
        defaultMonth = 12
        defaultYear -= 1
    }

    const [month, setMonth] = useState(defaultMonth)
    const [year, setYear] = useState(defaultYear)
    const [isDownloading, setIsDownloading] = useState(false)
    const [isUploading, setIsUploading] = useState(false)
    const [selectedFile, setSelectedFile] = useState<File | null>(null)
    const [uploadResult, setUploadResult] = useState<UploadResult>(null)
    const [dragOver, setDragOver] = useState(false)
    const [activeTab, setActiveTab] = useState<'verified' | 'skipped'>('verified')

    const utils = trpc.useUtils()

    // Sync month/year when props change (when parent changes month/year selector)
    React.useEffect(() => {
        if (initialMonth) setMonth(initialMonth)
        if (initialYear) setYear(initialYear)
    }, [initialMonth, initialYear])

    const handleDownloadTemplate = async () => {
        setIsDownloading(true)
        try {
            const response = await fetch(
                `/api/attendance-upload/template?type=monthly&month=${month}&year=${year}`
            )

            if (!response.ok) {
                const errorData = await response.json()
                throw new Error(errorData.error || 'Failed to download template')
            }

            const blob = await response.blob()
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `monthly_summary_template_${MONTHS[month - 1]}_${year}.xlsx`
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)
            URL.revokeObjectURL(url)

            toast.success('Template downloaded successfully')
        } catch (error: any) {
            toast.error(error.message || 'Failed to download template')
        } finally {
            setIsDownloading(false)
        }
    }

    const handleFileSelect = (file: File) => {
        if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
            toast.error('Please select an Excel file (.xlsx or .xls)')
            return
        }
        if (file.size > 10 * 1024 * 1024) {
            toast.error('File size must be less than 10MB')
            return
        }
        setSelectedFile(file)
        setUploadResult(null)
        setActiveTab('verified')
    }

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault()
        setDragOver(false)
        const file = e.dataTransfer.files[0]
        if (file) handleFileSelect(file)
    }

    const handleUpload = async (isConfirm = false) => {
        if (!selectedFile) return

        setIsUploading(true)
        if (!isConfirm) setUploadResult(null)

        try {
            const formData = new FormData()
            formData.append('file', selectedFile)
            formData.append('type', 'monthly')
            formData.append('month', String(month))
            formData.append('year', String(year))
            formData.append('preview', String(!isConfirm))

            const response = await fetch('/api/attendance-upload/upload', {
                method: 'POST',
                body: formData,
            })

            const result = await response.json()

            if (!response.ok) {
                throw new Error(result.error || 'Upload failed')
            }

            setUploadResult(result)

            if (!isConfirm) {
                toast.info('Preview generated. Please confirm details below.')
            } else {
                if (result.success > 0) {
                    toast.success(`${result.success} records uploaded successfully`)
                    utils.salary.getMonthlySummaries.invalidate()
                } else if (result.skipped > 0 && result.success === 0) {
                    toast.warning('No new records uploaded — all rows were duplicates or already processed')
                }
            }
        } catch (error: any) {
            toast.error(error.message || 'Upload failed')
        } finally {
            setIsUploading(false)
        }
    }

    const handleClose = (open: boolean) => {
        if (!open) {
            setSelectedFile(null)
            setUploadResult(null)
        }
        onOpenChange(open)
    }

    // Utility to determine if a month is in the future or current month
    const isMonthDisabled = (mIndex: number, selectedYear: number) => {
        const currentM = currentDate.getMonth() + 1 // 1-12
        const currentY = currentDate.getFullYear()
        
        if (selectedYear > currentY) return true
        if (selectedYear === currentY && mIndex >= currentM) return true
        return false
    }

    return (
        <Dialog open={isOpen} onOpenChange={handleClose}>
            <DialogContent className="w-full sm:max-w-4xl max-h-[90vh] overflow-y-auto p-6">
                <DialogHeader className="pb-4 border-b border-border/50">
                    <DialogTitle className="flex items-center gap-2 text-lg">
                        <div className="p-1.5 rounded-lg bg-blue-500/10">
                            <FileUp className="h-4 w-4 text-blue-500" />
                        </div>
                        Upload Monthly Summary
                    </DialogTitle>
                    <DialogDescription>
                        Upload monthly attendance summary (present, absent, leave, half-days) directly for payslip processing.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                    {/* Step 1: Download Template */}
                    <div className="flex flex-col space-y-3">
                        <div className="flex items-center gap-2">
                            <span className="flex items-center justify-center h-6 w-6 rounded-full bg-blue-500 text-white text-xs font-bold">1</span>
                            <h3 className="font-semibold text-sm">Download Template</h3>
                        </div>

                        <div className="p-4 rounded-xl bg-muted/30 border border-border/50 space-y-4 flex-1 flex flex-col justify-between min-h-[210px]">
                            <div className="flex items-center gap-2">
                                <Select value={String(month)} onValueChange={(val) => setMonth(Number(val))}>
                                    <SelectTrigger className="w-[130px] h-9 rounded-lg text-xs">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {MONTHS.map((m, i) => {
                                            const mNum = i + 1
                                            return (
                                                <SelectItem 
                                                    key={i} 
                                                    value={String(mNum)}
                                                    disabled={isMonthDisabled(mNum, year)}
                                                >
                                                    {m}
                                                </SelectItem>
                                            )
                                        })}
                                    </SelectContent>
                                </Select>
                                <Select value={String(year)} onValueChange={(val) => {
                                    const newYear = Number(val)
                                    setYear(newYear)
                                    if (isMonthDisabled(month, newYear)) {
                                        setMonth(1)
                                        if (newYear === currentDate.getFullYear()) {
                                            setMonth(Math.max(1, currentDate.getMonth()))
                                        }
                                    }
                                }}>
                                    <SelectTrigger className="w-[90px] h-9 rounded-lg text-xs">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {Array.from({ length: 5 }, (_, i) => currentDate.getFullYear() - 2 + i)
                                            .filter(y => y <= currentDate.getFullYear())
                                            .map(y => (
                                                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                                            ))}
                                    </SelectContent>
                                </Select>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-9 gap-1.5 rounded-lg ml-auto"
                                    onClick={handleDownloadTemplate}
                                    disabled={isDownloading}
                                >
                                    {isDownloading ? (
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                        <Download className="h-3.5 w-3.5" />
                                    )}
                                    Download
                                </Button>
                            </div>

                            <div className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-500/5 border border-amber-500/10">
                                <Info className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
                                <p className="text-[11px] text-muted-foreground leading-relaxed">
                                    This template has one row per employee. Fill in <strong>Total Working Days</strong>,{" "}
                                    <strong>Present</strong>, <strong>Absent</strong>, <strong>Half Days</strong>,{" "}
                                    <strong>Leaves</strong>, and <strong>Hours</strong>. Records go directly to the monthly
                                    summary table as drafts — bypassing daily verification.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Step 2: Upload Filled Sheet */}
                    <div className="flex flex-col space-y-3">
                        <div className="flex items-center gap-2">
                            <span className="flex items-center justify-center h-6 w-6 rounded-full bg-blue-500 text-white text-xs font-bold">2</span>
                            <h3 className="font-semibold text-sm">Upload Filled Sheet</h3>
                        </div>

                        <div className="p-4 rounded-xl bg-muted/30 border border-border/50 flex-1 flex flex-col justify-between gap-3 min-h-[210px]">
                            {/* File Drop Zone */}
                            <div
                                className={cn(
                                    "relative rounded-xl border-2 border-dashed transition-all duration-200 cursor-pointer flex-1 flex flex-col justify-center min-h-[90px]",
                                    dragOver
                                        ? "border-blue-500 bg-blue-500/5 scale-[1.01]"
                                        : selectedFile
                                            ? "border-emerald-500/30 bg-emerald-500/5"
                                            : "border-border/50 bg-background/50 hover:border-muted-foreground/30 hover:bg-background"
                                )}
                                onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                                onDragLeave={() => setDragOver(false)}
                                onDrop={handleDrop}
                                onClick={() => {
                                    const input = document.createElement('input')
                                    input.type = 'file'
                                    input.accept = '.xlsx,.xls'
                                    input.onchange = (e: any) => {
                                        const file = e.target.files?.[0]
                                        if (file) handleFileSelect(file)
                                    }
                                    input.click()
                                }}
                            >
                                <div className="flex flex-col items-center py-3 px-4 text-center">
                                    {selectedFile ? (
                                        <>
                                            <FileSpreadsheet className="h-7 w-7 text-emerald-500 mb-1" />
                                            <p className="text-xs font-medium text-foreground truncate max-w-[200px]">{selectedFile.name}</p>
                                            <p className="text-[10px] text-muted-foreground mt-0.5">
                                                {(selectedFile.size / 1024).toFixed(1)} KB
                                            </p>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="mt-1 h-6 text-[10px] text-muted-foreground py-0"
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    setSelectedFile(null)
                                                    setUploadResult(null)
                                                }}
                                            >
                                                <X className="h-3 w-3 mr-1" />
                                                Remove
                                            </Button>
                                        </>
                                    ) : (
                                        <>
                                            <FileUp className="h-7 w-7 text-muted-foreground/40 mb-1" />
                                            <p className="text-xs font-medium text-muted-foreground">
                                                Drop your Excel file here
                                            </p>
                                            <p className="text-[10px] text-muted-foreground/75 mt-0.5">
                                                or click to browse • .xlsx only
                                            </p>
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* Upload Button */}
                            <Button
                                className="w-full gap-2 rounded-xl h-10 mt-auto shrink-0"
                                onClick={() => handleUpload(uploadResult?.preview === true)}
                                disabled={!selectedFile || isUploading}
                            >
                                {isUploading ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        Processing...
                                    </>
                                ) : uploadResult?.preview === true ? (
                                    <>
                                        <CheckCircle2 className="h-4 w-4" />
                                        Confirm & Save to Database
                                    </>
                                ) : (
                                    <>
                                        <Upload className="h-4 w-4" />
                                        Generate Upload Preview
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Preview / Results Panel (Below Option 1 & 2) */}
                <div className="mt-6 border-t border-border/50 pt-6">
                    {uploadResult ? (
                        <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <div className="flex items-center gap-2">
                                <span className={cn(
                                    "flex items-center justify-center h-6 w-6 rounded-full text-white text-xs font-bold",
                                    uploadResult.preview ? "bg-blue-500" : "bg-emerald-500"
                                )}>
                                    {uploadResult.preview ? "ℹ" : "✓"}
                                </span>
                                <h3 className="font-semibold text-sm">
                                    {uploadResult.preview ? "Upload Preview Report" : "Upload Success Results"}
                                </h3>
                            </div>

                            <div className={cn(
                                "p-4 rounded-xl border space-y-4 bg-card",
                                uploadResult.preview ? "border-blue-500/20 bg-blue-500/5" : "border-emerald-500/20 bg-emerald-500/5"
                            )}>
                                {uploadResult.preview ? (
                                    <>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                            <div className="flex items-center gap-2.5 p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
                                                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                                                <div>
                                                    <p className="text-[10px] text-muted-foreground">To Insert</p>
                                                    <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400">{uploadResult.toInsert || 0}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2.5 p-3 rounded-lg bg-indigo-500/5 border border-indigo-500/10">
                                                <Upload className="h-4 w-4 text-indigo-500" />
                                                <div>
                                                    <p className="text-[10px] text-muted-foreground">To Update</p>
                                                    <p className="text-xs font-bold text-indigo-600 dark:text-indigo-400">{uploadResult.toUpdate || 0}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2.5 p-3 rounded-lg bg-amber-500/5 border border-amber-500/10">
                                                <AlertCircle className="h-4 w-4 text-amber-500" />
                                                <div>
                                                    <p className="text-[10px] text-muted-foreground">Skipped</p>
                                                    <p className="text-xs font-bold text-amber-600 dark:text-amber-400">{uploadResult.skipped || 0}</p>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex border-b border-border/50 mt-4 mb-2">
                                            <button
                                                type="button"
                                                className={cn(
                                                    "pb-2 px-3 text-xs font-semibold border-b-2 transition-colors",
                                                    activeTab === 'verified'
                                                        ? "border-primary text-primary"
                                                        : "border-transparent text-muted-foreground hover:text-foreground"
                                                )}
                                                onClick={() => setActiveTab('verified')}
                                            >
                                                Verified ({uploadResult.verifiedRecords?.length || 0})
                                            </button>
                                            <button
                                                type="button"
                                                className={cn(
                                                    "pb-2 px-3 text-xs font-semibold border-b-2 transition-colors",
                                                    activeTab === 'skipped'
                                                        ? "border-amber-500 text-amber-600 dark:text-amber-400"
                                                        : "border-transparent text-muted-foreground hover:text-foreground"
                                                )}
                                                onClick={() => setActiveTab('skipped')}
                                            >
                                                Skipped & Errors ({uploadResult.skippedRecords?.length || 0})
                                            </button>
                                        </div>

                                        {activeTab === 'verified' && (
                                            <div className="max-h-[300px] overflow-y-auto border border-border/50 rounded-lg bg-muted/10 divide-y divide-border/30">
                                                {(!uploadResult.verifiedRecords || uploadResult.verifiedRecords.length === 0) ? (
                                                    <p className="p-4 text-xs text-center text-muted-foreground">No verified records ready for upload.</p>
                                                ) : (
                                                    uploadResult.verifiedRecords.map((rec, i) => (
                                                        <div key={i} className="p-2 flex items-center justify-between text-xs hover:bg-muted/30 transition-colors">
                                                            <div className="space-y-0.5 min-w-0 pr-2">
                                                                <p className="font-semibold text-foreground truncate">{rec.employeeName}</p>
                                                                <p className="text-[10px] text-muted-foreground truncate">{rec.email}</p>
                                                            </div>
                                                            <div className="text-right shrink-0 space-y-1">
                                                                <span className={cn(
                                                                    "inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider",
                                                                    rec.action === 'Insert'
                                                                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                                                                        : "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20"
                                                                )}>
                                                                    {rec.action}
                                                                </span>
                                                                <p className="text-[10px] text-muted-foreground">{rec.details}</p>
                                                            </div>
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        )}

                                        {activeTab === 'skipped' && (
                                            <div className="max-h-[300px] overflow-y-auto border border-border/50 rounded-lg bg-muted/10 divide-y divide-border/30">
                                                {(!uploadResult.skippedRecords || uploadResult.skippedRecords.length === 0) ? (
                                                    <p className="p-4 text-xs text-center text-muted-foreground">No skipped records or errors found.</p>
                                                ) : (
                                                    uploadResult.skippedRecords.map((rec, i) => (
                                                        <div key={i} className="p-2 flex flex-col gap-0.5 text-xs hover:bg-muted/30 transition-colors">
                                                            <div className="flex items-center justify-between font-semibold">
                                                                <span className="truncate text-foreground max-w-[200px]">{rec.employeeName || 'Blank Row'}</span>
                                                                {rec.rowNum > 0 && (
                                                                    <span className="text-[10px] px-1.5 py-0.5 bg-muted border border-border rounded font-mono">
                                                                        Row {rec.rowNum}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            {rec.email && <p className="text-[10px] text-muted-foreground truncate">{rec.email}</p>}
                                                            <div className="flex items-center gap-1.5 mt-0.5">
                                                                <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium leading-relaxed">
                                                                    {rec.reason}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <div className="grid grid-cols-2 gap-3 max-w-md mx-auto">
                                        <div className="flex items-center gap-3 p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
                                            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                                            <div>
                                                <p className="text-xs text-muted-foreground">Processed</p>
                                                <p className="text-base font-bold text-emerald-600 dark:text-emerald-400">{uploadResult.success || 0}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3 p-3 rounded-lg bg-amber-500/5 border border-amber-500/10">
                                            <AlertCircle className="h-5 w-5 text-amber-500" />
                                            <div>
                                                <p className="text-xs text-muted-foreground">Skipped</p>
                                                <p className="text-base font-bold text-amber-600 dark:text-amber-400">{uploadResult.skipped || 0}</p>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {uploadResult.errors.length > 0 && (
                                    <div className="mt-2 p-3 rounded-lg bg-rose-500/5 border border-rose-500/10">
                                        <p className="text-xs font-semibold text-rose-600 mb-1">
                                            Errors ({uploadResult.errors.length}):
                                        </p>
                                        <div className="max-h-24 overflow-y-auto space-y-1">
                                            {uploadResult.errors.slice(0, 10).map((err, i) => (
                                                <p key={i} className="text-[10px] text-rose-500/80 leading-normal">{err}</p>
                                            ))}
                                            {uploadResult.errors.length > 10 && (
                                                <p className="text-[10px] text-rose-500/60 italic">
                                                    ...and {uploadResult.errors.length - 10} more
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center p-8 rounded-xl border border-dashed border-border/60 bg-muted/5 min-h-[180px] text-center">
                            <div className="p-3 rounded-full bg-blue-500/5 text-blue-500 mb-2 border border-blue-500/10 animate-pulse">
                                <FileSpreadsheet className="h-5 w-5" />
                            </div>
                            <h4 className="text-sm font-semibold text-foreground">Upload Preview Report</h4>
                            <p className="text-xs text-muted-foreground max-w-[420px] mt-1 leading-relaxed">
                                Fill in the template, select the file, and click <strong>&quot;Generate Upload Preview&quot;</strong> to inspect verified records and skip anomalies before saving.
                            </p>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
}
