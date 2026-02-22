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
import { salaryRouter } from './salary'

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
    salary: salaryRouter,
  }),
  moderator: router({
    reports: moderatorReportsRouter,
    attendance: attendanceRouter,
    salary: salaryRouter,
  }),
  notification: notificationRouter,
  attendance: attendanceRouter,
  salary: salaryRouter,
  mpin: mpinRouter,
  officeLocations: officeLocationsRouter,
  push: pushRouter,
})

export type AppRouter = typeof appRouter




