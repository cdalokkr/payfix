"use client"

import { useState, useRef, useEffect } from "react"
import { useForm, UseFormReturn } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { designationSchema, DesignationInput } from "@/lib/validations/auth"
import { trpc } from "@/lib/trpc/client"
import { toast } from "sonner"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Edit, Briefcase, Trash2, Plus } from "lucide-react"
import { cn } from "@/lib/utils"
// Reuse existing content form as it has the fields we need
import { DesignationFormContent } from "./designation-form-content"

interface ModernAddDesignationFormProps {
    open?: boolean
    onOpenChange?: (open: boolean) => void
    onSuccess?: (updatedFields?: string[]) => void
    onCancel?: () => void
    className?: string
    title?: string
    description?: string
    editingDesignation?: { id: string, name: string, description: string | null, role: "admin" | "moderator" | "employee" } | null
    isDeleteMode?: boolean
}

export function ModernAddDesignationForm({
    open = false,
    onOpenChange,
    onSuccess,
    onCancel,
    className,
    title = "Create New Designation",
    description = "Add a new designation to the system",
    editingDesignation,
    isDeleteMode = false,
}: ModernAddDesignationFormProps) {
    const [internalOpen, setInternalOpen] = useState(false)
    const isEditMode = !!editingDesignation
    const [submitError, setSubmitError] = useState<string | null>(null)
    const [isSuccess, setIsSuccess] = useState(false)
    const [successTimeout, setSuccessTimeout] = useState<NodeJS.Timeout | null>(null)
    const [errorTimeout, setErrorTimeout] = useState<NodeJS.Timeout | null>(null)
    const isMounted = useRef(false)

    useEffect(() => {
        isMounted.current = true
        return () => {
            isMounted.current = false
        }
    }, [])

    const utils = trpc.useUtils()

    // Handle open state
    const isOpen = open || internalOpen

    const handleOpenChange = (newOpen: boolean) => {
        if (onOpenChange) {
            onOpenChange(newOpen)
        } else {
            setInternalOpen(newOpen)
        }
        if (!newOpen) {
            clearTimeouts()
            form.reset()
            setSubmitError(null)
            setIsSuccess(false)
            onCancel?.()
        }
    }

    const clearTimeouts = () => {
        if (successTimeout) clearTimeout(successTimeout)
        if (errorTimeout) clearTimeout(errorTimeout)
        setSuccessTimeout(null)
        setErrorTimeout(null)
    }

    const form = useForm<DesignationInput>({
        resolver: zodResolver(designationSchema),
        defaultValues: {
            name: '',
            description: '',
            role: 'employee',
        },
    })

    // Reset/Prefill form
    useEffect(() => {
        if (isOpen) {
            if (editingDesignation) {
                form.reset({
                    name: editingDesignation.name,
                    description: editingDesignation.description || ' ',
                    role: editingDesignation.role,
                })
            } else {
                form.reset({
                    name: '',
                    description: '',
                    role: 'employee',
                })
            }
        }
    }, [isOpen, editingDesignation, form])

    // Cleanup
    useEffect(() => {
        return () => clearTimeouts()
    }, [])

    const createMutation = trpc.admin.designation.createDesignation.useMutation({
        onSuccess: () => handleSuccess("Designation created successfully"),
        onError: (error) => handleError(error)
    })

    const updateMutation = trpc.admin.designation.updateDesignation.useMutation({
        onSuccess: () => handleSuccess("Designation updated successfully"),
        onError: (error) => handleError(error)
    })

    const deleteMutation = trpc.admin.designation.deleteDesignation.useMutation({
        onSuccess: () => handleSuccess("Designation deleted successfully"),
        onError: (error) => handleError(error)
    })

    const handleSuccess = (message: string) => {
        if (!isMounted.current) return
        setIsSuccess(true)
        setSubmitError(null)
        utils.admin.designation.getDesignations.invalidate()
        // Broadly invalidate dashboard since role/counts might change
        utils.admin.dashboard.getUnifiedDashboardData.invalidate()

        toast.success(message)

        const timeout = setTimeout(() => {
            if (!isMounted.current) return
            setIsSuccess(false)
            form.reset()
            handleOpenChange(false)
            setTimeout(() => {
                if (isMounted.current) onSuccess?.()
            }, 150)
        }, 1500)
        setSuccessTimeout(timeout)
    }

    const handleError = (error: { message?: string }) => {
        if (!isMounted.current) return
        setIsSuccess(false)
        const msg = error.message || 'An error occurred'
        setSubmitError(msg)
        toast.error(msg)
        // Removed auto-clearing of submitError to ensure it persists as per user request
    }

    const onSubmit = (values: DesignationInput) => {
        if (isDeleteMode && editingDesignation) {
            deleteMutation.mutate({ id: editingDesignation.id })
            return
        }

        if (editingDesignation) {
            updateMutation.mutate({
                id: editingDesignation.id,
                ...values,
            })
        } else {
            createMutation.mutate(values)
        }
    }

    const handleFormSubmit = async () => {
        if (!isDeleteMode) {
            const isValid = await form.trigger()
            if (!isValid) return
        }
        onSubmit(form.getValues())
    }

    const isPending = createMutation.isPending || updateMutation.isPending || deleteMutation.isPending

    // Dynamic UI elements
    const dynamicTitle = isDeleteMode ? "Delete Designation" : isEditMode ? "Edit Designation" : title
    const dynamicDescription = isDeleteMode
        ? "Are you sure you want to delete this designation? This action cannot be undone."
        : isEditMode
            ? "Update designation details"
            : description

    const FormIcon = isDeleteMode ? Trash2 : isEditMode ? Edit : Briefcase
    const buttonText = isDeleteMode ? "Delete Designation" : isEditMode ? "Update Designation" : "Create Designation"

    // Colors - Aligning with ModernAddUserForm
    const isDelete = isDeleteMode
    const isEdit = !isDelete && isEditMode

    const bgClass = isDelete
        ? "bg-destructive/10"
        : isEdit
            ? "bg-purple-100"
            : "bg-blue-100"

    const iconClass = isDelete
        ? "text-destructive"
        : isEdit
            ? "text-purple-600"
            : "text-blue-600"

    const titleTextClass = isDelete
        ? "text-destructive"
        : isEdit
            ? "text-purple-700"
            : "text-blue-700"

    return (
        <Sheet open={isOpen} onOpenChange={handleOpenChange}>
            <SheetContent className="w-full sm:max-w-md flex flex-col">
                <div className="flex-shrink-0 px-4 sm:px-6 border-b border-border/80 pb-3">
                    <SheetHeader className="text-left pb-0">
                        <SheetTitle className="flex items-center gap-3 text-xl font-bold py-1">
                            <div className={cn("p-2 rounded-lg", bgClass)}>
                                <FormIcon className={cn("h-6 w-6", iconClass)} />
                            </div>
                            <div className="flex flex-col">
                                <span className={cn("leading-tight", titleTextClass)}>{dynamicTitle}</span>
                                <span className="text-xs font-medium text-muted-foreground mt-0 leading-tight">
                                    {dynamicDescription}
                                </span>
                            </div>
                        </SheetTitle>
                    </SheetHeader>
                </div>

                <div className="flex-1 overflow-y-auto mt-0">
                    <DesignationFormContent
                        form={form}
                        isEditMode={isEditMode}
                        isDeleteMode={isDeleteMode}
                        isSubmitting={isPending}
                        isSuccess={isSuccess}
                        submitError={submitError}
                        onCancel={() => handleOpenChange(false)}
                        onSubmit={handleFormSubmit}
                        buttonText={buttonText}
                    />
                </div>
            </SheetContent>
        </Sheet>
    )
}
