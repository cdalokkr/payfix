"use client"

import { useState } from "react"
import { useRouter, useParams } from "next/navigation"
import { trpc } from "@/lib/trpc/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { TicketStatusBadge, PriorityBadge, CallLogStatusBadge } from "@/features/complaints/components/status-badges"
import { format } from "date-fns"
import { toast } from "sonner"
import {
  ArrowLeft, Building2, Phone, Clock, Wrench, User2, CalendarClock
} from "lucide-react"
import { motion } from "framer-motion"

export default function MobileTicketDetailPage() {
  const router = useRouter()
  const params = useParams()
  const ticketId = params.id as string

  const [activeTab, setActiveTab] = useState<'details' | 'resolution' | 'calllog'>('details')

  const { data: ticket, isLoading, refetch } = trpc.tickets.getById.useQuery({ id: ticketId })

  // Resolution form
  const [resForm, setResForm] = useState({
    resolution_text: "", remarks: "", hours_spent: "", status_after: "in_progress" as const,
  })

  // Call log form
  const [callForm, setCallForm] = useState({
    contact_name: "", contact_phone: "", call_type: "outbound" as const,
    duration_minutes: "", notes: "", remarks: "", status: "done" as const,
  })

  const addResolutionMutation = trpc.tickets.addResolution.useMutation({
    onSuccess: () => {
      toast.success("Resolution added")
      setResForm({ resolution_text: "", remarks: "", hours_spent: "", status_after: "in_progress" })
      setActiveTab('details')
      refetch()
    },
    onError: (err) => toast.error(err.message),
  })

  const addCallLogMutation = trpc.tickets.addCallLog.useMutation({
    onSuccess: () => {
      toast.success("Call log added")
      setCallForm({ contact_name: "", contact_phone: "", call_type: "outbound", duration_minutes: "", notes: "", remarks: "", status: "done" })
      setActiveTab('details')
      refetch()
    },
    onError: (err) => toast.error(err.message),
  })

  if (isLoading) {
    return <div className="space-y-3 pb-20">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-20 bg-muted/30 rounded-2xl animate-pulse" />)}</div>
  }

  if (!ticket) {
    return <div className="text-center py-16 text-muted-foreground text-sm">Ticket not found</div>
  }

  return (
    <div className="space-y-4 pb-24">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-xl h-9 w-9">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-widest">{ticket.ticket_number}</span>
            <PriorityBadge priority={ticket.priority} />
            <TicketStatusBadge status={ticket.status} />
          </div>
          <h1 className="text-base font-black truncate">{ticket.title}</h1>
        </div>
      </div>

      {/* Tab Buttons */}
      <div className="flex gap-2">
        {[
          { key: 'details', label: 'Details', icon: Building2 },
          { key: 'resolution', label: 'Add Resolution', icon: Wrench },
          { key: 'calllog', label: 'Call Log', icon: Phone },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all ${
              activeTab === tab.key
                ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20'
                : 'bg-card border border-border/50 text-muted-foreground'
            }`}
          >
            <tab.icon className="h-3.5 w-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Details Tab */}
      {activeTab === 'details' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          {/* Ticket Info */}
          <div className="p-4 rounded-2xl border border-border/50 bg-card/50 space-y-3">
            {ticket.complaint?.client && (
              <div className="flex items-center gap-2 text-sm">
                <Building2 className="h-4 w-4 text-primary" />
                <span className="font-bold">{ticket.complaint.client.company_name}</span>
              </div>
            )}
            {ticket.description && <p className="text-sm text-muted-foreground">{ticket.description}</p>}
            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border/30">
              {ticket.due_date && (
                <div className="text-xs"><span className="text-muted-foreground">Due:</span> <span className="font-medium">{format(new Date(ticket.due_date), 'dd MMM yyyy')}</span></div>
              )}
              {ticket.estimated_hours && (
                <div className="text-xs"><span className="text-muted-foreground">Est:</span> <span className="font-medium">{ticket.estimated_hours}h</span></div>
              )}
              {ticket.actual_hours && (
                <div className="text-xs"><span className="text-muted-foreground">Actual:</span> <span className="font-medium">{ticket.actual_hours}h</span></div>
              )}
            </div>
          </div>

          {/* Assigned Members */}
          {ticket.assignments && ticket.assignments.length > 0 && (
            <div className="p-4 rounded-2xl border border-border/50 bg-card/50 space-y-2">
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Team</h3>
              {ticket.assignments.map((a: any) => (
                <div key={a.id} className="flex items-center gap-2.5">
                  <Avatar className="h-7 w-7"><AvatarImage src={a.assignee?.avatar_url} /><AvatarFallback className="text-[9px] font-bold bg-primary/10 text-primary">{a.assignee?.full_name?.charAt(0)}</AvatarFallback></Avatar>
                  <span className="text-sm font-medium">{a.assignee?.full_name}</span>
                  {a.is_primary && <span className="text-[8px] font-bold bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">Primary</span>}
                </div>
              ))}
            </div>
          )}

          {/* Resolutions */}
          {ticket.resolutions && ticket.resolutions.length > 0 && (
            <div className="p-4 rounded-2xl border border-border/50 bg-card/50 space-y-3">
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Resolutions ({ticket.resolutions.length})</h3>
              {ticket.resolutions.map((res: any) => (
                <div key={res.id} className="p-3 rounded-xl border border-border/30 bg-background/50 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <TicketStatusBadge status={res.status_after} />
                    <span className="text-[9px] text-muted-foreground">{res.created_at ? format(new Date(res.created_at), 'dd MMM, hh:mm a') : ''}</span>
                  </div>
                  <p className="text-sm">{res.resolution_text}</p>
                  {res.remarks && <p className="text-xs text-muted-foreground italic">{res.remarks}</p>}
                  {res.resolver && <p className="text-[10px] text-muted-foreground">— {res.resolver.full_name}</p>}
                </div>
              ))}
            </div>
          )}

          {/* Call Logs */}
          {ticket.callLogs && ticket.callLogs.length > 0 && (
            <div className="p-4 rounded-2xl border border-border/50 bg-card/50 space-y-3">
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Call Logs ({ticket.callLogs.length})</h3>
              {ticket.callLogs.map((log: any) => (
                <div key={log.id} className="p-3 rounded-xl border border-border/30 bg-background/50 space-y-1">
                  <div className="flex items-center justify-between">
                    <CallLogStatusBadge status={log.status} />
                    <span className="text-[9px] text-muted-foreground">{log.created_at ? format(new Date(log.created_at), 'dd MMM, hh:mm a') : ''}</span>
                  </div>
                  {log.notes && <p className="text-sm">{log.notes}</p>}
                  {log.remarks && <p className="text-xs text-muted-foreground italic">{log.remarks}</p>}
                </div>
              ))}
            </div>
          )}
        </motion.div>
      )}

      {/* Add Resolution Tab */}
      {activeTab === 'resolution' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          <div className="p-4 rounded-2xl border border-border/50 bg-card/50 space-y-4">
            <div className="space-y-2">
              <Label className="text-xs font-bold">Resolution Details *</Label>
              <Textarea value={resForm.resolution_text} onChange={(e) => setResForm(d => ({ ...d, resolution_text: e.target.value }))} className="rounded-xl min-h-[100px] text-sm" placeholder="What work was done..." />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold">Remarks</Label>
              <Textarea value={resForm.remarks} onChange={(e) => setResForm(d => ({ ...d, remarks: e.target.value }))} className="rounded-xl text-sm" placeholder="Any additional notes..." />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-xs font-bold">Hours Spent</Label>
                <Input type="number" step="0.5" value={resForm.hours_spent} onChange={(e) => setResForm(d => ({ ...d, hours_spent: e.target.value }))} className="rounded-xl text-sm" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold">Status</Label>
                <Select value={resForm.status_after} onValueChange={(v: any) => setResForm(d => ({ ...d, status_after: v }))}>
                  <SelectTrigger className="rounded-xl text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button
              onClick={() => addResolutionMutation.mutate({
                ticket_id: ticketId,
                resolution_text: resForm.resolution_text,
                remarks: resForm.remarks || undefined,
                hours_spent: resForm.hours_spent ? parseFloat(resForm.hours_spent) : undefined,
                status_after: resForm.status_after,
              })}
              disabled={!resForm.resolution_text || addResolutionMutation.isPending}
              className="w-full rounded-xl"
            >
              {addResolutionMutation.isPending ? "Submitting..." : "Submit Resolution"}
            </Button>
          </div>
        </motion.div>
      )}

      {/* Add Call Log Tab */}
      {activeTab === 'calllog' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          <div className="p-4 rounded-2xl border border-border/50 bg-card/50 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-xs font-bold">Contact Name</Label>
                <Input value={callForm.contact_name} onChange={(e) => setCallForm(d => ({ ...d, contact_name: e.target.value }))} className="rounded-xl text-sm" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold">Contact Phone</Label>
                <Input value={callForm.contact_phone} onChange={(e) => setCallForm(d => ({ ...d, contact_phone: e.target.value }))} className="rounded-xl text-sm" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label className="text-xs font-bold">Type</Label>
                <Select value={callForm.call_type} onValueChange={(v: any) => setCallForm(d => ({ ...d, call_type: v }))}>
                  <SelectTrigger className="rounded-xl text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="inbound">Inbound</SelectItem>
                    <SelectItem value="outbound">Outbound</SelectItem>
                    <SelectItem value="follow_up">Follow Up</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold">Duration</Label>
                <Input type="number" value={callForm.duration_minutes} onChange={(e) => setCallForm(d => ({ ...d, duration_minutes: e.target.value }))} className="rounded-xl text-sm" placeholder="min" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold">Status</Label>
                <Select value={callForm.status} onValueChange={(v: any) => setCallForm(d => ({ ...d, status: v }))}>
                  <SelectTrigger className="rounded-xl text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="done">Done</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold">Notes</Label>
              <Textarea value={callForm.notes} onChange={(e) => setCallForm(d => ({ ...d, notes: e.target.value }))} className="rounded-xl text-sm" placeholder="Call summary..." />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold">Remarks</Label>
              <Textarea value={callForm.remarks} onChange={(e) => setCallForm(d => ({ ...d, remarks: e.target.value }))} className="rounded-xl text-sm" placeholder="Additional remarks..." />
            </div>
            <Button
              onClick={() => addCallLogMutation.mutate({
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
              })}
              disabled={addCallLogMutation.isPending}
              className="w-full rounded-xl"
            >
              {addCallLogMutation.isPending ? "Adding..." : "Add Call Log"}
            </Button>
          </div>
        </motion.div>
      )}
    </div>
  )
}
