// ============================================
// app/api/trpc/[trpc]/route.ts
// Enhanced with security measures
// ============================================
import { fetchRequestHandler } from '@trpc/server/adapters/fetch'
import { appRouter } from '@/lib/trpc/routers'
import { createContext } from '@/lib/trpc/server'
import { runWithRequestHeaders } from '@/lib/tenant/with-context'

// Security headers for API responses
const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Cache-Control': 'no-store, no-cache, must-revalidate',
  'Pragma': 'no-cache',
}

// Error handler that doesn't leak sensitive information
function onError({ error, path }: { error: Error; path: string | undefined }) {
  // Log the full error server-side for debugging
  console.error(`[tRPC Error] ${path ?? 'unknown'}:`, {
    message: error.message,
    // Only log stack in development
    stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
  })
}

const handler = async (req: Request) => runWithRequestHeaders(async () => {
  // Validate request method
  const method = req.method
  if (!['GET', 'POST'].includes(method)) {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      {
        status: 405,
        headers: {
          'Content-Type': 'application/json',
          'Allow': 'GET, POST',
          ...SECURITY_HEADERS,
        },
      }
    )
  }

  // Handle the tRPC request
  const response = await fetchRequestHandler({
    endpoint: '/api/trpc',
    req,
    router: appRouter,
    createContext,
    onError,
    // Response metadata for security
    responseMeta() {
      return {
        headers: SECURITY_HEADERS,
      }
    },
  })

  // Add security headers to response
  const headers = new Headers(response.headers)
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    headers.set(key, value)
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
})

export { handler as GET, handler as POST }

// Explicitly disallow other methods
export function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Allow': 'GET, POST',
      ...SECURITY_HEADERS,
    },
  })
}

export function PUT() {
  return new Response(
    JSON.stringify({ error: 'Method not allowed' }),
    {
      status: 405,
      headers: {
        'Content-Type': 'application/json',
        'Allow': 'GET, POST',
        ...SECURITY_HEADERS,
      },
    }
  )
}

export function DELETE() {
  return new Response(
    JSON.stringify({ error: 'Method not allowed' }),
    {
      status: 405,
      headers: {
        'Content-Type': 'application/json',
        'Allow': 'GET, POST',
        ...SECURITY_HEADERS,
      },
    }
  )
}

export function PATCH() {
  return new Response(
    JSON.stringify({ error: 'Method not allowed' }),
    {
      status: 405,
      headers: {
        'Content-Type': 'application/json',
        'Allow': 'GET, POST',
        ...SECURITY_HEADERS,
      },
    }
  )
}
