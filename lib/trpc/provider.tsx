// ============================================
// lib/trpc/provider.tsx
// Optimized for Next.js 16 with enhanced caching
// ============================================
'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { httpBatchLink } from '@trpc/client'
import { useState } from 'react'
import { trpc } from './client'

// Create a stable query client with optimized settings
function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Increase stale time for better caching (30 seconds)
        staleTime: 30 * 1000,
        // Cache time - how long to keep data in cache after it becomes unused (5 minutes)
        gcTime: 5 * 60 * 1000,
        // Don't refetch on window focus for better UX
        refetchOnWindowFocus: false,
        // Don't refetch on reconnect unless data is stale
        refetchOnReconnect: 'always',
        // Retry failed requests up to 2 times
        retry: 2,
        // Exponential backoff for retries
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
        // Enable structural sharing for better performance
        structuralSharing: true,
      },
      mutations: {
        // Disable retries for mutations to prevent duplicate calls on error (like 403 Forbidden)
        retry: false,
      },
    },
  })
}

// Browser-side query client singleton
let browserQueryClient: QueryClient | undefined = undefined

function getQueryClient() {
  if (typeof window === 'undefined') {
    // Server: always make a new query client
    return makeQueryClient()
  } else {
    // Browser: make a new query client if we don't already have one
    // This is important for React Suspense boundaries
    if (!browserQueryClient) browserQueryClient = makeQueryClient()
    return browserQueryClient
  }
}

export function TRPCProvider({ children }: { children: React.ReactNode }) {
  // Use the singleton pattern for query client
  const queryClient = getQueryClient()

  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({
          url: '/api/trpc',
          // Enable request batching for better performance
          maxURLLength: 2083,
          fetch: (input, init) => fetch(input, {
            ...init,
            credentials: 'include',
            // Add cache hints for browser caching
            cache: 'default',
          }),
          // Batch requests within 10ms window
          headers: () => ({
            'x-trpc-source': 'client',
          }),
        }),
      ],
    })
  )

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </trpc.Provider>
  )
}