"use client"

import { memo } from "react"
import { UseFormReturn } from "react-hook-form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/ui/form'
import { Card, CardContent } from "@/components/ui/card"
import {
    Accordion,
    AccordionItem,
    AccordionTrigger,
    AccordionContent,
} from "@/components/ui/accordion"
import { Trash2, Briefcase, Info } from "lucide-react"
import { CancelButton } from "@/components/ui/action-button"
import CreateUserButton, { AsyncState } from "@/components/ui/create-user-button"
import { cn } from "@/lib/utils"
import { motion, AnimatePresence } from "framer-motion"
import { DesignationInput } from '@/lib/validations/auth'

export type DesignationFormValues = DesignationInput

interface DesignationFormContentProps {
    form: UseFormReturn<DesignationFormValues>
    isEditMode: boolean
    isSubmitting: boolean
    isSuccess: boolean
    submitError: string | null
    onCancel: () => void
    onSubmit: (values: DesignationFormValues) => void
    buttonText: string
    className?: string
    isDeleteMode?: boolean
}

// Helper component for read-only fields
const ReadOnlyField = ({ label, value, className }: { label: string, value: string | null | undefined, className?: string }) => (
    <div className={cn("flex flex-col space-y-1.5", className)}>
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</span>
        <span className="text-sm font-medium text-foreground min-h-[20px]">{value || "-"}</span>
    </div>
)

export const DesignationFormContent = memo(function DesignationFormContent({
    form,
    isEditMode,
    isSubmitting,
    isSuccess,
    submitError,
    onCancel,
    onSubmit,
    buttonText,
    className,
    isDeleteMode = false
}: DesignationFormContentProps) {
    const { getValues } = form
    const values = getValues()

    // If in delete mode, render the read-only view
    if (isDeleteMode) {
        return (
            <div className={cn("px-4 sm:px-6 lg:px-6 py-4 space-y-6", className)}>
                <Card className="w-full max-w-2xl mx-auto bg-card dark:bg-zinc-900/90 text-card-foreground shadow-lg border-2 border-destructive/20 rounded-lg">
                    <CardContent className="p-4">
                        {/* General Error Display */}
                        <AnimatePresence>
                            {submitError && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: "auto" }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className="mt-0 mb-6 p-4 rounded-lg bg-destructive/10 border border-destructive/20 overflow-hidden"
                                >
                                    <p className="text-sm text-destructive font-medium">{submitError}</p>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <div className="space-y-6">
                            <div className="bg-destructive/5 border border-destructive/10 rounded-lg p-4 flex items-start gap-3">
                                <Trash2 className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
                                <div className="space-y-1">
                                    <p className="text-sm font-medium text-destructive">Warning: Irreversible Action</p>
                                    <p className="text-xs text-muted-foreground">
                                        You are about to permanently delete this designation. Please verify the information below before proceeding.
                                    </p>
                                </div>
                            </div>

                            {/* Designation Details Section */}
                            <Accordion type="multiple" defaultValue={["designation-details"]} className="space-y-4">
                                <AccordionItem value="designation-details" className="border border-destructive/60 rounded-lg overflow-hidden bg-white dark:bg-zinc-950/40 last:border-b">
                                    <AccordionTrigger className="px-4 py-3 bg-destructive/5 dark:bg-destructive/10 hover:bg-destructive/10 dark:hover:bg-destructive/20 hover:no-underline">
                                        <div className="flex items-center gap-3">
                                            <Briefcase className="h-5 w-5 text-destructive/80 dark:text-red-400" />
                                            <span className="text-destructive/90 dark:text-red-400 font-medium">Designation Details</span>
                                        </div>
                                    </AccordionTrigger>
                                    <AccordionContent className="px-4 pb-4 pt-4">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <ReadOnlyField
                                                label="Role"
                                                value={values.role === 'admin' ? 'Administrator' : values.role === 'moderator' ? 'Moderator' : 'Employee'}
                                            />
                                            <ReadOnlyField label="Name" value={values.name} />
                                            <div className="md:col-span-2">
                                                <ReadOnlyField label="Description" value={values.description} />
                                            </div>
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>
                            </Accordion>

                            <div className="flex gap-4 pt-2 mt-8">
                                <CancelButton
                                    onClick={onCancel}
                                    disabled={isSubmitting}
                                    size="lg"
                                    className="flex-1"
                                >
                                    Cancel
                                </CancelButton>
                                <CreateUserButton
                                    onClick={() => onSubmit(values)}
                                    type="button"
                                    mode="delete"
                                    asyncState={isSubmitting ? 'loading' : isSuccess ? 'success' : submitError ? 'error' : 'idle'}
                                    disabled={isSubmitting || isSuccess}
                                    className="flex-1"
                                    size="lg"
                                    loadingText=" Deleting.. "
                                    successText="Deleted !! Designation"
                                    errorText="Can't Delete "
                                >
                                    {buttonText}
                                </CreateUserButton>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        )
    }

    // Add / Edit Mode
    return (
        <div className={cn("p-4 space-y-6", className)}>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <Card className="w-full bg-card dark:bg-zinc-900/90 text-card-foreground shadow-lg border-2 border-border/60 dark:border-zinc-800 rounded-lg">
                        <CardContent className="p-4">
                            {/* General Error Display */}
                            <AnimatePresence>
                                {submitError && (
                                    <motion.div
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: "auto" }}
                                        exit={{ opacity: 0, height: 0 }}
                                        className="mt-0 mb-6 p-4 rounded-lg bg-destructive/10 border border-destructive/20 overflow-hidden"
                                    >
                                        <p className="text-sm text-destructive font-medium">{submitError}</p>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* Designation Details Section */}
                            <Accordion type="multiple" defaultValue={["designation-details"]} className="bg-white/80 dark:bg-zinc-950/40 backdrop-blur-sm border dark:border-zinc-800 rounded-lg overflow-hidden mb-6">
                                <AccordionItem value="designation-details" className="border-b-0">
                                    <AccordionTrigger className={cn(
                                        "px-4 py-3 hover:no-underline transition-colors",
                                        isEditMode
                                            ? "bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/20 dark:hover:bg-purple-950/40"
                                            : "bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/20 dark:hover:bg-blue-950/40"
                                    )}>
                                        <div className="flex items-center gap-3">
                                            <Briefcase className={cn(
                                                "h-5 w-5",
                                                isEditMode ? "text-purple-600 dark:text-purple-400" : "text-blue-600 dark:text-blue-400"
                                            )} />
                                            <span className={cn(
                                                "font-medium",
                                                isEditMode ? "text-purple-900 dark:text-purple-200" : "text-blue-900 dark:text-blue-200"
                                            )}>Designation Details</span>
                                        </div>
                                    </AccordionTrigger>
                                    <AccordionContent className="px-4 pb-4 pt-4 space-y-4">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6">
                                            <FormField
                                                control={form.control}
                                                name="role"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Role *</FormLabel>
                                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                            <FormControl>
                                                                <SelectTrigger className="w-full">
                                                                    <SelectValue placeholder="Select a role" />
                                                                </SelectTrigger>
                                                            </FormControl>
                                                            <SelectContent>
                                                                <SelectItem value="admin">Admin</SelectItem>
                                                                <SelectItem value="moderator">Moderator</SelectItem>
                                                                <SelectItem value="employee">Employee</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={form.control}
                                                name="name"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Designation Name *</FormLabel>
                                                        <FormControl>
                                                            <Input placeholder="e.g. Senior Software Engineer" {...field} />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                        </div>
                                        <FormField
                                            control={form.control}
                                            name="description"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Description</FormLabel>
                                                    <FormControl>
                                                        <Textarea
                                                            placeholder="Brief description of the role responsibilities"
                                                            {...field}
                                                            value={field.value || ''}
                                                        />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </AccordionContent>
                                </AccordionItem>
                            </Accordion>

                            <div className="flex gap-4 pt-4 mt-6 border-t border-border/20">
                                <CancelButton
                                    onClick={onCancel}
                                    disabled={isSubmitting}
                                    size="lg"
                                    className="flex-1"
                                >
                                    Cancel
                                </CancelButton>
                                <CreateUserButton
                                    type="submit"
                                    mode={isEditMode ? 'edit' : 'create'}
                                    className="flex-1"
                                    size="lg"
                                    asyncState={
                                        isSubmitting
                                            ? 'loading'
                                            : isSuccess
                                                ? 'success'
                                                : submitError
                                                    ? 'error'
                                                    : 'idle'
                                    }
                                    disabled={isSubmitting}
                                    loadingText={isEditMode ? "Updating ..." : "Creating.."}
                                    successText={isEditMode ? "Saved !! Successfull" : "Saved !! Designation"}
                                    errorText={isEditMode ? "Failed to Update" : "Failed to Create"}
                                >
                                    {buttonText}
                                </CreateUserButton>
                            </div>
                        </CardContent>
                    </Card>
                </form>
            </Form>
        </div>
    )
})
