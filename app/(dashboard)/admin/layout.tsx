import type { Metadata } from 'next'
import { DashboardLayout } from '@/components/dashboard/dashboard-layout'
import { ErrorBoundary } from '@/components/ui/error-boundary'
import { getCachedDehydratedState } from '@/lib/trpc/hydration'
import { HydrationBoundary } from '@tanstack/react-query'

export const metadata: Metadata = {
  title: 'Admin Dashboard',
  description: 'Administrative dashboard for system management',
  keywords: ['admin', 'dashboard', 'management', 'users'],
}

interface AdminLayoutProps {
  children: React.ReactNode
}

export default async function AdminLayout({ children }: AdminLayoutProps) {
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