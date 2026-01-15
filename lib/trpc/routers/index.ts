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
import { mpinRouter } from './mpin'
import { officeLocationsRouter } from './office-locations'
import { pushRouter } from './push'

export const appRouter = router({
  auth: authRouter,
  profile: profileRouter,
  admin: router({
    users: adminUsersRouter,
    dashboard: adminDashboardRouter,
    analytics: adminAnalyticsRouter,
    reports: adminReportsRouter,
    designation: designationRouter,
    officeLocations: officeLocationsRouter,
  }),
  moderator: router({
    reports: moderatorReportsRouter,
    attendance: attendanceRouter,
  }),
  notification: notificationRouter,
  attendance: attendanceRouter,
  mpin: mpinRouter,
  officeLocations: officeLocationsRouter,
  push: pushRouter,
})

export type AppRouter = typeof appRouter



