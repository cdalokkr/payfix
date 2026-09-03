import { validateEnvironmentOnStartup } from '@/lib/security/env-validation'

export function register() {
  // Edge workers do not need the server-only secret check. Node startup is
  // the authoritative gate for the Next.js runtime and must fail closed in
  // production before the first request can reach the application.
  if (process.env.NEXT_RUNTIME !== 'edge') {
    validateEnvironmentOnStartup()
  }
}