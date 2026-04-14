"use client"

import { useState, useEffect } from "react"
import { trpc } from "@/lib/trpc/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { TicketStatusBadge, PriorityBadge, CategoryBadge, CallLogStatusBadge } from "@/features/complaints/components/status-badges"
import { format } from "date-fns"
import { toast } from "sonner"
import {
  Building2, Plus, Phone, Clock, TicketCheck, MessageSquareWarning,
  User2, Loader2, ArrowRight
} from "lucide-react"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion"
import { CancelButton } from "@/components/ui/action-button"
import CreateUserButton from "@/components/ui/create-user-button"
import { Card, CardContent } from "@/components/ui/card"

interface Props {
  complaintId: string | null
  onOpenChange: (open: boolean) => void
  basePath: string
}

export function ComplaintDetailSheet({ complaintId, onOpenChange, basePath }: Props) {
  const [showTicketSheet, setShowTicketSheet] = useState(false)
  const [showCallLogSheet, setShowCallLogSheet] = useState(false)

  const { data: complaint, isLoading, refetch } = trpc.complaints.getById.useQuery(
    { id: complaintId as string },
    { enabled: !!complaintId }
  )
  const { data: teamMembers } = trpc.tickets.getTeamMembers.useQuery(undefined, { enabled: !!complaintId })

  // Ticket form state
  const [ticketForm, setTicketForm] = useState({
    title: "", description: "", priority: "medium" as const, due_date: "",
    estimated_hours: "", assigned_to: [] as { profile_id: string; role: string; is_primary: boolean }[],
  })

  // Call log form state
  const [callForm, setCallForm] = useState({
    contact_name: "", contact_phone: "", call_type: "outbound" as const,
    duration_minutes: "", notes: "", remarks: "", status: "done" as const,
    next_follow_up: "",
  })

  const createTicketMutation = trpc.tickets.create.useMutation({
    onSuccess: () => {
      toast.success("Ticket created and assigned")
      setShowTicketSheet(false)
      setTicketForm({ title: "", description: "", priority: "medium", due_date: "", estimated_hours: "", assigned_to: [] })
      refetch()
    },
    onError: (err) => toast.error(err.message),
  })

  const addCallLogMutation = trpc.tickets.addCallLog.useMutation({
    onSuccess: () => {
      toast.success("Call log added")
      setShowCallLogSheet(false)
      setCallForm({ contact_name: "", contact_phone: "", call_type: "outbound", duration_minutes: "", notes: "", remarks: "", status: "done", next_follow_up: "" })
      refetch()
    },
    onError: (err) => toast.error(err.message),
  })

  const updateStatusMutation = trpc.complaints.update.useMutation({
    onSuccess: () => { toast.success("Status updated"); refetch() },
    onError: (err) => toast.error(err.message),
  })

  const toggleMember = (profileId: string) => {
    setTicketForm(prev => {
      const exists = prev.assigned_to.find(a => a.profile_id === profileId)
      if (exists) {
        return { ...prev, assigned_to: prev.assigned_to.filter(a => a.profile_id !== profileId) }
      }
      return { ...prev, assigned_to: [...prev.assigned_to, { profile_id: profileId, role: 'assignee', is_primary: prev.assigned_to.length === 0 }] }
    })
  }

  const handleCreateTicket = (e: React.FormEvent) => {
    e.preventDefault()
    if (ticketForm.assigned_to.length === 0) {
      toast.error("Select at least one team member")
      return
    }
    createTicketMutation.mutate({
      complaint_id: complaintId!,
      title: ticketForm.title,
      description: ticketForm.description,
      priority: ticketForm.priority,
      due_date: ticketForm.due_date || undefined,
      estimated_hours: ticketForm.estimated_hours ? parseFloat(ticketForm.estimated_hours) : undefined,
      assigned_to: ticketForm.assigned_to.map(a => ({
        profile_id: a.profile_id,
        role: a.role as any,
        is_primary: a.is_primary,
      })),
    })
  }

  const handleAddCallLog = (e: React.FormEvent) => {
    e.preventDefault()
    addCallLogMutation.mutate({
      complaint_id: complaintId!,
      client_id: complaint?.client_id || undefined,
      contact_name: callForm.contact_name || undefined,
      contact_phone: callForm.contact_phone || undefined,
      call_type: callForm.call_type,
      duration_minutes: callForm.duration_minutes ? parseInt(callForm.duration_minutes) : undefined,
      notes: callForm.notes || undefined,
      remarks: callForm.remarks || undefined,
      status: callForm.status,
      next_follow_up: callForm.next_follow_up || undefined,
    })
  }

  // Effect to close nested sheets if main sheet closes
  useEffect(() => {
    if (!complaintId) {
      setShowTicketSheet(false)
      setShowCallLogSheet(false)
    }
  }, [complaintId])

  return (
    <>
      <Sheet open={!!complaintId} onOpenChange={onOpenChange}>
        <SheetContent aria-describedby={undefined} className="w-full sm:max-w-3xl flex flex-col p-0">
          <SheetTitle className="sr-only">Complaint Detail</SheetTitle>
          {isLoading ? (
             <div className="flex flex-1 items-center justify-center p-8">
               <Loader2 className="h-8 w-8 animate-spin text-primary" />
             </div>
          ) : !complaint ? (
             <div className="flex flex-1 items-center justify-center p-8">
                <span className="text-muted-foreground">Complaint not found</span>
             </div>
          ) : (
            <>
              {/* Main Sheet Header */}
              <div className="flex-shrink-0 px-4 sm:px-6 pt-6 border-b border-border/80 pb-3 bg-slate-50/50">
                <SheetHeader className="text-left pb-0">
                  <SheetTitle className="flex items-start gap-4 text-xl font-bold py-1">
                    <div className={cn("p-2.5 rounded-xl bg-blue-100 flex-shrink-0")}>
                      <MessageSquareWarning className="h-7 w-7 text-blue-600" />
                    </div>
                    <div className="flex flex-col flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <span className="text-[10px] font-bold text-muted-foreground/80 uppercase tracking-widest">{complaint.complaint_number}</span>
                        <CategoryBadge category={complaint.category} />
                        <PriorityBadge priority={complaint.priority} />
                        <TicketStatusBadge status={complaint.status} />
                      </div>
                      <span className="leading-tight text-slate-800 text-lg truncate whitespace-normal break-words">{complaint.subject}</span>
                    </div>
                  </SheetTitle>
                </SheetHeader>
              </div>

              {/* Main Sheet Body */}
              <div className="flex-1 overflow-y-auto mt-0 bg-slate-50/30">
                <div className="px-4 sm:px-6 lg:px-6 pb-6 pt-4 space-y-6">
                  
                  {/* Status update and quick stats */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-white border rounded-xl shadow-sm">
                    <div className="flex items-center gap-4 text-sm text-slate-600 flex-wrap">
                      <div className="flex items-center gap-1.5 font-medium"><Building2 className="h-4 w-4 text-indigo-500" /> {complaint.client?.company_name || 'N/A'}</div>
                      <div className="hidden sm:block text-border">•</div>
                      <div className="flex items-center gap-1.5"><Clock className="h-4 w-4" /> SLA: {complaint.sla_hours}h</div>
                      <div className="hidden sm:block text-border">•</div>
                      <div>Created {format(new Date(complaint.created_at!), 'dd MMM')}</div>
                    </div>
                    <div className="flex items-center gap-2">
                       <Select value={complaint.status || 'open'} onValueChange={(v: any) => updateStatusMutation.mutate({ id: complaint.id, status: v })}>
                        <SelectTrigger className="w-[140px] rounded-lg h-9 bg-slate-50"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="open">Open</SelectItem>
                          <SelectItem value="in_progress">In Progress</SelectItem>
                          <SelectItem value="resolved">Resolved</SelectItem>
                          <SelectItem value="closed">Closed</SelectItem>
                          <SelectItem value="cancelled">Cancelled</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {complaint.description && (
                    <div className="bg-white p-5 rounded-xl border shadow-sm">
                      <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">Description</h3>
                      <p className="text-sm whitespace-pre-wrap text-slate-700 leading-relaxed">{complaint.description}</p>
                    </div>
                  )}

                  {/* Tickets and Call Logs Sections */}
                  <Accordion type="multiple" defaultValue={["tickets", "call-logs"]} className="space-y-4">
                    
                    {/* Tickets Accordion */}
                    <AccordionItem value="tickets" className="border rounded-xl bg-white shadow-sm overflow-hidden border-b-0">
                      <AccordionTrigger className="px-5 py-3 hover:no-underline transition-colors bg-slate-50/80 hover:bg-slate-100 rounded-t-xl group">
                        <div className="flex items-center justify-between w-full pr-2">
                          <div className="flex items-center gap-3">
                            <div className="p-1.5 rounded-md bg-blue-100"><TicketCheck className="h-4 w-4 text-blue-600" /></div>
                            <span className="font-semibold text-slate-800 text-sm">Tickets ({complaint.tickets?.length || 0})</span>
                          </div>
                          <div 
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowTicketSheet(true); }} 
                            className="inline-flex items-center justify-center whitespace-nowrap font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground shadow hover:bg-primary/90 h-7 px-3 text-xs gap-1.5 rounded-lg ml-auto opacity-0 group-hover:opacity-100"
                          >
                            <Plus className="h-3 w-3" /> New
                          </div>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="px-5 pb-5 pt-4 space-y-3 bg-white">
                        {complaint.tickets?.length === 0 ? (
                          <div className="text-center py-6 border-2 border-dashed rounded-xl">
                            <p className="text-sm text-muted-foreground">No tickets created</p>
                            <Button variant="link" onClick={() => setShowTicketSheet(true)} className="h-auto p-0 mt-1">Create one now</Button>
                          </div>
                        ) : (
                          complaint.tickets?.map((ticket: any) => (
                            <Link key={ticket.id} href={`${basePath}/tickets/${ticket.id}`} className="block">
                              <div className="p-3 rounded-xl border border-slate-100 hover:border-blue-200 hover:bg-blue-50/50 transition-colors group cursor-pointer">
                                <div className="flex justify-between items-start gap-4">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1.5">
                                      <span className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">{ticket.ticket_number}</span>
                                      <TicketStatusBadge status={ticket.status} />
                                      <PriorityBadge priority={ticket.priority} />
                                    </div>
                                    <h4 className="text-sm font-semibold text-slate-800 group-hover:text-blue-700 transition-colors">{ticket.title}</h4>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <div className="flex -space-x-2">
                                      {ticket.assignments?.slice(0,3).map((a: any) => (
                                        <Avatar key={a.id} className="h-7 w-7 border-2 border-white shadow-sm">
                                          <AvatarImage src={a.assignee?.avatar_url} />
                                          <AvatarFallback className="text-[9px] font-bold bg-blue-100 text-blue-700">{a.assignee?.full_name?.charAt(0) || '?'}</AvatarFallback>
                                        </Avatar>
                                      ))}
                                      {ticket.assignments?.length > 3 && (
                                         <div className="h-7 w-7 border-2 border-white rounded-full bg-slate-100 flex items-center justify-center text-[9px] font-bold text-slate-600 shadow-sm">
                                          +{ticket.assignments.length - 3}
                                         </div>
                                      )}
                                    </div>
                                    <ArrowRight className="h-4 w-4 text-slate-300 group-hover:text-blue-500 transition-colors" />
                                  </div>
                                </div>
                              </div>
                            </Link>
                          ))
                        )}
                      </AccordionContent>
                    </AccordionItem>

                    {/* Call Logs Accordion */}
                    <AccordionItem value="call-logs" className="border rounded-xl bg-white shadow-sm overflow-hidden border-b-0">
                      <AccordionTrigger className="px-5 py-3 hover:no-underline transition-colors bg-slate-50/80 hover:bg-slate-100 rounded-t-xl group">
                        <div className="flex items-center justify-between w-full pr-2">
                          <div className="flex items-center gap-3">
                            <div className="p-1.5 rounded-md bg-emerald-100"><Phone className="h-4 w-4 text-emerald-600" /></div>
                            <span className="font-semibold text-slate-800 text-sm">Call Logs ({complaint.callLogs?.length || 0})</span>
                          </div>
                          <div 
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowCallLogSheet(true); }} 
                            className="inline-flex items-center justify-center whitespace-nowrap font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground h-7 px-3 text-xs gap-1.5 rounded-lg ml-auto opacity-0 group-hover:opacity-100"
                          >
                            <Plus className="h-3 w-3" /> Log Call
                          </div>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="px-5 pb-5 pt-4 space-y-3 bg-white">
                        {complaint.callLogs?.length === 0 ? (
                           <div className="text-center py-6 border-2 border-dashed rounded-xl">
                             <p className="text-sm text-muted-foreground">No calls logged yet</p>
                           </div>
                        ) : (
                          <div className="space-y-4 border-l-2 border-slate-100 ml-3 pl-4">
                            {complaint.callLogs?.map((log: any, idx: number) => (
                              <div key={log.id} className="relative">
                                <div className="absolute -left-[23px] top-1.5 w-2.5 h-2.5 rounded-full border-2 border-emerald-500 bg-white" />
                                <div className="bg-slate-50/50 rounded-xl p-3 border border-slate-100 hover:border-emerald-200 transition-colors">
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                      <CallLogStatusBadge status={log.status} />
                                      <span className="text-[10px] font-bold text-muted-foreground/80 uppercase tracking-widest">{log.call_type}</span>
                                    </div>
                                    <span className="text-[10px] text-muted-foreground font-medium">
                                      {format(new Date(log.created_at!), 'dd MMM, hh:mm a')}
                                    </span>
                                  </div>
                                  {log.notes && <p className="text-sm text-slate-700 leading-relaxed mb-1.5">{log.notes}</p>}
                                  {log.contact_name && (
                                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-2 bg-white px-2 py-1 rounded-md inline-flex border">
                                      <User2 className="h-3 w-3" /> {log.contact_name} {log.contact_phone && `• ${log.contact_phone}`}
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Nested Sheet: Create Ticket */}
      <Sheet open={showTicketSheet} onOpenChange={setShowTicketSheet}>
        <SheetContent className="w-full sm:max-w-xl flex flex-col p-0">
          <div className="flex-shrink-0 px-4 sm:px-6 pt-6 border-b border-border/80 pb-3 bg-white">
            <SheetHeader className="text-left pb-0">
              <SheetTitle className="flex items-center gap-3 text-xl font-bold py-1">
                <div className={cn("p-2 rounded-lg bg-blue-100")}>
                  <TicketCheck className="h-6 w-6 text-blue-600" />
                </div>
                <div className="flex flex-col">
                  <span className="leading-tight text-blue-700">Create & Assign Ticket</span>
                  <span className="text-xs font-medium text-muted-foreground mt-0 leading-tight">
                    Generate an actionable ticket from this complaint
                  </span>
                </div>
              </SheetTitle>
            </SheetHeader>
          </div>
          <div className="flex-1 overflow-y-auto bg-slate-50/30">
            <div className="px-4 sm:px-6 lg:px-6 pb-6 pt-6 space-y-6">
              <Card className="w-full bg-white shadow-lg border-2 border-border/60 rounded-xl overflow-hidden">
                <CardContent className="p-5">
                  <form onSubmit={handleCreateTicket} className="space-y-6">
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold uppercase text-slate-500">Title <span className="text-red-500">*</span></Label>
                        <Input value={ticketForm.title} onChange={(e) => setTicketForm(d => ({ ...d, title: e.target.value }))} className="rounded-xl h-11 bg-slate-50" placeholder="Ticket actionable title..." />
                      </div>
                      
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold uppercase text-slate-500">Description</Label>
                        <Textarea value={ticketForm.description} onChange={(e) => setTicketForm(d => ({ ...d, description: e.target.value }))} className="rounded-xl bg-slate-50 min-h-[100px]" placeholder="Detailed instructions..." />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-xs font-semibold uppercase text-slate-500">Priority</Label>
                          <Select value={ticketForm.priority} onValueChange={(v: any) => setTicketForm(d => ({ ...d, priority: v }))}>
                            <SelectTrigger className="rounded-xl h-11 bg-slate-50"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="low">Low</SelectItem>
                              <SelectItem value="medium">Medium</SelectItem>
                              <SelectItem value="high">High</SelectItem>
                              <SelectItem value="critical">Critical</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs font-semibold uppercase text-slate-500">Due Date</Label>
                          <Input type="date" value={ticketForm.due_date} onChange={(e) => setTicketForm(d => ({ ...d, due_date: e.target.value }))} className="rounded-xl h-11 bg-slate-50" />
                        </div>
                      </div>

                      {/* Modern Assignment UI */}
                      <div className="space-y-3 pt-2">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs font-semibold uppercase text-slate-500">Assign Team Members <span className="text-red-500">*</span></Label>
                          <span className="text-[10px] font-medium text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md">{ticketForm.assigned_to.length} Selected</span>
                        </div>
                        <div className="flex flex-wrap gap-2 p-1">
                          {teamMembers?.map((member: any) => {
                            const isSelected = ticketForm.assigned_to.some(a => a.profile_id === member.id);
                            return (
                              <button
                                type="button"
                                key={member.id} 
                                onClick={() => toggleMember(member.id)}
                                className={cn(
                                  "flex flex-1 min-w-[140px] items-center gap-2.5 p-2 px-3 pr-4 rounded-xl border-2 cursor-pointer transition-all focus:outline-none focus-visible:ring-2", 
                                  isSelected 
                                    ? "bg-blue-50/50 border-blue-500 shadow-sm" 
                                    : "bg-white border-transparent shadow-sm hover:border-slate-200"
                                )}
                              >
                                <Avatar className="h-8 w-8 border bg-white">
                                  <AvatarImage src={member.avatar_url} />
                                  <AvatarFallback className="text-[10px] font-bold bg-slate-100 text-slate-600">{member.full_name?.charAt(0) || '?'}</AvatarFallback>
                                </Avatar>
                                <div className="flex flex-col text-left overflow-hidden">
                                  <span className="text-xs font-bold leading-tight text-slate-800 truncate">{member.full_name}</span>
                                  <span className="text-[9px] font-medium text-slate-500 leading-tight mt-0.5 truncate">{member.role?.replace('_', ' ').toUpperCase()}</span>
                                </div>
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-4 pt-4 mt-6 border-t border-slate-100">
                      <CancelButton onClick={() => setShowTicketSheet(false)} disabled={createTicketMutation.isPending} size="lg" className="flex-1">Cancel</CancelButton>
                      <CreateUserButton disabled={!ticketForm.title || ticketForm.assigned_to.length === 0 || createTicketMutation.isPending} size="lg" className="flex-1" asyncState={createTicketMutation.isPending ? 'loading' : 'idle'} mode="create">Create Ticket</CreateUserButton>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Nested Sheet: Add Call Log */}
      <Sheet open={showCallLogSheet} onOpenChange={setShowCallLogSheet}>
        <SheetContent className="w-full sm:max-w-md flex flex-col p-0">
          <div className="flex-shrink-0 px-4 sm:px-6 pt-6 border-b border-border/80 pb-3 bg-white">
            <SheetHeader className="text-left pb-0">
              <SheetTitle className="flex items-center gap-3 text-xl font-bold py-1">
                <div className={cn("p-2 rounded-lg bg-emerald-100")}>
                  <Phone className="h-6 w-6 text-emerald-600" />
                </div>
                <div className="flex flex-col">
                  <span className="leading-tight text-emerald-700">Add Call Log</span>
                  <span className="text-xs font-medium text-muted-foreground mt-0 leading-tight">
                    Record communication for this complaint
                  </span>
                </div>
              </SheetTitle>
            </SheetHeader>
          </div>
          <div className="flex-1 overflow-y-auto bg-slate-50/30">
            <div className="px-4 sm:px-6 lg:px-6 pb-6 pt-6 space-y-6">
              <Card className="w-full bg-white shadow-lg border-2 border-border/60 rounded-xl overflow-hidden">
                <CardContent className="p-5">
                  <form onSubmit={handleAddCallLog} className="space-y-5">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                         <Label className="text-xs font-semibold uppercase text-slate-500">Contact Name</Label>
                         <Input value={callForm.contact_name} onChange={(e) => setCallForm(d => ({ ...d, contact_name: e.target.value }))} className="rounded-xl h-10 bg-slate-50" />
                      </div>
                      <div className="space-y-2">
                         <Label className="text-xs font-semibold uppercase text-slate-500">Contact Phone</Label>
                         <Input value={callForm.contact_phone} onChange={(e) => setCallForm(d => ({ ...d, contact_phone: e.target.value }))} className="rounded-xl h-10 bg-slate-50" />
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold uppercase text-slate-500">Type</Label>
                        <Select value={callForm.call_type} onValueChange={(v: any) => setCallForm(d => ({ ...d, call_type: v }))}>
                          <SelectTrigger className="rounded-xl h-10 bg-slate-50"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="inbound">Inbound</SelectItem>
                            <SelectItem value="outbound">Outbound</SelectItem>
                            <SelectItem value="follow_up">Follow Up</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold uppercase text-slate-500">Status</Label>
                        <Select value={callForm.status} onValueChange={(v: any) => setCallForm(d => ({ ...d, status: v }))}>
                          <SelectTrigger className="rounded-xl h-10 bg-slate-50"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="done">Done</SelectItem>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="cancelled">Cancelled</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-semibold uppercase text-slate-500">Notes <span className="text-red-500">*</span></Label>
                      <Textarea value={callForm.notes} onChange={(e) => setCallForm(d => ({ ...d, notes: e.target.value }))} className="rounded-xl bg-slate-50 min-h-[100px]" placeholder="Summary of the call..." />
                    </div>

                    <div className="flex gap-4 pt-4 mt-2 border-t border-slate-100">
                      <CancelButton onClick={() => setShowCallLogSheet(false)} disabled={addCallLogMutation.isPending} size="lg" className="flex-1">Cancel</CancelButton>
                      <CreateUserButton disabled={!callForm.notes || addCallLogMutation.isPending} size="lg" className="flex-1" asyncState={addCallLogMutation.isPending ? 'loading' : 'idle'} mode="create">Add Log</CreateUserButton>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
