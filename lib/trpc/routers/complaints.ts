// ============================================
// lib/trpc/routers/complaints.ts
// Complaint Management Router
// ============================================
import { router, protectedProcedure, moderatorProcedure } from '../server'
import { complaints, clients, tickets, callLogs } from '@/lib/db/schema'
import { eq, desc, sql, and, or, ilike, gte, lte, inArray } from 'drizzle-orm'
import { z } from 'zod'
import { TRPCError } from '@trpc/server'

// Auto-generate complaint number: CMP-YYYYMMDD-XXXX
async function generateComplaintNumber(db: any): Promise<string> {
  const today = new Date()
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '')
  const prefix = `CMP-${dateStr}-`

  const existing = await db.select({ complaint_number: complaints.complaint_number })
    .from(complaints)
    .where(ilike(complaints.complaint_number, `${prefix}%`))
    .orderBy(desc(complaints.complaint_number))
    .limit(1)

  const lastNum = existing.length > 0
    ? parseInt(existing[0].complaint_number.split('-').pop() || '0', 10)
    : 0

  return `${prefix}${String(lastNum + 1).padStart(4, '0')}`
}

export const complaintsRouter = router({
  // List all complaints with filters
  list: protectedProcedure
    .input(z.object({
      status: z.enum(['open', 'in_progress', 'resolved', 'closed', 'cancelled']).optional(),
      priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
      category: z.enum(['billing', 'technical', 'service', 'product', 'general']).optional(),
      client_id: z.string().uuid().optional(),
      search: z.string().optional(),
      from_date: z.string().optional(),
      to_date: z.string().optional(),
      limit: z.number().min(1).max(100).default(50),
      offset: z.number().min(0).default(0),
    }).optional())
    .query(async ({ ctx, input }) => {
      const conditions = []

      if (input?.status) conditions.push(eq(complaints.status, input.status))
      if (input?.priority) conditions.push(eq(complaints.priority, input.priority))
      if (input?.category) conditions.push(eq(complaints.category, input.category))
      if (input?.client_id) conditions.push(eq(complaints.client_id, input.client_id))
      if (input?.from_date) conditions.push(gte(complaints.created_at, new Date(input.from_date)))
      if (input?.to_date) conditions.push(lte(complaints.created_at, new Date(input.to_date + 'T23:59:59')))
      if (input?.search) {
        conditions.push(
          or(
            ilike(complaints.subject, `%${input.search}%`),
            ilike(complaints.complaint_number, `%${input.search}%`),
            ilike(complaints.description, `%${input.search}%`),
          )!
        )
      }

      const where = conditions.length > 0 ? and(...conditions) : undefined

      const [data, countResult] = await Promise.all([
        ctx.db.query.complaints.findMany({
          where: where,
          with: {
            client: {
              columns: { id: true, company_name: true, contact_person: true, phone: true },
            },
            tickets: {
              columns: { id: true, status: true },
            },
          },
          orderBy: [desc(complaints.created_at)],
          limit: input?.limit ?? 50,
          offset: input?.offset ?? 0,
        }),
        ctx.db.select({ count: sql<number>`count(*)` })
          .from(complaints).where(where)
      ])

      return { data, total: Number(countResult[0]?.count ?? 0) }
    }),

  // Get single complaint with full details
  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const result = await ctx.db.query.complaints.findFirst({
        where: eq(complaints.id, input.id),
        with: {
          client: true,
          tickets: {
            with: {
              assignments: {
                with: {
                  assignee: {
                    columns: { id: true, full_name: true, email: true, avatar_url: true },
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
            },
            orderBy: (tickets, { desc }) => [desc(tickets.created_at)],
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
      if (!result) throw new TRPCError({ code: 'NOT_FOUND', message: 'Complaint not found' })
      return result
    }),

  // Create complaint
  create: moderatorProcedure
    .input(z.object({
      client_id: z.string().uuid().optional(),
      subject: z.string().min(1, 'Subject is required'),
      description: z.string().optional(),
      category: z.enum(['billing', 'technical', 'service', 'product', 'general']).default('general'),
      priority: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
      source: z.string().default('email'),
      sla_hours: z.number().min(1).default(48),
    }))
    .mutation(async ({ ctx, input }) => {
      const complaint_number = await generateComplaintNumber(ctx.db)

      const [created] = await ctx.db.insert(complaints).values({
        ...input,
        complaint_number,
        created_by: ctx.profile.id,
      }).returning()

      return created
    }),

  // Update complaint
  update: moderatorProcedure
    .input(z.object({
      id: z.string().uuid(),
      client_id: z.string().uuid().optional(),
      subject: z.string().optional(),
      description: z.string().optional(),
      category: z.enum(['billing', 'technical', 'service', 'product', 'general']).optional(),
      priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
      status: z.enum(['open', 'in_progress', 'resolved', 'closed', 'cancelled']).optional(),
      source: z.string().optional(),
      sla_hours: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input

      const updateData: any = { ...data, updated_at: new Date() }
      if (data.status === 'resolved') updateData.resolved_at = new Date()
      if (data.status === 'closed' || data.status === 'cancelled') updateData.closed_at = new Date()

      const [updated] = await ctx.db.update(complaints)
        .set(updateData)
        .where(eq(complaints.id, id))
        .returning()

      return updated
    }),

  // Dashboard stats
  getDashboardStats: protectedProcedure.query(async ({ ctx }) => {
    const [stats, callStats, ticketStats] = await Promise.all([
      ctx.db.select({
        status: complaints.status,
        count: sql<number>`count(*)`,
      })
        .from(complaints)
        .groupBy(complaints.status),
      ctx.db.select({
        status: callLogs.status,
        count: sql<number>`count(*)`,
      })
        .from(callLogs)
        .groupBy(callLogs.status),
      ctx.db.select({
        status: sql<string>`status`,
        count: sql<number>`count(*)`,
      })
        .from(tickets)
        .groupBy(sql`status`)
    ])

    const complaintStats: Record<string, number> = {}
    stats.forEach(s => { complaintStats[s.status || 'unknown'] = Number(s.count) })

    const callLogStats: Record<string, number> = {}
    callStats.forEach(s => { callLogStats[s.status || 'unknown'] = Number(s.count) })

    const ticketStatsMap: Record<string, number> = {}
    ticketStats.forEach(s => { ticketStatsMap[s.status || 'unknown'] = Number(s.count) })

    return {
      complaints: {
        open: complaintStats['open'] || 0,
        in_progress: complaintStats['in_progress'] || 0,
        resolved: complaintStats['resolved'] || 0,
        closed: complaintStats['closed'] || 0,
        cancelled: complaintStats['cancelled'] || 0,
        total: Object.values(complaintStats).reduce((a, b) => a + b, 0),
      },
      callLogs: {
        done: callLogStats['done'] || 0,
        pending: callLogStats['pending'] || 0,
        cancelled: callLogStats['cancelled'] || 0,
        total: Object.values(callLogStats).reduce((a, b) => a + b, 0),
      },
      tickets: {
        open: ticketStatsMap['open'] || 0,
        in_progress: ticketStatsMap['in_progress'] || 0,
        resolved: ticketStatsMap['resolved'] || 0,
        closed: ticketStatsMap['closed'] || 0,
        cancelled: ticketStatsMap['cancelled'] || 0,
        total: Object.values(ticketStatsMap).reduce((a, b) => a + b, 0),
      },
    }
  }),
})
