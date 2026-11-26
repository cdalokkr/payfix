import type { Metadata } from 'next'
import NiyamoLanding from '@/components/landing/NiyamoLanding'

export const metadata: Metadata = {
  title: 'NIYAMO — Biometric Attendance, Geofencing & Automated Payroll Cloud',
  description:
    'Multi-tenant workforce platform unifying AI face verification, entrance kiosks, GPS geofencing, eSSL hardware sync, shift rostering, and automated payroll.',
}

export default async function HomePage() {
  return <NiyamoLanding />
}
