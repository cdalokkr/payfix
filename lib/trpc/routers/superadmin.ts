import { router, superAdminProcedure } from '../server';
import { masterDb } from '@/lib/db/master-connection';
import { centralDb } from '@/lib/db';
import { tenants, tenantPlans, tenantBranding } from '@/lib/db/master-schema';
import { eq, and, ne, sql } from 'drizzle-orm';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import {
  createSupabaseAdminClient,
  ensureSuperAdminAuthUser,
  SUPERADMIN_DEFAULT_ADMIN_PASSWORD,
} from '@/lib/auth/supabase-admin';

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

              // Fetch primary admin details by matching tenant's admin_email
              let adminRes = await centralDb.execute(sql`
                SELECT full_name, mobile_no, email 
                FROM ${sql.raw(tenant.tenant_schema)}.profiles 
                WHERE LOWER(email) = LOWER(${tenant.admin_email})
                LIMIT 1;
              `);
              if (!adminRes[0]) {
                adminRes = await centralDb.execute(sql`
                  SELECT full_name, mobile_no, email 
                  FROM ${sql.raw(tenant.tenant_schema)}.profiles 
                  WHERE role = 'admin' 
                  ORDER BY created_at ASC 
                  LIMIT 1;
                `);
              }
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
            biometricApiKey: tenant.biometric_api_key || null,
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
              secondaryColor: branding.secondary_color,
              shortName: branding.short_name,
              tagline: branding.tagline,
              accentColor: branding.accent_color,
              logoUrl: branding.logo_url,
              faviconUrl: branding.favicon_url,
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

  // 4. List all subscription plans with tenant subscription counts
  listPlans: superAdminProcedure.query(async () => {
    try {
      const plans = await masterDb.select().from(tenantPlans);
      const allTenants = await masterDb.select({ planId: tenants.plan_id }).from(tenants);
      
      const tenantCountMap = new Map<string, number>();
      for (const t of allTenants) {
        if (t.planId) {
          tenantCountMap.set(t.planId, (tenantCountMap.get(t.planId) || 0) + 1);
        }
      }

      return plans.map(p => ({
        id: p.id,
        name: p.name,
        displayName: p.display_name,
        priceMonthly: p.price_monthly,
        maxEmployees: p.max_employees,
        maxModerators: p.max_moderators,
        maxStorageGb: p.max_storage_gb,
        isActive: p.is_active,
        features: (p.features as Record<string, any>) || {},
        tenantCount: tenantCountMap.get(p.id) || 0,
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
      maxStorageGb: z.number().int().min(1).default(1),
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
            max_storage_gb: input.maxStorageGb,
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

  // 6. Update subscription plan limits & multi-currency pricing
  updatePlan: superAdminProcedure
    .input(z.object({
      id: z.string().uuid(),
      displayName: z.string().min(2),
      priceMonthly: z.string(),
      maxEmployees: z.number().int().min(1),
      maxModerators: z.number().int().min(1),
      maxStorageGb: z.number().int().min(1).optional(),
      features: z.record(z.string(), z.any()).optional(),
      isActive: z.boolean(),
    }))
    .mutation(async ({ input }) => {
      try {
        const updateData: any = {
          display_name: input.displayName,
          price_monthly: input.priceMonthly,
          max_employees: input.maxEmployees,
          max_moderators: input.maxModerators,
          is_active: input.isActive,
        };

        if (input.maxStorageGb !== undefined) {
          updateData.max_storage_gb = input.maxStorageGb;
        }

        if (input.features !== undefined) {
          updateData.features = input.features;
        }

        await masterDb
          .update(tenantPlans)
          .set(updateData)
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

  // 6b. Dedicated Tenant Subscription Renewal & Extension
  renewTenantSubscription: superAdminProcedure
    .input(z.object({
      tenantId: z.string().uuid(),
      planId: z.string().uuid().nullable().optional(),
      licenseExpiresAt: z.string().datetime(),
      maxEmployeesOverride: z.number().int().nullable().optional(),
      maxModeratorsOverride: z.number().int().nullable().optional(),
    }))
    .mutation(async ({ input }) => {
      try {
        const updatePayload: any = {
          license_expires_at: new Date(input.licenseExpiresAt),
          status: 'active', // Automatically ensures tenant is active upon renewal
          updated_at: new Date(),
        };

        if (input.planId !== undefined) {
          updatePayload.plan_id = input.planId;
        }
        if (input.maxEmployeesOverride !== undefined) {
          updatePayload.max_employees_override = input.maxEmployeesOverride;
        }
        if (input.maxModeratorsOverride !== undefined) {
          updatePayload.max_moderators_override = input.maxModeratorsOverride;
        }

        await masterDb
          .update(tenants)
          .set(updatePayload)
          .where(eq(tenants.id, input.tenantId));

        return { success: true };
      } catch (error) {
        console.error('[SUPERADMIN] renewTenantSubscription error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to renew tenant subscription',
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
          // Fetch primary admin profile ID matching tenant.admin_email first
          let adminRes = await centralDb.execute(sql`
            SELECT id, email FROM ${sql.raw(tenant.tenant_schema)}.profiles
            WHERE LOWER(email) = LOWER(${tenant.admin_email})
            LIMIT 1;
          `);

          if (!adminRes[0]) {
            adminRes = await centralDb.execute(sql`
              SELECT id, email FROM ${sql.raw(tenant.tenant_schema)}.profiles
              WHERE role = 'admin'
              ORDER BY created_at ASC
              LIMIT 1;
            `);
          }

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
              const supabaseAdmin = createSupabaseAdminClient();
              await supabaseAdmin.auth.admin.updateUserById(adminUserId, {
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

        // Resolve by the control-plane email first. This keeps password reset
        // working even when a legacy tenant profile was not created.
        const adminRes = await centralDb.execute(sql`
          SELECT id FROM ${sql.raw(tenant.tenant_schema)}.profiles
          WHERE LOWER(email) = LOWER(${tenant.admin_email})
          LIMIT 1;
        `);

        let adminUserId = adminRes[0]?.id as string | undefined;

        if (!adminUserId) {
          const roleAdminRes = await centralDb.execute(sql`
            SELECT id FROM ${sql.raw(tenant.tenant_schema)}.profiles
            WHERE role = 'admin'
            ORDER BY created_at ASC
            LIMIT 1;
          `);
          adminUserId = roleAdminRes[0]?.id as string | undefined;
        }

        if (!adminUserId) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Admin profile not found for tenant' });
        }

        const supabaseAdmin = createSupabaseAdminClient();
        const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(
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

  // 10. Provision a new tenant workspace with schema & default admin
  createTenant: superAdminProcedure
    .input(z.object({
      companyName: z.string().min(2),
      slug: z.string().min(2),
      adminName: z.string().min(2),
      adminEmail: z.string().email(),
      adminPhone: z.string().optional(),
      planId: z.string().uuid().optional().nullable(),
      licenseExpiresAt: z.string().optional().nullable(),
    }))
    .mutation(async ({ input }) => {
      let createdAuthUserId: string | undefined;
      try {
        const safeSlug = input.slug.toLowerCase().replace(/[^a-z0-9]/g, '');

        const existing = await masterDb.query.tenants.findFirst({
          where: eq(tenants.slug, safeSlug),
        });

        if (existing) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: `Workspace slug "${safeSlug}" is already in use.`,
          });
        }

        const supabaseAdmin = createSupabaseAdminClient();
        // Reusing the identity makes retries safe and keeps the profile ID
        // stable. The super-admin flow intentionally establishes the common
        // temporary password for that workspace administrator.
        const adminIdentity = await ensureSuperAdminAuthUser(supabaseAdmin, {
          email: input.adminEmail,
          fullName: input.adminName,
          phone: input.adminPhone,
        });
        const adminUser = adminIdentity.user;
        if (adminIdentity.created) createdAuthUserId = adminUser.id;

        const { provisionTenant } = await import('@/lib/tenant/provisioning');
        const nameParts = input.adminName.trim().split(/\s+/);
        const result = await provisionTenant(
          safeSlug,
          input.companyName,
          input.adminEmail,
          14,
          adminUser.id,
          {
            fullName: input.adminName.trim(),
            firstName: nameParts[0] || '',
            lastName: nameParts.slice(1).join(' '),
            phone: input.adminPhone || undefined,
          }
        );

        if (input.planId) {
          await masterDb
            .update(tenants)
            .set({
              plan_id: input.planId,
              license_expires_at: input.licenseExpiresAt ? new Date(input.licenseExpiresAt) : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
            })
            .where(eq(tenants.id, result.tenantId));
        }

        return {
          success: true,
          tenantId: result.tenantId,
          adminEmail: input.adminEmail,
          temporaryPassword: SUPERADMIN_DEFAULT_ADMIN_PASSWORD,
        };
      } catch (error) {
        if (createdAuthUserId) {
          try {
            const supabaseAdmin = createSupabaseAdminClient();
            await supabaseAdmin.auth.admin.deleteUser(createdAuthUserId);
          } catch (rollbackError) {
            console.error('[SUPERADMIN] Failed to roll back newly created auth user:', rollbackError);
          }
        }
        if (error instanceof TRPCError) throw error;
        console.error('[SUPERADMIN] createTenant error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to provision tenant workspace',
        });
      }
    }),

  // 11. Update tenant custom domain (or remove by passing null/empty string)
  updateTenantDomain: superAdminProcedure
    .input(z.object({
      tenantId: z.string().uuid(),
      customDomain: z.string().trim().toLowerCase().nullable().optional(),
    }))
    .mutation(async ({ input }) => {
      try {
        const rawDomain = input.customDomain?.trim() || null;
        const normalizedDomain = rawDomain ? rawDomain.replace(/^https?:\/\//, '').replace(/\/.*$/, '') : null;

        if (normalizedDomain) {
          // Check for conflicts across other tenants
          const existing = await masterDb.query.tenants.findFirst({
            where: and(
              eq(tenants.custom_domain, normalizedDomain),
              ne(tenants.id, input.tenantId)
            ),
          });
          if (existing) {
            throw new TRPCError({
              code: 'CONFLICT',
              message: `The domain "${normalizedDomain}" is already linked to workspace "${existing.company_name}".`,
            });
          }
        }

        await masterDb
          .update(tenants)
          .set({
            custom_domain: normalizedDomain,
            updated_at: new Date(),
          })
          .where(eq(tenants.id, input.tenantId));

        return { success: true, customDomain: normalizedDomain };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error('[SUPERADMIN] updateTenantDomain error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to update custom domain',
        });
      }
    }),

  // 12. Get tenant biometric hardware configuration and live registered devices
  getTenantBiometricConfig: superAdminProcedure
    .input(z.object({
      tenantId: z.string().uuid(),
    }))
    .query(async ({ input }) => {
      try {
        const tenant = await masterDb.query.tenants.findFirst({
          where: eq(tenants.id, input.tenantId),
        });

        if (!tenant) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Tenant not found' });
        }

        let devices: any[] = [];
        if (tenant.tenant_schema) {
          try {
            devices = await centralDb.execute(sql`
              SELECT id, name, serial_number, location, ip_address, device_type, status, last_sync_time
              FROM ${sql.raw(tenant.tenant_schema)}.biometric_devices
              ORDER BY updated_at DESC;
            `);
          } catch (err) {
            devices = [];
          }
        }

        return {
          tenantId: tenant.id,
          slug: tenant.slug,
          companyName: tenant.company_name,
          customDomain: tenant.custom_domain,
          biometricApiKey: tenant.biometric_api_key || null,
          devices: devices.map((d: any) => ({
            id: d.id,
            name: d.name,
            serialNumber: d.serial_number,
            location: d.location,
            ipAddress: d.ip_address,
            deviceType: d.device_type,
            status: d.status,
            lastSyncTime: d.last_sync_time ? new Date(d.last_sync_time).toISOString() : null,
          })),
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error('[SUPERADMIN] getTenantBiometricConfig error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch tenant biometric configuration',
        });
      }
    }),

  // 13. Regenerate or generate tenant biometric API key
  regenerateBiometricKey: superAdminProcedure
    .input(z.object({
      tenantId: z.string().uuid(),
    }))
    .mutation(async ({ input }) => {
      try {
        const crypto = await import('crypto');
        const tenant = await masterDb.query.tenants.findFirst({
          where: eq(tenants.id, input.tenantId),
        });

        if (!tenant) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Tenant not found' });
        }

        const cleanSlug = tenant.slug.replace(/[^a-z0-9]/g, '');
        const newKey = `bfx_live_${cleanSlug}_${crypto.randomBytes(12).toString('hex')}`;

        await masterDb
          .update(tenants)
          .set({
            biometric_api_key: newKey,
            updated_at: new Date(),
          })
          .where(eq(tenants.id, input.tenantId));

        return { success: true, biometricApiKey: newKey };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error('[SUPERADMIN] regenerateBiometricKey error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to regenerate biometric API key',
        });
      }
    }),

  // 14. Update White-Label branding (logos, theme colors, app names)
  updateTenantBranding: superAdminProcedure
    .input(z.object({
      tenantId: z.string().uuid(),
      appName: z.string().trim().min(2),
      shortName: z.string().trim().optional(),
      tagline: z.string().trim().optional(),
      primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Primary color must be a valid hex code (e.g. #4F46E5)"),
      secondaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Secondary color must be a valid hex code (e.g. #0F172A)"),
      accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Accent color must be a valid hex code").optional(),
      logoUrl: z.string().trim().nullable().optional(),
      faviconUrl: z.string().trim().nullable().optional(),
    }))
    .mutation(async ({ input }) => {
      try {
        const existing = await masterDb.query.tenantBranding.findFirst({
          where: eq(tenantBranding.tenant_id, input.tenantId),
        });

        const payload = {
          app_name: input.appName,
          short_name: input.shortName || input.appName.substring(0, 15),
          tagline: input.tagline || null,
          primary_color: input.primaryColor,
          secondary_color: input.secondaryColor,
          accent_color: input.accentColor || '#f59e0b',
          logo_url: input.logoUrl || null,
          favicon_url: input.faviconUrl || null,
          updated_at: new Date(),
        };

        if (existing) {
          await masterDb
            .update(tenantBranding)
            .set(payload)
            .where(eq(tenantBranding.tenant_id, input.tenantId));
        } else {
          await masterDb.insert(tenantBranding).values({
            tenant_id: input.tenantId,
            ...payload,
          });
        }

        return { success: true };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error('[SUPERADMIN] updateTenantBranding error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to update tenant branding',
        });
      }
    }),
});
