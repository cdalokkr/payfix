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
import { kioskDevicesRouter } from './kiosk-devices'
import { pushRouter } from './push'
import { salaryRouter } from './salary'
import { clientsRouter } from './clients'
import { complaintsRouter } from './complaints'
import { ticketsRouter } from './tickets'
import { superadminRouter } from './superadmin'

export const appRouter = router({
  auth: authRouter,
  profile: profileRouter,
  superadmin: superadminRouter,
  admin: router({
    users: adminUsersRouter,
    dashboard: adminDashboardRouter,
    analytics: adminAnalyticsRouter,
    reports: adminReportsRouter,
    designation: designationRouter,
    officeLocations: officeLocationsRouter,
    kioskDevices: kioskDevicesRouter,
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
  kioskDevices: kioskDevicesRouter,
  push: pushRouter,
  // Complaint & Ticket Management
  clients: clientsRouter,
  complaints: complaintsRouter,
  tickets: ticketsRouter,
})


export type AppRouter = typeof appRouter





