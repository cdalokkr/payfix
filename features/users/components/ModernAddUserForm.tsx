"use client"

import { useState, useTransition, useEffect, useRef } from "react"
import { useForm, Resolver } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { createUserSchema, editUserSchema, resetPasswordSchema, resetPasswordFormSchema, CreateUserInput, EditUserInput, ResetPasswordInput } from "@/lib/validations/auth"
import { trpc } from "@/lib/trpc/client"
import { toast } from "sonner"
import { UserRole, Profile } from "@/types"
import { FormContent, UserFormValues } from "./modern-add-user-form-content"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Edit, UserPlus, Trash2, Key } from "lucide-react"
import { cn } from "@/lib/utils"
import { useDashboardPrefetch } from "@/hooks/use-dashboard-prefetch"
import { broadcastCacheInvalidation } from "@/lib/prefetch-status"
import { getEventBroadcaster } from "@/lib/events/event-broadcaster"

// Helper to validate sex field
const getValidSex = (sex: string | undefined | null): "male" | "female" | "" => {
  const normalizedSex = sex?.toLowerCase()
  if (normalizedSex === "male" || normalizedSex === "female") return normalizedSex
  return ""
}

interface ModernAddUserFormProps {
  // Sheet-related props
  open?: boolean
  onOpenChange?: (open: boolean) => void

  // Form callback props
  onSuccess?: (updatedFields?: string[]) => void
  onCancel?: () => void

  // Customization props
  className?: string
  useSheet?: boolean
  showDefaultHeader?: boolean
  title?: string
  description?: string
  editingUser?: Profile | null
  refetch?: () => void
  isDeleteMode?: boolean
  isProfileMode?: boolean
  isPasswordResetMode?: boolean
}

export function ModernAddUserForm({
  open = false,
  onOpenChange,
  onSuccess,
  onCancel,
  className,
  useSheet = false,
  showDefaultHeader = true,
  title = "Create New User",
  description = "Add a new user to the system with their basic information and access permissions",
  editingUser,
  refetch,
  isDeleteMode = false,
  isProfileMode = false,
  isPasswordResetMode = false
}: ModernAddUserFormProps) {
  const [internalOpen, setInternalOpen] = useState(false)
  const isEditMode = !!editingUser
  // const [isPending, startTransition] = useTransition()
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSuccess, setIsSuccess] = useState(false)

  // Store dirty fields to pass to onSuccess
  const dirtyFieldsRef = useRef<string[]>([])
  const isMounted = useRef(false)

  // State for managing timeouts
  const [successTimeout, setSuccessTimeout] = useState<NodeJS.Timeout | null>(null)
  const [errorTimeout, setErrorTimeout] = useState<NodeJS.Timeout | null>(null)

  const utils = trpc.useUtils()

  // Use the centralized dashboard prefetch hook for non-blocking prefetch
  const { prefetch: prefetchDashboard, clearPrefetch } = useDashboardPrefetch()

  // Handle open state for sheet mode
  const isOpen = useSheet ? (open || internalOpen) : true
  const handleOpenChange = (newOpen: boolean) => {
    if (useSheet) {
      if (onOpenChange) {
        onOpenChange(newOpen)
      } else {
        setInternalOpen(newOpen)
      }
    }
    if (!newOpen) {
      clearTimeouts() // Clear any pending timeouts
      form.reset()
      setSubmitError(null)
      setIsSuccess(false)
      onCancel?.()
    }
  }

  // Function to clear all timeouts
  const clearTimeouts = () => {
    if (successTimeout) {
      clearTimeout(successTimeout)
      setSuccessTimeout(null)
    }
    if (errorTimeout) {
      clearTimeout(errorTimeout)
      setErrorTimeout(null)
    }
  }

  // Role-specific invalidate cache mutation
  const invalidateServerCacheMutation = isProfileMode
    ? trpc.profile.invalidateCache.useMutation({
      onSuccess: (result) => {
        console.log(`🗑️ Profile cache invalidated: ${result.invalidatedCount} entries cleared`)
      }
    })
    : trpc.admin.dashboard.invalidateCache.useMutation({
      onSuccess: (result) => {
        console.log(`🗑️ Server cache invalidated: ${result.invalidatedCount} entries cleared`)
      },
      onError: (error) => {
        console.warn('⚠️ Server cache invalidation failed:', error.message)
      }
    })


  // Invalidate dashboard cache for user metrics (both server and client side)
  const invalidateDashboardCache = async () => {
    console.log('🎯 Starting cache invalidation (server + client)...')

    // Step 1: Invalidate server-side cache first (this is the critical fix)
    try {
      // We don't await this to prevent blocking the UI
      invalidateServerCacheMutation.mutateAsync({
        reason: 'user-operation'
      }).then(result => {
        console.log(`🗑️ Server cache invalidated: ${result.invalidatedCount} entries cleared`)
      }).catch(error => {
        console.warn('⚠️ Server cache invalidation failed, continuing with client-side invalidation:', error)
      })
    } catch (error) {
      console.warn('⚠️ Server cache invalidation failed immediately:', error)
    }

    // Step 2: Invalidate client-side tRPC cache (fire and forget for UI responsiveness)
    try {
      if (isProfileMode) {
        utils.profile.get.invalidate()
      }
      utils.admin.dashboard.getUnifiedDashboardData.invalidate()
      console.log('🔄 All relevant tRPC caches invalidated')
    } catch (error) {
      console.warn('⚠️ Client cache invalidation failed:', error)
    }


    // Step 3: Also invalidate the comprehensive dashboard data cache
    try {
      utils.admin.dashboard.getComprehensiveDashboardData.invalidate()
      console.log('🔄 Comprehensive dashboard cache invalidated')
    } catch (error) {
      // This is optional, may not exist in all setups
    }

    // Step 4: Invalidate stats endpoint cache
    try {
      utils.admin.dashboard.getStats.invalidate()
      console.log('🔄 Stats cache invalidated')
    } catch (error) {
      // This is optional
    }

    console.log('✅ CACHE INVALIDATION INITIATED: All server + client caches clearing in background')
  }

  // Prefetch fresh dashboard data so it's ready when user navigates to dashboard
  // This prevents the "flash of old data" issue when returning to dashboard after user operations
  // NOW USES NON-BLOCKING PREFETCH via the centralized hook
  const prefetchDashboardData = async () => {
    console.log('[PREFETCH] Starting non-blocking dashboard data prefetch...')

    // Clear existing prefetch status to ensure fresh data
    clearPrefetch()

    // Broadcast cache invalidation to other tabs
    broadcastCacheInvalidation()

    // IMPORTANT: Use forceFresh=false to match dashboard load cache key (speed priority)
    // This ensures prefetched data is used by the dashboard query when navigating
    // Only use forceFresh=true for manual refresh scenarios
    prefetchDashboard({ forceFresh: false, blocking: false })
      .then(() => {
        console.log('[PREFETCH] ✅ Dashboard data prefetched successfully - ready for navigation')
      })
      .catch((error) => {
        // Prefetch failure is not critical - dashboard will fetch on mount anyway
        console.warn('[PREFETCH] ⚠️ Dashboard prefetch failed (non-critical):', error)
      })
  }

  const validationSchema = isPasswordResetMode ? resetPasswordFormSchema : (isEditMode ? editUserSchema : createUserSchema)

  const defaultValues: UserFormValues = isEditMode && editingUser ? {
    firstName: editingUser?.first_name || "",
    middleName: editingUser?.middle_name || "",
    lastName: editingUser?.last_name || "",
    email: editingUser?.email || "",
    password: "", // Passwords are not pre-filled for security
    confirmPassword: "",
    mobileNo: editingUser?.mobile_no || "",
    dateOfBirth: editingUser?.date_of_birth || "",
    sex: getValidSex(editingUser?.sex),
    role: (editingUser?.role as "admin" | "moderator" | "employee") || "employee",
    designationId: editingUser?.designation_id || "",
    allowedModules: editingUser?.allowed_modules || [],
  } : {
    firstName: "",
    middleName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
    mobileNo: "",
    dateOfBirth: "",
    sex: "" as const,
    role: "employee",
    designationId: "",
    allowedModules: [],
  }

  const form = useForm<UserFormValues>({
    resolver: zodResolver(validationSchema) as Resolver<UserFormValues>,
    defaultValues,
    mode: "onChange"
  })

  // Cleanup timeouts on component unmount
  useEffect(() => {
    isMounted.current = true
    return () => {
      isMounted.current = false
      clearTimeouts()
    }
  }, [])

  // Reset form when editingUser changes
  useEffect(() => {
    if (isEditMode && editingUser) {
      form.reset({
        firstName: editingUser?.first_name || "",
        middleName: editingUser?.middle_name || "",
        lastName: editingUser?.last_name || "",
        email: editingUser?.email || "",
        mobileNo: editingUser?.mobile_no || "",
        dateOfBirth: editingUser?.date_of_birth || "",
        sex: getValidSex(editingUser?.sex),
        role: (editingUser?.role as "admin" | "moderator" | "employee") || "employee",
        designationId: editingUser?.designation_id || "",
        allowedModules: editingUser?.allowed_modules || [],
        password: "",
        confirmPassword: ""
      })
    }
  }, [isEditMode, editingUser, form])

  // TRPC mutation for password reset
  const resetPasswordMutation = trpc.admin.users.resetPassword.useMutation({
    onSuccess: async () => {
      console.log('🔒 Password reset successfully')
      setIsSuccess(true)
      setSubmitError(null)

      // No need to invalidate list or dashboard cache for password reset as it doesn't change visible data
      // But we call broadcastCacheInvalidation to be safe regarding session checks
      broadcastCacheInvalidation()

      if (successTimeout) {
        clearTimeout(successTimeout)
      }

      const timeout = setTimeout(() => {
        setIsSuccess(false)
        form.reset()

        if (useSheet) {
          handleOpenChange(false)
        }

        setTimeout(() => {
          onSuccess?.()
        }, 150)

      }, 2000)

      setSuccessTimeout(timeout)
    },
    onError: (error) => {
      setIsSuccess(false)
      setSubmitError(error.message || 'Failed to reset password')
      toast.error(error.message || 'Failed to reset password')

      if (errorTimeout) {
        clearTimeout(errorTimeout)
      }

      const timeout = setTimeout(() => {
        setSubmitError(null)
      }, 5000)

      setErrorTimeout(timeout)
    }
  })

  // TRPC mutation for creating user
  const createUserMutation = trpc.admin.users.createUser.useMutation({
    onSuccess: async (result) => {
      setIsSuccess(true)
      setSubmitError(null)

      try {
        // Invalidate user list to refresh data (user management list)
        utils.admin.users.getUsers.invalidate()

        // SMART CACHE INVALIDATION - Now invalidates both server and client caches
        // Don't await this to avoid blocking the UI
        invalidateDashboardCache()

        // ENHANCED EVENT BROADCASTING: Broadcast user creation event to other admin browsers
        try {
          const eventBroadcaster = getEventBroadcaster()
          // Fix: result is the profile object directly, not { user: ... }
          const userId = result.id || 'unknown'
          const userEmail = result.email || form.getValues().email

          eventBroadcaster.broadcastEvent('user_created', {
            userId: userId,
            email: userEmail,
            fullName: `${form.getValues().firstName} ${form.getValues().lastName}`,
            createdBy: 'current-admin', // TODO: Get actual admin ID from auth context
            createdByName: 'Current Admin', // TODO: Get actual admin name from auth context
            userRole: form.getValues().role as "user" | "admin"
          }, {
            priority: 'critical',
            metadata: {
              source: 'user-management-form',
              operation: 'user-creation',
              timestamp: new Date().toISOString()
            }
          }).then(() => {
            console.log('✅ User creation event broadcasted successfully to other admin browsers')
          }).catch(err => console.warn('⚠️ Failed to broadcast user creation event:', err))

        } catch (eventError) {
          console.warn('⚠️ Failed to broadcast user creation event:', eventError)
          // Don't fail the entire operation if event broadcasting fails
        }

        // PREFETCH: Load fresh dashboard data into cache so it's ready when user navigates back
        prefetchDashboardData()

        if (refetch) {
          refetch()
        }

        console.log('🎯 CREATE USER COMPLETE: Caches cleared, event broadcasted, and dashboard data prefetched')
      } catch (error) {
        console.error("Error during success background tasks:", error)
      }

      // Clear any existing success timeout and set a new one
      if (successTimeout) {
        clearTimeout(successTimeout)
      }

      // Reduced timeout to 2s for snappier experience
      const timeout = setTimeout(() => {
        setIsSuccess(false)
        form.reset()

        // Auto-close sheet after showing success state, then call onSuccess
        if (useSheet) {
          handleOpenChange(false)
        }

        // Small delay to ensure sheet closes before calling onSuccess (which might trigger refresh)
        setTimeout(() => {
          onSuccess?.()
        }, 150)

      }, 2000)

      setSuccessTimeout(timeout)
    },
    onError: (error) => {
      setIsSuccess(false)

      let errorMessage = 'Failed to create user'

      // Enhanced error message handling
      if (error.message.includes('already exists')) {
        errorMessage = 'A user with this email already exists'
      } else if (error.message.includes('Failed to create auth user')) {
        errorMessage = 'Failed to create authentication user. Please check the email format.'
      } else if (error.message.includes('Profile creation error')) {
        errorMessage = 'Failed to create user profile. Please try again.'
      } else if (error.message.includes('invalid input syntax for type date') || error.message.includes('invalid_date')) {
        errorMessage = 'Please enter a valid date of birth or leave it blank'
      } else if (error.message.includes('Invalid email')) {
        errorMessage = 'Please enter a valid email address'
      } else if (error.message.includes('Password')) {
        errorMessage = error.message // Use the schema-specific password message
      } else if (error.message.includes('mobile')) {
        errorMessage = 'Please enter a valid mobile number format'
      } else if (error.message) {
        errorMessage = error.message
      }

      setSubmitError(errorMessage)
      toast.error(errorMessage)

      // Clear any existing error timeout and set a new one
      if (errorTimeout) {
        clearTimeout(errorTimeout)
      }

      // Reset button state to idle after 5 seconds to allow retry
      const timeout = setTimeout(() => {
        setSubmitError(null)
      }, 5000)

      setErrorTimeout(timeout)
    },
  })

  // Mutation for profile update (non-admin)
  const updateProfileMutation = trpc.profile.update.useMutation({
    onSuccess: () => {
      handleSuccess()
    },
    onError: (error) => {
      handleError(error)
    }
  })

  // TRPC mutation for updating user (admin only)
  const updateUserMutation = trpc.admin.users.updateUser.useMutation({
    onSuccess: () => {
      handleSuccess()
    },
    onError: (error) => {
      handleError(error)
    }
  })

  // Shared handlers for success/error to keep code DRY
  function handleSuccess() {
    if (!isMounted.current) return
    setIsSuccess(true)
    setSubmitError(null)

    // Invalidate user list if not in profile mode
    if (!isProfileMode) {
      utils.admin.users.getUsers.invalidate()
    } else {
      utils.profile.get.invalidate()
    }

    // SMART CACHE INVALIDATION
    invalidateDashboardCache()

    // PREFETCH
    prefetchDashboardData()

    if (refetch) refetch()

    if (successTimeout) clearTimeout(successTimeout)

    const timeout = setTimeout(() => {
      if (!isMounted.current) return
      setIsSuccess(false)
      form.reset()
      if (useSheet) handleOpenChange(false)
      setTimeout(() => {
        if (isMounted.current) onSuccess?.(dirtyFieldsRef.current)
      }, 150)
    }, 2500)

    setSuccessTimeout(timeout)
  }

  function handleError(error: { message: string }) {
    if (!isMounted.current) return
    setIsSuccess(false)
    let errorMessage = 'Failed to update'
    if (error.message.includes('already exists')) {
      errorMessage = 'A user with this email already exists'
    } else if (error.message.includes('invalid input syntax for type date')) {
      errorMessage = 'Please enter a valid date of birth'
    } else if (error.message) {
      errorMessage = error.message
    }
    setSubmitError(errorMessage)
    toast.error(errorMessage)
    if (errorTimeout) clearTimeout(errorTimeout)
    const timeout = setTimeout(() => {
      if (isMounted.current) setSubmitError(null)
    }, 5000)
    setErrorTimeout(timeout)
  }


  // TRPC mutation for deleting user
  const deleteUserMutation = trpc.admin.users.deleteUser.useMutation({
    onSuccess: async () => {
      console.log('[USER-DELETE] User deleted successfully, starting cache invalidation...')
      setIsSuccess(true)
      setSubmitError(null)

      // Invalidate user list to refresh data (user management list)
      console.log('[USER-DELETE] Invalidating getUsers cache...')
      await utils.admin.users.getUsers.invalidate()

      // SMART CACHE INVALIDATION - Now invalidates both server and client caches
      // This is the critical step that ensures dashboard shows updated user count
      console.log('[USER-DELETE] Invalidating dashboard caches (server + client)...')
      invalidateDashboardCache()

      // Explicitly invalidate the unified dashboard data to ensure fresh fetch
      console.log('[USER-DELETE] Explicitly invalidating getUnifiedDashboardData...')
      await utils.admin.dashboard.getUnifiedDashboardData.invalidate()

      // PREFETCH: Load fresh dashboard data into cache so it's ready when user navigates back
      // This prevents the "flash of old data" issue when returning to dashboard
      console.log('[USER-DELETE] Prefetching fresh dashboard data...')
      await prefetchDashboardData()

      if (refetch) {
        refetch()
      }

      console.log('[USER-DELETE] ✅ All caches invalidated and dashboard data prefetched - ready for navigation')

      // Clear any existing success timeout and set a new one
      if (successTimeout) {
        clearTimeout(successTimeout)
      }

      const timeout = setTimeout(() => {
        setIsSuccess(false)
        form.reset()

        // Auto-close sheet after showing success state, then call onSuccess
        if (useSheet) {
          handleOpenChange(false)
        }

        // Small delay to ensure sheet closes before calling onSuccess (which might trigger refresh)
        setTimeout(() => {
          onSuccess?.()
        }, 150)

      }, 2500)

      setSuccessTimeout(timeout)
    },
    onError: (error) => {
      setIsSuccess(false)
      setSubmitError(error.message || 'Failed to delete user')
      toast.error(error.message || 'Failed to delete user')

      if (errorTimeout) {
        clearTimeout(errorTimeout)
      }

      const timeout = setTimeout(() => {
        setSubmitError(null)
      }, 5000)

      setErrorTimeout(timeout)
    },
  })

  // Force isPending to false if we are in success state to ensure UI updates immediately
  const isPending = (createUserMutation.isPending || updateUserMutation.isPending || deleteUserMutation.isPending || resetPasswordMutation.isPending) && !isSuccess

  const onSubmit = async (data: UserFormValues): Promise<void> => {
    setSubmitError(null)

    try {
      if (isDeleteMode && editingUser) {
        await deleteUserMutation.mutateAsync({ userId: editingUser.id })
      } else if (isPasswordResetMode && editingUser) {
        // Reset password mode
        if (!data.password || !data.confirmPassword) {
          throw new Error("Password and confirm password are required")
        }
        await resetPasswordMutation.mutateAsync({
          userId: editingUser.id,
          password: data.password
        })
      } else if (isEditMode && editingUser) {
        // Prepare data
        const editData = {
          firstName: data.firstName,
          middleName: data.middleName ?? '',
          lastName: data.lastName,
          email: data.email,
          mobileNo: data.mobileNo ?? '',
          dateOfBirth: data.dateOfBirth,
          sex: data.sex as "male" | "female",
        }

        if (isProfileMode) {
          // Use profile mutation for own profile
          await updateProfileMutation.mutateAsync(editData)
        } else {
          // Use admin mutation for other users
          await updateUserMutation.mutateAsync({
            ...editData,
            userId: editingUser.id,
            role: data.role as "admin" | "moderator" | "employee",
            designationId: (data.designationId as string) || null,
            allowedModules: data.role === 'employee' ? data.allowedModules : [],
          })
        }

      } else {
        // Use create mutation for create mode
        const createData: CreateUserInput = {
          firstName: data.firstName,
          middleName: data.middleName ?? '',
          lastName: data.lastName,
          email: data.email,
          password: data.password!,
          confirmPassword: data.confirmPassword!,
          mobileNo: data.mobileNo ?? '',
          dateOfBirth: data.dateOfBirth,
          sex: data.sex as "male" | "female",
          role: data.role as "admin" | "moderator" | "employee",
          designationId: data.designationId as string, // Added designationId
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          allowedModules: data.role === 'employee' ? (data.allowedModules as any) : [],
        }
        await createUserMutation.mutateAsync(createData)
      }
    } catch (error) {
      // Error handling is done in onError callbacks of mutations
      console.error("Form submission error:", error)
    }
  }

  const handleFormSubmit = async () => {
    if (!isDeleteMode && !isPasswordResetMode) {
      const isValid = await form.trigger()
      if (!isValid) {
        // Don't throw error, just return to let the form show validation errors
        return
      }
    } else if (isPasswordResetMode) {
      // Validate only password fields for reset mode
      const isValid = await form.trigger(["password", "confirmPassword"])
      if (!isValid) return
    }

    // Capture dirty fields before submission
    const dirtyFields = Object.keys(form.formState.dirtyFields)
    dirtyFieldsRef.current = dirtyFields

    await onSubmit(form.getValues())
  }

  const handleCancel = () => {
    clearTimeouts()
    form.reset()
    setSubmitError(null)
    setIsSuccess(false)
    if (useSheet) {
      handleOpenChange(false)
    } else {
      onCancel?.()
    }
  }

  // Get dynamic title and icon based on mode
  const dynamicTitle = isDeleteMode ? "Delete User" : isPasswordResetMode ? "Reset Password" : isEditMode ? "Edit User" : title
  const dynamicDescription = isDeleteMode
    ? "Are you sure you want to delete this user? This action cannot be undone."
    : isPasswordResetMode
      ? "Set a new password for this user. The user will be required to log in with the new password."
      : isEditMode
        ? "Update user information and access permissions"
        : description

  const FormIcon = isDeleteMode ? Trash2 : isPasswordResetMode ? Key : isEditMode ? Edit : UserPlus
  const buttonText = isDeleteMode ? "Delete User" : isPasswordResetMode ? "Reset Password" : isEditMode ? "Update User" : "Create User"

  // If using sheet, wrap in Sheet component
  if (useSheet) {
    return (
      <Sheet open={isOpen} onOpenChange={handleOpenChange}>
        <SheetContent className="w-full sm:max-w-2xl flex flex-col">
          {showDefaultHeader && (
            <div className="flex-shrink-0 px-4 sm:px-6 border-b border-border/80 pb-3">
              <SheetHeader className="text-left pb-0">
                <SheetTitle className="flex items-center gap-3 text-xl font-bold py-1">
                  <div className={cn(
                    "p-2 rounded-lg",
                    isDeleteMode ? "bg-destructive/10" : isPasswordResetMode ? "bg-amber-100" : isEditMode ? "bg-purple-100" : "bg-blue-100"
                  )}>
                    <FormIcon className={cn(
                      "h-6 w-6",
                      isDeleteMode ? "text-destructive" : isPasswordResetMode ? "text-amber-600" : isEditMode ? "text-purple-600" : "text-blue-600"
                    )} />
                  </div>
                  <div className="flex flex-col">
                    <span className={cn(
                      "leading-tight",
                      isDeleteMode ? "text-destructive" : isPasswordResetMode ? "text-amber-700" : isEditMode ? "text-purple-700" : "text-blue-700"
                    )}>{dynamicTitle}</span>
                    <span className="text-xs font-medium text-muted-foreground mt-0 leading-tight">
                      {dynamicDescription}
                    </span>
                  </div>
                </SheetTitle>
              </SheetHeader>
            </div>
          )}

          <div className="flex-1 overflow-y-auto mt-0">
            <FormContent
              form={form}
              isEditMode={isEditMode}
              isSubmitting={isPending}
              isSuccess={isSuccess}
              submitError={submitError}
              onCancel={handleCancel}
              onSubmit={handleFormSubmit}
              buttonText={buttonText}
              useSheet={useSheet}
              isDeleteMode={isDeleteMode}
              isProfileMode={isProfileMode}
              isPasswordResetMode={isPasswordResetMode}
            />
          </div>
        </SheetContent>
      </Sheet>
    )
  }

  // Regular form content (without sheet)
  return (
    <FormContent
      form={form}
      isEditMode={isEditMode}
      isSubmitting={isPending}
      isSuccess={isSuccess}
      submitError={submitError}
      onCancel={handleCancel}
      onSubmit={handleFormSubmit}
      buttonText={buttonText}
      className={className}
      useSheet={useSheet}
      isDeleteMode={isDeleteMode}
      isProfileMode={isProfileMode}
      isPasswordResetMode={isPasswordResetMode}
    />
  )
}
