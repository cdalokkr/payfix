"use client"

import { ColumnDef, Row } from "@tanstack/react-table"
import { Checkbox } from "@/components/ui/checkbox"
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header"
import { EditButton, DeleteButton } from "@/components/ui/action-button"
import { Designation } from "@/types"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

interface ColumnActionsProps {
    designation: Designation
    row: Row<Designation>
    onEdit: (designation: Designation) => void
    onDelete: (designation: Designation) => void
}

function ColumnActions({ designation, row, onEdit, onDelete }: ColumnActionsProps) {
    return (
        <div className="flex items-center gap-2">
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <div>
                            <EditButton
                                onClick={() => {
                                    row.toggleSelected(true)
                                    onEdit(designation)
                                }}
                                aria-label={`Edit designation ${designation.name}`}
                                size="sm"
                                variant="icon-only"
                            />
                        </div>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>Edit designation</p>
                    </TooltipContent>
                </Tooltip>

                <Tooltip>
                    <TooltipTrigger asChild>
                        <div>
                            <DeleteButton
                                onClick={() => {
                                    row.toggleSelected(true)
                                    onDelete(designation)
                                }}
                                aria-label={`Delete designation ${designation.name}`}
                                size="sm"
                                variant="icon-only"
                            />
                        </div>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>Delete designation</p>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
        </div>
    )
}

export function createDesignationColumns(
    onEdit: (designation: Designation) => void,
    onDelete: (designation: Designation) => void,
    editingId?: string | null,
    deletingId?: string | null
): ColumnDef<Designation>[] {
    // Helper to determine checkbox color class
    const getCheckboxColorClass = (rowId?: string) => {
        if (rowId && rowId === editingId) {
            return "data-[state=checked]:bg-purple-600 data-[state=checked]:border-purple-600"
        }
        if (rowId && rowId === deletingId) {
            return "data-[state=checked]:bg-red-600 data-[state=checked]:border-red-600"
        }
        // If header checkbox (no rowId) and we are in a special mode
        if (!rowId && editingId) {
            return "data-[state=checked]:bg-purple-600 data-[state=checked]:border-purple-600"
        }
        if (!rowId && deletingId) {
            return "data-[state=checked]:bg-red-600 data-[state=checked]:border-red-600"
        }

        return "data-[state=checked]:border-primary"
    }

    return [
        {
            id: "select",
            header: ({ table }) => (
                <Checkbox
                    checked={
                        table.getIsAllPageRowsSelected() ||
                        (table.getIsSomePageRowsSelected() && "indeterminate")
                    }
                    onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
                    aria-label="Select all"
                    className={`h-4.5 w-4.5 rounded-sm border border-muted-foreground/50 ${getCheckboxColorClass()}`}
                />
            ),
            cell: ({ row }) => (
                <Checkbox
                    checked={row.getIsSelected()}
                    onCheckedChange={(value) => row.toggleSelected(!!value)}
                    aria-label="Select row"
                    className={`h-4.5 w-4.5 rounded-sm border border-muted-foreground/50 ${getCheckboxColorClass(row.original.id)}`}
                />
            ),
            enableSorting: false,
            enableHiding: false,
        },
        {
            id: "role",
            accessorKey: "role",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Role" />
            ),
            cell: ({ row }) => {
                const role = row.getValue("role") as string
                return (
                    <div className="capitalize relative">
                        <span
                            className={`inline-flex items-center rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wider whitespace-nowrap ${role === "admin"
                                ? "bg-purple-100 text-purple-700 border border-purple-200"
                                : role === "moderator"
                                    ? "bg-indigo-100 text-indigo-700 border border-indigo-200"
                                    : "bg-blue-100 text-blue-700 border border-blue-200"
                                }`}
                        >
                            {role}
                        </span>
                    </div>
                )
            },
            size: 100,
            enableColumnFilter: true,
            filterFn: (row, id, value) => {
                if (value === undefined || value === null || value === "" || value === "all") return true
                return row.getValue(id) === value
            },
        },
        {
            id: "name",
            accessorKey: "name",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Name" />
            ),
            cell: ({ row }) => {
                return (
                    <div className="font-medium text-sm relative">
                        {row.getValue("name")}
                    </div>
                )
            },
            size: 200,
            enableColumnFilter: true,
            filterFn: (row, id, value) => {
                const name = (row.getValue(id) as string || "").toLowerCase()
                return name.includes(value.toLowerCase())
            },
        },
        {
            accessorKey: "description",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Description" />
            ),
            cell: ({ row }) => {
                return (
                    <div className="truncate max-w-[400px] text-muted-foreground small-text relative">
                        {row.getValue("description")}
                    </div>
                )
            },
            size: 400,
            enableColumnFilter: true,
        },
        {
            id: "actions",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Actions" />
            ),
            cell: ({ row }) => {
                const designation = row.original
                return (
                    <ColumnActions designation={designation} row={row} onEdit={onEdit} onDelete={onDelete} />
                )
            },
            enableSorting: false,
            enableHiding: false,
            size: 100,
        },
    ]
}
