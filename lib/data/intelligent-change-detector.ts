// ============================================
// lib/data/intelligent-change-detector.ts
// Intelligent Change Detection for Data Updates
// ============================================

export interface ChangeDetectionConfig {
  enableDeepComparison: boolean
  enableStructuralDiff: boolean
  enableValueDiff: boolean
  enablePerformanceTracking: boolean
  batchSize: number
  debounceTime: number
  maxHistorySize: number
}

export interface ChangeContext {
  dataType: string
  userId?: string
  sessionId?: string
  source: 'user-action' | 'server-push' | 'background-refresh' | 'manual'
  priority: 'critical' | 'important' | 'normal' | 'low'
  requiresImmediateUpdate: boolean
}

export interface ChangeDetectionResult {
  hasChanges: boolean
  changeType: 'added' | 'modified' | 'removed' | 'structure-change' | 'no-change'
  changes: ChangeSummary[]
  performanceImpact: {
    detectionTime: number
    memoryUsed: number
    comparisonDepth: number
  }
  suggestions: string[]
  nextCheckDelay: number
}

export interface ChangeSummary {
  path: string
  previousValue: unknown
  currentValue: unknown
  changeType: 'added' | 'modified' | 'removed' | 'structure-change'
  severity: 'low' | 'medium' | 'high' | 'critical'
  impact: string
  recommendation?: string
}

export interface DataVersion {
  version: string
  timestamp: number
  checksum: string
  size: number
  changes: ChangeSummary[]
  metadata: Record<string, unknown>
}

export interface ChangeHistory {
  current: DataVersion
  previous: DataVersion[]
  trends: {
    frequency: 'high' | 'medium' | 'low'
    stability: number // 0-1 score
    pattern: string
  }
}

class IntelligentChangeDetector {
  private static instance: IntelligentChangeDetector
  private config: ChangeDetectionConfig
  private changeHistory: Map<string, ChangeHistory> = new Map()
  private pendingChecks: Map<string, {
    data: unknown
    context: ChangeContext
    resolve: (result: ChangeDetectionResult) => void
    reject: (error: Error) => void
    timestamp: number
  }> = new Map()
  private performanceMetrics: Map<string, {
    totalChecks: number
    averageTime: number
    memoryUsage: number
    changeFrequency: number
  }> = new Map()

  private constructor(config: Partial<ChangeDetectionConfig> = {}) {
    this.config = {
      enableDeepComparison: true,
      enableStructuralDiff: true,
      enableValueDiff: true,
      enablePerformanceTracking: true,
      batchSize: 50,
      debounceTime: 100,
      maxHistorySize: 10,
      ...config
    }
  }

  static getInstance(config?: Partial<ChangeDetectionConfig>): IntelligentChangeDetector {
    if (!IntelligentChangeDetector.instance) {
      IntelligentChangeDetector.instance = new IntelligentChangeDetector(config)
    }
    return IntelligentChangeDetector.instance
  }

  /**
   * Detect changes between current and previous data with intelligent optimization
   */
  async detectChanges(
    currentData: unknown,
    previousData: unknown,
    context: ChangeContext
  ): Promise<ChangeDetectionResult> {
    const startTime = Date.now()
    const key = this.generateDataKey(context)

    try {
      // Debounce rapid changes for the same data type
      await this.debounceCheck(key)

      // Quick shallow comparison first for performance
      if (!this.config.enableDeepComparison) {
        return this.quickComparison(currentData, previousData, startTime, context)
      }

      // Structural comparison for object/array data
      if (this.shouldDoStructuralComparison(currentData, previousData)) {
        return this.structuralComparison(currentData, previousData, startTime, context)
      }

      // Deep comparison for complex data structures
      return this.deepComparison(currentData, previousData, startTime, context)
    } catch (error) {
      console.error(`Change detection failed for ${key}:`, error)
      return this.createErrorResult(error as Error, startTime, context)
    }
  }

  /**
   * Batch detect changes for multiple datasets
   */
  async batchDetectChanges(
    datasets: Array<{
      current: unknown
      previous: unknown
      context: ChangeContext
    }>
  ): Promise<Record<string, ChangeDetectionResult>> {
    const results: Record<string, ChangeDetectionResult> = {}
    const batchSize = Math.min(this.config.batchSize, datasets.length)

    for (let i = 0; i < datasets.length; i += batchSize) {
      const batch = datasets.slice(i, i + batchSize)
      const batchPromises = batch.map(({ current, previous, context }) =>
        this.detectChanges(current, previous, context)
      )

      try {
        const batchResults = await Promise.allSettled(batchPromises)
        
        batchResults.forEach((result, index) => {
          const dataKey = this.generateDataKey(batch[index].context)
          if (result.status === 'fulfilled') {
            results[dataKey] = result.value
          } else {
            console.warn(`Batch change detection failed for ${dataKey}:`, result.reason)
            results[dataKey] = this.createErrorResult(result.reason as Error, Date.now(), batch[index].context)
          }
        })
      } catch (error) {
        console.error('Batch change detection error:', error)
      }
    }

    return results
  }

  /**
   * Subscribe to changes for real-time detection
   */
  subscribeToChanges(
    dataType: string,
    callback: (result: ChangeDetectionResult) => void,
    context: Partial<ChangeContext> = {}
  ): () => void {
    const fullContext: ChangeContext = {
      dataType,
      source: 'background-refresh',
      priority: 'normal',
      requiresImmediateUpdate: false,
      ...context
    } as ChangeContext

    const subscriptionKey = `${dataType}:${Date.now()}:${Math.random()}`
    
    // This would integrate with your real-time system
    // For now, using a simple interval-based check
    const intervalId = setInterval(async () => {
      try {
        const currentData = await this.fetchCurrentData(dataType)
        const history = this.changeHistory.get(dataType)
        const previousData = history?.current ? history.current : null
        
        const result = await this.detectChanges(currentData, previousData, fullContext)
        if (result.hasChanges) {
          callback(result)
        }
      } catch (error) {
        console.error(`Real-time change detection failed for ${dataType}:`, error)
      }
    }, this.calculateOptimalInterval(dataType))

    return () => {
      clearInterval(intervalId)
      this.pendingChecks.delete(subscriptionKey)
    }
  }

  /**
   * Get change history and trends
   */
  getChangeHistory(dataType: string): ChangeHistory | null {
    return this.changeHistory.get(dataType) || null
  }

  /**
   * Get performance metrics for change detection
   */
  getPerformanceMetrics(dataType?: string): Record<string, unknown> {
    if (dataType) {
      return this.performanceMetrics.get(dataType) || {}
    }
    
    return Object.fromEntries(this.performanceMetrics)
  }

  /**
   * Quick shallow comparison for performance
   */
  private quickComparison(
    current: unknown,
    previous: unknown,
    startTime: number,
    context: ChangeContext
  ): ChangeDetectionResult {
    const isEqual = this.shallowEqual(current, previous)
    const detectionTime = Date.now() - startTime

    return {
      hasChanges: !isEqual,
      changeType: isEqual ? 'no-change' : 'modified',
      changes: isEqual ? [] : [{
        path: 'root',
        previousValue: previous,
        currentValue: current,
        changeType: 'modified',
        severity: 'medium',
        impact: 'Data structure changed',
        recommendation: 'Perform deep comparison for detailed changes'
      }],
      performanceImpact: {
        detectionTime,
        memoryUsed: 0,
        comparisonDepth: 1
      },
      suggestions: isEqual ? ['Data is stable'] : ['Consider deep comparison for detailed analysis'],
      nextCheckDelay: this.calculateNextCheckDelay(context.priority, isEqual)
    }
  }

  /**
   * Structural comparison for object/array data
   */
  private structuralComparison(
    current: unknown,
    previous: unknown,
    startTime: number,
    context: ChangeContext
  ): ChangeDetectionResult {
    const currentType = this.getDataType(current)
    const previousType = this.getDataType(previous)
    
    const detectionTime = Date.now() - startTime
    const changes: ChangeSummary[] = []

    // Check for type changes
    if (currentType !== previousType) {
      changes.push({
        path: 'type',
        previousValue: previousType,
        currentValue: currentType,
        changeType: 'structure-change',
        severity: 'high',
        impact: `Data type changed from ${previousType} to ${currentType}`
      })
    }

    // Check for size changes in arrays/objects
    if ((currentType === 'array' || currentType === 'object') && 
        (previousType === 'array' || previousType === 'object')) {
      const sizeChange = this.getDataSize(current) - this.getDataSize(previous)
      if (Math.abs(sizeChange) > 0) {
        changes.push({
          path: 'size',
          previousValue: this.getDataSize(previous),
          currentValue: this.getDataSize(current),
          changeType: sizeChange > 0 ? 'added' : 'removed',
          severity: 'low',
          impact: `Data size changed by ${sizeChange} items`
        })
      }
    }

    return {
      hasChanges: changes.length > 0,
      changeType: changes.length === 0 ? 'no-change' : 
                  changes.some(c => c.changeType === 'structure-change') ? 'structure-change' :
                  changes.some(c => c.changeType === 'added') ? 'added' : 'modified',
      changes,
      performanceImpact: {
        detectionTime,
        memoryUsed: this.calculateMemoryUsage(current, previous),
        comparisonDepth: 2
      },
      suggestions: this.generateStructureSuggestions(changes, context),
      nextCheckDelay: this.calculateNextCheckDelay(context.priority, changes.length === 0)
    }
  }

  /**
   * Deep comparison for comprehensive change detection
   */
  private deepComparison(
    current: unknown,
    previous: unknown,
    startTime: number,
    context: ChangeContext
  ): ChangeDetectionResult {
    const changes: ChangeSummary[] = []
    const visited = new Set<unknown>()
    const pathStack: string[] = []

    this.traverseAndCompare(current, previous, pathStack, changes, visited, 0)

    const detectionTime = Date.now() - startTime
    const hasChanges = changes.length > 0

    return {
      hasChanges,
      changeType: this.determineChangeType(changes),
      changes,
      performanceImpact: {
        detectionTime,
        memoryUsed: this.calculateMemoryUsage(current, previous),
        comparisonDepth: pathStack.length
      },
      suggestions: this.generateDeepSuggestions(changes, context),
      nextCheckDelay: this.calculateNextCheckDelay(context.priority, hasChanges)
    }
  }

  /**
   * Traverse and compare data structures recursively
   */
  private traverseAndCompare(
    current: unknown,
    previous: unknown,
    pathStack: string[],
    changes: ChangeSummary[],
    visited: Set<unknown>,
    depth: number
  ): void {
    if (depth > 10) return // Prevent infinite recursion
    if (visited.has(current) || visited.has(previous)) return

    const currentPath = pathStack.join('.')
    const currentType = this.getDataType(current)
    const previousType = this.getDataType(previous)

    // Handle type changes
    if (currentType !== previousType) {
      changes.push({
        path: currentPath || 'root',
        previousValue: previous,
        currentValue: current,
        changeType: 'structure-change',
        severity: this.calculateSeverity(previous, current, currentPath),
        impact: `Type changed from ${previousType} to ${currentType}`,
        recommendation: 'Check data schema compatibility'
      })
      return
    }

    // Handle primitive values
    if (this.isPrimitive(current) && this.isPrimitive(previous)) {
      if (!this.deepEqual(current, previous)) {
        changes.push({
          path: currentPath || 'root',
          previousValue: previous,
          currentValue: current,
          changeType: 'modified',
          severity: this.calculateSeverity(previous, current, currentPath),
          impact: `Value changed from ${String(previous)} to ${String(current)}`
        })
      }
      return
    }

    // Handle arrays
    if (currentType === 'array' && previousType === 'array') {
      const currentArray = current as unknown[]
      const previousArray = previous as unknown[]
      const maxLength = Math.max(currentArray.length, previousArray.length)

      for (let i = 0; i < maxLength; i++) {
        pathStack.push(`[${i}]`)
        
        if (i >= previousArray.length) {
          changes.push({
            path: pathStack.join('.'),
            previousValue: undefined,
            currentValue: currentArray[i],
            changeType: 'added',
            severity: 'low',
            impact: `New element added at index ${i}`
          })
        } else if (i >= currentArray.length) {
          changes.push({
            path: pathStack.join('.'),
            previousValue: previousArray[i],
            currentValue: undefined,
            changeType: 'removed',
            severity: 'low',
            impact: `Element removed at index ${i}`
          })
        } else {
          this.traverseAndCompare(
            currentArray[i], 
            previousArray[i], 
            pathStack, 
            changes, 
            visited, 
            depth + 1
          )
        }
        
        pathStack.pop()
      }
      return
    }

    // Handle objects
    if (currentType === 'object' && previousType === 'object') {
      const currentObj = current as Record<string, unknown>
      const previousObj = previous as Record<string, unknown>
      const allKeys = new Set([...Object.keys(currentObj), ...Object.keys(previousObj)])

      for (const key of allKeys) {
        pathStack.push(key)
        
        if (!(key in previousObj)) {
          changes.push({
            path: pathStack.join('.'),
            previousValue: undefined,
            currentValue: currentObj[key],
            changeType: 'added',
            severity: 'low',
            impact: `New property '${key}' added`
          })
        } else if (!(key in currentObj)) {
          changes.push({
            path: pathStack.join('.'),
            previousValue: previousObj[key],
            currentValue: undefined,
            changeType: 'removed',
            severity: 'low',
            impact: `Property '${key}' removed`
          })
        } else {
          this.traverseAndCompare(
            currentObj[key], 
            previousObj[key], 
            pathStack, 
            changes, 
            visited, 
            depth + 1
          )
        }
        
        pathStack.pop()
      }
    }

    visited.add(current)
    visited.add(previous)
  }

  /**
   * Debounce rapid checks for the same data
   */
  private async debounceCheck(key: string): Promise<void> {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        this.pendingChecks.delete(key)
        resolve()
      }, this.config.debounceTime)
    })
  }

  /**
   * Generate data key for context
   */
  private generateDataKey(context: ChangeContext): string {
    return `${context.dataType}:${context.userId || 'anonymous'}:${context.source}`
  }

  /**
   * Quick shallow equality check
   */
  private shallowEqual(a: unknown, b: unknown): boolean {
    return a === b || JSON.stringify(a) === JSON.stringify(b)
  }

  /**
   * Deep equality check
   */
  private deepEqual(a: unknown, b: unknown): boolean {
    if (a === b) return true
    
    if (a instanceof Date && b instanceof Date) {
      return a.getTime() === b.getTime()
    }

    if (!a || !b || (typeof a !== 'object' && typeof b !== 'object')) {
      return a === b
    }

    if (a === null || a === undefined || b === null || b === undefined) {
      return false
    }

    if (a && b && typeof a === 'object' && typeof b === 'object' && 
        a.constructor !== b.constructor) return false

    const keys = Object.keys(a)
    if (keys.length !== Object.keys(b as Record<string, unknown>).length) {
      return false
    }

    return keys.every(k => this.deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]))
  }

  /**
   * Get data type string
   */
  private getDataType(data: unknown): string {
    if (data === null) return 'null'
    if (data === undefined) return 'undefined'
    if (Array.isArray(data)) return 'array'
    if (data instanceof Date) return 'date'
    return typeof data
  }

  /**
   * Check if value is primitive
   */
  private isPrimitive(value: unknown): boolean {
    return value === null || value === undefined || 
           typeof value === 'string' || typeof value === 'number' || 
           typeof value === 'boolean' || typeof value === 'symbol'
  }

  /**
   * Get data size (for arrays/objects)
   */
  private getDataSize(data: unknown): number {
    if (Array.isArray(data)) return data.length
    if (typeof data === 'object' && data !== null) return Object.keys(data).length
    return 1
  }

  /**
   * Calculate memory usage
   */
  private calculateMemoryUsage(...args: unknown[]): number {
    return args.reduce((total: number, arg) => total + JSON.stringify(arg).length, 0)
  }

  /**
   * Calculate severity of change
   */
  private calculateSeverity(previous: unknown, current: unknown, path: string): 'low' | 'medium' | 'high' | 'critical' {
    // Simple heuristic - can be made more sophisticated
    if (path.includes('id') || path.includes('status')) return 'high'
    if (path.includes('name') || path.includes('title')) return 'medium'
    return 'low'
  }

  /**
   * Determine overall change type
   */
  private determineChangeType(changes: ChangeSummary[]): ChangeDetectionResult['changeType'] {
    if (changes.length === 0) return 'no-change'
    
    const types = changes.map(c => c.changeType)
    if (types.includes('structure-change' as any)) return 'structure-change'
    if (types.includes('added' as any) && !types.includes('removed' as any) && !types.includes('modified' as any)) return 'added'
    if (types.includes('removed' as any) && !types.includes('added' as any) && !types.includes('modified' as any)) return 'removed'
    return 'modified'
  }

  /**
   * Check if structural comparison is needed
   */
  private shouldDoStructuralComparison(current: unknown, previous: unknown): boolean {
    const currentType = this.getDataType(current)
    const previousType = this.getDataType(previous)
    return (currentType === 'object' || currentType === 'array') && 
           (previousType === 'object' || previousType === 'array')
  }

  /**
   * Generate structure-based suggestions
   */
  private generateStructureSuggestions(changes: ChangeSummary[], context: ChangeContext): string[] {
    const suggestions: string[] = []
    
    if (changes.some(c => c.changeType === 'structure-change')) {
      suggestions.push('Data schema may have changed - review compatibility')
    }
    
    if (changes.some(c => c.changeType === 'added')) {
      suggestions.push('New data structure detected - update UI components if needed')
    }
    
    return suggestions
  }

  /**
   * Generate deep comparison suggestions
   */
  private generateDeepSuggestions(changes: ChangeSummary[], context: ChangeContext): string[] {
    const suggestions: string[] = []
    
    if (changes.length > 10) {
      suggestions.push('Large number of changes detected - consider batch processing')
    }
    
    const criticalChanges = changes.filter(c => c.severity === 'critical')
    if (criticalChanges.length > 0) {
      suggestions.push('Critical changes detected - immediate review recommended')
    }
    
    return suggestions
  }

  /**
   * Calculate optimal check interval
   */
  private calculateOptimalInterval(dataType: string): number {
    // Higher priority data gets more frequent checks
    const baseIntervals = {
      critical: 5000,    // 5 seconds
      important: 15000,  // 15 seconds
      normal: 60000,     // 1 minute
      low: 300000        // 5 minutes
    }
    
    // Return appropriate interval based on data type
    return baseIntervals.normal
  }

  /**
   * Calculate next check delay
   */
  private calculateNextCheckDelay(priority: ChangeContext['priority'], hasChanges: boolean): number {
    const baseDelay = {
      critical: 5000,
      important: 15000,
      normal: 60000,
      low: 300000
    }
    
    return hasChanges ? baseDelay[priority] * 0.5 : baseDelay[priority] * 2
  }

  /**
   * Create error result
   */
  private createErrorResult(error: Error, startTime: number, context: ChangeContext): ChangeDetectionResult {
    return {
      hasChanges: false,
      changeType: 'no-change',
      changes: [],
      performanceImpact: {
        detectionTime: Date.now() - startTime,
        memoryUsed: 0,
        comparisonDepth: 0
      },
      suggestions: [`Error during change detection: ${error.message}`],
      nextCheckDelay: 60000 // 1 minute delay on error
    }
  }

  /**
   * Fetch current data (placeholder implementation)
   */
  private async fetchCurrentData(dataType: string): Promise<unknown> {
    // This would integrate with your data fetching system
    return { dataType, timestamp: Date.now(), mock: true }
  }
}

export const intelligentChangeDetector = IntelligentChangeDetector.getInstance()