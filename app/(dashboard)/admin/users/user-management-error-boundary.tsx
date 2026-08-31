'use client'

import React, { Component, ErrorInfo, ReactNode } from 'react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { UserManagementSkeleton, UserManagementSkeletonVariant, UserManagementAnimationMode } from '@/components/dashboard/skeletons/user-management-skeleton'
import { AlertCircle, RefreshCw, Home } from 'lucide-react'
import Link from 'next/link'

interface Props {
    children: ReactNode
    fallback?: ReactNode
    onError?: (error: Error, errorInfo: ErrorInfo) => void
    showRecoveryOptions?: boolean
}

interface State {
    hasError: boolean
    error?: Error
    errorInfo?: ErrorInfo
    retryCount: number
    isRetrying: boolean
}

export class UserManagementErrorBoundary extends Component<Props, State> {
    private readonly maxRetries = 3
    private retryTimeoutId: NodeJS.Timeout | null = null

    public state: State = {
        hasError: false,
        retryCount: 0,
        isRetrying: false
    }

    public static getDerivedStateFromError(error: Error): State {
        return {
            hasError: true,
            error,
            retryCount: 0,
            isRetrying: false
        }
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        this.setState({
            error,
            errorInfo
        })

        // Call optional error handler
        this.props.onError?.(error, errorInfo)

        // Log error for debugging
        console.error('UserManagementErrorBoundary caught an error:', error, errorInfo)
    }

    public componentWillUnmount() {
        if (this.retryTimeoutId) {
            clearTimeout(this.retryTimeoutId)
        }
    }

    private handleRetry = () => {
        if (this.state.retryCount >= this.maxRetries) {
            return
        }

        this.setState(prevState => ({
            hasError: false,
            error: undefined,
            errorInfo: undefined,
            retryCount: prevState.retryCount + 1,
            isRetrying: true
        }))

        // Simulate retry delay for better UX
        this.retryTimeoutId = setTimeout(() => {
            this.setState({ isRetrying: false })
        }, 1000)
    }

    public render() {
        if (this.state.hasError) {
            // Custom fallback UI
            if (this.props.fallback) {
                return this.props.fallback
            }

            // Default error UI with recovery options
            const canRetry = this.state.retryCount < this.maxRetries

            return (
                <div className="p-6 space-y-6">
                    {/* Error Alert */}
                    <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription className="space-y-2">
                            <div>
                                <strong>User Management Error</strong>
                            </div>
                            <div className="text-sm">
                                {this.state.error?.message || 'An unexpected error occurred while loading the user management interface.'}
                            </div>
                            {process.env.NODE_ENV === 'development' && (
                                <details className="text-xs mt-2">
                                    <summary className="cursor-pointer">Error Details</summary>
                                    <pre className="mt-2 whitespace-pre-wrap text-red-200">
                                        {this.state.error?.stack}
                                    </pre>
                                </details>
                            )}
                        </AlertDescription>
                    </Alert>

                    {/* Recovery Options */}
                    <div className="flex flex-col sm:flex-row gap-4">
                        {/* Retry Button */}
                        {canRetry && (
                            <Button
                                onClick={this.handleRetry}
                                disabled={this.state.isRetrying}
                                variant="outline"
                                className="flex items-center gap-2"
                            >
                                <RefreshCw className={`h-4 w-4 ${this.state.isRetrying ? 'animate-spin' : ''}`} />
                                {this.state.isRetrying ? 'Retrying...' : `Retry (${this.state.retryCount}/${this.maxRetries})`}
                            </Button>
                        )}

                        {/* Go to Dashboard Button */}
                        <Link href="/admin">
                            <Button
                                variant="outline"
                                className="flex items-center gap-2"
                            >
                                <Home className="h-4 w-4" />
                                Back to Dashboard
                            </Button>
                        </Link>

                        {/* Refresh Page Button */}
                        <Button
                            onClick={() => window.location.reload()}
                            variant="outline"
                            className="flex items-center gap-2"
                        >
                            <RefreshCw className="h-4 w-4" />
                            Refresh Page
                        </Button>
                    </div>

                    {/* Loading State During Retry */}
                    {this.state.isRetrying && (
                        <div className="mt-6">
                            <h3 className="text-lg font-medium mb-4">Recovering user management interface...</h3>
                            <UserManagementSkeleton
                                variant={UserManagementSkeletonVariant.COMPACT}
                                animationMode={UserManagementAnimationMode.PULSE}
                                rowCount={4}
                                showHeader={true}
                                showSearchBar={false}
                                showFilters={false}
                                showCreateButton={false}
                                showActions={false}
                                showPagination={false}
                                ariaLabel="Recovering user management interface"
                            />
                        </div>
                    )}

                    {/* Max Retries Reached */}
                    {!canRetry && !this.state.isRetrying && (
                        <div className="mt-6 p-4 border rounded-lg bg-muted/30">
                            <h4 className="font-medium mb-2">Maximum retry attempts reached</h4>
                            <p className="text-sm text-muted-foreground mb-4">
                                The user management interface has failed to load after {this.maxRetries} attempts.
                                Please try refreshing the page or contact support if the issue persists.
                            </p>
                            <div className="flex gap-2">
                                <Button onClick={() => window.location.reload()} size="sm">
                                    Refresh Page
                                </Button>
                                <Link href="/admin">
                                    <Button variant="outline" size="sm">
                                        Return to Admin Dashboard
                                    </Button>
                                </Link>
                            </div>
                        </div>
                    )}

                    {/* Navigation Help */}
                    <div className="mt-6 p-4 border rounded-lg bg-muted/30">
                        <h4 className="font-medium mb-2">Alternative Actions</h4>
                        <ul className="text-sm text-muted-foreground space-y-1">
                            <li>• Use the navigation menu to access other admin features</li>
                            <li>• Try accessing the user list directly: <Link href="/admin/users" className="underline">/admin/users</Link></li>
                            <li>• Check the system status page for any known issues</li>
                        </ul>
                    </div>
                </div>
            )
        }

        return this.props.children
    }
}

export default UserManagementErrorBoundary
