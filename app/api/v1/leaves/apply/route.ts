import { NextRequest, NextResponse } from 'next/server'
import { validateBearerToken } from '@/lib/security/auth-middleware'
import { LeavesService } from '@/lib/services/leaves.service'

export async function POST(req: NextRequest) {
    try {
        const authHeader = req.headers.get('Authorization')
        const { user, profile } = await validateBearerToken(authHeader)

        const body = await req.json().catch(() => ({}))
        const { leaveType, startDate, endDate, isHalfDay, halfDayPeriod, reason } = body

        if (!startDate || !endDate) {
            return NextResponse.json(
                { error: 'Start date and end date are required.' },
                { status: 400 }
            )
        }

        const result = await LeavesService.applyLeave({
            profileId: profile.id,
            leaveType,
            startDate,
            endDate,
            isHalfDay,
            halfDayPeriod,
            reason
        })

        return NextResponse.json({
            success: true,
            message: 'Leave applied successfully',
            leave: result
        })
    } catch (err: any) {
        console.error('[API-V1-LEAVEAPPLY] error:', err)
        return NextResponse.json(
            { error: err.message || 'Internal Server Error' },
            { status: err.message?.includes('header') || err.message?.includes('token') ? 401 : 400 }
        )
    }
}
