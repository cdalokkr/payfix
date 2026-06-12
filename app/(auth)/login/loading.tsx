import { Skeleton } from '@/components/ui/skeleton'

export default function LoginLoading() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex flex-col">
            {/* Top Bar skeleton */}
            <header className="border-b bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm">
                <div className="container mx-auto px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Skeleton className="w-10 h-10 rounded-lg" />
                        <Skeleton className="h-8 w-32" />
                    </div>
                    <Skeleton className="h-9 w-9 rounded-md" />
                </div>
            </header>

            {/* Login Form skeleton */}
            <div className="flex-1 flex items-center justify-center p-4">
                <div className="w-full max-w-md">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-4">
                        <div className="text-center mb-3">
                            <div className="flex items-center justify-center gap-3 mb-2">
                                <Skeleton className="h-10 w-10 rounded-full" />
                                <Skeleton className="h-9 w-40" />
                            </div>
                            <Skeleton className="h-4 w-56 mx-auto" />
                        </div>

                        {/* Form fields skeleton */}
                        <div className="space-y-4 mt-6">
                            <div className="space-y-2">
                                <Skeleton className="h-4 w-16" />
                                <Skeleton className="h-10 w-full rounded-md" />
                            </div>
                            <div className="space-y-2">
                                <Skeleton className="h-4 w-20" />
                                <Skeleton className="h-10 w-full rounded-md" />
                            </div>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Skeleton className="h-4 w-4 rounded" />
                                    <Skeleton className="h-4 w-24" />
                                </div>
                                <Skeleton className="h-4 w-28" />
                            </div>
                            <Skeleton className="h-10 w-full rounded-md" />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}