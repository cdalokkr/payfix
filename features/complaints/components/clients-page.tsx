"use client"

import { useState } from "react"
import { trpc } from "@/lib/trpc/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { PageHeading } from "@/components/ui/page-heading"
import { toast } from "sonner"
import {
  Building2, Plus, Search, Phone, Mail, MapPin, Globe, FileText
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
import { Loader2, Edit } from "lucide-react"

const emptyForm = {
  company_name: "", contact_person: "", email: "", phone: "", alt_phone: "",
  gst_number: "", pan_number: "", website: "", industry: "",
  address_line1: "", address_line2: "", city: "", state: "", pincode: "", country: "India",
  notes: "",
}

export default function ClientsPage() {
  const [search, setSearch] = useState("")
  const [showCreateSheet, setShowCreateSheet] = useState(false)
  const [editingClient, setEditingClient] = useState<any>(null)
  const [formData, setFormData] = useState(emptyForm)

  const { data: clientsData, isLoading, refetch } = trpc.clients.list.useQuery({
    search: search || undefined,
    status: 'active',
  })

  const createMutation = trpc.clients.create.useMutation({
    onSuccess: () => {
      toast.success("Client added successfully")
      resetForm()
      refetch()
    },
    onError: (err) => toast.error(err.message),
  })

  const updateMutation = trpc.clients.update.useMutation({
    onSuccess: () => {
      toast.success("Client updated successfully")
      resetForm()
      refetch()
    },
    onError: (err) => toast.error(err.message),
  })

  const resetForm = () => {
    setShowCreateSheet(false)
    setEditingClient(null)
    setFormData(emptyForm)
  }

  const openEdit = (client: any) => {
    setEditingClient(client)
    setFormData({
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
  }

  const handleSubmit = () => {
    if (editingClient) {
      updateMutation.mutate({ id: editingClient.id, ...formData })
    } else {
      createMutation.mutate(formData)
    }
  }

  const set = (key: string, value: string) => setFormData(d => ({ ...d, [key]: value }))

  return (
    <DashboardPageLayout 
      heading="Clients" 
      description="Manage your client directory"
      headerAction={
        <Button onClick={() => { resetForm(); setShowCreateSheet(true) }} className="gap-2 rounded-xl">
          <Plus className="h-4 w-4" /> Add Client
        </Button>
      }
    >
      <div className="space-y-6">

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search clients..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10 rounded-xl" />
      </div>

      {/* Clients Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-44 bg-muted/30 rounded-2xl animate-pulse" />
          ))
        ) : clientsData?.data.length === 0 ? (
          <div className="col-span-full text-center py-16 text-muted-foreground">
            <Building2 className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p className="font-medium">No clients found</p>
            <p className="text-sm">Add your first client to get started</p>
          </div>
        ) : (
          clientsData?.data.map((client: any, idx: number) => (
            <motion.div
              key={client.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.03 }}
              onClick={() => openEdit(client)}
              className="group p-5 rounded-2xl border border-border/50 bg-card/50 hover:bg-accent/30 hover:border-primary/20 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 cursor-pointer"
            >
              <div className="flex items-start gap-3 mb-3">
                <div className="p-2.5 rounded-xl bg-primary/10 text-primary shrink-0">
                  <Building2 className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="font-bold text-sm truncate group-hover:text-primary transition-colors">{client.company_name}</h4>
                  {client.contact_person && (
                    <p className="text-xs text-muted-foreground truncate">{client.contact_person}</p>
                  )}
                </div>
              </div>
              <div className="space-y-1.5">
                {client.phone && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Phone className="h-3 w-3" /> {client.phone}
                  </div>
                )}
                {client.email && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground truncate">
                    <Mail className="h-3 w-3" /> {client.email}
                  </div>
                )}
                {(client.city || client.state) && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3" /> {[client.city, client.state].filter(Boolean).join(', ')}
                  </div>
                )}
                {client.industry && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Globe className="h-3 w-3" /> {client.industry}
                  </div>
                )}
              </div>
              {client.gst_number && (
                <div className="mt-3 pt-3 border-t border-border/30">
                  <span className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">GST: {client.gst_number}</span>
                </div>
              )}
            </motion.div>
          ))
        )}
      </div>

      {/* Create/Edit Client Sheet */}
      <Sheet open={showCreateSheet} onOpenChange={(open) => { if (!open) resetForm() }}>
        <SheetContent className="w-full sm:max-w-2xl flex flex-col p-0">
          <div className="flex-shrink-0 px-4 sm:px-6 pt-6 border-b border-border/80 pb-3">
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
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 mt-0">
            <Accordion type="multiple" defaultValue={["company-details", "contact-details", "location-details"]} className="space-y-4">
              {/* Company Details */}
              <AccordionItem value="company-details" className="border border-border/60 rounded-lg overflow-hidden bg-white shadow-sm">
                <AccordionTrigger className={cn(
                  "px-4 py-3 hover:no-underline transition-colors",
                  editingClient ? "bg-purple-50 hover:bg-purple-100/80" : "bg-blue-50 hover:bg-blue-100/80"
                )}>
                  <div className="flex items-center gap-3">
                    <Building2 className={cn("h-5 w-5", editingClient ? "text-purple-600" : "text-blue-600")} />
                    <span className={cn("font-medium", editingClient ? "text-purple-900" : "text-blue-900")}>Company Details</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4 pt-4 space-y-4 bg-white/80">
                  <div className="space-y-2">
                    <Label>Company Name *</Label>
                    <Input value={formData.company_name} onChange={(e) => set('company_name', e.target.value)} className="rounded-xl" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Industry</Label>
                      <Input value={formData.industry} onChange={(e) => set('industry', e.target.value)} className="rounded-xl" placeholder="e.g. IT, Manufacturing" />
                    </div>
                    <div className="space-y-2">
                      <Label>Website</Label>
                      <Input value={formData.website} onChange={(e) => set('website', e.target.value)} className="rounded-xl" placeholder="https://" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>GST Number</Label>
                      <Input value={formData.gst_number} onChange={(e) => set('gst_number', e.target.value)} className="rounded-xl" />
                    </div>
                    <div className="space-y-2">
                      <Label>PAN Number</Label>
                      <Input value={formData.pan_number} onChange={(e) => set('pan_number', e.target.value)} className="rounded-xl" />
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Contact Details */}
              <AccordionItem value="contact-details" className="border border-border/60 rounded-lg overflow-hidden bg-white shadow-sm">
                <AccordionTrigger className={cn(
                  "px-4 py-3 hover:no-underline transition-colors",
                  editingClient ? "bg-purple-50 hover:bg-purple-100/80" : "bg-blue-50 hover:bg-blue-100/80"
                )}>
                  <div className="flex items-center gap-3">
                    <Mail className={cn("h-5 w-5", editingClient ? "text-purple-600" : "text-blue-600")} />
                    <span className={cn("font-medium", editingClient ? "text-purple-900" : "text-blue-900")}>Contact Information</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4 pt-4 space-y-4 bg-white/80">
                  <div className="space-y-2">
                    <Label>Contact Person</Label>
                    <Input value={formData.contact_person} onChange={(e) => set('contact_person', e.target.value)} className="rounded-xl" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Phone</Label>
                      <Input value={formData.phone} onChange={(e) => set('phone', e.target.value)} className="rounded-xl" />
                    </div>
                    <div className="space-y-2">
                      <Label>Alt Phone</Label>
                      <Input value={formData.alt_phone} onChange={(e) => set('alt_phone', e.target.value)} className="rounded-xl" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Email Address</Label>
                    <Input value={formData.email} onChange={(e) => set('email', e.target.value)} className="rounded-xl" type="email" />
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Location Details */}
              <AccordionItem value="location-details" className="border border-border/60 rounded-lg overflow-hidden bg-white shadow-sm">
                <AccordionTrigger className={cn(
                  "px-4 py-3 hover:no-underline transition-colors",
                  editingClient ? "bg-purple-50 hover:bg-purple-100/80" : "bg-blue-50 hover:bg-blue-100/80"
                )}>
                  <div className="flex items-center gap-3">
                    <MapPin className={cn("h-5 w-5", editingClient ? "text-purple-600" : "text-blue-600")} />
                    <span className={cn("font-medium", editingClient ? "text-purple-900" : "text-blue-900")}>Location Details</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4 pt-4 space-y-4 bg-white/80">
                  <div className="space-y-2">
                    <Label>Address Line 1</Label>
                    <Input value={formData.address_line1} onChange={(e) => set('address_line1', e.target.value)} className="rounded-xl" />
                  </div>
                  <div className="space-y-2">
                    <Label>Address Line 2</Label>
                    <Input value={formData.address_line2} onChange={(e) => set('address_line2', e.target.value)} className="rounded-xl" />
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>City</Label>
                      <Input value={formData.city} onChange={(e) => set('city', e.target.value)} className="rounded-xl" />
                    </div>
                    <div className="space-y-2">
                      <Label>State</Label>
                      <Input value={formData.state} onChange={(e) => set('state', e.target.value)} className="rounded-xl" />
                    </div>
                    <div className="space-y-2">
                      <Label>Pincode</Label>
                      <Input value={formData.pincode} onChange={(e) => set('pincode', e.target.value)} className="rounded-xl" />
                    </div>
                  </div>
                  <div className="space-y-2 border-t border-border/50 pt-4 mt-2">
                    <Label>Notes</Label>
                    <Textarea value={formData.notes} onChange={(e) => set('notes', e.target.value)} className="rounded-xl" />
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
            <div className="pt-4 border-t border-border/50">
              <Button
                onClick={handleSubmit}
                disabled={!formData.company_name || createMutation.isPending || updateMutation.isPending}
                className="w-full rounded-xl transition-all duration-200"
              >
                {createMutation.isPending || updateMutation.isPending ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Saving...</span>
                  </div>
                ) : editingClient ? "Update Client" : "Add Client"}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
      </div>
    </DashboardPageLayout>
  )
}
