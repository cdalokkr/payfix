import { db, centralDb } from '@/lib/db'
import { kioskDevices, officeLocations } from '@/lib/db/schema'
import { eq, and, sql } from 'drizzle-orm'
import { throwAppError } from '@/lib/errors/app-errors'

export class KioskDeviceService {
    /**
     * Ensure kiosk_devices table exists in the current tenant schema.
     */
    static async ensureSchema() {
        try {
            await db.execute(sql`
                CREATE TABLE IF NOT EXISTS "kiosk_devices" (
                    "id"            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                    "name"          text NOT NULL,
                    "pairing_code"  text NOT NULL UNIQUE,
                    "location_id"   uuid REFERENCES "office_locations"("id") ON DELETE SET NULL,
                    "is_active"     boolean DEFAULT true,
                    "last_seen_at"  timestamp with time zone,
                    "created_by"    uuid REFERENCES "profiles"("id") ON DELETE SET NULL,
                    "created_at"    timestamp with time zone DEFAULT now(),
                    "updated_at"    timestamp with time zone DEFAULT now()
                );
            `)
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
        await db.delete(kioskDevices).where(eq(kioskDevices.id, id))
        return { success: true }
    }

    /**
     * Verify a Kiosk Pairing Code across all tenant schemas.
     * Used by /api/kiosk endpoints to resolve tenant context & validate terminal key.
     */
    static async verifyPairingCode(pairingCode: string) {
        if (!pairingCode) return null

        try {
            const cleanCode = pairingCode.trim().toUpperCase()

            // Search all active tenant schemas for this pairing code
            const schemasRes = await centralDb.execute(sql`
                SELECT schema_name FROM information_schema.schemata WHERE schema_name LIKE 'tenant_%';
            `)

            for (const row of schemasRes) {
                const schemaName = (row as any).schema_name
                try {
                    const devices = await centralDb.execute(sql`
                        SELECT id, name, pairing_code, location_id, is_active
                        FROM ${sql.raw(schemaName)}.kiosk_devices
                        WHERE pairing_code = ${cleanCode} AND is_active = true
                        LIMIT 1;
                    `)

                    if (devices[0]) {
                        const device = devices[0] as any
                        const slug = schemaName.replace(/^tenant_/, '')

                        let locationName: string | null = null
                        let latitude: number | null = null
                        let longitude: number | null = null
                        let radiusMeters = 200

                        if (device.location_id) {
                            try {
                                const locs = await centralDb.execute(sql`
                                    SELECT name, latitude, longitude, radius_meters
                                    FROM public.office_locations
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

                        // Update last_seen_at timestamp
                        await centralDb.execute(sql`
                            UPDATE ${sql.raw(schemaName)}.kiosk_devices
                            SET last_seen_at = NOW()
                            WHERE id = ${device.id};
                        `).catch(() => {})

                        return {
                            device: {
                                id: device.id,
                                name: device.name,
                                pairingCode: device.pairing_code,
                                locationId: device.location_id,
                                locationName,
                                latitude,
                                longitude,
                                radiusMeters,
                            },
                            tenantSchema: schemaName,
                            tenantSlug: slug
                        }
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

}
