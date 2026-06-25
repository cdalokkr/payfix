"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Building2, Globe, Mail, Lock, AlertCircle, ArrowLeft } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { toast } from "sonner";

import { trpc } from "@/lib/trpc/client";
import { ThemeToggle } from "@/components/theme-toggle";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldLabel, FieldError, FieldGroup, FieldSet } from "@/components/ui/field";
import { LoginButton } from "@/components/ui/async-button";

const signupSchema = z.object({
  companyName: z.string().min(2, "Company name must be at least 2 characters").max(100),
  slug: z.string()
    .min(3, "Subdomain must be at least 3 characters")
    .max(30, "Subdomain must be under 30 characters")
    .regex(/^[a-z0-9-]+$/, "Only lowercase letters, numbers, and hyphens allowed"),
  adminEmail: z.string().email("Invalid email address"),
  adminPassword: z.string().min(8, "Password must be at least 8 characters"),
});

type SignupInput = z.infer<typeof signupSchema>;

export default function SignupPage() {
  const router = useRouter();
  const [asyncState, setAsyncState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [signupError, setSignupError] = useState<string | null>(null);

  const form = useForm<SignupInput>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      companyName: '',
      slug: '',
      adminEmail: '',
      adminPassword: '',
    },
    mode: "onChange"
  });

  const registerMutation = trpc.auth.registerTenant.useMutation({
    onMutate: () => {
      setAsyncState('loading');
    },
    onError: (error) => {
      console.error('[Signup] error:', error);
      setAsyncState('error');
      setSignupError(error.message || 'Registration failed. Please try again.');
      setTimeout(() => setAsyncState('idle'), 2000);
    },
    onSuccess: (data) => {
      setAsyncState('success');
      toast.success('Workspace registered successfully! Redirecting to login...', {
        duration: 3000
      });
      setTimeout(() => {
        router.push(`/login?tenant=${data.slug}`);
      }, 2000);
    }
  });

  const onSubmit = async (data: SignupInput) => {
    setSignupError(null);
    if (!navigator.onLine) {
      setAsyncState('error');
      setSignupError('No internet connection. Please check your network and try again.');
      setTimeout(() => setAsyncState('idle'), 2000);
      return;
    }

    try {
      await registerMutation.mutateAsync(data);
    } catch (err) {
      // Handled by onError
    }
  };

  const hasFormErrors = Object.keys(form.formState.errors).length > 0;

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950 relative overflow-hidden flex flex-col font-sans">
      {/* Glow Effects */}
      <div className="absolute top-[-10%] left-[-10%] w-[45%] h-[45%] bg-blue-100/40 dark:bg-blue-900/10 blur-[130px] rounded-full animate-pulse" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[45%] h-[45%] bg-indigo-100/40 dark:bg-indigo-900/10 blur-[130px] rounded-full animate-pulse" style={{ animationDelay: '2s' }} />

      {/* Noise Overlay */}
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] pointer-events-none" />

      {/* Top Bar */}
      <header className="relative z-10 border-b border-gray-100 dark:border-zinc-800 bg-white/60 dark:bg-zinc-950/60 backdrop-blur-xl">
        <div className="container mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 sm:gap-3 group">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-white dark:bg-zinc-900 rounded-lg sm:rounded-xl flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform duration-300 overflow-hidden border border-gray-100 dark:border-zinc-800">
              <img src="/icons/icon-192x192.png" alt="PayFix" className="w-full h-full object-cover" />
            </div>
            <div className="flex flex-col">
              <h1 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-zinc-100 tracking-tight leading-none">
                PayFix
              </h1>
              <span className="text-[9px] sm:text-[10px] text-blue-600 font-bold uppercase tracking-[0.2em] mt-0.5 sm:mt-1">Tenant Registration</span>
            </div>
          </Link>
          <div className="flex items-center gap-4">
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Signup Form Container */}
      <main className="relative z-10 flex-1 flex items-center justify-center p-4 sm:p-6 my-4">
        <div className="w-full max-w-[480px] animate-in fade-in zoom-in duration-700">
          <div className="relative group">
            {/* Glow Border */}
            <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-[1.5rem] sm:rounded-[2rem] border-2 border-blue-100 dark:border-blue-900/50 shadow-lg hover:shadow-xl transform-gpu group-hover:scale-[1.01] blur opacity-20 group-hover:opacity-30 transition duration-1000 group-hover:duration-200"></div>

            <Card className="relative bg-white/80 dark:bg-zinc-900/80 border-primary/20 dark:border-zinc-800 backdrop-blur-2xl rounded-[1.5rem] sm:rounded-[2rem] overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.05)] border">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-blue-500 to-transparent opacity-30" />

              <CardHeader className="pt-5 pb-3 border-b border-gray-100 dark:border-zinc-800 px-5 sm:px-8">
                <CardTitle className="text-xl sm:text-2xl font-bold tracking-tight text-gray-900 dark:text-zinc-100">
                  Register Your Workspace
                </CardTitle>
                <CardDescription className="text-gray-500 dark:text-zinc-400 text-xs sm:text-sm">
                  Start your 14-day free trial. Setup requires no credit card.
                </CardDescription>
              </CardHeader>

              <CardContent className="px-5 sm:px-8 py-6">
                <AnimatePresence>
                  {signupError && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="p-4 mb-4 rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30"
                      role="alert"
                    >
                      <div className="flex items-center gap-3 text-red-600 dark:text-red-400">
                        <AlertCircle className="h-5 w-5 flex-shrink-0" />
                        <span className="text-xs sm:text-sm font-medium">{signupError}</span>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
                  <FieldSet className="border-none p-0 m-0">
                    <FieldGroup className="space-y-4">
                      {/* Company Name */}
                      <Field data-invalid={!!form.formState.errors.companyName}>
                        <FieldLabel htmlFor="companyName" className="text-gray-700 dark:text-zinc-300 font-medium ml-1">Company Name</FieldLabel>
                        <div className="relative group/input">
                          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none transition-colors group-focus-within/input:text-primary text-gray-400">
                            <Building2 className="h-5 w-5" />
                          </div>
                          <Input
                            id="companyName"
                            placeholder="e.g. Acme Corp"
                            className="pl-12 h-12 bg-white dark:bg-zinc-950 border-gray-200 dark:border-zinc-800 text-gray-900 dark:text-zinc-100 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all rounded-xl shadow-sm"
                            disabled={asyncState === 'loading' || form.formState.isSubmitting}
                            {...form.register('companyName')}
                          />
                        </div>
                        {form.formState.errors.companyName && (
                          <FieldError className="text-red-600 mt-1 ml-1" errors={[{
                            message: form.formState.errors.companyName.message
                          }]} />
                        )}
                      </Field>

                      {/* Subdomain / Slug */}
                      <Field data-invalid={!!form.formState.errors.slug}>
                        <FieldLabel htmlFor="slug" className="text-gray-700 dark:text-zinc-300 font-medium ml-1">Subdomain Slug</FieldLabel>
                        <div className="relative group/input flex items-center">
                          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400">
                            <Globe className="h-5 w-5" />
                          </div>
                          <Input
                            id="slug"
                            placeholder="acme"
                            className="pl-12 h-12 bg-white dark:bg-zinc-950 border-gray-200 dark:border-zinc-800 text-gray-900 dark:text-zinc-100 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all rounded-xl shadow-sm w-full pr-28"
                            disabled={asyncState === 'loading' || form.formState.isSubmitting}
                            {...form.register('slug')}
                            onChange={(e) => {
                              form.setValue('slug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''));
                            }}
                          />
                          <span className="absolute right-4 text-xs font-bold text-gray-400 bg-gray-100 dark:bg-zinc-800 py-1 px-2 rounded-lg pointer-events-none">
                            .payfix.com
                          </span>
                        </div>
                        {form.formState.errors.slug && (
                          <FieldError className="text-red-600 mt-1 ml-1" errors={[{
                            message: form.formState.errors.slug.message
                          }]} />
                        )}
                      </Field>

                      {/* Admin Email */}
                      <Field data-invalid={!!form.formState.errors.adminEmail}>
                        <FieldLabel htmlFor="adminEmail" className="text-gray-700 dark:text-zinc-300 font-medium ml-1">Admin Email Address</FieldLabel>
                        <div className="relative group/input">
                          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400">
                            <Mail className="h-5 w-5" />
                          </div>
                          <Input
                            id="adminEmail"
                            type="email"
                            placeholder="admin@company.com"
                            className="pl-12 h-12 bg-white dark:bg-zinc-950 border-gray-200 dark:border-zinc-800 text-gray-900 dark:text-zinc-100 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all rounded-xl shadow-sm"
                            disabled={asyncState === 'loading' || form.formState.isSubmitting}
                            {...form.register('adminEmail')}
                          />
                        </div>
                        {form.formState.errors.adminEmail && (
                          <FieldError className="text-red-600 mt-1 ml-1" errors={[{
                            message: form.formState.errors.adminEmail.message
                          }]} />
                        )}
                      </Field>

                      {/* Admin Password */}
                      <Field data-invalid={!!form.formState.errors.adminPassword}>
                        <FieldLabel htmlFor="adminPassword" className="text-gray-700 dark:text-zinc-300 font-medium ml-1">Admin Password</FieldLabel>
                        <div className="relative group/input">
                          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400 z-10">
                            <Lock className="h-5 w-5" />
                          </div>
                          <PasswordInput
                            id="adminPassword"
                            placeholder="••••••••"
                            className="pl-12 h-12 bg-white dark:bg-zinc-950 border-gray-200 dark:border-zinc-800 text-gray-900 dark:text-zinc-100 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all rounded-xl shadow-sm"
                            disabled={asyncState === 'loading' || form.formState.isSubmitting}
                            {...form.register('adminPassword')}
                          />
                        </div>
                        {form.formState.errors.adminPassword && (
                          <FieldError className="text-red-600 mt-1 ml-1" errors={[{
                            message: form.formState.errors.adminPassword.message
                          }]} />
                        )}
                      </Field>
                    </FieldGroup>
                  </FieldSet>

                  <LoginButton
                    type="submit"
                    state={asyncState}
                    loadingText="Registering..."
                    successText="Welcome Aboard!"
                    errorText={hasFormErrors ? "Fix errors" : "Registration failed"}
                    hasFormErrors={hasFormErrors}
                    successDuration={2000}
                    className="w-full h-12 mt-6 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold shadow-[0_0_20px_rgba(37,99,235,0.3)] transition-all duration-300"
                    size="lg"
                    disabled={form.formState.isSubmitting || asyncState === 'loading'}
                    variant="primary"
                    showToast={false}
                  >
                    Create Free Workspace
                  </LoginButton>
                </form>

                <div className="text-center pt-4 border-t border-gray-100 dark:border-zinc-850 mt-6 flex justify-between items-center text-xs text-gray-500">
                  <Link href="/login" className="flex items-center gap-1.5 hover:text-blue-600 dark:hover:text-blue-400 font-semibold transition-colors">
                    <ArrowLeft className="h-3.5 w-3.5" />
                    Back to Login
                  </Link>
                  <span>Trial includes 5 employees, 2 mods</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
