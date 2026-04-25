"use client"

import React, { useState } from "react"
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
} from "@/components/ui/sheet"
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
    success: number
    skipped: number
    errors: string[]
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
    }

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault()
        setDragOver(false)
        const file = e.dataTransfer.files[0]
        if (file) handleFileSelect(file)
    }

    const handleUpload = async () => {
        if (!selectedFile) return

        setIsUploading(true)
        setUploadResult(null)

        try {
            const formData = new FormData()
            formData.append('file', selectedFile)
            formData.append('type', 'monthly')
            formData.append('month', String(month))
            formData.append('year', String(year))

            const response = await fetch('/api/attendance-upload/upload', {
                method: 'POST',
                body: formData,
            })

            const result = await response.json()

            if (!response.ok) {
                throw new Error(result.error || 'Upload failed')
            }

            setUploadResult(result)

            if (result.success > 0) {
                toast.success(`${result.success} records uploaded successfully`)
                // Invalidate monthly summary queries
                utils.salary.getMonthlySummaries.invalidate()
            } else if (result.skipped > 0 && result.success === 0) {
                toast.warning('No new records uploaded — all rows were duplicates or already processed')
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
        <Sheet open={isOpen} onOpenChange={handleClose}>
            <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
                <SheetHeader className="pb-2">
                    <SheetTitle className="flex items-center gap-2 text-lg">
                        <div className="p-1.5 rounded-lg bg-blue-500/10">
                            <FileUp className="h-4 w-4 text-blue-500" />
                        </div>
                        Upload Monthly Summary
                    </SheetTitle>
                    <SheetDescription>
                        Upload monthly attendance summary (present, absent, leave, half-days) directly for payslip processing.
                    </SheetDescription>
                </SheetHeader>

                <div className="space-y-6 px-4 pb-6">
                    {/* Step 1: Download Template */}
                    <div className="space-y-3">
                        <div className="flex items-center gap-2">
                            <span className="flex items-center justify-center h-6 w-6 rounded-full bg-blue-500 text-white text-xs font-bold">1</span>
                            <h3 className="font-semibold text-sm">Download Template</h3>
                        </div>

                        <div className="p-3 rounded-xl bg-muted/30 border border-border/50 space-y-3">
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
                                    // If changing year makes current month selection invalid, reset it
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

                    {/* Step 2: Upload */}
                    <div className="space-y-3">
                        <div className="flex items-center gap-2">
                            <span className="flex items-center justify-center h-6 w-6 rounded-full bg-blue-500 text-white text-xs font-bold">2</span>
                            <h3 className="font-semibold text-sm">Upload Filled Sheet</h3>
                        </div>

                        {/* File Drop Zone */}
                        <div
                            className={cn(
                                "relative rounded-xl border-2 border-dashed transition-all duration-200 cursor-pointer",
                                dragOver
                                    ? "border-blue-500 bg-blue-500/5 scale-[1.01]"
                                    : selectedFile
                                        ? "border-emerald-500/30 bg-emerald-500/5"
                                        : "border-border/50 bg-muted/20 hover:border-muted-foreground/30 hover:bg-muted/30"
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
                            <div className="flex flex-col items-center py-6 px-4 text-center">
                                {selectedFile ? (
                                    <>
                                        <FileSpreadsheet className="h-8 w-8 text-emerald-500 mb-2" />
                                        <p className="text-sm font-medium text-foreground">{selectedFile.name}</p>
                                        <p className="text-[11px] text-muted-foreground mt-0.5">
                                            {(selectedFile.size / 1024).toFixed(1)} KB
                                        </p>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="mt-2 h-7 text-xs text-muted-foreground"
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
                                        <FileUp className="h-8 w-8 text-muted-foreground/40 mb-2" />
                                        <p className="text-sm font-medium text-muted-foreground">
                                            Drop your Excel file here
                                        </p>
                                        <p className="text-[11px] text-muted-foreground/70 mt-0.5">
                                            or click to browse • .xlsx only
                                        </p>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Upload Button */}
                        <Button
                            className="w-full gap-2 rounded-xl h-10"
                            onClick={handleUpload}
                            disabled={!selectedFile || isUploading}
                        >
                            {isUploading ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Processing...
                                </>
                            ) : (
                                <>
                                    <Upload className="h-4 w-4" />
                                    Upload & Process
                                </>
                            )}
                        </Button>
                    </div>

                    {/* Upload Result */}
                    {uploadResult && (
                        <div className="space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <div className="flex items-center gap-2">
                                <span className="flex items-center justify-center h-6 w-6 rounded-full bg-emerald-500 text-white text-xs font-bold">✓</span>
                                <h3 className="font-semibold text-sm">Upload Results</h3>
                            </div>

                            <div className="p-3 rounded-xl border border-border/50 bg-card space-y-2">
                                <div className="grid grid-cols-2 gap-2">
                                    <div className="flex items-center gap-2 p-2 rounded-lg bg-emerald-500/5">
                                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                                        <div>
                                            <p className="text-xs text-muted-foreground">Processed</p>
                                            <p className="text-sm font-bold text-emerald-600">{uploadResult.success}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 p-2 rounded-lg bg-amber-500/5">
                                        <AlertCircle className="h-4 w-4 text-amber-500" />
                                        <div>
                                            <p className="text-xs text-muted-foreground">Skipped</p>
                                            <p className="text-sm font-bold text-amber-600">{uploadResult.skipped}</p>
                                        </div>
                                    </div>
                                </div>

                                {uploadResult.errors.length > 0 && (
                                    <div className="mt-2 p-2 rounded-lg bg-rose-500/5 border border-rose-500/10">
                                        <p className="text-[11px] font-medium text-rose-600 mb-1">
                                            Errors ({uploadResult.errors.length}):
                                        </p>
                                        <div className="max-h-32 overflow-y-auto space-y-0.5">
                                            {uploadResult.errors.slice(0, 10).map((err, i) => (
                                                <p key={i} className="text-[10px] text-rose-500/80">{err}</p>
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
                    )}
                </div>
            </SheetContent>
        </Sheet>
    )
}
