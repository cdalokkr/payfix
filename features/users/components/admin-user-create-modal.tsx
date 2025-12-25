"use client"

import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { createUserSchema, type CreateUserInput } from '@/lib/validations/auth'
import AsyncButton from '@/components/ui/async-button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/ui/password-input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { trpc } from '@/lib/trpc/client'
import toast from 'react-hot-toast'
import { UserPlus } from 'lucide-react'

interface AdminUserCreateModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export function AdminUserCreateModal({ open, onOpenChange, onSuccess }: AdminUserCreateModalProps) {
  const utils = trpc.useUtils()
  const firstInputRef = useRef<HTMLInputElement>(null)
  const [isLoading, setIsLoading] = useState(false)

  const {
    register,
    setValue,
    watch,
    reset,
    getValues,
    trigger,
    formState: { errors },
  } = useForm<CreateUserInput>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      role: 'employee',
    },
  })

  // Focus management: set focus to first input when modal opens
  useEffect(() => {
    if (open && firstInputRef.current) {
      setTimeout(() => firstInputRef.current?.focus(), 100)
    }
  }, [open])

  // Focus management: return focus to trigger when modal closes
  useEffect(() => {
    if (!open) {
      // Find the trigger element that opened this modal
      const trigger = document.querySelector('[data-state="closed"][data-slot="dialog-trigger"]') as HTMLElement
      if (trigger) {
        setTimeout(() => trigger.focus(), 100)
      }
    }
  }, [open])

  const createUserMutation = trpc.admin.users.createUser.useMutation({
    onSuccess: () => {
      toast.success('User created successfully!')
      reset()
      // Invalidate and refetch user-related queries
      utils.admin.users.getUsers.invalidate()
      utils.admin.dashboard.getUnifiedDashboardData.invalidate()
      // Close modal after a short delay to allow success state to be visible
      setTimeout(() => {
        onOpenChange(false)
        onSuccess?.()
        setIsLoading(false)
      }, 1000)
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to create user')
      setIsLoading(false)
    },
  })

  const onSubmit = async (data: CreateUserInput) => {
    setIsLoading(true)
    await createUserMutation.mutateAsync(data)
  }

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      reset()
    }
    onOpenChange(newOpen)
  }

  // Keyboard navigation: handle Escape to close and Tab navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleOpenChange(false)
    }
    // Tab navigation within modal
    if (e.key === 'Tab') {
      const modal = e.currentTarget as HTMLElement
      const focusableElements = modal.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
      const firstElement = focusableElements[0] as HTMLElement
      const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          lastElement.focus()
          e.preventDefault()
        }
      } else {
        if (document.activeElement === lastElement) {
          firstElement.focus()
          e.preventDefault()
        }
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="sm:max-w-[425px] max-h-[90vh] overflow-y-auto p-4 sm:p-6"
        onKeyDown={handleKeyDown}
        role="dialog"
        aria-labelledby="create-user-title"
        aria-describedby="create-user-description"
      >
        <DialogHeader>
          <DialogTitle id="create-user-title">Create New User</DialogTitle>
          <DialogDescription id="create-user-description">
            Add a new user to the system. They will receive an email invitation to set up their account.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
          {/* Row 1: Email, Password, First Name */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email Address *</Label>
              <Input
                id="email"
                type="email"
                placeholder="user@example.com"
                {...register('email')}
                aria-describedby={errors.email ? "email-error" : undefined}
                disabled={isLoading}
              />
              {errors.email && (
                <p id="email-error" className="text-sm text-red-600 dark:text-red-400" role="alert">
                  {errors.email.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password *</Label>
              <PasswordInput
                id="password"
                placeholder="Minimum 8 characters"
                {...register('password')}
                disabled={isLoading}
              />
              {errors.password && (
                <p id="password-error" className="text-sm text-red-600 dark:text-red-400" role="alert">
                  {errors.password.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="firstName">First Name *</Label>
              <Input
                id="firstName"
                type="text"
                placeholder="John"
                {...register('firstName')}
                aria-describedby={errors.firstName ? "firstName-error" : undefined}
                disabled={isLoading}
              />
              {errors.firstName && (
                <p id="firstName-error" className="text-sm text-red-600 dark:text-red-400" role="alert">
                  {errors.firstName.message}
                </p>
              )}
            </div>
          </div>

          {/* Row 2: Last Name, Mobile Number, Date of Birth */}
          <div className="col-span-2">
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name *</Label>
                <Input
                  id="lastName"
                  type="text"
                  placeholder="Doe"
                  {...register('lastName')}
                  aria-describedby={errors.lastName ? "lastName-error" : undefined}
                  disabled={isLoading}
                />
                {errors.lastName && (
                  <p id="lastName-error" className="text-sm text-red-600 dark:text-red-400" role="alert">
                    {errors.lastName.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="mobileNo">Mobile Number</Label>
                <Input
                  id="mobileNo"
                  type="tel"
                  placeholder="+1234567890"
                  {...register('mobileNo')}
                  aria-describedby={errors.mobileNo ? "mobileNo-error" : undefined}
                  disabled={isLoading}
                />
                {errors.mobileNo && (
                  <p id="mobileNo-error" className="text-sm text-red-600 dark:text-red-400" role="alert">
                    {errors.mobileNo.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="dateOfBirth">Date of Birth</Label>
                <Input
                  id="dateOfBirth"
                  type="date"
                  {...register('dateOfBirth')}
                  aria-describedby={errors.dateOfBirth ? "dateOfBirth-error" : undefined}
                  disabled={isLoading}
                />
                {errors.dateOfBirth && (
                  <p id="dateOfBirth-error" className="text-sm text-red-600 dark:text-red-400" role="alert">
                    {errors.dateOfBirth.message}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Row 3: Role */}
          <div className="col-span-2">
            <div className="space-y-2">
              <Label htmlFor="role">Role *</Label>
              <Select
                value={watch('role')}
                onValueChange={(value: 'admin' | 'employee') => setValue('role', value)}
                disabled={isLoading}
              >
                <SelectTrigger aria-describedby={errors.role ? "role-error" : undefined}>
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="employee">Employee</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
              {errors.role && (
                <p id="role-error" className="text-sm text-red-600 dark:text-red-400" role="alert">
                  {errors.role.message}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="col-span-1 sm:col-span-2 lg:col-span-3 max-w-full flex justify-start">
              <AsyncButton
                onClick={async () => {
                  const isValid = await trigger()
                  if (!isValid) {
                    throw new Error('Please check your input')
                  }
                  const data = getValues()
                  await onSubmit(data)
                }}
                onStateChange={(state) => {
                  // Simple state change handler - no complex setTimeout chains
                  if (state === 'loading') {
                    setIsLoading(true)
                  } else if (state === 'error') {
                    setIsLoading(false)
                  }
                  // Success state is handled by the mutation's onSuccess callback
                }}
                loadingText="Adding users..."
                successText="Users added!"
                errorText="Failed to add users"
                successDuration={2000}
                autoReset={true}
                className="w-full group bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <span className="inline-flex items-center justify-center p-1 rounded-full bg-primary/20 mr-2 transition-colors duration-300 group-hover:bg-primary/30">
                  <UserPlus className="h-4 w-4 text-primary-foreground" />
                </span>
                Add Users
              </AsyncButton>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}