// ============================================
// lib/cache/cache-validation-test.ts
// Simple cache system validation test
// ============================================

import { advancedCacheManager } from './advanced-cache-manager';
import { smartCacheManager } from './smart-cache-manager';
import { MemoryOptimizer } from './memory-optimizer';

export interface ValidationResult {
  name: string
  passed: boolean
  message?: string
  error?: string
}

export async function runCacheValidation(): Promise<{
  results: ValidationResult[]
  summary: {
    total: number
    passed: number
    failed: number
  }
}> {
  const results: ValidationResult[] = [];
  
  console.log('🧪 Starting cache system validation...');
  
  // Test 1: Basic operations
  try {
    await advancedCacheManager.set('test-key', { data: 'test-value' });
    const retrieved = await advancedCacheManager.get<{ data: string }>('test-key');
    
    if (retrieved && retrieved.data === 'test-value') {
      results.push({ name: 'Basic Cache Operations', passed: true, message: 'Set/get working correctly' });
    } else {
      results.push({ name: 'Basic Cache Operations', passed: false, error: 'Retrieved data mismatch' });
    }
  } catch (error) {
    results.push({ name: 'Basic Cache Operations', passed: false, error: (error as Error).message });
  }
  
  // Test 2: Compression
  try {
    const largeData = { large: 'x'.repeat(2000) };
    await advancedCacheManager.set('large-data-key', largeData);
    const retrieved = await advancedCacheManager.get<{ large: string }>('large-data-key');
    
    if (retrieved && retrieved.large.length === 2000) {
      results.push({ name: 'Compression System', passed: true, message: 'Compression/decompression working' });
    } else {
      results.push({ name: 'Compression System', passed: false, error: 'Compression failed' });
    }
  } catch (error) {
    results.push({ name: 'Compression System', passed: false, error: (error as Error).message });
  }
  
  // Test 3: Memory optimization
  try {
    const memoryOptimizer = MemoryOptimizer.getInstance();
    const stats = memoryOptimizer.getStats();
    
    if (stats && typeof stats.usedMemory === 'number') {
      results.push({ name: 'Memory Optimization', passed: true, message: `Memory pressure: ${stats.memoryPressure}` });
    } else {
      results.push({ name: 'Memory Optimization', passed: false, error: 'Memory stats unavailable' });
    }
  } catch (error) {
    results.push({ name: 'Memory Optimization', passed: false, error: (error as Error).message });
  }
  
  // Test 4: Error handling
  try {
    try {
      await advancedCacheManager.set('', { data: 'should fail' });
      results.push({ name: 'Error Handling', passed: false, error: 'Empty key validation failed' });
    } catch (error) {
      if ((error as Error).message.includes('non-empty string')) {
        results.push({ name: 'Error Handling', passed: true, message: 'Input validation working' });
      } else {
        results.push({ name: 'Error Handling', passed: false, error: 'Unexpected error message' });
      }
    }
  } catch (error) {
    results.push({ name: 'Error Handling', passed: false, error: (error as Error).message });
  }
  
  // Test 5: Metrics
  try {
    const metrics = advancedCacheManager.getMetrics();
    
    if (metrics && typeof metrics.totalOperations === 'number') {
      results.push({ name: 'Metrics Collection', passed: true, message: `Total operations: ${metrics.totalOperations}` });
    } else {
      results.push({ name: 'Metrics Collection', passed: false, error: 'Metrics unavailable' });
    }
  } catch (error) {
    results.push({ name: 'Metrics Collection', passed: false, error: (error as Error).message });
  }
  
  // Test 6: Performance
  try {
    const start = Date.now();
    const testData = { timestamp: Date.now(), data: 'performance test' };
    
    // Run multiple operations
    const promises = Array.from({ length: 10 }, (_, i) => 
      advancedCacheManager.set(`perf-test-${i}`, { ...testData, id: i })
    );
    await Promise.all(promises);
    
    const duration = Date.now() - start;
    const avgTime = duration / 10;
    
    if (avgTime < 100) {
      results.push({ name: 'Performance Test', passed: true, message: `Average: ${avgTime.toFixed(2)}ms per operation` });
    } else {
      results.push({ name: 'Performance Test', passed: false, error: `Slow performance: ${avgTime.toFixed(2)}ms` });
    }
  } catch (error) {
    results.push({ name: 'Performance Test', passed: false, error: (error as Error).message });
  }
  
  // Cleanup test data
  try {
    smartCacheManager.clear();
  } catch (error) {
    console.warn('Cleanup failed:', error);
  }
  
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  
  console.log('✅ Cache validation completed:');
  console.log(`   Total: ${results.length}, Passed: ${passed}, Failed: ${failed}`);
  
  results.forEach(result => {
    const status = result.passed ? '✅' : '❌';
    console.log(`   ${status} ${result.name}${result.message ? `: ${result.message}` : ''}`);
    if (result.error) console.log(`      Error: ${result.error}`);
  });
  
  return {
    results,
    summary: {
      total: results.length,
      passed,
      failed
    }
  };
}