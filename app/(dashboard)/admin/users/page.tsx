import type { Metadata } from 'next'
import UserManagement from '@/features/users/components/user-management'
import { UserManagementErrorBoundary } from './user-management-error-boundary'
import { getServerClient } from '@/lib/trpc/server-client'

export const metadata: Metadata = {
  title: 'Manage Users - Admin Dashboard',
  description: 'Comprehensive user management interface with advanced filtering, role management, and bulk operations for system administrators.',
  keywords: ['admin', 'users', 'management', 'user administration', 'roles', 'permissions'],
  robots: 'noindex, nofollow', // Admin pages should not be indexed
}

export default async function UsersPage() {
  let initialData = undefined

  try {
    // Prefetch all users on the server for instant loading/hydration
    const trpc = await getServerClient()
    initialData = await trpc.admin.users.getUsers({
      page: 1,
      limit: 9999,
      getAll: true,
    })
  } catch (error) {
    console.error('[USERS-PAGE] Prefetch failed:', error)
    // initialData remains undefined, hook will fetch on client as fallback
  }

  return (
    <UserManagementErrorBoundary>
      <UserManagement initialData={initialData} />
    </UserManagementErrorBoundary>
  )
}