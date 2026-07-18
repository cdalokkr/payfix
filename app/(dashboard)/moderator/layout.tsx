import type { Metadata } from 'next'
import { DashboardLayout } from '@/components/dashboard/dashboard-layout'
import { ErrorBoundary } from '@/components/ui/error-boundary'
import { getCachedDehydratedState } from '@/lib/trpc/hydration'
import { HydrationBoundary } from '@tanstack/react-query'

export const metadata: Metadata = {
    title: 'Moderator Dashboard',
    description: 'Moderator dashboard for backoffice management',
    keywords: ['moderator', 'dashboard', 'backoffice'],
}

interface ModeratorLayoutProps {
    children: React.ReactNode
}

import { headers } from 'next/headers'

export default async function ModeratorLayout({ children }: ModeratorLayoutProps) {
    // Prefetch critical data for the dashboard to eliminate initial loading skeletons
    const dehydratedState = await getCachedDehydratedState(async (client, queryClient) => {
        await queryClient.prefetchQuery({
            queryKey: [['profile', 'get'], { type: 'query' }],
            queryFn: () => client.profile.get(),
        });
    });

    const headerStore = await headers();
    const tenantBrand = headerStore.get('x-tenant-brand');
    const tenantLicenseExpiresAt = headerStore.get('x-tenant-license-expires-at');

    return (
        <ErrorBoundary>
            <HydrationBoundary state={dehydratedState}>
                <DashboardLayout 
                    tenantBrand={tenantBrand} 
                    tenantLicenseExpiresAt={tenantLicenseExpiresAt}
                >
                    {children}
                </DashboardLayout>
            </HydrationBoundary>
        </ErrorBoundary>
    )
}
