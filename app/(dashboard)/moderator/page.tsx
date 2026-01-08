import { PageErrorBoundary } from '@/components/ui/error-boundary'
import { UserDashboardStreaming } from '@/components/dashboard/user-dashboard-streaming'

export default async function ModeratorDashboardPage() {
    return (
        <PageErrorBoundary>
            <UserDashboardStreaming />
        </PageErrorBoundary>
    )
}
