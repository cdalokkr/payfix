'use client'

import { useEffect } from 'react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Global rendering error:', error)
  }, [error])

  return (
    <html lang="en">
      <body className="bg-slate-950 text-white">
        <main className="flex min-h-screen items-center justify-center px-6 py-16">
          <div className="w-full max-w-lg rounded-2xl border border-white/15 bg-white/5 p-8 text-center">
            <h1 className="text-2xl font-semibold">PayFix is temporarily unavailable</h1>
            <p className="mt-2 text-sm text-white/70">
              Please try again. No workspace data was changed.
            </p>
            {error.digest ? (
              <p className="mt-3 font-mono text-xs text-white/50">
                Reference: {error.digest}
              </p>
            ) : null}
            <button
              type="button"
              onClick={() => reset()}
              className="mt-6 rounded-lg bg-white px-4 py-2 text-sm font-medium text-slate-950 hover:bg-white/90"
            >
              Try again
            </button>
          </div>
        </main>
      </body>
    </html>
  )
}