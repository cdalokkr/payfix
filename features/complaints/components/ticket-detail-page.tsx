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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { TicketStatusBadge, PriorityBadge, CallLogStatusBadge } from "@/features/complaints/components/status-badges"
import { MetricCard } from "@/components/dashboard/metric-card"
import { format } from "date-fns"
import { toast } from "sonner"
import {
  ArrowLeft, Building2, Plus, Phone, Clock, TicketCheck,
  MessageSquare, User2, CalendarClock, Wrench, Loader2
} from "lucide-react"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"

interface Props {
  ticketId: string
  basePath: string
  isEmployeeView?: boolean
}

export default function TicketDetailPage({ ticketId, basePath, isEmployeeView = false }: Props) {
  const router = useRouter()
  const [showResolutionSheet, setShowResolutionSheet] = useState(false)
  const [showCallLogSheet, setShowCallLogSheet] = useState(false)

  const { data: ticket, isLoading, refetch } = trpc.tickets.getById.useQuery({ id: ticketId })

  // Resolution form
  const [resForm, setResForm] = useState({
    resolution_text: "", remarks: "", hours_spent: "",
    status_after: "in_progress" as const,
  })

  // Call log form
  const [callForm, setCallForm] = useState({
    contact_name: "", contact_phone: "", call_type: "outbound" as const,
    duration_minutes: "", notes: "", remarks: "", status: "done" as const,
    next_follow_up: "",
  })

  const addResolutionMutation = trpc.tickets.addResolution.useMutation({
    onSuccess: () => {
      toast.success("Resolution added")
      setShowResolutionSheet(false)
      setResForm({ resolution_text: "", remarks: "", hours_spent: "", status_after: "in_progress" })
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

  const updateStatusMutation = trpc.tickets.updateStatus.useMutation({
    onSuccess: () => { toast.success("Status updated"); refetch() },
    onError: (err) => toast.error(err.message),
  })

  if (isLoading) {
    return <div className="space-y-4">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-24 bg-muted/30 rounded-2xl animate-pulse" />)}</div>
  }

  if (!ticket) {
    return <div className="text-center py-16 text-muted-foreground">Ticket not found</div>
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
            <span className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">{ticket.ticket_number}</span>
            <PriorityBadge priority={ticket.priority} />
            <TicketStatusBadge status={ticket.status} />
          </div>
          <h1 className="text-xl font-bold">{ticket.title}</h1>
          {ticket.complaint && (
            <p className="text-xs text-muted-foreground mt-0.5">
              Complaint: {ticket.complaint.complaint_number} • {ticket.complaint.client?.company_name}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={() => setShowResolutionSheet(true)} className="gap-1.5 rounded-xl">
            <Wrench className="h-3.5 w-3.5" /> Add Resolution
          </Button>
          <Button size="sm" variant="outline" onClick={() => setShowCallLogSheet(true)} className="gap-1.5 rounded-xl">
            <Phone className="h-3.5 w-3.5" /> Call Log
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Description */}
          {ticket.description && (
            <MetricCard gradientColor="from-primary/5 to-transparent" delay={0.1} disableHover>
              <div className="space-y-2">
                <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground/60">Description</h3>
                <p className="text-sm whitespace-pre-wrap">{ticket.description}</p>
              </div>
            </MetricCard>
          )}

          {/* Resolutions Timeline */}
          <MetricCard gradientColor="from-emerald-500/5 to-transparent" delay={0.2} disableHover>
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Wrench className="h-5 w-5 text-emerald-600" />
                <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground/60">Resolutions ({ticket.resolutions?.length || 0})</h3>
              </div>
              {ticket.resolutions?.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No resolutions yet</p>
              ) : (
                <div className="space-y-3">
                  {ticket.resolutions?.map((res: any, idx: number) => (
                    <motion.div key={res.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.05 }}
                      className="relative pl-6 pb-3 border-l-2 border-emerald-200 dark:border-emerald-800 last:border-l-0 last:pb-0">
                      <div className="absolute left-0 top-0 w-2.5 h-2.5 rounded-full -translate-x-[5.5px] bg-background border-2 border-emerald-500" />
                      <div className="p-3 rounded-xl border border-border/30 bg-card/30">
                        <div className="flex items-center justify-between mb-2">
                          <TicketStatusBadge status={res.status_after} />
                          <span className="text-[10px] text-muted-foreground">
                            {res.created_at ? format(new Date(res.created_at), 'dd MMM, hh:mm a') : ''}
                          </span>
                        </div>
                        <p className="text-sm mb-1">{res.resolution_text}</p>
                        {res.remarks && <p className="text-xs text-muted-foreground italic mb-1">{res.remarks}</p>}
                        <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/30">
                          {res.resolver && (
                            <div className="flex items-center gap-1.5">
                              <Avatar className="h-5 w-5"><AvatarImage src={res.resolver.avatar_url} /><AvatarFallback className="text-[8px]">{res.resolver.full_name?.charAt(0)}</AvatarFallback></Avatar>
                              <span className="text-[10px] text-muted-foreground">{res.resolver.full_name}</span>
                            </div>
                          )}
                          {res.hours_spent && <span className="text-[10px] text-muted-foreground"><Clock className="inline h-3 w-3 mr-1" />{res.hours_spent}h</span>}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </MetricCard>

          {/* Call Logs */}
          <MetricCard gradientColor="from-blue-500/5 to-transparent" delay={0.3} disableHover>
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Phone className="h-5 w-5 text-blue-600" />
                <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground/60">Call Logs ({ticket.callLogs?.length || 0})</h3>
              </div>
              {ticket.callLogs?.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No call logs yet</p>
              ) : (
                <div className="space-y-2">
                  {ticket.callLogs?.map((log: any) => (
                    <div key={log.id} className="p-3 rounded-xl border border-border/30 bg-card/30">
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <CallLogStatusBadge status={log.status} />
                          <span className="text-[10px] font-bold text-muted-foreground/60 uppercase">{log.call_type}</span>
                        </div>
                        <span className="text-[10px] text-muted-foreground">{log.created_at ? format(new Date(log.created_at), 'dd MMM, hh:mm a') : ''}</span>
                      </div>
                      {log.notes && <p className="text-sm">{log.notes}</p>}
                      {log.remarks && <p className="text-xs text-muted-foreground italic">{log.remarks}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </MetricCard>
        </div>

        {/* Right Sidebar */}
        <div className="space-y-6">
          {/* Status Control */}
          {!isEmployeeView && (
            <MetricCard gradientColor="from-amber-500/5 to-transparent" delay={0.15} disableHover>
              <div className="space-y-3">
                <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground/60">Update Status</h3>
                <Select value={ticket.status || 'open'} onValueChange={(v: any) => updateStatusMutation.mutate({ id: ticketId, status: v })}>
                  <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </MetricCard>
          )}

          {/* Assigned Members */}
          <MetricCard gradientColor="from-indigo-500/5 to-transparent" delay={0.2} disableHover>
            <div className="space-y-3">
              <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground/60">Assigned Team ({ticket.assignments?.length || 0})</h3>
              <div className="space-y-2">
                {ticket.assignments?.map((a: any) => (
                  <div key={a.id} className="flex items-center gap-3 p-2 rounded-xl border border-border/30">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={a.assignee?.avatar_url} />
                      <AvatarFallback className="text-[10px] font-bold bg-primary/10 text-primary">{a.assignee?.full_name?.charAt(0) || '?'}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{a.assignee?.full_name}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{a.assignee?.email}</p>
                    </div>
                    {a.is_primary && <span className="text-[9px] font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full">Primary</span>}
                  </div>
                ))}
              </div>
            </div>
          </MetricCard>

          {/* Ticket Info */}
          <MetricCard gradientColor="from-slate-500/5 to-transparent" delay={0.25} disableHover>
            <div className="space-y-3">
              <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground/60">Details</h3>
              <div className="space-y-2 text-sm">
                {ticket.due_date && <div className="flex justify-between"><span className="text-muted-foreground">Due Date</span><span className="font-medium">{format(new Date(ticket.due_date), 'dd MMM yyyy')}</span></div>}
                {ticket.estimated_hours && <div className="flex justify-between"><span className="text-muted-foreground">Estimated</span><span className="font-medium">{ticket.estimated_hours}h</span></div>}
                {ticket.actual_hours && <div className="flex justify-between"><span className="text-muted-foreground">Actual</span><span className="font-medium">{ticket.actual_hours}h</span></div>}
                <div className="flex justify-between"><span className="text-muted-foreground">Created</span><span className="font-medium">{ticket.created_at ? format(new Date(ticket.created_at), 'dd MMM yyyy') : '-'}</span></div>
              </div>
            </div>
          </MetricCard>
        </div>
      </div>

      {/* Add Resolution Sheet */}
      <Sheet open={showResolutionSheet} onOpenChange={setShowResolutionSheet}>
        <SheetContent className="w-full sm:max-w-2xl flex flex-col p-0">
          <div className="flex-shrink-0 px-4 sm:px-6 pt-6 border-b border-border/80 pb-3">
            <SheetHeader className="text-left pb-0">
              <SheetTitle className="flex items-center gap-3 text-xl font-bold py-1">
                <div className={cn(
                  "p-2 rounded-lg bg-orange-100"
                )}>
                  <Wrench className="h-6 w-6 text-orange-600" />
                </div>
                <div className="flex flex-col">
                  <span className="leading-tight text-orange-700">Add Resolution Details</span>
                  <span className="text-xs font-medium text-muted-foreground mt-0 leading-tight">
                    Describe the work done on this ticket
                  </span>
                </div>
              </SheetTitle>
            </SheetHeader>
          </div>
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 mt-0">
            <div className="space-y-4">
            <div className="space-y-2">
              <Label>Resolution Details *</Label>
              <Textarea value={resForm.resolution_text} onChange={(e) => setResForm(d => ({ ...d, resolution_text: e.target.value }))} className="rounded-xl min-h-[120px]" placeholder="Describe what was done..." />
            </div>
            <div className="space-y-2">
              <Label>Remarks</Label>
              <Textarea value={resForm.remarks} onChange={(e) => setResForm(d => ({ ...d, remarks: e.target.value }))} className="rounded-xl" placeholder="Additional remarks..." />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Hours Spent</Label>
                <Input type="number" step="0.5" value={resForm.hours_spent} onChange={(e) => setResForm(d => ({ ...d, hours_spent: e.target.value }))} className="rounded-xl" />
              </div>
              <div className="space-y-2">
                <Label>Status After</Label>
                <Select value={resForm.status_after} onValueChange={(v: any) => setResForm(d => ({ ...d, status_after: v }))}>
                  <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="pt-4 border-t border-border/50">
              <Button onClick={() => addResolutionMutation.mutate({
                ticket_id: ticketId,
                resolution_text: resForm.resolution_text,
                remarks: resForm.remarks || undefined,
                hours_spent: resForm.hours_spent ? parseFloat(resForm.hours_spent) : undefined,
                status_after: resForm.status_after,
              })} disabled={!resForm.resolution_text || addResolutionMutation.isPending} className="w-full rounded-xl transition-all duration-200">
                {addResolutionMutation.isPending ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Adding...</span>
                  </div>
                ) : "Add Resolution"}
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
                    Log a call for this ticket
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
                <Label>Type</Label>
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
              <Textarea value={callForm.notes} onChange={(e) => setCallForm(d => ({ ...d, notes: e.target.value }))} className="rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label>Remarks</Label>
              <Textarea value={callForm.remarks} onChange={(e) => setCallForm(d => ({ ...d, remarks: e.target.value }))} className="rounded-xl" />
            </div>
            <div className="pt-4 border-t border-border/50">
              <Button onClick={() => addCallLogMutation.mutate({
                ticket_id: ticketId,
                complaint_id: ticket.complaint_id || undefined,
                client_id: ticket.complaint?.client?.id || undefined,
                contact_name: callForm.contact_name || undefined,
                contact_phone: callForm.contact_phone || undefined,
                call_type: callForm.call_type,
                duration_minutes: callForm.duration_minutes ? parseInt(callForm.duration_minutes) : undefined,
                notes: callForm.notes || undefined,
                remarks: callForm.remarks || undefined,
                status: callForm.status,
              })} disabled={addCallLogMutation.isPending} className="w-full rounded-xl transition-all duration-200">
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
