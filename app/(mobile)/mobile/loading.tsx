import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent } from "@/components/ui/card"

export default function MobileDashboardLoading() {
    return (
        <div className="space-y-6 animate-pulse">
            {/* Date Header Skeleton */}
            <div className="flex flex-col items-center gap-2 py-2">
                <Skeleton className="h-8 w-32 rounded-lg" />
                <Skeleton className="h-4 w-40 rounded-lg" />
            </div>

            {/* Status Hero Card Skeleton */}
            <Skeleton className="h-48 w-full rounded-3xl" />

            {/* Action Button Skeleton */}
            <Skeleton className="h-16 w-full rounded-2xl" />

            {/* Quick Actions Grid Skeleton */}
            <div className="grid grid-cols-2 gap-4">
                <Skeleton className="h-24 w-full rounded-2xl" />
                <Skeleton className="h-24 w-full rounded-2xl" />
            </div>

            {/* Recent Activity Skeleton */}
            <div className="space-y-4 pt-2">
                <Skeleton className="h-6 w-32 rounded-lg" />
                {[1, 2, 3].map((i) => (
                    <Card key={i} className="rounded-2xl border-none bg-slate-100 dark:bg-slate-800/50">
                        <CardContent className="p-4 flex items-center gap-4">
                            <Skeleton className="h-10 w-10 rounded-full" />
                            <div className="flex-1 space-y-2">
                                <Skeleton className="h-4 w-3/4 rounded-lg" />
                                <Skeleton className="h-3 w-1/2 rounded-lg" />
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    )
}
