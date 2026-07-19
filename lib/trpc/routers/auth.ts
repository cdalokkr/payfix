// ============================================
// lib/trpc/routers/auth.ts
// Enhanced Login Validation with Specific Error Types
// ============================================

import { router, publicProcedure, protectedProcedure, authenticatedProcedure } from '../server'
import { loginSchema, changePasswordSchema } from '@/lib/validations/auth'
import { TRPCError } from '@trpc/server'
import { z } from 'zod'
import { profiles, activities, designations, attendance } from '@/lib/db/schema'
import { eq, and, desc, count } from 'drizzle-orm'
import { performLogout, preSeedSessionCache } from '@/lib/auth/optimized-context'
import { formatActivityDescription } from '@/lib/utils/activity-logger'
import { queryManager } from '@/lib/db/optimized-query-manager'
import { createClient } from '@supabase/supabase-js'

// Custom error types for specific validation scenarios
const AuthErrorTypes = {
  EMAIL_NOT_FOUND: 'EMAIL_NOT_FOUND',
  INCORRECT_PASSWORD: 'INCORRECT_PASSWORD',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  NETWORK_ERROR: 'NETWORK_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
} as const

export const authRouter = router({

  // Helper: walk the full error cause chain and collect all messages into one string
  // This handles cases like Drizzle wrapping Postgres errors in nested .cause properties
  login: publicProcedure
    .input(loginSchema)
    .mutation(async ({ input, ctx }) => {
      if (!ctx.supabase) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Authentication service unavailable',
        })
      }

      const { centralDb: loginCentralDb } = await import('@/lib/db');

      try {
        // 0. PRE-AUTH OPTIMIZATION: Check if user is deactivated before expensive auth call
        // Query centralDb (public.profiles) so we don't trigger tenant_primary pool warmup.
        const preCheck = await loginCentralDb.query.profiles.findFirst({
          where: eq(profiles.email, input.email),
          columns: { status: true, id: true }
        })

        if (preCheck?.status === 'deactive' || preCheck?.status === 'deleted') {
          const isDeleted = preCheck?.status === 'deleted'
          console.warn(`[Auth] Fast-rejected login attempt for ${preCheck?.status} email:`, input.email)

          // Clear any residual session cache for this user if we found their ID
          if (preCheck.id) {
            await performLogout(preCheck.id)
          }

          throw new TRPCError({
            code: 'FORBIDDEN',
            message: isDeleted
              ? 'Your account is deleted. Please contact administrator.'
              : 'Your account has been deactivated. Please contact administrator.',
          })
        }
      } catch (err) {
        if (err instanceof TRPCError) throw err
        // Walk full error cause chain to find database-specific messages
        const fullChain = (() => {
          const msgs: string[] = []
          let current: any = err
          while (current) {
            if (current.message) msgs.push(current.message.toLowerCase())
            current = current.cause
          }
          return msgs.join(' | ')
        })()
        // Detect database-level failures that indicate the project is paused or unavailable
        if (
          fullChain.includes('tenant or user not found') ||
          fullChain.includes('project is paused') ||
          fullChain.includes('connection terminated') ||
          fullChain.includes('too many connections') ||
          fullChain.includes('xx000')
        ) {
          console.error('[Auth] Database unavailable (project likely paused):', fullChain)
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Database service is currently unavailable. The Supabase project might be paused or disconnected. Please check the Supabase dashboard.',
            cause: { type: AuthErrorTypes.SERVICE_UNAVAILABLE, field: 'none' }
          })
        }
        console.error('[Auth] Pre-check failed, falling back to standard auth:', err)
      }

      try {
        const { data, error } = await ctx.supabase.auth.signInWithPassword({
          email: input.email,
          password: input.password,
        })

        console.log('[Auth] Login attempt:', {
          email: input.email.replace(/(.{2})(.*)(@.*)/, '$1***$3'), // Mask email
          success: !error && !!data.user,
          userId: data.user?.id,
          error: error?.message
        })

        // Warmup will be triggered for the correct resolved tenant pool later in Step 4.

        if (error) {
          // Parse Supabase error to provide specific error types
          const errorMessage = error.message?.toLowerCase() || ''
          const status = (error as any).status

          // Check for network/fetch failures — but inspect cause to distinguish
          // project-paused (supabase DNS gone) vs user's actual network being down
          if (
            errorMessage.includes('fetch failed') ||
            errorMessage.includes('failed to fetch') ||
            errorMessage.includes('network request failed') ||
            errorMessage.includes('enotfound') ||
            errorMessage.includes('econnrefused')
          ) {
            // Inspect the cause chain for supabase-specific hostnames
            const causeMsg = (error as any)?.cause?.message?.toLowerCase() || ''
            const isSupabaseHost = causeMsg.includes('supabase.co') || causeMsg.includes('supabase.in')

            if (isSupabaseHost) {
              throw new TRPCError({
                code: 'INTERNAL_SERVER_ERROR',
                message: 'Database service is currently unavailable. The Supabase project might be paused or disconnected. Please check the Supabase dashboard.',
                cause: { type: AuthErrorTypes.SERVICE_UNAVAILABLE, field: 'none' }
              })
            }

            throw new TRPCError({
              code: 'INTERNAL_SERVER_ERROR',
              message: 'Unable to connect to the server. Please check your internet connection.',
              cause: { type: AuthErrorTypes.NETWORK_ERROR, field: 'none' }
            })
          }

          // Check for service unavailability (5xx errors or database-specific messages)
          if (
            status >= 500 ||
            errorMessage.includes('service unavailable') ||
            errorMessage.includes('database') ||
            errorMessage.includes('timeout') ||
            errorMessage.includes('project is paused') ||
            errorMessage.includes('connection terminated') ||
            errorMessage.includes('too many connections')
          ) {
            throw new TRPCError({
              code: 'INTERNAL_SERVER_ERROR',
              message: 'Database service is currently unavailable. The project might be paused or disconnected.',
              cause: { type: AuthErrorTypes.SERVICE_UNAVAILABLE, field: 'none' }
            })
          }

          if (errorMessage.includes('invalid login credentials') ||
            errorMessage.includes('invalid credentials') ||
            errorMessage.includes('email not confirmed')) {
            throw new TRPCError({
              code: 'UNAUTHORIZED',
              message: 'Invalid email or password',
              cause: { type: AuthErrorTypes.INVALID_CREDENTIALS, field: 'both' }
            })
          }

          if (errorMessage.includes('email not found') ||
            errorMessage.includes('user not found') ||
            errorMessage.includes('signup_disabled')) {
            throw new TRPCError({
              code: 'NOT_FOUND',
              message: 'Invalid email or password',  // Same message for all auth failures
              cause: { type: AuthErrorTypes.EMAIL_NOT_FOUND, field: 'email' }
            })
          }

          if (errorMessage.includes('invalid password') ||
            errorMessage.includes('wrong password') ||
            errorMessage.includes('password is incorrect')) {
            throw new TRPCError({
              code: 'UNAUTHORIZED',
              message: 'Invalid email or password',  // Same message for all auth failures
              cause: { type: AuthErrorTypes.INCORRECT_PASSWORD, field: 'password' }
            })
          }

          // Generic unauthorized error
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: 'Invalid email or password',  // Same message for all auth failures
            cause: { type: AuthErrorTypes.INVALID_CREDENTIALS, field: 'both' }
          })
        }

        // 1. FAST CHECK: Check user status from metadata first (Optimization)
        // This allows for "near-instant" rejection of deactivated users without high database load
        const metadataStatus = (data.user?.user_metadata as any)?.status
        if (metadataStatus === 'deactive' || metadataStatus === 'deleted') {
          const isDeleted = metadataStatus === 'deleted'
          console.warn(`[Auth] Blocked login via metadata for ${metadataStatus} user:`, data.user.id)

          // CRITICAL: Sign out and clear session even though Supabase auth succeeded
          await ctx.supabase.auth.signOut()
          await performLogout(data.user.id)

          throw new TRPCError({
            code: 'FORBIDDEN',
            message: isDeleted
              ? 'Your account is deleted. Please contact administrator.'
              : 'Your account has been deactivated. Please contact administrator.',
          })
        }

        // ============================================================
        // PROFILE RESOLUTION — Sequential with Super Admin Fast-Path
        // ============================================================
        // Profile is ALWAYS fetched from centralDb (public schema) first.
        // Super-admin users only exist in public.profiles.
        // For standard users, we then resolve tenant context and fetch lastLogout
        // from the CORRECT tenant schema (not the default ctx.db which routes to primary).
        const { centralDb: loginCentralDb } = await import('@/lib/db');
        const { sql: sqlTag } = await import('drizzle-orm');

        // Step 1: Fetch profile from centralDb (public.profiles)
        let profileData = await loginCentralDb.query.profiles.findFirst({
          where: eq(profiles.id, data.user.id),
          with: { designation: true }
        });

        let lastLogout: Date | string | null = null;

        // Step 2: Super Admin Fast-Path — skip ALL tenant queries
        if (profileData && profileData.role === 'super_admin') {
          console.log(`[Auth] ⚡ Super Admin fast-path: ${data.user.id}`);
          // No lastLogout needed, no tenant fallback, no cross-schema scan
          // Jump straight to status check → cache seed → return
        } else {
          // Step 3: Standard user flow — resolve profile from tenant schemas if not in centralDb
          if (!profileData) {
            console.warn('[Auth] Profile not found in centralDb for user:', data.user.id,
              '| Tenant context:', ctx.tenant ? `${ctx.tenant.slug} (${ctx.tenant.tenantSchema})` : 'NONE')

            // Tenant-schema fallback: If tenant context exists, directly query the tenant schema
            if (ctx.tenant?.tenantSchema) {
              try {
                const schemaName = ctx.tenant.tenantSchema;
                const fallbackResult = await loginCentralDb.execute(sqlTag`
                  SELECT p.*, row_to_json(d.*) as designation
                  FROM ${sqlTag.raw(schemaName)}.profiles p
                  LEFT JOIN ${sqlTag.raw(schemaName)}.designations d ON d.id = p.designation_id
                  WHERE p.id = ${data.user.id}
                  LIMIT 1;
                `);

                if (fallbackResult[0]) {
                  console.log('[Auth] Profile found via tenant-schema fallback:', ctx.tenant.tenantSchema);
                  const fbProfile = fallbackResult[0] as any;
                  if (typeof fbProfile.designation === 'string') {
                    try { fbProfile.designation = JSON.parse(fbProfile.designation); } catch {}
                  }
                  profileData = fbProfile;
                }
              } catch (fallbackErr) {
                console.error('[Auth] Tenant-schema fallback query failed:', fallbackErr);
              }
            }

            // Schema-scan fallback: Look for the user's profile across all tenant schemas via DB function
            if (!profileData) {
              try {
                const scanResult = await loginCentralDb.execute(sqlTag`
                  SELECT public.find_profile_across_schemas(${data.user.id}::uuid) as profile;
                `);

                const profileJson = scanResult[0]?.profile;
                if (profileJson) {
                  console.log(`[Auth] Profile discovered across schemas via DB function: ${profileJson.tenant_schema}`);
                  const fbProfile = profileJson as any;
                  if (typeof fbProfile.designation === 'string') {
                    try { fbProfile.designation = JSON.parse(fbProfile.designation); } catch {}
                  }
                  profileData = fbProfile;
                  (data as any).discoveredTenantSlug = fbProfile.tenant_slug;
                }
              } catch (scanErr) {
                console.error('[Auth] Fast schema scan failed:', scanErr);
              }
            }

            // If still no profile after all fallbacks, check for pending_setup tenant
            if (!profileData) {
              console.warn('[Auth] Profile definitively not found for user:', data.user.id)

              // Check if this user has a pending_setup tenant (new signup, first login)
              try {
                const { masterDb: mDb } = await import('@/lib/db/master-connection');
                const { tenants: tenantsTable } = await import('@/lib/db/master-schema');

                const userTenant = await mDb.query.tenants.findFirst({
                  where: eq(tenantsTable.admin_email, data.user.email!),
                });

                if (userTenant) {
                  // If already provisioned (trial/active), fetch profile from tenant schema
                  if (userTenant.status !== 'pending_setup') {
                    try {
                      const schemaName = userTenant.tenant_schema;
                      const profileRows = await loginCentralDb.execute(sqlTag`
                        SELECT p.*, row_to_json(d.*) as designation
                        FROM ${sqlTag.raw(schemaName)}.profiles p
                        LEFT JOIN ${sqlTag.raw(schemaName)}.designations d ON d.id = p.designation_id
                        WHERE p.id = ${data.user.id} LIMIT 1;
                      `);
                      if (profileRows[0]) {
                        const bgProfile = profileRows[0] as any;
                        if (typeof bgProfile.designation === 'string') {
                          try { bgProfile.designation = JSON.parse(bgProfile.designation); } catch {}
                        }
                        console.log(`[Auth] Profile found in already-provisioned tenant: ${userTenant.slug}`);
                        profileData = bgProfile;
                        (data as any).discoveredTenantSlug = userTenant.slug;
                      }
                    } catch (fetchErr) {
                      console.error('[Auth] Error fetching profile from provisioned tenant:', fetchErr);
                    }
                  }

                  // If still pending_setup, wait briefly for background provisioning to finish
                  if (!profileData && userTenant.status === 'pending_setup') {
                    console.log(`[Auth] Tenant ${userTenant.slug} is pending_setup — waiting for background provisioning...`);
                    for (let attempt = 0; attempt < 3; attempt++) {
                      await new Promise(resolve => setTimeout(resolve, 1000));
                      const refreshed = await mDb.query.tenants.findFirst({
                        where: eq(tenantsTable.id, userTenant.id),
                      });
                      if (refreshed && refreshed.status !== 'pending_setup') {
                        try {
                          const schemaName = refreshed.tenant_schema;
                          const profileRows = await loginCentralDb.execute(sqlTag`
                            SELECT p.*, row_to_json(d.*) as designation
                            FROM ${sqlTag.raw(schemaName)}.profiles p
                            LEFT JOIN ${sqlTag.raw(schemaName)}.designations d ON d.id = p.designation_id
                            WHERE p.id = ${data.user.id} LIMIT 1;
                          `);
                          if (profileRows[0]) {
                            const bgProfile = profileRows[0] as any;
                            if (typeof bgProfile.designation === 'string') {
                              try { bgProfile.designation = JSON.parse(bgProfile.designation); } catch {}
                            }
                            console.log(`[Auth] Background provisioning completed for ${userTenant.slug}. Profile found after ${attempt + 1}s wait.`);
                            profileData = bgProfile;
                            (data as any).discoveredTenantSlug = userTenant.slug;
                          }
                        } catch (fetchErr) {
                          console.error('[Auth] Error fetching profile after background provisioning:', fetchErr);
                        }
                        break;
                      }
                    }
                  }

                  // If STILL no profile after polling, fall back to /setup
                  if (!profileData) {
                    console.log(`[Auth] User ${data.user.id} has pending_setup tenant: ${userTenant.slug} — falling back to /setup`);
                    return {
                      success: true,
                      profile: null as any,
                      user: {
                        id: data.user.id,
                        email: data.user.email
                      },
                      redirectTo: '/setup',
                      tenantSlug: userTenant.slug,
                    }
                  }
                }
              } catch (lookupErr) {
                console.error('[Auth] Error checking pending_setup tenant:', lookupErr);
              }

              // Only return 'not found' if profileData wasn't discovered during polling above
              if (!profileData) {
                return {
                  success: true,
                  profile: null as any,
                  user: {
                    id: data.user.id,
                    email: data.user.email
                  },
                  warning: 'Profile not found. Please contact administrator.'
                }
              }
            }
          }

          // Step 4: Fetch lastLogout from the CORRECT tenant schema (not default ctx.db)
          if (profileData) {
            const userTenantSlug = (data as any).discoveredTenantSlug || ctx.tenant?.slug;
            if (userTenantSlug && userTenantSlug !== 'primary') {
              try {
                const tenantSchema = ctx.tenant?.tenantSchema || `tenant_${userTenantSlug}`;
                const logoutRows = await loginCentralDb.execute(sqlTag`
                  SELECT created_at FROM ${sqlTag.raw(tenantSchema)}.activities
                  WHERE user_id = ${data.user.id} AND activity_type = 'logout'
                  ORDER BY created_at DESC LIMIT 1;
                `);
                lastLogout = logoutRows[0]?.created_at || null;
              } catch {
                // lastLogout is non-critical, ignore errors
              }

              // WARMUP OPTIMIZATION: Warm up the CORRECT tenant connection pool in the background.
              // This avoids warming up primary for tenant users.
              (async () => {
                try {
                  const { getTenantDb } = await import('@/lib/db/tenant-connection');
                  const { tenants: tenantsTable } = await import('@/lib/db/master-schema');
                  
                  // Lookup database URL and ID to construct correct connection
                  const tenantRecord = await loginCentralDb.query.tenants.findFirst({
                    where: (t, { eq }) => eq(t.slug, userTenantSlug)
                  });

                  if (tenantRecord) {
                    const tenantDbInstance = getTenantDb(tenantRecord.id, tenantRecord.database_url, tenantRecord.tenant_schema);
                    const tStart = performance.now();
                    await tenantDbInstance.execute(sqlTag`SELECT 1`);
                    if (process.env.NODE_ENV === 'development') {
                      console.log(`[DB-PERF] Connection pool warmed up for tenant ${userTenantSlug}: ${(performance.now() - tStart).toFixed(2)}ms`);
                    }
                  }
                } catch (warmupErr) {
                  console.warn(`[DB-PERF] Connection warmup failed for tenant ${userTenantSlug} (non-critical):`, warmupErr);
                }
              })();
            }
          }
        }

        // Check user status
        if (profileData.status === 'deactive' || profileData.status === 'deleted') {
          const isDeleted = profileData.status === 'deleted'
          console.warn(`[Auth] Blocked login and clearing session for ${profileData.status} user:`, data.user.id)

          // CRITICAL: Sign out and clear session even though Supabase auth succeeded
          await ctx.supabase.auth.signOut()
          await performLogout(data.user.id)

          throw new TRPCError({
            code: 'FORBIDDEN',
            message: isDeleted
              ? 'Your account is deleted. Please contact administrator.'
              : 'Your account has been deactivated. Please contact administrator.',
          })
        }

        // Log successful login activity — FIRE AND FORGET
        // Route to the CORRECT tenant schema instead of default ctx.db
        const logActivity = async () => {
          try {
            const userTenantSlug = (data as any).discoveredTenantSlug || ctx.tenant?.slug;
            const activitySchema = (userTenantSlug && userTenantSlug !== 'primary')
              ? (ctx.tenant?.tenantSchema || `tenant_${userTenantSlug}`)
              : 'public';
            const description = formatActivityDescription({
              action: 'login',
              actorRole: profileData?.role || 'employee',
              actorEmail: data.user.email || '',
              module: 'auth'
            });
            await loginCentralDb.execute(sqlTag`
              INSERT INTO ${sqlTag.raw(activitySchema)}.activities (user_id, activity_type, module, description)
              VALUES (${profileData.id}, 'login', 'auth', ${description});
            `);
          } catch (err) {
            console.error('[AUTH-LOGIN] Background activity logging failed:', err)
          }
        }

        // Execute logging for active user in background
        logActivity()

        // Ensure role is present
        if (!profileData.role) {
          console.warn('[Auth] Profile missing role for user:', data.user.id)
          profileData.role = 'employee' // Default to employee role
        }

        // PRE-SEED SESSION CACHE: Pre-populate session cache for instant first dashboard load
        preSeedSessionCache(data.user, profileData as any).catch(err => {
          console.warn('[AUTH-LOGIN] Pre-seed session cache failed (non-critical):', err)
        })

        return {
          success: true,
          profile: profileData,
          lastLogout: lastLogout,
          user: {
            id: data.user.id,
            email: data.user.email
          },
          tenantSlug: (data as any).discoveredTenantSlug || null,
          warning: null as string | null
        }
      } catch (error) {
        // Handle network or other errors outside of the signInWithPassword call
        if (error instanceof TRPCError) {
          throw error
        }

        const errorMessage = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase()

        // Walk the full cause chain for deeper inspection
        const fullChain = (() => {
          const msgs: string[] = []
          let current: any = error
          while (current) {
            if (current.message) msgs.push(current.message.toLowerCase())
            current = current.cause
          }
          return msgs.join(' | ')
        })()

        // Check if the cause chain mentions supabase hostnames (project paused/down)
        if (
          fullChain.includes('supabase.co') ||
          fullChain.includes('supabase.in') ||
          fullChain.includes('tenant or user not found') ||
          fullChain.includes('project is paused') ||
          fullChain.includes('connection terminated')
        ) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Database service is currently unavailable. The Supabase project might be paused or disconnected. Please check the Supabase dashboard.',
            cause: { type: AuthErrorTypes.SERVICE_UNAVAILABLE, field: 'none' }
          })
        }

        // Network connectivity issues (no supabase host in chain = user's own network)
        if (
          errorMessage.includes('fetch failed') ||
          errorMessage.includes('failed to fetch') ||
          errorMessage.includes('network request failed') ||
          errorMessage.includes('enotfound') ||
          errorMessage.includes('econnrefused')
        ) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Unable to connect to the server. Please check your internet connection.',
            cause: { type: AuthErrorTypes.NETWORK_ERROR, field: 'none' }
          })
        }

        // Database/service unavailability
        if (
          errorMessage.includes('service unavailable') ||
          errorMessage.includes('database') ||
          errorMessage.includes('timeout') ||
          errorMessage.includes('project is paused') ||
          errorMessage.includes('connection terminated') ||
          errorMessage.includes('too many connections')
        ) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Database service is currently unavailable. The project might be paused or down.',
            cause: { type: AuthErrorTypes.SERVICE_UNAVAILABLE, field: 'none' }
          })
        }

        // Generic Network or other errors
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Network error or service unavailable. Please check your connection and try again.',
          cause: { type: AuthErrorTypes.NETWORK_ERROR, field: 'none' }
        })
      }
    }),

  registerTenant: publicProcedure
    .input(z.object({
      companyName: z.string().min(2).max(100),
      slug: z.string().min(3).max(30).regex(/^[a-z0-9-]+$/, {
        message: 'Subdomain must contain only lowercase letters, numbers, and hyphens'
      }),
      adminEmail: z.string().email(),
      adminPassword: z.string().min(8),
      firstName: z.string().optional(),
      lastName: z.string().optional(),
      phone: z.string().optional(),
      country: z.string().optional(),
      industry: z.string().optional(),
      teamSize: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      // 1. Verify if subdomain is already registered
      const { resolveTenant } = await import('@/lib/tenant/resolver');
      const existingTenant = await resolveTenant(input.slug);
      if (existingTenant) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Subdomain is already taken. Please try another one.',
        });
      }

      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

      if (!supabaseUrl || !supabaseServiceKey) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Authentication and database setup is missing server configuration',
        });
      }

      const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
        auth: { autoRefreshToken: false, persistSession: false }
      });

      // 2. Create the Supabase auth user
      const fullName = input.firstName && input.lastName 
        ? `${input.firstName} ${input.lastName}`.trim() 
        : (input.firstName || input.lastName || `${input.companyName} Admin`);
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: input.adminEmail,
        password: input.adminPassword,
        email_confirm: true,
        user_metadata: {
          full_name: fullName,
          status: 'active'
        }
      });

      if (authError) {
        console.error('[Signup] Auth user creation failed:', authError);
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: authError.message || 'Failed to register admin user',
        });
      }

      const adminUserId = authData.user.id;

      try {
        // 3. Register tenant in control plane with status 'pending_setup' (NO schema provisioning)
        const { masterDb } = await import('@/lib/db/master-connection');
        const { tenants, tenantBranding } = await import('@/lib/db/master-schema');

        const safeSlug = input.slug.toLowerCase().trim().replace(/[^a-z0-9-]/g, '');
        const schemaName = `tenant_${safeSlug.replace(/-/g, '_')}`;
        const trialStart = new Date();
        const trialEnd = new Date();
        trialEnd.setDate(trialStart.getDate() + 14);

        const [newTenant] = await masterDb.insert(tenants).values({
          slug: safeSlug,
          company_name: input.companyName,
          tenant_schema: schemaName,
          status: 'pending_setup',
          trial_start: trialStart,
          trial_end: trialEnd,
          trial_duration_days: 14,
          admin_email: input.adminEmail,
          license_expires_at: trialEnd,
          country: input.country || null,
          industry: input.industry || null,
          team_size: input.teamSize || null,
        }).returning();

        // 4. Register default branding
        await masterDb.insert(tenantBranding).values({
          tenant_id: newTenant.id,
          app_name: input.companyName,
          short_name: input.companyName.substring(0, 15),
        });

        console.log(`[Signup] Tenant ${safeSlug} registered (pending_setup). Auth user: ${adminUserId}`);

        // Fire background provisioning (non-blocking, fire-and-forget)
        // This runs the full schema+table+profile setup while the user reads the success screen.
        // If it fails, the /setup page fallback still works.
        (async () => {
          try {
            const { provisionTenant } = await import('@/lib/tenant/provisioning');
            await provisionTenant(
              safeSlug,
              input.companyName,
              input.adminEmail,
              14,
              adminUserId,
              {
                firstName: input.firstName,
                lastName: input.lastName,
                phone: input.phone,
                country: input.country,
                industry: input.industry,
                teamSize: input.teamSize,
              },
              undefined,
              true, // skipRegistration — tenant record already created above
            );

            // Update tenant status: pending_setup → trial
            await masterDb.update(tenants)
              .set({ status: 'trial', updated_at: new Date() })
              .where(eq(tenants.id, newTenant.id));

            // Clear resolver cache so login picks up the new status
            try {
              const { clearResolverCache } = await import('@/lib/tenant/resolver');
              clearResolverCache();
            } catch {}

            console.log(`[BG-Provision] ✅ Workspace ${safeSlug} auto-provisioned successfully`);
          } catch (bgErr) {
            console.error(`[BG-Provision] ❌ Background provisioning failed for ${safeSlug}:`, bgErr);
            // Status stays pending_setup — user will see /setup fallback on login
          }
        })();

        return {
          success: true,
          tenantId: newTenant.id,
          slug: safeSlug,
          message: 'Account created! Please login to set up your workspace.'
        };
      } catch (error: any) {
        console.error('[Signup] Registration failed, rolling back auth user:', error);
        try {
          await supabaseAdmin.auth.admin.deleteUser(adminUserId);
        } catch (deleteError) {
          console.error('[Signup] Failed to delete rolled-back auth user:', deleteError);
        }
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message || 'Failed to register workspace',
        });
      }
    }),

  // Get tenant info for the /setup page heading
  getSetupInfo: authenticatedProcedure
    .query(async ({ ctx }) => {
      const { masterDb } = await import('@/lib/db/master-connection');
      const { tenants } = await import('@/lib/db/master-schema');

      const tenant = await masterDb.query.tenants.findFirst({
        where: eq(tenants.admin_email, ctx.user.email),
      });

      return {
        companyName: tenant?.company_name || 'Your Workspace',
        adminEmail: ctx.user.email || '',
        adminName: ctx.user.user_metadata?.full_name || '',
        slug: tenant?.slug || '',
        status: tenant?.status || 'unknown',
      };
    }),

  // Provision workspace schema on first login (called from /setup page)
  provisionWorkspace: authenticatedProcedure
    .mutation(async ({ ctx }) => {
      const { masterDb } = await import('@/lib/db/master-connection');
      const { tenants } = await import('@/lib/db/master-schema');

      // Find the tenant for this user
      const tenant = await masterDb.query.tenants.findFirst({
        where: eq(tenants.admin_email, ctx.user.email),
      });

      if (!tenant) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'No workspace found for your account',
        });
      }

      if (tenant.status !== 'pending_setup') {
        // Already provisioned — just return success
        return { 
          success: true, 
          alreadyProvisioned: true,
          slug: tenant.slug 
        };
      }

      // Lock the tenant row to prevent concurrent provisioning
      const { centralDb } = await import('@/lib/db');
      const { sql } = await import('drizzle-orm');
      const locked = await centralDb.execute(
        sql`SELECT id FROM public.tenants WHERE id = ${tenant.id} AND status = 'pending_setup' FOR UPDATE SKIP LOCKED`
      );

      if (locked.length === 0) {
        // Another request is already provisioning
        return { success: true, alreadyProvisioned: true, slug: tenant.slug };
      }

      try {
        const { provisionTenant } = await import('@/lib/tenant/provisioning');
        
        const safeSlug = tenant.slug;

        // Extract firstName/lastName from Supabase user metadata (stored during signup)
        const userMeta = ctx.user.user_metadata || {};
        const fullName = userMeta.full_name || '';
        const nameParts = fullName.split(' ');
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || '';

        // Provision schema and tables (skipRegistration=true since tenant record already exists)
        await provisionTenant(
          safeSlug,
          tenant.company_name,
          tenant.admin_email!,
          tenant.trial_duration_days || 14,
          ctx.user.id,
          { firstName, lastName },
          undefined, // onProgress
          true, // skipRegistration — tenant record already created during signup
        );

        // Update tenant status from pending_setup → trial
        await masterDb.update(tenants)
          .set({ status: 'trial', updated_at: new Date() })
          .where(eq(tenants.id, tenant.id));

        // Clear resolver cache so new status is picked up immediately
        try {
          const { clearResolverCache } = await import('@/lib/tenant/resolver');
          clearResolverCache();
        } catch {}

        console.log(`[Provision] Workspace ${safeSlug} provisioned successfully for user ${ctx.user.id}`);

        return {
          success: true,
          alreadyProvisioned: false,
          slug: safeSlug,
        };
      } catch (error: any) {
        console.error(`[Provision] Failed to provision workspace:`, error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to set up workspace. Please try again.',
        });
      }
    }),

  logout: publicProcedure.mutation(async ({ ctx }) => {
    if (!ctx.supabase) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Authentication service unavailable',
      })
    }

    console.log('[AUTH-LOGOUT] Logout procedure executed for user:', ctx.user?.id)

    try {
      // Log the logout activity & sign out from Supabase concurrently
      const activityPromise = ctx.user
        ? ctx.db.insert(activities).values({
            user_id: ctx.profile?.id || ctx.user.id,
            activity_type: 'logout',
            module: 'auth',
            description: formatActivityDescription({
              action: 'logout',
              actorRole: ctx.profile?.role || 'employee',
              actorEmail: ctx.user.email || '',
              module: 'auth'
            }),
          })
        : Promise.resolve();

      const [signOutResult] = await Promise.all([
        ctx.supabase.auth.signOut(),
        activityPromise
      ])

      const { error: signOutError } = signOutResult
      if (signOutError) {
        console.error('[AUTH-LOGOUT] Error signing out from Supabase:', signOutError)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to sign out from authentication service',
        })
      }

      // Clear session cache and perform comprehensive logout cleanup for this specific user
      const logoutResult = await performLogout(ctx.user?.id)
      if (!logoutResult.success) {
        console.warn('[AUTH-LOGOUT] Session cache cleanup had issues:', logoutResult.error)
        // Don't fail the logout if cache cleanup has issues
      }

      console.log('[AUTH-LOGOUT] Successfully completed logout for user:', ctx.user?.id)
      return { success: true, message: 'Successfully logged out' }

    } catch (error) {
      console.error('[AUTH-LOGOUT] Logout procedure failed:', error)

      // Even if there's an error, try to clear the session cache for this specific user
      await performLogout(ctx.user?.id)

      if (error instanceof TRPCError) {
        throw error
      }

      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Logout failed. Please try again.',
      })
    }
  }),

  logActivity: protectedProcedure
    .input(z.object({ type: z.string() }))
    .mutation(async ({ input, ctx }) => {
      if (!ctx.supabase) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Database service unavailable',
        })
      }

      await ctx.db.insert(activities).values({
        user_id: ctx.profile?.id || ctx.user.id,
        activity_type: input.type as any,
        module: 'auth',
        description: `User ${input.type}`,
      })

      return { success: true }
    }),

  changePassword: protectedProcedure
    .input(changePasswordSchema)
    .mutation(async ({ input, ctx }) => {
      if (!ctx.supabase || !ctx.user) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Authentication service unavailable',
        })
      }

      const email = ctx.user.email
      if (!email) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'User email not available',
        })
      }

      // Verify current password
      const { error: verifyError } = await ctx.supabase.auth.signInWithPassword({
        email,
        password: input.currentPassword,
      })

      if (verifyError) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Current password is incorrect',
        })
      }

      // Update to new password
      const { data: updateData, error: updateError } = await ctx.supabase.auth.updateUser({
        password: input.newPassword,
      })

      if (updateError) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: updateError.message || 'Failed to update password',
        })
      }

      // Log activity - fire and forget to prevent password change flow from failing if logging fails
      const logPasswordChangeActivity = async () => {
        try {
          await ctx.db.insert(activities).values({
            user_id: ctx.profile?.id || ctx.user.id,
            activity_type: 'profile_update',
            module: 'auth',
            description: formatActivityDescription({
              action: 'update',
              actorRole: ctx.profile?.role || 'employee',
              actorEmail: email,
              module: 'auth'
            }),
          })
        } catch (err) {
          console.error('[AUTH-PASSWORD-CHANGE] Background activity logging failed:', err)
        }
      }
      logPasswordChangeActivity()

      return { success: true, userId: ctx.user.id }
    }),
})
