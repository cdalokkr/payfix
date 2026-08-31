import { db, centralDb } from '@/lib/db'
import { kioskDevices, officeLocations } from '@/lib/db/schema'
import { eq, and, sql } from 'drizzle-orm'
import { throwAppError } from '@/lib/errors/app-errors'
import { createHash, randomBytes } from 'node:crypto'
import { tenantStorage } from '@/lib/tenant/store'

export const KIOSK_SESSION_COOKIE = 'payfix_kiosk_session'
export const KIOSK_SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60
const KIOSK_SESSION_TTL_MS = KIOSK_SESSION_MAX_AGE_SECONDS * 1000

// ─── In-memory Pairing Code Cache (5-min TTL) — avoids tenant scan loop on every punch ───
interface PairingInfo {
    device: {
        id: string
        name: string
        pairingCode: string
        terminalId: string | null
        locationId: string | null
        locationName: string | null
        latitude: number | null
        longitude: number | null
        radiusMeters: number
    }
    tenantSchema: string
    tenantSlug: string
}

export type KioskDevicePublicInfo = Omit<PairingInfo['device'], 'pairingCode'>

export function toPublicKioskDevice(device: PairingInfo['device']): KioskDevicePublicInfo {
    const { pairingCode: _pairingCode, ...publicDevice } = device
    return publicDevice
}

function hashCredential(credential: string): string {
    return createHash('sha256').update(credential).digest('hex')
}

export function getKioskSessionCredential(request: Request): string | null {
    const cookieHeader = request.headers.get('cookie') || ''
    const cookie = cookieHeader
        .split(';')
        .map(value => value.trim())
        .find(value => value.startsWith(`${KIOSK_SESSION_COOKIE}=`))
    if (!cookie) return null
    try {
        return decodeURIComponent(cookie.slice(KIOSK_SESSION_COOKIE.length + 1)) || null
    } catch {
        return null
    }
}
const _pairingCache = new Map<string, { data: PairingInfo; expiresAt: number }>()
const PAIRING_CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

// ─── Per-tenant schema init flag — skips repeated CREATE TABLE IF NOT EXISTS round-trips ───
const _kioskSchemaEnsured = new Set<string>()

export class KioskDeviceService {
    /**
     * Ensure kiosk_devices table exists in the current tenant schema.
     */
    static async ensureSchema() {
        const schemaKey = tenantStorage.getStore()?.tenantSchema || 'kiosk_schema'
        if (_kioskSchemaEnsured.has(schemaKey)) return // Skip if already ensured this process lifetime
        try {
            await db.execute(sql`
                CREATE TABLE IF NOT EXISTS "kiosk_devices" (
                    "id"            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                    "name"          text NOT NULL,
                    "pairing_code"  text NOT NULL UNIQUE,
                    "terminal_id"   text,
                    "location_id"   uuid REFERENCES "office_locations"("id") ON DELETE SET NULL,
                    "is_active"     boolean DEFAULT true,
                    "last_seen_at"  timestamp with time zone,
                    "created_by"    uuid REFERENCES "profiles"("id") ON DELETE SET NULL,
                    "created_at"    timestamp with time zone DEFAULT now(),
                    "updated_at"    timestamp with time zone DEFAULT now()
                );
            `)
            await db.execute(sql`ALTER TABLE "kiosk_devices" ADD COLUMN IF NOT EXISTS "terminal_id" text;`)
            await db.execute(sql`ALTER TABLE "kiosk_devices" ADD COLUMN IF NOT EXISTS "credential_hash" text;`)
            await db.execute(sql`ALTER TABLE "kiosk_devices" ADD COLUMN IF NOT EXISTS "credential_expires_at" timestamp with time zone;`)
            await db.execute(sql`
                CREATE INDEX IF NOT EXISTS "kiosk_devices_terminal_id_idx"
                ON "kiosk_devices" ("terminal_id")
                WHERE "terminal_id" IS NOT NULL;
            `)
            _kioskSchemaEnsured.add(schemaKey)
        } catch (e) {
            // Table already exists or concurrent creation
        }
    }

    /**
     * Generate unique Kiosk Pairing Code (e.g. KSK-9A82B-C41F)
     */
    static generatePairingCode(): string {
        const randStr = () => Math.random().toString(36).substring(2, 6).toUpperCase()
        return `KSK-${randStr()}-${randStr()}`
    }

    /**
     * Create a new paired Kiosk Device inside the current tenant workspace
     */
    static async createDevice({
        name,
        locationId,
        createdBy
    }: {
        name: string
        locationId?: string | null
        createdBy?: string | null
    }) {
        await KioskDeviceService.ensureSchema()

        let pairingCode = KioskDeviceService.generatePairingCode()
        let retries = 3

        while (retries > 0) {
            try {
                const [newDevice] = await db.insert(kioskDevices).values({
                    name,
                    pairing_code: pairingCode,
                    location_id: locationId || null,
                    created_by: createdBy || null,
                    is_active: true
                }).returning()

                return newDevice
            } catch (err: any) {
                if (err?.code === '23505') { // Unique constraint violation
                    pairingCode = KioskDeviceService.generatePairingCode()
                    retries--
                } else {
                    throw err
                }
            }
        }

        throwAppError('DATABASE_ERROR', 'Failed to generate unique pairing code. Please try again.')
    }

    /**
     * Get all registered Kiosk devices for current tenant
     */
    static async getDevices() {
        await KioskDeviceService.ensureSchema()

        const devices = await db
            .select({
                id: kioskDevices.id,
                name: kioskDevices.name,
                pairingCode: kioskDevices.pairing_code,
                terminalId: kioskDevices.terminal_id,
                locationId: kioskDevices.location_id,
                locationName: officeLocations.name,
                locationLatitude: officeLocations.latitude,
                locationLongitude: officeLocations.longitude,
                locationRadius: officeLocations.radius_meters,
                isActive: kioskDevices.is_active,
                lastSeenAt: kioskDevices.last_seen_at,
                createdAt: kioskDevices.created_at,
            })
            .from(kioskDevices)
            .leftJoin(officeLocations, eq(kioskDevices.location_id, officeLocations.id))

        return devices
    }

    /**
     * Delete a Kiosk Device
     */
    static async deleteDevice(id: string) {
        await KioskDeviceService.ensureSchema()
        const [deletedDevice] = await db
            .delete(kioskDevices)
            .where(eq(kioskDevices.id, id))
            .returning({ pairingCode: kioskDevices.pairing_code })

        // A pairing lookup may have been cached for up to five minutes. Remove
        // it immediately so an unpaired terminal cannot keep authenticating
        // through the cached credential.
        if (deletedDevice?.pairingCode) {
            _pairingCache.delete(deletedDevice.pairingCode.trim().toUpperCase())
        }

        return { success: true }
    }

    /**
     * Verify a Kiosk Pairing Code across all tenant schemas.
     * Used by /api/kiosk endpoints to resolve tenant context & validate terminal key.
     */
    static async verifyPairingCode(pairingCode: string, terminalId?: string) {
        if (!pairingCode) return null

        const cleanCode = pairingCode.trim().toUpperCase()

        // A cache hit is only a routing optimisation, never an authorization
        // decision. Recheck the exact terminal record so an admin unpair takes
        // effect immediately even on a warm server instance.
        const cached = _pairingCache.get(cleanCode)
        if (cached && cached.expiresAt > Date.now()) {
            if (cached.data.device.terminalId && cached.data.device.terminalId !== terminalId) {
                return null
            }
            try {
                const stillActive = await centralDb.execute(sql`
                    SELECT id, terminal_id
                    FROM ${sql.raw(cached.data.tenantSchema)}.kiosk_devices
                    WHERE id = ${cached.data.device.id}
                      AND pairing_code = ${cleanCode}
                      AND is_active = true
                    LIMIT 1;
                `)
                if (stillActive[0] && (!(stillActive[0] as any).terminal_id || (stillActive[0] as any).terminal_id === terminalId)) {
                    return cached.data
                }
            } catch {
                // Treat a failed cache recheck as invalid and fall through to
                // the authoritative tenant scan below.
            }
            _pairingCache.delete(cleanCode)
        }

        try {
            // Search all active tenant schemas for this pairing code
            const schemasRes = await centralDb.execute(sql`
                SELECT schema_name FROM information_schema.schemata WHERE schema_name LIKE 'tenant_%';
            `)

            for (const row of schemasRes) {
                const schemaName = (row as any).schema_name
                try {
                    const devices = await centralDb.execute(sql`
                        SELECT id, name, pairing_code, terminal_id, location_id, is_active
                        FROM ${sql.raw(schemaName)}.kiosk_devices
                        WHERE pairing_code = ${cleanCode} AND is_active = true
                        LIMIT 1;
                    `)

                    if (devices[0]) {
                        const device = devices[0] as any
                        if (device.terminal_id && device.terminal_id !== terminalId) {
                            return null
                        }
                        const slug = schemaName.replace(/^tenant_/, '')

                        let locationName: string | null = null
                        let latitude: number | null = null
                        let longitude: number | null = null
                        let radiusMeters = 200

                        if (device.location_id) {
                            try {
                                const locs = await centralDb.execute(sql`
                                    SELECT name, latitude, longitude, radius_meters
                                    FROM ${sql.raw(schemaName)}.office_locations
                                    WHERE id = ${device.location_id}
                                    LIMIT 1;
                                `)
                                if (locs[0]) {
                                    const loc = locs[0] as any
                                    locationName = loc.name
                                    latitude = loc.latitude ? Number(loc.latitude) : null
                                    longitude = loc.longitude ? Number(loc.longitude) : null
                                    radiusMeters = loc.radius_meters ? Number(loc.radius_meters) : 200
                                }
                            } catch {
                                // Ignore location lookup error if table does not exist
                            }
                        }

                        // Update last_seen_at timestamp (fire and forget)
                        centralDb.execute(sql`
                            UPDATE ${sql.raw(schemaName)}.kiosk_devices
                            SET last_seen_at = NOW()
                            WHERE id = ${device.id};
                        `).catch(() => {})

                        const result: PairingInfo = {
                            device: {
                                id: device.id,
                                name: device.name,
                                pairingCode: device.pairing_code,
                                terminalId: device.terminal_id || null,
                                locationId: device.location_id,
                                locationName,
                                latitude,
                                longitude,
                                radiusMeters,
                            },
                            tenantSchema: schemaName,
                            tenantSlug: slug
                        }

                        // ✅ Cache result for 5 minutes
                        _pairingCache.set(cleanCode, { data: result, expiresAt: Date.now() + PAIRING_CACHE_TTL_MS })

                        return result
                    }
                } catch {
                    // Table might not exist yet in this schema — continue search
                }
            }
        } catch (err) {
            console.error('[KioskDeviceService] verifyPairingCode error:', err)
        }

        return null
    }

    static async claimPairingCode(pairingCode: string, terminalId: string) {
        const result = await KioskDeviceService.verifyPairingCode(pairingCode)
        if (!result) return null
        const [claimed] = await db.update(kioskDevices)
            .set({ terminal_id: terminalId, updated_at: new Date() })
            .where(and(
                eq(kioskDevices.id, result.device.id),
                eq(kioskDevices.is_active, true),
                sql`("terminal_id" IS NULL OR "terminal_id" = ${terminalId})`
            ))
            .returning({ id: kioskDevices.id })
        _pairingCache.delete(pairingCode.trim().toUpperCase())
        return claimed ? { ...result, device: { ...result.device, terminalId } } : null
    }

    /**
     * Replace a one-time admin pairing code with a random, expiring kiosk
     * session credential. Only its hash is stored server-side and the raw
     * credential is returned to the route solely for an HttpOnly cookie.
     */
    static async issueSessionCredential(pairing: PairingInfo, terminalId: string) {
        const credential = randomBytes(32).toString('base64url')
        const expiresAt = new Date(Date.now() + KIOSK_SESSION_TTL_MS)
        const [updated] = await db.update(kioskDevices)
            .set({
                credential_hash: hashCredential(credential),
                credential_expires_at: expiresAt,
                terminal_id: terminalId,
                updated_at: new Date(),
            })
            .where(and(
                eq(kioskDevices.id, pairing.device.id),
                eq(kioskDevices.is_active, true),
                sql`("terminal_id" IS NULL OR "terminal_id" = ${terminalId})`,
            ))
            .returning({ id: kioskDevices.id })

        if (!updated) return null
        return {
            credential,
            expiresAt,
            device: { ...pairing.device, terminalId },
            tenantSchema: pairing.tenantSchema,
            tenantSlug: pairing.tenantSlug,
        }
    }

    /**
     * Resolve an HttpOnly kiosk session credential. The database row is
     * rechecked on every request so delete, deactivation, revocation, and
     * expiry take effect without waiting for an in-memory cache.
     */
    static async verifySessionCredential(credential: string, terminalId?: string) {
        if (!credential) return null
        const credentialHash = hashCredential(credential)

        try {
            const schemasRes = await centralDb.execute(sql`
                SELECT schema_name FROM information_schema.schemata WHERE schema_name LIKE 'tenant_%';
            `)

            for (const row of schemasRes) {
                const schemaName = (row as any).schema_name
                try {
                    const devices = await centralDb.execute(sql`
                        SELECT pairing_code
                        FROM ${sql.raw(schemaName)}.kiosk_devices
                        WHERE credential_hash = ${credentialHash}
                          AND is_active = true
                          AND credential_expires_at > NOW()
                          AND ("terminal_id" IS NULL OR "terminal_id" = ${terminalId || ''})
                        LIMIT 1;
                    `)
                    const pairingCode = (devices[0] as any)?.pairing_code
                    if (pairingCode) {
                        return await KioskDeviceService.verifyPairingCode(pairingCode, terminalId)
                    }
                } catch {
                    // Older tenant schemas without the new columns are
                    // intentionally treated as requiring an explicit re-pair.
                }
            }
        } catch (err) {
            console.error('[KioskDeviceService] verifySessionCredential error:', err)
            throw err
        }

        return null
    }

    /**
     * Revoke the current browser session immediately without deleting the
     * registered kiosk device. The next open must explicitly re-pair.
     */
    static async revokeSessionCredential(credential: string, terminalId?: string) {
        if (!credential) return false
        const credentialHash = hashCredential(credential)
        const terminalConstraint = terminalId
            ? sql`AND ("terminal_id" IS NULL OR "terminal_id" = ${terminalId})`
            : sql``

        const schemasRes = await centralDb.execute(sql`
            SELECT schema_name FROM information_schema.schemata WHERE schema_name LIKE 'tenant_%';
        `)

        for (const row of schemasRes) {
            const schemaName = (row as any).schema_name
            try {
                const revoked = await centralDb.execute(sql`
                    UPDATE ${sql.raw(schemaName)}.kiosk_devices
                    SET credential_hash = NULL,
                        credential_expires_at = NULL,
                        updated_at = NOW()
                    WHERE credential_hash = ${credentialHash}
                      AND is_active = true
                      ${terminalConstraint}
                    RETURNING id;
                `)
                if (revoked[0]) return true
            } catch {
                // Older tenant schemas without session columns are ignored.
            }
        }

        return false
    }

}
