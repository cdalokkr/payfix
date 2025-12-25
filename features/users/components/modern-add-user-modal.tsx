"use client"

import { useEffect, useRef, useState, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { createUserSchema, type CreateUserInput } from '@/lib/validations/auth'
import { SimpleModal } from '@/components/ui/SimpleModal'
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
import { cn } from '@/lib/utils'
import {
  UserPlus,
  Mail,
  User,
  Shield,
  AlertCircle,
  Phone,
  Calendar
} from 'lucide-react'

interface ModernAddUserModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export function ModernAddUserModal({ open, onOpenChange, onSuccess }: ModernAddUserModalProps) {
  const utils = trpc.useUtils()
  const emailInputRef = useRef<HTMLInputElement>(null)
  const [isSuccess, setIsSuccess] = useState(false)

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

  // Handle email registration with proper ref management
  const emailField = register('email', {
    setValueAs: (value) => value || '', // Convert undefined/empty to empty string
  })

  // Focus management: set focus to first input when modal opens
  useEffect(() => {
    if (open && emailInputRef.current) {
      setTimeout(() => emailInputRef.current?.focus(), 150)
    }
  }, [open])

  // Create user mutation with proper state management
  const createUserMutation = trpc.admin.users.createUser.useMutation({
    onSuccess: () => {
      console.log('User created successfully')
      toast.success('User created successfully!')
      // Invalidate and refetch user-related queries
      utils.admin.users.getUsers.invalidate()
      utils.admin.dashboard.getUnifiedDashboardData.invalidate()
      // Trigger success callback
      onSuccess?.()
    },
    onError: (error) => {
      console.error('Failed to create user:', error)

      // Handle specific error cases
      let errorMessage = 'Failed to create user'

      if (error.message.includes('already exists')) {
        errorMessage = 'A user with this email already exists'
      } else if (error.message.includes('Failed to create auth user')) {
        errorMessage = 'Failed to create authentication user'
      } else if (error.message.includes('Profile creation error')) {
        errorMessage = 'Failed to create user profile'
      } else if (error.message) {
        errorMessage = error.message
      }

      toast.error(errorMessage)
      // Re-throw error to let SimpleAsyncButton handle it
      throw new Error(errorMessage)
    },
  })

  // Handle form submission with manual async button integration
  const handleSubmit = useCallback(async () => {
    console.log('Starting form validation')
    const isValid = await trigger()

    if (!isValid) {
      console.log('Form validation failed')
      toast.error('Please check your input and try again')
      throw new Error('Validation failed')
    }

    const data = getValues()
    console.log('Form data validated, submitting:', data)

    await createUserMutation.mutateAsync(data)
    console.log('User creation completed successfully')
  }, [trigger, getValues, createUserMutation])

  return (
    <SimpleModal
      isOpen={open}
      onOpenChange={onOpenChange}
      title="Create New User"
      description="Add a new user to the system. They will receive an email invitation to set up their account."
      onSubmit={handleSubmit}
      submitText="Create User"
      submitLoadingText="Creating..."
      submitSuccessText="User created successfully!"
      autoCloseDuration={1500}
      showCancelButton={true}
      cancelText="Cancel"
      size="lg"
      className="max-w-4xl"
    >
      <form className="space-y-6">

        {/* Personal Information Section */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b">
            <User className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide text-left">
              Personal Information
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName" className="text-sm font-medium">
                First Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="firstName"
                type="text"
                placeholder="John"
                className="h-10"
                {...register('firstName')}
                aria-describedby={errors.firstName ? "firstName-error" : undefined}
              />
              {errors.firstName && (
                <div className="flex items-center gap-2 text-sm text-red-600" id="firstName-error">
                  <AlertCircle className="h-3 w-3" />
                  {errors.firstName.message}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="lastName" className="text-sm font-medium">
                Last Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="lastName"
                type="text"
                placeholder="Doe"
                className="h-10"
                {...register('lastName')}
                aria-describedby={errors.lastName ? "lastName-error" : undefined}
              />
              {errors.lastName && (
                <div className="flex items-center gap-2 text-sm text-red-600" id="lastName-error">
                  <AlertCircle className="h-3 w-3" />
                  {errors.lastName.message}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="mobileNo" className="text-sm font-medium">
                Mobile Number
              </Label>
              <Input
                id="mobileNo"
                type="tel"
                placeholder="+1234567890"
                className="h-10"
                {...register('mobileNo')}
                aria-describedby={errors.mobileNo ? "mobileNo-error" : undefined}
              />
              {errors.mobileNo && (
                <div className="flex items-center gap-2 text-sm text-red-600" id="mobileNo-error">
                  <AlertCircle className="h-3 w-3" />
                  {errors.mobileNo.message}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="dateOfBirth" className="text-sm font-medium">
                Date of Birth
              </Label>
              <Input
                id="dateOfBirth"
                type="date"
                className="h-10"
                {...register('dateOfBirth')}
                aria-describedby={errors.dateOfBirth ? "dateOfBirth-error" : undefined}
              />
              {errors.dateOfBirth && (
                <div className="flex items-center gap-2 text-sm text-red-600" id="dateOfBirth-error">
                  <AlertCircle className="h-3 w-3" />
                  {errors.dateOfBirth.message}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Email and Password Section */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide text-left">
              Account Credentials
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium">
                Email Address <span className="text-destructive">*</span>
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="user@example.com"
                className="h-10"
                autoComplete="off"
                {...emailField}
                ref={(el: HTMLInputElement | null) => {
                  emailInputRef.current = el
                  emailField.ref(el)
                }}
                aria-describedby={errors.email ? "email-error" : undefined}
              />
              {errors.email && (
                <div className="flex items-center gap-2 text-sm text-red-600" id="email-error">
                  <AlertCircle className="h-3 w-3" />
                  {errors.email.message}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium">
                Password <span className="text-destructive">*</span>
              </Label>
              <PasswordInput
                id="password"
                placeholder="Minimum 8 characters"
                className="h-10"
                autoComplete="off"
                {...register('password')}
                aria-describedby={errors.password ? "password-error" : undefined}
              />
              {errors.password && (
                <div className="flex items-center gap-2 text-sm text-red-600" id="password-error">
                  <AlertCircle className="h-3 w-3" />
                  {errors.password.message}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Role Selection Section */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b">
            <Shield className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide text-left">
              Access & Permissions
            </h3>
          </div>

          <div className="space-y-2">
            <Label htmlFor="role" className="text-sm font-medium">
              User Role <span className="text-destructive">*</span>
            </Label>
            <Select
              value={watch('role')}

              onValueChange={(value: 'admin' | 'employee') => setValue('role', value)}
            >
              <SelectTrigger className="h-10" aria-describedby={errors.role ? "role-error" : undefined}>
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="employee">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    <div>
                      <div className="font-medium">Standard Employee</div>
                      <div className="text-xs text-muted-foreground">Basic access to system features</div>
                    </div>
                  </div>
                </SelectItem>
                <SelectItem value="admin">
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    <div>
                      <div className="font-medium">Administrator</div>
                      <div className="text-xs text-muted-foreground">Full access and management rights</div>
                    </div>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            {errors.role && (
              <div className="flex items-center gap-2 text-sm text-red-600" id="role-error">
                <AlertCircle className="h-3 w-3" />
                {errors.role.message}
              </div>
            )}
          </div>
        </div>
      </form>
    </SimpleModal>
  )
}