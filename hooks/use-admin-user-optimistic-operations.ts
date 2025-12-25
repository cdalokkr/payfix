'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-hot-toast'
import { useState } from 'react'

// Types for optimistic updates
interface OptimisticUserUpdate {
  id: string
  email: string
  first_name?: string
  last_name?: string
  mobile_no?: string
  role?: 'admin' | 'user'
  date_of_birth?: string
  updated_at?: string
}

interface OptimisticUser extends OptimisticUserUpdate {
  user_id: string
  created_at: string
  full_name?: string
}

// API call functions
async function callAdminUsersMutation(endpoint: string, input: any) {
  const response = await fetch(`/api/trpc/${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ input }),
  })
  
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.message || 'Request failed')
  }
  
  return response.json()
}

// Hook for optimistic user role updates
export function useOptimisticUserRoleUpdate() {
  const queryClient = useQueryClient()
  const [isUpdating, setIsUpdating] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: 'admin' | 'user' }) =>
      callAdminUsersMutation('adminUsers.updateUserRole', { userId, role }),

    onMutate: async ({ userId, role }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['admin-users'] })
      await queryClient.cancelQueries({ queryKey: ['admin-dashboard'] })

      // Snapshot the previous value
      const previousUsers = queryClient.getQueryData(['admin-users'])
      const previousDashboard = queryClient.getQueryData(['admin-dashboard'])

      setIsUpdating(userId)

      // Optimistically update to the new value
      queryClient.setQueryData(['admin-users'], (old: any) => {
        if (!old) return old
        return {
          ...old,
          users: old.users.map((user: OptimisticUser) =>
            user.id === userId ? { ...user, role } : user
          )
        }
      })

      queryClient.setQueryData(['admin-dashboard'], (old: any) => {
        if (!old) return old
        return old // Dashboard will be refetched
      })

      return { previousUsers, previousDashboard }
    },

    onError: (err, { userId }, context) => {
      if (context?.previousUsers) {
        queryClient.setQueryData(['admin-users'], context.previousUsers)
      }
      if (context?.previousDashboard) {
        queryClient.setQueryData(['admin-dashboard'], context.previousDashboard)
      }
      
      toast.error(`Failed to update user role: ${err.message}`)
      console.error('User role update failed:', err)
    },

    onSettled: (data, error, { userId }) => {
      setIsUpdating(null)
      
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] })
    },

    onSuccess: () => {
      toast.success('User role updated successfully')
    }
  })

  return {
    updateUserRole: mutation.mutate,
    isUpdating,
    isError: mutation.isError,
    error: mutation.error
  }
}

// Hook for optimistic user profile updates
export function useOptimisticUserProfileUpdate() {
  const queryClient = useQueryClient()
  const [isUpdating, setIsUpdating] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: ({
      userId,
      updates
    }: {
      userId: string
      updates: {
        firstName?: string
        lastName?: string
        mobileNo?: string
        dateOfBirth?: string
      }
    }) => callAdminUsersMutation('adminUsers.updateUserProfile', { userId, ...updates }),

    onMutate: async ({ userId, updates }) => {
      await queryClient.cancelQueries({ queryKey: ['admin-users'] })
      
      const previousUsers = queryClient.getQueryData(['admin-users'])
      setIsUpdating(userId)

      queryClient.setQueryData(['admin-users'], (old: any) => {
        if (!old) return old
        return {
          ...old,
          users: old.users.map((user: OptimisticUser) => {
            if (user.id !== userId) return user
            
            const updatedUser = { ...user }
            if (updates.firstName !== undefined) updatedUser.first_name = updates.firstName
            if (updates.lastName !== undefined) updatedUser.last_name = updates.lastName
            if (updates.mobileNo !== undefined) updatedUser.mobile_no = updates.mobileNo
            if (updates.dateOfBirth !== undefined) updatedUser.date_of_birth = updates.dateOfBirth
            updatedUser.updated_at = new Date().toISOString()
            
            return updatedUser
          })
        }
      })

      return { previousUsers }
    },

    onError: (err, { userId }, context) => {
      if (context?.previousUsers) {
        queryClient.setQueryData(['admin-users'], context.previousUsers)
      }
      
      toast.error(`Failed to update user profile: ${err.message}`)
      console.error('User profile update failed:', err)
    },

    onSettled: (data, error, { userId }) => {
      setIsUpdating(null)
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
    },

    onSuccess: () => {
      toast.success('User profile updated successfully')
    }
  })

  return {
    updateUserProfile: mutation.mutate,
    isUpdating,
    isError: mutation.isError,
    error: mutation.error
  }
}

// Hook for optimistic user deletion
export function useOptimisticUserDelete() {
  const queryClient = useQueryClient()
  const [isDeleting, setIsDeleting] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: ({ userId }: { userId: string }) =>
      callAdminUsersMutation('adminUsers.deleteUser', { userId }),

    onMutate: async ({ userId }) => {
      await queryClient.cancelQueries({ queryKey: ['admin-users'] })
      await queryClient.cancelQueries({ queryKey: ['admin-dashboard'] })

      const previousUsers = queryClient.getQueryData(['admin-users'])
      const previousDashboard = queryClient.getQueryData(['admin-dashboard'])
      setIsDeleting(userId)

      queryClient.setQueryData(['admin-users'], (old: any) => {
        if (!old) return old
        return {
          ...old,
          users: old.users.filter((user: OptimisticUser) => user.id !== userId),
          total: Math.max(0, (old.total || 0) - 1)
        }
      })

      return { previousUsers, previousDashboard }
    },

    onError: (err, { userId }, context) => {
      if (context?.previousUsers) {
        queryClient.setQueryData(['admin-users'], context.previousUsers)
      }
      if (context?.previousDashboard) {
        queryClient.setQueryData(['admin-dashboard'], context.previousDashboard)
      }
      
      toast.error(`Failed to delete user: ${err.message}`)
      console.error('User deletion failed:', err)
    },

    onSettled: (data, error, { userId }) => {
      setIsDeleting(null)
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] })
    },

    onSuccess: () => {
      toast.success('User deleted successfully')
    }
  })

  return {
    deleteUser: mutation.mutate,
    isDeleting,
    isError: mutation.isError,
    error: mutation.error
  }
}

// Hook for optimistic user creation
export function useOptimisticUserCreate() {
  const queryClient = useQueryClient()
  const [isCreating, setIsCreating] = useState(false)

  const mutation = useMutation({
    mutationFn: (userData: {
      email: string
      password: string
      firstName?: string
      lastName?: string
      mobileNo?: string
      dateOfBirth?: string
      role: 'admin' | 'user'
    }) => callAdminUsersMutation('adminUsers.createUser', userData),

    onMutate: async (userData) => {
      await queryClient.cancelQueries({ queryKey: ['admin-users'] })
      await queryClient.cancelQueries({ queryKey: ['admin-dashboard'] })

      const previousUsers = queryClient.getQueryData(['admin-users'])
      setIsCreating(true)

      const optimisticUser: OptimisticUser = {
        id: crypto.randomUUID(),
        user_id: crypto.randomUUID(),
        email: userData.email,
        first_name: userData.firstName,
        last_name: userData.lastName,
        mobile_no: userData.mobileNo,
        date_of_birth: userData.dateOfBirth,
        role: userData.role,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        full_name: [userData.firstName, userData.lastName].filter(Boolean).join(' ')
      }

      queryClient.setQueryData(['admin-users'], (old: any) => {
        if (!old) {
          return {
            users: [optimisticUser],
            total: 1,
            pages: 1
          }
        }
        
        return {
          ...old,
          users: [optimisticUser, ...old.users],
          total: (old.total || 0) + 1,
          pages: Math.ceil(((old.total || 0) + 1) / (old.limit || 10))
        }
      })

      return { previousUsers }
    },

    onError: (err, userData, context) => {
      if (context?.previousUsers) {
        queryClient.setQueryData(['admin-users'], context.previousUsers)
      }
      
      toast.error(`Failed to create user: ${err.message}`)
      console.error('User creation failed:', err)
    },

    onSettled: (data, error, userData) => {
      setIsCreating(false)
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] })
    },

    onSuccess: () => {
      toast.success('User created successfully')
    }
  })

  return {
    createUser: mutation.mutate,
    isCreating,
    isError: mutation.isError,
    error: mutation.error
  }
}

// Combined hook for all admin user operations
export function useAdminUserOptimisticOperations() {
  const roleUpdate = useOptimisticUserRoleUpdate()
  const profileUpdate = useOptimisticUserProfileUpdate()
  const deleteOperation = useOptimisticUserDelete()
  const createOperation = useOptimisticUserCreate()

  return {
    // Role updates
    updateUserRole: roleUpdate.updateUserRole,
    isUpdatingRole: roleUpdate.isUpdating,
    isRoleUpdateError: roleUpdate.isError,
    roleUpdateError: roleUpdate.error,

    // Profile updates
    updateUserProfile: profileUpdate.updateUserProfile,
    isUpdatingProfile: profileUpdate.isUpdating,
    isProfileUpdateError: profileUpdate.isError,
    profileUpdateError: profileUpdate.error,

    // Deletion
    deleteUser: deleteOperation.deleteUser,
    isDeleting: deleteOperation.isDeleting,
    isDeleteError: deleteOperation.isError,
    deleteError: deleteOperation.error,

    // Creation
    createUser: createOperation.createUser,
    isCreating: createOperation.isCreating,
    isCreateError: createOperation.isError,
    createError: createOperation.error,

    // Combined states
    isAnyOperationPending: 
      roleUpdate.isUpdating || 
      profileUpdate.isUpdating || 
      deleteOperation.isDeleting || 
      createOperation.isCreating
  }
}