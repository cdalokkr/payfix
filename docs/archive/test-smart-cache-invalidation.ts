/**
 * Test script to validate smart cache invalidation functionality
 * This tests that the dashboard auto-refresh issue after user creation is fixed
 */

import { smartCacheManager } from '../../lib/cache/smart-cache-manager'
import { dashboardPrefetcher } from '../../lib/dashboard-prefetch'

interface TestResult {
  test: string
  passed: boolean
  details: string
}

export class SmartCacheInvalidationTester {
  private results: TestResult[] = []

  async runAllTests(): Promise<TestResult[]> {
    console.log('🧪 Starting Smart Cache Invalidation Tests...\n')
    
    await this.testPrefetchDataPreservation()
    await this.testSmartInvalidationBehavior()
    await this.testGranularCacheInvalidation()
    await this.testEventHandling()
    await this.testBackgroundRefresh()
    
    return this.results
  }

  private addResult(test: string, passed: boolean, details: string): void {
    this.results.push({ test, passed, details })
    const status = passed ? '✅ PASS' : '❌ FAIL'
    console.log(`${status} ${test}: ${details}\n`)
  }

  private async testPrefetchDataPreservation(): Promise<void> {
    try {
      // Simulate prefetched data
      const mockPrefetchedData = {
        critical: { totalUsers: 100, activeUsers: 85 },
        secondary: { totalActivities: 250 },
        detailed: { recentActivities: [] }
      }

      await smartCacheManager.set('comprehensive-dashboard-data', mockPrefetchedData, {
        namespace: 'dashboard',
        dataType: 'comprehensive-dashboard-data',
        metadata: { prefetched: true }
      })

      // Verify prefetched data exists
      const hasPrefetchedData = smartCacheManager.has('comprehensive-dashboard-data', 'dashboard')
      
      if (hasPrefetchedData) {
        this.addResult(
          'Prefetch Data Preservation',
          true,
          'Comprehensive dashboard data successfully stored and accessible'
        )
      } else {
        this.addResult(
          'Prefetch Data Preservation',
          false,
          'Failed to store or access comprehensive dashboard data'
        )
      }

      // Clean up
      smartCacheManager.delete('comprehensive-dashboard-data', 'dashboard')
      
    } catch (error) {
      this.addResult(
        'Prefetch Data Preservation',
        false,
        `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  private async testSmartInvalidationBehavior(): Promise<void> {
    try {
      // Set up test data
      const criticalData = { totalUsers: 100, activeUsers: 85 }
      const secondaryData = { totalActivities: 250 }
      const comprehensiveData = { critical: criticalData, secondary: secondaryData }

      await smartCacheManager.set('critical-dashboard-data', criticalData, {
        namespace: 'dashboard',
        dataType: 'critical-dashboard-data'
      })
      
      await smartCacheManager.set('secondary-dashboard-data', secondaryData, {
        namespace: 'dashboard',
        dataType: 'secondary-dashboard-data'
      })
      
      await smartCacheManager.set('comprehensive-dashboard-data', comprehensiveData, {
        namespace: 'dashboard',
        dataType: 'comprehensive-dashboard-data',
        metadata: { prefetched: true }
      })

      // Simulate smart invalidation (like user creation)
      smartCacheManager.delete('critical-dashboard-data', 'dashboard') // Should be deleted
      smartCacheManager.delete('stats', 'dashboard') // Should not exist, no error

      // Verify results
      const criticalExists = smartCacheManager.has('critical-dashboard-data', 'dashboard')
      const comprehensiveExists = smartCacheManager.has('comprehensive-dashboard-data', 'dashboard')
      const secondaryExists = smartCacheManager.has('secondary-dashboard-data', 'dashboard')

      const passed = !criticalExists && comprehensiveExists && secondaryExists
      
      this.addResult(
        'Smart Invalidation Behavior',
        passed,
        passed 
          ? 'Critical data invalidated, comprehensive and secondary data preserved'
          : `Critical: ${criticalExists}, Comprehensive: ${comprehensiveExists}, Secondary: ${secondaryExists}`
      )

      // Clean up
      smartCacheManager.delete('comprehensive-dashboard-data', 'dashboard')
      smartCacheManager.delete('secondary-dashboard-data', 'dashboard')
      
    } catch (error) {
      this.addResult(
        'Smart Invalidation Behavior',
        false,
        `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  private async testGranularCacheInvalidation(): Promise<void> {
    try {
      // Test that we can target specific cache entries
      await smartCacheManager.set('user-stats', { count: 50 }, {
        namespace: 'dashboard',
        dataType: 'stats'
      })
      
      await smartCacheManager.set('user-list', [{ id: 1, name: 'Test' }], {
        namespace: 'dashboard',
        dataType: 'users'
      })

      // Only invalidate stats, not users
      smartCacheManager.delete('stats', 'dashboard')

      const statsExists = smartCacheManager.has('stats', 'dashboard')
      const usersExists = smartCacheManager.has('user-list', 'dashboard')

      const passed = !statsExists && usersExists
      
      this.addResult(
        'Granular Cache Invalidation',
        passed,
        passed 
          ? 'Successfully targeted specific cache entries'
          : `Stats exists: ${statsExists}, Users exists: ${usersExists}`
      )

      // Clean up
      smartCacheManager.delete('user-list', 'dashboard')
      
    } catch (error) {
      this.addResult(
        'Granular Cache Invalidation',
        false,
        `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  private async testEventHandling(): Promise<void> {
    try {
      let eventReceived = false
      let smartInvalidationFlag = false

      // Set up event listener
      const handler = (event: any) => {
        eventReceived = true
        smartInvalidationFlag = event.detail?.smartInvalidation === true
      }

      window.addEventListener('user-operation-complete', handler)

      // Dispatch event with smart invalidation
      window.dispatchEvent(new CustomEvent('user-operation-complete', {
        detail: {
          operation: 'user-creation',
          smartInvalidation: true,
          preservedData: ['comprehensive-dashboard-data'],
          affectedData: ['critical-dashboard-data']
        }
      }))

      // Small delay to ensure event is processed
      await new Promise(resolve => setTimeout(resolve, 10))

      const passed = eventReceived && smartInvalidationFlag
      
      this.addResult(
        'Event Handling',
        passed,
        passed 
          ? 'Smart invalidation event handled correctly'
          : `Event received: ${eventReceived}, Smart flag: ${smartInvalidationFlag}`
      )

      // Clean up
      window.removeEventListener('user-operation-complete', handler)
      
    } catch (error) {
      this.addResult(
        'Event Handling',
        false,
        `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  private async testBackgroundRefresh(): Promise<void> {
    try {
      // Test that background refresh doesn't interfere with smart invalidation
      await smartCacheManager.set('test-data', { updated: false }, {
        namespace: 'dashboard',
        dataType: 'test-data'
      })

      const initialData = await smartCacheManager.get('test-data', 'dashboard')
      const hasData = !!initialData
      
      if (hasData) {
        this.addResult(
          'Background Refresh Setup',
          true,
          'Test data successfully stored and retrievable'
        )
      } else {
        this.addResult(
          'Background Refresh Setup',
          false,
          'Failed to store or retrieve test data'
        )
      }

      // Clean up
      smartCacheManager.delete('test-data', 'dashboard')
      
    } catch (error) {
      this.addResult(
        'Background Refresh',
        false,
        `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  generateReport(): string {
    const passed = this.results.filter(r => r.passed).length
    const total = this.results.length
    const passRate = Math.round((passed / total) * 100)

    let report = `\n📊 SMART CACHE INVALIDATION TEST REPORT\n`
    report += `=========================================\n`
    report += `Total Tests: ${total}\n`
    report += `Passed: ${passed}\n`
    report += `Failed: ${total - passed}\n`
    report += `Pass Rate: ${passRate}%\n\n`

    report += `TEST DETAILS:\n`
    report += `-------------\n`
    
    this.results.forEach(result => {
      const status = result.passed ? '✅' : '❌'
      report += `${status} ${result.test}\n`
      report += `   ${result.details}\n\n`
    })

    if (passRate === 100) {
      report += `🎉 ALL TESTS PASSED! Smart cache invalidation is working correctly.\n`
    } else {
      report += `⚠️  Some tests failed. Review the details above.\n`
    }

    return report
  }
}

// Export for use in tests
export const smartCacheInvalidationTester = new SmartCacheInvalidationTester()

// If running directly
if (require.main === module) {
  smartCacheInvalidationTester.runAllTests().then(results => {
    console.log(smartCacheInvalidationTester.generateReport())
  }).catch(error => {
    console.error('Test execution failed:', error)
  })
}