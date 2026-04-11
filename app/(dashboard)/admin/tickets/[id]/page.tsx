"use client"
import dynamic from 'next/dynamic'
import { useParams } from 'next/navigation'

const TicketDetailPage = dynamic(() => import('@/features/complaints/components/ticket-detail-page'), { ssr: false })

export default function AdminTicketDetailPage() {
  const params = useParams()
  return <TicketDetailPage ticketId={params.id as string} basePath="/admin" />
}
