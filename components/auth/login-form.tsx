"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { loginSchema, type LoginInput } from "@/lib/validations/auth"
import { Mail, ArrowRight, AlertCircle, Check } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import Link from "next/link"

import { Input } from "@/components/auth/ui/input"
import { PasswordInput } from "@/components/auth/ui/password-input"
import { Checkbox } from "@/components/auth/ui/checkbox"
import { Button } from "@/components/auth/ui/button"
import { GoogleIcon, MicrosoftIcon } from "@/components/auth/ui/icons"
import { trpc } from "@/lib/trpc/client"
import { useToast } from "@/components/auth/ui/Toast"
import { cn } from "@/lib/utils"
import { LoginButton } from "@/components/ui/async-button"

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05, delayChildren: 0.1 } },
}

const fadeUp = {
  hidden: { opacity: 0, y: 10 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] as const },
  },
}

export function LoginForm() {
  const router = useRouter()
  const utils = trpc.useUtils()
  const { toast } = useToast()
  const [buttonState, setButtonState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const loading = buttonState === 'loading'
  const [authError, setAuthError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({})

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isValid, isSubmitted },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    mode: "onChange",
    defaultValues: {
      email: "",
      password: "",
    },
  })

  const remember = watch("remember" as any) || false

  const loginMutation = trpc.auth.login.useMutation({
    onMutate: () => {
      setButtonState('loading')
      setAuthError(null)
      setFieldErrors({})
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
            if (err.code === err.PERMISSION_DENIED) {
              console.log('[LoginForm] Geolocation pre-warm on mutate skipped (permission not granted)')
            } else if (err.code === err.TIMEOUT) {
              console.log('[LoginForm] Geolocation pre-warm on mutate timed out (normal on desktop)')
            } else {
              console.log('[LoginForm] Geolocation pre-warm on mutate unavailable:', err.message || err.code)
            }
          },
          { enableHighAccuracy: true, timeout: 4000, maximumAge: 0 }
        )
      }
    },
    onError: (error) => {
      console.log('[LoginForm] Login error:', error)
      setButtonState('error')
      setTimeout(() => setButtonState('idle'), 2000)

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
      setAuthError(null)
      setFieldErrors({})
      setButtonState('success')

      // If the login mutation discovered a different tenant slug, set the cookie and hard-reload/redirect
      if (data && (data as any).tenantSlug) {
        const discoveredSlug = (data as any).tenantSlug
        console.log('[LoginForm] Discovered user belongs to tenant:', discoveredSlug)
        
        // Set fallback cookie
        document.cookie = `tenant_fallback=${discoveredSlug}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`
        
        let redirectPath = '/admin'
        if (data.profile) {
          const isMobileDevice = typeof window !== 'undefined' && /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|mobile/i.test(navigator.userAgent)
          const isPwaStandalone = typeof window !== 'undefined' && (window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true)
          const isMobileViewport = typeof window !== 'undefined' && (window.innerWidth < 768 || isMobileDevice)

          if (data.profile.role === 'super_admin') {
            redirectPath = '/superadmin'
          } else if (data.profile.role === 'admin') {
            redirectPath = '/admin'
          } else if (data.profile.role === 'moderator') {
            redirectPath = (isMobileViewport && isPwaStandalone) ? '/mobile' : '/moderator'
          } else if (data.profile.role === 'employee') {
            redirectPath = isMobileViewport ? '/mobile' : '/employee'
          }
        }
        
        toast({
          type: "success",
          title: "Signed In Successfully!",
          description: `Switching workspace context to ${discoveredSlug}...`,
        })

        setTimeout(() => {
          window.location.href = redirectPath
        }, 800)
        return
      }

      toast({
        type: "success",
        title: "Signed In Successfully!",
        description: "Welcome back to your workspace.",
      })

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

      // Optimized: Pre-populate the tRPC cache for the profile and last session so the dashboard feels instant
      if (data?.profile) {
        utils.profile.get.setData(undefined, data.profile as any)

        // Also pre-populate last session data if available
        if ('lastLogout' in data) {
          utils.profile.getLastSession.setData(undefined, {
            lastLogin: new Date().toISOString(),
            lastLogout: (data as any).lastLogout,
            joinedAt: data.profile.created_at,
            totalActivities: 0,
          })
        }
      }

      let redirectPath = '/admin'

      if (data?.profile) {
        try {
          localStorage.setItem('userProfile', JSON.stringify(data.profile))
          sessionStorage.setItem('sessionProfile', JSON.stringify(data.profile))

          // Preload avatar
          if (data.profile.avatar_url) {
            const existingLink = document.querySelector(`link[href="${data.profile.avatar_url}"]`)
            if (!existingLink) {
              const link = document.createElement('link')
              link.rel = 'preload'
              link.as = 'image'
              link.href = data.profile.avatar_url
              link.setAttribute('fetchpriority', 'high')
              document.head.appendChild(link)
            }
            const img = new Image()
            img.src = data.profile.avatar_url
            img.fetchPriority = 'high'
          }
        } catch (storageError) {
          console.warn('[LoginForm] Failed to store profile in storage:', storageError)
        }

        const isMobileDevice = typeof window !== 'undefined' && /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|mobile/i.test(navigator.userAgent)
        const isPwaStandalone = typeof window !== 'undefined' && (window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true)
        const isMobileViewport = typeof window !== 'undefined' && (window.innerWidth < 768 || isMobileDevice)

        if (data.profile.role === 'super_admin') {
          redirectPath = '/superadmin'
        } else if (data.profile.role === 'admin') {
          redirectPath = '/admin'
        } else if (data.profile.role === 'moderator') {
          redirectPath = (isMobileViewport && isPwaStandalone) ? '/mobile' : '/moderator'
        } else if (data.profile.role === 'employee') {
          redirectPath = isMobileViewport ? '/mobile' : '/employee'
        } else {
          redirectPath = '/admin'
        }
      }

      console.log('[LoginForm] Executing smooth client-side transition to:', redirectPath)
      router.replace(redirectPath)
    },
  })

  const onSubmit = async (data: LoginInput) => {
    setAuthError(null)
    setFieldErrors({})

    if (!navigator.onLine) {
      setAuthError('No internet connection. Please check your network and try again.')
      return
    }

    try {
      await loginMutation.mutateAsync(data)
    } catch (error) {
      // Handled by onError
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
      className="glass-panel auth-popup-card w-full max-w-[440px] rounded-[24px] border border-white/60 p-4 sm:p-6 dark:border-slate-800/50"
    >
      <motion.div
        variants={stagger}
        initial="hidden"
        animate="show"
      >
        {/* Heading */}
        <motion.div variants={fadeUp} className="text-center sm:text-left mb-5">
          <h2 className="flex items-center justify-center sm:justify-start gap-2 text-[24px] font-bold tracking-[-0.02em] text-slate-900 dark:text-white">
            Welcome Back!{" "}
            <motion.span
              animate={{ rotate: [0, 14, -8, 14, 0] }}
              transition={{
                duration: 1.6,
                repeat: Infinity,
                repeatDelay: 3,
              }}
              className="inline-block origin-[70%_70%]"
            >
              👋
            </motion.span>
          </h2>
          <p className="hidden sm:block mt-2 text-[14px] text-slate-500 dark:text-slate-400">
            Sign in to your secure PayFix workspace.
          </p>
        </motion.div>

        <AnimatePresence>
          {authError && !fieldErrors.email && !fieldErrors.password && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="p-3 mb-4 rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30 flex items-center gap-2.5 text-[12px] sm:text-[13px] font-medium text-red-600 dark:text-red-400"
              role="alert"
            >
              <AlertCircle className="h-5 w-5 flex-shrink-0" />
              <span>{authError}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Form */}
        <motion.form
          variants={fadeUp}
          onSubmit={handleSubmit(onSubmit)}
          className="space-y-3.5"
          noValidate
        >
          <Input
            label="Email Address"
            type="email"
            id="login-email"
            icon={<Mail size={16} />}
            error={fieldErrors.email || errors.email?.message}
            autoComplete="email"
            disabled={loading}
            {...register("email")}
          />

          <PasswordInput
            label="Password"
            id="login-password"
            error={fieldErrors.password || errors.password?.message}
            autoComplete="current-password"
            disabled={loading}
            {...register("password")}
          />

          <div className="flex items-center justify-between pt-1">
            <Checkbox
              checked={remember}
              onChange={(checked) => setValue("remember" as any, checked)}
              label="Remember me"
            />
            <Link
              href="#"
              className="text-[13px] font-semibold text-brand-primary hover:text-brand-hover transition-colors"
            >
              Forgot password?
            </Link>
          </div>

          <LoginButton
            type="submit"
            state={buttonState}
            disabled={isSubmitted && !isValid}
            loadingText="Verifying identity..."
            successText="Access granted!"
            errorText="Invalid credentials"
            className="btn-primary h-[38px] rounded-[10px] text-[14px] font-semibold mt-2 group w-full flex items-center justify-center"
            icons={{
              idle: null
            }}
          >
            <span className="flex items-center justify-center gap-2">
              Sign In
              <ArrowRight
                size={16}
                className="transition-transform duration-300 group-hover:translate-x-1"
              />
            </span>
          </LoginButton>
        </motion.form>

        {/* Divider */}
        <motion.div
          variants={fadeUp}
          className="my-5 flex items-center gap-3 select-none"
        >
          <div className="h-px flex-1 bg-slate-200/70 dark:bg-slate-800/70" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            or continue with
          </span>
          <div className="h-px flex-1 bg-slate-200/70 dark:bg-slate-800/70" />
        </motion.div>

        {/* Social buttons */}
        <motion.div variants={fadeUp} className="grid grid-cols-2 gap-3">
          <Button variant="secondary" type="button" fullWidth>
            <GoogleIcon className="h-4 w-4" />
            <span className="text-[13px] font-semibold">Google</span>
          </Button>
          <Button variant="secondary" type="button" fullWidth>
            <MicrosoftIcon className="h-4 w-4" />
            <span className="text-[13px] font-semibold">Microsoft</span>
          </Button>
        </motion.div>

        {/* Footer */}
        <motion.p
          variants={fadeUp}
          className="mt-5 text-center text-[13px] text-slate-500 dark:text-slate-400 select-none"
        >
          Don&apos;t have an account?{" "}
          <Link
            href="/signup"
            className="font-semibold text-brand-primary hover:text-brand-hover transition-colors"
          >
            Sign up
          </Link>
        </motion.p>
      </motion.div>
    </motion.div>
  )
}