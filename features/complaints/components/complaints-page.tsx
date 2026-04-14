"use client"

import { useState } from "react"
import { trpc } from "@/lib/trpc/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { TicketStatusBadge, PriorityBadge, CategoryBadge } from "@/features/complaints/components/status-badges"
import { PageHeading } from "@/components/ui/page-heading"
import { MetricCard } from "@/components/dashboard/metric-card"
import { CompactMetricCard } from "@/components/dashboard/compact-metric-card"
import { format } from "date-fns"
import { toast } from "sonner"
import Link from "next/link"
import {
  MessageSquareWarning, Plus, Search, Filter, Building2,
  Phone, PhoneCall, PhoneOff, TicketCheck, Clock, FileText, Info, Edit
} from "lucide-react"
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion"
import { motion } from "framer-motion"
import { DashboardPageLayout } from "@/components/dashboard/dashboard-page-layout"
import { cn } from "@/lib/utils"
import { Loader2 } from "lucide-react"
import * as z from "zod"
import { useForm, Controller, Resolver } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Field, FieldLabel, FieldError } from "@/components/ui/field"
import { CancelButton } from "@/components/ui/action-button"
import CreateUserButton from "@/components/ui/create-user-button"
import { Card, CardContent } from "@/components/ui/card"
import { ComplaintDetailSheet } from "./complaint-detail-sheet"

const complaintSchema = z.object({
  client_id: z.string().optional(),
  subject: z.string().min(1, "Subject is required"),
  description: z.string().optional(),
  category: z.enum(["billing", "technical", "service", "product", "general"]).default("general"),
  priority: z.enum(["low", "medium", "high", "critical"]).default("medium"),
  source: z.enum(["email", "phone", "walk-in", "whatsapp"]).default("email"),
  sla_hours: z.number().min(1, "SLA hours must be at least 1").default(48),
})

type ComplaintFormValues = z.infer<typeof complaintSchema>

const emptyForm: ComplaintFormValues = {
  client_id: "",
  subject: "",
  description: "",
  category: "general",
  priority: "medium",
  source: "email",
  sla_hours: 48,
}

export default function ComplaintsPage({ basePath = "/admin" }: { basePath?: string }) {
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("")
  const [priorityFilter, setPriorityFilter] = useState<string>("")
  const [categoryFilter, setCategoryFilter] = useState<string>("")
  const [showCreateSheet, setShowCreateSheet] = useState(false)
  const [selectedComplaintId, setSelectedComplaintId] = useState<string | null>(null)

  const { data: complaintsData, isLoading, refetch } = trpc.complaints.list.useQuery({
    search: search || undefined,
    status: (statusFilter || undefined) as any,
    priority: (priorityFilter || undefined) as any,
    category: (categoryFilter || undefined) as any,
  })

  const { data: stats } = trpc.complaints.getDashboardStats.useQuery()
  const { data: clientsForSelect } = trpc.clients.listForSelect.useQuery()

  const [isSuccess, setIsSuccess] = useState(false)

  const form = useForm<ComplaintFormValues>({
    resolver: zodResolver(complaintSchema) as Resolver<ComplaintFormValues>,
    defaultValues: emptyForm,
    mode: "onChange",
  })

  const createMutation = trpc.complaints.create.useMutation({
    onSuccess: () => {
      toast.success("Complaint registered successfully")
      setIsSuccess(true)
      setTimeout(() => {
        setIsSuccess(false)
        resetForm()
        refetch()
      }, 2000)
    },
    onError: (err) => toast.error(err.message),
  })

  const resetForm = () => {
    setShowCreateSheet(false)
    form.reset(emptyForm)
  }

  const onSubmit = (data: ComplaintFormValues) => {
    createMutation.mutate({
      ...data,
      client_id: data.client_id || undefined,
    })
  }

  const handleFormSubmit = form.handleSubmit(onSubmit)

  return (
    <DashboardPageLayout
      heading="Complaints"
      description="Manage client complaints and track resolution progress"
      headerAction={
        <Button onClick={() => setShowCreateSheet(true)} className="gap-2 rounded-xl">
          <Plus className="h-4 w-4" /> New Complaint
        </Button>
      }
    >
      <div className="space-y-6">

      {/* Dashboard Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          <CompactMetricCard label="Open" value={stats.complaints.open} icon={<MessageSquareWarning className="h-5 w-5" />} theme="blue" />
          <CompactMetricCard label="In Progress" value={stats.complaints.in_progress} icon={<Clock className="h-5 w-5" />} theme="amber" />
          <CompactMetricCard label="Resolved" value={stats.complaints.resolved} icon={<TicketCheck className="h-5 w-5" />} theme="emerald" />
          <CompactMetricCard label="Calls Done" value={stats.callLogs.done} icon={<PhoneCall className="h-5 w-5" />} theme="green" />
          <CompactMetricCard label="Calls Pending" value={stats.callLogs.pending} icon={<Phone className="h-5 w-5" />} theme="orange" />
          <CompactMetricCard label="Calls Cancelled" value={stats.callLogs.cancelled} icon={<PhoneOff className="h-5 w-5" />} theme="rose" />
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search complaints..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 rounded-xl"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px] rounded-xl"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-[140px] rounded-xl"><SelectValue placeholder="Priority" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priority</SelectItem>
            <SelectItem value="low">Low</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
          </SelectContent>
        </Select>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[140px] rounded-xl"><SelectValue placeholder="Category" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Category</SelectItem>
            <SelectItem value="billing">Billing</SelectItem>
            <SelectItem value="technical">Technical</SelectItem>
            <SelectItem value="service">Service</SelectItem>
            <SelectItem value="product">Product</SelectItem>
            <SelectItem value="general">General</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Complaints List */}
      <div className="space-y-3">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-24 bg-muted/30 rounded-2xl animate-pulse" />
          ))
        ) : complaintsData?.data.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <MessageSquareWarning className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p className="font-medium">No complaints found</p>
            <p className="text-sm">Create a new complaint to get started</p>
          </div>
        ) : (
          complaintsData?.data.map((complaint: any, idx: number) => (
            <motion.div
              key={complaint.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.03 }}
            >
              <div 
                onClick={() => setSelectedComplaintId(complaint.id)}
                className="group p-4 rounded-2xl border border-border/50 bg-card/50 hover:bg-accent/30 hover:border-primary/20 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 cursor-pointer"
              >
                <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">
                          {complaint.complaint_number}
                        </span>
                        <CategoryBadge category={complaint.category} />
                      </div>
                      <h4 className="font-bold text-sm truncate group-hover:text-primary transition-colors">
                        {complaint.subject}
                      </h4>
                      {complaint.client && (
                        <div className="flex items-center gap-1.5 mt-1">
                          <Building2 className="h-3 w-3 text-muted-foreground/60" />
                          <span className="text-xs text-muted-foreground">{complaint.client.company_name}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <div className="flex items-center gap-2">
                        <PriorityBadge priority={complaint.priority} />
                        <TicketStatusBadge status={complaint.status} />
                      </div>
                      <div className="flex items-center gap-3 text-[10px] text-muted-foreground/60">
                        {complaint.tickets?.length > 0 && (
                          <span className="flex items-center gap-1">
                            <TicketCheck className="h-3 w-3" />
                            {complaint.tickets.length} ticket{complaint.tickets.length > 1 ? 's' : ''}
                          </span>
                        )}
                        <span>{complaint.created_at ? format(new Date(complaint.created_at), 'dd MMM yyyy') : ''}</span>
                      </div>
                    </div>
                  </div>
                </div>
            </motion.div>
          ))
        )}
      </div>

      {/* Create Complaint Sheet */}
      <Sheet open={showCreateSheet} onOpenChange={(open) => { if (!open) resetForm() }}>
        <SheetContent className="w-full sm:max-w-2xl flex flex-col">
          <div className="flex-shrink-0 px-4 sm:px-6 border-b border-border/80 pb-3">
            <SheetHeader className="text-left pb-0">
              <SheetTitle className="flex items-center gap-3 text-xl font-bold py-1">
                <div className={cn(
                  "p-2 rounded-lg bg-blue-100"
                )}>
                  <MessageSquareWarning className="h-6 w-6 text-blue-600" />
                </div>
                <div className="flex flex-col">
                  <span className="leading-tight text-blue-700">Register New Complaint</span>
                  <span className="text-xs font-medium text-muted-foreground mt-0 leading-tight">
                    Create a complaint and assign tickets later
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
                    <Accordion type="multiple" defaultValue={["primary-details"]} className="bg-white/80 backdrop-blur-sm rounded-lg border">
                      {/* Primary Information */}
                      <AccordionItem value="primary-details" className="border-b-0">
                        <AccordionTrigger className="px-4 py-3 rounded-t-lg hover:no-underline transition-colors bg-blue-50 hover:bg-blue-100">
                          <div className="flex items-center gap-3">
                            <FileText className="h-5 w-5 text-blue-600" />
                            <span className="font-medium text-blue-900">Primary Information</span>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="px-4 pb-4 pt-4 space-y-4 bg-white/80">
                          <Controller
                            name="client_id"
                            control={form.control}
                            render={({ field, fieldState }) => (
                              <Field data-invalid={fieldState.invalid}>
                                <FieldLabel htmlFor="client_id">Client</FieldLabel>
                                <Select value={field.value} onValueChange={field.onChange}>
                                  <SelectTrigger className={cn("rounded-xl", fieldState.invalid && "border-destructive")}>
                                    <SelectValue placeholder="Select client..." />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {clientsForSelect?.map((c: any) => (
                                      <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                {fieldState.invalid && fieldState.error && <FieldError errors={[fieldState.error]} className="mt-1" />}
                              </Field>
                            )}
                          />
                          <Controller
                            name="subject"
                            control={form.control}
                            render={({ field, fieldState }) => (
                              <Field data-invalid={fieldState.invalid}>
                                <FieldLabel htmlFor="subject">Subject *</FieldLabel>
                                <Input id="subject" className={cn("rounded-xl", fieldState.invalid && "border-destructive")} {...field} value={field.value || ""} placeholder="Brief complaint subject" />
                                {fieldState.invalid && fieldState.error && <FieldError errors={[fieldState.error]} className="mt-1" />}
                              </Field>
                            )}
                          />
                          <Controller
                            name="description"
                            control={form.control}
                            render={({ field, fieldState }) => (
                              <Field data-invalid={fieldState.invalid}>
                                <FieldLabel htmlFor="description">Description</FieldLabel>
                                <Textarea id="description" className={cn("rounded-xl min-h-[100px]", fieldState.invalid && "border-destructive")} {...field} value={field.value || ""} placeholder="Detailed complaint description..." />
                                {fieldState.invalid && fieldState.error && <FieldError errors={[fieldState.error]} className="mt-1" />}
                              </Field>
                            )}
                          />
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>
                      
                    <Accordion type="multiple" defaultValue={["classification-details"]} className="bg-white/80 backdrop-blur-sm rounded-lg border">
                      {/* Classification Details */}
                      <AccordionItem value="classification-details" className="border-b-0">
                        <AccordionTrigger className="px-4 py-3 rounded-t-lg hover:no-underline transition-colors bg-blue-50 hover:bg-blue-100">
                          <div className="flex items-center gap-3">
                            <Filter className="h-5 w-5 text-blue-600" />
                            <span className="font-medium text-blue-900">Classification Information</span>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="px-4 pb-4 pt-4 space-y-4 bg-white/80">
                          <div className="grid grid-cols-2 gap-4">
                            <Controller
                              name="category"
                              control={form.control}
                              render={({ field, fieldState }) => (
                                <Field data-invalid={fieldState.invalid}>
                                  <FieldLabel htmlFor="category">Category</FieldLabel>
                                  <Select value={field.value} onValueChange={field.onChange}>
                                    <SelectTrigger className={cn("rounded-xl", fieldState.invalid && "border-destructive")}>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="billing">Billing</SelectItem>
                                      <SelectItem value="technical">Technical</SelectItem>
                                      <SelectItem value="service">Service</SelectItem>
                                      <SelectItem value="product">Product</SelectItem>
                                      <SelectItem value="general">General</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </Field>
                              )}
                            />
                            <Controller
                              name="priority"
                              control={form.control}
                              render={({ field, fieldState }) => (
                                <Field data-invalid={fieldState.invalid}>
                                  <FieldLabel htmlFor="priority">Priority</FieldLabel>
                                  <Select value={field.value} onValueChange={field.onChange}>
                                    <SelectTrigger className={cn("rounded-xl", fieldState.invalid && "border-destructive")}>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="low">Low</SelectItem>
                                      <SelectItem value="medium">Medium</SelectItem>
                                      <SelectItem value="high">High</SelectItem>
                                      <SelectItem value="critical">Critical</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </Field>
                              )}
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <Controller
                              name="source"
                              control={form.control}
                              render={({ field, fieldState }) => (
                                <Field data-invalid={fieldState.invalid}>
                                  <FieldLabel htmlFor="source">Source</FieldLabel>
                                  <Select value={field.value} onValueChange={field.onChange}>
                                    <SelectTrigger className={cn("rounded-xl", fieldState.invalid && "border-destructive")}>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="email">Email</SelectItem>
                                      <SelectItem value="phone">Phone</SelectItem>
                                      <SelectItem value="walk-in">Walk-in</SelectItem>
                                      <SelectItem value="whatsapp">WhatsApp</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </Field>
                              )}
                            />
                            <Controller
                              name="sla_hours"
                              control={form.control}
                              render={({ field, fieldState }) => (
                                <Field data-invalid={fieldState.invalid}>
                                  <FieldLabel htmlFor="sla_hours">SLA (Hours)</FieldLabel>
                                  <Input type="number" id="sla_hours" className={cn("rounded-xl", fieldState.invalid && "border-destructive")} {...field} onChange={e => field.onChange(parseInt(e.target.value) || 0)} />
                                  {fieldState.invalid && fieldState.error && <FieldError errors={[fieldState.error]} className="mt-1" />}
                                </Field>
                              )}
                            />
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>
                    <div className="flex gap-4 pt-2 mt-8">
                      <CancelButton
                        onClick={resetForm}
                        disabled={createMutation.isPending}
                        size="lg"
                        className="flex-1"
                      >
                        Cancel
                      </CancelButton>
                      <CreateUserButton
                        disabled={form.formState.isSubmitting || createMutation.isPending}
                        size="lg"
                        className="flex-1"
                        asyncState={
                          createMutation.isPending ? 'loading' : 
                          isSuccess ? 'success' : 
                          createMutation.isError ? 'error' : 
                          'idle'
                        }
                        mode="create"
                      >
                        Register Complaint
                      </CreateUserButton>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Complaint Detail Sheet */}
      <ComplaintDetailSheet 
        complaintId={selectedComplaintId} 
        onOpenChange={(open) => !open && setSelectedComplaintId(null)}
        basePath={basePath}
      />

      </div>
    </DashboardPageLayout>
  )
}
