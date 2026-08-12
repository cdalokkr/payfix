import { router, superAdminProcedure } from '../server';
import { masterDb } from '@/lib/db/master-connection';
import { centralDb } from '@/lib/db';
import { tenants, tenantPlans, tenantBranding } from '@/lib/db/master-schema';
import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';

export const superadminRouter = router({
  // 1. List all tenants with plans, branding and profile counts
  listTenants: superAdminProcedure.query(async () => {
    try {
      const allTenants = await masterDb
        .select()
        .from(tenants)
        .leftJoin(tenantPlans, eq(tenants.plan_id, tenantPlans.id))
        .leftJoin(tenantBranding, eq(tenants.id, tenantBranding.tenant_id));

      const tenantsWithCounts = await Promise.all(
        allTenants.map(async (row) => {
          const tenant = row.tenants;
          const plan = row.tenant_plans;
          const branding = row.tenant_branding;

          let employeeCount = 0;
          let moderatorCount = 0;
          let adminName = "Platform Admin";
          let adminPhone = "N/A";

          if (tenant.tenant_schema) {
            try {
              // Fetch employee count from tenant-specific profiles table
              const empRes = await centralDb.execute(sql`
                SELECT COUNT(*)::integer as count 
                FROM ${sql.raw(tenant.tenant_schema)}.profiles 
                WHERE role = 'employee';
              `);
              employeeCount = (empRes[0]?.count as number) || 0;

              // Fetch moderator count
              const modRes = await centralDb.execute(sql`
                SELECT COUNT(*)::integer as count 
                FROM ${sql.raw(tenant.tenant_schema)}.profiles 
                WHERE role = 'moderator';
              `);
              moderatorCount = (modRes[0]?.count as number) || 0;

              // Fetch admin details
              const adminRes = await centralDb.execute(sql`
                SELECT full_name, mobile_no 
                FROM ${sql.raw(tenant.tenant_schema)}.profiles 
                WHERE role = 'admin' 
                LIMIT 1;
              `);
              if (adminRes[0]) {
                adminName = (adminRes[0].full_name as string) || tenant.company_name + " Admin";
                adminPhone = (adminRes[0].mobile_no as string) || "N/A";
              }
            } catch (schemaErr) {
              // Table or schema does not exist yet (e.g. not provisioned)
              employeeCount = -1;
              moderatorCount = -1;
            }
          }

          return {
            id: tenant.id,
            slug: tenant.slug,
            companyName: tenant.company_name,
            customDomain: tenant.custom_domain,
            status: tenant.status,
            tenantSchema: tenant.tenant_schema,
            trialStart: tenant.trial_start.toISOString(),
            trialEnd: tenant.trial_end.toISOString(),
            trialDurationDays: tenant.trial_duration_days,
            trialExtended: tenant.trial_extended,
            adminEmail: tenant.admin_email,
            maxEmployeesOverride: tenant.max_employees_override,
            maxModeratorsOverride: tenant.max_moderators_override,
            licenseExpiresAt: tenant.license_expires_at.toISOString(),
            createdAt: tenant.created_at?.toISOString() || null,
            plan: plan ? {
              id: plan.id,
              name: plan.name,
              displayName: plan.display_name,
              maxEmployees: plan.max_employees,
              maxModerators: plan.max_moderators
            } : null,
            branding: branding ? {
              appName: branding.app_name,
              primaryColor: branding.primary_color,
              secondaryColor: branding.secondary_color
            } : null,
            employeeCount,
            moderatorCount,
            adminName,
            adminPhone
          };
        })
      );

      return tenantsWithCounts;
    } catch (error) {
      console.error('[SUPERADMIN] listTenants error:', error);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to retrieve tenants list',
      });
    }
  }),

  // 2. Update tenant status (active, suspended, trial, cancelled)
  updateTenantStatus: superAdminProcedure
    .input(z.object({
      tenantId: z.string().uuid(),
      status: z.enum(['trial', 'active', 'suspended', 'cancelled']),
    }))
    .mutation(async ({ input }) => {
      try {
        await masterDb
          .update(tenants)
          .set({ status: input.status, updated_at: new Date() })
          .where(eq(tenants.id, input.tenantId));

        return { success: true };
      } catch (error) {
        console.error('[SUPERADMIN] updateTenantStatus error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to update tenant status',
        });
      }
    }),

  // 3. Update tenant plan assignments, custom overrides and license expiry date
  updateTenantPlan: superAdminProcedure
    .input(z.object({
      tenantId: z.string().uuid(),
      planId: z.string().uuid().nullable(),
      maxEmployeesOverride: z.number().int().nullable(),
      maxModeratorsOverride: z.number().int().nullable(),
      licenseExpiresAt: z.string().datetime(),
    }))
    .mutation(async ({ input }) => {
      try {
        await masterDb
          .update(tenants)
          .set({
            plan_id: input.planId,
            max_employees_override: input.maxEmployeesOverride,
            max_moderators_override: input.maxModeratorsOverride,
            license_expires_at: new Date(input.licenseExpiresAt),
            updated_at: new Date(),
          })
          .where(eq(tenants.id, input.tenantId));

        return { success: true };
      } catch (error) {
        console.error('[SUPERADMIN] updateTenantPlan error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to update tenant plan details',
        });
      }
    }),

  // 4. List all subscription plans
  listPlans: superAdminProcedure.query(async () => {
    try {
      const plans = await masterDb.select().from(tenantPlans);
      return plans.map(p => ({
        id: p.id,
        name: p.name,
        displayName: p.display_name,
        priceMonthly: p.price_monthly,
        maxEmployees: p.max_employees,
        maxModerators: p.max_moderators,
        isActive: p.is_active,
        features: p.features
      }));
    } catch (error) {
      console.error('[SUPERADMIN] listPlans error:', error);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to retrieve plans',
      });
    }
  }),

  // 5. Create a new subscription plan dynamically
  createPlan: superAdminProcedure
    .input(z.object({
      name: z.string().min(2),
      displayName: z.string().min(2),
      priceMonthly: z.string(),
      maxEmployees: z.number().int().min(1),
      maxModerators: z.number().int().min(1),
      features: z.record(z.string(), z.any()).default({}),
    }))
    .mutation(async ({ input }) => {
      try {
        const newPlan = await masterDb
          .insert(tenantPlans)
          .values({
            name: input.name.toLowerCase().replace(/\s+/g, '-'),
            display_name: input.displayName,
            price_monthly: input.priceMonthly,
            max_employees: input.maxEmployees,
            max_moderators: input.maxModerators,
            features: input.features,
            is_active: true
          })
          .returning();

        return { success: true, plan: newPlan[0] };
      } catch (error) {
        console.error('[SUPERADMIN] createPlan error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create subscription plan',
        });
      }
    }),

  // 6. Update subscription plan limits
  updatePlan: superAdminProcedure
    .input(z.object({
      id: z.string().uuid(),
      displayName: z.string().min(2),
      priceMonthly: z.string(),
      maxEmployees: z.number().int().min(1),
      maxModerators: z.number().int().min(1),
      isActive: z.boolean(),
    }))
    .mutation(async ({ input }) => {
      try {
        await masterDb
          .update(tenantPlans)
          .set({
            display_name: input.displayName,
            price_monthly: input.priceMonthly,
            max_employees: input.maxEmployees,
            max_moderators: input.maxModerators,
            is_active: input.isActive,
          })
          .where(eq(tenantPlans.id, input.id));

        return { success: true };
      } catch (error) {
        console.error('[SUPERADMIN] updatePlan error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to update subscription plan',
        });
      }
    }),

  // 7. Delete a tenant and all associated data (schema, users, branding)
  deleteTenant: superAdminProcedure
    .input(z.object({
      tenantId: z.string().uuid(),
      confirmSlug: z.string().min(1), // User must type the tenant slug to confirm
    }))
    .mutation(async ({ input }) => {
      try {
        // Look up tenant to validate
        const tenant = await masterDb.query.tenants.findFirst({
          where: eq(tenants.id, input.tenantId),
        });

        if (!tenant) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Tenant not found',
          });
        }

        // Safety: Prevent deleting the primary platform tenant
        if (tenant.slug === 'primary') {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Cannot delete the primary platform tenant',
          });
        }

        // Safety: Confirmation slug must match
        if (input.confirmSlug !== tenant.slug) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `Confirmation slug "${input.confirmSlug}" does not match tenant slug "${tenant.slug}"`,
          });
        }

        // Safety: Only allow deletion of suspended or cancelled tenants
        if (!['suspended', 'cancelled'].includes(tenant.status)) {
          throw new TRPCError({
            code: 'PRECONDITION_FAILED',
            message: `Tenant must be suspended or cancelled before deletion. Current status: ${tenant.status}`,
          });
        }

        if (!tenant.tenant_schema) {
          throw new TRPCError({
            code: 'PRECONDITION_FAILED',
            message: 'Tenant has no schema assigned — cannot deprovision',
          });
        }

        // Execute full deprovision
        const { deprovisionTenant } = await import('@/lib/tenant/provisioning');
        const result = await deprovisionTenant(
          tenant.id,
          tenant.tenant_schema,
          tenant.slug
        );

        if (result.errors.length > 0) {
          console.warn(`[SUPERADMIN] Tenant ${tenant.slug} deleted with ${result.errors.length} warnings:`, result.errors);
        }

        return {
          success: true,
          deletedUsers: result.deletedUsers,
          warnings: result.errors,
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error('[SUPERADMIN] deleteTenant error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to delete tenant',
        });
      }
    }),

  // 8. Update tenant admin contact information
  updateAdminInfo: superAdminProcedure
    .input(z.object({
      tenantId: z.string().uuid(),
      adminName: z.string().trim().min(2),
      adminEmail: z.string().trim().email(),
      adminPhone: z.string().trim().min(10),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        const tenant = await masterDb.query.tenants.findFirst({
          where: eq(tenants.id, input.tenantId),
        });

        if (!tenant) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Tenant not found' });
        }

        // Update admin email in master tenant record
        await masterDb
          .update(tenants)
          .set({
            admin_email: input.adminEmail,
            updated_at: new Date(),
          })
          .where(eq(tenants.id, input.tenantId));

        if (tenant.tenant_schema) {
          // Fetch existing admin profile ID
          const adminRes = await centralDb.execute(sql`
            SELECT id, email FROM ${sql.raw(tenant.tenant_schema)}.profiles
            WHERE role = 'admin'
            LIMIT 1;
          `);

          const adminUser = adminRes[0];

          if (adminUser) {
            const adminUserId = adminUser.id as string;
            const currentEmail = adminUser.email as string;

            // If email changed, check for conflict in tenant profiles
            if (currentEmail !== input.adminEmail) {
              const conflictCheck = await centralDb.execute(sql`
                SELECT id FROM ${sql.raw(tenant.tenant_schema)}.profiles
                WHERE email = ${input.adminEmail} AND id != ${adminUserId}
                LIMIT 1;
              `);

              if (conflictCheck[0]) {
                throw new TRPCError({
                  code: 'CONFLICT',
                  message: `The email "${input.adminEmail}" is already assigned to another profile in this tenant.`,
                });
              }
            }

            // Update profile
            await centralDb.execute(sql`
              UPDATE ${sql.raw(tenant.tenant_schema)}.profiles
              SET full_name = ${input.adminName},
                  email = ${input.adminEmail},
                  mobile_no = ${input.adminPhone},
                  updated_at = NOW()
              WHERE id = ${adminUserId};
            `);

            // Also update Supabase Auth user email/metadata if available
            try {
              await ctx.supabase.auth.admin.updateUserById(adminUserId, {
                email: input.adminEmail,
                user_metadata: { full_name: input.adminName },
              });
            } catch (authErr) {
              console.warn('[SUPERADMIN] Non-fatal auth email update notice:', authErr);
            }
          }
        }

        return { success: true };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        const rawMsg = error instanceof Error ? error.message : 'Failed to update admin information';
        console.error('[SUPERADMIN] updateAdminInfo error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: rawMsg.includes('duplicate key') || rawMsg.includes('23505')
            ? `The email "${input.adminEmail}" is already registered in this tenant schema.`
            : rawMsg,
        });
      }
    }),

  // 9. Reset admin user password
  resetAdminPassword: superAdminProcedure
    .input(z.object({
      tenantId: z.string().uuid(),
      newPassword: z.string().min(6),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        const tenant = await masterDb.query.tenants.findFirst({
          where: eq(tenants.id, input.tenantId),
        });

        if (!tenant || !tenant.tenant_schema) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Tenant schema not found' });
        }

        // Fetch admin user ID from tenant schema profiles table
        const adminRes = await centralDb.execute(sql`
          SELECT id FROM ${sql.raw(tenant.tenant_schema)}.profiles
          WHERE role = 'admin'
          LIMIT 1;
        `);

        const adminUserId = adminRes[0]?.id as string | undefined;

        if (!adminUserId) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Admin profile not found for tenant' });
        }

        const { error: authError } = await ctx.supabase.auth.admin.updateUserById(
          adminUserId,
          { password: input.newPassword }
        );

        if (authError) {
          console.error('[SUPERADMIN] resetAdminPassword auth error:', authError);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: authError.message || 'Failed to update auth password',
          });
        }

        return { success: true };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error('[SUPERADMIN] resetAdminPassword error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to reset admin password',
        });
      }
    }),
});
