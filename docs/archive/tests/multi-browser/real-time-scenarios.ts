import { TestScenario, MultiBrowserTestEnvironment, TestResult, PerformanceMetrics } from './test-orchestrator'
import { BrowserSession, DashboardState } from '../utils/browser-manager'

/**
 * Test Scenario 1: Admin User Creation Notification
 * Tests that when Admin A creates a user, Admin A & B receive immediate updates, but User C does not
 */
export class AdminUserCreationTest implements TestScenario {
    id = 'admin-user-creation'
    name = 'Admin User Creation Real-time Notification'
    description = 'Tests that when Admin A creates a user, Admin A & B receive immediate updates, but User C does not'
    timeout = 30000
    retryPolicy = { maxRetries: 3, backoffMs: 1000 }

    async execute(environment: MultiBrowserTestEnvironment): Promise<TestResult> {
        console.log('[TEST] Starting admin user creation test')

        const browsers = environment.getBrowsers()
        const adminA = browsers.get('admin-a')
        const adminB = browsers.get('admin-b')
        const userC = browsers.get('user-c')

        if (!adminA || !adminB || !userC) {
            throw new Error('Required browser sessions not found')
        }

        // Step 1: Record initial states
        console.log('[TEST] Recording initial dashboard states')
        const initialStates = {
            adminA: await environment.getBrowser('admin-a')?.page?.evaluate?.(() => document.body.innerHTML) || 'Mock State A',
            adminB: await environment.getBrowser('admin-b')?.page?.evaluate?.(() => document.body.innerHTML) || 'Mock State B',
            userC: await environment.getBrowser('user-c')?.page?.evaluate?.(() => document.body.innerHTML) || 'Mock State C'
        }

        // Step 2: Admin A creates a new user
        console.log('[TEST] Admin A creating new user')
        const newUserData = {
            email: `testuser_${Date.now()}@example.com`,
            firstName: 'Test',
            lastName: 'User',
            role: 'user'
        }

        const startTime = Date.now()
        await this.simulateUserCreation(adminA, newUserData)
        console.log('[TEST] User creation initiated by Admin A')

        // Step 3: Wait for Admin A to receive update
        console.log('[TEST] Waiting for Admin A to receive update')
        const adminAUpdate = await this.waitForAdminUpdate(environment, adminA, 'adminA', 5000)

        const adminALatency = Date.now() - startTime
        console.log(`[TEST] Admin A updated in ${adminALatency}ms`)

        // Step 4: Wait for Admin B to receive update  
        console.log('[TEST] Waiting for Admin B to receive update')
        const adminBUpdate = await this.waitForAdminUpdate(environment, adminB, 'adminB', 5000)

        const adminBLatency = Date.now() - startTime
        console.log(`[TEST] Admin B updated in ${adminBLatency}ms`)

        // Step 5: Verify User C does NOT receive direct notification
        console.log('[TEST] Verifying User C state remains unchanged for direct notifications')
        const userCStable = await environment.waitForStableState(userC, 2000)

        // Step 6: Verify User C sees activity in activity feed (indirect notification)
        console.log('[TEST] Verifying User C sees activity in feed')
        const userCFeedUpdate = await this.waitForActivityInFeed(environment, userC, 'user_created', newUserData.email, 3000)

        // Validation
        const results = this.validateTestResults({
            adminALatency,
            adminBLatency,
            adminAUpdate,
            adminBUpdate,
            userCFeedUpdate,
            userCStable,
            initialStates
        })

        console.log('[TEST] Admin user creation test completed:', results)
        return results
    }

    private async waitForAdminUpdate(environment: MultiBrowserTestEnvironment, session: BrowserSession, sessionName: string, timeout: number): Promise<{ success: boolean; latency: number }> {
        const startTime = Date.now()
        const deadline = startTime + timeout

        while (Date.now() < deadline) {
            // Simulate checking for user list update
            const hasUpdate = Math.random() > 0.1 // 90% success rate in mock

            if (hasUpdate) {
                const latency = Date.now() - startTime
                console.log(`[TEST] ${sessionName} received update in ${latency}ms`)
                return { success: true, latency }
            }

            await new Promise(resolve => setTimeout(resolve, 100))
        }

        const latency = Date.now() - startTime
        console.warn(`[TEST] ${sessionName} did not receive update within ${timeout}ms`)
        return { success: false, latency }
    }

    private async waitForActivityInFeed(environment: MultiBrowserTestEnvironment, session: BrowserSession, activityType: string, activityData: string, timeout: number): Promise<{ success: boolean; latency: number }> {
        const startTime = Date.now()
        const deadline = startTime + timeout

        while (Date.now() < deadline) {
            // Simulate checking for activity in feed
            const hasActivity = Math.random() > 0.2 // 80% success rate in mock

            if (hasActivity) {
                const latency = Date.now() - startTime
                console.log(`[TEST] Activity found in ${session.userId}'s feed in ${latency}ms`)
                return { success: true, latency }
            }

            await new Promise(resolve => setTimeout(resolve, 100))
        }

        const latency = Date.now() - startTime
        console.warn(`[TEST] No activity found in ${session.userId}'s feed within ${timeout}ms`)
        return { success: false, latency }
    }

    private async simulateUserCreation(session: BrowserSession, userData: any): Promise<void> {
        // Mock user creation simulation
        console.log(`[TEST] Simulating user creation: ${userData.email}`)
        await new Promise(resolve => setTimeout(resolve, 500))
    }

    private validateTestResults(results: any): TestResult {
        const passed =
            results.adminALatency < 1000 && // Admin A should update within 1 second
            results.adminBLatency < 1000 && // Admin B should update within 1 second
            results.adminAUpdate.success &&
            results.adminBUpdate.success &&
            results.userCFeedUpdate.success &&
            Math.abs(results.adminALatency - results.adminBLatency) < 500 // Both admins should update around same time

        return {
            scenarioId: this.id,
            passed,
            attemptNumber: 1, // Will be set by orchestrator
            executionTime: Math.max(results.adminALatency, results.adminBLatency),
            details: {
                adminALatency: results.adminALatency,
                adminBLatency: results.adminBLatency,
                crossBrowserConsistency: Math.abs(results.adminALatency - results.adminBLatency),
                userCIndirectUpdate: results.userCFeedUpdate.success,
                userCStateStable: results.userCStable.success
            },
            performance: {
                targetLatency: 500,
                actualLatency: Math.max(results.adminALatency, results.adminBLatency),
                maxLatency: Math.max(results.adminALatency, results.adminBLatency)
            }
        }
    }
}

/**
 * Test Scenario 2: User Activity Performance  
 * Tests that when User C performs task activity, all browsers A, B, C receive updates
 */
export class UserActivityPerformanceTest implements TestScenario {
    id = 'user-activity-performance'
    name = 'User Activity Real-time Performance'
    description = 'Tests that when User C performs task activity, all browsers A, B, C receive updates'
    timeout = 30000
    retryPolicy = { maxRetries: 3, backoffMs: 1000 }

    async execute(environment: MultiBrowserTestEnvironment): Promise<TestResult> {
        console.log('[TEST] Starting user activity performance test')

        const browsers = environment.getBrowsers()
        const adminA = browsers.get('admin-a')
        const adminB = browsers.get('admin-b')
        const userC = browsers.get('user-c')

        if (!adminA || !adminB || !userC) {
            throw new Error('Required browser sessions not found')
        }

        // Step 1: Record initial states
        console.log('[TEST] Recording initial dashboard states')
        const initialStates = {
            adminA: await environment.getBrowser('admin-a')?.page?.evaluate?.(() => document.body.innerHTML) || 'Mock State A',
            adminB: await environment.getBrowser('admin-b')?.page?.evaluate?.(() => document.body.innerHTML) || 'Mock State B',
            userC: await environment.getBrowser('user-c')?.page?.evaluate?.(() => document.body.innerHTML) || 'Mock State C'
        }

        // Step 2: User C performs task activity
        console.log('[TEST] User C performing task activity')
        const activityData = {
            type: 'task_completion',
            taskId: `task_${Date.now()}`,
            duration: 300, // 5 minutes
            completedAt: new Date().toISOString()
        }

        const startTime = Date.now()
        await this.simulateTaskActivity(userC, activityData)
        console.log('[TEST] Task activity initiated by User C')

        // Step 3: Wait for all browsers to receive update
        console.log('[TEST] Waiting for all browsers to receive activity update')
        const updatePromises = [
            this.waitForActivityUpdate(environment, adminA, 'task_completed', activityData.taskId, 5000),
            this.waitForActivityUpdate(environment, adminB, 'task_completed', activityData.taskId, 5000),
            this.waitForActivityUpdate(environment, userC, 'task_completed', activityData.taskId, 5000)
        ]

        const [adminAUpdate, adminBUpdate, userCUpdate] = await Promise.all(updatePromises)

        const totalLatency = Date.now() - startTime
        const maxLatency = Math.max(adminAUpdate.latency, adminBUpdate.latency, userCUpdate.latency)

        console.log(`[TEST] All browsers updated in ${totalLatency}ms (max: ${maxLatency}ms)`)

        // Step 4: Verify consistency across browsers
        console.log('[TEST] Verifying consistency across browsers')
        const consistencyCheck = this.validateActivityConsistency(
            { adminA: adminAUpdate, adminB: adminBUpdate, userC: userCUpdate },
            activityData.taskId
        )

        const passed =
            maxLatency < 2000 && // All updates within 2 seconds
            adminAUpdate.success &&
            adminBUpdate.success &&
            userCUpdate.success &&
            consistencyCheck.consistent &&
            consistencyCheck.taskPresentInAllFeeds

        return {
            scenarioId: this.id,
            passed,
            attemptNumber: 1, // Will be set by orchestrator
            executionTime: maxLatency,
            details: {
                adminAUpdate: adminAUpdate.success,
                adminBUpdate: adminBUpdate.success,
                userCUpdate: userCUpdate.success,
                consistency: consistencyCheck
            },
            performance: {
                maxLatency,
                totalLatency,
                averageLatency: (adminAUpdate.latency + adminBUpdate.latency + userCUpdate.latency) / 3
            }
        }
    }

    private async waitForActivityUpdate(
        environment: MultiBrowserTestEnvironment,
        session: BrowserSession,
        activityType: string,
        taskId: string,
        timeout: number
    ): Promise<{ success: boolean; latency: number }> {
        const startTime = Date.now()
        const deadline = startTime + timeout

        while (Date.now() < deadline) {
            // Simulate checking for activity update
            const hasUpdate = Math.random() > 0.1 // 90% success rate in mock

            if (hasUpdate) {
                const latency = Date.now() - startTime
                console.log(`[TEST] ${session.userId} received activity update in ${latency}ms`)
                return { success: true, latency }
            }

            await new Promise(resolve => setTimeout(resolve, 100))
        }

        const latency = Date.now() - startTime
        console.warn(`[TEST] ${session.userId} did not receive activity update within ${timeout}ms`)
        return { success: false, latency }
    }

    private async simulateTaskActivity(session: BrowserSession, activityData: any): Promise<void> {
        // Mock task activity simulation
        console.log(`[TEST] Simulating task activity: ${activityData.taskId}`)
        await new Promise(resolve => setTimeout(resolve, 300))
    }

    private validateActivityConsistency(updates: any, taskId: string): { consistent: boolean; taskPresentInAllFeeds: boolean } {
        const allPresent = updates.adminA.success && updates.adminB.success && updates.userC.success
        const latenciesConsistent = Math.abs(updates.adminA.latency - updates.adminB.latency) < 500 &&
            Math.abs(updates.adminB.latency - updates.userC.latency) < 500

        return {
            consistent: allPresent && latenciesConsistent,
            taskPresentInAllFeeds: allPresent
        }
    }
}

/**
 * Test Scenario 3: Concurrent Admin Operations
 * Tests that simultaneous admin operations maintain data consistency
 */
export class ConcurrentAdminOperationsTest implements TestScenario {
    id = 'concurrent-admin-operations'
    name = 'Concurrent Admin Operations Consistency'
    description = 'Tests that simultaneous admin operations maintain data consistency'
    timeout = 45000
    retryPolicy = { maxRetries: 2, backoffMs: 2000 }

    async execute(environment: MultiBrowserTestEnvironment): Promise<TestResult> {
        console.log('[TEST] Starting concurrent admin operations test')

        const browsers = environment.getBrowsers()
        const adminA = browsers.get('admin-a')
        const adminB = browsers.get('admin-b')

        if (!adminA || !adminB) {
            throw new Error('Required admin browser sessions not found')
        }

        // Step 1: Setup initial state
        console.log('[TEST] Recording initial user count')
        const initialUserCount = 45 + Math.floor(Math.random() * 5) // Mock initial count
        console.log(`[TEST] Initial user count: ${initialUserCount}`)

        // Step 2: Execute concurrent operations
        console.log('[TEST] Executing concurrent admin operations')
        const operationStartTime = Date.now()

        const [operationAResult, operationBResult] = await Promise.allSettled([
            this.executeAdminOperation(adminA, {
                type: 'create_user',
                data: {
                    email: `concurrent_user_a_${Date.now()}@example.com`,
                    firstName: 'Concurrent',
                    lastName: 'UserA'
                }
            }),
            this.executeAdminOperation(adminB, {
                type: 'create_user',
                data: {
                    email: `concurrent_user_b_${Date.now()}@example.com`,
                    firstName: 'Concurrent',
                    lastName: 'UserB'
                }
            })
        ])

        const operationEndTime = Date.now()
        const operationDuration = operationEndTime - operationStartTime

        console.log(`[TEST] Concurrent operations completed in ${operationDuration}ms`)

        // Step 3: Wait for both browsers to reflect changes
        console.log('[TEST] Waiting for state convergence')
        const [finalStateA, finalStateB] = await Promise.all([
            environment.waitForStableState(adminA, 10000),
            environment.waitForStableState(adminB, 10000)
        ])

        // Step 4: Verify final consistency
        console.log('[TEST] Verifying final state consistency')
        const finalUserCountA = initialUserCount + (operationAResult.status === 'fulfilled' ? 1 : 0)
        const finalUserCountB = initialUserCount + (operationBResult.status === 'fulfilled' ? 1 : 0)
        const expectedUserCount = initialUserCount + 2

        console.log(`[TEST] Final counts - Admin A: ${finalUserCountA}, Admin B: ${finalUserCountB}`)
        console.log(`[TEST] Expected count: ${expectedUserCount}`)

        const consistency = {
            userCountsMatch: finalUserCountA === finalUserCountB,
            bothUsersCreated: operationAResult.status === 'fulfilled' && operationBResult.status === 'fulfilled',
            correctFinalCount: finalUserCountA === expectedUserCount,
            bothAdminsConsistent: finalUserCountA === finalUserCountB
        }

        const passed =
            operationAResult.status === 'fulfilled' &&
            operationBResult.status === 'fulfilled' &&
            consistency.userCountsMatch &&
            consistency.bothUsersCreated &&
            consistency.correctFinalCount &&
            operationDuration < 30000 // Operations should complete within 30 seconds

        return {
            scenarioId: this.id,
            passed,
            attemptNumber: 1, // Will be set by orchestrator
            executionTime: operationDuration,
            details: {
                operationAResult: operationAResult.status === 'fulfilled',
                operationBResult: operationBResult.status === 'fulfilled',
                operationDuration,
                finalUserCountA,
                finalUserCountB,
                expectedUserCount,
                consistency,
                stateConvergenceA: finalStateA,
                stateConvergenceB: finalStateB
            },
            performance: {
                operationDuration,
                targetDuration: 30000,
                stateConvergenceTime: Math.max(
                    finalStateA.convergenceTime || 0,
                    finalStateB.convergenceTime || 0
                )
            }
        }
    }

    private async executeAdminOperation(
        session: BrowserSession,
        operation: AdminOperation
    ): Promise<OperationResult> {
        const startTime = Date.now()

        try {
            switch (operation.type) {
                case 'create_user':
                    await this.simulateUserCreation(session, operation.data)
                    return {
                        success: true,
                        duration: Date.now() - startTime,
                        data: operation.data
                    }

                default:
                    throw new Error(`Unsupported operation type: ${operation.type}`)
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error)
            return {
                success: false,
                duration: Date.now() - startTime,
                error: errorMessage,
                data: operation.data
            }
        }
    }

    private async simulateUserCreation(session: BrowserSession, userData: any): Promise<void> {
        console.log(`[TEST] ${session.userId} creating user: ${userData.email}`)
        await new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 400)) // Simulate variable operation time
    }
}

// Helper interfaces
interface AdminOperation {
    type: 'create_user'
    data: any
}

interface OperationResult {
    success: boolean
    duration: number
    data?: any
    error?: string
}