"use client"

import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { trpc } from '@/lib/trpc/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { DashboardPageLayout } from '@/components/dashboard/dashboard-page-layout'
import { DataTable } from '@/components/ui/data-table'
import { Designation } from '@/types'
import { createDesignationColumns } from './designation-columns'
import { DesignationTableToolbar } from './designation-table-toolbar'
import { ModernAddDesignationForm } from './modern-add-designation-form'
import { RowSelectionState } from '@tanstack/react-table'

interface DesignationManagementProps {
    initialData?: Designation[]
}

export default function DesignationManagement({ initialData }: DesignationManagementProps) {
    // Sheet Control States
    const [showAddSheet, setShowAddSheet] = useState(false)
    const [editingDesignation, setEditingDesignation] = useState<Designation | null>(null)
    const [deletingDesignation, setDeletingDesignation] = useState<Designation | null>(null)

    // Lifecycle and Safety
    const isMounted = useRef(false)
    const [hasMounted, setHasMounted] = useState(false)

    useEffect(() => {
        isMounted.current = true
        setHasMounted(true)
        return () => {
            isMounted.current = false
        }
    }, [])

    // Table States
    const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
    const [recentlyUpdatedId, setRecentlyUpdatedId] = useState<string | null>(null)
    const [searchTerm, setSearchTerm] = useState('')
    const [roleFilter, setRoleFilter] = useState('all')

    // Data Fetching
    const { data: designations, isLoading, refetch } = trpc.admin.designation.getDesignations.useQuery(undefined, {
        initialData: initialData,
        refetchOnWindowFocus: false,
    })

    const handleRefresh = useCallback(() => {
        refetch()
    }, [refetch])

    const filteredDesignations = useMemo(() => {
        let result = [...(designations || [])]
        if (searchTerm) {
            const lowerSearch = searchTerm.toLowerCase()
            result = result.filter(d =>
                (d.name?.toLowerCase().includes(lowerSearch)) ||
                (d.description?.toLowerCase().includes(lowerSearch))
            )
        }
        if (roleFilter !== 'all') {
            result = result.filter(d => d.role === roleFilter)
        }
        return result
    }, [designations, searchTerm, roleFilter])

    // Action Handlers
    const handleEdit = useCallback((designation: Designation) => {
        setEditingDesignation(designation)
    }, [])

    const handleDelete = useCallback((designation: Designation) => {
        setDeletingDesignation(designation)
    }, [])

    const handleCreate = useCallback(() => {
        setShowAddSheet(true)
    }, [])

    // Columns Definition
    const columns = useMemo(() => createDesignationColumns(
        handleEdit,
        handleDelete,
        editingDesignation?.id,
        deletingDesignation?.id
    ), [handleEdit, handleDelete, editingDesignation?.id, deletingDesignation?.id])

    return (
        <DashboardPageLayout
            heading="Designation Management"
            description="Setup and manage various job designations for your organization"
        >
            <Card className="shadow-lg">
                <CardHeader>
                    <CardTitle>Designations List</CardTitle>
                    <CardDescription className='text-muted-foreground text-sm'>
                        Manage job designations and their associated roles.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="[&_td:not(:first-child)]:px-0.5 [&_th:not(:first-child)]:px-0.5 [&_td]:py-1.5 [&_table]:text-xs">
                        {hasMounted ? (
                            <DataTable
                                columns={columns}
                                data={filteredDesignations}
                                isLoading={isLoading}
                                toolbar={(table) => (
                                    <DesignationTableToolbar
                                        table={table}
                                        onCreateDesignation={handleCreate}
                                        isLoading={isLoading}
                                        searchTerm={searchTerm}
                                        onSearchChange={setSearchTerm}
                                        roleFilter={roleFilter}
                                        onRoleFilterChange={setRoleFilter}
                                    />
                                )}
                                rowSelection={rowSelection}
                                onRowSelectionChange={setRowSelection}
                                recentlyUpdatedId={recentlyUpdatedId}
                            />
                        ) : (
                            <div className="h-64 flex items-center justify-center">
                                <span className="text-muted-foreground animate-pulse">Initializing table...</span>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Create Sheet */}
            {showAddSheet && (
                <ModernAddDesignationForm
                    open={showAddSheet}
                    onOpenChange={setShowAddSheet}
                    onSuccess={() => {
                        setShowAddSheet(false)
                        handleRefresh()
                    }}
                />
            )}

            {/* Edit Sheet */}
            {editingDesignation && (
                <ModernAddDesignationForm
                    open={!!editingDesignation}
                    onOpenChange={(open) => {
                        if (!open) {
                            setEditingDesignation(null)
                            // Unselect row on close
                            setRowSelection(prev => {
                                const newSelection = { ...prev } as Record<string, boolean>
                                delete newSelection[editingDesignation.id]
                                return newSelection
                            })
                        }
                    }}
                    editingDesignation={editingDesignation}
                    onSuccess={() => {
                        setEditingDesignation(null)
                        handleRefresh()

                        // Wait for sheet close animation to finish
                        setTimeout(() => {
                            if (isMounted.current) {
                                setRecentlyUpdatedId(editingDesignation.id)
                                // Clear animation after it finishes
                                setTimeout(() => {
                                    if (isMounted.current) {
                                        setRecentlyUpdatedId(null)
                                    }
                                }, 2000)

                                // Unselect row
                                setRowSelection(prev => {
                                    if (!isMounted.current) return prev
                                    const newSelection = { ...prev } as Record<string, boolean>
                                    delete newSelection[editingDesignation.id]
                                    return newSelection
                                })
                            }
                        }, 500)
                    }}
                    title="Edit Designation"
                    description="Update designation details and permissions"
                />
            )}

            {/* Delete Sheet */}
            {deletingDesignation && (
                <ModernAddDesignationForm
                    open={!!deletingDesignation}
                    onOpenChange={(open) => {
                        if (!open) {
                            setDeletingDesignation(null)
                            // Unselect row on close
                            setRowSelection(prev => {
                                const newSelection = { ...prev } as Record<string, boolean>
                                delete newSelection[deletingDesignation.id]
                                return newSelection
                            })
                        }
                    }}
                    editingDesignation={deletingDesignation}
                    isDeleteMode={true}
                    onSuccess={() => {
                        setDeletingDesignation(null)
                        handleRefresh()
                        // Unselect row on success immediately for delete
                        setRowSelection(prev => {
                            const newSelection = { ...prev } as Record<string, boolean>
                            delete newSelection[deletingDesignation.id]
                            return newSelection
                        })
                    }}
                />
            )}
        </DashboardPageLayout>
    )
}

