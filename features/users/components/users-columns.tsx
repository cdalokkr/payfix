"use client"

import { ColumnDef, Row } from "@tanstack/react-table"
import { Checkbox } from "@/components/ui/checkbox"
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header"
import { EditButton, DeleteButton, ResetPasswordButton, ActivateButton, DeactivateButton } from "@/components/ui/action-button"
import { Button } from "@/components/ui/button"
import { Profile, UserRole } from "@/types"
import { getDisplayName } from "@/lib/utils/user-name"
import { AlertTriangle, UserCheck, UserX, X } from "lucide-react"
import { UserAvatarProfile } from "@/components/user-avatar-profile"
import { cn } from "@/lib/utils"

interface ColumnActionsProps {
    user: Profile
    row: Row<Profile>
    onEdit: (user: Profile) => void
    onDelete: (user: Profile) => void
    onResetPassword: (user: Profile) => void
    onToggleStatus: (user: Profile) => void
    isToggling?: boolean
}

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

function ColumnActions({ user, row, onEdit, onDelete, onResetPassword, onToggleStatus, isToggling }: ColumnActionsProps) {
    const isActive = user.status === 'active'

    return (
        <div className="flex items-center gap-2">
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <div>
                            {isActive ? (
                                <DeactivateButton
                                    onClick={() => {
                                        row.toggleSelected(true)
                                        onToggleStatus(user)
                                    }}
                                    aria-label={`Deactivate user ${getDisplayName(user)}`}
                                    size="sm"
                                    variant="icon-only"
                                    loading={isToggling}
                                />
                            ) : (
                                <ActivateButton
                                    onClick={() => {
                                        row.toggleSelected(true)
                                        onToggleStatus(user)
                                    }}
                                    aria-label={`Activate user ${getDisplayName(user)}`}
                                    size="sm"
                                    variant="icon-only"
                                    loading={isToggling}
                                />
                            )}
                        </div>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>{isActive ? 'Deactivate' : 'Activate'} user</p>
                    </TooltipContent>
                </Tooltip>

                <Tooltip>
                    <TooltipTrigger asChild>
                        <div>
                            <EditButton
                                onClick={() => {
                                    row.toggleSelected(true)
                                    onEdit(user)
                                }}
                                aria-label={`Edit user ${getDisplayName(user)}`}
                                size="sm"
                                variant="icon-only"
                            />
                        </div>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>Edit user</p>
                    </TooltipContent>
                </Tooltip>

                <Tooltip>
                    <TooltipTrigger asChild>
                        <div>
                            <ResetPasswordButton
                                onClick={() => {
                                    row.toggleSelected(true)
                                    onResetPassword(user)
                                }}
                                aria-label={`Reset password for ${getDisplayName(user)}`}
                                size="sm"
                                variant="icon-only"
                            />
                        </div>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>Reset password</p>
                    </TooltipContent>
                </Tooltip>

                <Tooltip>
                    <TooltipTrigger asChild>
                        <div>
                            <DeleteButton
                                onClick={() => {
                                    row.toggleSelected(true)
                                    onDelete(user)
                                }}
                                aria-label={`Delete user ${getDisplayName(user)}`}
                                size="sm"
                                variant="icon-only"
                            />
                        </div>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>Delete user</p>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
        </div>
    )
}

export function createUsersColumns(
    onEdit: (user: Profile) => void,
    onDelete: (user: Profile) => void,
    onResetPassword: (user: Profile) => void,
    onToggleStatus: (user: Profile) => void,
    updatedCells: Record<string, string[]> = {},
    showActions: boolean = true
): ColumnDef<Profile>[] {
    const isUpdated = (userId: string, fields: string[]) => {
        const userUpdates = updatedCells[userId] || []
        return fields.some(field => userUpdates.includes(field))
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
        // If header checkbox (no rowId) and we are in a special mode
        if (!rowId && editingId) {
            return "data-[state=checked]:bg-purple-600 data-[state=checked]:border-purple-600"
        }
        if (!rowId && deletingId) {
            return "data-[state=checked]:bg-red-600 data-[state=checked]:border-red-600"
        }

        return "data-[state=checked]:border-primary"
    }

    const cols: ColumnDef<Profile>[] = []

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
            size: 30,
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
            size: 40,
        })
    }

    // 2. Data columns
    cols.push(
        {
            accessorKey: "avatar_url",
            id: "avatar",
            header: "",
            cell: ({ row }) => {
                const user = row.original
                return (
                    <div className="flex justify-center">
                        <UserAvatarProfile user={user} className="h-8 w-8" placeholderBlur={6} placeholderScale={1.03} fadeDurationMs={250} />
                    </div>
                )
            },
            enableSorting: false,
            enableHiding: false,
            size: 60,
        },
        {
            accessorKey: "full_name",
            id: "name",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Name" />
            ),
            cell: ({ row }) => {
                const user = row.original
                const hasUpdate = isUpdated(user.id, ['firstName', 'lastName', 'middleName'])
                return (
                    <div className={`font-medium text-sm relative ${hasUpdate ? updatedBorderClass : ''}`}>
                        {getDisplayName(user)}
                    </div>
                )
            },
            filterFn: (row, id, value) => {
                const user = row.original
                const searchString = (value || "").toLowerCase()

                // Check name
                const displayName = getDisplayName(user).toLowerCase()
                if (displayName.includes(searchString)) return true

                // Check email
                const email = (user.email || '').toLowerCase()
                if (email.includes(searchString)) return true

                // Check mobile
                const mobile = (user.mobile_no || '').toLowerCase()
                if (mobile.includes(searchString)) return true

                // Check designation
                const designation = (user.designation?.name || '').toLowerCase()
                if (designation.includes(searchString)) return true

                return false
            },
            size: 350,
            enableColumnFilter: true,
        },
        {
            accessorKey: "email",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Email" />
            ),
            cell: ({ row }) => {
                const user = row.original
                const hasUpdate = isUpdated(user.id, ['email'])
                return (
                    <div className={`font-medium text-sm relative ${hasUpdate ? updatedBorderClass : ''}`}>
                        {row.getValue("email")}
                    </div>
                )
            },
            size: 350,
            enableColumnFilter: true,
        },
        {
            accessorKey: "mobile_no",
            id: "mobile",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Mobile" />
            ),
            cell: ({ row }) => {
                const user = row.original
                const hasUpdate = isUpdated(user.id, ['mobileNo'])
                return (
                    <div className={`whitespace-nowrap relative ${hasUpdate ? updatedBorderClass : ''}`}>
                        {row.getValue("mobile") || "N/A"}
                    </div>
                )
            },
            enableSorting: false,
            size: 80,
        },
        {
            accessorKey: "sex",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Sex" />
            ),
            cell: ({ row }) => {
                const user = row.original
                const hasUpdate = isUpdated(user.id, ['sex'])
                const sex = row.getValue("sex") as string
                return (
                    <div className={`capitalize whitespace-nowrap relative ${hasUpdate ? updatedBorderClass : ''}`}>
                        {sex || "N/A"}
                    </div>
                )
            },
            filterFn: (row, id, value) => {
                if (!value || value === "all") return true
                return row.getValue(id) === value
            },
            size: 30,
        },
        {
            accessorKey: "date_of_birth",
            id: "dob",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="DOB" />
            ),
            cell: ({ row }) => {
                const user = row.original
                const hasUpdate = isUpdated(user.id, ['dateOfBirth'])
                const dob = row.getValue("dob") as string
                if (!dob) return <div className={`relative ${hasUpdate ? updatedBorderClass : ''}`}>N/A</div>
                const date = new Date(dob)
                const formatted = date.toLocaleDateString("en-GB", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                })
                return (
                    <div className={`whitespace-nowrap relative ${hasUpdate ? updatedBorderClass : ''}`}>
                        {formatted}
                    </div>
                )
            },
            size: 60,
        },
        {
            id: "role",
            accessorKey: "role",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Role" />
            ),
            cell: ({ row }) => {
                const user = row.original
                const hasUpdate = isUpdated(user.id, ['role'])
                const role = row.getValue("role") as UserRole
                return (
                    <div className={`capitalize relative ${hasUpdate ? updatedBorderClass : ''}`}>
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
            filterFn: (row, id, value) => {
                if (value === undefined || value === null || value === "" || value === "all") return true
                return row.getValue(id) === value
            },
            size: 30,
            enableColumnFilter: true,
        },
        {
            accessorKey: "designation.name",
            id: "designation",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Designation" />
            ),
            cell: ({ row }) => {
                const user = row.original
                const hasUpdate = isUpdated(user.id, ['designationId'])
                const designationName = user.designation?.name || "N/A"
                return (
                    <div className={`font-medium text-sm text-muted-foreground relative ${hasUpdate ? updatedBorderClass : ''}`}>
                        {designationName}
                    </div>
                )
            },
            size: 150,
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
                const user = row.original
                const meta = table.options.meta as any
                return (
                    <ColumnActions
                        user={user}
                        row={row}
                        onEdit={onEdit}
                        onDelete={onDelete}
                        onResetPassword={onResetPassword}
                        onToggleStatus={onToggleStatus}
                        isToggling={meta?.togglingUserId === user.id}
                    />
                )
            },
            enableSorting: false,
            enableHiding: false,
            size: 30,
        })
    }

    return cols
}
