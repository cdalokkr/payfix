import type { Metadata } from 'next'
import { DashboardLayout } from '@/components/dashboard/dashboard-layout'
import { ErrorBoundary } from '@/components/ui/error-boundary'
import { getCachedDehydratedState } from '@/lib/trpc/hydration'
import { HydrationBoundary } from '@tanstack/react-query'

export const metadata: Metadata = {
    title: 'Moderator Dashboard',
    description: 'Administrative dashboard for system moderators',
    keywords: ['moderator', 'dashboard', 'management'],
}

export const instant = false

interface ModeratorLayoutProps {
    children: React.ReactNode
}

import { headers } from 'next/headers'
import { connection } from 'next/server'

export default async function ModeratorLayout({ children }: ModeratorLayoutProps) {
    await connection()

    // Prefetch critical data for the dashboard to eliminate initial loading skeletons
    const dehydratedState = await getCachedDehydratedState(async (client, queryClient) => {
        await Promise.all([
            queryClient.prefetchQuery({
                queryKey: [['profile', 'get'], { type: 'query' }],
                queryFn: () => client.profile.get(),
            }),
            queryClient.prefetchQuery({
                queryKey: [['organization', 'getBranding'], { type: 'query' }],
                queryFn: () => client.organization.getBranding(),
            }),
        ]);
    });

    const headerStore = await headers();
    const tenantBrand = headerStore.get('x-tenant-brand');
    const tenantLogo = headerStore.get('x-tenant-logo');
    const tenantLicenseExpiresAt = headerStore.get('x-tenant-license-expires-at');

    return (
        <ErrorBoundary>
            <HydrationBoundary state={dehydratedState}>
                <DashboardLayout 
                    tenantBrand={tenantBrand} 
                    tenantLogo={tenantLogo}
                    tenantLicenseExpiresAt={tenantLicenseExpiresAt}
                >
                    {children}
                </DashboardLayout>
            </HydrationBoundary>
        </ErrorBoundary>
    )
}
