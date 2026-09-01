/**
 * Disposable browser-level kiosk persistence proof.
 *
 * This test pairs through the real /kiosk UI, verifies that the session is
 * HttpOnly, reloads the page using the same browser installation, then revokes
 * the session from an isolated context and confirms that a reload returns to
 * the explicit admin re-pair flow.
 *
 * Run against a running PayFix app:
 *   PAYFIX_E2E_ALLOW_DISPOSABLE=1 \
 *   PAYFIX_E2E_BASE_URL=http://127.0.0.1:3000 \
 *   pnpm exec tsx scripts/test-kiosk-browser-reload.ts
 */
import './env-config'

import { chromium, type Browser, type BrowserContext, type Page } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { eq } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'

let masterDb: any
let tenants: any
let tenantBranding: any
let provisionTenant: any
let deprovisionTenant: any
let tenantSchemaNameFromSlug: any

type Fixture = {
    tenantId: string
    tenantSlug: string
    tenantSchema: string
    userId: string
    email: string
    password: string
}

function assert(condition: unknown, message: string): asserts condition {
    if (!condition) throw new Error(message)
}

function requireEnvironment() {
    const required = [
        'DATABASE_URL',
        'NEXT_PUBLIC_SUPABASE_URL',
        'NEXT_PUBLIC_SUPABASE_ANON_KEY',
        'SUPABASE_SERVICE_ROLE_KEY',
        'SESSION_SECRET',
    ]
    const missing = required.filter((key) => !process.env[key])
    if (missing.length > 0) {
        throw new Error(`Missing required environment configuration: ${missing.join(', ')}`)
    }
}

function requireDisposableRun() {
    if (process.env.PAYFIX_E2E_ALLOW_DISPOSABLE !== '1') {
        throw new Error(
            'Refusing to create test data. Set PAYFIX_E2E_ALLOW_DISPOSABLE=1 to explicitly authorize this disposable E2E run.',
        )
    }
}

async function loadApplicationDependencies() {
    const masterConnection = await import('../lib/db/master-connection')
    const masterSchema = await import('../lib/db/master-schema')
    const provisioning = await import('../lib/tenant/provisioning')
    const schemaContract = await import('../lib/tenant/schema-contract')

    masterDb = masterConnection.masterDb
    tenants = masterSchema.tenants
    tenantBranding = masterSchema.tenantBranding
    provisionTenant = provisioning.provisionTenant
    deprovisionTenant = provisioning.deprovisionTenant
    tenantSchemaNameFromSlug = schemaContract.tenantSchemaNameFromSlug
}

async function createFixture(): Promise<Fixture> {
    const suffix = randomUUID().replace(/-/g, '').slice(0, 10)
    const tenantSlug = `kiosk-reload-e2e-${suffix}`
    const tenantSchema = tenantSchemaNameFromSlug(tenantSlug)
    const email = `kiosk-reload-e2e-${suffix}@example.invalid`
    const password = `KioskReloadE2E-${randomUUID()}-x`
    const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } },
    )

    const authResult = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: 'Disposable Kiosk Reload Admin', status: 'active' },
    })
    if (authResult.error || !authResult.data.user) {
        throw new Error(`Could not create disposable auth user: ${authResult.error?.message || 'no user returned'}`)
    }

    let tenantId: string | undefined
    try {
        const trialEnd = new Date(Date.now() + 24 * 60 * 60 * 1000)
        const [tenant] = await masterDb.insert(tenants).values({
            slug: tenantSlug,
            company_name: 'Disposable Kiosk Reload Workspace',
            tenant_schema: tenantSchema,
            status: 'trial',
            trial_start: new Date(),
            trial_end: trialEnd,
            trial_duration_days: 1,
            admin_email: email,
            license_expires_at: trialEnd,
        }).returning()
        tenantId = tenant.id
        await masterDb.insert(tenantBranding).values({
            tenant_id: tenant.id,
            app_name: 'Disposable Kiosk Reload',
            short_name: 'Kiosk Reload',
        })
        await provisionTenant(
            tenantSlug,
            'Disposable Kiosk Reload Workspace',
            email,
            1,
            authResult.data.user.id,
            { firstName: 'Disposable', lastName: 'Kiosk Reload' },
            undefined,
            true,
        )
        return {
            tenantId: tenant.id,
            tenantSlug,
            tenantSchema,
            userId: authResult.data.user.id,
            email,
            password,
        }
    } catch (error) {
        if (tenantId) {
            await masterDb.update(tenants).set({ status: 'cancelled' }).where(eq(tenants.id, tenantId))
            await deprovisionTenant(tenantId, tenantSchema, tenantSlug)
        } else {
            await supabaseAdmin.auth.admin.deleteUser(authResult.data.user.id)
        }
        throw error
    }
}

async function submitSignIn(page: Page, fixture: Fixture) {
    await page.locator('#login-email').fill(fixture.email)
    await page.locator('#login-password').fill(fixture.password)
    await page.getByRole('button', { name: /sign in/i }).click()
    await page.waitForURL((url) => url.pathname === '/kiosk', { timeout: 30_000 })
}

async function signIn(page: Page, baseUrl: string, fixture: Fixture) {
    await page.goto(`${baseUrl}/login?next=%2Fkiosk`, { waitUntil: 'domcontentloaded' })
    await submitSignIn(page, fixture)
}

async function readKioskMeta(page: Page, key: string): Promise<unknown> {
    return page.evaluate(async (requestedKey) => {
        return new Promise((resolve, reject) => {
            const openRequest = indexedDB.open('payfix_kiosk_db', 2)
            openRequest.onerror = () => reject(openRequest.error)
            openRequest.onsuccess = () => {
                const db = openRequest.result
                const request = db.transaction('kiosk_meta', 'readonly')
                    .objectStore('kiosk_meta')
                    .get(requestedKey)
                request.onerror = () => reject(request.error)
                request.onsuccess = () => {
                    resolve(request.result?.value ?? null)
                    db.close()
                }
            }
        })
    }, key)
}

async function run() {
    requireDisposableRun()
    requireEnvironment()
    await loadApplicationDependencies()

    const baseUrl = (process.env.PAYFIX_E2E_BASE_URL || 'http://127.0.0.1:3000').replace(/\/$/, '')
    let fixture: Fixture | undefined
    let browser: Browser | undefined
    let context: BrowserContext | undefined

    try {
        fixture = await createFixture()
        const { KioskDeviceService } = await import('../lib/services/kiosk-device.service')
        const { runWithTenantSchema } = await import('../lib/db')
        const device = await runWithTenantSchema(fixture.tenantSchema, () => KioskDeviceService.createDevice({
            name: 'Disposable Browser Reload Kiosk',
            createdBy: fixture!.userId,
        }))

        browser = await chromium.launch({ headless: process.env.PAYFIX_E2E_HEADLESS !== 'false' })
        context = await browser.newContext({
            permissions: ['geolocation'],
            geolocation: { latitude: 19.076, longitude: 72.8777 },
        })
        const page = await context.newPage()

        await signIn(page, baseUrl, fixture)
        await page.locator('#pairing-key').waitFor({ state: 'visible', timeout: 30_000 })
        await page.locator('#pairing-key').fill(device.pairing_code)
        await page.getByRole('button', { name: /Admin Register & Start/i }).click()
        await page.getByText('Paired & Active').waitFor({ state: 'visible', timeout: 30_000 })

        const installationId = await readKioskMeta(page, 'terminal_installation_id')
        const deviceMetadata = await readKioskMeta(page, 'device_metadata')
        assert(typeof installationId === 'string' && installationId.length >= 8, 'Pairing did not persist a browser installation identity')
        assert(deviceMetadata && typeof deviceMetadata === 'object', 'Pairing did not persist safe device metadata')

        const pairedCookies = await context.cookies(baseUrl)
        const kioskCookie = pairedCookies.find((cookie) => cookie.name === 'payfix_kiosk_session')
        assert(kioskCookie?.httpOnly === true, 'Kiosk session cookie is not HttpOnly')
        const pageCookieString = await page.evaluate(() => document.cookie)
        assert(!pageCookieString.includes('payfix_kiosk_session='), 'HttpOnly kiosk session leaked into document.cookie')

        await page.reload({ waitUntil: 'domcontentloaded' })
        await page.getByText('Paired & Active').waitFor({ state: 'visible', timeout: 30_000 })
        assert(
            (await readKioskMeta(page, 'terminal_installation_id')) === installationId,
            'Browser reload changed the kiosk installation identity',
        )
        console.log(JSON.stringify({
            check: 'paired kiosk survives browser reload',
            ok: true,
            installationIdRetained: true,
            sessionCookieHttpOnly: true,
            sessionCookieHiddenFromPageJavaScript: true,
        }))

        // Use a separate browser context so the revocation response cannot clear
        // the valid page's cookie jar before the reload test runs.
        const revocationContext = await browser.newContext()
        await revocationContext.addCookies(await context.cookies(baseUrl))
        const revokeResponse = await revocationContext.request.delete(`${baseUrl}/api/kiosk/session`, {
            headers: { 'x-kiosk-installation-id': installationId },
        })
        assert(revokeResponse.ok(), `Kiosk session revocation failed with ${revokeResponse.status()}`)
        await revocationContext.close()

        await page.reload({ waitUntil: 'domcontentloaded' })
        await page.waitForFunction(
            () => document.body.innerText.includes('Admin Login Required') || document.body.innerText.includes('Admin Terminal Setup'),
            undefined,
            { timeout: 30_000 },
        )
        assert(await readKioskMeta(page, 'device_metadata') === null, 'Revoked reload retained device metadata')
        const loginRequired = await page.getByText('Admin Login Required', { exact: true }).isVisible().catch(() => false)
        if (loginRequired) {
            await page.getByRole('button', { name: /Click here for login/i }).click()
            await page.waitForURL((url) => url.pathname === '/login', { timeout: 30_000 })
            await submitSignIn(page, fixture)
        }
        await page.getByText('Admin Terminal Setup', { exact: true }).waitFor({ state: 'visible', timeout: 30_000 })

        console.log(JSON.stringify({
            check: 'revoked kiosk returns to explicit re-pair flow after reload',
            ok: true,
            adminLoginRequired: loginRequired,
            deviceMetadataCleared: true,
            rePairScreenReached: true,
        }))
    } finally {
        await context?.close().catch(() => {})
        await browser?.close().catch(() => {})
        if (fixture) {
            try {
                await masterDb.update(tenants).set({ status: 'cancelled' }).where(eq(tenants.id, fixture.tenantId))
                const cleanup = await deprovisionTenant(fixture.tenantId, fixture.tenantSchema, fixture.tenantSlug)
                if (!cleanup.success) console.error('[kiosk-reload-e2e] Tenant cleanup warnings:', cleanup.errors)
            } catch (error) {
                console.error('[kiosk-reload-e2e] Disposable tenant cleanup failed:', error)
                process.exitCode = 1
            }
        }
    }
}

run()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error instanceof Error ? error.message : String(error))
        process.exit(1)
    })