"use client"

import { Table } from "@tanstack/react-table"
import { Input } from "@/components/ui/input"
import { DataTableViewOptions } from "@/components/ui/data-table-view-options"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { X, CheckCircle, XCircle, Loader2, Search, CalendarIcon } from "lucide-react"
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

interface AttendanceTableToolbarProps<TData> {
    table: Table<TData>
    isLoading?: boolean
    searchTerm: string
    onSearchChange: (value: string) => void
    statusFilter: string
    onStatusFilterChange: (value: string) => void
    onBulkVerify: () => void
    onBulkReject: () => void
    isBulkUpdating?: boolean
    stats: {
        all: number
        pending: number
        verified: number
        halfDay: number
        rejected: number
    }
    dateFilter?: string
    onDateFilterChange?: (value: string) => void
    uniqueDates?: string[]
}

export function AttendanceTableToolbar<TData>({
    table,
    isLoading = false,
    searchTerm,
    onSearchChange,
    statusFilter,
    onStatusFilterChange,
    onBulkVerify,
    onBulkReject,
    isBulkUpdating = false,
    stats,
    dateFilter = 'all',
    onDateFilterChange,
    uniqueDates = [],
}: AttendanceTableToolbarProps<TData>) {
    const selectedRows = table.getFilteredSelectedRowModel().rows
    const hasSelection = selectedRows.length > 0

    return (
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
            <div className="flex-1 flex flex-col sm:flex-row gap-4 items-start sm:items-center w-full">
                <div className="relative w-full max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
                    <Input
                        placeholder="Search name, email or designation..."
                        value={searchTerm}
                        onChange={(event) => onSearchChange(event.target.value)}
                        className="pl-9 pr-9 h-10 rounded-xl"
                        disabled={isLoading}
                    />
                    {searchTerm && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent text-muted-foreground hover:text-foreground transition-colors"
                            onClick={() => onSearchChange("")}
                            disabled={isLoading}
                        >
                            <X className="h-4 w-4" />
                            <span className="sr-only">Clear search</span>
                        </Button>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <label className="text-sm font-medium whitespace-nowrap ">Status :</label>
                    <Select
                        value={statusFilter}
                        onValueChange={onStatusFilterChange}
                        disabled={isLoading}
                    >
                        <SelectTrigger className="w-40 h-10 rounded-xl">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">
                                <div className="flex items-center justify-between gap-2 w-full">
                                    <span>All Logs</span>
                                    <span className="text-[10px] bg-muted px-1.5 rounded-full text-muted-foreground">{stats.all}</span>
                                </div>
                            </SelectItem>
                            <SelectItem value="pending">
                                <div className="flex items-center justify-between gap-2 w-full">
                                    <span>Pending</span>
                                    <span className="text-[10px] bg-amber-100 text-amber-600 px-1.5 rounded-full">{stats.pending}</span>
                                </div>
                            </SelectItem>
                            <SelectItem value="verified">
                                <div className="flex items-center justify-between gap-2 w-full">
                                    <span>Verified</span>
                                    <span className="text-[10px] bg-emerald-100 text-emerald-600 px-1.5 rounded-full">{stats.verified}</span>
                                </div>
                            </SelectItem>
                            <SelectItem value="halfDay">
                                <div className="flex items-center justify-between gap-2 w-full">
                                    <span>Half Day</span>
                                    <span className="text-[10px] bg-indigo-100 text-indigo-600 px-1.5 rounded-full">{stats.halfDay}</span>
                                </div>
                            </SelectItem>
                            <SelectItem value="rejected">
                                <div className="flex items-center justify-between gap-2 w-full">
                                    <span>Rejected</span>
                                    <span className="text-[10px] bg-rose-100 text-rose-600 px-1.5 rounded-full">{stats.rejected}</span>
                                </div>
                            </SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                {onDateFilterChange && (
                    <div className="flex items-center gap-2">
                        <label className="text-sm font-medium whitespace-nowrap">Marked Date :</label>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="outline"
                                    className={cn(
                                        "w-40 h-10 rounded-xl justify-start text-left font-normal",
                                        !dateFilter || dateFilter === 'all' ? "text-muted-foreground" : ""
                                    )}
                                    disabled={isLoading}
                                >
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {dateFilter && dateFilter !== 'all'
                                        ? format(parseISO(dateFilter), 'dd MMM yyyy')
                                        : "All Dates"}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                                <div className="p-2 border-b flex gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => onDateFilterChange('all')}
                                        className="flex-1 text-xs"
                                    >
                                        Clear
                                    </Button>
                                </div>
                                <Calendar
                                    mode="single"
                                    captionLayout="dropdown"
                                    selected={dateFilter && dateFilter !== 'all' ? parseISO(dateFilter) : undefined}
                                    onSelect={(date) => {
                                        if (date) {
                                            onDateFilterChange(format(date, 'yyyy-MM-dd'))
                                        } else {
                                            onDateFilterChange('all')
                                        }
                                    }}
                                    modifiers={{
                                        hasData: uniqueDates.map(d => parseISO(d))
                                    }}
                                    modifiersClassNames={{
                                        hasData: "bg-primary/10 font-bold"
                                    }}
                                    fromYear={2020}
                                    toYear={new Date().getFullYear()}
                                    initialFocus
                                />
                            </PopoverContent>
                        </Popover>
                    </div>
                )}
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
                {hasSelection && (
                    <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-2 duration-300">
                        <span className="text-[11px] font-bold text-muted-foreground whitespace-nowrap bg-muted/50 px-2 py-1 rounded-lg border">
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
                <DataTableViewOptions table={table} />
            </div>
        </div>
    )
}
