"use client"

import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { trpc } from '@/lib/trpc/client'
import { Profile } from '@/types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { DashboardPageLayout } from '@/components/dashboard/dashboard-page-layout'
import { DataTable } from '@/components/ui/data-table'
import { createUsersColumns } from './users-columns'
import { UsersTableToolbar } from './users-table-toolbar'
import { ModernAddUserForm } from './ModernAddUserForm'
import { UserOperationModalState } from './user-operation-modal-overlay'
import type { AppRouter } from '@/lib/trpc/routers'
import { inferRouterOutputs } from '@trpc/server'
import { Table as TanstackTable } from '@tanstack/react-table'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Loader2 } from 'lucide-react'
import { getDefaultAvatarUrl } from '@/lib/utils/avatar-helper'
import { getDisplayName } from '@/lib/utils/user-name'
import { cn } from '@/lib/utils'

type RouterOutputs = inferRouterOutputs<AppRouter>
type UsersData = RouterOutputs['admin']['users']['getUsers']

interface UserManagementProps {
  initialData?: UsersData
}

export default function UserManagement({ initialData }: UserManagementProps) {
  const [showAddUserSheet, setShowAddUserSheet] = useState(false)
  const [editingUser, setEditingUser] = useState<Profile | null>(null)
  const [deletingUser, setDeletingUser] = useState<Profile | null>(null)
  const [passwordResetUser, setPasswordResetUser] = useState<Profile | null>(null)
  const [recentlyUpdatedId, setRecentlyUpdatedId] = useState<string | null>(null)
  const [updatedCells, setUpdatedCells] = useState<Record<string, string[]>>({})
  const [rowSelection, setRowSelection] = useState({})
  const [searchTerm, setSearchTerm] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [activeTab, setActiveTab] = useState<'live' | 'deleted'>('live')
  const [statusToggleUser, setStatusToggleUser] = useState<Profile | null>(null)
  const [togglingUserId, setTogglingUserId] = useState<string | null>(null)
  const [hasMounted, setHasMounted] = useState(false)

  const utils = trpc.useUtils()
  const isMounted = useRef(false)

  useEffect(() => {
    isMounted.current = true
    setHasMounted(true)
    return () => {
      isMounted.current = false
    }
  }, [])



  // Fetch all users for client-side table operations
  const { data: usersData, isLoading, error, refetch } = trpc.admin.users.getUsers.useQuery({
    page: 1,
    limit: 9999,
    getAll: true,
    status: activeTab === 'live' ? 'all' : 'deleted',
  }, {
    initialData: activeTab === 'live' ? initialData : undefined,
  })

  const handleEditUser = useCallback((user: Profile) => {
    setEditingUser(user)
  }, [])

  const handleDeleteUser = useCallback((user: Profile) => {
    setDeletingUser(user)
  }, [])

  const handleResetPassword = useCallback((user: Profile) => {
    setPasswordResetUser(user)
  }, [])

  const handleToggleStatus = useCallback((user: Profile) => {
    setStatusToggleUser(user)
  }, [])

  const handleCreateUser = useCallback(() => {
    setShowAddUserSheet(true)
  }, [])
  const toggleStatusMutation = trpc.admin.users.toggleUserStatus.useMutation({
    onMutate: (variables) => {
      setTogglingUserId(variables.userId)
    },
    onSettled: async () => {
      await utils.admin.users.getUsers.invalidate()
      setTogglingUserId(null)
      setStatusToggleUser(null)
      setRowSelection({})
    }
  })

  // Create columns with action handlers
  const columns = useMemo(() => createUsersColumns(
    handleEditUser,
    handleDeleteUser,
    handleResetPassword,
    handleToggleStatus,
    updatedCells
  ), [handleEditUser, handleDeleteUser, handleResetPassword, handleToggleStatus, updatedCells])

  const deletedColumns = useMemo(() => createUsersColumns(
    handleEditUser,
    handleDeleteUser,
    handleResetPassword,
    handleToggleStatus,
    updatedCells,
    false
  ), [handleEditUser, handleDeleteUser, handleResetPassword, handleToggleStatus, updatedCells])

  if (error) {
    return (
      <div className="text-center text-destructive">
        Error loading users: {error.message}
      </div>
    )
  }

  const users = usersData?.users || []

  const filteredUsers = useMemo(() => {
    let result = [...users]
    if (searchTerm) {
      const lowerSearch = searchTerm.toLowerCase()
      result = result.filter(u =>
        (u.full_name?.toLowerCase().includes(lowerSearch)) ||
        (u.email?.toLowerCase().includes(lowerSearch)) ||
        (u.mobile_no?.toLowerCase().includes(lowerSearch)) ||
        (getDisplayName(u).toLowerCase().includes(lowerSearch))
      )
    }
    if (roleFilter !== 'all') {
      result = result.filter(u => u.role === roleFilter)
    }
    return result
  }, [users, searchTerm, roleFilter])

  // Preload first-batch avatar images to avoid placeholder flicker in the table
  const preloadedUrlsRef = useRef<Set<string>>(new Set())
  useEffect(() => {
    if (!users || users.length === 0) return
    const MAX_PRELOAD = 50
    const preloadedUrls = preloadedUrlsRef.current
    let count = 0

    // Background preloading to warm up browser cache
    for (const u of users) {
      if (!isMounted.current) break
      const url = u.avatar_url || getDefaultAvatarUrl(u.sex)
      if (!url || preloadedUrls.has(url)) continue

      const img = new Image()
      img.src = url
      // Use decode() to warm up the image cache without blocking
      img.decode?.()
        .then(() => {
          if (isMounted.current) preloadedUrls.add(url)
        })
        .catch(() => { })

      count++
      if (count >= MAX_PRELOAD) break
    }
  }, [users])



  const onConfirmToggleStatus = () => {
    if (!statusToggleUser) return
    const newStatus = statusToggleUser.status === 'active' ? 'deactive' : 'active'
    toggleStatusMutation.mutate({
      userId: statusToggleUser.id,
      status: newStatus,
      reason: `User ${newStatus === 'active' ? 'activated' : 'deactivated'} from management table`
    })
  }

  return (
    <DashboardPageLayout
      heading="User Management"
      description="Manage user accounts and permissions"
    >
      {/* User Table Card */}
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>All Users List</CardTitle>
          <CardDescription className='text-muted-foreground text-sm'>
            View and manage all user accounts. Use the table controls to sort, filter, and select users.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="[&_td:not(:first-child)]:px-0.5 [&_th:not(:first-child)]:px-0.5 [&_td]:py-1.5 [&_table]:text-xs [&_td:nth-child(5)]:pr-0 [&_th:nth-child(5)]:pr-0 [&_td:nth-child(6)]:pl-0 [&_th:nth-child(6)]:pl-0 [&_td:nth-child(6)]:pr-0 [&_th:nth-child(6)]:pr-0 [&_td:nth-child(7)]:pl-0 [&_th:nth-child(7)]:pl-0 [&_td:nth-child(7)]:pr-0 [&_th:nth-child(7)]:pr-0 [&_td:nth-child(8)]:pl-0 [&_th:nth-child(8)]:pl-0 [&_td:nth-child(8)]:pr-0 [&_th:nth-child(8)]:pr-0 [&_td:nth-child(9)]:pl-0 [&_th:nth-child(9)]:pl-0">
            {hasMounted ? (
              <Tabs defaultValue="live" className="w-full" onValueChange={(val) => {
                setActiveTab(val as 'live' | 'deleted')
                setRowSelection({}) // Clear selection when switching tabs
              }}>
                <TabsList className="mb-4">
                  <TabsTrigger value="live">Live Users</TabsTrigger>
                  <TabsTrigger value="deleted">Deleted Users</TabsTrigger>
                </TabsList>
                <TabsContent value="live" className="mt-0 border-0 p-0 shadow-none">
                  <DataTable
                    columns={columns}
                    data={filteredUsers}
                    isLoading={isLoading}
                    toolbar={(table: TanstackTable<Profile>) => (
                      <UsersTableToolbar
                        table={table}
                        onCreateUser={handleCreateUser}
                        isLoading={isLoading}
                        searchTerm={searchTerm}
                        onSearchChange={setSearchTerm}
                        roleFilter={roleFilter}
                        onRoleFilterChange={setRoleFilter}
                      />
                    )}
                    recentlyUpdatedId={recentlyUpdatedId}
                    rowSelection={rowSelection}
                    onRowSelectionChange={setRowSelection}
                    meta={{
                      editingId: editingUser?.id,
                      deletingId: deletingUser?.id,
                      togglingUserId
                    }}
                  />
                </TabsContent>
                <TabsContent value="deleted" className="mt-0 border-0 p-0 shadow-none">
                  <DataTable
                    columns={deletedColumns}
                    data={filteredUsers}
                    isLoading={isLoading}
                    toolbar={(table: TanstackTable<Profile>) => (
                      <UsersTableToolbar
                        table={table}
                        isLoading={isLoading}
                        searchTerm={searchTerm}
                        onSearchChange={setSearchTerm}
                        roleFilter={roleFilter}
                        onRoleFilterChange={setRoleFilter}
                      />
                    )}
                    recentlyUpdatedId={recentlyUpdatedId}
                    rowSelection={rowSelection}
                    onRowSelectionChange={setRowSelection}
                    meta={{
                      editingId: editingUser?.id,
                      deletingId: deletingUser?.id,
                      togglingUserId
                    }}
                  />
                </TabsContent>
              </Tabs>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-10 w-[250px]" />
                  <Skeleton className="h-10 w-[100px]" />
                </div>
                <div className="rounded-md border h-96">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {Array.from({ length: 9 }).map((_, i) => (
                          <TableHead key={i}><Skeleton className="h-4 w-full" /></TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Array.from({ length: 10 }).map((_, i) => (
                        <TableRow key={i}>
                          {Array.from({ length: 9 }).map((_, j) => (
                            <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Add User Sheet */}
      {showAddUserSheet && (
        <ModernAddUserForm
          open={showAddUserSheet}
          onOpenChange={setShowAddUserSheet}
          useSheet={true}
          onSuccess={() => {
            // Note: refetch() removed - ModernAddUserForm already handles cache invalidation
            // via invalidateDashboardCache() and utils.admin.users.getUsers.invalidate()
            setShowAddUserSheet(false)
          }}
        />
      )}

      {/* Edit User Sheet */}
      {editingUser && (
        <ModernAddUserForm
          open={!!editingUser}
          onOpenChange={(open) => {
            if (!open) {
              if (isMounted.current) setEditingUser(null)
              // If closing without success (implied by onOpenChange vs onSuccess), unselect the row
              setRowSelection(prev => {
                if (!isMounted.current) return prev
                const newSelection = { ...prev } as Record<string, boolean>
                delete newSelection[editingUser.id]
                return newSelection
              })
            }
          }}
          editingUser={editingUser}
          useSheet={true}
          onSuccess={(updatedFields) => {
            // Note: refetch() removed - ModernAddUserForm already handles cache invalidation
            // via invalidateDashboardCache() and utils.admin.users.getUsers.invalidate()
            if (isMounted.current) setEditingUser(null)

            // Update updatedCells state if there are modified fields
            if (updatedFields && updatedFields.length > 0) {
              setUpdatedCells((prev: Record<string, string[]>) => {
                if (!isMounted.current) return prev
                const existing = prev[editingUser.id] || []
                // Merge and deduplicate
                const merged = Array.from(new Set([...existing, ...updatedFields]))
                return {
                  ...prev,
                  [editingUser.id]: merged
                }
              })
            }

            // Wait for sheet close animation to finish before showing row success animation
            setTimeout(() => {
              if (isMounted.current) {
                setRecentlyUpdatedId(editingUser.id)
                // Clear animation after it finishes (2s duration)
                setTimeout(() => {
                  if (isMounted.current) setRecentlyUpdatedId(null)
                }, 2000)
              }
            }, 500)
          }}
        />
      )}

      {/* Delete User Sheet */}
      {deletingUser && (
        <ModernAddUserForm
          open={!!deletingUser}
          onOpenChange={(open) => {
            if (!open) {
              if (isMounted.current) setDeletingUser(null)
              // Unselect the row if cancelled
              setRowSelection(prev => {
                if (!isMounted.current) return prev
                const newSelection = { ...prev } as Record<string, boolean>
                delete newSelection[deletingUser.id]
                return newSelection
              })
            }
          }}
          editingUser={deletingUser}
          useSheet={true}
          isDeleteMode={true}
          onSuccess={() => {
            // Note: refetch() removed - ModernAddUserForm already handles cache invalidation
            // via invalidateDashboardCache() and utils.admin.users.getUsers.invalidate()
            console.log('[USER-MANAGEMENT] Delete success callback - cache invalidation handled by ModernAddUserForm')
            if (isMounted.current) setDeletingUser(null)
            // Unselect the row on success
            setRowSelection(prev => {
              if (!isMounted.current) return prev
              const newSelection = { ...prev } as Record<string, boolean>
              delete newSelection[deletingUser.id]
              return newSelection
            })
          }}
        />
      )}

      {/* Password Reset Sheet */}
      {passwordResetUser && (
        <ModernAddUserForm
          open={!!passwordResetUser}
          onOpenChange={(open) => {
            if (!open) {
              if (isMounted.current) setPasswordResetUser(null)
              // Unselect the row if cancelled
              setRowSelection(prev => {
                if (!isMounted.current) return prev
                const newSelection = { ...prev } as Record<string, boolean>
                delete newSelection[passwordResetUser.id]
                return newSelection
              })
            }
          }}
          editingUser={passwordResetUser}
          useSheet={true}
          isPasswordResetMode={true}
          onSuccess={() => {
            if (isMounted.current) setPasswordResetUser(null)
            // Unselect the row on success
            setRowSelection(prev => {
              if (!isMounted.current) return prev
              const newSelection = { ...prev } as Record<string, boolean>
              delete newSelection[passwordResetUser.id]
              return newSelection
            })

            // Show success animation
            setTimeout(() => {
              if (isMounted.current) {
                setRecentlyUpdatedId(passwordResetUser.id)
                setTimeout(() => {
                  if (isMounted.current) setRecentlyUpdatedId(null)
                }, 2000)
              }
            }, 500)
          }}
        />
      )}

      {/* Status Toggle Confirmation */}
      <AlertDialog open={!!statusToggleUser} onOpenChange={(open) => !open && setStatusToggleUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will {statusToggleUser?.status === 'active' ? 'deactivate' : 'activate'} the account of <strong>{statusToggleUser ? getDisplayName(statusToggleUser as Profile) : 'this user'}</strong>.
              {statusToggleUser?.status === 'active'
                ? ' Deactivated users will not be able to log in or access the system.'
                : ' Activated users will regain full access to the system.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setRowSelection({})}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={onConfirmToggleStatus}
              className={cn(
                "min-w-28 transition-all duration-200",
                statusToggleUser?.status === 'active' ? "bg-red-600 hover:bg-red-700" : "bg-green-600 hover:bg-green-700"
              )}
              disabled={toggleStatusMutation.isPending}
            >
              {toggleStatusMutation.isPending ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Processing...</span>
                </div>
              ) : (statusToggleUser?.status === 'active' ? 'Deactivate' : 'Activate')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardPageLayout>
  )
}
