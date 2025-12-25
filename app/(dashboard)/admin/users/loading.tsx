import { Skeleton } from '@/components/ui/skeleton'

export default function UsersPageLoading() {
    return (
        <div className="space-y-6 px-4 sm:px-6 lg:px-8">
            {/* Page Header skeleton */}
            <div className="space-y-2">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-4 w-64" />
            </div>

            {/* User Table Card skeleton */}
            <div className="rounded-lg border bg-card shadow-lg">
                <div className="p-6 border-b">
                    <Skeleton className="h-6 w-32 mb-2" />
                    <Skeleton className="h-4 w-80" />
                </div>
                <div className="p-6">
                    {/* Toolbar skeleton */}
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <Skeleton className="h-10 w-64" />
                            <Skeleton className="h-10 w-24" />
                        </div>
                        <Skeleton className="h-10 w-32" />
                    </div>

                    {/* Table skeleton */}
                    <div className="rounded-md border">
                        {/* Table header */}
                        <div className="border-b bg-muted/50 p-4">
                            <div className="flex items-center gap-4">
                                <Skeleton className="h-4 w-4" />
                                <Skeleton className="h-4 w-32" />
                                <Skeleton className="h-4 w-48 ml-auto" />
                                <Skeleton className="h-4 w-24" />
                                <Skeleton className="h-4 w-20" />
                                <Skeleton className="h-4 w-16" />
                            </div>
                        </div>

                        {/* Table rows */}
                        {[...Array(10)].map((_, i) => (
                            <div key={i} className="border-b p-4 last:border-b-0">
                                <div className="flex items-center gap-4">
                                    <Skeleton className="h-4 w-4" />
                                    <div className="flex items-center gap-3">
                                        <Skeleton className="h-10 w-10 rounded-full" />
                                        <div className="space-y-1">
                                            <Skeleton className="h-4 w-32" />
                                            <Skeleton className="h-3 w-48" />
                                        </div>
                                    </div>
                                    <Skeleton className="h-4 w-32 ml-auto" />
                                    <Skeleton className="h-6 w-16 rounded-full" />
                                    <Skeleton className="h-6 w-16 rounded-full" />
                                    <Skeleton className="h-8 w-8 rounded-md" />
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Pagination skeleton */}
                    <div className="flex items-center justify-between mt-4">
                        <Skeleton className="h-4 w-48" />
                        <div className="flex items-center gap-2">
                            <Skeleton className="h-8 w-8" />
                            <Skeleton className="h-8 w-8" />
                            <Skeleton className="h-8 w-8" />
                            <Skeleton className="h-8 w-8" />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}