import { db } from '@/lib/db'
import { departments, profiles, designations, activities, departmentManagersHistory } from '@/lib/db/schema'
import { eq, and, desc, count, sql } from 'drizzle-orm'
import { throwAppError } from '@/lib/errors/app-errors'
import { tenantStorage } from '@/lib/tenant/store'

export interface DepartmentInput {
    name: string
    code?: string | null
    description?: string | null
    managerId?: string | null
    locationId?: string | null
    promoteManagerRole?: boolean
}

const _departmentsSchemaEnsured = new Set<string>()

export class DepartmentService {
    static async ensureSchema() {
        const schemaKey = tenantStorage.getStore()?.tenantSchema || 'public'
        if (_departmentsSchemaEnsured.has(schemaKey)) return
        try {
            await db.execute(sql`
                CREATE TABLE IF NOT EXISTS "departments" (
                    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                    "name" text NOT NULL,
                    "code" varchar(20),
                    "description" text,
                    "manager_id" uuid REFERENCES "profiles"("id") ON DELETE SET NULL,
                    "location_id" uuid REFERENCES "office_locations"("id") ON DELETE CASCADE,
                    "is_active" boolean DEFAULT true,
                    "created_at" timestamp with time zone DEFAULT now(),
                    "updated_at" timestamp with time zone DEFAULT now()
                );

                CREATE TABLE IF NOT EXISTS "department_managers_history" (
                    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                    "department_id" uuid NOT NULL REFERENCES "departments"("id") ON DELETE CASCADE,
                    "manager_id" uuid NOT NULL REFERENCES "profiles"("id") ON DELETE CASCADE,
                    "appointed_by" uuid REFERENCES "profiles"("id") ON DELETE SET NULL,
                    "start_date" timestamp with time zone DEFAULT now(),
                    "end_date" timestamp with time zone,
                    "status" varchar(50) DEFAULT 'active',
                    "handover_notes" text,
                    "created_at" timestamp with time zone DEFAULT now()
                );

                CREATE INDEX IF NOT EXISTS "idx_dept_mgr_hist_dept" ON "department_managers_history" ("department_id");
                CREATE INDEX IF NOT EXISTS "idx_dept_mgr_hist_mgr" ON "department_managers_history" ("manager_id");

                ALTER TABLE IF EXISTS "designations"
                ADD COLUMN IF NOT EXISTS "department_id" uuid REFERENCES "departments"("id") ON DELETE SET NULL;

                ALTER TABLE IF EXISTS "profiles"
                ADD COLUMN IF NOT EXISTS "department_id" uuid REFERENCES "departments"("id") ON DELETE SET NULL;

                ALTER TABLE IF EXISTS "profiles"
                ALTER COLUMN "email" DROP NOT NULL;

                CREATE INDEX IF NOT EXISTS "idx_profiles_mobile_no" ON "profiles" ("mobile_no");
            `)
            _departmentsSchemaEnsured.add(schemaKey)
        } catch (e) {
            // Ignore schema error if already established
        }
    }

    static async getAll(locationId?: string | null) {
        await DepartmentService.ensureSchema()
        const whereClause = locationId ? eq(departments.location_id, locationId) : undefined

        const list = await db.query.departments.findMany({
            where: whereClause,
            with: {
                manager: {
                    columns: {
                        id: true,
                        full_name: true,
                        email: true,
                        avatar_url: true,
                        role: true,
                        mobile_no: true,
                    }
                },
                location: {
                    columns: {
                        id: true,
                        name: true,
                    }
                },
                designations: true,
            },
            orderBy: [desc(departments.created_at)]
        })

        // Also query count of active members per department
        const memberCounts = await db
            .select({
                department_id: profiles.department_id,
                count: count()
            })
            .from(profiles)
            .groupBy(profiles.department_id)

        const countMap = new Map<string, number>()
        memberCounts.forEach(c => {
            if (c.department_id) countMap.set(c.department_id, Number(c.count))
        })

        return list.map(dept => ({
            ...dept,
            member_count: countMap.get(dept.id) || 0,
            created_at: dept.created_at ? dept.created_at.toISOString() : null,
            updated_at: dept.updated_at ? dept.updated_at.toISOString() : null,
        }))
    }

    static async getById(id: string) {
        await DepartmentService.ensureSchema()
        const dept = await db.query.departments.findFirst({
            where: eq(departments.id, id),
            with: {
                manager: true,
                designations: true,
                location: true,
            }
        })
        if (!dept) throwAppError('NOT_FOUND', 'Department not found')
        return dept
    }

    static async create(data: DepartmentInput, actorId?: string) {
        await DepartmentService.ensureSchema()
        const [created] = await db.insert(departments).values({
            name: data.name,
            code: data.code || null,
            description: data.description || null,
            manager_id: data.managerId || null,
            location_id: data.locationId || null,
            is_active: true,
        }).returning()

        if (!created) throwAppError('DATABASE_ERROR', 'Failed to create department')

        // Track manager tenure in history
        if (data.managerId) {
            await db.insert(departmentManagersHistory).values({
                department_id: created.id,
                manager_id: data.managerId,
                appointed_by: actorId || null,
                start_date: new Date(),
                status: 'active',
                handover_notes: 'Initial department manager appointment',
            })

            // Optional role promotion
            if (data.promoteManagerRole) {
                await db.update(profiles).set({
                    role: 'moderator',
                    updated_at: new Date(),
                }).where(and(eq(profiles.id, data.managerId), eq(profiles.role, 'employee')))
            }
        }

        if (actorId) {
            await db.insert(activities).values({
                user_id: actorId,
                activity_type: 'data_create',
                module: 'departments',
                description: `Created department "${created.name}"`,
                metadata: { department_id: created.id, name: created.name, manager_id: data.managerId }
            })
        }

        return created
    }

    static async update(id: string, data: Partial<DepartmentInput> & { isActive?: boolean }, actorId?: string) {
        await DepartmentService.ensureSchema()

        // Fetch current department to detect manager transitions
        const currentDept = await db.query.departments.findFirst({
            where: eq(departments.id, id),
            columns: { manager_id: true, name: true }
        })

        const [updated] = await db.update(departments).set({
            name: data.name,
            code: data.code !== undefined ? data.code : undefined,
            description: data.description !== undefined ? data.description : undefined,
            manager_id: data.managerId !== undefined ? data.managerId : undefined,
            location_id: data.locationId !== undefined ? data.locationId : undefined,
            is_active: data.isActive !== undefined ? data.isActive : undefined,
            updated_at: new Date(),
        }).where(eq(departments.id, id)).returning()

        if (!updated) throwAppError('NOT_FOUND', 'Department not found for update')

        // Handle Manager Change Tracking
        if (data.managerId !== undefined && data.managerId !== currentDept?.manager_id) {
            // Relieve existing active manager
            if (currentDept?.manager_id) {
                await db.update(departmentManagersHistory).set({
                    end_date: new Date(),
                    status: 'relieved',
                }).where(and(
                    eq(departmentManagersHistory.department_id, id),
                    eq(departmentManagersHistory.manager_id, currentDept.manager_id),
                    eq(departmentManagersHistory.status, 'active')
                ))
            }

            // Start tenure for new manager
            if (data.managerId) {
                await db.insert(departmentManagersHistory).values({
                    department_id: id,
                    manager_id: data.managerId,
                    appointed_by: actorId || null,
                    start_date: new Date(),
                    status: 'active',
                    handover_notes: 'Manager reassignment',
                })

                if (data.promoteManagerRole) {
                    await db.update(profiles).set({
                        role: 'moderator',
                        updated_at: new Date(),
                    }).where(and(eq(profiles.id, data.managerId), eq(profiles.role, 'employee')))
                }
            }

            // Log manager transition audit
            if (actorId) {
                await db.insert(activities).values({
                    user_id: actorId,
                    activity_type: 'data_edit',
                    module: 'departments',
                    description: `Manager changed for department "${updated.name}"`,
                    metadata: {
                        department_id: id,
                        name: updated.name,
                        old_manager_id: currentDept?.manager_id,
                        new_manager_id: data.managerId,
                    }
                })
            }
        } else if (actorId) {
            await db.insert(activities).values({
                user_id: actorId,
                activity_type: 'data_edit',
                module: 'departments',
                description: `Updated department "${updated.name}"`,
                metadata: { department_id: updated.id, name: updated.name }
            })
        }

        return updated
    }

    static async delete(id: string, actorId?: string) {
        await DepartmentService.ensureSchema()
        const [deleted] = await db.delete(departments).where(eq(departments.id, id)).returning()
        if (!deleted) throwAppError('NOT_FOUND', 'Department not found to delete')

        if (actorId) {
            await db.insert(activities).values({
                user_id: actorId,
                activity_type: 'data_delete',
                module: 'departments',
                description: `Deleted department "${deleted.name}"`,
                metadata: { department_id: deleted.id, name: deleted.name }
            })
        }

        return deleted
    }

    static async getManagerHistory(departmentId: string) {
        await DepartmentService.ensureSchema()
        const history = await db.query.departmentManagersHistory.findMany({
            where: eq(departmentManagersHistory.department_id, departmentId),
            with: {
                manager: {
                    columns: {
                        id: true,
                        full_name: true,
                        email: true,
                        role: true,
                        avatar_url: true,
                        mobile_no: true,
                    }
                },
                appointedBy: {
                    columns: {
                        id: true,
                        full_name: true,
                        email: true,
                    }
                }
            },
            orderBy: [desc(departmentManagersHistory.start_date)]
        })

        return history.map(h => ({
            ...h,
            start_date: h.start_date ? h.start_date.toISOString() : null,
            end_date: h.end_date ? h.end_date.toISOString() : null,
            created_at: h.created_at ? h.created_at.toISOString() : null,
        }))
    }

    static async getDepartmentAuditLogs(departmentId: string, managerId?: string) {
        await DepartmentService.ensureSchema()
        const whereConditions = [
            sql`(${activities.module} IN ('departments', 'shifts', 'roster', 'attendance'))`,
            sql`(${activities.metadata}->>'department_id' = ${departmentId} OR ${activities.metadata}->>'departmentId' = ${departmentId})`
        ]

        if (managerId) {
            whereConditions.push(eq(activities.user_id, managerId))
        }

        const logs = await db.query.activities.findMany({
            where: and(...whereConditions),
            with: {
                profile: {
                    columns: {
                        id: true,
                        full_name: true,
                        email: true,
                        role: true,
                        avatar_url: true,
                    }
                }
            },
            orderBy: [desc(activities.created_at)],
            limit: 100,
        })

        return logs.map(l => ({
            ...l,
            created_at: l.created_at ? l.created_at.toISOString() : null,
        }))
    }

    static async getDepartmentMembers(departmentId: string) {
        await DepartmentService.ensureSchema()
        const members = await db.query.profiles.findMany({
            where: eq(profiles.department_id, departmentId),
            with: {
                designation: true,
            },
            orderBy: [desc(profiles.full_name)]
        })

        return members.map(m => ({
            ...m,
            created_at: m.created_at ? m.created_at.toISOString() : null,
            updated_at: m.updated_at ? m.updated_at.toISOString() : null,
        }))
    }
}
