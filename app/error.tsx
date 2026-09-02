'use client'

import { useEffect } from 'react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Route rendering error:', error)
  }, [error])

  return (
    <main className="flex min-h-[60vh] items-center justify-center px-6 py-16">
      <div className="w-full max-w-lg rounded-2xl border border-destructive/30 bg-background p-8 text-center shadow-sm">
        <h1 className="text-2xl font-semibold text-foreground">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          We could not load this page. Your workspace data is safe.
        </p>
        {error.digest ? (
          <p className="mt-3 font-mono text-xs text-muted-foreground">
            Reference: {error.digest}
          </p>
        ) : null}
        <button
          type="button"
          onClick={() => reset()}
          className="mt-6 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Try again
        </button>
      </div>
    </main>
  )
}