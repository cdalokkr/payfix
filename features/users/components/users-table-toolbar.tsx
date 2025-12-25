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
import { X } from "lucide-react"
import CreateUserButton from "@/components/ui/create-user-button"

interface UsersTableToolbarProps<TData> {
    table: Table<TData>
    onCreateUser?: () => void
    isLoading?: boolean
    searchTerm: string
    onSearchChange: (value: string) => void
    roleFilter: string
    onRoleFilterChange: (value: string) => void
}

export function UsersTableToolbar<TData>({
    table,
    onCreateUser,
    isLoading = false,
    searchTerm,
    onSearchChange,
    roleFilter,
    onRoleFilterChange,
}: UsersTableToolbarProps<TData>) {
    return (
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
            <div className="flex-1 flex flex-col sm:flex-row gap-4 items-start sm:items-center w-full">
                <div className="relative w-full max-w-sm">
                    <Input
                        placeholder="Search by name, email, or mobile..."
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
                {onCreateUser && (
                    <CreateUserButton
                        onClick={onCreateUser}
                        size="md"
                        disabled={isLoading}
                    >
                        Create User
                    </CreateUserButton>
                )}
            </div>
        </div>
    )
}
