'use client'

import { catchError, type ErrorInfo } from 'next/error'

function NextErrorFallback(
  { title = 'This section could not load' }: { title?: string },
  { error, retry }: ErrorInfo,
) {
  const digest =
    typeof error === 'object' &&
    error !== null &&
    'digest' in error &&
    typeof error.digest === 'string'
      ? error.digest
      : undefined

  return (
    <div
      className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm"
      role="alert"
      aria-live="assertive"
    >
      <h2 className="font-semibold text-foreground">{title}</h2>
      <p className="mt-1 text-muted-foreground">
        Please try again. Your workspace data was not changed.
      </p>
      {digest ? (
        <p className="mt-2 font-mono text-xs text-muted-foreground">
          Reference: {digest}
        </p>
      ) : null}
      <button
        type="button"
        className="mt-3 rounded-md bg-primary px-3 py-2 font-medium text-primary-foreground hover:bg-primary/90"
        onClick={() => retry()}
      >
        Try again
      </button>
    </div>
  )
}

export const NextErrorBoundary = catchError(NextErrorFallback)

export default NextErrorBoundary