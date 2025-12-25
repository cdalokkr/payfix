"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { PasswordInput } from "@/components/ui/password-input"
import { Lock } from "lucide-react"
import { toast } from "sonner"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import CreateUserButton, { AsyncState } from "@/components/ui/create-user-button"
import { changePasswordSchema, ChangePasswordInput } from "@/lib/validations/auth"
import { trpc } from "@/lib/trpc/client"

export function SecuritySettings() {
    const [status, setStatus] = useState<AsyncState>('idle')
    const utils = trpc.useUtils()

    const form = useForm<ChangePasswordInput>({
        resolver: zodResolver(changePasswordSchema),
        defaultValues: {
            currentPassword: "",
            newPassword: "",
            confirmPassword: "",
        },
    })

    const changePasswordMutation = trpc.auth.changePassword.useMutation({
        onSuccess: async () => {
            toast.success("Password updated successfully")
            form.reset()
            setStatus('success')
            // Invalidate profile to ensure any dependent UI re-fetches
            await utils.profile.get.invalidate()
            setTimeout(() => setStatus('idle'), 3000)
        },
        onError: (error) => {
            toast.error(error.message || "Failed to update password")
            setStatus('error')
            setTimeout(() => setStatus('idle'), 3000)
        }
    })

    const onSubmit = async (data: ChangePasswordInput) => {
        setStatus('loading')
        await changePasswordMutation.mutateAsync(data)
    }

    return (
        <Card className="relative overflow-hidden border-2 border-border/60 hover:border-primary/30 transition-all duration-300 w-full">
            <div className="absolute inset-0 bg-gradient-to-br from-accent/5 via-transparent to-primary/5 pointer-events-none" />
            <CardHeader className="relative">
                <CardTitle className="text-lg">Change Password</CardTitle>
                <CardDescription>
                    Update your account password
                </CardDescription>
            </CardHeader>
            <CardContent className="relative flex flex-col items-center">
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="w-full max-w-xs">
                        <div className="rounded-lg border border-border p-4 space-y-4">
                            <FormField
                                control={form.control}
                                name="currentPassword"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Current Password</FormLabel>
                                        <div className="relative">
                                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4 z-10" />
                                            <FormControl>
                                                <PasswordInput
                                                    placeholder="Enter current password"
                                                    className="pl-10"
                                                    {...field}
                                                />
                                            </FormControl>
                                        </div>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="newPassword"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>New Password</FormLabel>
                                        <div className="relative">
                                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4 z-10" />
                                            <FormControl>
                                                <PasswordInput
                                                    placeholder="Enter new password"
                                                    className="pl-10"
                                                    {...field}
                                                />
                                            </FormControl>
                                        </div>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="confirmPassword"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Confirm Password</FormLabel>
                                        <div className="relative">
                                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4 z-10" />
                                            <FormControl>
                                                <PasswordInput
                                                    placeholder="Confirm new password"
                                                    className="pl-10"
                                                    {...field}
                                                />
                                            </FormControl>
                                        </div>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                        <CreateUserButton
                            type="submit"
                            size="lg"
                            className="w-full mt-6"
                            asyncState={status}
                            mode="edit"
                            loadingText="Updating Password..."
                            successText="Password Updated!"
                            errorText="Update Failed"
                        >
                            Update Password
                        </CreateUserButton>
                    </form>
                </Form>
            </CardContent>
        </Card>
    )
}
