"use client"

import { memo, useState, useEffect, useRef } from "react"
import { useForm, Controller, UseFormReturn, Resolver } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { trpc } from "@/lib/trpc/client"
import { toast } from "sonner"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Building2, Edit, Trash2, Mail, MapPin } from "lucide-react"
import { cn } from "@/lib/utils"
import { motion, AnimatePresence } from "framer-motion"

import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Field, FieldLabel, FieldError } from "@/components/ui/field"
import { CancelButton } from "@/components/ui/action-button"
import CreateUserButton from "@/components/ui/create-user-button"

// Client Form Validation Schema matching standard DB constraints
export const clientSchema = z.object({
  company_name: z.string().min(1, "Company Name is required"),
  contact_person: z.string().optional().or(z.literal("")),
  email: z.string().min(1, "Email is required").email("Invalid email address"),
  phone: z.string().min(1, "Phone is required").regex(/^[0-9]{10}$/, "Phone must be exactly 10 digits"),
  alt_phone: z.string().refine((val) => !val || /^[0-9]{10}$/.test(val), "Alt phone must be exactly 10 digits").optional().or(z.literal("")),
  gst_number: z.string().optional().or(z.literal("")),
  pan_number: z.string().optional().or(z.literal("")),
  website: z.string().url("Invalid URL").optional().or(z.literal("")),
  industry: z.string().optional().or(z.literal("")),
  address_line1: z.string().optional().or(z.literal("")),
  address_line2: z.string().optional().or(z.literal("")),
  city: z.string().optional().or(z.literal("")),
  state: z.string().optional().or(z.literal("")),
  pincode: z.string().refine(val => !val || /^[0-9]+$/.test(val), "Pincode must contain only numbers").optional().or(z.literal("")),
  country: z.string().default("India"),
  notes: z.string().optional().or(z.literal("")),
})

export type ClientFormValues = z.infer<typeof clientSchema>

export const emptyForm: ClientFormValues = {
  company_name: "",
  contact_person: "",
  email: "",
  phone: "",
  alt_phone: "",
  gst_number: "",
  pan_number: "",
  website: "",
  industry: "",
  address_line1: "",
  address_line2: "",
  city: "",
  state: "",
  pincode: "",
  country: "India",
  notes: "",
}

interface ModernAddClientFormProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  onSuccess?: (updatedFields?: string[]) => void
  onCancel?: () => void
  className?: string
  useSheet?: boolean
  editingClient?: any | null
  refetch?: () => void
  isDeleteMode?: boolean
}

// Helper component for read-only fields inside delete mode
const ReadOnlyField = ({ label, value, className }: { label: string; value: string | null | undefined; className?: string }) => (
  <div className={cn("flex flex-col space-y-1.5", className)}>
    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</span>
    <span className="text-sm font-medium text-foreground min-h-[20px]">{value || "-"}</span>
  </div>
)

export function ModernAddClientForm({
  open = false,
  onOpenChange,
  onSuccess,
  onCancel,
  className,
  useSheet = false,
  editingClient,
  refetch,
  isDeleteMode = false,
}: ModernAddClientFormProps) {
  const [internalOpen, setInternalOpen] = useState(false)
  const isEditMode = !!editingClient
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSuccess, setIsSuccess] = useState(false)

  const dirtyFieldsRef = useRef<string[]>([])
  const isMounted = useRef(false)

  const [successTimeout, setSuccessTimeout] = useState<NodeJS.Timeout | null>(null)
  const [errorTimeout, setErrorTimeout] = useState<NodeJS.Timeout | null>(null)

  const utils = trpc.useUtils()

  const isOpen = useSheet ? (open || internalOpen) : true

  const handleOpenChange = (newOpen: boolean) => {
    if (useSheet) {
      if (onOpenChange) {
        onOpenChange(newOpen)
      } else {
        setInternalOpen(newOpen)
      }
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
    if (successTimeout) {
      clearTimeout(successTimeout)
      setSuccessTimeout(null)
    }
    if (errorTimeout) {
      clearTimeout(errorTimeout)
      setErrorTimeout(null)
    }
  }

  const defaultValues: ClientFormValues = isEditMode && editingClient ? {
    company_name: editingClient.company_name || "",
    contact_person: editingClient.contact_person || "",
    email: editingClient.email || "",
    phone: editingClient.phone || "",
    alt_phone: editingClient.alt_phone || "",
    gst_number: editingClient.gst_number || "",
    pan_number: editingClient.pan_number || "",
    website: editingClient.website || "",
    industry: editingClient.industry || "",
    address_line1: editingClient.address_line1 || "",
    address_line2: editingClient.address_line2 || "",
    city: editingClient.city || "",
    state: editingClient.state || "",
    pincode: editingClient.pincode || "",
    country: editingClient.country || "India",
    notes: editingClient.notes || "",
  } : emptyForm

  const form = useForm<ClientFormValues>({
    resolver: zodResolver(clientSchema) as Resolver<ClientFormValues>,
    defaultValues,
    mode: "onChange",
  })

  useEffect(() => {
    isMounted.current = true
    return () => {
      isMounted.current = false
      clearTimeouts()
    }
  }, [])

  useEffect(() => {
    if (isEditMode && editingClient) {
      form.reset({
        company_name: editingClient.company_name || "",
        contact_person: editingClient.contact_person || "",
        email: editingClient.email || "",
        phone: editingClient.phone || "",
        alt_phone: editingClient.alt_phone || "",
        gst_number: editingClient.gst_number || "",
        pan_number: editingClient.pan_number || "",
        website: editingClient.website || "",
        industry: editingClient.industry || "",
        address_line1: editingClient.address_line1 || "",
        address_line2: editingClient.address_line2 || "",
        city: editingClient.city || "",
        state: editingClient.state || "",
        pincode: editingClient.pincode || "",
        country: editingClient.country || "India",
        notes: editingClient.notes || "",
      })
    }
  }, [isEditMode, editingClient, form])

  // Invalidate tRPC cache and trigger list refetch
  const handleSuccess = () => {
    if (!isMounted.current) return
    setIsSuccess(true)
    setSubmitError(null)

    utils.clients.list.invalidate()
    if (refetch) refetch()

    if (successTimeout) clearTimeout(successTimeout)

    const timeout = setTimeout(() => {
      if (!isMounted.current) return
      setIsSuccess(false)
      form.reset()
      if (useSheet) handleOpenChange(false)
      setTimeout(() => {
        if (isMounted.current) onSuccess?.(dirtyFieldsRef.current)
      }, 150)
    }, 2000)

    setSuccessTimeout(timeout)
  }

  const handleError = (error: { message: string }) => {
    if (!isMounted.current) return
    setIsSuccess(false)
    let errorMessage = "Operation failed"
    if (error.message.includes("already exists") || error.message.includes("unique constraint")) {
      errorMessage = "A client with this company name or email already exists"
    } else if (error.message) {
      errorMessage = error.message
    }
    setSubmitError(errorMessage)
    toast.error(errorMessage)

    if (errorTimeout) clearTimeout(errorTimeout)

    const timeout = setTimeout(() => {
      if (isMounted.current) setSubmitError(null)
    }, 5000)

    setErrorTimeout(timeout)
  }

  // TRPC Mutations
  const createClientMutation = trpc.clients.create.useMutation({
    onSuccess: handleSuccess,
    onError: handleError,
  })

  const updateClientMutation = trpc.clients.update.useMutation({
    onSuccess: handleSuccess,
    onError: handleError,
  })

  const deleteClientMutation = trpc.clients.delete.useMutation({
    onSuccess: handleSuccess,
    onError: handleError,
  })

  const isPending = (createClientMutation.isPending || updateClientMutation.isPending || deleteClientMutation.isPending) && !isSuccess

  const onSubmit = async (data: ClientFormValues): Promise<void> => {
    setSubmitError(null)
    try {
      if (isDeleteMode && editingClient) {
        await deleteClientMutation.mutateAsync({ id: editingClient.id })
      } else if (isEditMode && editingClient) {
        await updateClientMutation.mutateAsync({ id: editingClient.id, ...data })
      } else {
        await createClientMutation.mutateAsync(data)
      }
    } catch (error) {
      console.error("Client Form submission error:", error)
    }
  }

  const handleFormSubmit = async () => {
    if (!isDeleteMode) {
      const isValid = await form.trigger()
      if (!isValid) return
    }

    const dirtyFields = Object.keys(form.formState.dirtyFields)
    dirtyFieldsRef.current = dirtyFields

    await onSubmit(form.getValues())
  }

  const handleCancel = () => {
    clearTimeouts()
    form.reset()
    setSubmitError(null)
    setIsSuccess(false)
    if (useSheet) {
      handleOpenChange(false)
    } else {
      onCancel?.()
    }
  }

  const dynamicTitle = isDeleteMode ? "Delete Client" : isEditMode ? "Edit Client" : "Add New Client"
  const dynamicDescription = isDeleteMode
    ? "Are you sure you want to delete this client? This action will mark them as inactive."
    : isEditMode
      ? "Update client information, company details, and location data"
      : "Enter new client details to add them to your directory"

  const FormIcon = isDeleteMode ? Trash2 : isEditMode ? Edit : Building2
  const buttonText = isDeleteMode ? "Delete Client" : isEditMode ? "Update Client" : "Add Client"

  if (useSheet) {
    return (
      <Sheet open={isOpen} onOpenChange={handleOpenChange}>
        <SheetContent className="w-full sm:max-w-2xl flex flex-col">
          <div className="flex-shrink-0 px-4 sm:px-6 border-b border-border/80 pb-3">
            <SheetHeader className="text-left pb-0">
              <SheetTitle className="flex items-center gap-3 text-xl font-bold py-1">
                <div className={cn(
                  "p-2 rounded-lg",
                  isDeleteMode ? "bg-destructive/10" : isEditMode ? "bg-purple-100 dark:bg-purple-950/20" : "bg-blue-100 dark:bg-blue-950/20"
                )}>
                  <FormIcon className={cn(
                    "h-6 w-6",
                    isDeleteMode ? "text-destructive" : isEditMode ? "text-purple-600 dark:text-purple-400" : "text-blue-600 dark:text-blue-400"
                  )} />
                </div>
                <div className="flex flex-col">
                  <span className={cn(
                    "leading-tight",
                    isDeleteMode ? "text-destructive" : isEditMode ? "text-purple-700 dark:text-purple-200" : "text-blue-700 dark:text-blue-200"
                  )}>{dynamicTitle}</span>
                  <span className="text-xs font-medium text-muted-foreground mt-0 leading-tight">
                    {dynamicDescription}
                  </span>
                </div>
              </SheetTitle>
            </SheetHeader>
          </div>

          <div className="flex-1 overflow-y-auto mt-0">
            <FormContent
              form={form}
              isEditMode={isEditMode}
              isSubmitting={isPending}
              isSuccess={isSuccess}
              submitError={submitError}
              onCancel={handleCancel}
              onSubmit={handleFormSubmit}
              buttonText={buttonText}
              useSheet={useSheet}
              isDeleteMode={isDeleteMode}
              editingClient={editingClient}
            />
          </div>
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <FormContent
      form={form}
      isEditMode={isEditMode}
      isSubmitting={isPending}
      isSuccess={isSuccess}
      submitError={submitError}
      onCancel={handleCancel}
      onSubmit={handleFormSubmit}
      buttonText={buttonText}
      className={className}
      useSheet={useSheet}
      isDeleteMode={isDeleteMode}
      editingClient={editingClient}
    />
  )
}

interface FormContentProps {
  form: UseFormReturn<ClientFormValues>
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
  editingClient?: any
}

const FormContent = memo(function FormContent({
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
  editingClient,
}: FormContentProps) {
  const { control, formState: { isSubmitting: formIsSubmitting }, getValues } = form
  const values = getValues()

  // Delete Mode read-only layout
  if (isDeleteMode) {
    return (
      <div className={cn("px-4 sm:px-6 lg:px-6", useSheet ? "pb-4" : "py-4", "space-y-6")}>
        <Card className={cn(
          "w-full max-w-2xl mx-auto text-card-foreground",
          useSheet
            ? "border-0 shadow-none bg-transparent dark:bg-transparent"
            : "bg-card dark:bg-zinc-900/90 shadow-lg border-2 border-destructive/20 rounded-lg",
          className
        )}>
          <CardContent className={useSheet ? "p-0" : "p-4"}>
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
                  <p className="text-sm font-medium text-destructive">Warning: Inactive Transition</p>
                  <p className="text-xs text-muted-foreground">
                    You are about to deactivate client <strong>{values.company_name}</strong>. Their complaints and reports will be archived.
                  </p>
                </div>
              </div>

              {/* Top-Level Separate Individual Accordions (NO outer border wrapping) */}
              <div className="space-y-4">
                
                {/* Company Details (Red/Rose Theme) */}
                <Accordion type="multiple" defaultValue={["company-details"]} className="bg-white/80 dark:bg-zinc-950/40 backdrop-blur-sm rounded-lg border border-red-500/25 overflow-hidden">
                  <AccordionItem value="company-details" className="border-b-0">
                    <AccordionTrigger className="px-4 py-3 bg-red-500/5 dark:bg-red-500/10 hover:bg-red-500/10 dark:hover:bg-red-500/20 hover:no-underline">
                      <div className="flex items-center gap-3">
                        <Building2 className="h-5 w-5 text-red-600 dark:text-red-400" />
                        <span className="text-red-900 dark:text-red-200 font-medium">Company Details</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4 pt-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <ReadOnlyField label="Company Name" value={values.company_name} />
                        <ReadOnlyField label="Industry" value={values.industry} />
                        <ReadOnlyField label="Website" value={values.website} />
                        <ReadOnlyField label="GST Number" value={values.gst_number} />
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>

                {/* Contact Information (Amber Theme) */}
                <Accordion type="multiple" defaultValue={["contact-details"]} className="bg-white/80 dark:bg-zinc-950/40 backdrop-blur-sm rounded-lg border border-amber-500/25 overflow-hidden">
                  <AccordionItem value="contact-details" className="border-b-0">
                    <AccordionTrigger className="px-4 py-3 bg-amber-500/5 dark:bg-amber-500/10 hover:bg-amber-500/10 dark:hover:bg-amber-500/20 hover:no-underline">
                      <div className="flex items-center gap-3">
                        <Mail className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                        <span className="text-amber-900 dark:text-amber-200 font-medium">Contact Information</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4 pt-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <ReadOnlyField label="Contact Person" value={values.contact_person} />
                        <ReadOnlyField label="Phone" value={values.phone} />
                        <ReadOnlyField label="Email" value={values.email} />
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>

                {/* Location Details (Gray/Zinc Theme) */}
                <Accordion type="multiple" defaultValue={["location-details"]} className="bg-white/80 dark:bg-zinc-950/40 backdrop-blur-sm rounded-lg border border-zinc-500/25 overflow-hidden">
                  <AccordionItem value="location-details" className="border-b-0">
                    <AccordionTrigger className="px-4 py-3 bg-zinc-500/5 dark:bg-zinc-800/10 hover:bg-zinc-500/10 dark:hover:bg-zinc-800/20 hover:no-underline">
                      <div className="flex items-center gap-3">
                        <MapPin className="h-5 w-5 text-zinc-600 dark:text-zinc-400" />
                        <span className="text-zinc-900 dark:text-zinc-200 font-medium">Location Details</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4 pt-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <ReadOnlyField label="Address Line 1" value={values.address_line1} />
                        <ReadOnlyField label="Address Line 2" value={values.address_line2} />
                        <ReadOnlyField label="City" value={values.city} />
                        <ReadOnlyField label="State" value={values.state} />
                        <ReadOnlyField label="Pincode" value={values.pincode} />
                        <ReadOnlyField label="Notes" value={values.notes} />
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>

              </div>

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
                  asyncState={isSubmitting ? "loading" : isSuccess ? "success" : submitError ? "error" : "idle"}
                  errorText={submitError || "Deletion failed"}
                  mode="delete"
                  loadingText="Deactivating..."
                  successText="Deactivated!"
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

  // Create & Edit Mode layout (Separate, individual accordions with NO outer border wrapping)
  return (
    <div className={cn("px-4 sm:px-6 lg:px-6", useSheet ? "pb-4" : "py-4", "space-y-6")}>
      <Card className={cn(
        "w-full max-w-2xl mx-auto text-card-foreground",
        useSheet
          ? "border-0 shadow-none bg-transparent dark:bg-transparent"
          : "bg-card dark:bg-zinc-900/90 shadow-lg border-2 border-border/60 dark:border-zinc-800 rounded-lg",
        className
      )}>
        <CardContent className={useSheet ? "p-0" : "p-4"}>
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
            
            {/* Sibling Individual Accordions (NO outer border wrapping) */}
            <div className="space-y-6">
              
              {/* Company Details (Blue/Sky Theme) */}
              <Accordion type="multiple" defaultValue={["company-details"]} className="bg-white/80 dark:bg-zinc-950/40 backdrop-blur-sm rounded-lg border border-blue-500/25 overflow-hidden">
                <AccordionItem value="company-details" className="border-b-0">
                  <AccordionTrigger className="px-4 py-3 rounded-t-lg hover:no-underline transition-colors bg-blue-500/5 hover:bg-blue-500/10 dark:bg-blue-950/20 dark:hover:bg-blue-950/40">
                    <div className="flex items-center gap-3">
                      <Building2 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      <span className="font-medium text-blue-900 dark:text-blue-200">Company Details</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-4 pt-4 space-y-4 bg-white/30 dark:bg-zinc-950/10">
                    <Controller
                      name="company_name"
                      control={control}
                      render={({ field, fieldState }) => (
                        <Field data-invalid={fieldState.invalid}>
                          <FieldLabel htmlFor="company_name">Company Name *</FieldLabel>
                          <Input
                            id="company_name"
                            placeholder="e.g. Acme Corporation"
                            className={fieldState.invalid ? "border-destructive" : ""}
                            {...field}
                            onChange={(e) => {
                              const value = e.target.value
                              if (/^[a-zA-Z0-9. &\-]*$/.test(value)) {
                                field.onChange(value)
                              }
                            }}
                          />
                          {fieldState.invalid && fieldState.error && <FieldError errors={[fieldState.error]} className="mt-1" />}
                        </Field>
                      )}
                    />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Dynamic Select Dropdown Component for Industry */}
                      <Controller
                        name="industry"
                        control={control}
                        render={({ field, fieldState }) => (
                          <Field data-invalid={fieldState.invalid}>
                            <FieldLabel htmlFor="industry">Industry</FieldLabel>
                            <Select value={field.value || ""} onValueChange={field.onChange}>
                              <SelectTrigger id="industry" className={fieldState.invalid ? "border-destructive" : ""}>
                                <SelectValue placeholder="Select Industry" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Technology">Technology</SelectItem>
                                <SelectItem value="Education">Education</SelectItem>
                                <SelectItem value="Healthcare">Healthcare</SelectItem>
                                <SelectItem value="Finance">Finance</SelectItem>
                                <SelectItem value="Manufacturing">Manufacturing</SelectItem>
                                <SelectItem value="Retail">Retail</SelectItem>
                                <SelectItem value="Real Estate">Real Estate</SelectItem>
                                <SelectItem value="Logistics">Logistics</SelectItem>
                                <SelectItem value="Media">Media</SelectItem>
                                <SelectItem value="Others">Others</SelectItem>
                              </SelectContent>
                            </Select>
                            {fieldState.invalid && fieldState.error && <FieldError errors={[fieldState.error]} className="mt-1" />}
                          </Field>
                        )}
                      />

                      <Controller
                        name="website"
                        control={control}
                        render={({ field, fieldState }) => (
                          <Field data-invalid={fieldState.invalid}>
                            <FieldLabel htmlFor="website">Website</FieldLabel>
                            <Input
                              id="website"
                              placeholder="https://example.com"
                              className={fieldState.invalid ? "border-destructive" : ""}
                              {...field}
                            />
                            {fieldState.invalid && fieldState.error && <FieldError errors={[fieldState.error]} className="mt-1" />}
                          </Field>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Controller
                        name="gst_number"
                        control={control}
                        render={({ field, fieldState }) => (
                          <Field data-invalid={fieldState.invalid}>
                            <FieldLabel htmlFor="gst_number">GST Number</FieldLabel>
                            <Input
                              id="gst_number"
                              placeholder="22AAAAA0000A1Z5"
                              className={cn("uppercase", fieldState.invalid && "border-destructive")}
                              {...field}
                            />
                            {fieldState.invalid && fieldState.error && <FieldError errors={[fieldState.error]} className="mt-1" />}
                          </Field>
                        )}
                      />

                      <Controller
                        name="pan_number"
                        control={control}
                        render={({ field, fieldState }) => (
                          <Field data-invalid={fieldState.invalid}>
                            <FieldLabel htmlFor="pan_number">PAN Number</FieldLabel>
                            <Input
                              id="pan_number"
                              placeholder="ABCDE1234F"
                              className={cn("uppercase", fieldState.invalid && "border-destructive")}
                              {...field}
                            />
                            {fieldState.invalid && fieldState.error && <FieldError errors={[fieldState.error]} className="mt-1" />}
                          </Field>
                        )}
                      />
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>

              {/* Contact Information (Emerald/Teal Theme) */}
              <Accordion type="multiple" defaultValue={["contact-details"]} className="bg-white/80 dark:bg-zinc-950/40 backdrop-blur-sm rounded-lg border border-emerald-500/25 overflow-hidden">
                <AccordionItem value="contact-details" className="border-b-0">
                  <AccordionTrigger className="px-4 py-3 bg-emerald-500/5 hover:bg-emerald-500/10 dark:bg-emerald-950/10 dark:hover:bg-emerald-950/20 hover:no-underline">
                    <div className="flex items-center gap-3">
                      <Mail className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                      <span className="font-medium text-emerald-900 dark:text-emerald-200">Contact Information</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-4 pt-4 space-y-4 bg-white/30 dark:bg-zinc-950/10">
                    <Controller
                      name="contact_person"
                      control={control}
                      render={({ field, fieldState }) => (
                        <Field data-invalid={fieldState.invalid}>
                          <FieldLabel htmlFor="contact_person">Contact Person</FieldLabel>
                          <Input
                            id="contact_person"
                            placeholder="Jane Doe"
                            className={fieldState.invalid ? "border-destructive" : ""}
                            {...field}
                            onChange={(e) => {
                              const value = e.target.value
                              if (/^[a-zA-Z. ]*$/.test(value)) {
                                field.onChange(value)
                              }
                            }}
                          />
                          {fieldState.invalid && fieldState.error && <FieldError errors={[fieldState.error]} className="mt-1" />}
                        </Field>
                      )}
                    />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Controller
                        name="phone"
                        control={control}
                        render={({ field, fieldState }) => (
                          <Field data-invalid={fieldState.invalid}>
                            <FieldLabel htmlFor="phone">Phone *</FieldLabel>
                            <Input
                              id="phone"
                              placeholder="10-digit number"
                              className={fieldState.invalid ? "border-destructive" : ""}
                              {...field}
                              onChange={(e) => {
                                const value = e.target.value
                                if (/^\d*$/.test(value) && value.length <= 10) {
                                  field.onChange(value)
                                }
                              }}
                            />
                            {fieldState.invalid && fieldState.error && <FieldError errors={[fieldState.error]} className="mt-1" />}
                          </Field>
                        )}
                      />

                      <Controller
                        name="alt_phone"
                        control={control}
                        render={({ field, fieldState }) => (
                          <Field data-invalid={fieldState.invalid}>
                            <FieldLabel htmlFor="alt_phone">Alt Phone</FieldLabel>
                            <Input
                              id="alt_phone"
                              placeholder="10-digit number"
                              className={fieldState.invalid ? "border-destructive" : ""}
                              {...field}
                              onChange={(e) => {
                                const value = e.target.value
                                if (/^\d*$/.test(value) && value.length <= 10) {
                                  field.onChange(value)
                                }
                              }}
                            />
                            {fieldState.invalid && fieldState.error && <FieldError errors={[fieldState.error]} className="mt-1" />}
                          </Field>
                        )}
                      />
                    </div>

                    <Controller
                      name="email"
                      control={control}
                      render={({ field, fieldState }) => (
                        <Field data-invalid={fieldState.invalid}>
                          <FieldLabel htmlFor="email">Email Address *</FieldLabel>
                          <Input
                            id="email"
                            type="email"
                            placeholder="client@company.com"
                            className={fieldState.invalid ? "border-destructive" : ""}
                            {...field}
                          />
                          {fieldState.invalid && fieldState.error && <FieldError errors={[fieldState.error]} className="mt-1" />}
                        </Field>
                      )}
                    />
                  </AccordionContent>
                </AccordionItem>
              </Accordion>

              {/* Location Details (Purple/Indigo Theme) */}
              <Accordion type="multiple" defaultValue={["location-details"]} className="bg-white/80 dark:bg-zinc-950/40 backdrop-blur-sm rounded-lg border border-purple-500/25 overflow-hidden">
                <AccordionItem value="location-details" className="border-b-0">
                  <AccordionTrigger className="px-4 py-3 bg-purple-500/5 hover:bg-purple-500/10 dark:bg-purple-950/10 dark:hover:bg-purple-950/20 hover:no-underline">
                    <div className="flex items-center gap-3">
                      <MapPin className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                      <span className="font-medium text-purple-900 dark:text-purple-200">Location Details</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-4 pt-4 space-y-4 bg-white/30 dark:bg-zinc-950/10">
                    <Controller
                      name="address_line1"
                      control={control}
                      render={({ field, fieldState }) => (
                        <Field data-invalid={fieldState.invalid}>
                          <FieldLabel htmlFor="address_line1">Address Line 1</FieldLabel>
                          <Input
                            id="address_line1"
                            placeholder="Building, Street Name"
                            className={fieldState.invalid ? "border-destructive" : ""}
                            {...field}
                          />
                          {fieldState.invalid && fieldState.error && <FieldError errors={[fieldState.error]} className="mt-1" />}
                        </Field>
                      )}
                    />

                    <Controller
                      name="address_line2"
                      control={control}
                      render={({ field, fieldState }) => (
                        <Field data-invalid={fieldState.invalid}>
                          <FieldLabel htmlFor="address_line2">Address Line 2</FieldLabel>
                          <Input
                            id="address_line2"
                            placeholder="Area, Landmark"
                            className={fieldState.invalid ? "border-destructive" : ""}
                            {...field}
                          />
                          {fieldState.invalid && fieldState.error && <FieldError errors={[fieldState.error]} className="mt-1" />}
                        </Field>
                      )}
                    />

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <Controller
                        name="city"
                        control={control}
                        render={({ field, fieldState }) => (
                          <Field data-invalid={fieldState.invalid}>
                            <FieldLabel htmlFor="city">City</FieldLabel>
                            <Input
                              id="city"
                              placeholder="City"
                              className={fieldState.invalid ? "border-destructive" : ""}
                              {...field}
                            />
                            {fieldState.invalid && fieldState.error && <FieldError errors={[fieldState.error]} className="mt-1" />}
                          </Field>
                        )}
                      />

                      <Controller
                        name="state"
                        control={control}
                        render={({ field, fieldState }) => (
                          <Field data-invalid={fieldState.invalid}>
                            <FieldLabel htmlFor="state">State</FieldLabel>
                            <Input
                              id="state"
                              placeholder="State"
                              className={fieldState.invalid ? "border-destructive" : ""}
                              {...field}
                            />
                            {fieldState.invalid && fieldState.error && <FieldError errors={[fieldState.error]} className="mt-1" />}
                          </Field>
                        )}
                      />

                      <Controller
                        name="pincode"
                        control={control}
                        render={({ field, fieldState }) => (
                          <Field data-invalid={fieldState.invalid}>
                            <FieldLabel htmlFor="pincode">Pincode</FieldLabel>
                            <Input
                              id="pincode"
                              placeholder="Pincode"
                              className={fieldState.invalid ? "border-destructive" : ""}
                              {...field}
                              onChange={(e) => {
                                const value = e.target.value
                                if (/^\d*$/.test(value)) {
                                  field.onChange(value)
                                }
                              }}
                            />
                            {fieldState.invalid && fieldState.error && <FieldError errors={[fieldState.error]} className="mt-1" />}
                          </Field>
                        )}
                      />
                    </div>

                    <div className="border-t border-border/50 pt-4 mt-2">
                      <Controller
                        name="notes"
                        control={control}
                        render={({ field, fieldState }) => (
                          <Field data-invalid={fieldState.invalid}>
                            <FieldLabel htmlFor="notes">Notes / Special Instructions</FieldLabel>
                            <Textarea
                              id="notes"
                              placeholder="Add any extra notes here..."
                              className={cn("min-h-[100px]", fieldState.invalid && "border-destructive")}
                              {...field}
                            />
                            {fieldState.invalid && fieldState.error && <FieldError errors={[fieldState.error]} className="mt-1" />}
                          </Field>
                        )}
                      />
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>

            </div>

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
                className="flex-1"
                asyncState={isSubmitting ? "loading" : isSuccess ? "success" : submitError ? "error" : "idle"}
                errorText={submitError || "Submission failed"}
                mode={isEditMode ? "edit" : "create"}
                loadingText={isEditMode ? "Updating client..." : "Creating client..."}
                successText={isEditMode ? "Client updated!" : "Client created!"}
              >
                {buttonText}
              </CreateUserButton>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
})
