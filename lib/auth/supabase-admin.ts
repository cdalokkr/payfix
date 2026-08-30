import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';

/**
 * Password assigned only when a workspace is created from the super-admin
 * console. The UI labels it temporary and directs the administrator to reset
 * it after first login.
 */
export const SUPERADMIN_DEFAULT_ADMIN_PASSWORD = 'Payfix@2026!';

export function createSupabaseAdminClient(): SupabaseClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Authentication service is missing server configuration');
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function findAuthUserByEmail(
  supabaseAdmin: SupabaseClient,
  email: string,
): Promise<User | null> {
  const normalizedEmail = email.trim().toLowerCase();
  let page = 1;

  while (true) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({
      page,
      perPage: 1000,
    });

    if (error) throw error;

    const match = data.users.find(
      (user) => user.email?.trim().toLowerCase() === normalizedEmail,
    );
    if (match) return match;
    if (data.users.length < 1000) return null;

    page += 1;
  }
}

export async function ensureSuperAdminAuthUser(
  supabaseAdmin: SupabaseClient,
  input: { email: string; fullName: string; phone?: string },
): Promise<{ user: User; created: boolean }> {
  const existingUser = await findAuthUserByEmail(supabaseAdmin, input.email);
  const metadata = {
    ...(existingUser?.user_metadata || {}),
    full_name: input.fullName,
    ...(input.phone ? { phone: input.phone } : {}),
    status: 'active',
  };

  if (existingUser) {
    const { data, error } = await supabaseAdmin.auth.admin.updateUserById(existingUser.id, {
      password: SUPERADMIN_DEFAULT_ADMIN_PASSWORD,
      user_metadata: metadata,
    });
    if (error || !data.user) throw error || new Error('Failed to update primary admin account');
    return { user: data.user, created: false };
  }

  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email: input.email,
    password: SUPERADMIN_DEFAULT_ADMIN_PASSWORD,
    email_confirm: true,
    user_metadata: metadata,
  });
  if (error || !data.user) throw error || new Error('Failed to create primary admin account');
  return { user: data.user, created: true };
}