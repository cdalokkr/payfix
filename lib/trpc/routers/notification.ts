// ============================================
// lib/trpc/routers/notification.ts
// ============================================
import { z } from 'zod'
import { router, protectedProcedure } from '../server'

export const notificationRouter = router({
  getAll: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.supabase) {
      throw new Error('Database service unavailable')
    }
    
    const { data } = await ctx.supabase
      .from('notifications')
      .select('*')
      .eq('user_id', ctx.user.id)
      .order('created_at', { ascending: false })
      .limit(20)

    return data || []
  }),

  getUnreadCount: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.supabase) {
      throw new Error('Database service unavailable')
    }
    
    const { count } = await ctx.supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', ctx.user.id)
      .eq('is_read', false)

    return count || 0
  }),

  markAsRead: protectedProcedure
    .input(z.object({ notificationId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.supabase) {
        throw new Error('Database service unavailable')
      }
      
      const { error } = await ctx.supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', input.notificationId)
        .eq('user_id', ctx.user.id)

      if (error) throw new Error(error.message)
      return { success: true }
    }),

  markAllAsRead: protectedProcedure.mutation(async ({ ctx }) => {
    if (!ctx.supabase) {
      throw new Error('Database service unavailable')
    }
    
    const { error } = await ctx.supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', ctx.user.id)
      .eq('is_read', false)

    if (error) throw new Error(error.message)
    return { success: true }
  }),
})