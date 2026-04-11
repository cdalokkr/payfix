// ============================================
// lib/trpc/routers/tickets.ts
// Ticket Management Router (multi-member assignment)
// ============================================
import { router, protectedProcedure, moderatorProcedure } from '../server'
import { tickets, ticketAssignments, ticketResolutions, callLogs, complaints, profiles } from '@/lib/db/schema'
import { eq, desc, sql, and, or, ilike, inArray } from 'drizzle-orm'
import { z } from 'zod'
import { TRPCError } from '@trpc/server'

// Auto-generate ticket number: TKT-YYYYMMDD-XXXX
async function generateTicketNumber(db: any): Promise<string> {
  const today = new Date()
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '')
  const prefix = `TKT-${dateStr}-`

  const existing = await db.select({ ticket_number: tickets.ticket_number })
    .from(tickets)
    .where(ilike(tickets.ticket_number, `${prefix}%`))
    .orderBy(desc(tickets.ticket_number))
    .limit(1)

  const lastNum = existing.length > 0
    ? parseInt(existing[0].ticket_number.split('-').pop() || '0', 10)
    : 0

  return `${prefix}${String(lastNum + 1).padStart(4, '0')}`
}

export const ticketsRouter = router({
  // List all tickets with filters
  list: protectedProcedure
    .input(z.object({
      status: z.enum(['open', 'in_progress', 'resolved', 'closed', 'cancelled']).optional(),
      priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
      complaint_id: z.string().uuid().optional(),
      assigned_to: z.string().uuid().optional(),
      search: z.string().optional(),
      limit: z.number().min(1).max(100).default(50),
      offset: z.number().min(0).default(0),
    }).optional())
    .query(async ({ ctx, input }) => {
      // If filtering by assigned_to, we need to join with ticket_assignments
      let ticketIds: string[] | undefined

      if (input?.assigned_to) {
        const assignments = await ctx.db.select({ ticket_id: ticketAssignments.ticket_id })
          .from(ticketAssignments)
          .where(eq(ticketAssignments.assigned_to, input.assigned_to))
        ticketIds = assignments.map(a => a.ticket_id)
        if (ticketIds.length === 0) return { data: [], total: 0 }
      }

      const conditions = []
      if (input?.status) conditions.push(eq(tickets.status, input.status))
      if (input?.priority) conditions.push(eq(tickets.priority, input.priority))
      if (input?.complaint_id) conditions.push(eq(tickets.complaint_id, input.complaint_id))
      if (ticketIds) conditions.push(inArray(tickets.id, ticketIds))
      if (input?.search) {
        conditions.push(
          or(
            ilike(tickets.title, `%${input.search}%`),
            ilike(tickets.ticket_number, `%${input.search}%`),
          )!
        )
      }

      const where = conditions.length > 0 ? and(...conditions) : undefined

      const data = await ctx.db.query.tickets.findMany({
        where: where,
        with: {
          complaint: {
            columns: { id: true, complaint_number: true, subject: true },
            with: {
              client: {
                columns: { id: true, company_name: true },
              },
            },
          },
          assignments: {
            with: {
              assignee: {
                columns: { id: true, full_name: true, email: true, avatar_url: true },
              },
            },
          },
        },
        orderBy: [desc(tickets.created_at)],
        limit: input?.limit ?? 50,
        offset: input?.offset ?? 0,
      })

      const countResult = await ctx.db.select({ count: sql<number>`count(*)` })
        .from(tickets).where(where)

      return { data, total: Number(countResult[0]?.count ?? 0) }
    }),

  // Get single ticket with full details
  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const result = await ctx.db.query.tickets.findFirst({
        where: eq(tickets.id, input.id),
        with: {
          complaint: {
            with: {
              client: true,
            },
          },
          assignments: {
            with: {
              assignee: {
                columns: { id: true, full_name: true, email: true, avatar_url: true, role: true },
              },
              assigner: {
                columns: { id: true, full_name: true },
              },
            },
          },
          resolutions: {
            with: {
              resolver: {
                columns: { id: true, full_name: true, avatar_url: true },
              },
            },
            orderBy: (ticketResolutions, { desc }) => [desc(ticketResolutions.created_at)],
          },
          callLogs: {
            with: {
              caller: {
                columns: { id: true, full_name: true, avatar_url: true },
              },
            },
            orderBy: (callLogs, { desc }) => [desc(callLogs.created_at)],
          },
        },
      })
      if (!result) throw new TRPCError({ code: 'NOT_FOUND', message: 'Ticket not found' })
      return result
    }),

  // Create ticket & assign to multiple members
  create: moderatorProcedure
    .input(z.object({
      complaint_id: z.string().uuid(),
      title: z.string().min(1, 'Title is required'),
      description: z.string().optional(),
      priority: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
      due_date: z.string().optional(),
      estimated_hours: z.number().optional(),
      assigned_to: z.array(z.object({
        profile_id: z.string().uuid(),
        role: z.enum(['assignee', 'reviewer', 'observer']).default('assignee'),
        is_primary: z.boolean().default(false),
      })).min(1, 'At least one team member is required'),
    }))
    .mutation(async ({ ctx, input }) => {
      const ticket_number = await generateTicketNumber(ctx.db)

      // Create the ticket
      const [ticket] = await ctx.db.insert(tickets).values({
        ticket_number,
        complaint_id: input.complaint_id,
        title: input.title,
        description: input.description,
        priority: input.priority,
        due_date: input.due_date,
        estimated_hours: input.estimated_hours?.toString(),
        created_by: ctx.profile.id,
      }).returning()

      // Create assignments for each team member
      const assignmentValues = input.assigned_to.map(a => ({
        ticket_id: ticket.id,
        assigned_to: a.profile_id,
        assigned_by: ctx.profile.id,
        role: a.role,
        is_primary: a.is_primary,
      }))

      await ctx.db.insert(ticketAssignments).values(assignmentValues)

      // Update complaint status to in_progress if it was open
      await ctx.db.update(complaints)
        .set({ status: 'in_progress', updated_at: new Date() })
        .where(and(
          eq(complaints.id, input.complaint_id),
          eq(complaints.status, 'open')
        ))

      return ticket
    }),

  // Update ticket status
  updateStatus: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
      status: z.enum(['open', 'in_progress', 'resolved', 'closed', 'cancelled']),
    }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db.update(tickets)
        .set({ status: input.status, updated_at: new Date() })
        .where(eq(tickets.id, input.id))
        .returning()
      return updated
    }),

  // Reassign ticket (add/remove members)
  updateAssignments: moderatorProcedure
    .input(z.object({
      ticket_id: z.string().uuid(),
      assigned_to: z.array(z.object({
        profile_id: z.string().uuid(),
        role: z.enum(['assignee', 'reviewer', 'observer']).default('assignee'),
        is_primary: z.boolean().default(false),
      })).min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      // Remove existing assignments
      await ctx.db.delete(ticketAssignments)
        .where(eq(ticketAssignments.ticket_id, input.ticket_id))

      // Insert new assignments
      const assignmentValues = input.assigned_to.map(a => ({
        ticket_id: input.ticket_id,
        assigned_to: a.profile_id,
        assigned_by: ctx.profile.id,
        role: a.role,
        is_primary: a.is_primary,
      }))

      await ctx.db.insert(ticketAssignments).values(assignmentValues)
      return { success: true }
    }),

  // Add resolution details (by assigned team member)
  addResolution: protectedProcedure
    .input(z.object({
      ticket_id: z.string().uuid(),
      resolution_text: z.string().min(1, 'Resolution details are required'),
      remarks: z.string().optional(),
      hours_spent: z.number().optional(),
      status_after: z.enum(['in_progress', 'resolved', 'closed']).default('in_progress'),
    }))
    .mutation(async ({ ctx, input }) => {
      const [resolution] = await ctx.db.insert(ticketResolutions).values({
        ticket_id: input.ticket_id,
        resolved_by: ctx.profile.id,
        resolution_text: input.resolution_text,
        remarks: input.remarks,
        hours_spent: input.hours_spent?.toString(),
        status_after: input.status_after,
      }).returning()

      // Update ticket status
      const updateData: any = { status: input.status_after, updated_at: new Date() }

      // Accumulate actual hours
      if (input.hours_spent) {
        const ticket = await ctx.db.query.tickets.findFirst({
          where: eq(tickets.id, input.ticket_id),
          columns: { actual_hours: true },
        })
        const currentHours = parseFloat(ticket?.actual_hours || '0')
        updateData.actual_hours = (currentHours + input.hours_spent).toString()
      }

      await ctx.db.update(tickets)
        .set(updateData)
        .where(eq(tickets.id, input.ticket_id))

      return resolution
    }),

  // Add call log
  addCallLog: protectedProcedure
    .input(z.object({
      ticket_id: z.string().uuid().optional(),
      complaint_id: z.string().uuid().optional(),
      client_id: z.string().uuid().optional(),
      contact_name: z.string().optional(),
      contact_phone: z.string().optional(),
      call_type: z.enum(['inbound', 'outbound', 'follow_up']).default('outbound'),
      duration_minutes: z.number().optional(),
      notes: z.string().optional(),
      remarks: z.string().optional(),
      status: z.enum(['done', 'pending', 'cancelled']).default('pending'),
      next_follow_up: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const [log] = await ctx.db.insert(callLogs).values({
        ...input,
        called_by: ctx.profile.id,
        next_follow_up: input.next_follow_up ? new Date(input.next_follow_up) : null,
      }).returning()
      return log
    }),

  // Update call log status
  updateCallLog: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
      status: z.enum(['done', 'pending', 'cancelled']),
      notes: z.string().optional(),
      remarks: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input
      const [updated] = await ctx.db.update(callLogs)
        .set(data)
        .where(eq(callLogs.id, id))
        .returning()
      return updated
    }),

  // Get my tickets (for current user — employee PWA)
  getMyTickets: protectedProcedure
    .input(z.object({
      status: z.enum(['open', 'in_progress', 'resolved', 'closed', 'cancelled']).optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      const myAssignments = await ctx.db.select({ ticket_id: ticketAssignments.ticket_id })
        .from(ticketAssignments)
        .where(eq(ticketAssignments.assigned_to, ctx.profile.id))

      const myTicketIds = myAssignments.map(a => a.ticket_id)
      if (myTicketIds.length === 0) return []

      const conditions = [inArray(tickets.id, myTicketIds)]
      if (input?.status) conditions.push(eq(tickets.status, input.status))

      return ctx.db.query.tickets.findMany({
        where: and(...conditions),
        with: {
          complaint: {
            columns: { id: true, complaint_number: true, subject: true },
            with: {
              client: {
                columns: { id: true, company_name: true },
              },
            },
          },
          assignments: {
            with: {
              assignee: {
                columns: { id: true, full_name: true, email: true, avatar_url: true },
              },
            },
          },
          resolutions: {
            orderBy: (ticketResolutions, { desc }) => [desc(ticketResolutions.created_at)],
            limit: 1,
          },
        },
        orderBy: [desc(tickets.created_at)],
      })
    }),

  // Get my ticket stats (for employee dashboard / PWA)
  getMyTicketStats: protectedProcedure.query(async ({ ctx }) => {
    const myAssignments = await ctx.db.select({ ticket_id: ticketAssignments.ticket_id })
      .from(ticketAssignments)
      .where(eq(ticketAssignments.assigned_to, ctx.profile.id))

    const myTicketIds = myAssignments.map(a => a.ticket_id)
    if (myTicketIds.length === 0) return { open: 0, in_progress: 0, resolved: 0, total: 0 }

    const stats = await ctx.db.select({
      status: tickets.status,
      count: sql<number>`count(*)`,
    })
      .from(tickets)
      .where(inArray(tickets.id, myTicketIds))
      .groupBy(tickets.status)

    const statsMap: Record<string, number> = {}
    stats.forEach(s => { statsMap[s.status || 'unknown'] = Number(s.count) })

    return {
      open: statsMap['open'] || 0,
      in_progress: statsMap['in_progress'] || 0,
      resolved: statsMap['resolved'] || 0,
      closed: statsMap['closed'] || 0,
      total: Object.values(statsMap).reduce((a, b) => a + b, 0),
    }
  }),

  // Call log stats for dashboard cards
  getCallLogStats: protectedProcedure.query(async ({ ctx }) => {
    const stats = await ctx.db.select({
      status: callLogs.status,
      count: sql<number>`count(*)`,
    })
      .from(callLogs)
      .groupBy(callLogs.status)

    const statsMap: Record<string, number> = {}
    stats.forEach(s => { statsMap[s.status || 'unknown'] = Number(s.count) })

    return {
      done: statsMap['done'] || 0,
      pending: statsMap['pending'] || 0,
      cancelled: statsMap['cancelled'] || 0,
      total: Object.values(statsMap).reduce((a, b) => a + b, 0),
    }
  }),

  // List all team members for assignment dropdown
  getTeamMembers: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.select({
      id: profiles.id,
      full_name: profiles.full_name,
      email: profiles.email,
      role: profiles.role,
      avatar_url: profiles.avatar_url,
    })
      .from(profiles)
      .where(eq(profiles.status, 'active'))
      .orderBy(profiles.full_name)
  }),
})
