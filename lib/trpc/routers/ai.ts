// ============================================
// lib/trpc/routers/ai.ts
// AI Integration Router powered by Coarena Model API
// ============================================
import { router, protectedProcedure, publicProcedure } from '../server'
import { z } from 'zod'
import { coarena, FEEDBACK_TAGS } from '@/lib/ai'
import { TRPCError } from '@trpc/server'

export const aiRouter = router({
  /**
   * List available models from Coarena
   */
  models: publicProcedure.query(async () => {
    try {
      const models = await coarena.listModels()
      return models
    } catch (error: any) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: error.message || 'Failed to retrieve models from Coarena',
      })
    }
  }),

  /**
   * Simple text prompt completion
   */
  generate: protectedProcedure
    .input(
      z.object({
        prompt: z.string().min(1),
        system: z.string().optional(),
        model: z.string().optional(),
        temperature: z.number().min(0).max(2).optional(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const result = await coarena.generateText(input.prompt, {
          system: input.system,
          model: input.model,
          temperature: input.temperature,
        })
        return {
          text: result.text,
          requestId: result.requestId,
          model: result.model,
          usage: result.usage,
        }
      } catch (error: any) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message || 'AI generation failed',
        })
      }
    }),

  /**
   * Multi-turn chat completion
   */
  chat: protectedProcedure
    .input(
      z.object({
        messages: z.array(
          z.object({
            role: z.enum(['system', 'user', 'assistant']),
            content: z.string(),
          })
        ),
        model: z.string().optional(),
        temperature: z.number().min(0).max(2).optional(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const result = await coarena.createChatCompletion({
          messages: input.messages,
          model: input.model,
          temperature: input.temperature,
        })
        return {
          text: result.choices[0]?.message?.content || '',
          requestId: result.requestId,
          model: result.model,
          usage: result.usage,
        }
      } catch (error: any) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message || 'AI chat completion failed',
        })
      }
    }),

  /**
   * Auto-summarize content (notes, reports, ticket logs)
   */
  summarize: protectedProcedure
    .input(
      z.object({
        text: z.string().min(1),
        maxLengthWords: z.number().min(10).max(1000).optional(),
        model: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const result = await coarena.summarize(input.text, {
          maxLengthWords: input.maxLengthWords,
          model: input.model,
        })
        return {
          summary: result.text,
          requestId: result.requestId,
          model: result.model,
        }
      } catch (error: any) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message || 'AI summarization failed',
        })
      }
    }),

  /**
   * Triage a complaint or ticket
   */
  triageComplaint: protectedProcedure
    .input(
      z.object({
        subject: z.string().min(1),
        description: z.string().min(1),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const result = await coarena.triageComplaint(input)
        return result
      } catch (error: any) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message || 'AI complaint triage failed',
        })
      }
    }),

  /**
   * Submit rating & feedback for an AI reply
   */
  rateReply: protectedProcedure
    .input(
      z.object({
        requestId: z.string().min(1),
        rating: z.enum(['up', 'down', 'good', 'bad']),
        note: z.string().optional(),
        tags: z.array(z.enum(FEEDBACK_TAGS)).optional(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const feedback = await coarena.sendFeedback({
          request_id: input.requestId,
          rating: input.rating,
          note: input.note,
          tags: input.tags,
        })
        return feedback
      } catch (error: any) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message || 'Failed to submit feedback rating',
        })
      }
    }),
})
