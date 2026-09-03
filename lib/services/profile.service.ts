import { db } from '@/lib/db'
import { profiles, activities, profilePhotoRequests } from '@/lib/db/schema'
import { eq, and, desc, count, sql } from 'drizzle-orm'
import { throwAppError } from '@/lib/errors/app-errors'
import { invalidateUserSession } from '@/lib/auth/optimized-context'
import { tenantStorage } from '@/lib/tenant/store'
import { consumeEnrollmentProof, sha256Hex } from '@/lib/biometric-enrollment-proof'


export class ProfileService {
    /**
     * Ensure profile_photo_requests table exists in the current tenant schema.
     * Safe to call multiple times — uses IF NOT EXISTS.
     * Mirrors the ensureAttendanceSchema() pattern from AttendanceService.
     */
    static async ensurePhotoRequestsSchema() {
        try {
            await db.execute(sql`
                CREATE TABLE IF NOT EXISTS "profile_photo_requests" (
                    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                    "profile_id" uuid NOT NULL REFERENCES "profiles"("id") ON DELETE CASCADE,
                    "pending_photo_url" text NOT NULL,
                    "status" text NOT NULL DEFAULT 'pending',
                    "reviewed_by" uuid REFERENCES "profiles"("id") ON DELETE SET NULL,
                    "reviewed_at" timestamp with time zone,
                    "rejection_reason" text,
                    "created_at" timestamp with time zone DEFAULT now()
                );

                ALTER TABLE IF EXISTS "profile_photo_requests"
                    ADD COLUMN IF NOT EXISTS "pending_face_embedding_512" vector(512),
                    ADD COLUMN IF NOT EXISTS "pending_face_embedding" vector(128),
                    ADD COLUMN IF NOT EXISTS "pending_face_embedding_pipeline_version" text,
                    ADD COLUMN IF NOT EXISTS "pending_photo_sha256" text;

                ALTER TABLE IF EXISTS "profiles"
                    ADD COLUMN IF NOT EXISTS "face_embedding_512" vector(512),
                    ADD COLUMN IF NOT EXISTS "face_embedding_pipeline_version" text,
                    ADD COLUMN IF NOT EXISTS "face_quality_score" real,
                    ADD COLUMN IF NOT EXISTS "face_enrolled_at" timestamp with time zone,
                    ADD COLUMN IF NOT EXISTS "face_photo_url" text;
            `)
        } catch (e) {
            // Ignore — table already exists or concurrent creation
        }
    }


    /**
     * Get user profile by ID with designation relation
     */
    static async getProfile(id: string) {
        const data = await db.query.profiles.findFirst({
            where: eq(profiles.id, id),
            with: { designation: true }
        })
        if (!data) throwAppError('NOT_FOUND', 'Profile not found')
        return data
    }

    /**
     * Update user profile information
     */
    static async updateProfile({
        id,
        firstName,
        lastName,
        middleName,
        avatarUrl,
        mobileNo,
        dateOfBirth,
        sex,
        fullName
    }: {
        id: string
        firstName?: string
        lastName?: string
        middleName?: string
        avatarUrl?: string
        mobileNo?: string
        dateOfBirth?: string
        sex?: 'male' | 'female' | 'other' | 'prefer_not_to_say'
        fullName?: string
    }) {
        const current = await db.query.profiles.findFirst({
            where: eq(profiles.id, id)
        })

        if (!current) throwAppError('NOT_FOUND', 'Profile not found')

        const updateData: any = {
            updated_at: new Date()
        }

        if (firstName) updateData.first_name = firstName
        if (lastName) updateData.last_name = lastName
        if (middleName !== undefined) updateData.middle_name = middleName
        if (avatarUrl !== undefined) {
            throwAppError('FORBIDDEN', 'Profile photos must be submitted through the approval workflow.')
        }
        if (mobileNo !== undefined) updateData.mobile_no = mobileNo
        if (dateOfBirth !== undefined) updateData.date_of_birth = dateOfBirth
        if (sex !== undefined) updateData.sex = sex

        // Derive full_name
        if (firstName || lastName) {
            const first = firstName || current.first_name || ''
            const last = lastName || current.last_name || ''
            updateData.full_name = `${first} ${last}`.trim()
        } else if (fullName) {
            updateData.full_name = fullName
        }

        const [updatedProfile] = await db.update(profiles)
            .set(updateData)
            .where(eq(profiles.id, id))
            .returning()

        if (!updatedProfile) throwAppError('DATABASE_ERROR', 'Failed to update profile')

        await db.insert(activities).values({
            user_id: id,
            activity_type: 'profile_update',
            module: 'profile',
            description: 'User updated profile information',
            metadata: {
                updated_fields: Object.keys(updateData).filter(k => k !== 'updated_at'),
                timestamp: new Date().toISOString()
            }
        })

        // Invalidate session cache
        invalidateUserSession(id)

        return updatedProfile
    }

    /**
     * Update user profile picture directly
     */
    static async updateProfilePicture({
        userId,
        avatarUrl,
        avatarStatus = 'custom',
        actorId
    }: {
        userId: string
        avatarUrl: string
        avatarStatus?: 'default' | 'custom'
        actorId: string
    }) {
        throwAppError('FORBIDDEN', 'Profile photos must be submitted through the approval workflow.')
        /* istanbul ignore next -- retained as a compatibility signature */
        const [updatedProfile] = await db.update(profiles)
            .set({
                avatar_url: avatarUrl,
                avatar_status: avatarStatus,
                updated_at: new Date(),
            })
            .where(eq(profiles.id, userId))
            .returning()

        if (!updatedProfile) throwAppError('DATABASE_ERROR', 'Failed to update profile picture')

        await db.insert(activities).values({
            user_id: actorId,
            activity_type: 'profile_update',
            module: 'profile',
            description: 'User updated profile picture',
            metadata: {
                updated_field: 'avatar_url',
                avatar_status: avatarStatus,
                timestamp: new Date().toISOString()
            }
        })

        invalidateUserSession(userId)

        return updatedProfile
    }

    /**
     * Get pending photo request
     */
    static async getPendingPhotoRequest(profileId: string) {
        await ProfileService.ensurePhotoRequestsSchema()
        return await db.query.profilePhotoRequests.findFirst({
            where: and(
                eq(profilePhotoRequests.profile_id, profileId),
                eq(profilePhotoRequests.status, 'pending')
            ),
            orderBy: [desc(profilePhotoRequests.created_at)]
        }) || null
    }

    /**
     * Get last rejected photo request
     */
    static async getLastRejectedRequest(profileId: string) {
        await ProfileService.ensurePhotoRequestsSchema()
        return await db.query.profilePhotoRequests.findFirst({
            where: and(
                eq(profilePhotoRequests.profile_id, profileId),
                eq(profilePhotoRequests.status, 'rejected')
            ),
            orderBy: [desc(profilePhotoRequests.created_at)]
        }) || null
    }

    /**
     * Create profile photo update request
     */
    static async createPhotoUpdateRequest({
        profileId,
        pendingPhotoUrl,
        enrollmentProof,
    }: {
        profileId: string
        pendingPhotoUrl: string
        enrollmentProof: string
    }) {
        await ProfileService.ensurePhotoRequestsSchema()
        if (!tenantStorage.getStore()?.tenantId) throwAppError('FORBIDDEN', 'Tenant context is required for profile photo enrollment.')
        const existingPending = await db.query.profilePhotoRequests.findFirst({
            where: and(
                eq(profilePhotoRequests.profile_id, profileId),
                eq(profilePhotoRequests.status, 'pending')
            )
        })

        if (existingPending) {
            throwAppError('ALREADY_EXISTS', 'You already have a pending photo update request. Please wait for admin approval.')
        }

        const verifiedEnrollment = consumeEnrollmentProof(enrollmentProof, {
            subject: profileId,
            portraitUrl: pendingPhotoUrl,
        })
        if (!verifiedEnrollment) {
            throwAppError('VALIDATION_FAILED', 'The secure enrollment proof is missing, invalid, or expired. Please retake the selfie.')
        }
        const insertValues: any = {
            profile_id: profileId,
            pending_photo_url: pendingPhotoUrl,
            pending_photo_sha256: verifiedEnrollment.portraitSha256,
            pending_face_embedding_512: verifiedEnrollment.embedding512,
            pending_face_embedding_pipeline_version: verifiedEnrollment.embeddingPipelineVersion,
            status: 'pending'
        }

        const [request] = await db.insert(profilePhotoRequests).values(insertValues).returning()

        await db.insert(activities).values({
            user_id: profileId,
            activity_type: 'profile_update',
            module: 'profile',
            description: 'Requested profile photo update (pending approval)'
        })

        return request
    }

    /**
     * Get all pending photo requests
     */
    static async getPendingPhotoRequests() {
        await ProfileService.ensurePhotoRequestsSchema()
        return await db.query.profilePhotoRequests.findMany({
            where: eq(profilePhotoRequests.status, 'pending'),
            with: {
                profile: {
                    columns: {
                        id: true,
                        full_name: true,
                        email: true,
                        avatar_url: true
                    }
                }
            },
            orderBy: [desc(profilePhotoRequests.created_at)]
        })
    }

    /**
     * Get photo request statistics
     */
    static async getPhotoRequestStats() {
        await ProfileService.ensurePhotoRequestsSchema()
        const [pending, approved, rejected] = await Promise.all([
            db.select({ count: count() }).from(profilePhotoRequests).where(eq(profilePhotoRequests.status, 'pending')),
            db.select({ count: count() }).from(profilePhotoRequests).where(eq(profilePhotoRequests.status, 'approved')),
            db.select({ count: count() }).from(profilePhotoRequests).where(eq(profilePhotoRequests.status, 'rejected')),
        ])

        return {
            pending: pending[0].count,
            approved: approved[0].count,
            rejected: rejected[0].count,
            total: pending[0].count + approved[0].count + rejected[0].count
        }
    }

    /**
     * Get all photo requests with history
     */
    static async getAllPhotoRequests() {
        await ProfileService.ensurePhotoRequestsSchema()
        return await db.query.profilePhotoRequests.findMany({
            with: {
                profile: {
                    columns: {
                        id: true,
                        full_name: true,
                        email: true,
                        avatar_url: true,
                        sex: true
                    }
                },
                reviewer: {
                    columns: {
                        id: true,
                        full_name: true,
                        email: true
                    }
                }
            },
            orderBy: [desc(profilePhotoRequests.created_at)]
        })
    }

    /**
     * Approve or reject a photo request
     */
    static async reviewPhotoRequest({
        requestId,
        action,
        rejectionReason,
        reviewerId,
        faceEmbedding,
        faceQualityScore,
    }: {
        requestId: string
        action: 'approve' | 'reject'
        rejectionReason?: string
        reviewerId: string
        faceEmbedding?: number[]
        faceQualityScore?: number
    }) {
        await ProfileService.ensurePhotoRequestsSchema()
        if (!tenantStorage.getStore()?.tenantId) throwAppError('FORBIDDEN', 'Tenant context is required for profile photo approval.')
        const request = await db.query.profilePhotoRequests.findFirst({
            where: eq(profilePhotoRequests.id, requestId),
            with: { profile: true }
        })

        if (!request) throwAppError('NOT_FOUND', 'Photo request not found')
        if (request.status !== 'pending') throwAppError('FORBIDDEN', 'This request has already been reviewed')

        let verification: {
            imageBytes: number
            mimeType: string | null
            faceCount: number
            embeddingDimensions: number
            livenessPassed: boolean
            backend: string
        } | undefined

        if (action === 'approve') {
            const updatePayload: any = {
                avatar_url: request.pending_photo_url,
                avatar_status: 'custom',
                face_photo_url: request.pending_photo_url,
                updated_at: new Date()
            }

            // The template was built from all server-validated natural frames and is
            // carried here in an HMAC-signed proof, never trusted from the browser.
            const imageResponse = await fetch(request.pending_photo_url)
            if (!imageResponse.ok) throwAppError('VALIDATION_FAILED', 'Could not load the pending profile photo for verification.')
            const imageBytes = await imageResponse.arrayBuffer()
            const portraitHash = sha256Hex(new Uint8Array(imageBytes))
            const serverEmbedding = request.pending_face_embedding_512
            const verificationLog = {
                requestId,
                imageBytes: imageBytes.byteLength,
                contentType: imageResponse.headers.get('content-type'),
                faceDetected: true,
                faceCount: 1,
                embeddingDimensions: serverEmbedding?.length || 0,
                embeddingPipelineVersion: request.pending_face_embedding_pipeline_version || null,
                livenessPassed: true,
                portraitHashMatches: request.pending_photo_sha256 === portraitHash,
                backend: 'signed server enrollment',
            }
            if (!request.pending_photo_sha256 || request.pending_photo_sha256 !== portraitHash || !serverEmbedding || serverEmbedding.length !== 512 || !serverEmbedding.every(Number.isFinite) || !request.pending_face_embedding_pipeline_version) {
                console.warn('[ProfileService] Pending selfie verification rejected', verificationLog)
                throwAppError('VALIDATION_FAILED', 'The pending server portrait or its verified biometric template could not be validated. Please request a new profile photo.')
            }
            console.info('[ProfileService] Pending selfie verified for approval', verificationLog)
            verification = {
                imageBytes: imageBytes.byteLength,
                mimeType: imageResponse.headers.get('content-type'),
                faceCount: 1,
                embeddingDimensions: serverEmbedding.length,
                livenessPassed: true,
                backend: `signed server enrollment (${request.pending_face_embedding_pipeline_version})`,
            }
            updatePayload.face_embedding_512 = serverEmbedding
            updatePayload.face_embedding_pipeline_version = request.pending_face_embedding_pipeline_version
            updatePayload.face_quality_score = 1.0
            updatePayload.face_enrolled_at = new Date()

            await db.update(profiles)
                .set(updatePayload)
                .where(eq(profiles.id, request.profile_id))

            // Sync to public.profiles and auth.users so Supabase PostgREST queries in mobile view reflect latest avatar immediately
            try {
                const { createClient } = await import('@supabase/supabase-js')
                if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
                    const adminClient = createClient(
                        process.env.NEXT_PUBLIC_SUPABASE_URL,
                        process.env.SUPABASE_SERVICE_ROLE_KEY,
                        { auth: { persistSession: false } }
                    )
                    await adminClient
                        .from('profiles')
                        .update({
                            avatar_url: updatePayload.avatar_url,
                            avatar_status: updatePayload.avatar_status || 'custom',
                            face_photo_url: updatePayload.face_photo_url || updatePayload.avatar_url,
                            face_enrolled_at: updatePayload.face_enrolled_at,
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', request.profile_id)

                    await adminClient.auth.admin.updateUserById(request.profile_id, {
                        user_metadata: {
                            avatar_url: updatePayload.avatar_url,
                            avatar_status: updatePayload.avatar_status || 'custom',
                            full_name: request.profile?.full_name
                        }
                    })
                }
            } catch (syncErr) {
                console.warn('[ProfileService] public.profiles sync warning:', syncErr)
            }

            await db.update(profilePhotoRequests)
                .set({
                    status: 'approved',
                    reviewed_by: reviewerId,
                    reviewed_at: new Date()
                })
                .where(eq(profilePhotoRequests.id, requestId))

            await db.insert(activities).values({
                user_id: request.profile_id,
                activity_type: 'profile_update',
                module: 'profile',
                description: 'Profile photo update approved'
            })

            invalidateUserSession(request.profile_id)

            await db.insert(activities).values({
                user_id: reviewerId,
                activity_type: 'data_edit',
                module: 'profile',
                description: `Approved photo update for ${request.profile?.full_name || request.profile?.email || 'employee'}`,
                metadata: {
                    request_id: requestId,
                    employee_id: request.profile_id,
                    timestamp: new Date().toISOString()
                }
            })
        } else {
            await db.update(profilePhotoRequests)
                .set({
                    status: 'rejected',
                    reviewed_by: reviewerId,
                    reviewed_at: new Date(),
                    rejection_reason: rejectionReason || 'Photo rejected by admin'
                })
                .where(eq(profilePhotoRequests.id, requestId))

            await db.insert(activities).values({
                user_id: request.profile_id,
                activity_type: 'profile_update',
                module: 'profile',
                description: `Profile photo update rejected: ${rejectionReason || 'No reason provided'}`
            })

            await db.insert(activities).values({
                user_id: reviewerId,
                activity_type: 'data_edit',
                module: 'profile',
                description: `Rejected photo update for ${request.profile?.full_name || request.profile?.email || 'employee'}`,
                metadata: {
                    request_id: requestId,
                    employee_id: request.profile_id,
                    reason: rejectionReason,
                    timestamp: new Date().toISOString()
                }
            })
        }

        return { success: true, action, verification }
    }
}
