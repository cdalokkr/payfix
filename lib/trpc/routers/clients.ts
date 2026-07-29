// ============================================
// lib/trpc/routers/clients.ts
// CRM-style Client Management Router
// ============================================
import { router, protectedProcedure, moderatorProcedure, adminProcedure } from '../server'
import { clients } from '@/lib/db/schema'
import { eq, ilike, or, desc, sql, and } from 'drizzle-orm'
import { z } from 'zod'
import { TRPCError } from '@trpc/server'

export const clientsRouter = router({
  // List all clients with search
  list: protectedProcedure
    .input(z.object({
      search: z.string().optional(),
      status: z.enum(['active', 'inactive']).optional(),
      limit: z.number().min(1).max(100).default(50),
      offset: z.number().min(0).default(0),
    }).optional())
    .query(async ({ ctx, input }) => {
      const conditions: any[] = []

      if (input?.status) {
        conditions.push(eq(clients.status, input.status))
      }
      if (input?.search) {
        conditions.push(
          or(
            ilike(clients.company_name, `%${input.search}%`),
            ilike(clients.contact_person, `%${input.search}%`),
            ilike(clients.email, `%${input.search}%`),
            ilike(clients.phone, `%${input.search}%`),
            ilike(clients.city, `%${input.search}%`),
          )!
        )
      }

      const where = conditions.length > 0 ? and(...conditions) : undefined

      const [data, countResult] = await Promise.all([
        ctx.db.select().from(clients)
          .where(where)
          .orderBy(desc(clients.created_at))
          .limit(input?.limit ?? 50)
          .offset(input?.offset ?? 0),
        ctx.db.select({ count: sql<number>`count(*)` }).from(clients).where(where),
      ])

      return { data, total: Number(countResult[0]?.count ?? 0) }
    }),

  // Get single client with complaint history
  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const result = await ctx.db.query.clients.findFirst({
        where: eq(clients.id, input.id),
        with: {
          complaints: {
            orderBy: (complaints: any, { desc }: any) => [desc(complaints.created_at)],
            limit: 20,
          },
        },
      })
      if (!result) throw new TRPCError({ code: 'NOT_FOUND', message: 'Client not found' })
      return result
    }),

  // Create client
  create: moderatorProcedure
    .input(z.object({
      company_name: z.string().min(1, 'Company name is required'),
      contact_person: z.string().optional(),
      email: z.string().email().optional().or(z.literal('')),
      phone: z.string().optional(),
      alt_phone: z.string().optional(),
      gst_number: z.string().optional(),
      pan_number: z.string().optional(),
      website: z.string().optional(),
      industry: z.string().optional(),
      address_line1: z.string().optional(),
      address_line2: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      pincode: z.string().optional(),
      country: z.string().optional(),
      contacts: z.array(z.object({
        name: z.string(),
        role: z.string(),
        phone: z.string(),
        email: z.string(),
      })).optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const [created] = await ctx.db.insert(clients).values({
        ...input,
        email: input.email || null,
        contacts: input.contacts ?? [],
        created_by: ctx.profile.id,
      }).returning()
      return created
    }),

  // Update client
  update: moderatorProcedure
    .input(z.object({
      id: z.string().uuid(),
      company_name: z.string().min(1).optional(),
      contact_person: z.string().optional(),
      email: z.string().email().optional().or(z.literal('')),
      phone: z.string().optional(),
      alt_phone: z.string().optional(),
      gst_number: z.string().optional(),
      pan_number: z.string().optional(),
      website: z.string().optional(),
      industry: z.string().optional(),
      address_line1: z.string().optional(),
      address_line2: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      pincode: z.string().optional(),
      country: z.string().optional(),
      contacts: z.array(z.object({
        name: z.string(),
        role: z.string(),
        phone: z.string(),
        email: z.string(),
      })).optional(),
      notes: z.string().optional(),
      status: z.enum(['active', 'inactive']).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input
      const [updated] = await ctx.db.update(clients)
        .set({ ...data, email: data.email || null, updated_at: new Date() })
        .where(eq(clients.id, id))
        .returning()
      return updated
    }),

  // Delete client (admin only, soft delete)
  delete: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db.update(clients)
        .set({ status: 'inactive', updated_at: new Date() })
        .where(eq(clients.id, input.id))
        .returning()
      return updated
    }),

  // Lightweight list for selectors/dropdowns
  listForSelect: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.select({
      id: clients.id,
      company_name: clients.company_name,
      contact_person: clients.contact_person,
      phone: clients.phone,
      email: clients.email,
    }).from(clients)
      .where(eq(clients.status, 'active'))
      .orderBy(clients.company_name)
  }),
})
