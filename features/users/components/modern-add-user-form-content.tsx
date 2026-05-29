"use client"

import { memo, useState, useEffect } from "react"
import { UseFormReturn, Controller } from "react-hook-form"
import { Input } from "@/components/ui/input"
import { PasswordInput } from "@/components/ui/password-input"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    Field,
    FieldLabel,
    FieldError,
} from "@/components/ui/field"
import { Card, CardContent } from "@/components/ui/card"
import {
    Accordion,
    AccordionItem,
    AccordionTrigger,
    AccordionContent,
} from "@/components/ui/accordion"
import { User, Mail, Shield, Lock, Trash2, Briefcase } from "lucide-react"
import { CancelButton } from "@/components/ui/action-button"
import CreateUserButton from "@/components/ui/create-user-button"
import { Calendar28 } from "@/components/ui/calendar-28"
import { cn } from "@/lib/utils"
import { motion, AnimatePresence } from "framer-motion"
import { trpc } from "@/lib/trpc/client"

import { Module } from "@/types"

export type UserFormValues = {
    firstName: string
    middleName?: string | null
    lastName: string
    email: string
    mobileNo?: string | null
    dateOfBirth: string
    sex: "male" | "female" | ""
    role: "admin" | "moderator" | "employee" | ""
    designationId?: string | null
    allowedModules?: string[]
    password?: string
    confirmPassword?: string
}

interface FormContentProps {
    form: UseFormReturn<UserFormValues>
    isEditMode: boolean
    isSubmitting: boolean
    isSuccess: boolean
    submitError: string | null
    onCancel: () => void
    onSubmit: () => void
    buttonText: string
    className?: string
    useSheet?: boolean
    isDeleteMode?: boolean
    isProfileMode?: boolean
    isPasswordResetMode?: boolean
}

// Helper component for read-only fields
const ReadOnlyField = ({ label, value, className }: { label: string, value: string | null | undefined, className?: string }) => (
    <div className={cn("flex flex-col space-y-1.5", className)}>
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</span>
        <span className="text-sm font-medium text-foreground min-h-[20px]">{value || "-"}</span>
    </div>
)

export const FormContent = memo(function FormContent({
    form,
    isEditMode,
    isSubmitting,
    isSuccess,
    submitError,
    onCancel,
    onSubmit,
    buttonText,
    className,
    useSheet,
    isDeleteMode = false,
    isProfileMode = false,
    isPasswordResetMode = false
}: FormContentProps) {

    const { control, formState: { isValid, isSubmitting: formIsSubmitting }, getValues } = form
    const values = getValues()

    // Fetch designations for the dropdown
    const { data: designations } = trpc.admin.designation.getDesignations.useQuery(undefined, {
        staleTime: 5 * 60 * 1000, // 5 minutes
    })

    const selectedDesignationName = designations?.find(d => d.id === values.designationId)?.name || "-"
    const filteredDesignations = designations?.filter(d => d.role === values.role) || []

    // Use a stable date reference to avoid hydration issues with Next.js 16
    // Initialize with undefined and set on client side only
    const [currentDate, setCurrentDate] = useState<Date | undefined>(undefined)

    useEffect(() => {
        setCurrentDate(new Date())
    }, [])

    // If in delete mode, render the read-only view
    if (isDeleteMode) {
        return (
            <div className={cn("px-4 sm:px-6 lg:px-6", useSheet ? "pb-4" : "py-4", "space-y-6")}>
                <Card className={cn("w-full max-w-2xl mx-auto bg-card dark:bg-zinc-900/90 text-card-foreground shadow-lg border-2 border-destructive/20 rounded-lg", className)}>
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
                                        You are about to permanently delete this user. Please verify the information below before proceeding.
                                    </p>
                                </div>
                            </div>

                            {/* Personal Information Section */}
                            <Accordion type="multiple" defaultValue={["personal-info", "account-credentials", "access-permissions"]} className="space-y-4">
                                <AccordionItem value="personal-info" className="border border-destructive/60 rounded-lg overflow-hidden bg-white dark:bg-zinc-950/40 last:border-b">
                                    <AccordionTrigger className="px-4 py-3 bg-destructive/5 dark:bg-destructive/10 hover:bg-destructive/10 dark:hover:bg-destructive/20 hover:no-underline">
                                        <div className="flex items-center gap-3">
                                            <User className="h-5 w-5 text-destructive/80 dark:text-red-400" />
                                            <span className="text-destructive/90 dark:text-red-400 font-medium">Personal Information</span>
                                        </div>
                                    </AccordionTrigger>
                                    <AccordionContent className="px-4 pb-4 pt-4">
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                            <ReadOnlyField label="First Name" value={values.firstName} />
                                            <ReadOnlyField label="Middle Name" value={values.middleName} />
                                            <ReadOnlyField label="Last Name" value={values.lastName} />
                                            <ReadOnlyField label="Mobile Number" value={values.mobileNo} />
                                            <ReadOnlyField label="Sex" value={values.sex} />
                                            <ReadOnlyField
                                                label="Date of Birth"
                                                value={values.dateOfBirth ? (() => {
                                                    try {
                                                        const [year, month, day] = values.dateOfBirth.split('-')
                                                        return `${day}/${month}/${year}`
                                                    } catch (e) {
                                                        return values.dateOfBirth
                                                    }
                                                })() : "-"}
                                            />
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>

                                <AccordionItem value="account-credentials" className="border border-destructive/60 rounded-lg overflow-hidden bg-white dark:bg-zinc-950/40 last:border-b">
                                    <AccordionTrigger className="px-4 py-3 bg-destructive/5 dark:bg-destructive/10 hover:bg-destructive/10 dark:hover:bg-destructive/20 hover:no-underline">
                                        <div className="flex items-center gap-3">
                                            <Mail className="h-5 w-5 text-destructive/80 dark:text-red-400" />
                                            <span className="text-destructive/90 dark:text-red-400 font-medium">Account Credentials</span>
                                        </div>
                                    </AccordionTrigger>
                                    <AccordionContent className="px-4 pb-4 pt-4">
                                        <ReadOnlyField label="Email Address" value={values.email} />
                                    </AccordionContent>
                                </AccordionItem>

                                <AccordionItem value="access-permissions" className="border border-destructive/60 rounded-lg overflow-hidden bg-white dark:bg-zinc-950/40 last:border-b">
                                    <AccordionTrigger className="px-4 py-3 bg-destructive/5 dark:bg-destructive/10 hover:bg-destructive/10 dark:hover:bg-destructive/20 hover:no-underline">
                                        <div className="flex items-center gap-3">
                                            <Shield className="h-5 w-5 text-destructive/80 dark:text-red-400" />
                                            <span className="text-destructive/90 dark:text-red-400 font-medium">Access & Permissions</span>
                                        </div>
                                    </AccordionTrigger>
                                    <AccordionContent className="px-4 pb-4 pt-4">
                                        <ReadOnlyField
                                            label="User Role"
                                            value={values.role === 'admin' ? 'Administrator' : values.role === 'moderator' ? 'Moderator' : 'Employee'}
                                            className={values.role === 'admin' ? 'text-primary' : ''}
                                        />
                                        <ReadOnlyField
                                            label="Designation"
                                            value={selectedDesignationName}
                                        />
                                    </AccordionContent>
                                </AccordionItem>
                            </Accordion>

                            {/* Submit and Cancel Buttons */}
                            <div className="flex gap-4 pt-2 mt-8">
                                <CancelButton
                                    onClick={onCancel}
                                    disabled={formIsSubmitting || isSubmitting}
                                    size="lg"
                                    className="flex-1"
                                >
                                    Cancel
                                </CancelButton>
                                <CreateUserButton
                                    onClick={onSubmit}
                                    disabled={formIsSubmitting || isSubmitting || isSuccess}
                                    size="lg"
                                    className="flex-1"
                                    asyncState={isSubmitting ? 'loading' : isSuccess ? 'success' : submitError ? 'error' : 'idle'}
                                    errorText={submitError || "Failed to delete user - Please try again"}
                                    mode="delete"
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

    // If in password reset mode, render read-only user info + editable password fields
    if (isPasswordResetMode) {
        return (
            <div className={cn("px-4 sm:px-6 lg:px-6", useSheet ? "pb-4" : "py-4", "space-y-6")}>
                <Card className={cn("w-full max-w-2xl mx-auto bg-card dark:bg-zinc-900/90 text-card-foreground shadow-lg border-2 border-amber-500/20 rounded-lg", className)}>
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

                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6" noValidate>
                            {/* User details summary */}
                            <div className="bg-amber-50 dark:bg-amber-950/10 border border-amber-100 dark:border-amber-900/20 rounded-lg p-4 flex items-start gap-3">
                                <User className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                                <div className="space-y-3 w-full">
                                    <div className="space-y-1">
                                        <p className="text-sm font-medium text-amber-900 dark:text-amber-200">Resetting Password For</p>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                                            <ReadOnlyField label="User" value={`${values.firstName} ${values.lastName}`} />
                                            <ReadOnlyField label="Email" value={values.email} />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Password Fields */}
                            <Accordion type="multiple" defaultValue={["new-password"]} className="bg-white/80 dark:bg-zinc-950/40 backdrop-blur-sm rounded-lg border dark:border-zinc-800">
                                <AccordionItem value="new-password" className="border-b-0">
                                    <AccordionTrigger className={cn(
                                        "px-4 py-3 rounded-t-lg hover:no-underline transition-colors bg-amber-50 dark:bg-amber-950/20 hover:bg-amber-100 dark:hover:bg-amber-950/40"
                                    )}>
                                        <div className="flex items-center gap-3">
                                            <Lock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                                            <span className="font-medium text-amber-900 dark:text-amber-200">New Credentials</span>
                                        </div>
                                    </AccordionTrigger>
                                    <AccordionContent className="px-4 pb-4 pt-4 space-y-4">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <Controller
                                                name="password"
                                                control={control}
                                                render={({ field, fieldState }) => (
                                                    <Field data-invalid={fieldState.invalid}>
                                                        <FieldLabel htmlFor="password">New Password *</FieldLabel>
                                                        <div className="relative">
                                                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4 z-10" />
                                                            <PasswordInput
                                                                id="password"
                                                                placeholder="Enter new password"
                                                                className={cn("pl-10", fieldState.invalid && "border-destructive")}
                                                                autoComplete="new-password"
                                                                data-form-type="other"
                                                                {...field}
                                                            />
                                                        </div>
                                                        {fieldState.invalid && fieldState.error && (
                                                            <FieldError errors={[fieldState.error]} className="mt-1" />
                                                        )}
                                                    </Field>
                                                )}
                                            />

                                            <Controller
                                                name="confirmPassword"
                                                control={control}
                                                render={({ field, fieldState }) => (
                                                    <Field data-invalid={fieldState.invalid}>
                                                        <FieldLabel htmlFor="confirmPassword">Confirm Password *</FieldLabel>
                                                        <div className="relative">
                                                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4 z-10" />
                                                            <PasswordInput
                                                                id="confirmPassword"
                                                                placeholder="Confirm new password"
                                                                className={cn("pl-10", fieldState.invalid && "border-destructive")}
                                                                autoComplete="new-password"
                                                                data-form-type="other"
                                                                {...field}
                                                            />
                                                        </div>
                                                        {fieldState.invalid && fieldState.error && (
                                                            <FieldError errors={[fieldState.error]} className="mt-1" />
                                                        )}
                                                    </Field>
                                                )}
                                            />
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>
                            </Accordion>

                            {/* Submit and Cancel Buttons */}
                            <div className="flex gap-4 pt-2 mt-8">
                                <CancelButton
                                    onClick={onCancel}
                                    disabled={formIsSubmitting || isSubmitting}
                                    size="lg"
                                    className="flex-1"
                                >
                                    Cancel
                                </CancelButton>
                                <CreateUserButton
                                    type="submit"
                                    disabled={formIsSubmitting || isSubmitting || isSuccess}
                                    size="lg"
                                    className="flex-1 text-white"
                                    asyncState={isSubmitting ? 'loading' : isSuccess ? 'success' : submitError ? 'error' : 'idle'}
                                    errorText={submitError || "Failed to reset password - Please try again"}
                                    mode="reset"
                                >
                                    {buttonText}
                                </CreateUserButton>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            </div>
        )
    }

    return (
        <div className={cn("px-4 sm:px-6 lg:px-6", useSheet ? "pb-4" : "py-4", "space-y-6")}>
            <Card className={cn("w-full max-w-2xl mx-auto bg-card dark:bg-zinc-900/90 text-card-foreground shadow-lg border-2 border-border/60 dark:border-zinc-800 rounded-lg", className)}>
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

                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6" noValidate>
                        {/* Personal Information Section */}
                        <Accordion type="multiple" defaultValue={["personal-info"]} className="bg-white/80 dark:bg-zinc-950/40 backdrop-blur-sm rounded-lg border dark:border-zinc-800">
                            <AccordionItem value="personal-info" className="border-b-0">
                                <AccordionTrigger className={cn(
                                    "px-4 py-3 rounded-t-lg hover:no-underline transition-colors",
                                    isEditMode
                                        ? "bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/20 dark:hover:bg-purple-950/40"
                                        : "bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/20 dark:hover:bg-blue-950/40"
                                )}>
                                    <div className="flex items-center gap-3">
                                        <User className={cn(
                                            "h-5 w-5",
                                            isEditMode ? "text-purple-600 dark:text-purple-400" : "text-blue-600 dark:text-blue-400"
                                        )} />
                                        <span className={cn(
                                            "font-medium",
                                            isEditMode ? "text-purple-900 dark:text-purple-200" : "text-blue-900 dark:text-blue-200"
                                        )}>Personal Information</span>
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent className="px-4 pb-4 pt-4 space-y-4">
                                    {/* First Name, Middle Name, and Last Name in same row */}
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6">
                                        <Controller
                                            name="firstName"
                                            control={control}
                                            render={({ field, fieldState }) => (
                                                <Field data-invalid={fieldState.invalid}>
                                                    <FieldLabel htmlFor="firstName">First Name *</FieldLabel>
                                                    <Input
                                                        id="firstName"
                                                        type="text"
                                                        placeholder="John"
                                                        autoComplete="given-name"
                                                        {...field}
                                                        className={fieldState.invalid ? "border-destructive" : ""}
                                                        onChange={(e) => {
                                                            const value = e.target.value
                                                            if (/^[a-zA-Z. ]*$/.test(value)) {
                                                                field.onChange(value)
                                                            }
                                                        }}
                                                    />
                                                    {fieldState.invalid && fieldState.error && (
                                                        <FieldError errors={[fieldState.error]} className="mt-1" />
                                                    )}
                                                </Field>
                                            )}
                                        />

                                        <Controller
                                            name="middleName"
                                            control={control}
                                            render={({ field, fieldState }) => (
                                                <Field data-invalid={fieldState.invalid}>
                                                    <FieldLabel htmlFor="middleName">Middle Name</FieldLabel>
                                                    <Input
                                                        id="middleName"
                                                        type="text"
                                                        placeholder="Michael"
                                                        autoComplete="additional-name"
                                                        {...field}
                                                        value={field.value || ""}
                                                        className={fieldState.invalid ? "border-destructive" : ""}
                                                        onChange={(e) => {
                                                            const value = e.target.value
                                                            if (/^[a-zA-Z. ]*$/.test(value)) {
                                                                field.onChange(value)
                                                            }
                                                        }}
                                                    />
                                                    {fieldState.invalid && fieldState.error && (
                                                        <FieldError errors={[fieldState.error]} className="mt-1" />
                                                    )}
                                                </Field>
                                            )}
                                        />

                                        <Controller
                                            name="lastName"
                                            control={control}
                                            render={({ field, fieldState }) => (
                                                <Field data-invalid={fieldState.invalid}>
                                                    <FieldLabel htmlFor="lastName">Last Name *</FieldLabel>
                                                    <Input
                                                        id="lastName"
                                                        type="text"
                                                        placeholder="Doe"
                                                        autoComplete="family-name"
                                                        {...field}
                                                        className={fieldState.invalid ? "border-destructive" : ""}
                                                        onChange={(e) => {
                                                            const value = e.target.value
                                                            if (/^[a-zA-Z. ]*$/.test(value)) {
                                                                field.onChange(value)
                                                            }
                                                        }}
                                                    />
                                                    {fieldState.invalid && fieldState.error && (
                                                        <FieldError errors={[fieldState.error]} className="mt-1" />
                                                    )}
                                                </Field>
                                            )}
                                        />
                                    </div>

                                    {/* Mobile, Sex, and Date of Birth in same row */}
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6">
                                        <Controller
                                            name="mobileNo"
                                            control={control}
                                            render={({ field, fieldState }) => (
                                                <Field data-invalid={fieldState.invalid}>
                                                    <FieldLabel htmlFor="mobileNo">Mobile Number</FieldLabel>
                                                    <Input
                                                        id="mobileNo"
                                                        type="tel"
                                                        inputMode="tel"
                                                        placeholder="1234567890"
                                                        autoComplete="tel"
                                                        {...field}
                                                        value={field.value || ""}
                                                        className={fieldState.invalid ? "border-destructive" : ""}
                                                        onChange={(e) => {
                                                            const value = e.target.value
                                                            if (/^\d*$/.test(value) && value.length <= 10) {
                                                                field.onChange(value)
                                                            }
                                                        }}
                                                    />
                                                    {fieldState.invalid && fieldState.error && (
                                                        // Only show error if length is 10 (full length but invalid?) or form is submitted
                                                        // Suppress error while typing (length < 10) unless submitted
                                                        (field.value?.length === 10 || form.formState.isSubmitted) && (
                                                            <FieldError errors={[fieldState.error]} className="mt-1" />
                                                        )
                                                    )}
                                                </Field>
                                            )}
                                        />

                                        <Controller
                                            name="sex"
                                            control={control}
                                            render={({ field, fieldState }) => (
                                                <Field data-invalid={fieldState.invalid}>
                                                    <FieldLabel htmlFor="sex">Sex *</FieldLabel>
                                                    <Select value={field.value || ""} onValueChange={field.onChange}>
                                                        <SelectTrigger className={fieldState.invalid ? "border-destructive" : ""}>
                                                            <SelectValue placeholder="Select Gender" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="male">Male</SelectItem>
                                                            <SelectItem value="female">Female</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                    {fieldState.invalid && fieldState.error && (
                                                        <FieldError errors={[fieldState.error]} className="mt-1" />
                                                    )}
                                                </Field>
                                            )}
                                        />

                                        <Controller
                                            name="dateOfBirth"
                                            control={control}
                                            render={({ field, fieldState }) => {
                                                // Convert YYYY-MM-DD to dd/mm/yyyy for Calendar28 display
                                                const displayValue = field.value && field.value.includes('-')
                                                    ? (() => {
                                                        const [year, month, day] = field.value.split('-')
                                                        return `${day}/${month}/${year}`
                                                    })()
                                                    : field.value || ""

                                                return (
                                                    <Field data-invalid={fieldState.invalid}>
                                                        <FieldLabel htmlFor="dateOfBirth">Date of Birth *</FieldLabel>
                                                        <div className="relative">
                                                            <Calendar28
                                                                id="dateOfBirth"
                                                                value={displayValue}
                                                                onChange={(value) => {
                                                                    // Convert dd/mm/yyyy to YYYY-MM-DD for form
                                                                    if (value) {
                                                                        const [day, month, year] = value.split('/')
                                                                        if (day && month && year) {
                                                                            field.onChange(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`)
                                                                        }
                                                                    } else {
                                                                        field.onChange("")
                                                                    }
                                                                }}
                                                                label=""
                                                                className={fieldState.invalid ? "border-destructive" : ""}
                                                                removeSpacing={true}
                                                                minAge={13}
                                                                maxAge={120}
                                                                asOnDate={currentDate}
                                                                defaultAge={18}
                                                            />
                                                        </div>
                                                        {fieldState.invalid && fieldState.error && (
                                                            <FieldError errors={[fieldState.error]} className="mt-1" />
                                                        )}
                                                    </Field>
                                                )
                                            }}
                                        />
                                    </div>
                                </AccordionContent>
                            </AccordionItem>
                        </Accordion>

                        {/* Account Credentials Section - Only show in create mode */}
                        {!isEditMode && (
                            <Accordion type="multiple" defaultValue={["account-credentials"]} className="bg-white/80 dark:bg-zinc-950/40 backdrop-blur-sm rounded-lg border dark:border-zinc-800">
                                <AccordionItem value="account-credentials" className="border-b-0">
                                    <AccordionTrigger className={cn(
                                        "px-4 py-3 rounded-t-lg hover:no-underline transition-colors",
                                        isEditMode
                                            ? "bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/20 dark:hover:bg-purple-950/40"
                                            : "bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/20 dark:hover:bg-blue-950/40"
                                    )}>
                                        <div className="flex items-center gap-3">
                                            <Mail className={cn(
                                                "h-5 w-5",
                                                isEditMode ? "text-purple-600 dark:text-purple-400" : "text-blue-600 dark:text-blue-400"
                                            )} />
                                            <span className={cn(
                                                "font-medium",
                                                isEditMode ? "text-purple-900 dark:text-purple-200" : "text-blue-900 dark:text-blue-200"
                                            )}>Account Credentials</span>
                                        </div>
                                    </AccordionTrigger>
                                    <AccordionContent className="px-4 pb-4 pt-4 space-y-4">
                                        <Controller
                                            name="email"
                                            control={control}
                                            render={({ field, fieldState }) => (
                                                <Field data-invalid={fieldState.invalid}>
                                                    <FieldLabel htmlFor="email">Email Address *</FieldLabel>
                                                    <div className="relative">
                                                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
                                                        <Input
                                                            id="email"
                                                            type="email"
                                                            inputMode="email"
                                                            placeholder="user@example.com"
                                                            className={cn("pl-10", fieldState.invalid && "border-destructive")}
                                                            autoComplete="new-email"
                                                            data-form-type="other"
                                                            {...field}
                                                        />
                                                    </div>
                                                    {fieldState.invalid && fieldState.error && (
                                                        <FieldError errors={[fieldState.error]} className="mt-1" />
                                                    )}
                                                </Field>
                                            )}
                                        />

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <Controller
                                                name="password"
                                                control={control}
                                                render={({ field, fieldState }) => (
                                                    <Field data-invalid={fieldState.invalid}>
                                                        <FieldLabel htmlFor="password">Password *</FieldLabel>
                                                        <div className="relative">
                                                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4 z-10" />
                                                            <PasswordInput
                                                                id="password"
                                                                placeholder="Create a strong password"
                                                                className={cn("pl-10", fieldState.invalid && "border-destructive")}
                                                                autoComplete="new-password"
                                                                data-form-type="other"
                                                                {...field}
                                                            />
                                                        </div>
                                                        {fieldState.invalid && fieldState.error && (
                                                            <FieldError errors={[fieldState.error]} className="mt-1" />
                                                        )}
                                                    </Field>
                                                )}
                                            />

                                            <Controller
                                                name="confirmPassword"
                                                control={control}
                                                render={({ field, fieldState }) => (
                                                    <Field data-invalid={fieldState.invalid}>
                                                        <FieldLabel htmlFor="confirmPassword">Confirm Password *</FieldLabel>
                                                        <div className="relative">
                                                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4 z-10" />
                                                            <PasswordInput
                                                                id="confirmPassword"
                                                                placeholder="Confirm password"
                                                                className={cn("pl-10", fieldState.invalid && "border-destructive")}
                                                                autoComplete="new-password"
                                                                data-form-type="other"
                                                                {...field}
                                                            />
                                                        </div>
                                                        {fieldState.invalid && fieldState.error && (
                                                            <FieldError errors={[fieldState.error]} className="mt-1" />
                                                        )}
                                                    </Field>
                                                )}
                                            />
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>
                            </Accordion>
                        )}

                        {/* Email section for edit mode */}
                        {isEditMode && (
                            <Accordion type="multiple" defaultValue={["account-credentials"]} className="bg-white/80 dark:bg-zinc-950/40 backdrop-blur-sm rounded-lg border dark:border-zinc-800">
                                <AccordionItem value="account-credentials" className="border-b-0">
                                    <AccordionTrigger className={cn(
                                        "px-4 py-3 rounded-t-lg hover:no-underline transition-colors",
                                        isEditMode
                                            ? "bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/20 dark:hover:bg-purple-950/40"
                                            : "bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/20 dark:hover:bg-blue-950/40"
                                    )}>
                                        <div className="flex items-center gap-3">
                                            <Mail className={cn(
                                                "h-5 w-5",
                                                isEditMode ? "text-purple-600 dark:text-purple-400" : "text-blue-600 dark:text-blue-400"
                                            )} />
                                            <span className={cn(
                                                "font-medium",
                                                isEditMode ? "text-purple-900 dark:text-purple-200" : "text-blue-900 dark:text-blue-200"
                                            )}>Email Address</span>
                                        </div>
                                    </AccordionTrigger>
                                    <AccordionContent className="px-4 pb-4 pt-4 space-y-4">
                                        <Controller
                                            name="email"
                                            control={control}
                                            render={({ field, fieldState }) => (
                                                <Field data-invalid={fieldState.invalid}>
                                                    <FieldLabel htmlFor="email">Email Address *</FieldLabel>
                                                    <div className="relative">
                                                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
                                                        <Input
                                                            id="email"
                                                            type="email"
                                                            inputMode="email"
                                                            placeholder="user@example.com"
                                                            className={cn("pl-10", fieldState.invalid && "border-destructive")}
                                                            autoComplete="email"
                                                            data-form-type="other"
                                                            {...field}
                                                        />
                                                    </div>
                                                    {fieldState.invalid && fieldState.error && (
                                                        <FieldError errors={[fieldState.error]} className="mt-1" />
                                                    )}
                                                </Field>
                                            )}
                                        />
                                    </AccordionContent>
                                </AccordionItem>
                            </Accordion>
                        )}

                        {/* Access & Permissions Section - Hide in Profile Mode */}
                        {!isProfileMode && (
                            <Accordion type="multiple" defaultValue={["access-permissions"]} className="bg-white/80 dark:bg-zinc-950/40 backdrop-blur-sm rounded-lg border dark:border-zinc-800">
                                <AccordionItem value="access-permissions" className="border-b-0">
                                    <AccordionTrigger className={cn(
                                        "px-4 py-3 rounded-t-lg hover:no-underline transition-colors",
                                        isEditMode
                                            ? "bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/20 dark:hover:bg-purple-950/40"
                                            : "bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/20 dark:hover:bg-blue-950/40"
                                    )}>
                                        <div className="flex items-center gap-3">
                                            <Shield className={cn(
                                                "h-5 w-5",
                                                isEditMode ? "text-purple-600 dark:text-purple-400" : "text-blue-600 dark:text-blue-400"
                                            )} />
                                            <span className={cn(
                                                "font-medium",
                                                isEditMode ? "text-purple-900 dark:text-purple-200" : "text-blue-900 dark:text-blue-200"
                                            )}>Access & Permissions</span>
                                        </div>
                                    </AccordionTrigger>
                                    <AccordionContent className="px-4 pb-4 pt-4 space-y-4">
                                        {/* Role and Designation in same row */}
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6">
                                            <Controller
                                                name="role"
                                                control={control}
                                                render={({ field, fieldState }) => (
                                                    <Field data-invalid={fieldState.invalid}>
                                                        <FieldLabel htmlFor="role">User Role *</FieldLabel>
                                                        <Select
                                                            value={field.value || ""}
                                                            onValueChange={(val) => {
                                                                field.onChange(val)
                                                                // Clear designation when role changes
                                                                form.setValue('designationId', null)
                                                            }}
                                                        >
                                                            <SelectTrigger className={fieldState.invalid ? "border-destructive" : ""}>
                                                                <SelectValue placeholder="Select a role" />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="admin">Admin (Full Control)</SelectItem>
                                                                <SelectItem value="moderator">Moderator (Backoffice Access)</SelectItem>
                                                                <SelectItem value="employee">Employee (Restricted Access)</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                        {fieldState.invalid && fieldState.error && (
                                                            <FieldError errors={[fieldState.error]} className="mt-1" />
                                                        )}
                                                    </Field>
                                                )}
                                            />

                                            <Controller
                                                name="designationId"
                                                control={control}
                                                render={({ field, fieldState }) => (
                                                    <Field data-invalid={fieldState.invalid}>
                                                        <FieldLabel htmlFor="designationId">Designation</FieldLabel>
                                                        <Select
                                                            value={field.value || ""}
                                                            onValueChange={field.onChange}
                                                            disabled={!values.role}
                                                        >
                                                            <SelectTrigger className={fieldState.invalid ? "border-destructive" : ""}>
                                                                <SelectValue placeholder={!values.role ? "Select Role first" : "Select Designation"} />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                {filteredDesignations.map((designation) => (
                                                                    <SelectItem key={designation.id} value={designation.id}>
                                                                        {designation.name}
                                                                    </SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                        <div className="flex gap-2">
                                                            {fieldState.invalid && fieldState.error && (
                                                                <FieldError errors={[fieldState.error]} className="mt-1" />
                                                            )}
                                                            {/* Show message if no designations found for role */}
                                                            {values.role && filteredDesignations.length === 0 && !fieldState.invalid && (
                                                                <p className="text-[0.8rem] text-muted-foreground mt-1">
                                                                    No designations found for {values.role}
                                                                </p>
                                                            )}
                                                        </div>
                                                    </Field>
                                                )}
                                            />
                                        </div>

                                    </AccordionContent>
                                </AccordionItem>

                                {/* Allowed Modules Section - Only show when role is employee */}
                                {form.watch('role') === 'employee' && (
                                    <AccordionItem value="allowed-modules" className="border-b-0">
                                        <AccordionTrigger className={cn(
                                            "px-4 py-3 rounded-t-lg hover:no-underline transition-colors",
                                            isEditMode
                                                ? "bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/20 dark:hover:bg-purple-950/40"
                                                : "bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/20 dark:hover:bg-blue-950/40"
                                        )}>
                                            <div className="flex items-center gap-3">
                                                <Shield className={cn(
                                                    "h-5 w-5",
                                                    isEditMode ? "text-purple-600 dark:text-purple-400" : "text-blue-600 dark:text-blue-400"
                                                )} />
                                                <span className={cn(
                                                    "font-medium",
                                                    isEditMode ? "text-purple-900 dark:text-purple-200" : "text-blue-900 dark:text-blue-200"
                                                )}>Allowed Modules</span>
                                            </div>
                                        </AccordionTrigger>
                                        <AccordionContent className="px-4 pb-4 pt-4 space-y-4">
                                            <Controller
                                                name="allowedModules"
                                                control={control}
                                                render={({ field }) => (
                                                    <div className="grid grid-cols-2 gap-4">
                                                        {(['dashboard', 'users', 'reports', 'settings', 'analytics', 'notifications', 'billing', 'profile'] as Module[]).map((module) => (
                                                            <div key={module} className="flex items-center space-x-2">
                                                                <Checkbox
                                                                    id={`module-${module}`}
                                                                    checked={field.value?.includes(module)}
                                                                    onCheckedChange={(checked: boolean) => {
                                                                        const current = field.value || []
                                                                        const updated = checked
                                                                            ? [...current, module]
                                                                            : current.filter((value) => value !== module)
                                                                        field.onChange(updated)
                                                                    }}
                                                                />
                                                                <Label htmlFor={`module-${module}`} className="capitalize cursor-pointer">{module}</Label>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            />
                                        </AccordionContent>
                                    </AccordionItem>
                                )}
                            </Accordion>
                        )}

                        {/* Submit and Cancel Buttons */}
                        <div className="flex gap-4 pt-6 mt-6 border-t border-border/20">
                            <CancelButton
                                onClick={onCancel}
                                disabled={formIsSubmitting || isSubmitting}
                                size="lg"
                                className="flex-1"
                            >
                                Cancel
                            </CancelButton>
                            <CreateUserButton
                                // onClick={onSubmit} // Removed to prevent double submission (handled by form onSubmit)
                                type="submit"
                                disabled={formIsSubmitting || isSubmitting || isSuccess}
                                size="lg"
                                className="flex-1"
                                asyncState={isSubmitting ? 'loading' : isSuccess ? 'success' : submitError ? 'error' : 'idle'}
                                errorText={submitError || `Failed to ${isDeleteMode ? 'delete' : isEditMode ? 'update' : 'create'} user - Please try again`}
                                mode={isDeleteMode ? 'delete' : isEditMode ? 'edit' : 'create'}
                            >
                                {buttonText}
                            </CreateUserButton>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div >
    )
})
