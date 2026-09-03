// ============================================
// lib/env.ts - Environment Variable Validation
// ============================================
import { z } from 'zod'

function isProductionApplicationUrl(value: string): boolean {
  try {
    const url = new URL(value)
    const hostname = url.hostname.toLowerCase()
    const localHostnames = new Set(['localhost', '127.0.0.1', '::1'])

    return (
      url.protocol === 'https:' &&
      !url.username &&
      !url.password &&
      !localHostnames.has(hostname) &&
      !hostname.endsWith('.local') &&
      !hostname.endsWith('.replit.dev')
    )
  } catch {
    return false
  }
}

function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === 'https:'
  } catch {
    return false
  }
}

const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
}).superRefine((values, ctx) => {
  // Keep test and development imports usable without deployment secrets.
  if (values.NODE_ENV === 'production') {
    for (const name of [
      'NEXT_PUBLIC_SUPABASE_URL',
      'NEXT_PUBLIC_SUPABASE_ANON_KEY',
      'SUPABASE_SERVICE_ROLE_KEY',
    ] as const) {
      if (!values[name]) {
        ctx.addIssue({
          code: 'custom',
          path: [name],
          message: `${name} is required in production`,
        })
      }
    }

    if (
      values.NEXT_PUBLIC_SUPABASE_URL &&
      !isHttpsUrl(values.NEXT_PUBLIC_SUPABASE_URL)
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['NEXT_PUBLIC_SUPABASE_URL'],
        message: 'NEXT_PUBLIC_SUPABASE_URL must use HTTPS in production',
      })
    }

    if (
      values.NEXT_PUBLIC_APP_URL &&
      !isProductionApplicationUrl(values.NEXT_PUBLIC_APP_URL)
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['NEXT_PUBLIC_APP_URL'],
        message: 'NEXT_PUBLIC_APP_URL must be an HTTPS production URL',
      })
    }
  }
})

export const env = envSchema.parse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  NODE_ENV: process.env.NODE_ENV,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
})
