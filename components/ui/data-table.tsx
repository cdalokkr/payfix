"use client"

import * as React from "react"
import {
    ColumnDef,
    ColumnFiltersState,
    SortingState,
    VisibilityState,
    flexRender,
    getCoreRowModel,
    getFilteredRowModel,
    getPaginationRowModel,
    getSortedRowModel,
    useReactTable,
    RowSelectionState,
    Table as TableType,
} from "@tanstack/react-table"

import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { DataTablePagination } from "@/components/ui/data-table-pagination"
import { Skeleton } from "@/components/ui/skeleton"
import { FileX } from "lucide-react"
import { cn } from "@/lib/utils"

interface DataTableProps<TData, TValue> {
    columns: ColumnDef<TData, TValue>[]
    data: TData[]
    toolbar?: (table: TableType<TData>) => React.ReactNode
    isLoading?: boolean
    recentlyUpdatedId?: string | null
    rowSelection?: RowSelectionState
    onRowSelectionChange?: React.Dispatch<React.SetStateAction<RowSelectionState>>
    hidePagination?: boolean
    meta?: Record<string, any>
    emptyIcon?: React.ReactNode
    emptyMessage?: string
    getRowId?: (row: TData) => string
}

export function DataTable<TData, TValue>({
    columns,
    data,
    toolbar,
    isLoading = false,
    recentlyUpdatedId,
    rowSelection: externalRowSelection,
    onRowSelectionChange: externalOnRowSelectionChange,
    hidePagination = false,
    meta,
    emptyIcon,
    emptyMessage = "No Record Found",
    getRowId,
}: DataTableProps<TData, TValue>) {
    const [internalRowSelection, setInternalRowSelection] = React.useState<RowSelectionState>({})

    const rowSelection = externalRowSelection ?? internalRowSelection
    const setRowSelection = externalOnRowSelectionChange ?? setInternalRowSelection

    const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({})
    const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
    const [sorting, setSorting] = React.useState<SortingState>([])

    const table = useReactTable({
        data,
        columns,
        state: {
            sorting,
            columnVisibility,
            rowSelection,
            columnFilters,
        },
        enableRowSelection: true,
        onRowSelectionChange: setRowSelection,
        onSortingChange: setSorting,
        onColumnFiltersChange: setColumnFilters,
        onColumnVisibilityChange: setColumnVisibility,
        getCoreRowModel: getCoreRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getRowId: getRowId || ((row) => (row as { id: string }).id),
        meta,
    })

    // Effect to unselect the row when it's recently updated
    React.useEffect(() => {
        let isEffectMounted = true
        if (recentlyUpdatedId && rowSelection[recentlyUpdatedId]) {
            setRowSelection((prev) => {
                if (!isEffectMounted) return prev
                const newSelection = { ...prev }
                delete newSelection[recentlyUpdatedId]
                return newSelection
            })
        }
        return () => {
            isEffectMounted = false
        }
    }, [recentlyUpdatedId, rowSelection, setRowSelection])

    return (
        <div className="space-y-4">
            {toolbar && toolbar(table)}

            {/* Desktop Table View */}
            <div className="hidden md:block rounded-md border border-border/60">
                <Table>
                    <TableHeader>
                        {table.getHeaderGroups().map((headerGroup) => (
                            <TableRow key={headerGroup.id}>
                                {headerGroup.headers.map((header) => {
                                    if (!header.column.getIsVisible()) return null
                                    return (
                                        <TableHead
                                            key={header.id}
                                            colSpan={header.colSpan}
                                            style={{ width: header.column.columnDef.size }}
                                        >
                                            {header.isPlaceholder
                                                ? null
                                                : flexRender(
                                                    header.column.columnDef.header,
                                                    header.getContext()
                                                )}
                                        </TableHead>
                                    )
                                })}
                            </TableRow>
                        ))}
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            Array.from({ length: 10 }).map((_, i) => (
                                <TableRow key={i} className="hover:bg-transparent">
                                    {columns.map((_, j) => (
                                        <TableCell key={j} className="py-4 text-center">
                                            <Skeleton className="h-6 w-full animate-pulse bg-muted/30 rounded-lg" />
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))
                        ) : table.getRowModel().rows?.length ? (
                            table.getRowModel().rows.map((row) => (
                                <TableRow
                                    key={row.id}
                                    data-state={row.getIsSelected() && "selected"}
                                    className={
                                        // @ts-expect-error - accessing id from original data which might not exist on TData
                                        row.original?.id === recentlyUpdatedId ? "animate-fade-green" : ""
                                    }
                                >
                                    {row.getVisibleCells().map((cell) => (
                                        <TableCell
                                            key={cell.id}
                                            style={{ width: cell.column.columnDef.size }}
                                        >
                                            {flexRender(
                                                cell.column.columnDef.cell,
                                                cell.getContext()
                                            )}
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))
                        ) : (
                            <TableRow className="hover:bg-transparent">
                                <TableCell
                                    colSpan={table.getVisibleLeafColumns().length}
                                    className="h-32 text-center bg-muted/30"
                                >
                                    <div className="flex flex-col items-center justify-center gap-2 py-4">
                                        {emptyIcon || <FileX className="size-10 text-muted-foreground/30" />}
                                        <p className="text-sm text-muted-foreground font-medium">{emptyMessage}</p>
                                    </div>
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Mobile Stacked Card View */}
            <div className="md:hidden space-y-4">
                {isLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="p-4 border border-border/60 rounded-xl space-y-3 bg-card animate-pulse">
                            <div className="flex justify-between items-center pb-2 border-b border-border/40">
                                <Skeleton className="h-5 w-24 rounded-md" />
                                <Skeleton className="h-5 w-12 rounded-md" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <Skeleton className="h-3 w-16" />
                                    <Skeleton className="h-4 w-28" />
                                </div>
                                <div className="space-y-1">
                                    <Skeleton className="h-3 w-16" />
                                    <Skeleton className="h-4 w-24" />
                                </div>
                            </div>
                        </div>
                    ))
                ) : table.getRowModel().rows?.length ? (
                    table.getRowModel().rows.map((row) => {
                        const selectCell = row.getVisibleCells().find(c => c.column.id === 'select')
                        const actionsCell = row.getVisibleCells().find(c => c.column.id === 'actions')
                        const dataCells = row.getVisibleCells().filter(c => c.column.id !== 'select' && c.column.id !== 'actions')

                        return (
                            <div
                                key={row.id}
                                className={cn(
                                    "p-4 border rounded-xl space-y-3 shadow-xs transition-all duration-200 border-border/60 premium-glass-card",
                                    row.getIsSelected() && "border-primary bg-primary/5",
                                    // @ts-expect-error
                                    row.original?.id === recentlyUpdatedId ? "animate-fade-green" : ""
                                )}
                            >
                                {/* Header with actions and checkboxes */}
                                {(selectCell || actionsCell) && (
                                    <div className="flex items-center justify-between border-b pb-2 border-border/40">
                                        {selectCell ? (
                                            <div className="flex items-center gap-2">
                                                {flexRender(selectCell.column.columnDef.cell, selectCell.getContext())}
                                                <span className="text-xs font-semibold text-muted-foreground">Select</span>
                                            </div>
                                        ) : <div />}
                                        
                                        {actionsCell && (
                                            <div>
                                                {flexRender(actionsCell.column.columnDef.cell, actionsCell.getContext())}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Card fields grid */}
                                <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                                    {dataCells.map((cell) => {
                                        const header = cell.column.columnDef.header
                                        const headerText = typeof header === 'string'
                                            ? header
                                            : cell.column.id.charAt(0).toUpperCase() + cell.column.id.slice(1).replace(/_/g, ' ').replace(/-/g, ' ')
                                        
                                        return (
                                            <div key={cell.id} className="flex flex-col gap-0.5 min-w-0">
                                                <span className="text-[10px] text-muted-foreground/80 font-bold uppercase tracking-wider">{headerText}</span>
                                                <div className="text-foreground font-semibold truncate">
                                                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        )
                    })
                ) : (
                    <div className="p-8 border border-border/60 rounded-xl bg-card/50 text-center text-muted-foreground flex flex-col items-center justify-center gap-2">
                        {emptyIcon || <FileX className="size-10 text-muted-foreground/30" />}
                        <p className="text-sm font-medium">{emptyMessage}</p>
                    </div>
                )}
            </div>

            {!hidePagination && table.getFilteredRowModel().rows.length > 0 && (
                <DataTablePagination table={table} />
            )}
        </div>
    )
}
