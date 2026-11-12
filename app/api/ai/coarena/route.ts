import { NextRequest, NextResponse } from 'next/server'
import { coarena } from '@/lib/ai'

/**
 * GET /api/ai/coarena
 * Returns list of available models from Coarena
 */
export async function GET() {
  try {
    const models = await coarena.listModels()
    return NextResponse.json({ success: true, models })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch models' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/ai/coarena
 * Executes a chat completion or text generation via Coarena
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    // Support single prompt shorthand { prompt, model, system, temperature }
    if (body.prompt && typeof body.prompt === 'string') {
      const result = await coarena.generateText(body.prompt, {
        system: body.system,
        model: body.model,
        temperature: body.temperature,
        max_tokens: body.max_tokens,
      })

      return NextResponse.json({
        success: true,
        text: result.text,
        requestId: result.requestId,
        model: result.model,
        usage: result.usage,
      })
    }

    // Support standard OpenAI messages payload { messages, model, temperature, ... }
    if (Array.isArray(body.messages)) {
      const completion = await coarena.createChatCompletion({
        model: body.model,
        messages: body.messages,
        temperature: body.temperature,
        max_tokens: body.max_tokens,
        max_completion_tokens: body.max_completion_tokens,
        stream: body.stream,
        response_format: body.response_format,
      })

      return NextResponse.json(completion)
    }

    return NextResponse.json(
      { success: false, error: 'Invalid payload. Provide either `prompt` or `messages`.' },
      { status: 400 }
    )
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Chat completion request failed' },
      { status: 500 }
    )
  }
}
