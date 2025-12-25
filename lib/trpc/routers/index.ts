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
import { attendanceRouter } from './attendance'

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
    attendance: attendanceRouter,
  }),
  notification: notificationRouter,
  attendance: attendanceRouter,
})

export type AppRouter = typeof appRouter
