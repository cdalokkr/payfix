// ============================================
// lib/trpc/routers/index.ts
// ============================================
import { router } from '../server'
import { authRouter } from './auth'
import { profileRouter } from './profile'
import { adminUsersRouter } from './admin-users'
import { adminDashboardRouter } from './admin-dashboard-optimized'
import { adminAnalyticsRouter } from './admin-analytics'
import { adminReportsRouter } from './admin-reports'
import { moderatorReportsRouter } from './moderator-reports'
import { notificationRouter } from './notification'
import { designationRouter } from './designation'

export const appRouter = router({
  auth: authRouter,
  profile: profileRouter,
  admin: router({
    users: adminUsersRouter,
    dashboard: adminDashboardRouter,
    analytics: adminAnalyticsRouter,
    reports: adminReportsRouter,
    designation: designationRouter,
  }),
  moderator: router({
    reports: moderatorReportsRouter,
  }),
  notification: notificationRouter,
})

export type AppRouter = typeof appRouter
