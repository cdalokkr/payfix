/** @jest-environment node */

import {
  ensureSuperAdminAuthUser,
  findAuthUserByEmail,
  SUPERADMIN_DEFAULT_ADMIN_PASSWORD,
} from './supabase-admin';

describe('super-admin auth provisioning helpers', () => {
  it('uses a valid temporary password for the super-admin creation path', () => {
    expect(SUPERADMIN_DEFAULT_ADMIN_PASSWORD).toHaveLength(12);
    expect(SUPERADMIN_DEFAULT_ADMIN_PASSWORD).toMatch(/[A-Z]/);
    expect(SUPERADMIN_DEFAULT_ADMIN_PASSWORD).toMatch(/[a-z]/);
    expect(SUPERADMIN_DEFAULT_ADMIN_PASSWORD).toMatch(/[0-9]/);
    expect(SUPERADMIN_DEFAULT_ADMIN_PASSWORD).toMatch(/[^A-Za-z0-9]/);
  });

  it('finds an existing auth identity case-insensitively across pages', async () => {
    const listUsers = jest
      .fn()
      .mockResolvedValueOnce({
        data: { users: Array.from({ length: 1000 }, (_, index) => ({ id: String(index), email: `user-${index}@example.com` })) },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { users: [{ id: 'admin-id', email: 'Admin@Example.com', user_metadata: {} }] },
        error: null,
      });

    const user = await findAuthUserByEmail(
      { auth: { admin: { listUsers } } } as any,
      ' admin@example.com ',
    );

    expect(user?.id).toBe('admin-id');
    expect(listUsers).toHaveBeenCalledWith({ page: 2, perPage: 1000 });
  });

  it('returns null when no identity exists', async () => {
    const listUsers = jest.fn().mockResolvedValue({
      data: { users: [{ id: 'other', email: 'other@example.com' }] },
      error: null,
    });

    await expect(
      findAuthUserByEmail({ auth: { admin: { listUsers } } } as any, 'admin@example.com'),
    ).resolves.toBeNull();
  });

  it('creates a confirmed admin with the shared temporary password and contact metadata', async () => {
    const createUser = jest.fn().mockResolvedValue({
      data: { user: { id: 'new-admin', email: 'admin@example.com' } },
      error: null,
    });
    const admin = {
      listUsers: jest.fn().mockResolvedValue({ data: { users: [] }, error: null }),
      createUser,
    };

    const result = await ensureSuperAdminAuthUser(
      { auth: { admin } } as any,
      { email: 'admin@example.com', fullName: 'Admin Person', phone: '+919876543210' },
    );

    expect(result).toEqual({ user: { id: 'new-admin', email: 'admin@example.com' }, created: true });
    expect(createUser).toHaveBeenCalledWith({
      email: 'admin@example.com',
      password: SUPERADMIN_DEFAULT_ADMIN_PASSWORD,
      email_confirm: true,
      user_metadata: {
        full_name: 'Admin Person',
        phone: '+919876543210',
        status: 'active',
      },
    });
  });

  it('reuses an existing identity and updates its temporary password without creating another user', async () => {
    const updateUserById = jest.fn().mockResolvedValue({
      data: { user: { id: 'existing-admin', email: 'admin@example.com' } },
      error: null,
    });
    const createUser = jest.fn();
    const admin = {
      listUsers: jest.fn().mockResolvedValue({
        data: { users: [{ id: 'existing-admin', email: 'ADMIN@example.com', user_metadata: { source: 'signup' } }] },
        error: null,
      }),
      updateUserById,
      createUser,
    };

    const result = await ensureSuperAdminAuthUser(
      { auth: { admin } } as any,
      { email: 'admin@example.com', fullName: 'Updated Admin' },
    );

    expect(result.created).toBe(false);
    expect(updateUserById).toHaveBeenCalledWith('existing-admin', {
      password: SUPERADMIN_DEFAULT_ADMIN_PASSWORD,
      user_metadata: { source: 'signup', full_name: 'Updated Admin', status: 'active' },
    });
    expect(createUser).not.toHaveBeenCalled();
  });
});