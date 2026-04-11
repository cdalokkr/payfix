"use client"

import { trpc } from "@/lib/trpc/client"
import { TicketStatusBadge, PriorityBadge } from "@/features/complaints/components/status-badges"
import { PageHeading } from "@/components/ui/page-heading"
import { CompactMetricCard } from "@/components/dashboard/compact-metric-card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { format } from "date-fns"
import Link from "next/link"
import { TicketCheck, Clock, Building2, CalendarClock } from "lucide-react"
import { motion } from "framer-motion"

export default function EmployeeTicketsPage() {
  const { data: myTickets, isLoading } = trpc.tickets.getMyTickets.useQuery()
  const { data: stats } = trpc.tickets.getMyTicketStats.useQuery()

  return (
    <div className="space-y-6">
      <PageHeading heading="My Tickets" description="Tickets assigned to you for resolution" />

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <CompactMetricCard label="Open" value={stats.open} icon={<TicketCheck className="h-5 w-5" />} theme="blue" />
          <CompactMetricCard label="In Progress" value={stats.in_progress} icon={<Clock className="h-5 w-5" />} theme="amber" />
          <CompactMetricCard label="Resolved" value={stats.resolved} icon={<TicketCheck className="h-5 w-5" />} theme="emerald" />
          <CompactMetricCard label="Total" value={stats.total} icon={<TicketCheck className="h-5 w-5" />} theme="indigo" />
        </div>
      )}

      {/* Tickets List */}
      <div className="space-y-3">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 bg-muted/30 rounded-2xl animate-pulse" />
          ))
        ) : !myTickets || myTickets.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <TicketCheck className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p className="font-medium">No tickets assigned</p>
            <p className="text-sm">You'll see tickets here once they are assigned to you</p>
          </div>
        ) : (
          myTickets.map((ticket: any, idx: number) => (
            <motion.div
              key={ticket.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.03 }}
            >
              <Link href={`/employee/tickets/${ticket.id}`}>
                <div className="group p-4 rounded-2xl border border-border/50 bg-card/50 hover:bg-accent/30 hover:border-primary/20 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 cursor-pointer">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">{ticket.ticket_number}</span>
                      </div>
                      <h4 className="font-bold text-sm truncate group-hover:text-primary transition-colors">{ticket.title}</h4>
                      <div className="flex items-center gap-3 mt-1.5">
                        {ticket.complaint?.client && (
                          <div className="flex items-center gap-1">
                            <Building2 className="h-3 w-3 text-muted-foreground/60" />
                            <span className="text-xs text-muted-foreground">{ticket.complaint.client.company_name}</span>
                          </div>
                        )}
                        {ticket.due_date && (
                          <div className="flex items-center gap-1">
                            <CalendarClock className="h-3 w-3 text-muted-foreground/60" />
                            <span className="text-xs text-muted-foreground">Due: {format(new Date(ticket.due_date), 'dd MMM')}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <PriorityBadge priority={ticket.priority} />
                      <TicketStatusBadge status={ticket.status} />
                    </div>
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
