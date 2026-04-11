"use client"
import dynamic from 'next/dynamic'

const TicketsPage = dynamic(() => import('@/features/complaints/components/tickets-page'), { ssr: false })
export default function ModeratorTicketsPage() { return <TicketsPage basePath="/moderator" /> }
