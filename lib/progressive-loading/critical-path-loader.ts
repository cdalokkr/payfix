// ============================================
// lib/progressive-loading/critical-path-loader.ts
// ============================================

export interface CriticalPathItem {
  id: string
  name: string
  priority: 'critical' | 'important' | 'normal' | 'low'
  dependencies: string[]
  loader: () => Promise<any>
  timeout?: number
  retryCount?: number
  cacheable?: boolean
}

export interface CriticalPathState {
  isLoading: boolean
  progress: number
  phase: 'idle' | 'loading' | 'complete' | 'error'
  currentOperation: string
  completedCritical: number
  totalCritical: number
  completedImportant: number
  totalImportant: number
  timeElapsed: number
  estimatedTimeRemaining: number
  error?: Error | null
}

export interface CriticalPathConfig {
  maxConcurrent: number
  enableTimeout: boolean
  defaultTimeout: number
  enableRetry: boolean
  defaultRetryCount: number
  enableDependencies: boolean
  enableCaching: boolean
  batchSize: number
}

class CriticalPathLoader {
  private config: CriticalPathConfig
  private items: Map<string, CriticalPathItem> = new Map()
  private state: CriticalPathState
  private activeLoaders: Map<string, Promise<any>> = new Map()
  private results: Map<string, any> = new Map()
  private completedItems: Set<string> = new Set()
  private startTime: number | null = null

  constructor(config: Partial<CriticalPathConfig> = {}) {
    this.config = {
      maxConcurrent: 3,
      enableTimeout: true,
      defaultTimeout: 10000, // 10 seconds
      enableRetry: true,
      defaultRetryCount: 2,
      enableDependencies: true,
      enableCaching: true,
      batchSize: 5,
      ...config
    }

    this.state = this.createInitialState()
  }

  private createInitialState(): CriticalPathState {
    return {
      isLoading: false,
      progress: 0,
      phase: 'idle',
      currentOperation: '',
      completedCritical: 0,
      totalCritical: 0,
      completedImportant: 0,
      totalImportant: 0,
      timeElapsed: 0,
      estimatedTimeRemaining: 0,
      error: null
    }
  }

  // Register items in the critical path
  registerItem(item: CriticalPathItem): void {
    this.items.set(item.id, {
      ...item,
      retryCount: item.retryCount ?? this.config.defaultRetryCount
    })
    
    console.log(`Registered critical path item: ${item.name} (${item.priority})`)
  }

  registerItems(items: CriticalPathItem[]): void {
    items.forEach(item => this.registerItem(item))
  }

  // Execute the critical path
  async execute(): Promise<Map<string, any>> {
    if (this.state.isLoading) {
      throw new Error('Critical path execution already in progress')
    }

    this.startTime = Date.now()
    this.state = {
      ...this.state,
      isLoading: true,
      phase: 'loading',
      currentOperation: 'Initializing critical path',
      error: null
    }

    try {
      // Sort items by priority
      const sortedItems = this.sortItemsByPriority()
      
      // Count total items by priority
      const criticalItems = sortedItems.filter(item => item.priority === 'critical')
      const importantItems = sortedItems.filter(item => item.priority === 'important')
      
      this.state.totalCritical = criticalItems.length
      this.state.totalImportant = importantItems.length

      console.log(`Starting critical path execution: ${criticalItems.length} critical, ${importantItems.length} important`)

      // Execute critical items first
      await this.executeItemsByPriority(criticalItems, 'critical')
      
      // Then execute important items
      if (importantItems.length > 0) {
        await this.executeItemsByPriority(importantItems, 'important')
      }

      // Mark as complete
      this.state = {
        ...this.state,
        isLoading: false,
        phase: 'complete',
        progress: 100,
        currentOperation: 'Complete'
      }

      console.log('Critical path execution completed successfully')
      return new Map(this.results)

    } catch (error) {
      this.state = {
        ...this.state,
        isLoading: false,
        phase: 'error',
        error: error as Error,
        currentOperation: 'Error'
      }
      
      console.error('Critical path execution failed:', error)
      throw error
    }
  }

  private sortItemsByPriority(): CriticalPathItem[] {
    const priorityOrder = { critical: 0, important: 1, normal: 2, low: 3 }
    
    return Array.from(this.items.values()).sort((a, b) => {
      const aPriority = priorityOrder[a.priority]
      const bPriority = priorityOrder[b.priority]
      
      if (aPriority !== bPriority) {
        return aPriority - bPriority
      }
      
      // If same priority, sort by dependencies (items with fewer dependencies first)
      return a.dependencies.length - b.dependencies.length
    })
  }

  private async executeItemsByPriority(items: CriticalPathItem[], priority: string): Promise<void> {
    const batches = this.createBatches(items, this.config.batchSize)
    
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex]
      this.state.currentOperation = `Loading ${priority} items (batch ${batchIndex + 1}/${batches.length})`
      
      // Execute batch with concurrency control
      const batchPromises = batch.map(item => this.executeItem(item))
      
      try {
        await Promise.allSettled(batchPromises)
      } catch (error) {
        console.error(`Batch ${batchIndex + 1} failed:`, error)
        // Continue with next batch even if current batch fails
      }
      
      // Update progress
      const completedInBatch = batch.filter(item => this.completedItems.has(item.id)).length
      const totalCompleted = priority === 'critical' 
        ? this.state.completedCritical + completedInBatch
        : this.state.completedImportant + completedInBatch
      
      this.updateProgress(priority, totalCompleted)
    }
  }

  private createBatches(items: CriticalPathItem[], batchSize: number): CriticalPathItem[][] {
    const batches: CriticalPathItem[][] = []
    
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize))
    }
    
    return batches
  }

  private async executeItem(item: CriticalPathItem): Promise<void> {
    // Check dependencies
    if (this.config.enableDependencies && item.dependencies.length > 0) {
      await this.waitForDependencies(item.dependencies)
    }

    this.state.currentOperation = `Loading ${item.name}`
    
    // Check if already cached
    if (this.config.enableCaching && this.results.has(item.id)) {
      console.log(`Using cached result for ${item.name}`)
      this.markItemComplete(item.id)
      return
    }

    // Check if already loading
    if (this.activeLoaders.has(item.id)) {
      console.log(`Waiting for existing loader for ${item.name}`)
      await this.activeLoaders.get(item.id)
      return
    }

    // Start loading
    const loaderPromise = this.loadItemWithRetry(item)
    this.activeLoaders.set(item.id, loaderPromise)

    try {
      const result = await loaderPromise
      this.results.set(item.id, result)
      this.markItemComplete(item.id)
      console.log(`Successfully loaded ${item.name}`)
    } catch (error) {
      console.error(`Failed to load ${item.name}:`, error)
      this.state.error = error as Error
      throw error
    } finally {
      this.activeLoaders.delete(item.id)
    }
  }

  private async waitForDependencies(dependencies: string[]): Promise<void> {
    const pendingDependencies = dependencies.filter(dep => !this.completedItems.has(dep))
    
    if (pendingDependencies.length === 0) return

    console.log(`Waiting for dependencies: ${pendingDependencies.join(', ')}`)
    
    // Wait for all dependencies to complete
    const dependencyPromises = pendingDependencies.map(dep => {
      if (this.activeLoaders.has(dep)) {
        return this.activeLoaders.get(dep)
      } else if (this.results.has(dep)) {
        return Promise.resolve(this.results.get(dep))
      } else {
        return Promise.reject(new Error(`Dependency ${dep} not found`))
      }
    })

    await Promise.allSettled(dependencyPromises)
  }

  private async loadItemWithRetry(item: CriticalPathItem): Promise<any> {
    let lastError: Error | null = null
    
    for (let attempt = 0; attempt <= item.retryCount!; attempt++) {
      try {
        const result = await this.loadItemWithTimeout(item)
        return result
      } catch (error) {
        lastError = error as Error
        console.warn(`Attempt ${attempt + 1} failed for ${item.name}:`, error)
        
        if (attempt < item.retryCount!) {
          const delay = Math.pow(2, attempt) * 1000 // Exponential backoff
          console.log(`Retrying ${item.name} in ${delay}ms`)
          await this.sleep(delay)
        }
      }
    }
    
    throw lastError || new Error(`Failed to load ${item.name} after ${item.retryCount! + 1} attempts`)
  }

  private async loadItemWithTimeout(item: CriticalPathItem): Promise<any> {
    const timeout = item.timeout ?? this.config.defaultTimeout
    
    if (!this.config.enableTimeout) {
      return item.loader()
    }

    return Promise.race([
      item.loader(),
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error(`Timeout loading ${item.name}`)), timeout)
      })
    ])
  }

  private markItemComplete(itemId: string): void {
    this.completedItems.add(itemId)
    
    const item = this.items.get(itemId)
    if (item) {
      if (item.priority === 'critical') {
        this.state.completedCritical++
      } else if (item.priority === 'important') {
        this.state.completedImportant++
      }
    }
  }

  private updateProgress(priority: string, completed: number): void {
    const total = priority === 'critical' ? this.state.totalCritical : this.state.totalImportant
    const progressPercentage = total > 0 ? (completed / total) * 100 : 0
    
    // Calculate overall progress (critical items weighted more heavily)
    const criticalProgress = (this.state.completedCritical / Math.max(this.state.totalCritical, 1)) * 0.7
    const importantProgress = (this.state.completedImportant / Math.max(this.state.totalImportant, 1)) * 0.3
    const overallProgress = (criticalProgress + importantProgress) * 100

    this.state.progress = Math.min(100, overallProgress)
    
    // Update time estimates
    if (this.startTime) {
      const elapsed = Date.now() - this.startTime
      this.state.timeElapsed = elapsed
      
      if (this.state.progress > 0) {
        const estimatedTotal = elapsed / (this.state.progress / 100)
        this.state.estimatedTimeRemaining = Math.max(0, estimatedTotal - elapsed)
      }
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  // Public API methods
  getState(): CriticalPathState {
    return { ...this.state }
  }

  getResult(key: string): any {
    return this.results.get(key)
  }

  getAllResults(): Map<string, any> {
    return new Map(this.results)
  }

  hasResult(key: string): boolean {
    return this.results.has(key)
  }

  isItemComplete(key: string): boolean {
    return this.completedItems.has(key)
  }

  clear(): void {
    this.results.clear()
    this.completedItems.clear()
    this.activeLoaders.clear()
    this.state = this.createInitialState()
    this.startTime = null
  }

  getProgress(): number {
    return this.state.progress
  }

  isLoading(): boolean {
    return this.state.isLoading
  }

  // Performance monitoring
  getPerformanceMetrics() {
    return {
      totalItems: this.items.size,
      completedItems: this.completedItems.size,
      totalTime: this.startTime ? Date.now() - this.startTime : 0,
      averageItemTime: this.completedItems.size > 0 && this.startTime 
        ? (Date.now() - this.startTime) / this.completedItems.size 
        : 0,
      successRate: this.completedItems.size / Math.max(this.items.size, 1)
    }
  }
}

// Export singleton instance
export const criticalPathLoader = new CriticalPathLoader()