// ============================================
// lib/cache/cache-debug.ts
// ============================================

import { smartCacheManager } from './smart-cache-manager'
import { cacheInvalidation } from './cache-invalidation'
import { backgroundRefresher } from './background-refresher'

export interface CacheDebugInfo {
  timestamp: string
  cacheStats: ReturnType<typeof smartCacheManager.getStats>
  backgroundRefreshStatus: ReturnType<typeof backgroundRefresher.getRefreshStatus>
  invalidationEvents: ReturnType<typeof cacheInvalidation.getEventHistory>
  cacheEntries: Array<{
    key: string
    namespace: string
    size: number
    timestamp: number
    compressed: boolean
    metadata?: Record<string, unknown>
  }>
  smartInvalidationInProgress: boolean
  performanceMetrics: {
    operationStartTime: number
    currentOperation?: string
    operationHistory: Array<{
      operation: string
      startTime: number
      endTime?: number
      duration?: number
    }>
  }
}

// Global debug state
const debugState: Partial<CacheDebugInfo> = {
  timestamp: new Date().toISOString(),
  smartInvalidationInProgress: false,
  performanceMetrics: {
    operationStartTime: Date.now(),
    operationHistory: []
  }
}

// Initialize global cache debugging
export function initializeCacheDebugging(): void {
  // Make debugging functions available globally for console access
  if (typeof window !== 'undefined') {
    (window as any).smartCacheDebug = {
      getState: getCacheDebugState,
      getStats: () => smartCacheManager.getStats(),
      getCacheEntries: getAllCacheEntries,
      testPerformance: testCachePerformance,
      monitorOperations: startOperationMonitoring,
      clearCache: clearAllCaches,
      simulateSmartInvalidation: simulateSmartInvalidation,
      checkCacheIntegrity: checkCacheIntegrity,
      exportDebugData: exportDebugData
    }
  }

  console.log('🔍 Cache debugging utilities initialized')
  console.log('💡 Available commands: smartCacheDebug.*')
}

// Get comprehensive cache debug state
export function getCacheDebugState(): CacheDebugInfo {
  const cacheStats = smartCacheManager.getStats()
  const backgroundStatus = backgroundRefresher.getRefreshStatus()
  const invalidationEvents = cacheInvalidation.getEventHistory(50) // Last 50 events
  
  return {
    timestamp: new Date().toISOString(),
    cacheStats,
    backgroundRefreshStatus: backgroundStatus,
    invalidationEvents,
    cacheEntries: getAllCacheEntries(),
    smartInvalidationInProgress: debugState.smartInvalidationInProgress || false,
    performanceMetrics: debugState.performanceMetrics || {
      operationStartTime: Date.now(),
      operationHistory: []
    }
  }
}

// Get all cache entries with detailed information
export function getAllCacheEntries() {
  const entries = smartCacheManager.getAllEntries()
  return entries.map(entry => ({
    key: entry.key,
    namespace: entry.namespace,
    size: entry.size,
    timestamp: entry.timestamp,
    compressed: entry.compressed,
    metadata: entry.metadata
  })).sort((a, b) => b.timestamp - a.timestamp)
}

// Test cache performance
export async function testCachePerformance(): Promise<{
  testName: string
  duration: number
  success: boolean
  details?: any
}> {
  const startTime = Date.now()
  const testName = 'Cache Performance Test'

  console.group(`🧪 ${testName}`)

  try {
    // Test 1: Cache hit performance
    await smartCacheManager.set('performance-test', { test: 'data' }, {
      namespace: 'test',
      metadata: { testType: 'performance' }
    })

    const hitStartTime = Date.now()
    await smartCacheManager.get('performance-test', 'test')
    const hitDuration = Date.now() - hitStartTime

    // Test 2: Cache miss performance
    const missStartTime = Date.now()
    await smartCacheManager.get('non-existent-key', 'test')
    const missDuration = Date.now() - missStartTime

    // Test 3: Bulk operations
    const bulkStartTime = Date.now()
    for (let i = 0; i < 10; i++) {
      await smartCacheManager.set(`bulk-test-${i}`, { index: i }, {
        namespace: 'test',
        metadata: { bulkTest: true }
      })
    }
    const bulkDuration = Date.now() - bulkStartTime

    // Cleanup
    smartCacheManager.delete('performance-test', 'test')
    for (let i = 0; i < 10; i++) {
      smartCacheManager.delete(`bulk-test-${i}`, 'test')
    }

    const totalDuration = Date.now() - startTime

    console.log('📊 Performance Results:', {
      cacheHit: `${hitDuration}ms`,
      cacheMiss: `${missDuration}ms`,
      bulkSet10: `${bulkDuration}ms`,
      total: `${totalDuration}ms`
    })

    console.groupEnd()

    return {
      testName,
      duration: totalDuration,
      success: true,
      details: {
        cacheHit: hitDuration,
        cacheMiss: missDuration,
        bulkSet10: bulkDuration
      }
    }

  } catch (error) {
    console.error('❌ Performance test failed:', error)
    console.groupEnd()
    
    return {
      testName,
      duration: Date.now() - startTime,
      success: false,
      details: {
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }
}

// Start operation monitoring
export function startOperationMonitoring(): void {
  const originalSet = smartCacheManager.set.bind(smartCacheManager)
  const originalDelete = smartCacheManager.delete.bind(smartCacheManager)

  // Wrap set method
  smartCacheManager.set = async (key: string, data: any, options?: any) => {
    const operation = `set(${key})`
    const startTime = Date.now()
    
    console.log(`🚀 Cache Operation Started: ${operation}`)
    addOperationToHistory(operation, startTime)

    try {
      const result = await originalSet(key, data, options)
      const duration = Date.now() - startTime
      
      console.log(`✅ Cache Operation Completed: ${operation} (${duration}ms)`)
      updateOperationInHistory(operation, startTime, duration)
      
      return result
    } catch (error) {
      const duration = Date.now() - startTime
      console.error(`❌ Cache Operation Failed: ${operation} (${duration}ms)`, error)
      updateOperationInHistory(operation, startTime, duration, error instanceof Error ? error : undefined)
      throw error
    }
  }

  // Wrap delete method
  smartCacheManager.delete = (key: string, namespace?: string) => {
    const operation = `delete(${key}${namespace ? `, ${namespace}` : ''})`
    const startTime = Date.now()
    
    console.log(`🗑️ Cache Operation Started: ${operation}`)
    addOperationToHistory(operation, startTime)

    try {
      const result = originalDelete(key, namespace)
      const duration = Date.now() - startTime
      
      console.log(`✅ Cache Operation Completed: ${operation} (${duration}ms)`)
      updateOperationInHistory(operation, startTime, duration)
      
      return result
    } catch (error) {
      const duration = Date.now() - startTime
      console.error(`❌ Cache Operation Failed: ${operation} (${duration}ms)`, error)
      updateOperationInHistory(operation, startTime, duration, error instanceof Error ? error : undefined)
      throw error
    }
  }

  console.log('📊 Cache operation monitoring started')
}

// Clear all caches with logging
export function clearAllCaches(): void {
  console.group('🧹 Clearing All Caches')
  
  const statsBefore = smartCacheManager.getStats()
  console.log('📊 Cache state before clearing:', {
    totalEntries: statsBefore.totalEntries,
    totalSize: `${(statsBefore.totalSize / 1024).toFixed(2)}KB`
  })

  smartCacheManager.clear()

  const statsAfter = smartCacheManager.getStats()
  console.log('✅ Cache cleared successfully')
  console.log('📊 Cache state after clearing:', {
    totalEntries: statsAfter.totalEntries,
    totalSize: `${(statsAfter.totalSize / 1024).toFixed(2)}KB`
  })

  console.groupEnd()
}

// Simulate smart invalidation for testing
export async function simulateSmartInvalidation(): Promise<void> {
  console.group('🎯 Simulating Smart Invalidation')

  // Set up test data
  await smartCacheManager.set('comprehensive-dashboard-data', {
    testData: 'This should be preserved',
    timestamp: Date.now()
  }, {
    namespace: 'dashboard',
    metadata: { prefetched: true }
  })

  await smartCacheManager.set('critical-dashboard-data', {
    testData: 'This should be invalidated',
    timestamp: Date.now()
  }, {
    namespace: 'dashboard',
    metadata: { testType: 'critical' }
  })

  await smartCacheManager.set('stats', {
    testData: 'This should also be invalidated',
    timestamp: Date.now()
  }, {
    namespace: 'dashboard',
    metadata: { testType: 'stats' }
  })

  console.log('📦 Test data created')

  // Simulate smart invalidation logic
  debugState.smartInvalidationInProgress = true
  console.log('🎯 Smart invalidation started')

  // Delete only critical data (simulating the real logic)
  smartCacheManager.delete('critical-dashboard-data', 'dashboard')
  smartCacheManager.delete('stats', 'dashboard')
  
  // Preserve comprehensive data
  const comprehensiveData = await smartCacheManager.get('comprehensive-dashboard-data', 'dashboard')
  console.log('✅ Comprehensive data preserved:', !!comprehensiveData)

  debugState.smartInvalidationInProgress = false
  console.log('✅ Smart invalidation simulation completed')
  console.groupEnd()
}

// Check cache integrity
export function checkCacheIntegrity(): {
  issues: Array<{ type: string; message: string; details?: any }>
  summary: {
    totalEntries: number
    compressedEntries: number
    entriesWithMetadata: number
    recentEntries: number
  }
} {
  console.group('🔍 Checking Cache Integrity')

  const entries = getAllCacheEntries()
  const issues: Array<{ type: string; message: string; details?: any }> = []

  // Check for common issues
  entries.forEach(entry => {
    // Check if entry is too old
    const ageMs = Date.now() - entry.timestamp
    if (ageMs > 24 * 60 * 60 * 1000) { // 24 hours
      issues.push({
        type: 'stale-entry',
        message: `Entry ${entry.key} is older than 24 hours`,
        details: { age: `${(ageMs / (60 * 60 * 1000)).toFixed(1)} hours` }
      })
    }

    // Check if metadata is missing
    if (!entry.metadata) {
      issues.push({
        type: 'missing-metadata',
        message: `Entry ${entry.key} has no metadata`,
        details: { key: entry.key }
      })
    }

    // Check compression efficiency
    if (entry.compressed && entry.size < 100) {
      issues.push({
        type: 'inefficient-compression',
        message: `Entry ${entry.key} might not benefit from compression`,
        details: { size: entry.size }
      })
    }
  })

  const summary = {
    totalEntries: entries.length,
    compressedEntries: entries.filter(e => e.compressed).length,
    entriesWithMetadata: entries.filter(e => e.metadata).length,
    recentEntries: entries.filter(e => Date.now() - e.timestamp < 60 * 60 * 1000).length // Last hour
  }

  if (issues.length === 0) {
    console.log('✅ Cache integrity check passed - no issues found')
  } else {
    console.log(`⚠️ Found ${issues.length} integrity issues:`, issues)
  }

  console.log('📊 Cache summary:', summary)
  console.groupEnd()

  return { issues, summary }
}

// Export debug data for analysis
export function exportDebugData(): string {
  const debugData = {
    ...getCacheDebugState(),
    exportedAt: new Date().toISOString(),
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
    url: typeof window !== 'undefined' ? window.location.href : 'unknown'
  }

  const jsonString = JSON.stringify(debugData, null, 2)
  
  // Try to download as file
  if (typeof window !== 'undefined' && window.URL && window.document) {
    const blob = new Blob([jsonString], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `cache-debug-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return jsonString
}

// Helper functions for operation monitoring
function addOperationToHistory(operation: string, startTime: number): void {
  if (!debugState.performanceMetrics) {
    debugState.performanceMetrics = {
      operationStartTime: Date.now(),
      operationHistory: []
    }
  }

  debugState.performanceMetrics.operationHistory.push({
    operation,
    startTime,
    endTime: undefined,
    duration: undefined
  })

  // Keep only last 100 operations
  if (debugState.performanceMetrics.operationHistory.length > 100) {
    debugState.performanceMetrics.operationHistory = 
      debugState.performanceMetrics.operationHistory.slice(-100)
  }
}

function updateOperationInHistory(
  operation: string, 
  startTime: number, 
  duration: number, 
  error?: Error
): void {
  if (!debugState.performanceMetrics) return

  const history = debugState.performanceMetrics.operationHistory
  const latestOperation = history.find(op => 
    op.operation === operation && op.startTime === startTime && !op.endTime
  )

  if (latestOperation) {
    latestOperation.endTime = Date.now()
    latestOperation.duration = duration
  }
}

// Initialize debugging when module is imported
initializeCacheDebugging()

export { debugState }