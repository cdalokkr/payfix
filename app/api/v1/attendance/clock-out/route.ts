import { NextRequest, NextResponse } from 'next/server'
import { validateBearerToken } from '@/lib/security/auth-middleware'
import { AttendanceService } from '@/lib/services/attendance.service'
import { invalidateDashboardCache } from '@/lib/trpc/routers/admin-dashboard-optimized'
import { broadcastServerEvent } from '@/lib/events/server-broadcaster'
import { getLocalDateIST } from '@/lib/utils/date-utils'
import { db } from '@/lib/db'
import { profiles, notifications } from '@/lib/db/schema'
import { eq, or } from 'drizzle-orm'
import { withTenantContext } from '@/lib/tenant/with-context'

export const POST = withTenantContext(async (req: NextRequest) => {
    try {
        const authHeader = req.headers.get('Authorization')
        const { user, profile } = await validateBearerToken(authHeader)

        const body = await req.json().catch(() => ({}))
        const { localDate } = body

        const result = await AttendanceService.clockOut({
            profileId: profile.id,
            fullName: profile.full_name || undefined,
            email: profile.email,
            localDate
        })

        // Invalidate dashboard cache immediately on server
        invalidateDashboardCache()

        // Broadcast sync event to all clients
        broadcastServerEvent('dashboard_sync', {
            action: 'clock-out',
            userId: profile.id
        }, profile.id)

        // Broadcast attendance-specific event for real-time updates
        broadcastServerEvent('attendance_update', {
            action: 'clock-out',
            employeeId: profile.id,
            employeeName: profile.full_name,
            date: localDate || getLocalDateIST(),
            recordId: result.id
        }, profile.id)

        // Send notifications to admins and moderators
        const adminModerators = await db.query.profiles.findMany({
            where: or(eq(profiles.role, 'admin'), eq(profiles.role, 'moderator')),
            columns: { id: true, role: true }
        })

        await Promise.all(adminModerators.map(async (adminUser) => {
            const role = adminUser.role || 'admin'
            const link = role === 'admin' ? '/admin/payroll/attendance' : '/moderator/payroll/attendance'
            const title = 'Employee Clocked Out'
            const message = `${profile.full_name || profile.email} has clocked out`

            // Insert notification to DB
            await db.insert(notifications).values({
                user_id: adminUser.id,
                title,
                message,
                type: 'attendance',
                link
            })

            // Broadcast notification to specific admin
            broadcastServerEvent('new_notification', {
                title,
                message,
                type: 'attendance',
                link,
                targetUserId: adminUser.id
            }, adminUser.id)
        }))

        return NextResponse.json({
            success: true,
            message: 'Clocked out successfully',
            attendance: result
        })
    } catch (err: any) {
        console.error('[API-V1-CLOCKOUT] error:', err)
        return NextResponse.json(
            { error: err.message || 'Internal Server Error' },
            { status: err.message?.includes('header') || err.message?.includes('token') ? 401 : 400 }
        )
    }
}
