"use client"
import dynamic from 'next/dynamic'
import { useParams } from 'next/navigation'

const ComplaintDetailPage = dynamic(() => import('@/features/complaints/components/complaint-detail-page'), { ssr: false })

export default function ModeratorComplaintDetailPage() {
  const params = useParams()
  return <ComplaintDetailPage complaintId={params.id as string} basePath="/moderator" />
}
