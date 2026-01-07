// ============================================
// lib/trpc/routers/notification.ts
// ============================================
import { z } from 'zod'
import { router, protectedProcedure } from '../server'
import { notifications } from '@/lib/db/schema'
import { eq, and, desc, count } from 'drizzle-orm'

export const notificationRouter = router({
  getAll: protectedProcedure
    .input(z.object({ limit: z.number().default(20), offset: z.number().default(0) }).optional())
    .query(async ({ ctx, input }) => {
      const data = await ctx.db.query.notifications.findMany({
        where: eq(notifications.user_id, ctx.user.id),
        orderBy: [desc(notifications.created_at)],
        limit: input?.limit || 20,
        offset: input?.offset || 0
      })
      return data || []
    }),

  getUnreadCount: protectedProcedure.query(async ({ ctx }) => {
    const result = await ctx.db.select({ value: count() })
      .from(notifications)
      .where(and(eq(notifications.user_id, ctx.user.id), eq(notifications.is_read, false)))
    return result[0].value || 0
  }),

  create: protectedProcedure
    .input(z.object({
      userId: z.string().uuid(),
      title: z.string(),
      message: z.string(),
      type: z.string().optional(),
      link: z.string().optional()
    }))
    .mutation(async ({ ctx, input }) => {
      const notification = await ctx.db.insert(notifications).values({
        user_id: input.userId,
        title: input.title,
        message: input.message,
        type: input.type,
        link: input.link
      }).returning()

      console.log('[NOTIFICATION] Created:', {
        userId: input.userId,
        title: input.title,
        type: input.type
      })

      return notification[0]
    }),

  markAsRead: protectedProcedure
    .input(z.object({ notificationId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.update(notifications)
        .set({ is_read: true })
        .where(and(eq(notifications.id, input.notificationId), eq(notifications.user_id, ctx.user.id)))
      return { success: true }
    }),

  markAllAsRead: protectedProcedure.mutation(async ({ ctx }) => {
    await ctx.db.update(notifications)
      .set({ is_read: true })
      .where(and(eq(notifications.user_id, ctx.user.id), eq(notifications.is_read, false)))
    return { success: true }
  }),
})