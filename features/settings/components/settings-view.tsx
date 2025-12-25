"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { DashboardPageLayout } from '@/components/dashboard/dashboard-page-layout';
import { ProfilePictureSettings } from './profile-picture-settings';
import { ProfileInformationSettings } from './profile-information-settings';
import { SecuritySettings } from './security-settings';
import { Image, User, Lock } from 'lucide-react';
import { Profile } from '@/types';

interface SettingsViewProps {
    user: Profile | null;
}

export function SettingsView({ user }: SettingsViewProps) {
    return (
        <DashboardPageLayout
            heading="Profile"
            description="Manage your account profile and security settings."
        >
            <div className="max-w-2xl mx-auto">
                <Card className="shadow-lg">
                    <CardContent className="p-6">
                        <Tabs defaultValue="picture" orientation="horizontal" className="w-full flex flex-col gap-6">
                            <div className="flex justify-center">
                                <TabsList className="inline-flex h-auto items-center justify-center bg-muted p-1 text-muted-foreground rounded-lg gap-2">
                                    <TabsTrigger
                                        value="picture"
                                    >
                                        <Image className="h-4 w-4" />
                                        Profile Picture
                                    </TabsTrigger>
                                    <TabsTrigger
                                        value="information"
                                    >
                                        <User className="h-4 w-4" />
                                        Profile Information
                                    </TabsTrigger>
                                    <TabsTrigger
                                        value="security"
                                    >
                                        <Lock className="h-4 w-4" />
                                        Security
                                    </TabsTrigger>
                                </TabsList>
                            </div>

                            <div className="w-full">
                                <TabsContent value="picture" className="mt-0 space-y-6">
                                    {user && <ProfilePictureSettings user={user} />}
                                </TabsContent>
                                <TabsContent value="information" className="mt-0 space-y-6">
                                    {user && <ProfileInformationSettings user={user} />}
                                </TabsContent>
                                <TabsContent value="security" className="mt-0 space-y-6">
                                    <SecuritySettings />
                                </TabsContent>
                            </div>
                        </Tabs>
                    </CardContent>
                </Card>
            </div>
        </DashboardPageLayout>
    )
}
