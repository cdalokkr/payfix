"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { PasswordInput } from "@/components/ui/password-input"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { toast } from 'sonner'
import { motion } from "framer-motion"
import {
    ArrowLeft as IconArrowLeft,
    Lock as IconLock,
    Loader2 as IconLoader2,
    Check as IconCheck,
    ShieldCheck as IconShieldCheck,
} from "lucide-react"
import { trpc } from '@/lib/trpc/client'
import { changePasswordSchema, ChangePasswordInput } from "@/lib/validations/auth"

type SaveStatus = 'idle' | 'saving' | 'success' | 'error'

export function MobileChangePasswordClient() {
    const router = useRouter()
    const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')

    const form = useForm<ChangePasswordInput>({
        resolver: zodResolver(changePasswordSchema),
        defaultValues: {
            currentPassword: "",
            newPassword: "",
            confirmPassword: "",
        },
    })

    const changePasswordMutation = trpc.auth.changePassword.useMutation({
        onSuccess: () => {
            toast.success('Password changed successfully!')
            setSaveStatus('success')
            form.reset()
            setTimeout(() => {
                router.push('/mobile/profile')
            }, 1500)
        },
        onError: (error) => {
            toast.error(error.message || 'Failed to change password')
            setSaveStatus('error')
            setTimeout(() => setSaveStatus('idle'), 2000)
        }
    })

    const onSubmit = async (data: ChangePasswordInput) => {
        setSaveStatus('saving')
        await changePasswordMutation.mutateAsync(data)
    }

    return (
        <div className="min-h-screen bg-background pb-24">
            {/* Header */}
            <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-xl border-b">
                <div className="flex items-center gap-3 px-4 h-14">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => router.back()}
                        className="rounded-xl"
                    >
                        <IconArrowLeft className="w-5 h-5" />
                    </Button>
                    <div className="flex-1">
                        <h1 className="text-lg font-bold">Change Password</h1>
                    </div>
                </div>
            </div>

            {/* Form Content */}
            <div className="p-4 space-y-4">
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                >
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base flex items-center gap-2">
                                <IconShieldCheck className="w-5 h-5 text-primary" />
                                Security
                            </CardTitle>
                            <CardDescription className="text-xs">
                                Update your password to keep your account secure
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Form {...form}>
                                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                                    <FormField
                                        control={form.control}
                                        name="currentPassword"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-sm flex items-center gap-2">
                                                    <IconLock className="w-4 h-4 text-muted-foreground" />
                                                    Current Password
                                                </FormLabel>
                                                <FormControl>
                                                    <PasswordInput
                                                        placeholder="Enter current password"
                                                        className="rounded-xl h-11"
                                                        {...field}
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={form.control}
                                        name="newPassword"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-sm flex items-center gap-2">
                                                    <IconLock className="w-4 h-4 text-muted-foreground" />
                                                    New Password
                                                </FormLabel>
                                                <FormControl>
                                                    <PasswordInput
                                                        placeholder="Enter new password"
                                                        className="rounded-xl h-11"
                                                        {...field}
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={form.control}
                                        name="confirmPassword"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-sm flex items-center gap-2">
                                                    <IconLock className="w-4 h-4 text-muted-foreground" />
                                                    Confirm New Password
                                                </FormLabel>
                                                <FormControl>
                                                    <PasswordInput
                                                        placeholder="Confirm new password"
                                                        className="rounded-xl h-11"
                                                        {...field}
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    <Button
                                        type="submit"
                                        className="w-full h-12 rounded-xl font-semibold mt-6"
                                        disabled={saveStatus === 'saving'}
                                    >
                                        {saveStatus === 'saving' ? (
                                            <>
                                                <IconLoader2 className="w-5 h-5 mr-2 animate-spin" />
                                                Updating Password...
                                            </>
                                        ) : saveStatus === 'success' ? (
                                            <>
                                                <IconCheck className="w-5 h-5 mr-2" />
                                                Password Updated!
                                            </>
                                        ) : (
                                            <>
                                                <IconShieldCheck className="w-5 h-5 mr-2" />
                                                Update Password
                                            </>
                                        )}
                                    </Button>
                                </form>
                            </Form>
                        </CardContent>
                    </Card>
                </motion.div>

                {/* Security Tips */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                >
                    <Card className="bg-muted/30">
                        <CardContent className="pt-4">
                            <p className="text-xs font-medium text-muted-foreground mb-2">Password Requirements:</p>
                            <ul className="text-xs text-muted-foreground space-y-1">
                                <li>• At least 8 characters long</li>
                                <li>• Include uppercase and lowercase letters</li>
                                <li>• Include at least one number</li>
                                <li>• Include at least one special character</li>
                            </ul>
                        </CardContent>
                    </Card>
                </motion.div>
            </div>
        </div>
    )
}
