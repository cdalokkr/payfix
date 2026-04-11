"use client"
import dynamic from 'next/dynamic'

const ComplaintsPage = dynamic(() => import('@/features/complaints/components/complaints-page'), { ssr: false })
export default function ModeratorComplaintsPage() { return <ComplaintsPage basePath="/moderator" /> }
