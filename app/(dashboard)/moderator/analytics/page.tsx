import { Metadata } from "next"
import { ModeratorAnalyticsView } from "@/features/reports/components/moderator-analytics-view"
import { getCachedDehydratedState } from "@/lib/trpc/hydration"
import { HydrationBoundary } from "@tanstack/react-query"
import { DASHBOARD_QUERY_PARAMS } from "@/lib/dashboard-config"

export const metadata: Metadata = {
    title: "Analytics | Moderator",
    description: "System analytics and reports for moderators",
}

export default async function ModeratorAnalyticsPage() {
    // Prefetch critical data for the moderator analytics view
    const dehydratedState = await getCachedDehydratedState(async (client, queryClient) => {
        await Promise.all([
            // Prefetch user profile
            queryClient.prefetchQuery({
                queryKey: [['profile', 'get'], { type: 'query' }],
                queryFn: () => client.profile.get(),
            }),
            // Prefetch moderator reports data with default 30 days
            queryClient.prefetchQuery({
                queryKey: [['moderator', 'reports', 'getReportsData'], {
                    input: { days: 30, startDate: undefined, endDate: undefined },
                    type: 'query'
                }],
                queryFn: () => client.moderator.reports.getReportsData({
                    days: 30,
                    startDate: undefined,
                    endDate: undefined
                }),
            }),
            // Prefetch unified dashboard data used by the realtime hook (moderators can access this optimized endpoint)
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
            <ModeratorAnalyticsView />
        </HydrationBoundary>
    )
}
