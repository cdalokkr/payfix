import type { Metadata } from 'next'
import { DashboardLayout } from '@/components/dashboard/dashboard-layout'
import { ErrorBoundary } from '@/components/ui/error-boundary'
import { getCachedDehydratedState } from '@/lib/trpc/hydration'
import { HydrationBoundary } from '@tanstack/react-query'

export const metadata: Metadata = {
    title: 'User Dashboard',
    description: 'Your personal dashboard',
    keywords: ['user', 'dashboard', 'profile', 'activities'],
}

interface UserLayoutProps {
    children: React.ReactNode
}

export default async function UserLayout({ children }: UserLayoutProps) {
    // Prefetch critical data for the dashboard to eliminate initial loading skeletons
    const dehydratedState = await getCachedDehydratedState(async (client, queryClient) => {
        await queryClient.prefetchQuery({
            queryKey: [['profile', 'get'], { type: 'query' }],
            queryFn: () => client.profile.get(),
        });
    });

    return (
        <ErrorBoundary>
            <HydrationBoundary state={dehydratedState}>
                <DashboardLayout>
                    {children}
                </DashboardLayout>
            </HydrationBoundary>
        </ErrorBoundary>
    )
}
