// ============================================
// lib/auth/client-context.ts
// Client-safe authentication functions for use in client components
// ============================================

// Global session cache for client-side use (memory-based for performance)
interface ClientSessionCache {
  userId: string
  expiresAt: number
}

const clientSessionCache = new Map<string, ClientSessionCache>()
const CLIENT_CACHE_TTL = 5 * 60 * 1000 // 5 minutes
const CLIENT_CACHE_PREFIX = 'client:'

// Client-safe session cache operations
export function invalidateClientSessions(): void {
  clientSessionCache.clear()
}

export function invalidateClientSession(userId: string): void {
  const cacheKey = CLIENT_CACHE_PREFIX + userId
  clientSessionCache.delete(cacheKey)
}

// Set client cache
export function setClientCache(userId: string): void {
  const cacheKey = CLIENT_CACHE_PREFIX + userId
  clientSessionCache.set(cacheKey, {
    userId,
    expiresAt: Date.now() + CLIENT_CACHE_TTL
  })
}

// Get client cache
export function getClientCache(userId: string): ClientSessionCache | null {
  const cacheKey = CLIENT_CACHE_PREFIX + userId
  const cached = clientSessionCache.get(cacheKey)
  
  if (cached && Date.now() < cached.expiresAt) {
    return cached
  }
  
  // Clean up expired cache
  if (cached) {
    clientSessionCache.delete(cacheKey)
  }
  
  return null
}

// Legacy function for backward compatibility with existing imports
export function invalidateAllSessions(): void {
  invalidateClientSessions()
}