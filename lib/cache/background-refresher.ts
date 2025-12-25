// ============================================
// lib/cache/background-refresher.ts
// ============================================

import { adaptiveTTLEngine, TTLCalculationContext } from './adaptive-ttl-engine';

export interface RefreshTask {
  id: string
  key: string
  namespace: string
  dataType: string
  priority: 'critical' | 'important' | 'normal' | 'low'
  refreshFunction: () => Promise<unknown>
  lastRefresh: number
  nextRefresh: number
  retryCount: number
  maxRetries: number
  backoffMultiplier: number
  context: TTLCalculationContext
  isActive: boolean
}

export interface BackgroundRefreshConfig {
  enabled: boolean
  maxConcurrentRefreshes: number
  refreshInterval: number // Base interval in milliseconds
  maxBackoffTime: number // Maximum backoff time in milliseconds
  priorityThreshold: number // Minimum priority to refresh during background
  enableVisibilityCheck: boolean // Only refresh when page is visible
}

class BackgroundRefresher {
  private static instance: BackgroundRefresher;
  private refreshTasks: Map<string, RefreshTask> = new Map();
  private refreshQueue: string[] = []; // Task IDs in priority order
  private activeRefreshes: Set<string> = new Set();
  private config: BackgroundRefreshConfig;
  private refreshTimer: NodeJS.Timeout | null = null;
  private isPageVisible: boolean = true;
  private refreshCallbacks: Map<string, ((success: boolean, data?: unknown, error?: Error) => void)[]> = new Map();

  private constructor(config: Partial<BackgroundRefreshConfig> = {}) {
    this.config = {
      enabled: true,
      maxConcurrentRefreshes: 3,
      refreshInterval: 5000, // 5 seconds
      maxBackoffTime: 300000, // 5 minutes
      priorityThreshold: 1, // Refresh all priorities by default
      enableVisibilityCheck: true,
      ...config
    };

    this.initializeVisibilityCheck();
    this.startBackgroundRefresh();
  }

  static getInstance(config?: Partial<BackgroundRefreshConfig>): BackgroundRefresher {
    if (!BackgroundRefresher.instance) {
      BackgroundRefresher.instance = new BackgroundRefresher(config);
    }
    return BackgroundRefresher.instance;
  }

  private initializeVisibilityCheck(): void {
    if (typeof document !== 'undefined' && this.config.enableVisibilityCheck) {
      const handleVisibilityChange = () => {
        this.isPageVisible = !document.hidden;
        
        // If page becomes visible, trigger immediate refresh of stale data
        if (this.isPageVisible) {
          this.refreshStaleData();
        }
      };

      document.addEventListener('visibilitychange', handleVisibilityChange);
      
      // Initial visibility state
      this.isPageVisible = !document.hidden;
    }
  }

  private startBackgroundRefresh(): void {
    if (!this.config.enabled) {
      return;
    }

    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
    }

    this.refreshTimer = setInterval(() => {
      this.processRefreshQueue();
    }, this.config.refreshInterval);
  }

  private async processRefreshQueue(): Promise<void> {
    if (!this.config.enabled || !this.isPageVisible || this.config.enableVisibilityCheck) {
      return;
    }

    // Check if we've reached the maximum concurrent refreshes
    if (this.activeRefreshes.size >= this.config.maxConcurrentRefreshes) {
      return;
    }

    // Get tasks that are ready for refresh
    const now = Date.now();
    const readyTasks: RefreshTask[] = [];

    for (const taskId of this.refreshQueue) {
      const task = this.refreshTasks.get(taskId);
      if (task && task.isActive && task.nextRefresh <= now) {
        // Check priority threshold
        const taskPriority = this.getPriorityValue(task.priority);
        if (taskPriority >= this.config.priorityThreshold) {
          readyTasks.push(task);
        }
      }
    }

    // Sort by priority and refresh time
    readyTasks.sort((a, b) => {
      const priorityDiff = this.getPriorityValue(b.priority) - this.getPriorityValue(a.priority);
      if (priorityDiff !== 0) return priorityDiff;
      return a.nextRefresh - b.nextRefresh;
    });

    // Process tasks until we reach the concurrency limit
    const slotsAvailable = this.config.maxConcurrentRefreshes - this.activeRefreshes.size;
    const tasksToProcess = readyTasks.slice(0, slotsAvailable);

    for (const task of tasksToProcess) {
      this.executeRefresh(task);
    }
  }

  private async executeRefresh(task: RefreshTask): Promise<void> {
    if (this.activeRefreshes.has(task.id)) {
      return; // Already refreshing
    }

    this.activeRefreshes.add(task.id);

    try {
      const startTime = Date.now();
      const data = await task.refreshFunction();
      const duration = Date.now() - startTime;

      // Update task with successful refresh
      task.lastRefresh = Date.now();
      task.nextRefresh = this.calculateNextRefreshTime(task);
      task.retryCount = 0;

      // Notify callbacks
      this.notifyCallbacks(task.id, true, data);

      // Move task to appropriate position in queue based on next refresh time
      this.updateTaskPosition(task.id);

      console.debug(`Background refresh completed for ${task.key} in ${duration}ms`);
    } catch (error) {
      console.error(`Background refresh failed for ${task.key}:`, error);
      
      // Handle retry with exponential backoff
      task.retryCount++;
      const backoffTime = Math.min(
        this.config.refreshInterval * Math.pow(task.backoffMultiplier, task.retryCount),
        this.config.maxBackoffTime
      );
      
      task.nextRefresh = Date.now() + backoffTime;

      // Notify callbacks of failure
      this.notifyCallbacks(task.id, false, undefined, error as Error);

      // Deactivate task if max retries reached
      if (task.retryCount >= task.maxRetries) {
        task.isActive = false;
        console.warn(`Deactivating refresh task ${task.key} after ${task.maxRetries} failed attempts`);
      }

      // Update task position
      this.updateTaskPosition(task.id);
    } finally {
      this.activeRefreshes.delete(task.id);
    }
  }

  private calculateNextRefreshTime(task: RefreshTask): number {
    const now = Date.now();
    
    // Calculate optimal TTL using the adaptive TTL engine
    const ttl = adaptiveTTLEngine.calculateOptimalTTL(task.dataType, task.context);
    
    // Refresh at 70-90% of TTL to ensure data freshness
    const refreshPercentage = 0.7 + Math.random() * 0.2;
    return now + Math.round(ttl * refreshPercentage);
  }

  private updateTaskPosition(taskId: string): void {
    // Remove from current position
    const currentIndex = this.refreshQueue.indexOf(taskId);
    if (currentIndex > -1) {
      this.refreshQueue.splice(currentIndex, 1);
    }

    // Add back in priority order
    const task = this.refreshTasks.get(taskId);
    if (task && task.isActive) {
      let insertIndex = 0;
      
      for (let i = 0; i < this.refreshQueue.length; i++) {
        const queuedTask = this.refreshTasks.get(this.refreshQueue[i]);
        if (queuedTask) {
          const taskPriority = this.getPriorityValue(task.priority);
          const queuedPriority = this.getPriorityValue(queuedTask.priority);
          
          if (taskPriority > queuedPriority || 
              (taskPriority === queuedPriority && task.nextRefresh < queuedTask.nextRefresh)) {
            insertIndex = i;
            break;
          }
          insertIndex = i + 1;
        }
      }
      
      this.refreshQueue.splice(insertIndex, 0, taskId);
    }
  }

  private getPriorityValue(priority: string): number {
    switch (priority) {
      case 'critical': return 4;
      case 'important': return 3;
      case 'normal': return 2;
      case 'low': return 1;
      default: return 0;
    }
  }

  private refreshStaleData(): void {
    const now = Date.now();
    const staleThreshold = 1000; // 1 second stale threshold

    for (const [taskId, task] of this.refreshTasks) {
      if (task.isActive && 
          (now - task.lastRefresh) > staleThreshold && 
          !this.activeRefreshes.has(taskId)) {
        
        // Prioritize critical and important data when page becomes visible
        if (task.priority === 'critical' || task.priority === 'important') {
          task.nextRefresh = now; // Refresh immediately
          this.updateTaskPosition(taskId);
        }
      }
    }
  }

  private notifyCallbacks(
    taskId: string, 
    success: boolean, 
    data?: unknown, 
    error?: Error
  ): void {
    const callbacks = this.refreshCallbacks.get(taskId) || [];
    callbacks.forEach(callback => {
      try {
        callback(success, data, error);
      } catch (callbackError) {
        console.error('Error in refresh callback:', callbackError);
      }
    });
  }

  // Public API methods
  registerRefreshTask(task: Omit<RefreshTask, 'id' | 'lastRefresh' | 'nextRefresh' | 'retryCount' | 'isActive'>): string {
    const taskId = `${task.namespace}-${task.key}-${Date.now()}`;
    
    const fullTask: RefreshTask = {
      ...task,
      id: taskId,
      lastRefresh: 0,
      nextRefresh: Date.now(), // Refresh immediately
      retryCount: 0,
      isActive: true
    };

    this.refreshTasks.set(taskId, fullTask);
    this.updateTaskPosition(taskId);

    return taskId;
  }

  unregisterRefreshTask(taskId: string): void {
    this.refreshTasks.delete(taskId);
    
    const index = this.refreshQueue.indexOf(taskId);
    if (index > -1) {
      this.refreshQueue.splice(index, 1);
    }

    this.activeRefreshes.delete(taskId);
    this.refreshCallbacks.delete(taskId);
  }

  pauseRefreshTask(taskId: string): void {
    const task = this.refreshTasks.get(taskId);
    if (task) {
      task.isActive = false;
      this.updateTaskPosition(taskId);
    }
  }

  resumeRefreshTask(taskId: string): void {
    const task = this.refreshTasks.get(taskId);
    if (task) {
      task.isActive = true;
      task.nextRefresh = Date.now(); // Refresh immediately when resumed
      this.updateTaskPosition(taskId);
    }
  }

  addRefreshCallback(taskId: string, callback: (success: boolean, data?: unknown, error?: Error) => void): void {
    const callbacks = this.refreshCallbacks.get(taskId) || [];
    callbacks.push(callback);
    this.refreshCallbacks.set(taskId, callbacks);
  }

  removeRefreshCallback(taskId: string, callback: (success: boolean, data?: unknown, error?: Error) => void): void {
    const callbacks = this.refreshCallbacks.get(taskId) || [];
    const filteredCallbacks = callbacks.filter(c => c !== callback);
    this.refreshCallbacks.set(taskId, filteredCallbacks);
  }

  forceRefresh(taskId: string): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const task = this.refreshTasks.get(taskId);
      if (!task) {
        reject(new Error(`Refresh task ${taskId} not found`));
        return;
      }

      // Set next refresh to now
      task.nextRefresh = Date.now();
      this.updateTaskPosition(taskId);

      // Add a one-time callback to handle the result
      const callback = (success: boolean, data?: unknown, error?: Error) => {
        if (success) {
          resolve(data);
        } else {
          reject(error);
        }
      };

      this.addRefreshCallback(taskId, callback);
      
      // Remove the callback after execution
      setTimeout(() => {
        this.removeRefreshCallback(taskId, callback);
      }, 10000); // 10 second timeout
    });
  }

  getRefreshStatus(): {
    totalTasks: number
    activeTasks: number
    activeRefreshes: number
    queueLength: number
    isPageVisible: boolean
    config: BackgroundRefreshConfig
  } {
    const activeTasks = Array.from(this.refreshTasks.values()).filter(task => task.isActive).length;

    return {
      totalTasks: this.refreshTasks.size,
      activeTasks,
      activeRefreshes: this.activeRefreshes.size,
      queueLength: this.refreshQueue.length,
      isPageVisible: this.isPageVisible,
      config: { ...this.config }
    };
  }

  getTaskDetails(taskId: string): RefreshTask | undefined {
    return this.refreshTasks.get(taskId);
  }

  getAllTasks(): RefreshTask[] {
    return Array.from(this.refreshTasks.values());
  }

  updateConfig(newConfig: Partial<BackgroundRefreshConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // Restart background refresh if interval changed
    if (newConfig.refreshInterval) {
      this.startBackgroundRefresh();
    }
  }

  // Cleanup method
  destroy(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }

    this.refreshTasks.clear();
    this.refreshQueue = [];
    this.activeRefreshes.clear();
    this.refreshCallbacks.clear();
  }
}

export const backgroundRefresher = BackgroundRefresher.getInstance();