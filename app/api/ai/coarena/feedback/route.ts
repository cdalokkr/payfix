import { NextRequest, NextResponse } from 'next/server'
import { coarena } from '@/lib/ai'

/**
 * POST /api/ai/coarena/feedback
 * Submit rating/feedback for an AI response
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    if (!body.request_id) {
      return NextResponse.json(
        { success: false, error: 'request_id is required' },
        { status: 400 }
      )
    }

    if (body.rating === undefined) {
      return NextResponse.json(
        { success: false, error: 'rating is required (up, down, good, bad, 1, -1)' },
        { status: 400 }
      )
    }

    const result = await coarena.sendFeedback({
      request_id: body.request_id,
      rating: body.rating,
      note: body.note,
      tags: body.tags,
    })

    return NextResponse.json({ success: true, feedback: result })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Feedback submission failed' },
      { status: 500 }
    )
  }
}
