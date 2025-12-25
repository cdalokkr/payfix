import { Skeleton } from '@/components/ui/skeleton'

export default function AdminDashboardLoading() {
    return (
        <div className="min-h-screen bg-background">
            <div className="container mx-auto px-6 py-8">
                <div className="space-y-6 animate-pulse">
                    {/* Header skeleton */}
                    <div className="flex justify-between items-center">
                        <div className="space-y-2">
                            <Skeleton className="h-8 w-48" />
                            <Skeleton className="h-4 w-64" />
                        </div>
                    </div>

                    {/* Metrics grid skeleton */}
                    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
                        {[...Array(4)].map((_, i) => (
                            <div key={i} className="relative overflow-hidden rounded-xl border border-border/50 p-4 bg-background/60">
                                <div className="flex flex-col h-full justify-between gap-2">
                                    <div className="flex justify-between items-start">
                                        <Skeleton className="h-5 w-24" />
                                        <Skeleton className="h-10 w-10 rounded-md" />
                                    </div>
                                    <div>
                                        <Skeleton className="h-8 w-20 mb-1" />
                                        <Skeleton className="h-3 w-32" />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Quick actions skeleton */}
                    <div className="rounded-xl border border-border/50 p-4 bg-background/60">
                        <div className="flex flex-col gap-4">
                            <div>
                                <Skeleton className="h-6 w-32 mb-2" />
                                <Skeleton className="h-4 w-48" />
                            </div>
                            <div className="flex flex-wrap gap-3">
                                {[...Array(4)].map((_, i) => (
                                    <Skeleton key={i} className="h-10 w-28 rounded-md" />
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Recent activities skeleton */}
                    <div className="rounded-xl border border-border/50 p-4 bg-background/60">
                        <div className="flex flex-col gap-4">
                            <div>
                                <Skeleton className="h-6 w-40 mb-2" />
                                <Skeleton className="h-4 w-48" />
                            </div>
                            <div className="space-y-2">
                                {[...Array(5)].map((_, i) => (
                                    <div key={i} className="flex items-center space-x-3 p-2 rounded-lg bg-muted/30">
                                        <Skeleton className="h-6 w-6 rounded-full" />
                                        <div className="flex-1 space-y-1.5">
                                            <Skeleton className="h-3.5 w-3/4" />
                                            <Skeleton className="h-2.5 w-1/2" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}