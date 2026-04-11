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
  Phone, PhoneCall, PhoneOff, TicketCheck, Clock, FileText, Info
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

export default function ComplaintsPage({ basePath = "/admin" }: { basePath?: string }) {
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("")
  const [priorityFilter, setPriorityFilter] = useState<string>("")
  const [categoryFilter, setCategoryFilter] = useState<string>("")
  const [showCreateSheet, setShowCreateSheet] = useState(false)

  const { data: complaintsData, isLoading, refetch } = trpc.complaints.list.useQuery({
    search: search || undefined,
    status: (statusFilter || undefined) as any,
    priority: (priorityFilter || undefined) as any,
    category: (categoryFilter || undefined) as any,
  })

  const { data: stats } = trpc.complaints.getDashboardStats.useQuery()
  const { data: clientsForSelect } = trpc.clients.listForSelect.useQuery()

  // Create complaint form state
  const [formData, setFormData] = useState({
    client_id: "",
    subject: "",
    description: "",
    category: "general" as const,
    priority: "medium" as const,
    source: "email",
    sla_hours: 48,
  })

  const createMutation = trpc.complaints.create.useMutation({
    onSuccess: () => {
      toast.success("Complaint registered successfully")
      setShowCreateSheet(false)
      setFormData({ client_id: "", subject: "", description: "", category: "general", priority: "medium", source: "email", sla_hours: 48 })
      refetch()
    },
    onError: (err) => toast.error(err.message),
  })

  const handleCreate = () => {
    createMutation.mutate({
      ...formData,
      client_id: formData.client_id || undefined,
    })
  }

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
              <Link href={`${basePath}/complaints/${complaint.id}`}>
                <div className="group p-4 rounded-2xl border border-border/50 bg-card/50 hover:bg-accent/30 hover:border-primary/20 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 cursor-pointer">
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
              </Link>
            </motion.div>
          ))
        )}
      </div>

      {/* Create Complaint Sheet */}
      <Sheet open={showCreateSheet} onOpenChange={setShowCreateSheet}>
        <SheetContent className="w-full sm:max-w-2xl flex flex-col p-0">
          <div className="flex-shrink-0 px-4 sm:px-6 pt-6 border-b border-border/80 pb-3">
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
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 mt-0">
            <Accordion type="multiple" defaultValue={["primary-details", "classification-details"]} className="space-y-4">
              {/* Primary Information */}
              <AccordionItem value="primary-details" className="border border-border/60 rounded-lg overflow-hidden bg-white shadow-sm">
                <AccordionTrigger className="px-4 py-3 hover:no-underline transition-colors bg-blue-50 hover:bg-blue-100/80">
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-blue-600" />
                    <span className="font-medium text-blue-900">Primary Information</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4 pt-4 space-y-4 bg-white/80">
                  <div className="space-y-2">
                    <Label>Client</Label>
                    <Select value={formData.client_id} onValueChange={(v) => setFormData(d => ({ ...d, client_id: v }))}>
                      <SelectTrigger className="rounded-xl"><SelectValue placeholder="Select client..." /></SelectTrigger>
                      <SelectContent>
                        {clientsForSelect?.map((c: any) => (
                          <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Subject *</Label>
                    <Input value={formData.subject} onChange={(e) => setFormData(d => ({ ...d, subject: e.target.value }))} className="rounded-xl" placeholder="Brief complaint subject" />
                  </div>
                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Textarea value={formData.description} onChange={(e) => setFormData(d => ({ ...d, description: e.target.value }))} className="rounded-xl min-h-[100px]" placeholder="Detailed complaint description..." />
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Classification Details */}
              <AccordionItem value="classification-details" className="border border-border/60 rounded-lg overflow-hidden bg-white shadow-sm">
                <AccordionTrigger className="px-4 py-3 hover:no-underline transition-colors bg-blue-50 hover:bg-blue-100/80">
                  <div className="flex items-center gap-3">
                    <Filter className="h-5 w-5 text-blue-600" />
                    <span className="font-medium text-blue-900">Classification Information</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4 pt-4 space-y-4 bg-white/80">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Category</Label>
                      <Select value={formData.category} onValueChange={(v: any) => setFormData(d => ({ ...d, category: v }))}>
                        <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="billing">Billing</SelectItem>
                          <SelectItem value="technical">Technical</SelectItem>
                          <SelectItem value="service">Service</SelectItem>
                          <SelectItem value="product">Product</SelectItem>
                          <SelectItem value="general">General</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Priority</Label>
                      <Select value={formData.priority} onValueChange={(v: any) => setFormData(d => ({ ...d, priority: v }))}>
                        <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="critical">Critical</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Source</Label>
                      <Select value={formData.source} onValueChange={(v) => setFormData(d => ({ ...d, source: v }))}>
                        <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="email">Email</SelectItem>
                          <SelectItem value="phone">Phone</SelectItem>
                          <SelectItem value="walk-in">Walk-in</SelectItem>
                          <SelectItem value="whatsapp">WhatsApp</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>SLA (Hours)</Label>
                      <Input type="number" value={formData.sla_hours} onChange={(e) => setFormData(d => ({ ...d, sla_hours: parseInt(e.target.value) || 48 }))} className="rounded-xl" />
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
            <div className="pt-4 border-t border-border/50">
              <Button onClick={handleCreate} disabled={!formData.subject || createMutation.isPending} className="w-full rounded-xl transition-all duration-200">
                {createMutation.isPending ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Creating...</span>
                  </div>
                ) : "Register Complaint"}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
      </div>
    </DashboardPageLayout>
  )
}
