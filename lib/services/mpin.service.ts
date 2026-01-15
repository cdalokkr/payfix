/**
 * MPIN Service
 * Handles 6-digit PIN authentication with biometric support
 */

import { db } from '@/lib/db'
import { userMpin } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

// Constants
const MPIN_LENGTH = 6
const MAX_FAILED_ATTEMPTS = 5
const LOCKOUT_DURATION_MS = 30 * 60 * 1000 // 30 minutes

// Simple hash function using Web Crypto API
async function hashMpin(mpin: string): Promise<string> {
    const encoder = new TextEncoder()
    const data = encoder.encode(mpin)
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

export interface MpinSetupResult {
    success: boolean
    error?: string
}

export interface MpinValidationResult {
    success: boolean
    error?: string
    attemptsRemaining?: number
    lockedUntil?: Date
}

export interface MpinStatus {
    hasSetup: boolean
    biometricEnabled: boolean
    isLocked: boolean
    lockedUntil?: Date
}

export const MpinService = {
    /**
     * Check if user has set up MPIN
     */
    async getStatus(profileId: string): Promise<MpinStatus> {
        const [record] = await db
            .select({
                biometricEnabled: userMpin.biometric_enabled,
                lockedUntil: userMpin.locked_until,
            })
            .from(userMpin)
            .where(eq(userMpin.profile_id, profileId))
            .limit(1)

        if (!record) {
            return {
                hasSetup: false,
                biometricEnabled: false,
                isLocked: false,
            }
        }

        const isLocked = record.lockedUntil ? new Date(record.lockedUntil) > new Date() : false

        return {
            hasSetup: true,
            biometricEnabled: record.biometricEnabled ?? false,
            isLocked,
            lockedUntil: isLocked ? new Date(record.lockedUntil!) : undefined,
        }
    },

    /**
     * Set up new MPIN for user
     */
    async setup(profileId: string, mpin: string): Promise<MpinSetupResult> {
        // Validate MPIN format
        if (!mpin || mpin.length !== MPIN_LENGTH || !/^\d+$/.test(mpin)) {
            return {
                success: false,
                error: `MPIN must be exactly ${MPIN_LENGTH} digits`,
            }
        }

        // Check if MPIN already exists
        const existing = await db
            .select({ profile_id: userMpin.profile_id })
            .from(userMpin)
            .where(eq(userMpin.profile_id, profileId))
            .limit(1)

        const mpinHash = await hashMpin(mpin)

        if (existing.length > 0) {
            // Update existing
            await db
                .update(userMpin)
                .set({
                    mpin_hash: mpinHash,
                    failed_attempts: 0,
                    locked_until: null,
                    updated_at: new Date(),
                })
                .where(eq(userMpin.profile_id, profileId))
        } else {
            // Insert new
            await db.insert(userMpin).values({
                profile_id: profileId,
                mpin_hash: mpinHash,
                biometric_enabled: false,
                failed_attempts: 0,
            })
        }

        return { success: true }
    },

    /**
     * Validate MPIN
     */
    async validate(profileId: string, mpin: string): Promise<MpinValidationResult> {
        const [record] = await db
            .select()
            .from(userMpin)
            .where(eq(userMpin.profile_id, profileId))
            .limit(1)

        if (!record) {
            return {
                success: false,
                error: 'MPIN not set up. Please set up your MPIN first.',
            }
        }

        // Check if locked
        if (record.locked_until && new Date(record.locked_until) > new Date()) {
            return {
                success: false,
                error: 'Account temporarily locked due to too many failed attempts.',
                lockedUntil: new Date(record.locked_until),
            }
        }

        // Validate MPIN
        const inputHash = await hashMpin(mpin)
        const isValid = inputHash === record.mpin_hash

        if (isValid) {
            // Reset failed attempts on success
            await db
                .update(userMpin)
                .set({
                    failed_attempts: 0,
                    locked_until: null,
                    updated_at: new Date(),
                })
                .where(eq(userMpin.profile_id, profileId))

            return { success: true }
        }

        // Handle failed attempt
        const newAttempts = (record.failed_attempts ?? 0) + 1
        const updateData: Partial<typeof userMpin.$inferInsert> = {
            failed_attempts: newAttempts,
            updated_at: new Date(),
        }

        // Lock account if max attempts reached
        if (newAttempts >= MAX_FAILED_ATTEMPTS) {
            updateData.locked_until = new Date(Date.now() + LOCKOUT_DURATION_MS)
        }

        await db
            .update(userMpin)
            .set(updateData)
            .where(eq(userMpin.profile_id, profileId))

        if (newAttempts >= MAX_FAILED_ATTEMPTS) {
            return {
                success: false,
                error: 'Account locked for 30 minutes due to too many failed attempts.',
                attemptsRemaining: 0,
                lockedUntil: updateData.locked_until as Date,
            }
        }

        return {
            success: false,
            error: 'Invalid MPIN',
            attemptsRemaining: MAX_FAILED_ATTEMPTS - newAttempts,
        }
    },

    /**
     * Enable/disable biometric authentication
     */
    async setBiometric(
        profileId: string,
        enabled: boolean,
        credentialId?: string
    ): Promise<MpinSetupResult> {
        const [record] = await db
            .select({ profile_id: userMpin.profile_id })
            .from(userMpin)
            .where(eq(userMpin.profile_id, profileId))
            .limit(1)

        if (!record) {
            return {
                success: false,
                error: 'MPIN not set up. Please set up your MPIN first.',
            }
        }

        await db
            .update(userMpin)
            .set({
                biometric_enabled: enabled,
                biometric_credential_id: enabled ? credentialId : null,
                updated_at: new Date(),
            })
            .where(eq(userMpin.profile_id, profileId))

        return { success: true }
    },

    /**
     * Reset MPIN (for forgot MPIN flow - requires email verification)
     */
    async reset(profileId: string, newMpin: string): Promise<MpinSetupResult> {
        // This should only be called after email verification
        return this.setup(profileId, newMpin)
    },

    /**
     * Validate biometric credential ID
     */
    async validateBiometric(profileId: string, credentialId: string): Promise<MpinValidationResult> {
        const [record] = await db
            .select({
                biometricEnabled: userMpin.biometric_enabled,
                credentialId: userMpin.biometric_credential_id,
                lockedUntil: userMpin.locked_until,
            })
            .from(userMpin)
            .where(eq(userMpin.profile_id, profileId))
            .limit(1)

        if (!record) {
            return {
                success: false,
                error: 'MPIN not set up.',
            }
        }

        // Check if locked
        if (record.lockedUntil && new Date(record.lockedUntil) > new Date()) {
            return {
                success: false,
                error: 'Account temporarily locked.',
                lockedUntil: new Date(record.lockedUntil),
            }
        }

        if (!record.biometricEnabled) {
            return {
                success: false,
                error: 'Biometric authentication not enabled.',
            }
        }

        if (record.credentialId !== credentialId) {
            return {
                success: false,
                error: 'Invalid biometric credential.',
            }
        }

        return { success: true }
    },
}
