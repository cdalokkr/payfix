// ============================================
// lib/data/data-transformation-pipeline.ts
// Efficient Data Transformation and Normalization
// ============================================

import { intelligentChangeDetector } from './intelligent-change-detector'

export interface TransformationConfig {
  enableParallelProcessing: boolean
  enableStreaming: boolean
  enableBatching: boolean
  enableCaching: boolean
  maxBatchSize: number
  maxConcurrency: number
  transformationTimeout: number
}

export interface TransformationContext {
  sourceType: string
  targetType: string
  userId?: string
  sessionId?: string
  priority: 'critical' | 'important' | 'normal' | 'low'
  deviceCapabilities: {
    memory: 'low' | 'medium' | 'high'
    processing: 'low' | 'medium' | 'high'
  }
}

export interface TransformationRule<T = unknown, U = unknown> {
  name: string
  sourceType: string
  targetType: string
  transform: (input: T, context: TransformationContext) => U | Promise<U>
  validate?: (input: T, output: U) => boolean
  priority: number
  reversible: boolean
  reverseTransform?: (output: U, context: TransformationContext) => T | Promise<T>
  metadata?: Record<string, unknown>
}

export interface TransformationResult<T = unknown> {
  data: T
  metadata: {
    transformationTime: number
    sourceType: string
    targetType: string
    ruleName: string
    size: number
    validationPassed: boolean
  }
  cacheKey?: string
  suggestions: string[]
}

export interface PipelineStep<T, U> {
  name: string
  rule: TransformationRule<T, U>
  enabled: boolean
  condition?: (data: T, context: TransformationContext) => boolean
}

class DataTransformationPipeline {
  private static instance: DataTransformationPipeline
  private config: TransformationConfig
  private transformationRules: Map<string, TransformationRule<unknown, unknown>> = new Map()
  private transformationCache: Map<string, {
    result: TransformationResult
    timestamp: number
    hitCount: number
  }> = new Map()
  private performanceMetrics: Map<string, {
    totalTransformations: number
    averageTime: number
    cacheHitRate: number
    errorRate: number
  }> = new Map()

  private constructor(config: Partial<TransformationConfig> = {}) {
    this.config = {
      enableParallelProcessing: true,
      enableStreaming: true,
      enableBatching: true,
      enableCaching: true,
      maxBatchSize: 100,
      maxConcurrency: 5,
      transformationTimeout: 10000,
      ...config
    }

    this.initializeDefaultRules()
  }

  static getInstance(config?: Partial<TransformationConfig>): DataTransformationPipeline {
    if (!DataTransformationPipeline.instance) {
      DataTransformationPipeline.instance = new DataTransformationPipeline(config)
    }
    return DataTransformationPipeline.instance
  }

  /**
   * Transform single data item with optimization
   */
  async transform<T = unknown, U = unknown>(
    data: T,
    sourceType: string,
    targetType: string,
    context: TransformationContext
  ): Promise<TransformationResult<U>> {
    const startTime = Date.now()
    const rule = this.findBestRule<T, U>(sourceType, targetType)

    if (!rule) {
      throw new Error(`No transformation rule found for ${sourceType} -> ${targetType}`)
    }

    try {
      // Check cache first if enabled
      const cacheKey = this.generateCacheKey(data, rule.name, context)
      if (this.config.enableCaching) {
        const cached = this.getCachedResult<U>(cacheKey)
        if (cached) {
          return cached
        }
      }

      // Apply transformation rule
      const transformedData = await this.applyRule(rule, data, context)
      
      // Validate if validator exists
      const validationPassed = rule.validate ? rule.validate(data, transformedData) : true
      
      const result: TransformationResult<U> = {
        data: transformedData,
        metadata: {
          transformationTime: Date.now() - startTime,
          sourceType,
          targetType,
          ruleName: rule.name,
          size: this.calculateSize(transformedData),
          validationPassed
        },
        cacheKey: this.config.enableCaching ? cacheKey : undefined,
        suggestions: this.generateTransformationSuggestions(rule, validationPassed)
      }

      // Cache result
      if (this.config.enableCaching) {
        this.cacheResult(cacheKey, result)
      }

      // Update performance metrics
      this.updateMetrics(rule.name, Date.now() - startTime, true)

      return result
    } catch (error) {
      console.error(`Transformation failed: ${sourceType} -> ${targetType}`, error)
      this.updateMetrics(rule.name, Date.now() - startTime, false)
      throw error
    }
  }

  /**
   * Batch transform multiple data items for efficiency
   */
  async batchTransform<T = unknown, U = unknown>(
    data: T[],
    sourceType: string,
    targetType: string,
    context: TransformationContext
  ): Promise<TransformationResult<U>[]> {
    const results: TransformationResult<U>[] = []
    const batchSize = this.calculateOptimalBatchSize(data.length)

    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize)
      
      if (this.config.enableParallelProcessing && batch.length > 1) {
        // Process in parallel for larger batches
        const batchPromises = batch.map(item => 
          this.transform<T, U>(item, sourceType, targetType, context)
        )
        
        try {
          const batchResults = await Promise.allSettled(batchPromises)
          batchResults.forEach((result, index) => {
            if (result.status === 'fulfilled') {
              results.push(result.value)
            } else {
              console.error(`Batch transformation failed for item ${i + index}:`, result.reason)
              // Add error placeholder
              results.push(this.createErrorResult<U>(result.reason as Error, sourceType, targetType))
            }
          })
        } catch (error) {
          console.error('Batch transformation error:', error)
        }
      } else {
        // Process sequentially for small batches
        for (const item of batch) {
          try {
            const result = await this.transform<T, U>(item, sourceType, targetType, context)
            results.push(result)
          } catch (error) {
            console.error('Sequential transformation failed:', error)
            results.push(this.createErrorResult<U>(error as Error, sourceType, targetType))
          }
        }
      }
    }

    return results
  }

  /**
   * Add custom transformation rule
   */
  addRule<T = unknown, U = unknown>(rule: TransformationRule<T, U>): void {
    const key = `${rule.sourceType}->${rule.targetType}:${rule.name}`
    this.transformationRules.set(key, rule as TransformationRule<unknown, unknown>)
  }

  /**
   * Get available transformation rules
   */
  getAvailableRules(sourceType?: string, targetType?: string): TransformationRule<unknown, unknown>[] {
    const rules = Array.from(this.transformationRules.values())
    
    if (sourceType) {
      return rules.filter(rule => rule.sourceType === sourceType)
    }
    
    if (targetType) {
      return rules.filter(rule => rule.targetType === targetType)
    }
    
    return rules
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics(ruleName?: string): Record<string, unknown> {
    if (ruleName) {
      return this.performanceMetrics.get(ruleName) || {}
    }
    
    return Object.fromEntries(this.performanceMetrics)
  }

  /**
   * Initialize default transformation rules
   */
  private initializeDefaultRules(): void {
    // Add common transformation rules
    this.addRule({
      name: 'normalize-user-data',
      sourceType: 'user-raw',
      targetType: 'user-normalized',
      transform: async (input, context) => {
        return this.normalizeUserData(input as any, context)
      },
      priority: 1,
      reversible: true,
      reverseTransform: async (output, context) => {
        return this.denormalizeUserData(output as any, context)
      }
    })

    this.addRule({
      name: 'aggregate-analytics',
      sourceType: 'analytics-raw',
      targetType: 'analytics-aggregated',
      transform: async (input, context) => {
        return this.aggregateAnalyticsData(input as any, context)
      },
      priority: 2,
      reversible: false
    })
  }

  /**
   * Find best transformation rule
   */
  private findBestRule<T, U>(sourceType: string, targetType: string): TransformationRule<T, U> | null {
    const matchingRules = Array.from(this.transformationRules.values())
      .filter(rule => rule.sourceType === sourceType && rule.targetType === targetType)
      .sort((a, b) => b.priority - a.priority)

    return matchingRules.length > 0 ? matchingRules[0] as TransformationRule<T, U> : null
  }

  /**
   * Apply transformation rule with timeout
   */
  private async applyRule<T, U>(rule: TransformationRule<T, U>, data: T, context: TransformationContext): Promise<U> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Transformation timeout')), this.config.transformationTimeout)
    })

    const transformationPromise = Promise.resolve(rule.transform(data, context))

    return Promise.race([transformationPromise, timeoutPromise])
  }

  /**
   * Generate cache key for transformation result
   */
  private generateCacheKey(data: unknown, ruleName: string, context: TransformationContext): string {
    const dataHash = this.simpleHash(JSON.stringify(data))
    const contextHash = this.simpleHash(JSON.stringify({
      userId: context.userId,
      deviceCapabilities: context.deviceCapabilities,
      priority: context.priority
    }))
    
    return `${ruleName}:${dataHash}:${contextHash}`
  }

  /**
   * Get cached transformation result
   */
  private getCachedResult<T>(cacheKey: string): TransformationResult<T> | null {
    const cached = this.transformationCache.get(cacheKey)
    
    if (cached && this.isCacheValid(cached)) {
      cached.hitCount++
      return cached.result as TransformationResult<T>
    }
    
    return null
  }

  /**
   * Cache transformation result
   */
  private cacheResult<T>(cacheKey: string, result: TransformationResult<T>): void {
    this.transformationCache.set(cacheKey, {
      result,
      timestamp: Date.now(),
      hitCount: 0
    })

    // Limit cache size
    if (this.transformationCache.size > 1000) {
      const oldestKey = this.transformationCache.keys().next().value
      if (oldestKey) {
        this.transformationCache.delete(oldestKey)
      }
    }
  }

  /**
   * Check if cached result is still valid
   */
  private isCacheValid(cached: { timestamp: number; result: TransformationResult }): boolean {
    const maxAge = 5 * 60 * 1000 // 5 minutes
    return (Date.now() - cached.timestamp) < maxAge
  }

  /**
   * Calculate optimal batch size
   */
  private calculateOptimalBatchSize(dataLength: number): number {
    if (!this.config.enableBatching) return 1
    
    const baseBatchSize = Math.min(this.config.maxBatchSize, dataLength)
    
    // Adjust based on data size and device capabilities
    return Math.max(1, Math.min(baseBatchSize, 10))
  }

  /**
   * Calculate data size in bytes
   */
  private calculateSize(data: unknown): number {
    return JSON.stringify(data).length
  }

  /**
   * Simple hash function for cache keys
   */
  private simpleHash(str: string): string {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16)
  }

  /**
   * Update performance metrics
   */
  private updateMetrics(ruleName: string, transformationTime: number, success: boolean): void {
    const existing = this.performanceMetrics.get(ruleName) || {
      totalTransformations: 0,
      averageTime: 0,
      cacheHitRate: 0,
      errorRate: 0
    }

    existing.totalTransformations++
    existing.averageTime = (existing.averageTime * (existing.totalTransformations - 1) + transformationTime) / existing.totalTransformations
    existing.errorRate = success ? existing.errorRate : existing.errorRate + 0.01

    this.performanceMetrics.set(ruleName, existing)
  }

  /**
   * Create error result
   */
  private createErrorResult<T>(error: Error, sourceType: string, targetType: string): TransformationResult<T> {
    return {
      data: null as any,
      metadata: {
        transformationTime: 0,
        sourceType,
        targetType,
        ruleName: 'error',
        size: 0,
        validationPassed: false
      },
      suggestions: [`Transformation failed: ${error.message}`]
    }
  }

  /**
   * Generate transformation suggestions
   */
  private generateTransformationSuggestions<T, U>(rule: TransformationRule<T, U>, validationPassed: boolean): string[] {
    const suggestions: string[] = []
    
    if (!validationPassed) {
      suggestions.push('Validation failed - check input data format')
    }
    
    if (rule.priority > 5) {
      suggestions.push('High priority rule - consider optimization')
    }
    
    return suggestions
  }

  // Default transformation implementations
  private async normalizeUserData(rawUser: any, context: TransformationContext): Promise<any> {
    return {
      id: rawUser.id || rawUser.user_id,
      name: `${rawUser.first_name || ''} ${rawUser.last_name || ''}`.trim(),
      email: rawUser.email?.toLowerCase(),
      role: rawUser.role || 'user',
      status: rawUser.status || 'active',
      createdAt: new Date(rawUser.created_at || rawUser.createdAt).toISOString(),
      lastLogin: rawUser.last_login ? new Date(rawUser.last_login).toISOString() : null,
      metadata: {
        source: 'normalized',
        transformationTime: Date.now()
      }
    }
  }

  private async denormalizeUserData(normalizedUser: any, context: TransformationContext): Promise<any> {
    const [firstName, ...lastNameParts] = (normalizedUser.name || '').split(' ')
    return {
      user_id: normalizedUser.id,
      first_name: firstName,
      last_name: lastNameParts.join(' '),
      email: normalizedUser.email,
      role: normalizedUser.role,
      status: normalizedUser.status,
      created_at: normalizedUser.createdAt,
      last_login: normalizedUser.lastLogin
    }
  }

  private async aggregateAnalyticsData(rawAnalytics: any[], context: TransformationContext): Promise<any> {
    const aggregated = rawAnalytics.reduce((acc, item) => {
      if (!acc[item.metric_name]) {
        acc[item.metric_name] = {
          name: item.metric_name,
          total: 0,
          count: 0,
          values: []
        }
      }
      
      acc[item.metric_name].total += item.metric_value
      acc[item.metric_name].count++
      acc[item.metric_name].values.push(item.metric_value)
      
      return acc
    }, {} as Record<string, any>)

    // Calculate averages and other stats
    Object.values(aggregated).forEach((metric: any) => {
      metric.average = metric.total / metric.count
      metric.min = Math.min(...metric.values)
      metric.max = Math.max(...metric.values)
    })

    return Object.values(aggregated)
  }
}

export const dataTransformationPipeline = DataTransformationPipeline.getInstance()