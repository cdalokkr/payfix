"use client"

import { useState, useMemo, useCallback, useEffect, useRef } from "react"
import { trpc } from "@/lib/trpc/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import { Building2, Edit, Loader2, Mail, MapPin } from "lucide-react"
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion"
import { DashboardPageLayout } from "@/components/dashboard/dashboard-page-layout"
import { cn } from "@/lib/utils"
import * as z from "zod"
import { useForm, Controller, Resolver } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Field, FieldLabel, FieldError } from "@/components/ui/field"
import { CancelButton } from "@/components/ui/action-button"
import CreateUserButton from "@/components/ui/create-user-button"
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

const clientSchema = z.object({
  company_name: z.string().min(1, "Company Name is required"),
  contact_person: z.string().optional(),
  email: z.string().min(1, "Email is required").email("Invalid email address"),
  phone: z.string().min(1, "Phone is required").regex(/^[0-9]{10}$/, "Phone must be exactly 10 digits"),
  alt_phone: z.string().refine((val) => !val || /^[0-9]{10}$/.test(val), "Alt phone must be exactly 10 digits").optional(),
  gst_number: z.string().optional(),
  pan_number: z.string().optional(),
  website: z.string().url("Invalid URL").optional().or(z.literal("")),
  industry: z.string().optional(),
  address_line1: z.string().optional(),
  address_line2: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  pincode: z.string().refine(val => !val || /^[0-9]+$/.test(val), "Pincode must contain only numbers").optional(),
  country: z.string().default("India"),
  notes: z.string().optional(),
})

type ClientFormValues = z.infer<typeof clientSchema>

const emptyForm: ClientFormValues = {
  company_name: "", contact_person: "", email: "", phone: "", alt_phone: "",
  gst_number: "", pan_number: "", website: "", industry: "",
  address_line1: "", address_line2: "", city: "", state: "", pincode: "", country: "India",
  notes: "",
}

export default function ClientsPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [showCreateSheet, setShowCreateSheet] = useState(false)
  const [editingClient, setEditingClient] = useState<any>(null)
  const [deletingClient, setDeletingClient] = useState<any>(null)
  const [statusToggleClient, setStatusToggleClient] = useState<any>(null)
  const [isSuccess, setIsSuccess] = useState(false)
  
  const form = useForm<ClientFormValues>({
    resolver: zodResolver(clientSchema) as Resolver<ClientFormValues>,
    defaultValues: emptyForm,
    mode: "onChange",
  })

  const [activeTab, setActiveTab] = useState<'active' | 'inactive'>('active')
  const [rowSelection, setRowSelection] = useState({})
  const [recentlyUpdatedId, setRecentlyUpdatedId] = useState<string | null>(null)
  const [updatedCells, setUpdatedCells] = useState<Record<string, string[]>>({})
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

  const { data: clientsData, isLoading, refetch } = trpc.clients.list.useQuery({
    search: searchTerm || undefined,
    status: activeTab,
  })

  // Mutations
  const createMutation = trpc.clients.create.useMutation({
    onSuccess: () => {
      toast.success("Client added successfully")
      setIsSuccess(true)
      setTimeout(() => {
        setIsSuccess(false)
        resetForm()
        refetch()
      }, 2000)
    },
    onError: (err) => toast.error(err.message),
  })

  const updateMutation = trpc.clients.update.useMutation({
    onSuccess: (data) => {
      toast.success("Client updated successfully")
      setIsSuccess(true)
      
      setTimeout(() => {
        setIsSuccess(false)
        resetForm()
        refetch()
      }, 2000)
      
      // Highlight updated row
      setRecentlyUpdatedId(data.id)
      setTimeout(() => {
        if (isMounted.current) setRecentlyUpdatedId(null)
      }, 2000)
    },
    onError: (err) => toast.error(err.message),
  })

  const deleteMutation = trpc.clients.delete.useMutation({
    onSuccess: () => {
      toast.success("Client deleted successfully")
      setDeletingClient(null)
      setRowSelection({})
      refetch()
    },
    onError: (err) => toast.error(err.message),
  })

  const resetForm = () => {
    setShowCreateSheet(false)
    setEditingClient(null)
    form.reset(emptyForm)
    setRowSelection({})
  }

  // Action Handlers
  const handleEditClient = useCallback((client: any) => {
    setEditingClient(client)
    form.reset({
      company_name: client.company_name || "",
      contact_person: client.contact_person || "",
      email: client.email || "",
      phone: client.phone || "",
      alt_phone: client.alt_phone || "",
      gst_number: client.gst_number || "",
      pan_number: client.pan_number || "",
      website: client.website || "",
      industry: client.industry || "",
      address_line1: client.address_line1 || "",
      address_line2: client.address_line2 || "",
      city: client.city || "",
      state: client.state || "",
      pincode: client.pincode || "",
      country: client.country || "India",
      notes: client.notes || "",
    })
    setShowCreateSheet(true)
  }, [form])

  const handleDeleteClient = useCallback((client: any) => {
    setDeletingClient(client)
  }, [])

  const handleToggleStatus = useCallback((client: any) => {
    setStatusToggleClient(client)
  }, [])

  const handleCreateClient = useCallback(() => {
    resetForm()
    setShowCreateSheet(true)
  }, [])

  const onConfirmToggleStatus = () => {
    if (!statusToggleClient) return
    const newStatus = statusToggleClient.status === 'active' ? 'inactive' : 'active'
    updateMutation.mutate({
      id: statusToggleClient.id,
      status: newStatus,
    })
    setStatusToggleClient(null)
    setRowSelection({})
  }

  const onConfirmDelete = () => {
    if (!deletingClient) return
    deleteMutation.mutate({ id: deletingClient.id })
  }

  const onSubmit = (data: ClientFormValues) => {
    if (editingClient) {
      updateMutation.mutate({ id: editingClient.id, ...data })
    } else {
      createMutation.mutate(data)
    }
  }

  const handleFormSubmit = form.handleSubmit(onSubmit as any)

  // Columns definition
  const columns = useMemo(() => createClientsColumns(
    handleEditClient,
    handleDeleteClient,
    handleToggleStatus,
    updatedCells,
    true // show action menus
  ), [handleEditClient, handleDeleteClient, handleToggleStatus, updatedCells])

  const inactiveColumns = useMemo(() => createClientsColumns(
    handleEditClient,
    handleDeleteClient,
    handleToggleStatus,
    updatedCells,
    false // hide action menus for inactive tab, or we can leave it true. Based on users page, deleted users don't have menus.
  ), [handleEditClient, handleDeleteClient, handleToggleStatus, updatedCells])

  const clients = clientsData?.data || []

  const filteredClients = useMemo(() => {
    return clients
  }, [clients])

  const isSaving = createMutation.isPending || updateMutation.isPending

  return (
    <DashboardPageLayout 
      heading="Clients" 
      description="Manage your client directory"
    >
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>All Clients List</CardTitle>
          <CardDescription className="text-muted-foreground text-sm">
            View and manage all client accounts. Use the table controls to search, filter, and select clients.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="[&_td:not(:first-child)]:px-3 [&_th:not(:first-child)]:px-3 [&_td]:py-3 [&_table]:text-xs">
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
                    data={filteredClients}
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
                    data={filteredClients}
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
        </CardContent>
      </Card>

      {/* Create/Edit Client Sheet */}
      <Sheet open={showCreateSheet} onOpenChange={(open) => { if (!open) resetForm() }}>
        <SheetContent className="w-full sm:max-w-2xl flex flex-col">
          <div className="flex-shrink-0 px-4 sm:px-6 border-b border-border/80 pb-3">
            <SheetHeader className="text-left pb-0">
              <SheetTitle className="flex items-center gap-3 text-xl font-bold py-1">
                <div className={cn(
                  "p-2 rounded-lg",
                  editingClient ? "bg-purple-100" : "bg-blue-100"
                )}>
                  {editingClient ? (
                    <Edit className={cn("h-6 w-6", editingClient ? "text-purple-600" : "text-blue-600")} />
                  ) : (
                    <Building2 className={cn("h-6 w-6", editingClient ? "text-purple-600" : "text-blue-600")} />
                  )}
                </div>
                <div className="flex flex-col">
                  <span className={cn(
                    "leading-tight",
                    editingClient ? "text-purple-700" : "text-blue-700"
                  )}>{editingClient ? 'Edit Client' : 'Add New Client'}</span>
                  <span className="text-xs font-medium text-muted-foreground mt-0 leading-tight">
                    {editingClient ? 'Update client details' : 'Enter new client details'}
                  </span>
                </div>
              </SheetTitle>
            </SheetHeader>
          </div>
          <div className="flex-1 overflow-y-auto mt-0">
            <div className="px-4 sm:px-6 lg:px-6 pb-4 pt-4 space-y-6">
              <Card className="w-full max-w-2xl mx-auto bg-white shadow-lg border-2 border-border/60 rounded-lg">
                <CardContent className="p-4">
                  <form onSubmit={handleFormSubmit} className="space-y-6" noValidate>
                    <Accordion type="multiple" defaultValue={["company-details"]} className="bg-white/80 backdrop-blur-sm rounded-lg border">
              {/* Company Details */}
              <AccordionItem value="company-details" className="border-b-0">
                <AccordionTrigger className={cn(
                  "px-4 py-3 rounded-t-lg hover:no-underline transition-colors",
                  editingClient ? "bg-purple-50 hover:bg-purple-100" : "bg-blue-50 hover:bg-blue-100"
                )}>
                  <div className="flex items-center gap-3">
                    <Building2 className={cn("h-5 w-5", editingClient ? "text-purple-600" : "text-blue-600")} />
                    <span className={cn("font-medium", editingClient ? "text-purple-900" : "text-blue-900")}>Company Details</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4 pt-4 space-y-4 bg-white/80">
                  <Controller
                    name="company_name"
                    control={form.control}
                    render={({ field, fieldState }) => (
                      <Field data-invalid={fieldState.invalid}>
                        <FieldLabel htmlFor="company_name">Company Name *</FieldLabel>
                        <Input id="company_name" className={cn("rounded-xl", fieldState.invalid && "border-destructive")} {...field} value={field.value || ""} />
                        {fieldState.invalid && fieldState.error && <FieldError errors={[fieldState.error]} className="mt-1" />}
                      </Field>
                    )}
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <Controller
                      name="industry"
                      control={form.control}
                      render={({ field, fieldState }) => (
                        <Field data-invalid={fieldState.invalid}>
                          <FieldLabel htmlFor="industry">Industry</FieldLabel>
                          <Input id="industry" placeholder="e.g. IT, Manufacturing" className={cn("rounded-xl", fieldState.invalid && "border-destructive")} {...field} value={field.value || ""} />
                          {fieldState.invalid && fieldState.error && <FieldError errors={[fieldState.error]} className="mt-1" />}
                        </Field>
                      )}
                    />
                    <Controller
                      name="website"
                      control={form.control}
                      render={({ field, fieldState }) => (
                        <Field data-invalid={fieldState.invalid}>
                          <FieldLabel htmlFor="website">Website</FieldLabel>
                          <Input id="website" placeholder="https://" className={cn("rounded-xl", fieldState.invalid && "border-destructive")} {...field} value={field.value || ""} />
                          {fieldState.invalid && fieldState.error && <FieldError errors={[fieldState.error]} className="mt-1" />}
                        </Field>
                      )}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <Controller
                      name="gst_number"
                      control={form.control}
                      render={({ field, fieldState }) => (
                        <Field data-invalid={fieldState.invalid}>
                          <FieldLabel htmlFor="gst_number">GST Number</FieldLabel>
                          <Input id="gst_number" className={cn("rounded-xl", fieldState.invalid && "border-destructive")} {...field} value={field.value || ""} />
                          {fieldState.invalid && fieldState.error && <FieldError errors={[fieldState.error]} className="mt-1" />}
                        </Field>
                      )}
                    />
                    <Controller
                      name="pan_number"
                      control={form.control}
                      render={({ field, fieldState }) => (
                        <Field data-invalid={fieldState.invalid}>
                          <FieldLabel htmlFor="pan_number">PAN Number</FieldLabel>
                          <Input id="pan_number" className={cn("rounded-xl", fieldState.invalid && "border-destructive")} {...field} value={field.value || ""} />
                          {fieldState.invalid && fieldState.error && <FieldError errors={[fieldState.error]} className="mt-1" />}
                        </Field>
                      )}
                    />
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>

              {/* Contact Details */}
              <Accordion type="multiple" defaultValue={["contact-details"]} className="bg-white/80 backdrop-blur-sm rounded-lg border">
              <AccordionItem value="contact-details" className="border-b-0">
                <AccordionTrigger className={cn(
                  "px-4 py-3 rounded-t-lg hover:no-underline transition-colors",
                  editingClient ? "bg-purple-50 hover:bg-purple-100" : "bg-blue-50 hover:bg-blue-100"
                )}>
                  <div className="flex items-center gap-3">
                    <Mail className={cn("h-5 w-5", editingClient ? "text-purple-600" : "text-blue-600")} />
                    <span className={cn("font-medium", editingClient ? "text-purple-900" : "text-blue-900")}>Contact Information</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4 pt-4 space-y-4 bg-white/80">
                  <Controller
                    name="contact_person"
                    control={form.control}
                    render={({ field, fieldState }) => (
                      <Field data-invalid={fieldState.invalid}>
                        <FieldLabel htmlFor="contact_person">Contact Person</FieldLabel>
                        <Input id="contact_person" className={cn("rounded-xl", fieldState.invalid && "border-destructive")} {...field} value={field.value || ""} />
                        {fieldState.invalid && fieldState.error && <FieldError errors={[fieldState.error]} className="mt-1" />}
                      </Field>
                    )}
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <Controller
                      name="phone"
                      control={form.control}
                      render={({ field, fieldState }) => (
                        <Field data-invalid={fieldState.invalid}>
                          <FieldLabel htmlFor="phone">Phone *</FieldLabel>
                          <Input id="phone" className={cn("rounded-xl", fieldState.invalid && "border-destructive")} {...field} value={field.value || ""} onChange={(e) => {
                            const value = e.target.value
                            if (/^\d*$/.test(value) && value.length <= 10) {
                              field.onChange(value)
                            }
                          }} />
                          {fieldState.invalid && fieldState.error && <FieldError errors={[fieldState.error]} className="mt-1" />}
                        </Field>
                      )}
                    />
                    <Controller
                      name="alt_phone"
                      control={form.control}
                      render={({ field, fieldState }) => (
                        <Field data-invalid={fieldState.invalid}>
                          <FieldLabel htmlFor="alt_phone">Alt Phone</FieldLabel>
                          <Input id="alt_phone" className={cn("rounded-xl", fieldState.invalid && "border-destructive")} {...field} value={field.value || ""} onChange={(e) => {
                            const value = e.target.value
                            if (/^\d*$/.test(value) && value.length <= 10) {
                              field.onChange(value)
                            }
                          }} />
                          {fieldState.invalid && fieldState.error && <FieldError errors={[fieldState.error]} className="mt-1" />}
                        </Field>
                      )}
                    />
                  </div>
                  <Controller
                    name="email"
                    control={form.control}
                    render={({ field, fieldState }) => (
                      <Field data-invalid={fieldState.invalid}>
                        <FieldLabel htmlFor="email">Email Address *</FieldLabel>
                        <Input id="email" type="email" className={cn("rounded-xl", fieldState.invalid && "border-destructive")} {...field} value={field.value || ""} />
                        {fieldState.invalid && fieldState.error && <FieldError errors={[fieldState.error]} className="mt-1" />}
                      </Field>
                    )}
                  />
                </AccordionContent>
              </AccordionItem>
            </Accordion>

              {/* Location Details */}
              <Accordion type="multiple" defaultValue={["location-details"]} className="bg-white/80 backdrop-blur-sm rounded-lg border">
              <AccordionItem value="location-details" className="border-b-0">
                <AccordionTrigger className={cn(
                  "px-4 py-3 rounded-t-lg hover:no-underline transition-colors",
                  editingClient ? "bg-purple-50 hover:bg-purple-100" : "bg-blue-50 hover:bg-blue-100"
                )}>
                  <div className="flex items-center gap-3">
                    <MapPin className={cn("h-5 w-5", editingClient ? "text-purple-600" : "text-blue-600")} />
                    <span className={cn("font-medium", editingClient ? "text-purple-900" : "text-blue-900")}>Location Details</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4 pt-4 space-y-4 bg-white/80">
                  <Controller
                    name="address_line1"
                    control={form.control}
                    render={({ field, fieldState }) => (
                      <Field data-invalid={fieldState.invalid}>
                        <FieldLabel htmlFor="address_line1">Address Line 1</FieldLabel>
                        <Input id="address_line1" className={cn("rounded-xl", fieldState.invalid && "border-destructive")} {...field} value={field.value || ""} />
                        {fieldState.invalid && fieldState.error && <FieldError errors={[fieldState.error]} className="mt-1" />}
                      </Field>
                    )}
                  />
                  <Controller
                    name="address_line2"
                    control={form.control}
                    render={({ field, fieldState }) => (
                      <Field data-invalid={fieldState.invalid}>
                        <FieldLabel htmlFor="address_line2">Address Line 2</FieldLabel>
                        <Input id="address_line2" className={cn("rounded-xl", fieldState.invalid && "border-destructive")} {...field} value={field.value || ""} />
                        {fieldState.invalid && fieldState.error && <FieldError errors={[fieldState.error]} className="mt-1" />}
                      </Field>
                    )}
                  />
                  <div className="grid grid-cols-3 gap-4">
                    <Controller
                      name="city"
                      control={form.control}
                      render={({ field, fieldState }) => (
                        <Field data-invalid={fieldState.invalid}>
                          <FieldLabel htmlFor="city">City</FieldLabel>
                          <Input id="city" className={cn("rounded-xl", fieldState.invalid && "border-destructive")} {...field} value={field.value || ""} />
                          {fieldState.invalid && fieldState.error && <FieldError errors={[fieldState.error]} className="mt-1" />}
                        </Field>
                      )}
                    />
                    <Controller
                      name="state"
                      control={form.control}
                      render={({ field, fieldState }) => (
                        <Field data-invalid={fieldState.invalid}>
                          <FieldLabel htmlFor="state">State</FieldLabel>
                          <Input id="state" className={cn("rounded-xl", fieldState.invalid && "border-destructive")} {...field} value={field.value || ""} />
                          {fieldState.invalid && fieldState.error && <FieldError errors={[fieldState.error]} className="mt-1" />}
                        </Field>
                      )}
                    />
                    <Controller
                      name="pincode"
                      control={form.control}
                      render={({ field, fieldState }) => (
                        <Field data-invalid={fieldState.invalid}>
                          <FieldLabel htmlFor="pincode">Pincode</FieldLabel>
                          <Input id="pincode" className={cn("rounded-xl", fieldState.invalid && "border-destructive")} {...field} value={field.value || ""} />
                          {fieldState.invalid && fieldState.error && <FieldError errors={[fieldState.error]} className="mt-1" />}
                        </Field>
                      )}
                    />
                  </div>
                  <div className="border-t border-border/50 pt-4 mt-2">
                    <Controller
                      name="notes"
                      control={form.control}
                      render={({ field, fieldState }) => (
                        <Field data-invalid={fieldState.invalid}>
                          <FieldLabel htmlFor="notes">Notes</FieldLabel>
                          <Textarea id="notes" className={cn("rounded-xl min-h-[100px]", fieldState.invalid && "border-destructive")} {...field} value={field.value || ""} />
                          {fieldState.invalid && fieldState.error && <FieldError errors={[fieldState.error]} className="mt-1" />}
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
                onClick={resetForm}
                disabled={isSaving}
                size="lg"
                className="flex-1"
              >
                Cancel
              </CancelButton>
              <CreateUserButton
                type="submit"
                disabled={form.formState.isSubmitting || isSaving}
                size="lg"
                className="flex-1"
                asyncState={
                  isSaving ? 'loading' : 
                  isSuccess ? 'success' : 
                  (createMutation.isError || updateMutation.isError) ? 'error' : 
                  'idle'
                }
                mode={editingClient ? 'edit' : 'create'}
              >
                {editingClient ? "Update Client" : "Add Client"}
              </CreateUserButton>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingClient} onOpenChange={(open) => !open && setDeletingClient(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will mark the client <strong>{deletingClient?.company_name}</strong> as inactive. This is a soft delete.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setRowSelection({})}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={onConfirmDelete}
              className="bg-red-600 hover:bg-red-700 min-w-28 transition-all duration-200"
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Processing...</span>
                </div>
              ) : "Delete Client"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Status Toggle Confirmation */}
      <AlertDialog open={!!statusToggleClient} onOpenChange={(open) => !open && setStatusToggleClient(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Change Client Status</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to {statusToggleClient?.status === 'active' ? 'deactivate' : 'activate'} the client <strong>{statusToggleClient?.company_name}</strong>?
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
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? (
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
