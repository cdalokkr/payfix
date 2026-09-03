"use client"

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { PasswordInput } from "@/components/ui/password-input"
import { toast } from 'sonner'
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { motion, AnimatePresence } from "framer-motion"
import {
    Camera as IconCamera,
    User as IconUser,
    Mail as IconMail,
    Phone as IconPhone,
    Briefcase as IconBriefcase,
    Pencil as IconEdit,
    Lock as IconLock,
    Check as IconCheck,
    Loader2 as IconLoader2,
    Clock as IconClock,
    Calendar as IconCalendar,
    ChevronRight as IconChevronRight,
    ShieldCheck as IconShieldCheck,
} from "lucide-react"
import { trpc } from '@/lib/trpc/client'
import { changePasswordSchema, ChangePasswordInput } from "@/lib/validations/auth"

interface MobileProfileClientProps {
    profile: {
        id: string
        full_name: string | null
        email: string
        avatar_url: string | null
        mobile_no: string | null
        designation: { name: string } | null
        avatar_status: string | null
        date_of_birth?: string | null
    }
}

type AsyncState = 'idle' | 'loading' | 'success' | 'error'

export function MobileProfileClient({ profile }: MobileProfileClientProps) {
    const router = useRouter()
    const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url)
    const [avatarStatus, setAvatarStatus] = useState(profile.avatar_status)
    const [isPendingDialogOpen, setIsPendingDialogOpen] = useState(false)
    const [isEditMode, setIsEditMode] = useState(false)
    const [passwordStatus, setPasswordStatus] = useState<AsyncState>('idle')
    const [profileStatus, setProfileStatus] = useState<AsyncState>('idle')
    const [activeTab, setActiveTab] = useState("profile")

    // Query for pending photo request
    const { data: pendingRequest } = trpc.profile.getMyPendingPhotoRequest.useQuery()
    const utils = trpc.useUtils()

    // Profile update mutation (note: not currently used in this view since edit goes to separate page)
    const updateProfileMutation = trpc.profile.update.useMutation({
        onSuccess: () => {
            toast.success("Profile updated successfully")
            setProfileStatus('success')
            setIsEditMode(false)
            utils.profile.get.invalidate()
            setTimeout(() => setProfileStatus('idle'), 2000)
        },
        onError: (error) => {
            toast.error(error.message || "Failed to update profile")
            setProfileStatus('error')
            setTimeout(() => setProfileStatus('idle'), 2000)
        }
    })

    // Password change mutation
    const changePasswordMutation = trpc.auth.changePassword.useMutation({
        onSuccess: () => {
            toast.success("Password updated successfully")
            passwordForm.reset()
            setPasswordStatus('success')
            setTimeout(() => setPasswordStatus('idle'), 3000)
        },
        onError: (error) => {
            toast.error(error.message || "Failed to update password")
            setPasswordStatus('error')
            setTimeout(() => setPasswordStatus('idle'), 3000)
        }
    })

    // Password form
    const passwordForm = useForm<ChangePasswordInput>({
        resolver: zodResolver(changePasswordSchema),
        defaultValues: {
            currentPassword: "",
            newPassword: "",
            confirmPassword: "",
        },
    })

    // Handle photo update click
    const handlePhotoClick = () => {
        if (pendingRequest) {
            setIsPendingDialogOpen(true)
        } else {
            router.push('/mobile/update-photo')
        }
    }

    // Handle password submit
    const onPasswordSubmit = async (data: ChangePasswordInput) => {
        setPasswordStatus('loading')
        await changePasswordMutation.mutateAsync(data)
    }

    // Format date
    const formatDate = (dateString: string | null | undefined) => {
        if (!dateString) return "Not set"
        try {
            const date = new Date(dateString)
            return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
        } catch {
            return "Invalid date"
        }
    }

    return (
        <div className="space-y-4 pb-24">
            {/* Profile Header Card - Larger Photo */}
            <Card className="relative overflow-hidden bg-gradient-to-br from-primary/5 via-background to-primary/10 border-primary/20">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent pointer-events-none" />
                <CardContent className="pt-6 relative">
                    <div className="flex flex-col items-center">
                        {/* Large Avatar with Camera Button */}
                        <div className="relative mb-4">
                            <motion.div
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                className="relative"
                            >
                                <Avatar className="h-32 w-32 border-4 border-background shadow-2xl ring-4 ring-primary/20">
                                    <AvatarImage src={avatarUrl || ''} alt={profile.full_name || ''} key={avatarUrl} />
                                    <AvatarFallback className="text-4xl font-bold bg-gradient-to-br from-primary/30 to-primary/10 text-primary">
                                        {profile.full_name?.charAt(0) || profile.email.charAt(0).toUpperCase()}
                                    </AvatarFallback>
                                </Avatar>
                                {/* Status indicator */}
                                {pendingRequest ? (
                                    <span className="absolute bottom-2 right-2 w-5 h-5 bg-amber-500 rounded-full ring-4 ring-background animate-pulse flex items-center justify-center">
                                        <IconClock className="w-3 h-3 text-white" />
                                    </span>
                                ) : avatarStatus === 'custom' ? (
                                    <span className="absolute bottom-2 right-2 w-5 h-5 bg-green-500 rounded-full ring-4 ring-background flex items-center justify-center">
                                        <IconCheck className="w-3 h-3 text-white" />
                                    </span>
                                ) : null}
                            </motion.div>
                            <button
                                onClick={handlePhotoClick}
                                className="absolute bottom-0 right-0 p-2.5 rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition-all active:scale-95"
                            >
                                <IconCamera className="w-5 h-5" />
                            </button>
                        </div>

                        <h2 className="text-2xl font-bold text-center">
                            {profile.full_name || 'Employee'}
                        </h2>
                        <p className="text-sm text-muted-foreground">
                            {profile.designation?.name || 'Team Member'}
                        </p>

                        {/* Status Banner */}
                        {pendingRequest ? (
                            <div className="mt-4 px-4 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 text-sm text-center flex items-center gap-2">
                                <IconClock className="w-4 h-4" />
                                Photo update pending approval
                            </div>
                        ) : avatarStatus === 'custom' ? (
                            <div className="mt-4 px-4 py-2.5 rounded-xl bg-green-500/10 border border-green-500/20 text-green-600 text-sm text-center flex items-center gap-2">
                                <IconCheck className="w-4 h-4" />
                                Photo verified - Ready for attendance
                            </div>
                        ) : (
                            <button onClick={handlePhotoClick} className="block mt-4 w-full">
                                <div className="px-4 py-2.5 rounded-xl bg-primary/10 border border-primary/20 text-primary text-sm text-center hover:bg-primary/20 transition-colors flex items-center justify-center gap-2">
                                    <IconCamera className="w-4 h-4" />
                                    Tap here to take a selfie
                                    <IconChevronRight className="w-4 h-4" />
                                </div>
                            </button>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Tabs Section */}
            <Tabs defaultValue="profile" value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="w-full grid grid-cols-2 h-12 rounded-2xl bg-muted/50 p-1">
                    <TabsTrigger value="profile" className="rounded-xl text-sm font-semibold data-[state=active]:bg-background data-[state=active]:shadow-sm">
                        <IconUser className="w-4 h-4 mr-2" />
                        Profile
                    </TabsTrigger>
                    <TabsTrigger value="security" className="rounded-xl text-sm font-semibold data-[state=active]:bg-background data-[state=active]:shadow-sm">
                        <IconShieldCheck className="w-4 h-4 mr-2" />
                        Security
                    </TabsTrigger>
                </TabsList>

                {/* Profile Tab */}
                <TabsContent value="profile" className="mt-4 space-y-4">
                    <Card>
                        <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle className="text-lg">Profile Details</CardTitle>
                                    <CardDescription className="text-xs">Your personal information</CardDescription>
                                </div>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => router.push('/mobile/edit-profile')}
                                    className="rounded-xl"
                                >
                                    <IconEdit className="w-4 h-4 mr-1" />
                                    Edit
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/30">
                                <div className="p-2.5 rounded-lg bg-primary/10">
                                    <IconUser className="w-5 h-5 text-primary" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Full Name</p>
                                    <p className="font-semibold truncate">{profile.full_name || 'Not set'}</p>
                                </div>
                            </div>

                            <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/30">
                                <div className="p-2.5 rounded-lg bg-primary/10">
                                    <IconMail className="w-5 h-5 text-primary" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Email</p>
                                    <p className="font-semibold truncate">{profile.email}</p>
                                </div>
                            </div>

                            {profile.mobile_no && (
                                <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/30">
                                    <div className="p-2.5 rounded-lg bg-primary/10">
                                        <IconPhone className="w-5 h-5 text-primary" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Phone</p>
                                        <p className="font-semibold">{profile.mobile_no}</p>
                                    </div>
                                </div>
                            )}

                            {profile.designation?.name && (
                                <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/30">
                                    <div className="p-2.5 rounded-lg bg-primary/10">
                                        <IconBriefcase className="w-5 h-5 text-primary" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Designation</p>
                                        <p className="font-semibold">{profile.designation.name}</p>
                                    </div>
                                </div>
                            )}

                            {profile.date_of_birth && (
                                <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/30">
                                    <div className="p-2.5 rounded-lg bg-primary/10">
                                        <IconCalendar className="w-5 h-5 text-primary" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Date of Birth</p>
                                        <p className="font-semibold">{formatDate(profile.date_of_birth)}</p>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Security Tab */}
                <TabsContent value="security" className="mt-4 space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <IconLock className="w-5 h-5 text-primary" />
                                Change Password
                            </CardTitle>
                            <CardDescription className="text-xs">
                                Update your account password for security
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Form {...passwordForm}>
                                <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="space-y-4">
                                    <FormField
                                        control={passwordForm.control}
                                        name="currentPassword"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-sm">Current Password</FormLabel>
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
                                        control={passwordForm.control}
                                        name="newPassword"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-sm">New Password</FormLabel>
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
                                        control={passwordForm.control}
                                        name="confirmPassword"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-sm">Confirm New Password</FormLabel>
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
                                        className="w-full h-12 rounded-xl font-semibold"
                                        disabled={passwordStatus === 'loading'}
                                    >
                                        {passwordStatus === 'loading' ? (
                                            <>
                                                <IconLoader2 className="w-5 h-5 mr-2 animate-spin" />
                                                Updating...
                                            </>
                                        ) : passwordStatus === 'success' ? (
                                            <>
                                                <IconCheck className="w-5 h-5 mr-2" />
                                                Password Updated!
                                            </>
                                        ) : (
                                            <>
                                                <IconLock className="w-5 h-5 mr-2" />
                                                Update Password
                                            </>
                                        )}
                                    </Button>
                                </form>
                            </Form>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* Pending Photo Warning Dialog */}
            <Dialog open={isPendingDialogOpen} onOpenChange={setIsPendingDialogOpen}>
                <DialogContent className="max-w-xs mx-auto rounded-3xl">
                    <DialogHeader className="text-center">
                        <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                            <IconClock className="w-8 h-8 text-amber-600" />
                        </div>
                        <DialogTitle>Photo Update Pending</DialogTitle>
                        <DialogDescription className="text-center">
                            Your previous photo update request is still awaiting admin approval. You cannot submit a new photo until it&apos;s reviewed.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="sm:justify-center">
                        <Button
                            onClick={() => setIsPendingDialogOpen(false)}
                            className="w-full rounded-xl"
                        >
                            Got it
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
