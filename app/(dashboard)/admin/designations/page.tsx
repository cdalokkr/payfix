import { redirect } from 'next/navigation'

export default function DesignationsPage() {
    redirect('/admin/departments?tab=designations')
}
