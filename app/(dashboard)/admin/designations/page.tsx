import type { Metadata } from 'next'
import DesignationManagement from '@/features/users/components/designation-management'
import { getServerClient } from '@/lib/trpc/server-client'

export const metadata: Metadata = {
    title: 'Manage Designations - Admin Dashboard',
    description: 'Setup and manage job designations for the organization.',
    robots: 'noindex, nofollow',
}

export default async function DesignationsPage() {
    let initialData = undefined

    try {
        // Prefetch designations on the server for instant loading/hydration
        const trpc = await getServerClient()
        initialData = await trpc.admin.designation.getDesignations()
    } catch (error) {
        console.error('[DESIGNATIONS-PAGE] Prefetch failed:', error)
    }

    return <DesignationManagement initialData={initialData} />
}
