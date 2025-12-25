// ============================================
// lib/cache/cache-consistency.ts
// Cache consistency testing utilities for Phase 3
// ============================================

import { smartCacheManager, CacheEntry } from './smart-cache-manager';
import { cacheInvalidation } from './cache-invalidation';

export interface ConsistencyConfig {
  enableCrossTabSync: boolean
  consistencyCheckInterval: number
  maxInconsistencyRetries: number
  enableAutomaticRepair: boolean
  repairTimeout: number
  consistencyThreshold: number // Minimum consistency score to pass
  enableStateValidation: boolean
  enableDataIntegrityChecks: boolean
}

export interface ConsistencyIssue {
  key: string
  namespace?: string
  issueType: 'missing' | 'stale' | 'corrupted' | 'inconsistent' | 'expired'
  severity: 'low' | 'medium' | 'high' | 'critical'
  description: string
  detectedAt: number
  retryCount: number
  repairAttempts: number
  lastRepairAttempt?: number
}

export interface ConsistencyReport {
  overallScore: number
  totalEntries: number
  consistentEntries: number
  inconsistentEntries: number
  missingEntries: number
  staleEntries: number
  corruptedEntries: number
  issues: ConsistencyIssue[]
  recommendations: string[]
  lastChecked: number
  checkDuration: number
}

export interface DataIntegrityCheck {
  key: string
  namespace?: string
  expectedHash: string
  actualHash: string
  isValid: boolean
  lastValidated: number
}

export interface CrossTabState {
  tabId: string
  lastSync: number
  cacheVersion: number
  pendingInvalidations: string[]
  activeOperations: string[]
}

export class CacheConsistency {
  private static instance: CacheConsistency;
  private config: ConsistencyConfig;
  private integrityChecks: Map<string, DataIntegrityCheck> = new Map();
  private crossTabStates: Map<string, CrossTabState> = new Map();
  private consistencyHistory: ConsistencyReport[] = [];
  private isChecking: boolean = false;
  private currentTabId: string;
  private broadcastChannel: BroadcastChannel | null = null;

  private constructor(config: Partial<ConsistencyConfig> = {}) {
    this.config = {
      enableCrossTabSync: true,
      consistencyCheckInterval: 60000, // 1 minute
      maxInconsistencyRetries: 3,
      enableAutomaticRepair: true,
      repairTimeout: 5000,
      consistencyThreshold: 0.95,
      enableStateValidation: true,
      enableDataIntegrityChecks: true,
      ...config
    };

    this.currentTabId = this.generateTabId();
    this.initializeCrossTabSync();
    this.startPeriodicChecks();
  }

  static getInstance(config?: Partial<ConsistencyConfig>): CacheConsistency {
    if (!CacheConsistency.instance) {
      CacheConsistency.instance = new CacheConsistency(config);
    }
    return CacheConsistency.instance;
  }

  private generateTabId(): string {
    return `tab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private initializeCrossTabSync(): void {
    if (typeof window !== 'undefined' && this.config.enableCrossTabSync) {
      try {
        this.broadcastChannel = new BroadcastChannel('cache-consistency');
        
        this.broadcastChannel.onmessage = (event) => {
          const message = event.data;
          this.handleCrossTabMessage(message);
        };

        // Register this tab
        this.registerTab();
        
      } catch (error) {
        console.warn('Cross-tab sync not supported:', error);
        this.config.enableCrossTabSync = false;
      }
    }
  }

  private registerTab(): void {
    const state: CrossTabState = {
      tabId: this.currentTabId,
      lastSync: Date.now(),
      cacheVersion: 1,
      pendingInvalidations: [],
      activeOperations: []
    };

    this.crossTabStates.set(this.currentTabId, state);
    this.broadcastStateUpdate();
  }

  private broadcastStateUpdate(): void {
    if (this.broadcastChannel) {
      this.broadcastChannel.postMessage({
        type: 'tab-register',
        tabId: this.currentTabId,
        timestamp: Date.now()
      });
    }
  }

  private handleCrossTabMessage(message: any): void {
    switch (message.type) {
      case 'tab-register':
        this.handleTabRegistration(message);
        break;
      case 'invalidation':
        this.handleCrossTabInvalidation(message);
        break;
      case 'cache-update':
        this.handleCrossTabCacheUpdate(message);
        break;
      case 'consistency-check':
        this.handleConsistencyCheckRequest(message);
        break;
    }
  }

  private handleTabRegistration(message: any): void {
    const existingState = this.crossTabStates.get(message.tabId);
    if (!existingState || (Date.now() - existingState.lastSync) > 300000) { // 5 minutes
      this.crossTabStates.set(message.tabId, {
        tabId: message.tabId,
        lastSync: message.timestamp,
        cacheVersion: 1,
        pendingInvalidations: [],
        activeOperations: []
      });
    }
  }

  private handleCrossTabInvalidation(message: any): void {
    // Sync invalidation across tabs
    if (message.key && message.namespace) {
      smartCacheManager.delete(message.key, message.namespace);
    }
  }

  private handleCrossTabCacheUpdate(message: any): void {
    // Handle cache updates from other tabs
    // This could be used for distributed cache scenarios
  }

  private handleConsistencyCheckRequest(message: any): void {
    // Respond to consistency check requests from other tabs
    if (this.broadcastChannel) {
      this.broadcastChannel.postMessage({
        type: 'consistency-response',
        tabId: this.currentTabId,
        timestamp: Date.now(),
        data: this.getQuickConsistencySummary()
      });
    }
  }

  private startPeriodicChecks(): void {
    setInterval(() => {
      if (!this.isChecking) {
        this.checkConsistency().catch(console.error);
      }
    }, this.config.consistencyCheckInterval);
  }

  // Main consistency checking methods
  async checkConsistency(): Promise<ConsistencyIssue[]> {
    if (this.isChecking) {
      console.warn('Consistency check already in progress');
      return [];
    }

    this.isChecking = true;
    const startTime = Date.now();

    console.log('Starting cache consistency check...');

    try {
      const issues: ConsistencyIssue[] = [];

      // Step 1: Check for missing entries
      issues.push(...await this.checkForMissingEntries());

      // Step 2: Check for stale data
      issues.push(...await this.checkForStaleData());

      // Step 3: Check data integrity
      if (this.config.enableDataIntegrityChecks) {
        issues.push(...await this.checkDataIntegrity());
      }

      // Step 4: Check cross-tab consistency
      if (this.config.enableCrossTabSync) {
        issues.push(...await this.checkCrossTabConsistency());
      }

      // Step 5: Check state consistency
      if (this.config.enableStateValidation) {
        issues.push(...await this.checkStateConsistency());
      }

      // Step 6: Generate report
      const report = this.generateConsistencyReport(issues, Date.now() - startTime);
      this.consistencyHistory.push(report);

      // Step 7: Attempt automatic repair if enabled
      if (this.config.enableAutomaticRepair && issues.length > 0) {
        await this.attemptAutomaticRepair(issues);
      }

      // Keep only recent history
      if (this.consistencyHistory.length > 100) {
        this.consistencyHistory = this.consistencyHistory.slice(-100);
      }

      console.log(`Consistency check completed. Found ${issues.length} issues.`);
      return issues;

    } finally {
      this.isChecking = false;
    }
  }

  private async checkForMissingEntries(): Promise<ConsistencyIssue[]> {
    const issues: ConsistencyIssue[] = [];
    
    // This is a placeholder implementation
    // In a real scenario, you'd compare against expected entries
    const expectedEntries = [
      'dashboard-critical',
      'user-profile',
      'analytics-data'
    ];

    for (const key of expectedEntries) {
      const exists = smartCacheManager.has(key);
      if (!exists) {
        issues.push({
          key,
          issueType: 'missing',
          severity: 'medium',
          description: `Expected entry ${key} is missing from cache`,
          detectedAt: Date.now(),
          retryCount: 0,
          repairAttempts: 0
        });
      }
    }

    return issues;
  }

  private async checkForStaleData(): Promise<ConsistencyIssue[]> {
    const issues: ConsistencyIssue[] = [];
    const entries = smartCacheManager.getAllEntries();
    const now = Date.now();

    for (const entry of entries) {
      // Check if data is stale based on business rules
      if (this.isStaleEntry(entry, now)) {
        issues.push({
          key: entry.key,
          namespace: entry.namespace,
          issueType: 'stale',
          severity: this.getStaleDataSeverity(entry),
          description: `Entry ${entry.key} appears to be stale`,
          detectedAt: now,
          retryCount: 0,
          repairAttempts: 0
        });
      }
    }

    return issues;
  }

  private isStaleEntry(entry: CacheEntry, now: number): boolean {
    // More sophisticated stale data detection
    const age = now - entry.timestamp;
    const ttl = entry.ttl;
    
    // Consider stale if it's older than 80% of its TTL
    if (age > ttl * 0.8) {
      // Additional checks for critical data
      if (entry.key.includes('critical') && age > ttl * 0.6) {
        return true;
      }
    }

    return false;
  }

  private getStaleDataSeverity(entry: CacheEntry): 'low' | 'medium' | 'high' | 'critical' {
    if (entry.key.includes('critical')) return 'high';
    if (entry.key.includes('realtime')) return 'critical';
    if (entry.key.includes('secondary')) return 'medium';
    return 'low';
  }

  private async checkDataIntegrity(): Promise<ConsistencyIssue[]> {
    const issues: ConsistencyIssue[] = [];
    const entries = smartCacheManager.getAllEntries();

    for (const entry of entries) {
      try {
        // Try to decompress/decode the data
        if (entry.compressed) {
          const data = await smartCacheManager.get(entry.key, entry.namespace);
          if (data === null) {
            issues.push({
              key: entry.key,
              namespace: entry.namespace,
              issueType: 'corrupted',
              severity: 'high',
              description: `Compressed data for ${entry.key} is corrupted`,
              detectedAt: Date.now(),
              retryCount: 0,
              repairAttempts: 0
            });
          }
        }

        // Update integrity check
        this.updateIntegrityCheck(entry);

      } catch (error) {
        issues.push({
          key: entry.key,
          namespace: entry.namespace,
          issueType: 'corrupted',
          severity: 'critical',
          description: `Data integrity check failed for ${entry.key}: ${error}`,
          detectedAt: Date.now(),
          retryCount: 0,
          repairAttempts: 0
        });
      }
    }

    return issues;
  }

  private updateIntegrityCheck(entry: CacheEntry): void {
    const key = entry.namespace ? `${entry.namespace}:${entry.key}` : entry.key;
    
    // Simple hash calculation (in production, use a proper hash function)
    const dataString = JSON.stringify(entry.data);
    const hash = this.simpleHash(dataString);

    const existingCheck = this.integrityChecks.get(key);
    if (existingCheck) {
      existingCheck.actualHash = hash;
      existingCheck.isValid = existingCheck.expectedHash === hash;
      existingCheck.lastValidated = Date.now();
    } else {
      this.integrityChecks.set(key, {
        key: entry.key,
        namespace: entry.namespace,
        expectedHash: hash,
        actualHash: hash,
        isValid: true,
        lastValidated: Date.now()
      });
    }
  }

  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(16);
  }

  private async checkCrossTabConsistency(): Promise<ConsistencyIssue[]> {
    const issues: ConsistencyIssue[] = [];
    
    // Check if other tabs are responsive
    const now = Date.now();
    for (const [tabId, state] of this.crossTabStates) {
      if (tabId !== this.currentTabId && (now - state.lastSync) > 300000) { // 5 minutes
        issues.push({
          key: 'cross-tab-sync',
          issueType: 'inconsistent',
          severity: 'medium',
          description: `Tab ${tabId} appears to be unresponsive`,
          detectedAt: now,
          retryCount: 0,
          repairAttempts: 0
        });
      }
    }

    return issues;
  }

  private async checkStateConsistency(): Promise<ConsistencyIssue[]> {
    const issues: ConsistencyIssue[] = [];
    
    // Check cache statistics consistency
    const stats = smartCacheManager.getStats();
    
    // Validate that cache size is within expected bounds
    if (stats.totalSize > stats.totalSize * 1.1) { // Allow 10% variance
      issues.push({
        key: 'cache-size',
        issueType: 'inconsistent',
        severity: 'low',
        description: 'Cache size appears inconsistent',
        detectedAt: Date.now(),
        retryCount: 0,
        repairAttempts: 0
      });
    }

    // Validate hit rate
    if (stats.hitRate < 0.3 || stats.hitRate > 1.0) {
      issues.push({
        key: 'hit-rate',
        issueType: 'inconsistent',
        severity: 'medium',
        description: `Cache hit rate ${stats.hitRate} seems incorrect`,
        detectedAt: Date.now(),
        retryCount: 0,
        repairAttempts: 0
      });
    }

    return issues;
  }

  private async attemptAutomaticRepair(issues: ConsistencyIssue[]): Promise<void> {
    console.log(`Attempting automatic repair of ${issues.length} consistency issues`);

    for (const issue of issues) {
      if (issue.repairAttempts >= this.config.maxInconsistencyRetries) {
        continue;
      }

      try {
        await this.repairIssue(issue);
        issue.repairAttempts++;
        issue.lastRepairAttempt = Date.now();
      } catch (error) {
        console.error(`Failed to repair issue ${issue.key}:`, error);
      }
    }
  }

  private async repairIssue(issue: ConsistencyIssue): Promise<void> {
    switch (issue.issueType) {
      case 'missing':
        // Attempt to refresh missing data
        await this.refreshMissingData(issue);
        break;

      case 'stale':
        // Force refresh of stale data
        await this.refreshStaleData(issue);
        break;

      case 'corrupted':
        // Remove corrupted data
        smartCacheManager.delete(issue.key, issue.namespace);
        break;

      case 'expired':
        // Clean up expired data
        smartCacheManager.delete(issue.key, issue.namespace);
        break;
    }
  }

  private async refreshMissingData(issue: ConsistencyIssue): Promise<void> {
    // This would depend on your data fetching strategy
    // For now, just mark for refresh
    console.log(`Would refresh missing data for ${issue.key}`);
  }

  private async refreshStaleData(issue: ConsistencyIssue): Promise<void> {
    // Force refresh of the stale entry
    const entry = smartCacheManager.getEntryDetails(issue.key, issue.namespace);
    if (entry) {
      // Simulate refresh by updating timestamp
      smartCacheManager.set(issue.key, entry.data, {
        namespace: issue.namespace,
        ttl: entry.ttl
      });
    }
  }

  private generateConsistencyReport(issues: ConsistencyIssue[], checkDuration: number): ConsistencyReport {
    const stats = smartCacheManager.getStats();
    
    let overallScore = 1.0;
    const recommendations: string[] = [];

    // Calculate score based on issues
    const totalEntries = stats.totalEntries;
    if (totalEntries === 0) {
      overallScore = 1.0;
    } else {
      const issuesWeight = issues.reduce((sum, issue) => {
        switch (issue.severity) {
          case 'critical': return sum + 0.3;
          case 'high': return sum + 0.2;
          case 'medium': return sum + 0.1;
          case 'low': return sum + 0.05;
          default: return sum + 0.1;
        }
      }, 0);
      
      overallScore = Math.max(0, 1.0 - (issuesWeight / totalEntries));
    }

    // Generate recommendations
    if (overallScore < this.config.consistencyThreshold) {
      recommendations.push('Cache consistency is below threshold. Consider running manual cleanup.');
    }

    const missingCount = issues.filter(i => i.issueType === 'missing').length;
    if (missingCount > 0) {
      recommendations.push(`${missingCount} entries are missing. Check data fetching logic.`);
    }

    const staleCount = issues.filter(i => i.issueType === 'stale').length;
    if (staleCount > 0) {
      recommendations.push(`${staleCount} entries are stale. Consider adjusting TTL values.`);
    }

    return {
      overallScore,
      totalEntries,
      consistentEntries: totalEntries - issues.length,
      inconsistentEntries: issues.length,
      missingEntries: missingCount,
      staleEntries: staleCount,
      corruptedEntries: issues.filter(i => i.issueType === 'corrupted').length,
      issues,
      recommendations,
      lastChecked: Date.now(),
      checkDuration
    };
  }

  private getQuickConsistencySummary(): any {
    const stats = smartCacheManager.getStats();
    return {
      hitRate: stats.hitRate,
      totalEntries: stats.totalEntries,
      totalSize: stats.totalSize,
      lastCheck: Date.now()
    };
  }

  // Public API methods
  getConsistencyScore(): number {
    if (this.consistencyHistory.length === 0) return 1.0;
    
    const latestReport = this.consistencyHistory[this.consistencyHistory.length - 1];
    return latestReport.overallScore;
  }

  getLatestReport(): ConsistencyReport | undefined {
    return this.consistencyHistory[this.consistencyHistory.length - 1];
  }

  getAllReports(): ConsistencyReport[] {
    return [...this.consistencyHistory];
  }

  getIntegrityChecks(): Map<string, DataIntegrityCheck> {
    return new Map(this.integrityChecks);
  }

  async forceConsistencyCheck(): Promise<ConsistencyReport> {
    const issues = await this.checkConsistency();
    return this.generateConsistencyReport(issues, 0);
  }

  // Cleanup method
  destroy(): void {
    if (this.broadcastChannel) {
      this.broadcastChannel.close();
    }
    
    this.integrityChecks.clear();
    this.crossTabStates.clear();
    this.consistencyHistory = [];
  }
}

export const cacheConsistency = CacheConsistency.getInstance();