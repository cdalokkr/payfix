/**
 * Disposable camera-capable biometric E2E proof.
 *
 * This intentionally does not use tenant_primary for any fixture row. It creates
 * a short-lived tenant, signs into that tenant in a Playwright browser, captures
 * three natural frames from getUserMedia, and drives the same HTTP endpoints used
 * by enrollment, PWA attendance, and kiosk attendance.
 *
 * Run against a running PayFix app:
 *   PAYFIX_E2E_ALLOW_DISPOSABLE=1 \
 *   PAYFIX_E2E_BASE_URL=http://127.0.0.1:3000 \
 *   pnpm exec tsx scripts/test-biometric-camera-e2e.ts
 *
 * For CI, pass a moving camera fixture:
 *   PAYFIX_E2E_CAMERA_Y4M=/absolute/path/to/moving-face.y4m
 *
 * For a real camera/device, use a headed browser:
 *   PAYFIX_E2E_HEADLESS=false pnpm exec tsx scripts/test-biometric-camera-e2e.ts
 *
 * The face service, Supabase Storage bucket, DATABASE_URL, and all Supabase
 * secrets must be configured. No API verification response is mocked.
 */
import './env-config'

import { chromium, type APIRequestContext, type Browser, type BrowserContext, type Page } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { eq, sql } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'

let centralDb: any
let masterDb: any
let tenantBranding: any
let tenants: any
let ProfileService: any
let KioskDeviceService: any
let GeofenceService: any
let provisionTenant: any
let deprovisionTenant: any
let runWithTenantSchema: any
let tenantSchemaNameFromSlug: any

async function loadApplicationDependencies() {
    const db = await import('../lib/db')
    const masterConnection = await import('../lib/db/master-connection')
    const masterSchema = await import('../lib/db/master-schema')
    const profileService = await import('../lib/services/profile.service')
    const kioskDeviceService = await import('../lib/services/kiosk-device.service')
    const geofenceService = await import('../lib/services/geofence.service')
    const provisioning = await import('../lib/tenant/provisioning')
    const schemaContract = await import('../lib/tenant/schema-contract')

    centralDb = db.centralDb
    runWithTenantSchema = db.runWithTenantSchema
    masterDb = masterConnection.masterDb
    tenantBranding = masterSchema.tenantBranding
    tenants = masterSchema.tenants
    ProfileService = profileService.ProfileService
    KioskDeviceService = kioskDeviceService.KioskDeviceService
    GeofenceService = geofenceService.GeofenceService
    provisionTenant = provisioning.provisionTenant
    deprovisionTenant = provisioning.deprovisionTenant
    tenantSchemaNameFromSlug = schemaContract.tenantSchemaNameFromSlug
}


const PIPELINE_VERSION = 'natural-portrait-3x4-v2'
const TEST_LATITUDE = 19.076
const TEST_LONGITUDE = 72.8777
const TEST_RADIUS_METERS = 150
const DEFAULT_BASE_URL = 'http://127.0.0.1:3000'
const TERMINAL_ID = `camera-e2e-terminal-${randomUUID()}`
const WRONG_TERMINAL_ID = `camera-e2e-wrong-${randomUUID()}`

type Fixture = {
    tenantId: string
    tenantSlug: string
    tenantSchema: string
    userId: string
    email: string
    password: string
    locationId?: string
    kioskDeviceId?: string
    pendingPhotoPath?: string
}

type CheckResult = {
    name: string
    ok: boolean
    details?: Record<string, unknown>
}

function requireDisposableRun() {
    if (process.env.PAYFIX_E2E_ALLOW_DISPOSABLE !== '1') {
        throw new Error(
            'Refusing to create test data. Set PAYFIX_E2E_ALLOW_DISPOSABLE=1 to explicitly authorize the disposable biometric E2E run.',
        )
    }
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

function assert(condition: unknown, message: string): asserts condition {
    if (!condition) throw new Error(message)
}

async function readJson(response: { status(): number; text(): Promise<string> }) {
    const text = await response.text()
    let body: any = {}
    try {
        body = text ? JSON.parse(text) : {}
    } catch {
        body = { raw: text.slice(0, 300) }
    }
    return { status: response.status(), body }
}

async function postJson(
    request: APIRequestContext,
    baseUrl: string,
    path: string,
    payload: unknown,
    headers: Record<string, string> = {},
) {
    const result = await readJson(await request.post(`${baseUrl}${path}`, {
        headers: { 'content-type': 'application/json', ...headers },
        data: payload,
    }))
    return result
}

async function getJson(request: APIRequestContext, baseUrl: string, path: string, headers: Record<string, string> = {}) {
    return readJson(await request.get(`${baseUrl}${path}`, { headers }))
}

async function deleteJson(request: APIRequestContext, baseUrl: string, path: string, headers: Record<string, string> = {}) {
    return readJson(await request.delete(`${baseUrl}${path}`, { headers }))
}

async function snapshotTenantPrimary(): Promise<Record<string, number>> {
    const tableRows = await centralDb.execute(sql`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'tenant_primary'
          AND table_type = 'BASE TABLE'
        ORDER BY table_name
    `)
    const snapshot: Record<string, number> = {}
    for (const row of tableRows) {
        const tableName = String((row as any).table_name)
        const countRows = await centralDb.execute(sql`
            SELECT count(*)::bigint AS count
            FROM ${sql.raw(`tenant_primary.${tableName}`)}
        `)
        snapshot[tableName] = Number((countRows[0] as any).count)
    }
    return snapshot
}

function diffSnapshots(before: Record<string, number>, after: Record<string, number>) {
    const keys = new Set([...Object.keys(before), ...Object.keys(after)])
    return [...keys]
        .sort()
        .filter((key) => before[key] !== after[key])
        .map((key) => ({ table: key, before: before[key] ?? 0, after: after[key] ?? 0 }))
}

async function createFixture(): Promise<Fixture> {
    const suffix = randomUUID().replace(/-/g, '').slice(0, 10)
    const tenantSlug = `camera-e2e-${suffix}`
    const tenantSchema = tenantSchemaNameFromSlug(tenantSlug)
    const email = `camera-e2e-${suffix}@example.invalid`
    const password = `CameraE2E-${randomUUID()}-x`
    const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } },
    )

    const authResult = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: 'Disposable Camera E2E Admin', status: 'active' },
    })
    if (authResult.error || !authResult.data.user) {
        throw new Error(`Could not create disposable auth user: ${authResult.error?.message || 'no user returned'}`)
    }

    let tenantId: string | undefined
    try {
        const trialEnd = new Date(Date.now() + 24 * 60 * 60 * 1000)
        const [tenant] = await masterDb.insert(tenants).values({
            slug: tenantSlug,
            company_name: 'Disposable Camera E2E Workspace',
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
            app_name: 'Disposable Camera E2E',
            short_name: 'Camera E2E',
        })
        await provisionTenant(
            tenantSlug,
            'Disposable Camera E2E Workspace',
            email,
            1,
            authResult.data.user.id,
            { firstName: 'Disposable', lastName: 'Camera E2E' },
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

async function login(page: Page, baseUrl: string, fixture: Fixture) {
    await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded' })
    await page.locator('#login-email').fill(fixture.email)
    await page.locator('#login-password').fill(fixture.password)
    await page.getByRole('button', { name: /sign in/i }).click()
    await page.waitForURL((url) => !url.pathname.endsWith('/login'), { timeout: 30_000 })

    const cookies = await page.context().cookies()
    assert(
        cookies.some((cookie) => cookie.name.includes('-auth-token')),
        'Login completed without a Supabase auth cookie',
    )
    assert(
        cookies.some((cookie) => cookie.name === 'tenant_fallback' && cookie.value === fixture.tenantSlug),
        'Login completed without the disposable tenant fallback cookie',
    )
}

async function captureNaturalFrames(page: Page): Promise<string[]> {
    return page.evaluate(async (pipeline) => {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: { ideal: 'user' },
                width: { ideal: 960, min: 480 },
                height: { ideal: 1280, min: 640 },
                aspectRatio: { ideal: 0.75 },
                frameRate: { ideal: 24, max: 24 },
            },
            audio: false,
        })
        const video = document.createElement('video')
        video.muted = true
        video.playsInline = true
        video.srcObject = stream
        document.body.appendChild(video)
        await video.play()
        await new Promise<void>((resolve) => {
            if (video.readyState >= 2) resolve()
            else video.addEventListener('loadeddata', () => resolve(), { once: true })
        })
        const canvas = document.createElement('canvas')
        const width = Math.min(960, video.videoWidth)
        const height = Math.round(width / 0.75)
        canvas.width = width
        canvas.height = height
        const context = canvas.getContext('2d')
        if (!context) throw new Error('Camera canvas is unavailable')

        const frames: string[] = []
        for (let index = 0; index < 3; index += 1) {
            await new Promise((resolve) => setTimeout(resolve, index === 0 ? 500 : 300))
            context.drawImage(video, 0, 0, video.videoWidth, video.videoHeight, 0, 0, width, height)
            frames.push(canvas.toDataURL('image/jpeg', 0.86))
        }
        stream.getTracks().forEach((track) => track.stop())
        video.remove()
        if (frames.length !== 3 || frames.some((frame) => !frame.startsWith('data:image/jpeg;base64,'))) {
            throw new Error(`Camera capture returned an invalid frame set for ${pipeline}`)
        }
        if (new Set(frames).size !== 3) throw new Error('Camera fixture returned three identical frames; a moving natural capture is required')
        return frames
    }, PIPELINE_VERSION)
}

async function uploadEnrollment(
    request: APIRequestContext,
    baseUrl: string,
    fixture: Fixture,
    frames: string[],
): Promise<{ path: string; proof: string; verification: any }> {
    const challengeResult = await postJson(request, baseUrl, '/api/biometric/challenge', { purpose: 'enrollment' })
    assert(challengeResult.status === 200 && typeof challengeResult.body.challenge === 'string', `Enrollment challenge failed: ${JSON.stringify(challengeResult)}`)
    assert(challengeResult.body.frameCount === 3, 'Enrollment challenge did not require three frames')

    const response = await request.post(`${baseUrl}/api/upload-avatar`, {
        multipart: {
            profileId: fixture.userId,
            biometricPipelineVersion: PIPELINE_VERSION,
            challenge: challengeResult.body.challenge,
            livenessFrames: JSON.stringify(frames),
        },
    })
    const result = await readJson(response)
    assert(result.status === 200 && result.body.success === true, `Enrollment upload failed: ${JSON.stringify(result)}`)
    assert(result.body.status === 'pending_review', 'Enrollment upload did not remain pending review')
    assert(typeof result.body.path === 'string' && typeof result.body.enrollmentProof === 'string', 'Enrollment did not return a server proof')
    assert(result.body.verification?.embeddingDimensions === 512, 'Enrollment did not return a 512-dimensional verification')
    assert(result.body.verification?.livenessPassed === true, 'Enrollment did not pass liveness')
    assert(result.body.verification?.canonicalPortraitAspectRatio === '3:4', 'Enrollment did not return a canonical 3:4 portrait')
    return {
        path: result.body.path,
        proof: result.body.enrollmentProof,
        verification: result.body.verification,
    }
}

async function createAndApproveEnrollment(fixture: Fixture, path: string, proof: string) {
    const request = await runWithTenantSchema(fixture.tenantSchema, () => ProfileService.createPhotoUpdateRequest({
        profileId: fixture.userId,
        pendingPhotoUrl: path,
        enrollmentProof: proof,
    }))
    assert(request.status === 'pending', 'Enrollment request was not created as pending')
    const approved = await runWithTenantSchema(fixture.tenantSchema, () => ProfileService.reviewPhotoRequest({
        requestId: request.id,
        action: 'approve',
        reviewerId: fixture.userId,
    }))
    assert(approved?.success === true && approved.action === 'approve', 'Enrollment request was not approved')

    const approvedProfile: any[] = await runWithTenantSchema(fixture.tenantSchema, () => centralDb.execute(sql`
        SELECT face_embedding_512, face_embedding_pipeline_version, avatar_url
        FROM ${sql.raw(`${fixture.tenantSchema}.profiles`)}
        WHERE id = ${fixture.userId}
        LIMIT 1
    `))
    const profile = approvedProfile[0] as any
    const vector = typeof profile?.face_embedding_512 === 'string'
        ? JSON.parse(profile.face_embedding_512)
        : profile?.face_embedding_512
    assert(Array.isArray(vector) && vector.length === 512, 'Approved profile does not contain a 512-dimensional template')
    assert(typeof profile.face_embedding_pipeline_version === 'string', 'Approved profile does not contain an embedding pipeline version')
}

async function verifyAttendance(
    request: APIRequestContext,
    baseUrl: string,
    frames: string[],
    expectedAction: 'check_in' | 'check_out',
): Promise<any> {
    const challenge = await postJson(request, baseUrl, '/api/biometric/challenge', { purpose: 'attendance' })
    assert(challenge.status === 200 && typeof challenge.body.challenge === 'string', `PWA challenge failed: ${JSON.stringify(challenge)}`)
    const payload = {
        frames,
        challenge: challenge.body.challenge,
        biometricPipelineVersion: PIPELINE_VERSION,
    }
    const result = await postJson(request, baseUrl, '/api/attendance/verify-face', payload)
    assert(result.status === 200 && result.body.matched === true, `PWA ${expectedAction} failed: ${JSON.stringify(result)}`)
    assert(result.body.verification?.embeddingDimensions === 512, 'PWA verification did not use a 512-dimensional probe')
    assert(result.body.verification?.livenessPassed === true, 'PWA verification did not pass liveness')
    assert(result.body.canonical_portrait_aspect_ratio === '3:4', 'PWA verification did not return a canonical 3:4 portrait')

    // The mobile PWA records attendance in a separate tRPC mutation after the
    // server-only face verification succeeds. Kiosk verification is different:
    // its route performs the punch itself and returns a punch object.
    const punch = await recordPwaAttendance(request, baseUrl, expectedAction)
    assert(punch.action === expectedAction, `PWA expected ${expectedAction}, got ${punch.action}`)
    return { payload, result: result.body, punch }
}

async function recordPwaAttendance(
    request: APIRequestContext,
    baseUrl: string,
    action: 'check_in' | 'check_out',
) {
    const localDate = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Kolkata' })
    const procedure = action === 'check_in' ? 'attendance.clockIn' : 'attendance.clockOut'
    const input = action === 'check_in'
        ? { localDate, isExtraDay: false }
        : { localDate }
    const response = await postJson(request, baseUrl, `/api/trpc/${procedure}?batch=1`, {
        0: input,
    })
    const envelope = Array.isArray(response.body) ? response.body[0] : response.body
    const errorMessage = envelope?.error?.json?.message || envelope?.error?.message
    assert(
        response.status === 200 && !envelope?.error,
        `PWA ${action} attendance mutation failed: ${JSON.stringify({ response, errorMessage })}`,
    )

    const record = envelope?.result?.data?.json ?? envelope?.result?.data
    assert(record && typeof record === 'object', `PWA ${action} attendance mutation returned no record: ${JSON.stringify(response)}`)
    return { action, record }
}

async function getDisposableAttendanceCounts(fixture: Fixture) {
    return runWithTenantSchema(fixture.tenantSchema, async () => {
        const [attendanceRows, sessionRows, attemptRows] = await Promise.all([
            centralDb.execute(sql`SELECT count(*)::int AS count FROM ${sql.raw(`${fixture.tenantSchema}.attendance`)} WHERE profile_id = ${fixture.userId}`),
            centralDb.execute(sql`SELECT count(*)::int AS count FROM ${sql.raw(`${fixture.tenantSchema}.attendance_sessions`)} WHERE profile_id = ${fixture.userId}`),
            centralDb.execute(sql`SELECT count(*)::int AS count FROM ${sql.raw(`${fixture.tenantSchema}.biometric_verification_attempts`)} WHERE profile_id = ${fixture.userId}`),
        ])
        return {
            attendance: Number((attendanceRows[0] as any).count),
            sessions: Number((sessionRows[0] as any).count),
            verificationAttempts: Number((attemptRows[0] as any).count),
        }
    })
}

async function run() {
    requireDisposableRun()
    requireEnvironment()
    await loadApplicationDependencies()
    const baseUrl = (process.env.PAYFIX_E2E_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, '')
    const cameraY4m = process.env.PAYFIX_E2E_CAMERA_Y4M
    if (cameraY4m && !existsSync(cameraY4m)) throw new Error(`PAYFIX_E2E_CAMERA_Y4M does not exist: ${cameraY4m}`)

    const tenantPrimaryBefore = await snapshotTenantPrimary()
    let fixture: Fixture | undefined
    let browser: Browser | undefined
    let context: BrowserContext | undefined
    const checks: CheckResult[] = []

    try {
        fixture = await createFixture()
        const browserArgs = [
            '--use-fake-ui-for-media-stream',
            '--use-fake-device-for-media-stream',
            '--autoplay-policy=no-user-gesture-required',
        ]
        if (cameraY4m) browserArgs.push(`--use-file-for-fake-video-capture=${cameraY4m}`)
        browser = await chromium.launch({
            headless: process.env.PAYFIX_E2E_HEADLESS !== 'false',
            args: browserArgs,
        })
        context = await browser.newContext({
            permissions: ['camera', 'geolocation'],
            geolocation: { latitude: TEST_LATITUDE, longitude: TEST_LONGITUDE },
        })
        const page = await context.newPage()
        await login(page, baseUrl, fixture)
        checks.push({ name: 'disposable tenant login and tenant routing', ok: true, details: { slug: fixture.tenantSlug } })

        const enrollmentFrames = await captureNaturalFrames(page)
        const enrollment = await uploadEnrollment(context.request, baseUrl, fixture, enrollmentFrames)
        fixture.pendingPhotoPath = new URL(enrollment.path).pathname.split('/avatars/')[1]
        assert(fixture.pendingPhotoPath, 'Could not determine the disposable avatar storage path')
        checks.push({
            name: 'camera enrollment',
            ok: true,
            details: {
                frameCount: enrollmentFrames.length,
                livenessPassed: enrollment.verification.livenessPassed,
                canonicalPortraitAspectRatio: enrollment.verification.canonicalPortraitAspectRatio,
                embeddingDimensions: enrollment.verification.embeddingDimensions,
            },
        })

        await createAndApproveEnrollment(fixture, enrollment.path, enrollment.proof)
        checks.push({ name: 'signed enrollment proof and admin approval', ok: true })

        const pwaCheckInFrames = await captureNaturalFrames(page)
        const pwaCheckIn = await verifyAttendance(context.request, baseUrl, pwaCheckInFrames, 'check_in')
        const pwaReplay = await postJson(context.request, baseUrl, '/api/attendance/verify-face', pwaCheckIn.payload)
        assert(pwaReplay.status === 403 && pwaReplay.body.code === 'LIVENESS_CHALLENGE_REPLAYED', `PWA replay was not rejected: ${JSON.stringify(pwaReplay)}`)
        const afterPwaCheckIn = await getDisposableAttendanceCounts(fixture)
        assert(afterPwaCheckIn.attendance === 1 && afterPwaCheckIn.sessions === 1, 'PWA replay created extra attendance data')
        checks.push({ name: 'PWA check-in and challenge replay rejection', ok: true, details: pwaCheckIn.result.punch })

        const pwaCheckOutFrames = await captureNaturalFrames(page)
        const pwaCheckOut = await verifyAttendance(context.request, baseUrl, pwaCheckOutFrames, 'check_out')
        const afterPwaCheckOut = await getDisposableAttendanceCounts(fixture)
        assert(afterPwaCheckOut.attendance === 1 && afterPwaCheckOut.sessions === 1, 'PWA check-out created an unexpected extra session')
        checks.push({ name: 'PWA check-out', ok: true, details: pwaCheckOut.result.punch })

        const location = await runWithTenantSchema(fixture.tenantSchema, () => GeofenceService.addLocation({
            name: 'Disposable Camera E2E Office',
            address: 'Disposable fixture',
            latitude: TEST_LATITUDE,
            longitude: TEST_LONGITUDE,
            radiusMeters: TEST_RADIUS_METERS,
        }, fixture!.userId))
        fixture.locationId = location.id
        const device = await runWithTenantSchema(fixture.tenantSchema, () => KioskDeviceService.createDevice({
            name: 'Disposable Camera E2E Kiosk',
            locationId: location.id,
            createdBy: fixture!.userId,
        }))
        fixture.kioskDeviceId = device.id

        const pairing = await postJson(context.request, baseUrl, '/api/kiosk/session', {
            pairingCode: device.pairing_code,
            terminalId: TERMINAL_ID,
        })
        assert(pairing.status === 200 && pairing.body.success === true, `Kiosk pairing failed: ${JSON.stringify(pairing)}`)
        const heartbeat = await getJson(context.request, baseUrl, '/api/kiosk/session', {
            'x-kiosk-installation-id': TERMINAL_ID,
        })
        assert(heartbeat.status === 200 && heartbeat.body.success === true, `Kiosk heartbeat failed: ${JSON.stringify(heartbeat)}`)
        const wrongTerminalContext = await browser.newContext()
        await wrongTerminalContext.addCookies(await context.cookies())
        const wrongTerminal = await getJson(wrongTerminalContext.request, baseUrl, '/api/kiosk/session', {
            'x-kiosk-installation-id': WRONG_TERMINAL_ID,
        })
        await wrongTerminalContext.close()
        assert(wrongTerminal.status === 401, `Kiosk accepted a wrong terminal identity: ${JSON.stringify(wrongTerminal)}`)
        checks.push({ name: 'kiosk pairing, heartbeat, and terminal binding', ok: true })

        const kioskHeaders = { 'x-kiosk-installation-id': TERMINAL_ID }
        const outsideChallenge = await postJson(context.request, baseUrl, '/api/biometric/challenge', { purpose: 'attendance' }, kioskHeaders)
        assert(outsideChallenge.status === 200, `Could not create kiosk geofence challenge: ${JSON.stringify(outsideChallenge)}`)
        const outsideResult = await postJson(context.request, baseUrl, '/api/kiosk/verify-face', {
            frames: await captureNaturalFrames(page),
            challenge: outsideChallenge.body.challenge,
            biometricPipelineVersion: PIPELINE_VERSION,
            latitude: TEST_LATITUDE + 0.02,
            longitude: TEST_LONGITUDE,
        }, kioskHeaders)
        assert(outsideResult.status === 403 && outsideResult.body.code === 'KIOSK_GEOFENCE_FAILED', `Kiosk geofence rejection failed: ${JSON.stringify(outsideResult)}`)
        const afterOutside = await getDisposableAttendanceCounts(fixture)
        assert(afterOutside.attendance === 1 && afterOutside.sessions === 1, 'Kiosk geofence rejection mutated attendance')

        const kioskChallenge = await postJson(context.request, baseUrl, '/api/biometric/challenge', { purpose: 'attendance' }, kioskHeaders)
        assert(kioskChallenge.status === 200, `Could not create kiosk face challenge: ${JSON.stringify(kioskChallenge)}`)
        const kioskPayload = {
            frames: await captureNaturalFrames(page),
            challenge: kioskChallenge.body.challenge,
            biometricPipelineVersion: PIPELINE_VERSION,
            latitude: TEST_LATITUDE,
            longitude: TEST_LONGITUDE,
        }
        const kioskResult = await postJson(context.request, baseUrl, '/api/kiosk/verify-face', kioskPayload, kioskHeaders)
        assert(kioskResult.status === 200 && kioskResult.body.matched === true, `Kiosk face verification failed: ${JSON.stringify(kioskResult)}`)
        assert(kioskResult.body.punch?.action === 'check_in', `Kiosk did not create the expected check-in: ${JSON.stringify(kioskResult.body.punch)}`)
        assert(kioskResult.body.verification?.embeddingDimensions === 512, 'Kiosk verification did not use a 512-dimensional probe')
        assert(kioskResult.body.verification?.livenessPassed === true, 'Kiosk verification did not pass liveness')
        assert(kioskResult.body.canonical_portrait_aspect_ratio === '3:4', 'Kiosk verification did not return a canonical 3:4 portrait')
        const kioskReplay = await postJson(context.request, baseUrl, '/api/kiosk/verify-face', kioskPayload, kioskHeaders)
        assert(kioskReplay.status === 403 && kioskReplay.body.code === 'LIVENESS_CHALLENGE_REPLAYED', `Kiosk replay was not rejected: ${JSON.stringify(kioskReplay)}`)
        checks.push({
            name: 'kiosk geofence, server face match, and replay rejection',
            ok: true,
            details: { punch: kioskResult.body.punch, similarity: kioskResult.body.similarity },
        })

        const kioskCheckOutChallenge = await postJson(context.request, baseUrl, '/api/biometric/challenge', { purpose: 'attendance' }, kioskHeaders)
        assert(kioskCheckOutChallenge.status === 200, `Could not create kiosk check-out challenge: ${JSON.stringify(kioskCheckOutChallenge)}`)
        const kioskCheckOutPayload = {
            frames: await captureNaturalFrames(page),
            challenge: kioskCheckOutChallenge.body.challenge,
            biometricPipelineVersion: PIPELINE_VERSION,
            latitude: TEST_LATITUDE,
            longitude: TEST_LONGITUDE,
        }
        const kioskCheckOut = await postJson(context.request, baseUrl, '/api/kiosk/verify-face', kioskCheckOutPayload, kioskHeaders)
        assert(kioskCheckOut.status === 200 && kioskCheckOut.body.matched === true, `Kiosk face check-out failed: ${JSON.stringify(kioskCheckOut)}`)
        assert(kioskCheckOut.body.punch?.action === 'check_out', `Kiosk did not create the expected check-out: ${JSON.stringify(kioskCheckOut.body.punch)}`)
        assert(kioskCheckOut.body.verification?.embeddingDimensions === 512, 'Kiosk check-out did not use a 512-dimensional probe')
        assert(kioskCheckOut.body.verification?.livenessPassed === true, 'Kiosk check-out did not pass liveness')
        assert(kioskCheckOut.body.canonical_portrait_aspect_ratio === '3:4', 'Kiosk check-out did not return a canonical 3:4 portrait')
        checks.push({
            name: 'kiosk check-out',
            ok: true,
            details: { punch: kioskCheckOut.body.punch, similarity: kioskCheckOut.body.similarity },
        })

        const revoked = await deleteJson(context.request, baseUrl, '/api/kiosk/session', {
            'x-kiosk-installation-id': TERMINAL_ID,
        })
        assert(revoked.status === 200 && revoked.body.success === true, `Kiosk revocation failed: ${JSON.stringify(revoked)}`)
        const afterRevoke = await getJson(context.request, baseUrl, '/api/kiosk/session', {
            'x-kiosk-installation-id': TERMINAL_ID,
        })
        assert(afterRevoke.status === 401 && afterRevoke.body.error === 'KIOSK_SESSION_INVALID', `Revoked kiosk session remained usable: ${JSON.stringify(afterRevoke)}`)
        checks.push({ name: 'kiosk credential revocation', ok: true })

        const finalCounts = await getDisposableAttendanceCounts(fixture)
        assert(finalCounts.attendance === 1 && finalCounts.sessions === 2, `Unexpected disposable attendance counts: ${JSON.stringify(finalCounts)}`)
        console.log(JSON.stringify({
            status: 'passed',
            tenant: fixture.tenantSlug,
            attendance: finalCounts,
            checks,
            tenantPrimaryChanged: [],
        }, null, 2))
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        checks.push({ name: 'camera biometric E2E', ok: false, details: { error: message } })
        console.error(JSON.stringify({ status: 'failed', checks }, null, 2))
        throw error
    } finally {
        if (context) await context.close().catch(() => {})
        if (browser) await browser.close().catch(() => {})
        if (fixture) {
            try {
                if (fixture.pendingPhotoPath) {
                    const supabaseAdmin = createClient(
                        process.env.NEXT_PUBLIC_SUPABASE_URL!,
                        process.env.SUPABASE_SERVICE_ROLE_KEY!,
                        { auth: { autoRefreshToken: false, persistSession: false } },
                    )
                    await supabaseAdmin.storage.from('avatars').remove([decodeURIComponent(fixture.pendingPhotoPath)])
                }
            } catch (error) {
                console.error('[camera-e2e] Storage cleanup warning:', error)
            }
            try {
                await masterDb.update(tenants).set({ status: 'cancelled' }).where(eq(tenants.id, fixture.tenantId))
                const cleanup = await deprovisionTenant(fixture.tenantId, fixture.tenantSchema, fixture.tenantSlug)
                if (!cleanup.success) console.error('[camera-e2e] Tenant cleanup warnings:', cleanup.errors)
            } catch (error) {
                console.error('[camera-e2e] Disposable tenant cleanup failed:', error)
                process.exitCode = 1
            }
        }
        try {
            const tenantPrimaryAfter = await snapshotTenantPrimary()
            const changed = diffSnapshots(tenantPrimaryBefore, tenantPrimaryAfter)
            if (changed.length > 0) {
                console.error('[camera-e2e] SAFETY FAILURE: tenant_primary changed:', JSON.stringify(changed))
                process.exitCode = 1
            } else {
                console.log('[camera-e2e] tenant_primary snapshot unchanged')
            }
        } catch (error) {
            console.error('[camera-e2e] Could not verify tenant_primary snapshot:', error)
            process.exitCode = 1
        }
    }
}

run()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error instanceof Error ? error.message : String(error))
        process.exit(1)
    })