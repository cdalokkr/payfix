"use client"

import { ColumnDef, Row } from "@tanstack/react-table"
import { Checkbox } from "@/components/ui/checkbox"
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header"
import { Button } from "@/components/ui/button"
import { Building2, MoreHorizontal, Edit, Trash2, Power, PowerOff, X } from "lucide-react"
import { cn } from "@/lib/utils"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

// You can use a generic any type for the client row or the exact inferred router type, using any for flexibility here
type ClientRow = any

interface ColumnActionsProps {
    client: ClientRow
    row: Row<ClientRow>
    onEdit: (client: ClientRow) => void
    onDelete: (client: ClientRow) => void
    onToggleStatus: (client: ClientRow) => void
    isToggling?: boolean
}

function ColumnActions({ client, row, onEdit, onDelete, onToggleStatus, isToggling }: ColumnActionsProps) {
    const isActive = client.status !== 'inactive'

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 hover:bg-muted transition-colors"
                    onClick={(e) => e.stopPropagation()}
                >
                    <span className="sr-only">Open menu</span>
                    <MoreHorizontal className="h-4 w-4" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[180px]">
                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => {
                    row.toggleSelected(true)
                    onEdit(client)
                }}>
                    <Edit className="mr-2 h-4 w-4 text-purple-600" />
                    <span>Edit Client</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => {
                    row.toggleSelected(true)
                    onToggleStatus(client)
                }} disabled={isToggling}>
                    {isActive ? (
                        <>
                            <PowerOff className="mr-2 h-4 w-4 text-rose-600" />
                            <span>Deactivate Client</span>
                        </>
                    ) : (
                        <>
                            <Power className="mr-2 h-4 w-4 text-emerald-600" />
                            <span>Activate Client</span>
                        </>
                    )}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                    onClick={() => {
                        row.toggleSelected(true)
                        onDelete(client)
                    }}
                    className="text-rose-600 focus:text-rose-600 focus:bg-rose-50 dark:focus:bg-rose-950/30"
                >
                    <Trash2 className="mr-2 h-4 w-4" />
                    <span>Delete Client</span>
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}

export function createClientsColumns(
    onEdit: (client: ClientRow) => void,
    onDelete: (client: ClientRow) => void,
    onToggleStatus: (client: ClientRow) => void,
    updatedCells: Record<string, string[]> = {},
    showActions: boolean = true
): ColumnDef<ClientRow>[] {
    const isUpdated = (clientId: string, fields: string[]) => {
        const clientUpdates = updatedCells[clientId] || []
        return fields.some(field => clientUpdates.includes(field))
    }

    const updatedBorderClass = "ring-1 ring-blue-400 rounded"

    // Helper to determine checkbox color class
    const getCheckboxColorClass = (rowId?: string, table?: any) => {
        const meta = table?.options?.meta as any
        const editingId = meta?.editingId
        const deletingId = meta?.deletingId

        if (rowId && rowId === editingId) {
            return "data-[state=checked]:bg-purple-600 data-[state=checked]:border-purple-600"
        }
        if (rowId && rowId === deletingId) {
            return "data-[state=checked]:bg-red-600 data-[state=checked]:border-red-600"
        }
        if (!rowId && editingId) {
            return "data-[state=checked]:bg-purple-600 data-[state=checked]:border-purple-600"
        }
        if (!rowId && deletingId) {
            return "data-[state=checked]:bg-red-600 data-[state=checked]:border-red-600"
        }

        return "data-[state=checked]:border-primary"
    }

    const cols: ColumnDef<ClientRow>[] = []

    // 1. Selection column
    if (showActions) {
        cols.push({
            id: "select",
            header: ({ table }) => (
                <Checkbox
                    checked={
                        table.getIsAllPageRowsSelected() ||
                        (table.getIsSomePageRowsSelected() && "indeterminate")
                    }
                    onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
                    aria-label="Select all"
                    className={`h-4.5 w-4.5 rounded-sm border border-muted-foreground/50 ${getCheckboxColorClass(undefined, table)}`}
                />
            ),
            cell: ({ row, table }) => (
                <Checkbox
                    checked={row.getIsSelected()}
                    onCheckedChange={(value) => row.toggleSelected(!!value)}
                    aria-label="Select row"
                    className={`h-4.5 w-4.5 rounded-sm border border-muted-foreground/50 ${getCheckboxColorClass(row.original.id, table)}`}
                />
            ),
            size: 50,
        })
    } else {
        cols.push({
            id: "delete_indicator",
            header: ({ column }) => (
                <div className="flex justify-center">
                    <X className="h-4 w-4 text-red-500" />
                </div>
            ),
            cell: () => (
                <div className="flex justify-center">
                    <X className="h-4 w-4 text-red-500" />
                </div>
            ),
            enableSorting: false,
            enableHiding: false,
            size: 50,
        })
    }

    // 2. Data columns
    cols.push(
        {
            id: "icon",
            header: "",
            cell: () => (
                <div className="flex justify-center">
                    <div className="p-1.5 rounded-md bg-primary/10 text-primary shrink-0">
                        <Building2 className="h-4 w-4" />
                    </div>
                </div>
            ),
            enableSorting: false,
            enableHiding: false,
            size: 50,
        },
        {
            accessorKey: "company_name",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Company Name" />
            ),
            cell: ({ row }) => {
                const client = row.original
                const hasUpdate = isUpdated(client.id, ['company_name'])
                return (
                    <div className={`font-medium text-sm relative whitespace-nowrap ${hasUpdate ? updatedBorderClass : ''}`}>
                        {client.company_name}
                    </div>
                )
            },
            size: 250,
        },
        {
            accessorKey: "contact_person",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Contact Person" />
            ),
            cell: ({ row }) => {
                const client = row.original
                const hasUpdate = isUpdated(client.id, ['contact_person'])
                return (
                    <div className={`text-sm text-muted-foreground relative ${hasUpdate ? updatedBorderClass : ''}`}>
                        {client.contact_person || 'N/A'}
                    </div>
                )
            },
            size: 200,
        },
        {
            accessorKey: "email",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Email" />
            ),
            cell: ({ row }) => {
                const client = row.original
                const hasUpdate = isUpdated(client.id, ['email'])
                return (
                    <div className={`text-sm relative ${hasUpdate ? updatedBorderClass : ''}`}>
                        {client.email || 'N/A'}
                    </div>
                )
            },
            size: 200,
        },
        {
            accessorKey: "phone",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Phone" />
            ),
            cell: ({ row }) => {
                const client = row.original
                const hasUpdate = isUpdated(client.id, ['phone'])
                return (
                    <div className={`whitespace-nowrap text-sm relative ${hasUpdate ? updatedBorderClass : ''}`}>
                        {client.phone || "N/A"}
                    </div>
                )
            },
            size: 150,
        },
        {
            accessorKey: "location",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Location" />
            ),
            cell: ({ row }) => {
                const client = row.original
                const location = [client.city, client.state].filter(Boolean).join(', ')
                return (
                    <div className={`text-sm text-muted-foreground relative`}>
                        {location || 'N/A'}
                    </div>
                )
            },
            size: 200,
        }
    )

    // 3. Actions column
    if (showActions) {
        cols.push({
            id: "actions",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Actions" />
            ),
            cell: ({ row, table }) => {
                const client = row.original
                const meta = table.options.meta as any
                return (
                    <ColumnActions
                        client={client}
                        row={row}
                        onEdit={onEdit}
                        onDelete={onDelete}
                        onToggleStatus={onToggleStatus}
                        isToggling={meta?.togglingUserId === client.id}
                    />
                )
            },
            enableSorting: false,
            enableHiding: false,
            size: 80,
        })
    }

    return cols
}
