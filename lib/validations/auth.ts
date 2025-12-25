import * as z from "zod"

export const loginSchema = z.object({
  email: z
    .string()
    .min(1, "Email is required.")
    .email("Please enter a valid email."),
  password: z
    .string()
    .min(6, "Password must be at least 6 characters.")
})

export type LoginInput = z.infer<typeof loginSchema>

// Authentication error types for granular error handling
export type AuthErrorType = 'both' | 'email' | 'password' | 'network' | 'unknown'

export interface AuthValidationResult {
  isValid: boolean
  errorType?: AuthErrorType
  fieldErrors?: {
    email?: string
    password?: string
  }
  generalError?: string
}

export const profileUpdateSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(50).optional(),
  lastName: z.string().min(1, 'Last name is required').max(50).optional(),
  middleName: z.string().max(50).optional().or(z.literal('')),
  full_name: z.string().min(2, 'Name must be at least 2 characters').max(100).optional(),
  avatar_url: z.string().url('Invalid URL').optional().or(z.literal('')),
  mobileNo: z.string().regex(/^\d{10}$/, 'Mobile number must be exactly 10 digits').optional().or(z.literal('')),
  dateOfBirth: z.string().optional().or(z.literal('')),
  sex: z.enum(['male', 'female']).optional(),
})


export const designationSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  description: z.string().max(500).optional().or(z.literal('')),
  role: z.enum(['admin', 'moderator', 'employee'], {
    message: "Invalid role selected",
  }),
})

export type DesignationInput = z.infer<typeof designationSchema>

export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>

// Password strength validation
export const validatePasswordStrength = (password: string) => {
  const criteria = {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    numbers: /\d/.test(password),
    special: /[!@#$%^&*(),.?":{}|<>]/.test(password),
  }

  const strength = Object.values(criteria).filter(Boolean).length
  let level: 'weak' | 'fair' | 'good' | 'strong' = 'weak'

  if (strength >= 4 && criteria.length && criteria.uppercase && criteria.lowercase) {
    level = 'strong'
  } else if (strength >= 3 && criteria.length) {
    level = 'good'
  } else if (strength >= 2 && criteria.length) {
    level = 'fair'
  }

  return {
    isValid: criteria.length && strength >= 3,
    criteria,
    strength,
    level,
  }
}

export const passwordValidation = z.string()
  .min(8, 'Password must be at least 8 characters')
  .refine((password) => {
    const { isValid } = validatePasswordStrength(password)
    return isValid
  }, {
    message: 'Password must be at least 8 characters and meet at least 3 of the following criteria: uppercase letter, lowercase letter, number, special character',
  })

export const createUserSchema = z.object({
  email: z.string()
    .min(1, 'Email is required')
    .email('Invalid email address'),
  password: passwordValidation,
  firstName: z.string().min(1, 'First name is required').max(50, 'First name too long'),
  middleName: z.string().max(50, 'Middle name too long').optional().or(z.literal('')),
  lastName: z.string().min(1, 'Last name is required').max(50, 'Last name too long'),
  mobileNo: z.string()
    .min(1, 'Mobile No is required')
    .regex(/^\d{10}$/, 'Mobile number must be exactly 10 digits'),
  dateOfBirth: z.string()
    .min(1, 'Date of birth is required')
    .refine((val) => {
      if (!val) return false
      const date = new Date(val)
      const now = new Date()
      const age = now.getFullYear() - date.getFullYear()
      return date <= now && age >= 13 && age <= 120
    }, { message: 'Please enter a valid date of birth (13-120 years old)' }),
  role: z.enum(['admin', 'moderator', 'employee'], {
    message: 'Select User Role'
  }),
  allowedModules: z.array(z.enum(['dashboard', 'users', 'reports', 'settings', 'analytics', 'notifications', 'billing', 'profile'])).optional(),
  designationId: z.string().uuid("Designation is required"),
  sex: z.enum(['male', 'female']).or(z.literal('')).refine((val) => val !== '', {
    message: 'Sex is required'
  }),
  confirmPassword: z.string().min(1, 'Please confirm your password'),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
})

export type CreateUserInput = z.infer<typeof createUserSchema>

// Schema for editing existing users (without password requirement)
export const editUserSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(50, 'First name too long'),
  middleName: z.string().max(50, 'Middle name too long').optional().or(z.literal('')),
  lastName: z.string().min(1, 'Last name is required').max(50, 'Last name too long'),
  email: z.string()
    .min(1, 'Email is required')
    .email('Invalid email address'),
  mobileNo: z.string()
    .min(1, 'Mobile No is required')
    .regex(/^\d{10}$/, 'Mobile number must be exactly 10 digits'),
  dateOfBirth: z.string()
    .min(1, 'Date of birth is required')
    .refine((val) => {
      if (!val) return false
      const date = new Date(val)
      const now = new Date()
      const age = now.getFullYear() - date.getFullYear()
      return date <= now && age >= 13 && age <= 120
    }, { message: 'Please enter a valid date of birth (13-120 years old)' }),
  role: z.enum(['admin', 'moderator', 'employee'], {
    message: 'Select User Role'
  }),
  allowedModules: z.array(z.enum(['dashboard', 'users', 'reports', 'settings', 'analytics', 'notifications', 'billing', 'profile'])).optional(),
  designationId: z.string().uuid("Designation is required"),
  sex: z.enum(['male', 'female']).or(z.literal('')).refine((val) => val !== '', {
    message: 'Sex is required'
  }),
})

export type EditUserInput = z.infer<typeof editUserSchema>

export type PasswordStrength = {
  isValid: boolean
  criteria: {
    length: boolean
    uppercase: boolean
    lowercase: boolean
    numbers: boolean
    special: boolean
  }
  strength: number
  level: 'weak' | 'fair' | 'good' | 'strong'
}

export const validatePasswordStrengthFn = (password: string): PasswordStrength => {
  return validatePasswordStrength(password)
}

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: passwordValidation,
  confirmPassword: z.string().min(1, "Please confirm your new password"),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
}).refine((data) => data.currentPassword !== data.newPassword, {
  message: "New password must be different from current password",
  path: ["newPassword"],
})

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>

// Base fields for password reset (used in both form and API)
const resetPasswordFields = {
  password: passwordValidation,
  confirmPassword: z.string().min(1, 'Please confirm your password'),
}

// Refinement for password matching
const passwordMatchRefine = (data: { password: string; confirmPassword: string }) => data.password === data.confirmPassword
const passwordMatchParams = {
  message: "Passwords don't match",
  path: ["confirmPassword"],
}

// Schema for the UI Form (no userId, as it's not in the form inputs)
export const resetPasswordFormSchema = z.object(resetPasswordFields)
  .refine(passwordMatchRefine, passwordMatchParams)

// Schema for the API Mutation (includes userId)
export const resetPasswordSchema = z.object({
  userId: z.string().uuid(),
  ...resetPasswordFields
}).refine(passwordMatchRefine, passwordMatchParams)

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>
