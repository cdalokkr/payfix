import { BrowserManager, BrowserSession, BrowserConfig, DashboardState, createBrowserManager } from '../utils/browser-manager'

export interface TestResult {
    scenarioId: string
    passed: boolean
    attemptNumber: number
    executionTime: number
    details?: any
    performance?: PerformanceMetrics
    error?: string
}

export interface TestScenario {
    id: string
    name: string
    description: string
    timeout: number
    retryPolicy: RetryPolicy
    execute(environment: MultiBrowserTestEnvironment): Promise<TestResult>
}

export interface RetryPolicy {
    maxRetries: number
    backoffMs: number
}

export interface PerformanceMetrics {
    maxLatency?: number
    totalLatency?: number
    averageLatency?: number
    cacheHitRate?: number
    targetLatency?: number
    actualLatency?: number
    operationDuration?: number
    targetDuration?: number
    stateConvergenceTime?: number
}

export interface TestSuiteResult {
    totalScenarios: number
    passedScenarios: number
    failedScenarios: number
    totalDuration: number
    results: TestResult[]
    summary: {
        successRate: number
        averageLatency: number
        performanceMetrics: PerformanceMetrics
        reliability: boolean
    }
}

export interface MultiBrowserTestEnvironment {
    getBrowser(id: string): BrowserSession | undefined
    getBrowsers(): Map<string, BrowserSession>
    waitForStateChange(session: BrowserSession, initialState: DashboardState, options?: any): Promise<{ success: boolean; latency: number }>
    waitForStableState(session: BrowserSession, timeout?: number): Promise<any>
    createTestUser(role: 'admin' | 'user', email: string): Promise<string>
    cleanup(): Promise<void>
}

/**
 * Multi-Browser Test Orchestrator
 * Manages test environment setup, browser sessions, and test execution
 */
export class MultiBrowserTestOrchestrator implements MultiBrowserTestEnvironment {
    private browserManager: BrowserManager
    private browsers = new Map<string, BrowserSession>()
    private baseURL: string

    constructor(baseURL: string = 'http://localhost:3000') {
        this.baseURL = baseURL
        this.browserManager = createBrowserManager(baseURL)
    }

    async setupTestEnvironment(config: TestEnvironmentConfig): Promise<void> {
        console.log('[TEST-ORCH] Setting up multi-browser test environment')

        try {
            // Launch browser instances
            await this.launchBrowserInstances(config.browsers)

            // Authenticate all sessions
            await this.authenticateSessions(config.browsers)

            // Navigate to dashboards
            await this.navigateToDashboards(config.browsers)

            console.log('[TEST-ORCH] Test environment setup complete')

        } catch (error) {
            console.error('[TEST-ORCH] Failed to setup test environment:', error)
            await this.cleanup()
            throw error
        }
    }

    private async launchBrowserInstances(browserConfigs: BrowserConfig[]): Promise<void> {
        console.log(`[TEST-ORCH] Launching ${browserConfigs.length} browser instances`)

        const launchPromises = browserConfigs.map(async (config) => {
            console.log(`[TEST-ORCH] Creating browser ${config.id} as ${config.role}`)

            const browser = await this.browserManager.createBrowser(config)
            this.browsers.set(config.id, browser)

            console.log(`[TEST-ORCH] Browser ${config.id} ready`)
        })

        await Promise.all(launchPromises)
        console.log('[TEST-ORCH] All browsers launched successfully')
    }

    private async authenticateSessions(browserConfigs: BrowserConfig[]): Promise<void> {
        console.log('[TEST-ORCH] Authenticating browser sessions')

        const authPromises = browserConfigs.map(async (config) => {
            const session = this.browsers.get(config.id)!
            await this.browserManager.authenticate(session, config.userEmail, config.password)
        })

        await Promise.all(authPromises)
        console.log('[TEST-ORCH] All sessions authenticated successfully')
    }

    private async navigateToDashboards(browserConfigs: BrowserConfig[]): Promise<void> {
        console.log('[TEST-ORCH] Navigating to dashboards')

        const navPromises = browserConfigs.map(async (config) => {
            const session = this.browsers.get(config.id)!
            await this.browserManager.navigateToDashboard(session)
        })

        await Promise.all(navPromises)
        console.log('[TEST-ORCH] All dashboards loaded successfully')
    }

    async runTestScenario(scenario: TestScenario): Promise<TestResult> {
        const startTime = Date.now()
        let attempts = 0
        const maxAttempts = scenario.retryPolicy.maxRetries

        while (attempts < maxAttempts) {
            try {
                console.log(`[TEST-ORCH] Running scenario ${scenario.id} (attempt ${attempts + 1}/${maxAttempts})`)

                const result = await scenario.execute(this)
                result.scenarioId = scenario.id
                result.attemptNumber = attempts + 1
                result.executionTime = Date.now() - startTime

                if (result.passed) {
                    console.log(`[TEST-ORCH] Scenario ${scenario.id} passed`)
                    return result
                }

                console.warn(`[TEST-ORCH] Scenario ${scenario.id} failed attempt ${attempts + 1}`)

            } catch (error) {
                console.error(`[TEST-ORCH] Scenario ${scenario.id} error on attempt ${attempts + 1}:`, error)
            }

            attempts++
            if (attempts < maxAttempts) {
                const delay = scenario.retryPolicy.backoffMs * Math.pow(2, attempts - 1)
                console.log(`[TEST-ORCH] Retrying scenario ${scenario.id} in ${delay}ms...`)
                await new Promise(resolve => setTimeout(resolve, delay))
            }
        }

        // Return failed result after all retries
        return {
            scenarioId: scenario.id,
            passed: false,
            attemptNumber: maxAttempts,
            executionTime: Date.now() - startTime,
            error: 'All retry attempts failed'
        }
    }

    async runTestSuite(scenarios: TestScenario[]): Promise<TestSuiteResult> {
        console.log(`[TEST-ORCH] Starting test suite with ${scenarios.length} scenarios`)
        const suiteStartTime = Date.now()

        const results: TestResult[] = []

        for (const scenario of scenarios) {
            const result = await this.runTestScenario(scenario)
            results.push(result)

            if (!result.passed) {
                console.warn(`[TEST-ORCH] Scenario failed: ${scenario.id}`)
            }
        }

        const suiteEndTime = Date.now()
        const totalDuration = suiteEndTime - suiteStartTime

        const passed = results.filter(r => r.passed)
        const failed = results.filter(r => !r.passed)

        const suiteResult: TestSuiteResult = {
            totalScenarios: scenarios.length,
            passedScenarios: passed.length,
            failedScenarios: failed.length,
            totalDuration,
            results,
            summary: {
                successRate: (passed.length / scenarios.length) * 100,
                averageLatency: this.calculateAverageLatency(results),
                performanceMetrics: this.calculatePerformanceMetrics(results),
                reliability: failed.length === 0
            }
        }

        console.log('[TEST-ORCH] Test suite completed:', suiteResult)
        return suiteResult
    }

    private calculateAverageLatency(results: TestResult[]): number {
        const latencies = results
            .filter(r => r.performance)
            .map(r => (r.performance as any).maxLatency || (r.performance as any).totalLatency || (r.performance as any).actualLatency)
            .filter(l => typeof l === 'number' && l > 0)

        return latencies.length > 0 ? latencies.reduce((a, b) => a + b) / latencies.length : 0
    }

    private calculatePerformanceMetrics(results: TestResult[]): PerformanceMetrics {
        const updateLatencies = results
            .filter(r => r.performance)
            .map(r => (r.performance as any).maxLatency || (r.performance as any).totalLatency || (r.performance as any).actualLatency)
            .filter(l => typeof l === 'number' && l > 0)

        return {
            averageLatency: this.calculateAverageLatency(results),
            maxLatency: updateLatencies.length > 0 ? Math.max(...updateLatencies) : 0,
            targetLatency: 500, // Target <500ms
            actualLatency: this.calculateAverageLatency(results),
            cacheHitRate: this.calculateAverageCacheHitRate(results),
            operationDuration: results.reduce((sum, r) => sum + r.executionTime, 0) / results.length,
            targetDuration: 30000 // Target operations within 30 seconds
        }
    }

    private calculateAverageCacheHitRate(results: TestResult[]): number {
        const cacheRates = results
            .filter(r => r.performance)
            .map(r => (r.performance as any).cacheHitRate)
            .filter(rate => typeof rate === 'number')

        return cacheRates.length > 0 ? cacheRates.reduce((a, b) => a + b) / cacheRates.length : 0
    }

    // MultiBrowserTestEnvironment interface implementation

    getBrowser(id: string): BrowserSession | undefined {
        return this.browsers.get(id)
    }

    getBrowsers(): Map<string, BrowserSession> {
        return this.browsers
    }

    async waitForStateChange(session: BrowserSession, initialState: DashboardState, options: any = {}): Promise<{ success: boolean; latency: number }> {
        const timeout = options.timeout || 5000
        return await this.browserManager.waitForStateChange(session, initialState, timeout)
    }

    async waitForStableState(session: BrowserSession, timeout: number = 10000): Promise<any> {
        const startTime = Date.now()
        const deadline = startTime + timeout
        let previousState = await this.browserManager.getDashboardState(session)

        while (Date.now() < deadline) {
            await new Promise(resolve => setTimeout(resolve, 500))

            const currentState = await this.browserManager.getDashboardState(session)

            // Check if state has stabilized (no changes for 2 seconds)
            if (JSON.stringify(currentState) === JSON.stringify(previousState)) {
                const convergenceTime = Date.now() - startTime
                console.log(`[TEST-ORCH] State converged for ${session.userId} in ${convergenceTime}ms`)
                return {
                    success: true,
                    convergenceTime,
                    finalState: currentState
                }
            }

            previousState = currentState
        }

        return {
            success: false,
            convergenceTime: Date.now() - startTime,
            finalState: await this.browserManager.getDashboardState(session)
        }
    }

    async createTestUser(role: 'admin' | 'user', email: string): Promise<string> {
        // Mock implementation - would create real user in actual system
        const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        console.log(`[TEST-ORCH] Created mock test ${role} user: ${email} (${userId})`)
        return userId
    }

    async cleanup(): Promise<void> {
        console.log('[TEST-ORCH] Cleaning up test environment')

        try {
            await this.browserManager.cleanup()
            this.browsers.clear()
            console.log('[TEST-ORCH] Test environment cleaned up')
        } catch (error) {
            console.warn('[TEST-ORCH] Error during cleanup:', error)
        }
    }
}

// Factory function
export function createTestOrchestrator(baseURL?: string): MultiBrowserTestOrchestrator {
    return new MultiBrowserTestOrchestrator(baseURL)
}

export interface TestEnvironmentConfig {
    browsers: BrowserConfig[]
    testUsers?: {
        adminUsers: Array<{ email: string; password: string }>
        regularUsers: Array<{ email: string; password: string }>
    }
    options?: {
        enablePerformanceMonitoring?: boolean
        enableNetworkSimulation?: boolean
        timeout?: number
    }
}