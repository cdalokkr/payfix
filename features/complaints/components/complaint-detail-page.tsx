"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { trpc } from "@/lib/trpc/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { TicketStatusBadge, PriorityBadge, CategoryBadge, CallLogStatusBadge } from "@/features/complaints/components/status-badges"
import { MetricCard } from "@/components/dashboard/metric-card"
import { format } from "date-fns"
import { toast } from "sonner"
import {
  ArrowLeft, Building2, Plus, Phone, Clock, TicketCheck,
  MessageSquare, PhoneCall, CalendarClock, User2
} from "lucide-react"
import { motion } from "framer-motion"
import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import Link from "next/link"

interface Props {
  complaintId: string
  basePath: string
}

export default function ComplaintDetailPage({ complaintId, basePath }: Props) {
  const router = useRouter()
  const [showTicketSheet, setShowTicketSheet] = useState(false)
  const [showCallLogSheet, setShowCallLogSheet] = useState(false)

  const { data: complaint, isLoading, refetch } = trpc.complaints.getById.useQuery({ id: complaintId })
  const { data: teamMembers } = trpc.tickets.getTeamMembers.useQuery()

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

  const handleCreateTicket = () => {
    if (ticketForm.assigned_to.length === 0) {
      toast.error("Select at least one team member")
      return
    }
    createTicketMutation.mutate({
      complaint_id: complaintId,
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

  const handleAddCallLog = () => {
    addCallLogMutation.mutate({
      complaint_id: complaintId,
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

  if (isLoading) {
    return <div className="space-y-4">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-24 bg-muted/30 rounded-2xl animate-pulse" />)}</div>
  }

  if (!complaint) {
    return <div className="text-center py-16 text-muted-foreground">Complaint not found</div>
  }

  return (
    <div className="dashboard-wrapper space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-xl">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">{complaint.complaint_number}</span>
            <CategoryBadge category={complaint.category} />
            <PriorityBadge priority={complaint.priority} />
            <TicketStatusBadge status={complaint.status} />
          </div>
          <h1 className="text-xl font-bold">{complaint.subject}</h1>
        </div>
        <div className="flex gap-2">
          <Select value={complaint.status || 'open'} onValueChange={(v: any) => updateStatusMutation.mutate({ id: complaintId, status: v })}>
            <SelectTrigger className="w-[140px] rounded-xl"><SelectValue /></SelectTrigger>
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

      {/* Info Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column — Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Description */}
          {complaint.description && (
            <MetricCard gradientColor="from-primary/5 to-transparent" delay={0.1} disableHover>
              <div className="space-y-2">
                <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground/60">Description</h3>
                <p className="text-sm whitespace-pre-wrap">{complaint.description}</p>
              </div>
            </MetricCard>
          )}

          {/* Tickets Section */}
          <MetricCard gradientColor="from-blue-500/5 to-transparent" delay={0.2} disableHover>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TicketCheck className="h-5 w-5 text-blue-600" />
                  <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground/60">Tickets ({complaint.tickets?.length || 0})</h3>
                </div>
                <Button size="sm" onClick={() => setShowTicketSheet(true)} className="gap-1.5 rounded-xl text-xs">
                  <Plus className="h-3.5 w-3.5" /> Create Ticket
                </Button>
              </div>
              {complaint.tickets?.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No tickets created yet</p>
              ) : (
                <div className="space-y-2">
                  {complaint.tickets?.map((ticket: any) => (
                    <Link key={ticket.id} href={`${basePath}/tickets/${ticket.id}`}>
                      <div className="p-3 rounded-xl border border-border/50 hover:bg-accent/30 hover:border-primary/20 transition-all cursor-pointer group">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">{ticket.ticket_number}</span>
                              <PriorityBadge priority={ticket.priority} />
                              <TicketStatusBadge status={ticket.status} />
                            </div>
                            <h4 className="text-sm font-bold group-hover:text-primary transition-colors">{ticket.title}</h4>
                          </div>
                          <div className="flex -space-x-2">
                            {ticket.assignments?.map((a: any) => (
                              <Avatar key={a.id} className="h-7 w-7 border-2 border-background">
                                <AvatarImage src={a.assignee?.avatar_url} />
                                <AvatarFallback className="text-[9px] font-bold bg-primary/10 text-primary">{a.assignee?.full_name?.charAt(0) || '?'}</AvatarFallback>
                              </Avatar>
                            ))}
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </MetricCard>

          {/* Call Logs Timeline */}
          <MetricCard gradientColor="from-emerald-500/5 to-transparent" delay={0.3} disableHover>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Phone className="h-5 w-5 text-emerald-600" />
                  <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground/60">Call Logs ({complaint.callLogs?.length || 0})</h3>
                </div>
                <Button size="sm" variant="outline" onClick={() => setShowCallLogSheet(true)} className="gap-1.5 rounded-xl text-xs">
                  <Plus className="h-3.5 w-3.5" /> Add Call Log
                </Button>
              </div>
              {complaint.callLogs?.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No call logs yet</p>
              ) : (
                <div className="space-y-3">
                  {complaint.callLogs?.map((log: any, idx: number) => (
                    <motion.div key={log.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.05 }}
                      className="relative pl-6 pb-3 border-l-2 border-border/50 last:border-l-0 last:pb-0">
                      <div className="absolute left-0 top-0 w-2.5 h-2.5 rounded-full -translate-x-[5.5px] bg-background border-2 border-primary" />
                      <div className="p-3 rounded-xl border border-border/30 bg-card/30">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <CallLogStatusBadge status={log.status} />
                            <span className="text-[10px] font-bold text-muted-foreground/60 uppercase">{log.call_type}</span>
                            {log.duration_minutes && <span className="text-[10px] text-muted-foreground">{log.duration_minutes} min</span>}
                          </div>
                          <span className="text-[10px] text-muted-foreground">
                            {log.created_at ? format(new Date(log.created_at), 'dd MMM, hh:mm a') : ''}
                          </span>
                        </div>
                        {log.contact_name && <p className="text-xs text-muted-foreground mb-1"><Phone className="inline h-3 w-3 mr-1" />{log.contact_name} {log.contact_phone && `• ${log.contact_phone}`}</p>}
                        {log.notes && <p className="text-sm mb-1">{log.notes}</p>}
                        {log.remarks && <p className="text-xs text-muted-foreground italic">{log.remarks}</p>}
                        {log.caller && (
                          <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-border/30">
                            <Avatar className="h-5 w-5"><AvatarImage src={log.caller.avatar_url} /><AvatarFallback className="text-[8px]">{log.caller.full_name?.charAt(0)}</AvatarFallback></Avatar>
                            <span className="text-[10px] text-muted-foreground">{log.caller.full_name}</span>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </MetricCard>
        </div>

        {/* Right Column — Client Info */}
        <div className="space-y-6">
          {complaint.client && (
            <MetricCard gradientColor="from-indigo-500/5 to-transparent" delay={0.15} disableHover>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-indigo-600" />
                  <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground/60">Client</h3>
                </div>
                <h4 className="font-bold">{complaint.client.company_name}</h4>
                {complaint.client.contact_person && <p className="text-sm text-muted-foreground flex items-center gap-1.5"><User2 className="h-3.5 w-3.5" />{complaint.client.contact_person}</p>}
                {complaint.client.phone && <p className="text-sm text-muted-foreground flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" />{complaint.client.phone}</p>}
                {complaint.client.email && <p className="text-sm text-muted-foreground flex items-center gap-1.5 truncate">✉ {complaint.client.email}</p>}
              </div>
            </MetricCard>
          )}

          <MetricCard gradientColor="from-slate-500/5 to-transparent" delay={0.2} disableHover>
            <div className="space-y-3">
              <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground/60">Details</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Source</span><span className="font-medium capitalize">{complaint.source}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">SLA</span><span className="font-medium">{complaint.sla_hours}h</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Created</span><span className="font-medium">{complaint.created_at ? format(new Date(complaint.created_at), 'dd MMM yyyy') : '-'}</span></div>
                {complaint.resolved_at && <div className="flex justify-between"><span className="text-muted-foreground">Resolved</span><span className="font-medium">{format(new Date(complaint.resolved_at), 'dd MMM yyyy')}</span></div>}
              </div>
            </div>
          </MetricCard>
        </div>
      </div>

      {/* Create Ticket Sheet */}
      <Sheet open={showTicketSheet} onOpenChange={setShowTicketSheet}>
        <SheetContent className="w-full sm:max-w-2xl flex flex-col p-0">
          <div className="flex-shrink-0 px-4 sm:px-6 pt-6 border-b border-border/80 pb-3">
            <SheetHeader className="text-left pb-0">
              <SheetTitle className="flex items-center gap-3 text-xl font-bold py-1">
                <div className={cn(
                  "p-2 rounded-lg bg-blue-100"
                )}>
                  <TicketCheck className="h-6 w-6 text-blue-600" />
                </div>
                <div className="flex flex-col">
                  <span className="leading-tight text-blue-700">Create & Assign Ticket</span>
                  <span className="text-xs font-medium text-muted-foreground mt-0 leading-tight">
                    Assign to one or more team members
                  </span>
                </div>
              </SheetTitle>
            </SheetHeader>
          </div>
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 mt-0">
            <div className="space-y-4">
            <div className="space-y-2">
              <Label>Title *</Label>
              <Input value={ticketForm.title} onChange={(e) => setTicketForm(d => ({ ...d, title: e.target.value }))} className="rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={ticketForm.description} onChange={(e) => setTicketForm(d => ({ ...d, description: e.target.value }))} className="rounded-xl" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select value={ticketForm.priority} onValueChange={(v: any) => setTicketForm(d => ({ ...d, priority: v }))}>
                  <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Due Date</Label>
                <Input type="date" value={ticketForm.due_date} onChange={(e) => setTicketForm(d => ({ ...d, due_date: e.target.value }))} className="rounded-xl" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Estimated Hours</Label>
              <Input type="number" value={ticketForm.estimated_hours} onChange={(e) => setTicketForm(d => ({ ...d, estimated_hours: e.target.value }))} className="rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label>Assign Team Members *</Label>
              <div className="border rounded-xl p-3 max-h-[200px] overflow-y-auto space-y-2">
                {teamMembers?.map((member: any) => (
                  <label key={member.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent/30 cursor-pointer transition-colors">
                    <Checkbox
                      checked={ticketForm.assigned_to.some(a => a.profile_id === member.id)}
                      onCheckedChange={() => toggleMember(member.id)}
                    />
                    <Avatar className="h-7 w-7">
                      <AvatarImage src={member.avatar_url} />
                      <AvatarFallback className="text-[9px] font-bold bg-primary/10 text-primary">{member.full_name?.charAt(0) || '?'}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{member.full_name}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{member.email}</p>
                    </div>
                  </label>
                ))}
              </div>
              {ticketForm.assigned_to.length > 0 && (
                <p className="text-xs text-muted-foreground">{ticketForm.assigned_to.length} member(s) selected</p>
              )}
            </div>
            <div className="pt-4 border-t border-border/50">
              <Button onClick={handleCreateTicket} disabled={!ticketForm.title || ticketForm.assigned_to.length === 0 || createTicketMutation.isPending} className="w-full rounded-xl transition-all duration-200">
                {createTicketMutation.isPending ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Creating...</span>
                  </div>
                ) : "Create & Assign Ticket"}
              </Button>
            </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Add Call Log Sheet */}
      <Sheet open={showCallLogSheet} onOpenChange={setShowCallLogSheet}>
        <SheetContent className="w-full sm:max-w-2xl flex flex-col p-0">
          <div className="flex-shrink-0 px-4 sm:px-6 pt-6 border-b border-border/80 pb-3">
            <SheetHeader className="text-left pb-0">
              <SheetTitle className="flex items-center gap-3 text-xl font-bold py-1">
                <div className={cn(
                  "p-2 rounded-lg bg-emerald-100"
                )}>
                  <Phone className="h-6 w-6 text-emerald-600" />
                </div>
                <div className="flex flex-col">
                  <span className="leading-tight text-emerald-700">Add Call Log</span>
                  <span className="text-xs font-medium text-muted-foreground mt-0 leading-tight">
                    Log a phone call related to this complaint
                  </span>
                </div>
              </SheetTitle>
            </SheetHeader>
          </div>
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 mt-0">
            <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Contact Name</Label>
                <Input value={callForm.contact_name} onChange={(e) => setCallForm(d => ({ ...d, contact_name: e.target.value }))} className="rounded-xl" />
              </div>
              <div className="space-y-2">
                <Label>Contact Phone</Label>
                <Input value={callForm.contact_phone} onChange={(e) => setCallForm(d => ({ ...d, contact_phone: e.target.value }))} className="rounded-xl" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Call Type</Label>
                <Select value={callForm.call_type} onValueChange={(v: any) => setCallForm(d => ({ ...d, call_type: v }))}>
                  <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="inbound">Inbound</SelectItem>
                    <SelectItem value="outbound">Outbound</SelectItem>
                    <SelectItem value="follow_up">Follow Up</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Duration (min)</Label>
                <Input type="number" value={callForm.duration_minutes} onChange={(e) => setCallForm(d => ({ ...d, duration_minutes: e.target.value }))} className="rounded-xl" />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={callForm.status} onValueChange={(v: any) => setCallForm(d => ({ ...d, status: v }))}>
                  <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="done">Done</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea value={callForm.notes} onChange={(e) => setCallForm(d => ({ ...d, notes: e.target.value }))} className="rounded-xl" placeholder="Call summary..." />
            </div>
            <div className="space-y-2">
              <Label>Remarks</Label>
              <Textarea value={callForm.remarks} onChange={(e) => setCallForm(d => ({ ...d, remarks: e.target.value }))} className="rounded-xl" placeholder="Additional remarks..." />
            </div>
            <div className="space-y-2">
              <Label>Next Follow Up</Label>
              <Input type="datetime-local" value={callForm.next_follow_up} onChange={(e) => setCallForm(d => ({ ...d, next_follow_up: e.target.value }))} className="rounded-xl" />
            </div>
            <div className="pt-4 border-t border-border/50">
              <Button onClick={handleAddCallLog} disabled={addCallLogMutation.isPending} className="w-full rounded-xl transition-all duration-200">
                {addCallLogMutation.isPending ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Adding...</span>
                  </div>
                ) : "Add Call Log"}
              </Button>
            </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
