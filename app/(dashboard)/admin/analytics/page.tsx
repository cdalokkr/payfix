import { Metadata } from "next"
import { AdminAnalyticsView } from "@/features/reports/components/admin-analytics-view"
import { getCachedDehydratedState } from "@/lib/trpc/hydration"
import { HydrationBoundary } from "@tanstack/react-query"
import { DASHBOARD_QUERY_PARAMS } from "@/lib/dashboard-config"

export const metadata: Metadata = {
    title: "Analytics | Admin Dashboard",
    description: "System analytics and overview",
}

export default async function AdminAnalyticsPage() {
    // Prefetch critical data for the analytics view
    const dehydratedState = await getCachedDehydratedState(async (client, queryClient) => {
        await Promise.all([
            // Prefetch user profile
            queryClient.prefetchQuery({
                queryKey: [['profile', 'get'], { type: 'query' }],
                queryFn: () => client.profile.get(),
            }),
            // Prefetch reports data with default 30 days
            queryClient.prefetchQuery({
                queryKey: [['admin', 'reports', 'getReportsData'], {
                    input: { days: 30, startDate: undefined, endDate: undefined },
                    type: 'query'
                }],
                queryFn: () => client.admin.reports.getReportsData({
                    days: 30,
                    startDate: undefined,
                    endDate: undefined
                }),
            }),
            // Prefetch unified dashboard data used by the realtime hook
            queryClient.prefetchQuery({
                queryKey: [['admin', 'dashboard', 'getUnifiedDashboardData'], {
                    input: DASHBOARD_QUERY_PARAMS,
                    type: 'query'
                }],
                queryFn: () => client.admin.dashboard.getUnifiedDashboardData(DASHBOARD_QUERY_PARAMS),
            }),
        ]);
    });

    return (
        <HydrationBoundary state={dehydratedState}>
            <AdminAnalyticsView />
        </HydrationBoundary>
    )
}
