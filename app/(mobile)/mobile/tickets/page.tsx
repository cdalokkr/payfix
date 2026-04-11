"use client"

import { trpc } from "@/lib/trpc/client"
import { TicketStatusBadge, PriorityBadge } from "@/features/complaints/components/status-badges"
import { CompactMetricCard } from "@/components/dashboard/compact-metric-card"
import { format } from "date-fns"
import Link from "next/link"
import { TicketCheck, Clock, Building2, CalendarClock, ArrowLeft } from "lucide-react"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"

export default function MobileTicketsPage() {
  const { data: myTickets, isLoading } = trpc.tickets.getMyTickets.useQuery()
  const { data: stats } = trpc.tickets.getMyTicketStats.useQuery()

  return (
    <div className="space-y-4 pb-20">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/mobile">
          <Button variant="ghost" size="icon" className="rounded-xl h-9 w-9">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-lg font-black tracking-tight">My Tickets</h1>
          <p className="text-xs text-muted-foreground">Your assigned tasks</p>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 gap-3">
          <CompactMetricCard label="Open" value={stats.open} icon={<TicketCheck className="h-5 w-5" />} theme="blue" />
          <CompactMetricCard label="In Progress" value={stats.in_progress} icon={<Clock className="h-5 w-5" />} theme="amber" />
          <CompactMetricCard label="Resolved" value={stats.resolved} icon={<TicketCheck className="h-5 w-5" />} theme="emerald" />
          <CompactMetricCard label="Total" value={stats.total} icon={<TicketCheck className="h-5 w-5" />} theme="indigo" />
        </div>
      )}

      {/* Tickets */}
      <div className="space-y-2.5">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 bg-muted/30 rounded-2xl animate-pulse" />
          ))
        ) : !myTickets || myTickets.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <TicketCheck className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="font-bold text-sm">No tickets assigned</p>
          </div>
        ) : (
          myTickets.map((ticket: any, idx: number) => (
            <motion.div
              key={ticket.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.04 }}
            >
              <Link href={`/mobile/tickets/${ticket.id}`}>
                <div className="p-3.5 rounded-2xl border border-border/50 bg-card/50 active:scale-[0.98] transition-transform">
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <span className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-widest">{ticket.ticket_number}</span>
                    <div className="flex gap-1.5">
                      <PriorityBadge priority={ticket.priority} />
                      <TicketStatusBadge status={ticket.status} />
                    </div>
                  </div>
                  <h4 className="font-bold text-sm line-clamp-1">{ticket.title}</h4>
                  <div className="flex items-center gap-3 mt-1.5">
                    {ticket.complaint?.client && (
                      <span className="text-[10px] text-muted-foreground flex items-center gap-1"><Building2 className="h-3 w-3" />{ticket.complaint.client.company_name}</span>
                    )}
                    {ticket.due_date && (
                      <span className="text-[10px] text-muted-foreground flex items-center gap-1"><CalendarClock className="h-3 w-3" />Due: {format(new Date(ticket.due_date), 'dd MMM')}</span>
                    )}
                  </div>
                </div>
              </Link>
            </motion.div>
          ))
        )}
      </div>
    </div>
  )
}
