"use client"

import { useState, useMemo, useCallback, useEffect, useRef } from "react"
import { trpc } from "@/lib/trpc/client"
import { Sheet } from "@/components/ui/sheet"
import { toast } from "sonner"
import { Loader2, Building2 } from "lucide-react"
import { DashboardPageLayout } from "@/components/dashboard/dashboard-page-layout"
import { cn } from "@/lib/utils"
import { CardShell } from "@/features/attendance/CardShell"

// Table imports
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { DataTable } from '@/components/ui/data-table'
import { createClientsColumns } from "./clients-columns"
import { ClientsTableToolbar } from "./clients-table-toolbar"
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

// Modern Add Client Form import
import { ModernAddClientForm } from "./ModernAddClientForm"

export default function ClientsPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [showCreateSheet, setShowCreateSheet] = useState(false)
  const [editingClient, setEditingClient] = useState<any>(null)
  const [deletingClient, setDeletingClient] = useState<any>(null)
  const [statusToggleClient, setStatusToggleClient] = useState<any>(null)
  
  const [activeTab, setActiveTab] = useState<'active' | 'inactive'>('active')
  const [rowSelection, setRowSelection] = useState({})
  const [recentlyUpdatedId, setRecentlyUpdatedId] = useState<string | null>(null)
  const [updatedCells, setUpdatedCells] = useState<Record<string, string[]>>({})
  const [hasMounted, setHasMounted] = useState(false)

  const isMounted = useRef(false)

  useEffect(() => {
    isMounted.current = true
    setHasMounted(true)
    return () => {
      isMounted.current = false
    }
  }, [])

  // Query to fetch client directory
  const { data: clientsData, isLoading, refetch } = trpc.clients.list.useQuery({
    search: searchTerm || undefined,
    status: activeTab,
  })

  // Status toggle mutation for action menu quick toggling
  const statusToggleMutation = trpc.clients.update.useMutation({
    onSuccess: () => {
      toast.success("Client status updated successfully")
      refetch()
      setStatusToggleClient(null)
      setRowSelection({})
    },
    onError: (err) => toast.error(err.message),
  })

  // Action callbacks
  const handleEditClient = useCallback((client: any) => {
    setEditingClient(client)
  }, [])

  const handleDeleteClient = useCallback((client: any) => {
    setDeletingClient(client)
  }, [])

  const handleToggleStatus = useCallback((client: any) => {
    setStatusToggleClient(client)
  }, [])

  const handleCreateClient = useCallback(() => {
    setShowCreateSheet(true)
  }, [])

  const onConfirmToggleStatus = () => {
    if (!statusToggleClient) return
    const newStatus = statusToggleClient.status === 'active' ? 'inactive' : 'active'
    statusToggleMutation.mutate({
      id: statusToggleClient.id,
      status: newStatus,
    })
  }

  // Callback on successful create client sheet completion
  const handleCreateSuccess = useCallback(() => {
    setShowCreateSheet(false)
  }, [])

  // Callback on successful edit client sheet completion
  const handleEditSuccess = useCallback((updatedFields?: string[]) => {
    if (!editingClient) return
    const currentEditingClientId = editingClient.id
    setEditingClient(null)

    // Highlight row cells that were updated
    if (updatedFields && updatedFields.length > 0) {
      setUpdatedCells((prev: Record<string, string[]>) => {
        if (!isMounted.current) return prev
        const existing = prev[currentEditingClientId] || []
        const merged = Array.from(new Set([...existing, ...updatedFields]))
        return {
          ...prev,
          [currentEditingClientId]: merged
        }
      })
    }

    // Wait for sheet close animation before triggering row success flash
    setTimeout(() => {
      if (isMounted.current) {
        setRecentlyUpdatedId(currentEditingClientId)
        setTimeout(() => {
          if (isMounted.current) setRecentlyUpdatedId(null)
        }, 2000)
      }
    }, 500)
  }, [editingClient])

  // Callback on successful delete client sheet completion
  const handleDeleteSuccess = useCallback(() => {
    if (!deletingClient) return
    setDeletingClient(null)
    setRowSelection({})
  }, [deletingClient])

  // Clean form state hooks
  const handleCreateCancel = useCallback(() => {
    setShowCreateSheet(false)
  }, [])

  const handleEditCancel = useCallback(() => {
    setEditingClient(null)
    setRowSelection({})
  }, [])

  const handleDeleteCancel = useCallback(() => {
    setDeletingClient(null)
    setRowSelection({})
  }, [])

  // Table column mapping
  const columns = useMemo(() => createClientsColumns(
    handleEditClient,
    handleDeleteClient,
    handleToggleStatus,
    updatedCells,
    true // show action menus for active clients
  ), [handleEditClient, handleDeleteClient, handleToggleStatus, updatedCells])

  const inactiveColumns = useMemo(() => createClientsColumns(
    handleEditClient,
    handleDeleteClient,
    handleToggleStatus,
    updatedCells,
    false // hide action menus for inactive clients
  ), [handleEditClient, handleDeleteClient, handleToggleStatus, updatedCells])

  const clients = clientsData?.data || []

  return (
    <DashboardPageLayout 
      heading="Clients" 
      description="Manage your client directory"
    >
      <CardShell
        title="All Clients List"
        description="View and manage all client accounts. Use the table controls to search, filter, and select clients."
        icon={Building2}
        contentClassName="min-h-0 p-3 md:p-4 pt-1.5 md:pt-2 h-full overflow-auto"
      >
        <div className="[&_td:not(:first-child)]:px-2 [&_th:not(:first-child)]:px-2 [&_td]:py-1.5 [&_table]:text-xs">
          {hasMounted ? (
            <Tabs defaultValue="active" className="w-full" onValueChange={(val) => {
              setActiveTab(val as 'active' | 'inactive')
              setRowSelection({})
            }}>
              <TabsList className="mb-4">
                <TabsTrigger value="active">Active Clients</TabsTrigger>
                <TabsTrigger value="inactive">Inactive Clients</TabsTrigger>
              </TabsList>
              <TabsContent value="active" className="mt-0 border-0 p-0 shadow-none">
                <DataTable
                  columns={columns}
                  data={clients}
                  isLoading={isLoading}
                  toolbar={(table: TanstackTable<any>) => (
                    <ClientsTableToolbar
                      table={table}
                      onCreateClient={handleCreateClient}
                      isLoading={isLoading}
                      searchTerm={searchTerm}
                      onSearchChange={setSearchTerm}
                    />
                  )}
                  recentlyUpdatedId={recentlyUpdatedId}
                  rowSelection={rowSelection}
                  onRowSelectionChange={setRowSelection}
                  meta={{
                    editingId: editingClient?.id,
                    deletingId: deletingClient?.id,
                    togglingUserId: statusToggleClient?.id
                  }}
                />
              </TabsContent>
              <TabsContent value="inactive" className="mt-0 border-0 p-0 shadow-none">
                <DataTable
                  columns={inactiveColumns}
                  data={clients}
                  isLoading={isLoading}
                  toolbar={(table: TanstackTable<any>) => (
                    <ClientsTableToolbar
                      table={table}
                      isLoading={isLoading}
                      searchTerm={searchTerm}
                      onSearchChange={setSearchTerm}
                    />
                  )}
                  recentlyUpdatedId={recentlyUpdatedId}
                  rowSelection={rowSelection}
                  onRowSelectionChange={setRowSelection}
                  meta={{
                    editingId: editingClient?.id,
                    deletingId: deletingClient?.id,
                    togglingUserId: statusToggleClient?.id
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
                      {Array.from({ length: 6 }).map((_, i) => (
                        <TableHead key={i}><Skeleton className="h-4 w-full" /></TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Array.from({ length: 10 }).map((_, i) => (
                      <TableRow key={i}>
                        {Array.from({ length: 6 }).map((_, j) => (
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
      </CardShell>

      {/* Add Client Sheet */}
      {showCreateSheet && (
        <ModernAddClientForm
          open={showCreateSheet}
          onOpenChange={setShowCreateSheet}
          useSheet={true}
          onSuccess={handleCreateSuccess}
          onCancel={handleCreateCancel}
          refetch={refetch}
        />
      )}

      {/* Edit Client Sheet */}
      {editingClient && (
        <ModernAddClientForm
          open={!!editingClient}
          onOpenChange={(open) => !open && handleEditCancel()}
          editingClient={editingClient}
          useSheet={true}
          onSuccess={handleEditSuccess}
          onCancel={handleEditCancel}
          refetch={refetch}
        />
      )}

      {/* Delete Client Sheet (Soft Delete) */}
      {deletingClient && (
        <ModernAddClientForm
          open={!!deletingClient}
          onOpenChange={(open) => !open && handleDeleteCancel()}
          editingClient={deletingClient}
          useSheet={true}
          isDeleteMode={true}
          onSuccess={handleDeleteSuccess}
          onCancel={handleDeleteCancel}
          refetch={refetch}
        />
      )}

      {/* Status Toggle Quick Dialog */}
      <AlertDialog open={!!statusToggleClient} onOpenChange={(open) => !open && setStatusToggleClient(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Change Client Status</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to {statusToggleClient?.status === 'active' ? 'deactivate' : 'activate'} client <strong>{statusToggleClient?.company_name}</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setRowSelection({})}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={onConfirmToggleStatus}
              className={cn(
                "min-w-28 transition-all duration-200",
                statusToggleClient?.status === 'active' ? "bg-red-600 hover:bg-red-700" : "bg-green-600 hover:bg-green-700"
              )}
              disabled={statusToggleMutation.isPending}
            >
              {statusToggleMutation.isPending ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Processing...</span>
                </div>
              ) : (statusToggleClient?.status === 'active' ? 'Deactivate' : 'Activate')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardPageLayout>
  )
}
