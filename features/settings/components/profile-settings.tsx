"use client"

import { useState, useRef } from "react"
import { Profile } from "@/types"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { UserAvatarProfile } from "@/components/user-avatar-profile"
import { Camera, Edit, User, Mail, Shield, Calendar } from "lucide-react"
import { toast } from "sonner"
import { getDefaultAvatarUrl } from "@/lib/utils/avatar-helper"
import { ModernAddUserForm } from "@/features/users/components/ModernAddUserForm"
import { cn } from "@/lib/utils"

interface ProfileSettingsProps {
    user: Profile
}

export function ProfileSettings({ user }: ProfileSettingsProps) {
    const [isLoading, setIsLoading] = useState(false)
    const [avatarUrl, setAvatarUrl] = useState<string | null>(user.avatar_url || getDefaultAvatarUrl(user.sex))
    const [isEditFormOpen, setIsEditFormOpen] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        // Mock upload
        setIsLoading(true)
        try {
            // Simulate network delay
            await new Promise(resolve => setTimeout(resolve, 1500))

            // Create local preview URL
            const objectUrl = URL.createObjectURL(file)
            setAvatarUrl(objectUrl)
            toast.success("Profile picture updated successfully")
        } catch (error) {
            toast.error("Failed to update profile picture")
        } finally {
            setIsLoading(false)
        }
    }

    // Format date for display
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
        <div className="space-y-6">
            {/* 2-Column Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left Column - Avatar Card */}
                <Card className="relative overflow-hidden border-2 border-border/60 hover:border-primary/30 transition-all duration-300">
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 pointer-events-none" />
                    <CardHeader className="relative">
                        <CardTitle className="text-lg">Profile Picture</CardTitle>
                        <CardDescription>
                            Update your profile photo
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="relative flex flex-col items-center gap-6 pb-8">
                        <div className="relative group">
                            <div className="absolute -inset-1 bg-gradient-to-r from-primary to-accent rounded-full opacity-75 blur group-hover:opacity-100 transition duration-300" />
                            <div className="relative">
                                <UserAvatarProfile
                                    user={{ ...user, avatar_url: avatarUrl }}
                                    className="h-32 w-32 border-4 border-background"
                                />
                                <div
                                    className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    <Camera className="h-10 w-10 text-white" />
                                </div>
                            </div>
                            <input
                                type="file"
                                ref={fileInputRef}
                                className="hidden"
                                accept="image/*"
                                onChange={handleFileChange}
                            />
                        </div>
                        <Button
                            variant="outline"
                            size="lg"
                            className="w-full max-w-xs gap-2 hover:bg-primary/10 hover:border-primary/50 transition-colors"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isLoading}
                        >
                            <Camera className="h-4 w-4" />
                            {isLoading ? "Uploading..." : "Change Photo"}
                        </Button>
                    </CardContent>
                </Card>

                {/* Right Column - Profile Information Card */}
                <Card className="relative overflow-hidden border-2 border-border/60 hover:border-primary/30 transition-all duration-300">
                    <div className="absolute inset-0 bg-gradient-to-br from-accent/5 via-transparent to-primary/5 pointer-events-none" />
                    <CardHeader className="relative">
                        <CardTitle className="text-lg">Profile Information</CardTitle>
                        <CardDescription>
                            View and manage your personal details
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="relative space-y-6">
                        {/* User Details */}
                        <div className="space-y-4">
                            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted/70 transition-colors">
                                <User className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Full Name</p>
                                    <p className="text-sm font-semibold text-foreground truncate">{user.full_name || "Not set"}</p>
                                </div>
                            </div>

                            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted/70 transition-colors">
                                <Mail className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Email</p>
                                    <p className="text-sm font-semibold text-foreground truncate">{user.email}</p>
                                </div>
                            </div>

                            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted/70 transition-colors">
                                <Shield className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Role</p>
                                    <p className={cn(
                                        "text-sm font-semibold capitalize",
                                        user.role === 'admin' ? "text-primary" : "text-foreground"
                                    )}>
                                        {user.role === 'admin' ? 'Administrator' : 'Standard User'}
                                    </p>
                                </div>
                            </div>

                            {user.date_of_birth && (
                                <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted/70 transition-colors">
                                    <Calendar className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Date of Birth</p>
                                        <p className="text-sm font-semibold text-foreground">{formatDate(user.date_of_birth)}</p>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Edit Profile Button */}
                        <Button
                            size="lg"
                            className="w-full gap-2 bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary shadow-lg hover:shadow-xl transition-all duration-300"
                            onClick={() => setIsEditFormOpen(true)}
                        >
                            <Edit className="h-4 w-4" />
                            Edit Profile Data
                        </Button>
                    </CardContent>
                </Card>
            </div>

            {/* Edit Profile Form Sheet */}
            {isEditFormOpen && (
                <ModernAddUserForm
                    open={isEditFormOpen}
                    onOpenChange={setIsEditFormOpen}
                    editingUser={user}
                    useSheet={true}
                    isProfileMode={true}
                    onSuccess={() => {
                        setIsEditFormOpen(false)
                        toast.success("Profile updated successfully")
                    }}
                />
            )}
        </div>
    )
}

