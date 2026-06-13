"use client"

import { Table } from "@tanstack/react-table"
import { Input } from "@/components/ui/input"

import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { X, CheckCircle, XCircle, Loader2, Search, CalendarIcon, Check, ChevronsUpDown } from "lucide-react"
import { ActionButton } from "@/components/ui/action-button"
import { cn } from "@/lib/utils"
import { Calendar } from "@/components/ui/calendar"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { format, parseISO } from "date-fns"
import { useState, useMemo } from "react"
import { DateRange } from "react-day-picker"
import { FileSpreadsheet as IconFileTypeCsv, FileText as IconFileTypePdf } from 'lucide-react'
import { Download, CheckCircle2 } from "lucide-react"

interface AttendanceTableToolbarProps<TData> {
    table: Table<TData>
    isLoading?: boolean
    employeeFilter: string
    onEmployeeFilterChange: (value: string) => void
    uniqueEmployees: any[]
    searchQuery: string
    onSearchQueryChange: (value: string) => void
    verificationFilter: string
    onVerificationFilterChange: (value: string) => void
    dayTypeFilter: string
    onDayTypeFilterChange: (value: string) => void
    onBulkVerify: () => void
    onBulkReject: () => void
    isBulkUpdating?: boolean
    stats: {
        all: number
        pending: number
        verified: number
        rejected: number
        present: number
        halfDay: number
        weekly_off: number
        leave: number
        absent: number
        holiday: number
        extra_day: number
        noOfficeOut: number
    }
    dateFilter?: DateRange
    onDateFilterChange?: (value: DateRange | undefined) => void
    uniqueDates?: string[]
    onDownload?: (format: 'csv' | 'pdf') => void
    isDownloading?: boolean
}

export function AttendanceTableToolbar<TData>({
    table,
    isLoading = false,
    employeeFilter,
    onEmployeeFilterChange,
    uniqueEmployees,
    searchQuery,
    onSearchQueryChange,
    verificationFilter,
    onVerificationFilterChange,
    dayTypeFilter,
    onDayTypeFilterChange,
    onBulkVerify,
    onBulkReject,
    isBulkUpdating = false,
    stats,
    dateFilter,
    onDateFilterChange,
    uniqueDates = [],
    onDownload,
    isDownloading = false
}: AttendanceTableToolbarProps<TData>) {
    const [downloadFormat, setDownloadFormat] = useState<'csv' | 'pdf'>('csv')
    const [employeeComboboxOpen, setEmployeeComboboxOpen] = useState(false)
    const [employeeSearchVal, setEmployeeSearchVal] = useState("")
    const selectedRows = table.getFilteredSelectedRowModel().rows
    const hasSelection = selectedRows.length > 0

    return (
        <div className="w-full space-y-4 pb-2">
            {/* Row 1: Employee Select, Text Search, and Date Range */}
            <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between w-full">
                <div className="flex flex-col sm:flex-row flex-1 gap-3 items-stretch sm:items-center max-w-4xl">
                    {/* Employee Dropdown Selection */}
                    <div className="flex items-center gap-2 flex-1 sm:max-w-xs">
                        <Popover open={employeeComboboxOpen} onOpenChange={setEmployeeComboboxOpen}>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="outline"
                                    role="combobox"
                                    aria-expanded={employeeComboboxOpen}
                                    disabled={isLoading}
                                    className={cn(
                                        "w-full h-10 rounded-xl border-slate-200 dark:border-slate-800 justify-between px-3 font-normal bg-transparent hover:bg-transparent text-left flex items-center shadow-none text-slate-700 dark:text-slate-250",
                                        employeeFilter !== 'all' && "border-indigo-500/50 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 font-semibold"
                                    )}
                                >
                                    {employeeFilter === 'all' ? (
                                        <span className="text-[11px] font-semibold">All Employees</span>
                                    ) : (() => {
                                        const selectedEmp = uniqueEmployees.find(e => e.id === employeeFilter)
                                        if (!selectedEmp) return <span className="text-[11px]">Select Employee...</span>
                                        return (
                                            <div className="flex items-center gap-2 overflow-hidden">
                                                <div className="h-5 w-5 rounded-full overflow-hidden bg-muted flex items-center justify-center text-[8px] font-bold text-muted-foreground shrink-0">
                                                    {selectedEmp.avatar_url ? (
                                                        <img src={selectedEmp.avatar_url} alt="" className="h-full w-full object-cover" />
                                                    ) : (
                                                        <span>{selectedEmp.full_name?.split(' ').map((n: any) => n[0]).join('').slice(0, 2).toUpperCase()}</span>
                                                    )}
                                                </div>
                                                <span className="text-[11px] font-semibold truncate">
                                                    {selectedEmp.full_name} - <span className="text-[10px] font-normal opacity-70">{selectedEmp.designation?.name || 'N/A'} ({selectedEmp.role})</span>
                                                </span>
                                            </div>
                                        )
                                    })()}
                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="p-0 w-[240px] sm:w-[280px] max-h-80 flex flex-col rounded-xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl overflow-hidden" align="start">
                                {/* Search input inside popover */}
                                <div className="p-2 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
                                    <Search className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
                                    <Input
                                        placeholder="Type to filter..."
                                        value={employeeSearchVal}
                                        onChange={(e) => setEmployeeSearchVal(e.target.value)}
                                        className="h-8 py-1 text-xs border-0 focus-visible:ring-0 focus-visible:ring-offset-0 px-0 bg-transparent placeholder:text-muted-foreground/50 shadow-none"
                                        autoFocus
                                    />
                                    {employeeSearchVal && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setEmployeeSearchVal("")}
                                            className="h-6 w-6 p-0 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md text-muted-foreground"
                                        >
                                            <X className="h-3 w-3" />
                                        </Button>
                                    )}
                                </div>
                                {/* Employee options list */}
                                <div className="overflow-y-auto py-1 flex-1 max-h-60 min-h-[100px] divide-y divide-slate-50 dark:divide-slate-850">
                                    {/* All Employees option */}
                                    <button
                                        onClick={() => {
                                            onEmployeeFilterChange('all')
                                            setEmployeeComboboxOpen(false)
                                            setEmployeeSearchVal("")
                                        }}
                                        className={cn(
                                            "w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-slate-700 dark:text-slate-200",
                                            employeeFilter === 'all' && "bg-slate-50 dark:bg-slate-800 font-semibold"
                                        )}
                                    >
                                        <span className="text-[11px] font-medium">All Employees</span>
                                        {employeeFilter === 'all' && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                                    </button>
                                    
                                    {/* Filtered list */}
                                    {(() => {
                                        const filtered = uniqueEmployees.filter(emp => 
                                            emp.full_name?.toLowerCase().includes(employeeSearchVal.toLowerCase()) ||
                                            emp.email?.toLowerCase().includes(employeeSearchVal.toLowerCase()) ||
                                            emp.designation?.name?.toLowerCase().includes(employeeSearchVal.toLowerCase()) ||
                                            emp.role?.toLowerCase().includes(employeeSearchVal.toLowerCase())
                                        )
                                        
                                        if (filtered.length === 0) {
                                            return (
                                                <div className="px-3 py-6 text-[11px] text-center text-muted-foreground">
                                                    No employees found
                                                </div>
                                            )
                                        }
                                        
                                        return filtered.map((emp, index) => {
                                            const isSelected = employeeFilter === emp.id
                                            return (
                                                <button
                                                    key={emp.id || index}
                                                    onClick={() => {
                                                        onEmployeeFilterChange(emp.id)
                                                        setEmployeeComboboxOpen(false)
                                                        setEmployeeSearchVal("")
                                                    }}
                                                    className={cn(
                                                        "w-full text-left px-3 py-2 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors",
                                                        isSelected && "bg-slate-50 dark:bg-slate-800"
                                                    )}
                                                >
                                                    <div className="flex items-center gap-2 py-0.5 overflow-hidden">
                                                        {/* Initials/Avatar */}
                                                        <div className="h-5 w-5 rounded-full overflow-hidden bg-muted flex items-center justify-center text-[8px] font-bold text-muted-foreground shrink-0">
                                                            {emp.avatar_url ? (
                                                                <img src={emp.avatar_url} alt="" className="h-full w-full object-cover" />
                                                            ) : (
                                                                <span>{emp.full_name?.split(' ').map((n: any) => n[0]).join('').slice(0, 2).toUpperCase()}</span>
                                                            )}
                                                        </div>
                                                        <span className="text-[11px] font-semibold text-slate-850 dark:text-slate-200 truncate">
                                                            {emp.full_name} - <span className="text-[10px] text-muted-foreground font-normal">{emp.designation?.name || 'N/A'} ({emp.role})</span>
                                                        </span>
                                                    </div>
                                                    {isSelected && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                                                </button>
                                            )
                                        })
                                    })()}
                                </div>
                            </PopoverContent>
                        </Popover>
                    </div>

                    {/* Email/Designation Search Input (no dropdown) */}
                    <div className="relative flex-1 sm:max-w-xs">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
                        <Input
                            placeholder="Search email or designation..."
                            value={searchQuery}
                            onChange={(event) => onSearchQueryChange(event.target.value)}
                            className="pl-9 pr-9 h-10 rounded-xl border-slate-200 dark:border-slate-800"
                            disabled={isLoading}
                        />
                        {searchQuery && (
                            <Button
                                variant="ghost"
                                size="sm"
                                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent text-muted-foreground hover:text-foreground transition-colors"
                                onClick={() => onSearchQueryChange("")}
                                disabled={isLoading}
                            >
                                <X className="h-4 w-4" />
                                <span className="sr-only">Clear search</span>
                            </Button>
                        )}
                    </div>
                </div>

                {/* Date range calendar */}
                {onDateFilterChange && (
                    <div className="flex items-center gap-2">
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="outline"
                                    className={cn(
                                        "w-[240px] h-10 rounded-xl justify-start text-left font-normal border-slate-200 dark:border-slate-800",
                                        !dateFilter ? "text-muted-foreground" : "",
                                        dateFilter && "border-indigo-500/50 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 font-semibold"
                                    )}
                                    disabled={isLoading}
                                >
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {dateFilter?.from ? (
                                        dateFilter.to ? (
                                            <>
                                                {format(dateFilter.from, "LLL dd, y")} - {format(dateFilter.to, "LLL dd, y")}
                                            </>
                                        ) : (
                                            format(dateFilter.from, "LLL dd, y")
                                        )
                                    ) : (
                                        <span>Pick a date range</span>
                                    )}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="end">
                                <div className="p-2 border-b flex gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => onDateFilterChange(undefined)}
                                        className="flex-1 text-xs"
                                    >
                                        Clear
                                    </Button>
                                </div>
                                <Calendar
                                    initialFocus
                                    mode="range"
                                    defaultMonth={dateFilter?.from}
                                    selected={dateFilter}
                                    onSelect={onDateFilterChange}
                                    numberOfMonths={1}
                                    captionLayout="dropdown"
                                    fromYear={2020}
                                    toYear={2030}
                                />
                            </PopoverContent>
                        </Popover>
                    </div>
                )}
            </div>

            {/* Row 2: Status Filters, Bulk Actions, and Download controls */}
            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between w-full border-t border-slate-100 dark:border-slate-900 pt-3">
                <div className="flex flex-wrap items-center gap-4">
                    {/* Verification Status */}
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Verify:</span>
                        <Select
                            value={verificationFilter}
                            onValueChange={onVerificationFilterChange}
                            disabled={isLoading}
                        >
                            <SelectTrigger className={cn(
                                "w-36 h-9 rounded-xl border-slate-200 dark:border-slate-800 transition-colors",
                                verificationFilter !== 'all' && "border-indigo-500/50 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 font-semibold"
                            )}>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All</SelectItem>
                                <SelectItem value="pending">Pending</SelectItem>
                                <SelectItem value="verified">Verified</SelectItem>
                                <SelectItem value="rejected">Rejected</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Day Type */}
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Day Type:</span>
                        <Select
                            value={dayTypeFilter}
                            onValueChange={onDayTypeFilterChange}
                            disabled={isLoading}
                        >
                            <SelectTrigger className={cn(
                                "w-40 h-9 rounded-xl border-slate-200 dark:border-slate-800 transition-colors",
                                dayTypeFilter !== 'all' && "border-indigo-500/50 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 font-semibold"
                            )}>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All</SelectItem>
                                <SelectItem value="Not marked">Not marked</SelectItem>
                                <SelectItem value="Marked In">Marked In</SelectItem>
                                <SelectItem value="Marked Out">Marked Out</SelectItem>
                                <SelectItem value="Applied Leave">Applied Leave</SelectItem>
                                <SelectItem value="Present">Present</SelectItem>
                                <SelectItem value="Half Day">Half Day</SelectItem>
                                <SelectItem value="Weekly Off">Weekly Off</SelectItem>
                                <SelectItem value="On Leave">On Leave</SelectItem>
                                <SelectItem value="Absent">Absent</SelectItem>
                                <SelectItem value="Holiday">Holiday</SelectItem>
                                <SelectItem value="Extra Day">Extra Day</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                {/* Right Aligned Controls: Bulk Actions & Download Section */}
                <div className="flex items-center justify-end gap-3 flex-wrap">
                    {/* Bulk Selection actions */}
                    {hasSelection && (
                        <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-2 duration-200">
                            <span className="text-[11px] font-bold text-muted-foreground bg-muted/50 px-2 py-1 rounded-lg border">
                                {selectedRows.length} Selected
                            </span>
                            <ActionButton
                                action="verify"
                                size="sm"
                                onClick={onBulkVerify}
                                loading={isBulkUpdating}
                                className="h-9 px-3 rounded-xl shadow-sm"
                            >
                                Approve All
                            </ActionButton>
                            <ActionButton
                                action="reject"
                                size="sm"
                                onClick={onBulkReject}
                                loading={isBulkUpdating}
                                className="h-9 px-3 rounded-xl shadow-sm border-rose-100 bg-rose-50 text-rose-600 hover:bg-rose-100"
                            >
                                Reject All
                            </ActionButton>
                        </div>
                    )}

                    {/* Download Controls */}
                    {onDownload && (
                        <div className="flex items-center gap-2 border-l border-slate-100 dark:border-slate-900 pl-3">
                            <Select value={downloadFormat} onValueChange={(v) => setDownloadFormat(v as 'csv' | 'pdf')}>
                                <SelectTrigger className="w-[90px] h-9 rounded-xl border-slate-200 dark:border-slate-800 text-xs">
                                    <div className="flex items-center gap-1.5">
                                        {downloadFormat === 'csv' ? (
                                            <IconFileTypeCsv className="h-3.5 w-3.5 text-green-600" />
                                        ) : (
                                            <IconFileTypePdf className="h-3.5 w-3.5 text-red-600" />
                                        )}
                                        <span className="font-semibold">{downloadFormat.toUpperCase()}</span>
                                    </div>
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="csv">
                                        <div className="flex items-center gap-2 text-xs">
                                            <IconFileTypeCsv className="h-4 w-4 text-green-600" />
                                            CSV
                                        </div>
                                    </SelectItem>
                                    <SelectItem value="pdf">
                                        <div className="flex items-center gap-2 text-xs">
                                            <IconFileTypePdf className="h-4 w-4 text-red-600" />
                                            PDF
                                        </div>
                                    </SelectItem>
                                </SelectContent>
                            </Select>

                            <Button
                                variant="outline"
                                size="icon"
                                className="h-9 w-9 rounded-xl border-slate-200 dark:border-slate-800"
                                onClick={() => onDownload(downloadFormat)}
                                disabled={isDownloading || isLoading}
                            >
                                {isDownloading ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <Download className="h-4 w-4" />
                                )}
                            </Button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
