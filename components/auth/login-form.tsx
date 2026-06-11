"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { loginSchema, type LoginInput } from "@/lib/validations/auth"
import { Mail, Lock, AlertCircle } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"

import { LoginButton } from "@/components/ui/async-button"
import { Input } from "@/components/ui/input"
import { PasswordInput } from "@/components/ui/password-input"
import {
  Field,
  FieldLabel,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldSet,
} from "@/components/ui/field"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { trpc } from "@/lib/trpc/client"



export function LoginForm() {
  const router = useRouter()
  const utils = trpc.useUtils()
  const [isLoading, setIsLoading] = useState(false)
  const [asyncState, setAsyncState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [authError, setAuthError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({})



  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
    mode: "onChange"
  })

  const loginMutation = trpc.auth.login.useMutation({
    onMutate: () => {
      setAsyncState('loading')
      // Pre-warm geolocation in background right after submission (if permitted previously)
      if (typeof window !== 'undefined' && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const coords = {
              lat: pos.coords.latitude,
              lng: pos.coords.longitude
            }
            sessionStorage.setItem('mobileUserCoords', JSON.stringify(coords))
            sessionStorage.setItem('mobileGeofenceTimestamp', Date.now().toString())
            console.log('[LoginForm] Geolocation pre-warmed on mutate successfully:', coords)
          },
          (err) => {
            if (err.code !== err.PERMISSION_DENIED) {
              console.warn('[LoginForm] Geolocation pre-warm on mutate failed:', err)
            } else {
              console.log('[LoginForm] Geolocation pre-warm on mutate skipped (permission not granted)')
            }
          },
          { enableHighAccuracy: true, timeout: 4000, maximumAge: 0 }
        )
      }
    },
    onError: (error) => {
      console.log('[LoginForm] Login error:', error)
      setAsyncState('error')
      // Reset back to idle after a delay for error state
      setTimeout(() => setAsyncState('idle'), 2000)

      const baseErrorMessage = 'Invalid email or password'
      const errorData = error.data as { field?: string } | undefined
      const fieldToHighlight = errorData?.field || 'none'

      setAuthError(null)
      setFieldErrors({})

      if (error.data?.code === 'INTERNAL_SERVER_ERROR') {
        setAuthError(error.message)
      } else if (error.data?.code === 'FORBIDDEN') {
        setAuthError(error.message)
      } else if (fieldToHighlight === 'email') {
        setFieldErrors({ email: 'Email id not found' })
        setAuthError(baseErrorMessage)
      } else if (fieldToHighlight === 'password') {
        setFieldErrors({ password: 'Password not matched' })
        setAuthError(baseErrorMessage)
      } else if (fieldToHighlight === 'both') {
        setFieldErrors({
          email: 'Email id not found',
          password: 'Password not matched',
        })
        setAuthError(baseErrorMessage)
      } else {
        setAuthError(baseErrorMessage)
      }
    },
    onSuccess: async (data) => {
      setAsyncState('success')
      setAuthError(null)
      setFieldErrors({})
      setIsLoading(false)

      console.log('[LoginForm] Login successful, data:', {
        success: data?.success,
        hasProfile: !!data?.profile,
        profileRole: data?.profile?.role,
        warning: data?.warning
      })

      // Ensure background geolocation is pre-warmed if not already done
      if (typeof window !== 'undefined' && navigator.geolocation && (data?.profile?.role === 'employee' || data?.profile?.role === 'moderator')) {
        const cachedTime = sessionStorage.getItem('mobileGeofenceTimestamp')
        if (!cachedTime || Date.now() - Number(cachedTime) > 10000) {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              const coords = {
                lat: pos.coords.latitude,
                lng: pos.coords.longitude
              }
              sessionStorage.setItem('mobileUserCoords', JSON.stringify(coords))
              sessionStorage.setItem('mobileGeofenceTimestamp', Date.now().toString())
              console.log('[LoginForm] Geolocation pre-warmed on success successfully:', coords)
            },
            (err) => {
              if (err.code !== err.PERMISSION_DENIED) {
                console.warn('[LoginForm] Geolocation pre-warm on success failed:', err)
              } else {
                console.log('[LoginForm] Geolocation pre-warm on success skipped (permission not granted)')
              }
            },
            { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
          )
        }
      }

      // Prefetch bypassed to prevent duplicate server/client database load concurrency.
      // Next.js Server Components prefetch this data during page render, making client prefetch redundant.

      // Optimized: Pre-populate the tRPC cache for the profile and last session so the dashboard feels instant
      if (data?.profile) {
        utils.profile.get.setData(undefined, data.profile as any)

        // Also pre-populate last session data if available
        if ('lastLogout' in data) {
          utils.profile.getLastSession.setData(undefined, {
            lastLogin: new Date().toISOString(),
            lastLogout: (data as any).lastLogout,
            joinedAt: data.profile.created_at,
            totalActivities: 0, // Will be updated on next fetch, but prevents null/skeleton flash
          })
        }
      }

      let redirectPath = '/moderator' // Default for non-admin users

      if (data?.profile) {
        try {
          localStorage.setItem('userProfile', JSON.stringify(data.profile))
          sessionStorage.setItem('sessionProfile', JSON.stringify(data.profile))

          // OPTIMIZED: Use link[rel=preload] for browser-level priority avatar loading
          if (data.profile.avatar_url) {
            // Method 1: Inject a <link rel="preload"> into head (browser prioritizes this)
            const existingLink = document.querySelector(`link[href="${data.profile.avatar_url}"]`)
            if (!existingLink) {
              const link = document.createElement('link')
              link.rel = 'preload'
              link.as = 'image'
              link.href = data.profile.avatar_url
              link.setAttribute('fetchpriority', 'high')
              document.head.appendChild(link)
            }

            // Method 2: Also use Image() for cache warming
            const img = new Image()
            img.src = data.profile.avatar_url
            img.fetchPriority = 'high'
            console.log('[LoginForm] Preloading avatar with high priority:', data.profile.avatar_url)
          }
        } catch (storageError) {
          console.warn('[LoginForm] Failed to store profile in storage:', storageError)
        }

        // Detect mobile device and PWA standalone mode client-side to short-circuit redirects
        const isMobileDevice = typeof window !== 'undefined' && /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|mobile/i.test(navigator.userAgent)
        const isPwaStandalone = typeof window !== 'undefined' && (window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true)
        const isMobileViewport = typeof window !== 'undefined' && (window.innerWidth < 768 || isMobileDevice)

        // Role-based redirect
        if (data.profile.role === 'admin') {
          redirectPath = '/admin'
        } else if (data.profile.role === 'moderator') {
          // Moderator is only redirected to mobile layout if launching standalone PWA
          redirectPath = (isMobileViewport && isPwaStandalone) ? '/mobile' : '/moderator'
        } else if (data.profile.role === 'employee') {
          // Employee is always redirected to mobile layout on mobile screens
          redirectPath = isMobileViewport ? '/mobile' : '/employee'
        } else {
          redirectPath = '/moderator'
        }
      }

      console.log('[LoginForm] Executing smooth client-side transition to:', redirectPath)
      router.replace(redirectPath)
    },
  })

  const onSubmit = async (data: LoginInput) => {
    setAuthError(null)
    setFieldErrors({})

    // INSTANT CHECK: If no network, show error immediately without sending request
    if (!navigator.onLine) {
      setAsyncState('error')
      setAuthError('No internet connection. Please check your network and try again.')
      setTimeout(() => setAsyncState('idle'), 2000)
      return
    }

    setIsLoading(true)

    try {
      await loginMutation.mutateAsync(data)
    } catch (error) {
      setIsLoading(false)
      throw error
    }
  }

  const hasFormErrors = Object.keys(form.formState.errors).length > 0

  return (
    <div className="w-full space-y-4">
      {/* General Error Display */}
      <AnimatePresence>
        {authError && !fieldErrors.email && !fieldErrors.password && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="p-4 rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30"
            role="alert"
          >
            <div className="flex items-center gap-3 text-red-600 dark:text-red-400">
              <AlertCircle className="h-5 w-5 flex-shrink-0" />
              <span className="text-sm font-medium">{authError}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="space-y-6"
        noValidate
      >
        <div className="space-y-6">
          <FieldSet className="border-none p-0 m-0">
            <FieldGroup className="space-y-4">
              {/* Email Field */}
              <Field data-invalid={!!fieldErrors.email || !!form.formState.errors.email}>
                <FieldLabel htmlFor="email" className="text-gray-700 dark:text-zinc-300 font-medium ml-1">Email Address</FieldLabel>
                <div className="relative group/input">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none transition-colors group-focus-within/input:text-primary text-primary">
                    <Mail className="h-5 w-5" />
                  </div>
                  <Input
                    id="email"
                    type="email"
                    placeholder="name@company.com"
                    className="pl-12 h-12 bg-white dark:bg-zinc-950 border-gray-200 dark:border-zinc-800 text-gray-900 dark:text-zinc-100 placeholder:text-gray-400 dark:placeholder:text-zinc-500 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all rounded-xl shadow-sm"
                    autoComplete="email"
                    disabled={isLoading || form.formState.isSubmitting}
                    {...form.register('email')}
                    onChange={(e) => {
                      form.setValue('email', e.target.value)
                      if (e.target.value && (authError || fieldErrors.email)) {
                        setAuthError(null)
                        setFieldErrors(prev => ({ ...prev, email: undefined }))
                      }
                    }}
                  />
                </div>
                {(fieldErrors.email || form.formState.errors.email) && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <FieldError className="text-red-600 mt-1.5 ml-1" errors={[{
                      message: fieldErrors.email || form.formState.errors.email?.message
                    }]} />
                  </motion.div>
                )}
              </Field>

              {/* Password Field */}
              <Field data-invalid={!!fieldErrors.password || !!form.formState.errors.password}>
                <div className="flex items-center justify-between ml-1">
                  <FieldLabel htmlFor="password" className="text-gray-700 dark:text-zinc-300 font-medium">Password</FieldLabel>
                  <button type="button" className="text-xs text-blue-600 hover:text-blue-500 transition-colors font-semibold">Forgot?</button>
                </div>
                <div className="relative group/input">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none transition-colors group-focus-within/input:text-primary text-primary z-10">
                    <Lock className="h-5 w-5" />
                  </div>
                  <PasswordInput
                    id="password"
                    placeholder="••••••••"
                    className="pl-12 h-12 bg-white dark:bg-zinc-950 border-gray-200 dark:border-zinc-800 text-gray-900 dark:text-zinc-100 placeholder:text-gray-400 dark:placeholder:text-zinc-500 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all rounded-xl shadow-sm"
                    autoComplete="current-password"
                    disabled={isLoading || form.formState.isSubmitting}
                    {...form.register('password')}
                    onChange={(e) => {
                      form.setValue('password', e.target.value)
                      if (e.target.value && (authError || fieldErrors.password)) {
                        setAuthError(null)
                        setFieldErrors(prev => ({ ...prev, password: undefined }))
                      }
                    }}
                  />
                </div>
                {(fieldErrors.password || form.formState.errors.password) && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <FieldError className="text-red-600 mt-1.5 ml-1" errors={[{
                      message: fieldErrors.password || form.formState.errors.password?.message
                    }]} />
                  </motion.div>
                )}
              </Field>
            </FieldGroup>
          </FieldSet>
        </div>

        <LoginButton
          type="submit"
          state={asyncState}
          loadingText="Verifying..."
          successText="Welcome Back!"
          errorText={hasFormErrors ? "Fix errors" : "Login failed"}
          hasFormErrors={hasFormErrors}
          successDuration={2000}
          className="w-full h-12 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold shadow-[0_0_20px_rgba(37,99,235,0.3)] transition-all duration-300"
          size="lg"
          disabled={form.formState.isSubmitting || isLoading}
          variant="primary"
          showToast={true}
        >
          {form.formState.isSubmitting || isLoading ? "Signing in..." : "Sign In"}
        </LoginButton>
      </form>

      {/* Additional Info */}
      <div className="text-center pt-2">
        <p className="text-xs text-gray-500">
          Need an account? <span className="text-blue-600 dark:text-blue-400 font-semibold cursor-pointer hover:underline">Contact Support</span>
        </p>
      </div>
    </div>
  )
}