"use client"
import dynamic from 'next/dynamic'

const ClientsPage = dynamic(() => import('@/features/complaints/components/clients-page'), { ssr: false })
export default function AdminClientsPage() { return <ClientsPage /> }
