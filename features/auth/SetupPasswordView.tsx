"use client"

import React, { useState } from "react"
import { useRouter } from "next/navigation"
import { trpc } from "@/lib/trpc/client"
import { toast } from "sonner"
import { 
    Lock, 
    KeyRound, 
    Eye, 
    EyeOff, 
    CheckCircle2, 
    AlertCircle, 
    ShieldCheck, 
    ArrowRight,
    Loader2
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export function SetupPasswordView() {
    const [newPassword, setNewPassword] = useState("")
    const [confirmPassword, setConfirmPassword] = useState("")
    const [showNewPassword, setShowNewPassword] = useState(false)
    const [showConfirmPassword, setShowConfirmPassword] = useState(false)
    const [errorMessage, setErrorMessage] = useState<string | null>(null)
    const router = useRouter()

    const { data: profile } = trpc.profile.get.useQuery(undefined, {
        staleTime: 60000,
    })

    const setupMutation = trpc.auth.setupInitialPassword.useMutation({
        onSuccess: () => {
            toast.success("Password updated successfully! Redirecting to your dashboard...")
            
            // Determine role dashboard
            const isMobileDevice = typeof window !== 'undefined' && /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|mobile/i.test(navigator.userAgent)
            const isPwaStandalone = typeof window !== 'undefined' && (window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true)
            const isMobileViewport = typeof window !== 'undefined' && (window.innerWidth < 768 || isMobileDevice)

            let redirectPath = '/admin'
            if (profile?.role === 'super_admin') {
                redirectPath = '/superadmin'
            } else if (profile?.role === 'admin') {
                redirectPath = '/admin'
            } else if (profile?.role === 'moderator') {
                redirectPath = (isMobileViewport && isPwaStandalone) ? '/mobile' : '/moderator'
            } else if (profile?.role === 'employee') {
                redirectPath = isMobileViewport ? '/mobile' : '/employee'
            }

            setTimeout(() => {
                if (typeof window !== 'undefined') {
                    window.location.replace(redirectPath)
                } else {
                    router.replace(redirectPath)
                }
            }, 800)
        },
        onError: (err) => {
            setErrorMessage(err.message || "Failed to update password")
            toast.error(err.message || "Failed to update password")
        }
    })

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        setErrorMessage(null)

        if (newPassword.length < 8) {
            setErrorMessage("Password must be at least 8 characters long.")
            return
        }

        if (newPassword === '#User@1234$') {
            setErrorMessage("You cannot reuse the default temporary password. Please choose a new password.")
            return
        }

        if (newPassword !== confirmPassword) {
            setErrorMessage("New password and confirm password do not match.")
            return
        }

        setupMutation.mutate({
            newPassword,
            confirmPassword,
        })
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-100 to-indigo-50/30 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950 flex flex-col justify-center items-center p-4">
            <div className="w-full max-w-md space-y-6">
                {/* Brand Header */}
                <div className="text-center space-y-2">
                    <div className="h-12 w-12 rounded-2xl bg-primary text-white flex items-center justify-center mx-auto shadow-md shadow-primary/20">
                        <ShieldCheck className="h-6 w-6" />
                    </div>
                    <h1 className="text-2xl font-bold tracking-tight text-foreground">
                        Set Your New Password
                    </h1>
                    <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                        For your account security, you must create a new personal password before accessing your PayFix workspace.
                    </p>
                </div>

                {/* Form Card */}
                <div className="p-6 sm:p-7 shadow-lg border border-slate-200 dark:border-zinc-800 bg-card rounded-2xl">
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {errorMessage && (
                            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/40 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2">
                                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                                <span>{errorMessage}</span>
                            </div>
                        )}

                        {/* New Password */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-foreground">
                                New Password
                            </label>
                            <div className="relative">
                                <Input
                                    type={showNewPassword ? "text" : "password"}
                                    placeholder="Enter at least 8 characters..."
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    className="h-10 pr-10 text-xs rounded-xl"
                                    required
                                    autoFocus
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowNewPassword(!showNewPassword)}
                                    className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground"
                                >
                                    {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            </div>
                        </div>

                        {/* Confirm Password */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-foreground">
                                Confirm New Password
                            </label>
                            <div className="relative">
                                <Input
                                    type={showConfirmPassword ? "text" : "password"}
                                    placeholder="Re-enter your new password..."
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className="h-10 pr-10 text-xs rounded-xl"
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                    className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground"
                                >
                                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            </div>
                        </div>

                        {/* Password Requirements hint */}
                        <div className="bg-slate-50 dark:bg-zinc-900/60 p-3 rounded-xl text-[11px] text-muted-foreground space-y-1">
                            <p className="font-semibold text-foreground text-xs flex items-center gap-1.5">
                                <KeyRound className="h-3.5 w-3.5 text-primary" /> Password Requirements:
                            </p>
                            <div className="flex items-center gap-2">
                                <span className={newPassword.length >= 8 ? "text-emerald-600 font-bold" : ""}>
                                    {newPassword.length >= 8 ? "✓" : "•"} Minimum 8 characters
                                </span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className={newPassword && confirmPassword && newPassword === confirmPassword ? "text-emerald-600 font-bold" : ""}>
                                    {newPassword && confirmPassword && newPassword === confirmPassword ? "✓" : "•"} Passwords match
                                </span>
                            </div>
                        </div>

                        {/* Submit Button */}
                        <Button
                            type="submit"
                            disabled={setupMutation.isPending || newPassword.length < 8 || newPassword !== confirmPassword}
                            className="w-full h-10 rounded-xl font-bold text-xs gap-2 bg-primary hover:bg-primary/90 text-white shadow-md shadow-primary/20"
                        >
                            {setupMutation.isPending ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    <span>Updating Password...</span>
                                </>
                            ) : (
                                <>
                                    <span>Update Password & Continue</span>
                                    <ArrowRight className="h-4 w-4" />
                                </>
                            )}
                        </Button>
                    </form>
                </div>

                <p className="text-center text-[11px] text-muted-foreground">
                    PayFix Workforce & Payroll Platform
                </p>
            </div>
        </div>
    )
}
