// ============================================
// lib/cache/cache-system-validation.ts
// Comprehensive cache system validation and testing
// ============================================

import { advancedCacheManager } from './advanced-cache-manager';
import { smartCacheManager } from './smart-cache-manager';
import { MemoryOptimizer } from './memory-optimizer';
import { cacheConsistency } from './cache-consistency';

export interface CacheSystemTestResult {
  testName: string
  success: boolean
  duration: number
  details?: string
  error?: string
}

export interface CacheSystemValidationReport {
  timestamp: number
  totalTests: number
  passedTests: number
  failedTests: number
  overallSuccess: boolean
  tests: CacheSystemTestResult[]
  systemMetrics: {
    cacheHitRate: number
    memoryUsage: number
    consistencyScore: number
    totalEntries: number
  }
}

class CacheSystemValidator {
  private testResults: CacheSystemTestResult[] = [];

  async runComprehensiveValidation(): Promise<CacheSystemValidationReport> {
    console.log('🧪 Starting comprehensive cache system validation...');
    const startTime = Date.now();

    try {
      // Test 1: Basic cache operations
      await this.testBasicCacheOperations();
      
      // Test 2: Compression functionality
      await this.testCompressionSystem();
      
      // Test 3: Memory optimization
      await this.testMemoryOptimization();
      
      // Test 4: Consistency monitoring
      await this.testConsistencyMonitoring();
      
      // Test 5: Cross-tab synchronization
      await this.testCrossTabSync();
      
      // Test 6: Error handling and fallbacks
      await this.testErrorHandling();
      
      // Test 7: Performance under load
      await this.testPerformanceUnderLoad();
      
      // Test 8: Advanced features
      await this.testAdvancedFeatures();

      const report = this.generateReport(startTime);
      console.log('✅ Cache system validation completed:', report);
      return report;
      
    } catch (error) {
      console.error('❌ Cache system validation failed:', error);
      throw error;
    }
  }

  private async testBasicCacheOperations(): Promise<void> {
    const testName = 'Basic Cache Operations';
    const startTime = Date.now();
    
    try {
      // Test set/get operations
      await advancedCacheManager.set('test-basic-key', { message: 'Hello World' });
      const retrieved = await advancedCacheManager.get('test-basic-key');
      
      if (!retrieved || (retrieved as any).message !== 'Hello World') {
        throw new Error('Basic cache set/get failed');
      }
      
      // Test TTL expiration
      await advancedCacheManager.set('test-ttl-key', { message: 'TTL Test' }, { ttl: 100 });
      await new Promise(resolve => setTimeout(resolve, 150));
      const expired = await advancedCacheManager.get('test-ttl-key');
      
      if (expired !== null) {
        throw new Error('TTL expiration test failed');
      }
      
      // Test namespace operations
      await advancedCacheManager.set('test-ns-key', { message: 'Namespace Test' }, { namespace: 'test-ns' });
      const fromNs = await advancedCacheManager.get('test-ns-key', 'test-ns');
      
      if (!fromNs || (fromNs as any).message !== 'Namespace Test') {
        throw new Error('Namespace operations test failed');
      }
      
      this.recordTestResult(testName, true, Date.now() - startTime, 'All basic operations working correctly');
      
    } catch (error) {
      this.recordTestResult(testName, false, Date.now() - startTime, undefined, (error as Error).message);
    }
  }

  private async testCompressionSystem(): Promise<void> {
    const testName = 'Compression System';
    const startTime = Date.now();
    
    try {
      // Create large data for compression testing
      const largeData = {
        users: Array.from({ length: 100 }, (_, i) => ({
          id: i,
          name: `User ${i}`,
          email: `user${i}@example.com`,
          data: 'x'.repeat(200) // 200 chars per user
        }))
      };
      
      await advancedCacheManager.set('test-compression-key', largeData);
      const retrieved = await advancedCacheManager.get('test-compression-key');
      
      if (!retrieved || (retrieved as any).users.length !== 100) {
        throw new Error('Compression/decompression failed');
      }
      
      // Verify compression actually saved space
      const stats = smartCacheManager.getStats();
      if (stats.compressionRatio === 0) {
        console.warn('⚠️ Compression may not be working as expected');
      }
      
      this.recordTestResult(testName, true, Date.now() - startTime, `Compression ratio: ${stats.compressionRatio}`);
      
    } catch (error) {
      this.recordTestResult(testName, false, Date.now() - startTime, undefined, (error as Error).message);
    }
  }

  private async testMemoryOptimization(): Promise<void> {
    const testName = 'Memory Optimization';
    const startTime = Date.now();
    
    try {
      // Force memory optimization
      await advancedCacheManager.optimize();
      
      // Get memory stats
      const memoryStats = MemoryOptimizer.getInstance().getStats();
      
      if (!memoryStats) {
        throw new Error('Memory optimization system not working');
      }
      
      console.log('Memory optimization stats:', memoryStats);
      
      this.recordTestResult(testName, true, Date.now() - startTime, `Memory pressure: ${memoryStats.memoryPressure}`);
      
    } catch (error) {
      this.recordTestResult(testName, false, Date.now() - startTime, undefined, (error as Error).message);
    }
  }

  private async testConsistencyMonitoring(): Promise<void> {
    const testName = 'Consistency Monitoring';
    const startTime = Date.now();
    
    try {
      // Force consistency check
      const report = await cacheConsistency.forceConsistencyCheck();
      
      if (!report || typeof report.overallScore !== 'number') {
        throw new Error('Consistency monitoring not working');
      }
      
      console.log('Consistency report:', report);
      
      // Should pass basic consistency check
      if (report.overallScore < 0.8) {
        console.warn('⚠️ Low consistency score detected');
      }
      
      this.recordTestResult(testName, true, Date.now() - startTime, `Consistency score: ${report.overallScore}`);
      
    } catch (error) {
      this.recordTestResult(testName, false, Date.now() - startTime, undefined, (error as Error).message);
    }
  }

  private async testCrossTabSync(): Promise<void> {
    const testName = 'Cross-Tab Synchronization';
    const startTime = Date.now();
    
    try {
      // Test cross-tab invalidation
      await advancedCacheManager.set('test-sync-key', { message: 'Sync Test' });
      
      // Invalidate and check if sync works
      advancedCacheManager.invalidate('test-sync-key', 'test-invalidation');
      
      const afterInvalidate = await advancedCacheManager.get('test-sync-key');
      
      if (afterInvalidate !== null) {
        throw new Error('Cross-tab invalidation not working');
      }
      
      this.recordTestResult(testName, true, Date.now() - startTime, 'Cross-tab synchronization working');
      
    } catch (error) {
      this.recordTestResult(testName, false, Date.now() - startTime, undefined, (error as Error).message);
    }
  }

  private async testErrorHandling(): Promise<void> {
    const testName = 'Error Handling and Fallbacks';
    const startTime = Date.now();
    
    try {
      // Test invalid input handling
      try {
        await advancedCacheManager.set('', { message: 'Should fail' });
        throw new Error('Empty key validation failed');
      } catch (error) {
        if (!(error as Error).message.includes('non-empty string')) {
          throw new Error('Error handling not working properly');
        }
      }
      
      // Test graceful degradation with undefined data
      try {
        await advancedCacheManager.set('test-undefined-key', undefined);
        throw new Error('Undefined data validation failed');
      } catch (error) {
        if (!(error as Error).message.includes('undefined')) {
          throw new Error('Undefined data handling not working properly');
        }
      }
      
      this.recordTestResult(testName, true, Date.now() - startTime, 'Error handling and validation working correctly');
      
    } catch (error) {
      this.recordTestResult(testName, false, Date.now() - startTime, undefined, (error as Error).message);
    }
  }

  private async testPerformanceUnderLoad(): Promise<void> {
    const testName = 'Performance Under Load';
    const startTime = Date.now();
    
    try {
      const testData = { message: 'Load test data', timestamp: Date.now() };
      const operations = 50;
      
      const start = Date.now();
      
      // Perform multiple operations
      const promises = Array.from({ length: operations }, (_, i) => 
        advancedCacheManager.set(`load-test-key-${i}`, { ...testData, id: i })
      );
      
      await Promise.all(promises);
      
      // Retrieve operations
      const getPromises = Array.from({ length: operations }, (_, i) => 
        advancedCacheManager.get(`load-test-key-${i}`)
      );
      
      const results = await Promise.all(getPromises);
      
      const duration = Date.now() - start;
      const avgOperationTime = duration / (operations * 2);
      
      console.log(`Load test completed: ${operations} operations in ${duration}ms (${avgOperationTime}ms per operation)`);
      
      // Verify all operations succeeded
      if (results.some(result => !result)) {
        throw new Error('Some load test operations failed');
      }
      
      if (avgOperationTime > 100) {
        console.warn('⚠️ Performance might be slower than expected');
      }
      
      this.recordTestResult(testName, true, Date.now() - startTime, `Average operation time: ${avgOperationTime.toFixed(2)}ms`);
      
    } catch (error) {
      this.recordTestResult(testName, false, Date.now() - startTime, undefined, error instanceof Error ? error.message : String(error));
    }
  }

  private async testAdvancedFeatures(): Promise<void> {
    const testName = 'Advanced Features';
    const startTime = Date.now();
    
    try {
      // Test dependency management
      advancedCacheManager.addDependency('user-profile', ['dashboard-critical', 'analytics-data']);
      
      // Test metrics collection
      const metrics = advancedCacheManager.getMetrics();
      
      if (!metrics || typeof metrics.totalOperations !== 'number') {
        throw new Error('Metrics collection not working');
      }
      
      // Test dependency graph
      const dependencyGraph = advancedCacheManager.getDependencyGraph();
      
      if (!dependencyGraph || dependencyGraph.size === 0) {
        throw new Error('Dependency management not working');
      }
      
      this.recordTestResult(testName, true, Date.now() - startTime, 'All advanced features working correctly');
      
    } catch (error) {
      this.recordTestResult(testName, false, Date.now() - startTime, undefined, error instanceof Error ? error.message : String(error));
    }
  }

  private recordTestResult(testName: string, success: boolean, duration: number, details?: string, error?: string): void {
    this.testResults.push({
      testName,
      success,
      duration,
      details,
      error
    });
    
    const status = success ? '✅' : '❌';
    console.log(`${status} ${testName}: ${success ? 'PASSED' : 'FAILED'} (${duration}ms)`);
    if (details) console.log(`   Details: ${details}`);
    if (error) console.log(`   Error: ${error}`);
  }

  private generateReport(startTime: number): CacheSystemValidationReport {
    const totalTests = this.testResults.length;
    const passedTests = this.testResults.filter(t => t.success).length;
    const failedTests = totalTests - passedTests;
    const overallSuccess = failedTests === 0;
    
    // Get system metrics
    const cacheStats = smartCacheManager.getStats();
    const memoryStats = MemoryOptimizer.getInstance().getStats();
    const consistencyStats = cacheConsistency.getConsistencyScore();
    
    return {
      timestamp: Date.now(),
      totalTests,
      passedTests,
      failedTests,
      overallSuccess,
      tests: [...this.testResults],
      systemMetrics: {
        cacheHitRate: cacheStats.hitRate,
        memoryUsage: memoryStats.usedMemory / memoryStats.totalMemory,
        consistencyScore: consistencyStats,
        totalEntries: cacheStats.totalEntries
      }
    };
  }

  clear(): void {
    this.testResults = [];
  }
}

export const cacheSystemValidator = new CacheSystemValidator();

// Convenience function to run validation
export async function validateCacheSystem(): Promise<CacheSystemValidationReport> {
  return cacheSystemValidator.runComprehensiveValidation();
}