/**
 * Automated Test Execution Framework
 * Orchestrates and executes all test suites in sequence
 * Generates comprehensive validation reports
 */

import { exec } from 'child_process'
import { promisify } from 'util'
import * as path from 'path'
import * as fs from 'fs'

const execAsync = promisify(exec)

interface TestSuite {
  name: string
  path: string
  priority: 'critical' | 'high' | 'medium' | 'low'
  category: 'performance' | 'security' | 'integration' | 'ux'
  estimatedDuration: number // in minutes
  dependencies?: string[]
}

interface TestExecutionResult {
  suiteName: string
  status: 'passed' | 'failed' | 'skipped' | 'running'
  duration: number
  exitCode: number
  output: string
  error?: string
  timestamp: string
}

interface TestExecutionReport {
  overallStatus: 'success' | 'partial_success' | 'failure'
  totalSuites: number
  passedSuites: number
  failedSuites: number
  skippedSuites: number
  totalDuration: number
  startTime: string
  endTime: string
  results: TestExecutionResult[]
  recommendations: string[]
  deploymentReadiness: {
    performance: number
    security: number
    integration: number
    ux: number
    overall: number
  }
}

class AutomatedTestExecutor {
  private testSuites: TestSuite[] = [
    {
      name: 'Performance Validation Suite',
      path: 'tests/comprehensive-performance-validation-suite.ts',
      priority: 'critical',
      category: 'performance',
      estimatedDuration: 15
    },
    {
      name: 'Security Validation Suite',
      path: 'tests/comprehensive-security-validation-suite.ts',
      priority: 'critical',
      category: 'security',
      estimatedDuration: 20
    },
    {
      name: 'Integration Testing Suite',
      path: 'tests/comprehensive-integration-testing-suite.ts',
      priority: 'high',
      category: 'integration',
      estimatedDuration: 25
    },
    {
      name: 'User Experience Validation Suite',
      path: 'tests/comprehensive-ux-validation-suite.ts',
      priority: 'high',
      category: 'ux',
      estimatedDuration: 20
    }
  ]

  private executionResults: TestExecutionResult[] = []
  private startTime: Date
  private isRunning = false

  constructor() {
    this.startTime = new Date()
  }

  async executeAllSuites(): Promise<TestExecutionReport> {
    if (this.isRunning) {
      throw new Error('Test execution already in progress')
    }

    this.isRunning = true
    this.executionResults = []
    this.startTime = new Date()

    console.log('🚀 Starting Automated Test Execution Framework')
    console.log(`📊 ${this.testSuites.length} test suites to execute`)
    console.log(`⏱️  Estimated total duration: ${this.getTotalEstimatedDuration()} minutes\n`)

    // Execute test suites in priority order
    const sortedSuites = this.sortSuitesByPriority()
    
    for (const suite of sortedSuites) {
      await this.executeTestSuite(suite)
      
      // Small delay between suites
      await this.delay(2000)
    }

    return this.generateExecutionReport()
  }

  private sortSuitesByPriority(): TestSuite[] {
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 }
    return this.testSuites.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority])
  }

  private async executeTestSuite(suite: TestSuite): Promise<void> {
    const startTime = performance.now()
    const timestamp = new Date().toISOString()
    
    console.log(`\n🔄 Executing: ${suite.name}`)
    console.log(`📁 Path: ${suite.path}`)
    console.log(`🎯 Priority: ${suite.priority}`)
    console.log(`⏰ Estimated duration: ${suite.estimatedDuration} minutes`)

    try {
      // Check if test file exists
      const fullPath = path.join(process.cwd(), suite.path)
      if (!fs.existsSync(fullPath)) {
        throw new Error(`Test file not found: ${fullPath}`)
      }

      // Prepare Jest command
      const jestCommand = this.buildJestCommand(suite)
      console.log(`⚙️  Command: ${jestCommand}`)

      // Execute test suite
      const { stdout, stderr } = await execAsync(jestCommand, {
        timeout: suite.estimatedDuration * 60 * 1000 + 30000, // Add 30s buffer
        cwd: process.cwd()
      })

      const duration = performance.now() - startTime
      const output = stdout + (stderr ? `\nStderr:\n${stderr}` : '')

      const result: TestExecutionResult = {
        suiteName: suite.name,
        status: 'passed',
        duration,
        exitCode: 0,
        output,
        timestamp
      }

      this.executionResults.push(result)
      
      console.log(`✅ PASSED: ${suite.name} (${(duration / 1000).toFixed(2)}s)`)
      
      // Log summary from output
      this.logTestSummary(output, suite.category)

    } catch (error) {
      const duration = performance.now() - startTime
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      
      const result: TestExecutionResult = {
        suiteName: suite.name,
        status: 'failed',
        duration,
        exitCode: error instanceof Error && 'code' in error ? (error as any).code : 1,
        output: '',
        error: errorMessage,
        timestamp
      }

      this.executionResults.push(result)
      
      console.log(`❌ FAILED: ${suite.name} (${(duration / 1000).toFixed(2)}s)`)
      console.log(`💥 Error: ${errorMessage}`)
    }
  }

  private buildJestCommand(suite: TestSuite): string {
    const jestConfig = '--config=jest.config.js --testPathPattern='
    const testFile = suite.path.replace('tests/', '').replace('.ts', '')
    const options = [
      '--verbose',
      '--runInBand',
      '--detectOpenHandles',
      '--forceExit',
      '--clearCache'
    ]

    return `npx jest ${jestConfig}"${testFile}" ${options.join(' ')}`
  }

  private logTestSummary(output: string, category: string): void {
    const lines = output.split('\n')
    const summaryLines = lines.filter(line => 
      line.includes('Tests:') || 
      line.includes(' Suites:') || 
      line.includes('Time:')
    )

    if (summaryLines.length > 0) {
      console.log('📈 Test Summary:')
      summaryLines.forEach(line => console.log(`   ${line.trim()}`))
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  private getTotalEstimatedDuration(): number {
    return this.testSuites.reduce((total, suite) => total + suite.estimatedDuration, 0)
  }

  private generateExecutionReport(): TestExecutionReport {
    const endTime = new Date()
    const totalDuration = endTime.getTime() - this.startTime.getTime()
    
    const passedSuites = this.executionResults.filter(r => r.status === 'passed').length
    const failedSuites = this.executionResults.filter(r => r.status === 'failed').length
    const skippedSuites = this.executionResults.filter(r => r.status === 'skipped').length
    
    let overallStatus: 'success' | 'partial_success' | 'failure'
    if (failedSuites === 0) {
      overallStatus = 'success'
    } else if (failedSuites <= this.testSuites.length * 0.2) { // Max 20% failure rate
      overallStatus = 'partial_success'
    } else {
      overallStatus = 'failure'
    }

    // Calculate category scores
    const categoryScores = this.calculateCategoryScores()
    
    // Generate recommendations
    const recommendations = this.generateRecommendations()

    const report: TestExecutionReport = {
      overallStatus,
      totalSuites: this.testSuites.length,
      passedSuites,
      failedSuites,
      skippedSuites,
      totalDuration,
      startTime: this.startTime.toISOString(),
      endTime: endTime.toISOString(),
      results: this.executionResults,
      recommendations,
      deploymentReadiness: categoryScores
    }

    this.isRunning = false
    return report
  }

  private calculateCategoryScores(): {
    performance: number
    security: number
    integration: number
    ux: number
    overall: number
  } {
    const categoryResults = {
      performance: this.executionResults.filter(r =>
        this.testSuites.find(s => s.name === r.suiteName && s.category === 'performance')
      ),
      security: this.executionResults.filter(r =>
        this.testSuites.find(s => s.name === r.suiteName && s.category === 'security')
      ),
      integration: this.executionResults.filter(r =>
        this.testSuites.find(s => s.name === r.suiteName && s.category === 'integration')
      ),
      ux: this.executionResults.filter(r =>
        this.testSuites.find(s => s.name === r.suiteName && s.category === 'ux')
      )
    }

    const scores = {
      performance: this.calculateCategoryScore(categoryResults.performance),
      security: this.calculateCategoryScore(categoryResults.security),
      integration: this.calculateCategoryScore(categoryResults.integration),
      ux: this.calculateCategoryScore(categoryResults.ux),
      overall: 0 // Initialize the overall score
    }

    scores.overall = (scores.performance + scores.security + scores.integration + scores.ux) / 4

    return scores
  }

  private calculateCategoryScore(results: TestExecutionResult[]): number {
    if (results.length === 0) return 0
    
    const passedResults = results.filter(r => r.status === 'passed').length
    return (passedResults / results.length) * 100
  }

  private generateRecommendations(): string[] {
    const recommendations: string[] = []
    
    // Check for failed suites
    const failedResults = this.executionResults.filter(r => r.status === 'failed')
    if (failedResults.length > 0) {
      recommendations.push(`Address ${failedResults.length} failed test suite(s): ${failedResults.map(r => r.suiteName).join(', ')}`)
    }

    // Check for slow execution
    const slowResults = this.executionResults.filter(r => r.duration > 300000) // > 5 minutes
    if (slowResults.length > 0) {
      recommendations.push('Optimize slow test suites for faster execution')
    }

    // Check deployment readiness
    const categoryScores = this.calculateCategoryScores()
    if (categoryScores.overall < 90) {
      recommendations.push('Improve overall test coverage to achieve 90%+ readiness')
    }

    if (categoryScores.security < 95) {
      recommendations.push('Address security issues - critical for production deployment')
    }

    if (categoryScores.performance < 85) {
      recommendations.push('Optimize performance to meet production requirements')
    }

    return recommendations
  }

  public async executeSpecificSuite(suiteName: string): Promise<TestExecutionResult> {
    const suite = this.testSuites.find(s => s.name === suiteName)
    if (!suite) {
      throw new Error(`Test suite not found: ${suiteName}`)
    }

    await this.executeTestSuite(suite)
    const result = this.executionResults.find(r => r.suiteName === suiteName)
    
    if (!result) {
      throw new Error(`Failed to find execution result for: ${suiteName}`)
    }
    
    return result
  }

  public getTestSuites(): TestSuite[] {
    return [...this.testSuites]
  }

  public getExecutionStatus(): { isRunning: boolean; results: TestExecutionResult[] } {
    return {
      isRunning: this.isRunning,
      results: [...this.executionResults]
    }
  }
}

// CLI interface
async function main() {
  const executor = new AutomatedTestExecutor()
  
  try {
    console.log('='.repeat(80))
    console.log('COMPREHENSIVE TEST VALIDATION FRAMEWORK')
    console.log('Testing all login dashboard optimizations')
    console.log('='.repeat(80))
    
    const report = await executor.executeAllSuites()
    
    // Save report to file
    const reportPath = path.join(process.cwd(), 'test-execution-report.json')
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2))
    
    console.log('\n' + '='.repeat(80))
    console.log('FINAL EXECUTION REPORT')
    console.log('='.repeat(80))
    
    console.log(`\n🎯 Overall Status: ${report.overallStatus.toUpperCase()}`)
    console.log(`📊 Test Suites: ${report.passedSuites}/${report.totalSuites} passed`)
    console.log(`⏱️  Total Duration: ${(report.totalDuration / 1000 / 60).toFixed(2)} minutes`)
    console.log(`🚀 Deployment Readiness: ${report.deploymentReadiness.overall.toFixed(1)}%`)
    
    console.log('\n📈 Category Scores:')
    console.log(`   Performance: ${report.deploymentReadiness.performance.toFixed(1)}%`)
    console.log(`   Security: ${report.deploymentReadiness.security.toFixed(1)}%`)
    console.log(`   Integration: ${report.deploymentReadiness.integration.toFixed(1)}%`)
    console.log(`   UX: ${report.deploymentReadiness.ux.toFixed(1)}%`)
    
    if (report.recommendations.length > 0) {
      console.log('\n💡 Recommendations:')
      report.recommendations.forEach(rec => console.log(`   • ${rec}`))
    }
    
    console.log(`\n📄 Full report saved to: ${reportPath}`)
    
    // Exit with appropriate code
    const exitCode = report.overallStatus === 'success' ? 0 : 
                    report.overallStatus === 'partial_success' ? 1 : 2
    
    process.exit(exitCode)
    
  } catch (error) {
    console.error('\n💥 Test execution failed:')
    console.error(error instanceof Error ? error.message : 'Unknown error')
    process.exit(3)
  }
}

// Run if called directly
if (require.main === module) {
  main()
}

export { AutomatedTestExecutor }
export type { TestExecutionReport, TestSuite, TestExecutionResult }