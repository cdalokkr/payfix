"use client"

import { Table } from "@tanstack/react-table"
import { Input } from "@/components/ui/input"
import { DataTableViewOptions } from "@/components/ui/data-table-view-options"
import { Button } from "@/components/ui/button"
import { X, Plus } from "lucide-react"

interface ClientsTableToolbarProps<TData> {
    table: Table<TData>
    onCreateClient?: () => void
    isLoading?: boolean
    searchTerm: string
    onSearchChange: (value: string) => void
}

export function ClientsTableToolbar<TData>({
    table,
    onCreateClient,
    isLoading = false,
    searchTerm,
    onSearchChange,
}: ClientsTableToolbarProps<TData>) {
    return (
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
            <div className="flex-1 flex flex-col sm:flex-row gap-4 items-start sm:items-center w-full">
                <div className="relative w-full max-w-sm">
                    <Input
                        placeholder="Search clients..."
                        value={searchTerm}
                        onChange={(event) => onSearchChange(event.target.value)}
                        className="pr-9"
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
            </div>
            <div className="flex items-center gap-2">
                <DataTableViewOptions table={table} />
                {onCreateClient && (
                    <Button onClick={onCreateClient} disabled={isLoading} className="gap-2 shrink-0">
                        <Plus className="h-4 w-4" /> Add Client
                    </Button>
                )}
            </div>
        </div>
    )
}
