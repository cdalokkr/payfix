"use client"
import dynamic from 'next/dynamic'
import { useParams } from 'next/navigation'

const TicketDetailPage = dynamic(() => import('@/features/complaints/components/ticket-detail-page'), { ssr: false })

export default function EmployeeTicketDetailPage() {
  const params = useParams()
  return <TicketDetailPage ticketId={params.id as string} basePath="/employee" isEmployeeView={true} />
}
