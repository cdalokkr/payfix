"use client"

import { useState } from "react"
import { trpc } from "@/lib/trpc/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { TicketStatusBadge, PriorityBadge } from "@/features/complaints/components/status-badges"
import { PageHeading } from "@/components/ui/page-heading"
import { CompactMetricCard } from "@/components/dashboard/compact-metric-card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { format } from "date-fns"
import Link from "next/link"
import {
  TicketCheck, Search, Building2, Clock, CalendarClock, Users
} from "lucide-react"
import { motion } from "framer-motion"
import { DashboardPageLayout } from "@/components/dashboard/dashboard-page-layout"

export default function TicketsPage({ basePath = "/admin" }: { basePath?: string }) {
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("")
  const [priorityFilter, setPriorityFilter] = useState<string>("")

  const { data: ticketsData, isLoading } = trpc.tickets.list.useQuery({
    search: search || undefined,
    status: (statusFilter || undefined) as any,
    priority: (priorityFilter || undefined) as any,
  })

  const { data: stats } = trpc.complaints.getDashboardStats.useQuery()

  return (
    <DashboardPageLayout
      heading="Tickets"
      description="Track all assigned tickets and their progress"
    >
      <div className="space-y-6">

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          <CompactMetricCard label="Open" value={stats.tickets.open} icon={<TicketCheck className="h-5 w-5" />} theme="blue" />
          <CompactMetricCard label="In Progress" value={stats.tickets.in_progress} icon={<Clock className="h-5 w-5" />} theme="amber" />
          <CompactMetricCard label="Resolved" value={stats.tickets.resolved} icon={<TicketCheck className="h-5 w-5" />} theme="emerald" />
          <CompactMetricCard label="Closed" value={stats.tickets.closed} icon={<TicketCheck className="h-5 w-5" />} theme="primary" />
          <CompactMetricCard label="Total" value={stats.tickets.total} icon={<TicketCheck className="h-5 w-5" />} theme="indigo" />
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search tickets..."
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
      </div>

      {/* Tickets List */}
      <div className="space-y-3">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-24 bg-muted/30 rounded-2xl animate-pulse" />
          ))
        ) : ticketsData?.data.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <TicketCheck className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p className="font-medium">No tickets found</p>
            <p className="text-sm">Tickets are created from complaints</p>
          </div>
        ) : (
          ticketsData?.data.map((ticket: any, idx: number) => (
            <motion.div
              key={ticket.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.03 }}
            >
              <Link href={`${basePath}/tickets/${ticket.id}`}>
                <div className="group p-4 rounded-2xl border border-border/50 bg-card/50 hover:bg-accent/30 hover:border-primary/20 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 cursor-pointer">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">
                          {ticket.ticket_number}
                        </span>
                        {ticket.complaint?.complaint_number && (
                          <span className="text-[10px] text-muted-foreground/40">
                            → {ticket.complaint.complaint_number}
                          </span>
                        )}
                      </div>
                      <h4 className="font-bold text-sm truncate group-hover:text-primary transition-colors">
                        {ticket.title}
                      </h4>
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
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <div className="flex items-center gap-2">
                        <PriorityBadge priority={ticket.priority} />
                        <TicketStatusBadge status={ticket.status} />
                      </div>
                      {/* Assigned avatars */}
                      {ticket.assignments?.length > 0 && (
                        <div className="flex items-center gap-1">
                          <Users className="h-3 w-3 text-muted-foreground/40 mr-1" />
                          <div className="flex -space-x-2">
                            {ticket.assignments.slice(0, 3).map((a: any) => (
                              <Avatar key={a.id} className="h-6 w-6 border-2 border-background">
                                <AvatarImage src={a.assignee?.avatar_url} />
                                <AvatarFallback className="text-[8px] font-bold bg-primary/10 text-primary">
                                  {a.assignee?.full_name?.charAt(0) || '?'}
                                </AvatarFallback>
                              </Avatar>
                            ))}
                            {ticket.assignments.length > 3 && (
                              <span className="flex items-center justify-center h-6 w-6 rounded-full bg-muted text-[8px] font-bold border-2 border-background">
                                +{ticket.assignments.length - 3}
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            </motion.div>
          ))
        )}
      </div>
      </div>
    </DashboardPageLayout>
  )
}
