import type { Metadata } from 'next'
import { SetupPasswordView } from '@/features/auth/SetupPasswordView'
import { ErrorBoundary } from '@/components/ui/error-boundary'

export const metadata: Metadata = {
    title: 'Setup Initial Password - PayFix',
    description: 'Set your new personal password to access your PayFix workspace.',
    robots: 'noindex, nofollow',
}

export default function SetupPasswordPage() {
    return (
        <ErrorBoundary level="page">
            <SetupPasswordView />
        </ErrorBoundary>
    )
}
