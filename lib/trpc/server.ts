// ============================================
// lib/trpc/server.ts
// Performance-optimized tRPC server with async session management
// ============================================
import { initTRPC, TRPCError } from '@trpc/server'
import { createOptimizedContext } from '@/lib/auth/optimized-context'
import { getAuthPerformanceStats } from '@/lib/auth/optimized-context'
import { db } from '@/lib/db'
import type { Profile } from '@/types'
import { cache } from 'react'

let createContextCallCount = 0
const authCallTimes: number[] = []
const MAX_AUTH_TIMES = 100

export const createContext = cache(async () => {
  createContextCallCount++
  const startTime = performance.now()

  try {
    const context = await createOptimizedContext()

    // Record timing for performance monitoring
    const duration = performance.now() - startTime
    authCallTimes.push(duration)
    if (authCallTimes.length > MAX_AUTH_TIMES) {
      authCallTimes.shift()
    }

    // Log performance metrics
    if (process.env.NODE_ENV === 'development' && duration > 100) {
      console.log(`[AUTH-PERF] createContext #${createContextCallCount}: ${duration.toFixed(2)}ms`, {
        duration,
        cacheHit: context.metrics.cacheHit,
        userFound: context.metrics.userFound,
        profileFound: context.metrics.profileFound,
        contextSize: context.metrics.contextSize
      })
    }

    return {
      supabase: context.supabase,
      db: db,
      user: context.user,
      profile: context.profile,
      performance: {
        contextCreationTime: duration,
        cacheHit: context.metrics.cacheHit,
        userFound: context.metrics.userFound,
        profileFound: context.metrics.profileFound,
        totalMetrics: context.metrics
      }
    }
  } catch (error) {
    const duration = performance.now() - startTime
    console.error(`[AUTH-PERF] createContext #${createContextCallCount} failed:`, {
      duration,
      error: error instanceof Error ? error.message : 'Unknown error'
    })

    return {
      supabase: null,
      db: db,
      user: null,
      profile: null,
      performance: {
        contextCreationTime: duration,
        cacheHit: false,
        userFound: false,
        profileFound: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }
})

export type Context = Awaited<ReturnType<typeof createContext>>

const t = initTRPC.context<Context>().create({
  errorFormatter({ shape, error }) {
    // Extract performance data from error cause safely
    let performance = {
      contextTime: 0,
      cacheHit: false,
      timestamp: Date.now()
    }

    if (error.cause && typeof error.cause === 'object' && 'performance' in error.cause) {
      const cause = error.cause as any
      performance = {
        contextTime: cause.performance?.contextCreationTime || 0,
        cacheHit: cause.performance?.cacheHit || false,
        timestamp: Date.now()
      }
    }

    return {
      ...shape,
      data: {
        ...shape.data,
        performance
      }
    }
  }
})

export const router = t.router
export const publicProcedure = t.procedure
export const createCallerFactory = t.createCallerFactory

export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  // Performance check - warn if context creation was slow
  if (ctx.performance?.contextCreationTime > 200) {
    console.warn(`[AUTH-PROC] Slow context in protectedProcedure: ${ctx.performance.contextCreationTime.toFixed(2)}ms`)
  }

  if (!ctx.user || !ctx.profile) {
    // Differentiate between true unauthorized and transient DB issues
    if (ctx.user && !ctx.profile) {
      console.warn('[AUTH-PROC] User authenticated but profile missing - possible DB connection issue');
    }

    if (process.env.NODE_ENV === 'development') {
      console.log('DEBUG: protectedProcedure - throwing UNAUTHORIZED', {
        userFound: !!ctx.user,
        profileFound: !!ctx.profile,
        contextTime: ctx.performance?.contextCreationTime
      })
    }
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: ctx.user ? 'Profile temporarily unavailable - please try again' : undefined,
      cause: { performance: ctx.performance }
    })
  }

  // Check user status for defense-in-depth
  if (ctx.profile.status === 'deactive') {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Your account has been deactivated.',
      cause: { performance: ctx.performance }
    })
  }

  return next({
    ctx: {
      ...ctx,
      db: ctx.db,
      user: ctx.user,
      profile: ctx.profile,
      performance: ctx.performance
    }
  })
})

export const adminProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  if (ctx.profile.role !== 'admin') {
    throw new TRPCError({
      code: 'FORBIDDEN',
      cause: {
        performance: ctx.performance,
        userRole: ctx.profile.role,
        requiredRole: 'admin'
      }
    })
  }
  return next({ ctx })
})

export const moderatorProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  if (ctx.profile.role !== 'admin' && ctx.profile.role !== 'moderator') {
    throw new TRPCError({
      code: 'FORBIDDEN',
      cause: {
        performance: ctx.performance,
        userRole: ctx.profile.role,
        requiredRole: 'moderator/admin'
      }
    })
  }
  return next({ ctx })
})

// Performance monitoring utilities for tRPC procedures
export function getTRPCPerformanceStats() {
  const authStats = getAuthPerformanceStats()
  const avgAuthTime = authCallTimes.length > 0
    ? authCallTimes.reduce((sum, time) => sum + time, 0) / authCallTimes.length
    : 0

  const slowAuthCalls = authCallTimes.filter(time => time > 500).length

  return {
    ...authStats,
    tRPCStats: {
      averageContextCreationTime: avgAuthTime,
      slowContextCreations: slowAuthCalls,
      totalContextCreations: createContextCallCount
    }
  }
}

// Log performance summary (can be called periodically)
export function logPerformanceSummary() {
  const stats = getTRPCPerformanceStats()
  console.log('[AUTH-PERF] Summary:', {
    totalContextCreations: stats.totalContextCreations,
    averageContextTime: stats.averageContextTime.toFixed(2) + 'ms',
    cacheHitRate: stats.cacheHitRate.toFixed(1) + '%',
    slowContextCreations: stats.tRPCStats.slowContextCreations,
    cacheSize: stats.cacheSize
  })
}
