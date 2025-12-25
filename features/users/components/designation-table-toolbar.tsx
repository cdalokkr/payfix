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
import { Plus, X } from "lucide-react"

interface DesignationTableToolbarProps<TData> {
    table: Table<TData>
    onCreateDesignation: () => void
    isLoading?: boolean
    searchTerm: string
    onSearchChange: (value: string) => void
    roleFilter: string
    onRoleFilterChange: (value: string) => void
}

export function DesignationTableToolbar<TData>({
    table,
    onCreateDesignation,
    isLoading = false,
    searchTerm,
    onSearchChange,
    roleFilter,
    onRoleFilterChange,
}: DesignationTableToolbarProps<TData>) {
    return (
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
            <div className="flex-1 flex flex-col sm:flex-row gap-4 items-start sm:items-center w-full">
                <div className="relative w-full max-w-sm">
                    <Input
                        placeholder="Search by name..."
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
                <div className="flex items-center gap-2">
                    <label className="text-sm font-medium whitespace-nowrap">Role:</label>
                    <Select
                        value={roleFilter}
                        onValueChange={onRoleFilterChange}
                        disabled={isLoading}
                    >
                        <SelectTrigger className="w-32">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Roles</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="moderator">Moderator</SelectItem>
                            <SelectItem value="employee">Employee</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>
            <div className="flex items-center gap-2">
                <DataTableViewOptions table={table} />
                <Button
                    onClick={onCreateDesignation}
                    size="sm"
                    disabled={isLoading}
                    className="hidden sm:flex"
                >
                    <Plus className="mr-2 h-4 w-4" />
                    Create Designation
                </Button>
                <Button
                    onClick={onCreateDesignation}
                    size="sm"
                    disabled={isLoading}
                    className="sm:hidden"
                >
                    <Plus className="h-4 w-4" />
                </Button>
            </div>
        </div>
    )
}
