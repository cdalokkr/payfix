import { NextRequest, NextResponse } from 'next/server'
import { validateBearerToken } from '@/lib/security/auth-middleware'
import { LeavesService } from '@/lib/services/leaves.service'

export async function GET(req: NextRequest) {
    try {
        const authHeader = req.headers.get('Authorization')
        const { user, profile } = await validateBearerToken(authHeader)

        // Fetch balances
        const records = await LeavesService.getLeaves({
            profileId: profile.id,
            role: profile.role,
            status: 'all'
        })

        // Standard balance calculations (e.g. 18 days allocated)
        const totalAllocated = 18
        const approvedCount = records
            .filter(r => r.status === 'approved')
            .reduce((sum, r) => {
                const start = new Date(r.start_date)
                const end = new Date(r.end_date)
                const diffTime = Math.abs(end.getTime() - start.getTime())
                let diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1
                if (r.is_half_day) diffDays = 0.5
                return sum + diffDays
            }, 0)

        const pendingCount = records
            .filter(r => r.status === 'pending')
            .reduce((sum, r) => {
                const start = new Date(r.start_date)
                const end = new Date(r.end_date)
                const diffTime = Math.abs(end.getTime() - start.getTime())
                let diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1
                if (r.is_half_day) diffDays = 0.5
                return sum + diffDays
            }, 0)

        const remaining = Math.max(0, totalAllocated - approvedCount)

        return NextResponse.json({
            success: true,
            balances: {
                totalAllocated,
                approved: approvedCount,
                pending: pendingCount,
                remaining
            }
        })
    } catch (err: any) {
        console.error('[API-V1-LEAVEBALANCES] error:', err)
        return NextResponse.json(
            { error: err.message || 'Internal Server Error' },
            { status: err.message?.includes('header') || err.message?.includes('token') ? 401 : 400 }
        )
    }
}
