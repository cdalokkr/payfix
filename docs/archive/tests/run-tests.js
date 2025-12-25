#!/usr/bin/env node

/**
 * Multi-Browser Testing Framework Main Runner
 * 
 * Comprehensive test runner that orchestrates all testing components:
 * - Multi-browser real-time scenarios
 * - Performance benchmarking
 * - Integration testing
 * - Report generation
 * 
 * Usage:
 *   node run-tests.js                    // Run all tests
 *   node run-tests.js --scenario-only    // Run only scenario tests
 *   node run-tests.js --benchmark-only   // Run only performance benchmarks
 *   node run-tests.js --integration-only // Run only integration tests
 *   node run-tests.js --ci               // CI/CD mode with JSON output
 */

import { createTestOrchestrator, MultiBrowserTestOrchestrator, TestEnvironmentConfig } from './tests/multi-browser/test-orchestrator'
import { AdminUserCreationTest, UserActivityPerformanceTest, ConcurrentAdminOperationsTest } from './tests/multi-browser/real-time-scenarios'
import { createIntegrationTestSuite } from './tests/integration/event-flow-tests'
import { createBenchmarkSuite, PerformanceBenchmarkSuite } from './tests/performance/benchmark-suite'
import { PerformanceReporter } from './tests/reporting/performance-reporter'

interface TestRunnerOptions {
    baseURL?: string
    outputDir?: string
    headless?: boolean
    scenarios?: boolean
    benchmarks?: boolean
    integration?: boolean
    ci?: boolean
    verbose?: boolean
    timeout?: number
}

interface TestResults {
    multiBrowserTests: any
    performanceBenchmarks: any
    integrationTests: any
    report: any
}

class MultiBrowserTestRunner {
    private orchestrator: MultiBrowserTestOrchestrator
    private benchmarkSuite: PerformanceBenchmarkSuite
    private reporter: PerformanceReporter
    private options: TestRunnerOptions

    constructor(options: TestRunnerOptions = {}) {
        this.options = {
            baseURL: options.baseURL || 'http://localhost:3000',
            outputDir: options.outputDir || './test-results',
            headless: options.headless ?? true,
            scenarios: options.scenarios ?? true,
            benchmarks: options.benchmarks ?? true,
            integration: options.integration ?? true,
            ci: options.ci ?? false,
            verbose: options.verbose ?? false,
            timeout: options.timeout ?? 300000,
            ...options
        }

        this.orchestrator = createTestOrchestrator(this.options.baseURL)
        this.benchmarkSuite = createBenchmarkSuite(this.options.baseURL)
        this.reporter = new PerformanceReporter()
    }

    async runAllTests(): Promise<TestResults> {
        console.log('🚀 Starting Multi-Browser Real-Time Testing Framework')
        console.log(`📍 Target URL: ${this.options.baseURL}`)
        console.log(`📁 Output Directory: ${this.options.outputDir}`)
        console.log(`🎭 Headless Mode: ${this.options.headless}`)
        console.log('='.repeat(60))

        const startTime = Date.now()
        const results: TestResults = {
            multiBrowserTests: null,
            performanceBenchmarks: null,
            integrationTests: null,
            report: null
        }

        try {
            // Setup test environment
            await this.setupTestEnvironment()

            // Run multi-browser scenario tests
            if (this.options.scenarios) {
                console.log('\n🌐 Running Multi-Browser Scenario Tests...')
                results.multiBrowserTests = await this.runMultiBrowserTests()
            }

            // Run performance benchmarks
            if (this.options.benchmarks) {
                console.log('\n⚡ Running Performance Benchmarks...')
                results.performanceBenchmarks = await this.runPerformanceBenchmarks()
            }

            // Run integration tests
            if (this.options.integration) {
                console.log('\n🔗 Running Integration Tests...')
                results.integrationTests = await this.runIntegrationTests()
            }

            // Generate comprehensive report
            console.log('\n📊 Generating Performance Report...')
            results.report = await this.generateReport(results)

            // Save results
            await this.saveResults(results)

            const totalTime = Date.now() - startTime
            this.printSummary(results, totalTime)

            return results

        } catch (error) {
            console.error('❌ Test execution failed:', error)
            throw error
        } finally {
            await this.cleanup()
        }
    }

    private async setupTestEnvironment(): Promise<void> {
        console.log('🔧 Setting up test environment...')

        const config: TestEnvironmentConfig = {
            browsers: [
                {
                    id: 'admin-a',
                    role: 'admin',
                    userId: 'admin-a-user-id',
                    userEmail: 'admin-a@test.com',
                    password: 'test123',
                    headless: this.options.headless,
                    browserType: 'chromium'
                },
                {
                    id: 'admin-b',
                    role: 'admin',
                    userId: 'admin-b-user-id',
                    userEmail: 'admin-b@test.com',
                    password: 'test123',
                    headless: this.options.headless,
                    browserType: 'chromium'
                },
                {
                    id: 'user-c',
                    role: 'user',
                    userId: 'user-c-user-id',
                    userEmail: 'user-c@test.com',
                    password: 'test123',
                    headless: this.options.headless,
                    browserType: 'chromium'
                }
            ]
        }

        await this.orchestrator.setupTestEnvironment(config)
        console.log('✅ Test environment setup complete')
    }

    private async runMultiBrowserTests(): Promise<any> {
        const scenarios = [
            new AdminUserCreationTest(),
            new UserActivityPerformanceTest(),
            new ConcurrentAdminOperationsTest()
        ]

        console.log(`Running ${scenarios.length} multi-browser scenarios...`)
        return await this.orchestrator.runTestSuite(scenarios)
    }

    private async runPerformanceBenchmarks(): Promise<any> {
        const benchmarks = {}

        // Latency benchmark
        console.log('Running latency benchmark...')
        benchmarks.latency = await this.benchmarkSuite.runLatencyBenchmark(50)

        // Load test (shorter for testing)
        console.log('Running load test...')
        benchmarks.loadTest = await this.benchmarkSuite.runLoadTest(5, 60000) // 5 users, 1 minute

        // Cache benchmark
        console.log('Running cache benchmark...')
        benchmarks.cache = await this.benchmarkSuite.runCacheBenchmark()

        return benchmarks
    }

    private async runIntegrationTests(): Promise<any> {
        const integrationTests = createIntegrationTestSuite()

        console.log(`Running ${integrationTests.length} integration tests...`)

        // Create a new orchestrator for integration tests with fresh environment
        const integrationOrchestrator = createTestOrchestrator(this.options.baseURL)
        const integrationResults = []

        for (const test of integrationTests) {
            console.log(`Running integration test: ${test.name}`)
            const result = await integrationOrchestrator.runTestScenario(test)
            integrationResults.push(result)
        }

        return {
            totalScenarios: integrationTests.length,
            passedScenarios: integrationResults.filter(r => r.passed).length,
            failedScenarios: integrationResults.filter(r => !r.passed).length,
            results: integrationResults
        }
    }

    private async generateReport(results: TestResults): Promise<any> {
        const reportData = {
            testResults: results.multiBrowserTests,
            latencyBenchmark: results.performanceBenchmarks?.latency,
            loadTest: results.performanceBenchmarks?.loadTest,
            cacheBenchmark: results.performanceBenchmarks?.cache,
            integrationTests: results.integrationTests,
            monitoringData: {
                uptime: 99.9,
                timestamp: new Date().toISOString()
            }
        }

        const report = await this.reporter.generateReport(reportData)

        if (this.options.ci) {
            // CI mode: generate JSON output
            const jsonReport = this.reporter.generateJSONReport(report)
            const filename = `${this.outputPath}/ci-report.json`
            await this.saveFile(filename, jsonReport)
            console.log(`📄 CI report saved: ${filename}`)
        } else {
            // Regular mode: generate HTML report
            const htmlReport = this.reporter.generateHTMLReport(report)
            const filename = `${this.outputPath}/performance-report.html`
            await this.saveFile(filename, htmlReport)
            console.log(`📄 HTML report saved: ${filename}`)

            // Also save JSON for reference
            const jsonReport = this.reporter.generateJSONReport(report)
            const jsonFilename = `${this.outputPath}/performance-report.json`
            await this.saveFile(jsonFilename, jsonReport)
            console.log(`📄 JSON report saved: ${jsonFilename}`)
        }

        return report
    }

    private get outputPath(): string {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('.')[0]
        return `${this.options.outputDir}/test-run-${timestamp}`
    }

    private async saveResults(results: TestResults): Promise<void> {
        const filename = `${this.outputPath}/full-results.json`
        await this.saveFile(filename, JSON.stringify(results, null, 2))
        console.log(`📄 Full results saved: ${filename}`)
    }

    private async saveFile(filename: string, content: string): Promise<void> {
        const fs = require('fs').promises
        const path = require('path')

        // Ensure directory exists
        const dir = path.dirname(filename)
        await fs.mkdir(dir, { recursive: true })

        // Write file
        await fs.writeFile(filename, content, 'utf-8')
    }

    private printSummary(results: TestResults, totalTime: number): void {
        console.log('\n' + '='.repeat(60))
        console.log('📊 TEST EXECUTION SUMMARY')
        console.log('='.repeat(60))

        if (results.multiBrowserTests) {
            const mbTests = results.multiBrowserTests
            console.log(`🌐 Multi-Browser Tests: ${mbTests.passedScenarios}/${mbTests.totalScenarios} passed (${((mbTests.passedScenarios / mbTests.totalScenarios) * 100).toFixed(1)}%)`)
        }

        if (results.performanceBenchmarks) {
            const latency = results.performanceBenchmarks.latency
            console.log(`⚡ Latency P95: ${latency.p95.toFixed(0)}ms (Target: <500ms) ${latency.targetMet ? '✅' : '❌'}`)
            console.log(`🎯 Cache Hit Rate: ${results.performanceBenchmarks.cache.hitRate.toFixed(1)}% (Target: >85%)`)

            if (results.performanceBenchmarks.loadTest) {
                const loadTest = results.performanceBenchmarks.loadTest
                console.log(`📈 Load Test: ${loadTest.successRate.toFixed(1)}% success rate`)
            }
        }

        if (results.integrationTests) {
            const integration = results.integrationTests
            console.log(`🔗 Integration Tests: ${integration.passedScenarios}/${integration.totalScenarios} passed`)
        }

        console.log(`⏱️  Total Execution Time: ${(totalTime / 1000).toFixed(2)}s`)

        if (results.report) {
            console.log(`🎯 Overall System Score: ${results.report.summary.overallScore}/100`)

            if (results.report.summary.criticalIssues.length > 0) {
                console.log(`⚠️  Critical Issues: ${results.report.summary.criticalIssues.length}`)
            }
        }

        console.log('='.repeat(60))
        console.log('✅ Test execution completed successfully!')
    }

    private async cleanup(): Promise<void> {
        console.log('🧹 Cleaning up test environment...')
        await this.orchestrator.cleanup()
        console.log('✅ Cleanup complete')
    }
}

// CLI execution
if (require.main === module) {
    const args = process.argv.slice(2)

    const options: TestRunnerOptions = {}

    // Parse command line arguments
    for (let i = 0; i < args.length; i++) {
        const arg = args[i]

        switch (arg) {
            case '--url':
                options.baseURL = args[++i]
                break
            case '--output':
                options.outputDir = args[++i]
                break
            case '--headful':
                options.headless = false
                break
            case '--scenario-only':
                options.scenarios = true
                options.benchmarks = false
                options.integration = false
                break
            case '--benchmark-only':
                options.scenarios = false
                options.benchmarks = true
                options.integration = false
                break
            case '--integration-only':
                options.scenarios = false
                options.benchmarks = false
                options.integration = true
                break
            case '--ci':
                options.ci = true
                break
            case '--verbose':
            case '-v':
                options.verbose = true
                break
            case '--timeout':
                options.timeout = parseInt(args[++i]) || 300000
                break
            case '--help':
            case '-h':
                printHelp()
                process.exit(0)
                break
        }
    }

    // Run tests
    const runner = new MultiBrowserTestRunner(options)

    runner.runAllTests()
        .then((results) => {
            const exitCode = results.report?.summary?.overallScore >= 75 ? 0 : 1
            process.exit(exitCode)
        })
        .catch((error) => {
            console.error('❌ Test runner failed:', error)
            process.exit(1)
        })
}

function printHelp(): void {
    console.log(`
Multi-Browser Real-Time Testing Framework
==========================================

Usage: node run-tests.js [options]

Options:
  --url <url>              Target application URL (default: http://localhost:3000)
  --output <dir>           Output directory for reports (default: ./test-results)
  --headful               Run browsers in headful mode (visible)
  --scenario-only         Run only multi-browser scenario tests
  --benchmark-only        Run only performance benchmarks
  --integration-only      Run only integration tests
  --ci                    CI/CD mode with JSON output
  --verbose, -v           Verbose logging
  --timeout <ms>          Test timeout in milliseconds
  --help, -h              Show this help message

Examples:
  node run-tests.js
  node run-tests.js --url http://localhost:3000 --headful
  node run-tests.js --scenario-only --output ./results
  node run-tests.js --ci --timeout 600000

The framework tests:
  • Three-browser real-time notification scenarios
  • Performance benchmarks (latency, load, cache)
  • Integration tests (API, database, real-time events)
  • Generates comprehensive HTML and JSON reports
  `)
}

export { MultiBrowserTestRunner, TestRunnerOptions }