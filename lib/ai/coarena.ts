/**
 * Coarena Model API Client for PayFix
 *
 * Provides full support for:
 * - OpenAI-compatible endpoints (base URL: https://coarena.ai/api/v1)
 * - Anthropic-compatible endpoints (base URL: https://coarena.ai/api)
 * - Model discovery via https://coarena.ai/api/v1/models
 * - Response feedback & rating via POST https://coarena.ai/api/v1/feedback
 */

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
  name?: string
}

export interface ChatCompletionOptions {
  model?: string
  messages: ChatMessage[]
  temperature?: number
  max_tokens?: number
  max_completion_tokens?: number
  stream?: boolean
  response_format?: { type: 'text' | 'json_object' }
  timeoutMs?: number
}

export interface ChatCompletionResponse {
  id: string
  object: string
  created: number
  model: string
  choices: Array<{
    index: number
    message: {
      role: 'assistant'
      content: string
      refusal?: string | null
    }
    finish_reason: string
    logprobs?: any
  }>
  usage?: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
    prompt_tokens_details?: Record<string, any>
    completion_tokens_details?: Record<string, any>
  }
  system_fingerprint?: string | null
  requestId: string
}

export interface AnthropicMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface AnthropicCreateMessageOptions {
  model?: string
  max_tokens?: number
  system?: string
  messages: AnthropicMessage[]
  temperature?: number
  timeoutMs?: number
}

export interface AnthropicMessageResponse {
  id: string
  type: string
  role: string
  model: string
  content: Array<{
    type: 'text'
    text: string
  }>
  stop_reason: string | null
  stop_sequence?: string | null
  usage?: {
    input_tokens: number
    output_tokens: number
    [key: string]: any
  }
  requestId: string
}

export interface ModelInfo {
  id: string
  object: string
  display_name?: string
  owned_by?: string
  type?: string
  created?: number
  created_at?: string
  lifecycle?: string
  max_input_tokens?: number
  max_tokens?: number
  context_length?: number
  max_completion_tokens?: number
  description?: string
  pricing?: { prompt: string; completion: string }
  capabilities?: {
    vision?: boolean
    tools?: boolean
    json_schema?: boolean
    reasoning_text?: boolean
    efforts?: string[]
  }
  aliases?: string[]
}

export type FeedbackRating = 'up' | 'down' | 'good' | 'bad' | 1 | -1 | boolean | null

export const FEEDBACK_TAGS = [
  'correct',
  'helpful',
  'fast',
  'wrong',
  'unhelpful',
  'refused',
  'too_slow',
  'bad_format',
  'unsafe',
  'concise',
  'thorough',
  'creative',
  'good_code',
  'followed_instructions',
  'made_up',
  'incomplete',
  'too_long',
  'off_topic',
  'bad_code',
  'ignored_instructions',
] as const

export type FeedbackTag = (typeof FEEDBACK_TAGS)[number]

export interface FeedbackOptions {
  request_id: string
  rating: FeedbackRating
  note?: string
  tags?: FeedbackTag[]
  timeoutMs?: number
}

export interface FeedbackResponse {
  request_id: string
  rating: string
  note: string | null
  tags: string[]
  updated_at: number
}

export interface GenerateTextResult {
  text: string
  requestId: string
  model: string
  usage?: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
  rate: (rating: FeedbackRating, note?: string) => Promise<FeedbackResponse>
}

export interface CoarenaConfig {
  apiKey?: string
  openAiBaseUrl?: string
  anthropicBaseUrl?: string
  defaultModel?: string
  timeoutMs?: number
}

export class CoarenaClient {
  private apiKey: string
  private openAiBaseUrl: string
  private anthropicBaseUrl: string
  private defaultModel: string
  private timeoutMs: number

  constructor(config: CoarenaConfig = {}) {
    this.apiKey =
      config.apiKey ||
      process.env.COARENA_API_KEY ||
      process.env.OPENAI_API_KEY ||
      'coa_41031e31310eacb4a558d53e22b65a9e'

    this.openAiBaseUrl = (
      config.openAiBaseUrl ||
      process.env.COARENA_OPENAI_BASE_URL ||
      process.env.OPENAI_BASE_URL ||
      'https://coarena.ai/api/v1'
    ).replace(/\/+$/, '')

    this.anthropicBaseUrl = (
      config.anthropicBaseUrl ||
      process.env.COARENA_ANTHROPIC_BASE_URL ||
      process.env.ANTHROPIC_BASE_URL ||
      'https://coarena.ai/api'
    ).replace(/\/+$/, '')

    this.defaultModel =
      config.defaultModel ||
      process.env.COARENA_DEFAULT_MODEL ||
      'gemini-3-8-flash'

    this.timeoutMs = config.timeoutMs || 30000
  }

  /**
   * List all available models from Coarena
   */
  async listModels(options: { timeoutMs?: number } = {}): Promise<ModelInfo[]> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs || this.timeoutMs)

    try {
      const response = await fetch(`${this.openAiBaseUrl}/models`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Accept': 'application/json',
        },
        signal: controller.signal,
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Coarena listModels failed [${response.status}]: ${errorText}`)
      }

      const data = await response.json()
      return (data.data || []) as ModelInfo[]
    } finally {
      clearTimeout(timeout)
    }
  }

  /**
   * OpenAI-compatible Chat Completion (POST https://coarena.ai/api/v1/chat/completions)
   */
  async createChatCompletion(options: ChatCompletionOptions): Promise<ChatCompletionResponse> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs || this.timeoutMs)

    const payload = {
      model: options.model || this.defaultModel,
      messages: options.messages,
      ...(options.temperature !== undefined ? { temperature: options.temperature } : {}),
      ...(options.max_tokens !== undefined ? { max_tokens: options.max_tokens } : {}),
      ...(options.max_completion_tokens !== undefined ? { max_completion_tokens: options.max_completion_tokens } : {}),
      ...(options.stream !== undefined ? { stream: options.stream } : {}),
      ...(options.response_format !== undefined ? { response_format: options.response_format } : {}),
    }

    try {
      const response = await fetch(`${this.openAiBaseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      })

      const headerRequestId = response.headers.get('x-coarena-request-id')

      if (!response.ok) {
        const errorData = await response.text()
        throw new Error(`Coarena chat completion failed [${response.status}]: ${errorData}`)
      }

      const data = await response.json()
      const requestId = headerRequestId || data.id || ''

      return {
        ...data,
        requestId,
      }
    } finally {
      clearTimeout(timeout)
    }
  }

  /**
   * Anthropic-compatible Messages (POST https://coarena.ai/api/v1/messages)
   */
  async createAnthropicMessage(options: AnthropicCreateMessageOptions): Promise<AnthropicMessageResponse> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs || this.timeoutMs)

    // In Anthropic standard SDK convention, if baseUrl is https://coarena.ai/api,
    // the messages route is at /v1/messages
    const messagesUrl = this.anthropicBaseUrl.endsWith('/v1')
      ? `${this.anthropicBaseUrl}/messages`
      : `${this.anthropicBaseUrl}/v1/messages`

    const payload = {
      model: options.model || this.defaultModel,
      max_tokens: options.max_tokens || 1024,
      ...(options.system ? { system: options.system } : {}),
      messages: options.messages,
      ...(options.temperature !== undefined ? { temperature: options.temperature } : {}),
    }

    try {
      const response = await fetch(messagesUrl, {
        method: 'POST',
        headers: {
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      })

      const headerRequestId = response.headers.get('x-coarena-request-id')

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Coarena Anthropic message failed [${response.status}]: ${errorText}`)
      }

      const data = await response.json()
      const requestId = headerRequestId || data.id || ''

      return {
        ...data,
        requestId,
      }
    } finally {
      clearTimeout(timeout)
    }
  }

  /**
   * Submit feedback / rating for an AI reply
   * POST https://coarena.ai/api/v1/feedback
   */
  async sendFeedback(options: FeedbackOptions): Promise<FeedbackResponse> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs || this.timeoutMs)

    const payload = {
      request_id: options.request_id,
      rating: options.rating,
      ...(options.note !== undefined ? { note: options.note } : {}),
      ...(options.tags !== undefined ? { tags: options.tags } : {}),
    }

    try {
      const response = await fetch(`${this.openAiBaseUrl}/feedback`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Coarena feedback failed [${response.status}]: ${errorText}`)
      }

      return (await response.json()) as FeedbackResponse
    } finally {
      clearTimeout(timeout)
    }
  }

  /**
   * High-level helper: Generate text prompt response and return text + easy rate() helper
   */
  async generateText(
    prompt: string,
    options: {
      system?: string
      model?: string
      temperature?: number
      max_tokens?: number
      timeoutMs?: number
    } = {}
  ): Promise<GenerateTextResult> {
    const messages: ChatMessage[] = []
    if (options.system) {
      messages.push({ role: 'system', content: options.system })
    }
    messages.push({ role: 'user', content: prompt })

    const res = await this.createChatCompletion({
      model: options.model || this.defaultModel,
      messages,
      temperature: options.temperature,
      max_tokens: options.max_tokens,
      timeoutMs: options.timeoutMs,
    })

    const text = res.choices[0]?.message?.content || ''
    const requestId = res.requestId

    return {
      text,
      requestId,
      model: res.model,
      usage: res.usage
        ? {
            prompt_tokens: res.usage.prompt_tokens,
            completion_tokens: res.usage.completion_tokens,
            total_tokens: res.usage.total_tokens,
          }
        : undefined,
      rate: (rating: FeedbackRating, note?: string) =>
        this.sendFeedback({
          request_id: requestId,
          rating,
          note,
        }),
    }
  }

  /**
   * High-level helper: Generate structured JSON response
   */
  async generateJSON<T>(
    prompt: string,
    options: {
      system?: string
      model?: string
      temperature?: number
      timeoutMs?: number
    } = {}
  ): Promise<{
    data: T
    rawText: string
    requestId: string
    rate: (rating: FeedbackRating, note?: string) => Promise<FeedbackResponse>
  }> {
    const systemPrompt = [
      options.system || 'You are an accurate structured JSON generator.',
      'Respond ONLY with valid, raw JSON (no markdown formatting, no code fences, no prefix/suffix).',
    ].join('\n')

    const result = await this.generateText(prompt, {
      ...options,
      system: systemPrompt,
      temperature: options.temperature ?? 0.1,
    })

    let cleanJson = result.text.trim()
    if (cleanJson.startsWith('```json')) {
      cleanJson = cleanJson.replace(/^```json\s*/, '').replace(/\s*```$/, '')
    } else if (cleanJson.startsWith('```')) {
      cleanJson = cleanJson.replace(/^```\s*/, '').replace(/\s*```$/, '')
    }

    try {
      const parsed = JSON.parse(cleanJson) as T
      return {
        data: parsed,
        rawText: result.text,
        requestId: result.requestId,
        rate: result.rate,
      }
    } catch (parseError: any) {
      throw new Error(
        `Failed to parse JSON response from model ${result.model}: ${parseError.message}\nRaw text:\n${result.text}`
      )
    }
  }

  /**
   * Specialized helper: Summarize long text or audit/attendance records
   */
  async summarize(
    text: string,
    options: {
      maxLengthWords?: number
      model?: string
      timeoutMs?: number
    } = {}
  ): Promise<GenerateTextResult> {
    const prompt = `Please provide a clear and concise summary of the following text in under ${
      options.maxLengthWords || 100
    } words:\n\n${text}`

    return this.generateText(prompt, {
      system: 'You are an executive assistant for a SaaS HR & Payroll system. Provide crisp, professional summaries.',
      model: options.model || this.defaultModel,
      timeoutMs: options.timeoutMs,
    })
  }

  /**
   * Specialized helper: Auto-triage a customer or employee complaint/ticket
   */
  async triageComplaint(complaint: {
    subject: string
    description: string
  }): Promise<{
    category: 'billing' | 'technical' | 'service' | 'product' | 'general'
    priority: 'low' | 'medium' | 'high' | 'critical'
    summary: string
    suggestedResolution: string
    requestId: string
  }> {
    const prompt = `Analyze this complaint:
Subject: ${complaint.subject}
Description: ${complaint.description}

Categorize it and recommend priority and next steps in valid JSON format:
{
  "category": "billing" | "technical" | "service" | "product" | "general",
  "priority": "low" | "medium" | "high" | "critical",
  "summary": "Short 1-sentence summary",
  "suggestedResolution": "Actionable step-by-step resolution advice"
}`

    const res = await this.generateJSON<{
      category: 'billing' | 'technical' | 'service' | 'product' | 'general'
      priority: 'low' | 'medium' | 'high' | 'critical'
      summary: string
      suggestedResolution: string
    }>(prompt, {
      system: 'You are an automated support triage AI for PayFix HR & Payroll platform.',
    })

    return {
      ...res.data,
      requestId: res.requestId,
    }
  }
}

// Export singleton instance initialized with standard environment variables
export const coarena = new CoarenaClient()
