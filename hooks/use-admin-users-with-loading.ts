// ============================================
// hooks/use-admin-users-with-loading.ts (Minimal Version)
// ============================================
import { useCallback } from 'react'
import { trpc } from '@/lib/trpc/client'
import { Profile, UserRole } from '@/types'
import toast from 'react-hot-toast'

// Query configuration types
interface UserQueryConfig {
  page: number
  limit: number
  search?: string
  role?: UserRole | 'all'
}

// Main integration hook
export function useAdminUsersWithLoading(
  initialConfig?: Partial<UserQueryConfig>
) {
  // Simple query for now
  const usersQuery = trpc.admin.users.getUsers.useQuery({
    page: 1,
    limit: 50,
    ...initialConfig
  })

  // Simple mutations
  const createUserMutation = trpc.admin.users.createUser.useMutation({
    onSuccess: (data) => {
      toast.success('User created successfully')
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to create user')
    }
  })

  const updateUserMutation = trpc.admin.users.updateUserProfile.useMutation({
    onSuccess: () => {
      toast.success('User updated successfully')
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to update user')
    }
  })

  const deleteUserMutation = trpc.admin.users.deleteUser.useMutation({
    onSuccess: () => {
      toast.success('User deleted successfully')
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to delete user')
    }
  })

  const updateUserRoleMutation = trpc.admin.users.updateUserRole.useMutation({
    onSuccess: () => {
      toast.success('User role updated successfully')
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to update user role')
    }
  })

  // Utility functions
  const refreshAll = useCallback(async () => {
    await trpc.useUtils().admin.users.getUsers.invalidate()
  }, [])

  const clearCache = useCallback(() => {
    trpc.useUtils().admin.users.getUsers.invalidate()
  }, [])

  return {
    // Query
    usersQuery,
    
    // Mutations
    createUserMutation,
    updateUserMutation,
    deleteUserMutation,
    updateUserRoleMutation,
    
    // Loading state
    isLoading: usersQuery.isLoading,
    currentOperation: null as any,
    loadingProgress: null,
    
    // Performance
    performance: {
      totalQueryTime: 0,
      averageMutationTime: 0,
      errorCount: 0,
      successCount: 0,
      lastOperationDuration: null,
      isSlowOperation: false
    },
    
    // Utility functions
    refreshAll,
    cancelAllOperations: () => {},
    retryFailedOperation: () => {},
    clearCache,
    updateConfig: (config: Partial<UserQueryConfig>) => {},
    searchUsers: (searchTerm: string) => {},
    filterByRole: (role: UserRole | 'all') => {},
    goToPage: (page: number) => {}
  }
}

export default useAdminUsersWithLoading