"use client"

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Download, FileSpreadsheet, FileText, Loader2 } from 'lucide-react'

interface ExportActionsProps {
  month: number
  year: number
  summaryData: any[]
}

export function ExportActions({ month, year, summaryData }: ExportActionsProps) {
  const [isExportingExcel, setIsExportingExcel] = useState(false)
  const [isExportingPdf, setIsExportingPdf] = useState(false)

  const handleExportExcel = async () => {
    try {
      setIsExportingExcel(true)
      const XLSX = await import('xlsx')
      const worksheet = XLSX.utils.json_to_sheet(summaryData)
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, `Payroll_${month}_${year}`)
      XLSX.writeFile(workbook, `Payfix_Payroll_${month}_${year}.xlsx`)
    } catch (err) {
      console.error('[EXPORT] Failed to export Excel:', err)
    } finally {
      setIsExportingExcel(false)
    }
  }

  const handleExportPdf = async () => {
    try {
      setIsExportingPdf(true)
      const { jsPDF } = await import('jspdf')
      const autoTable = (await import('jspdf-autotable')).default

      const doc = new jsPDF()
      doc.setFontSize(16)
      doc.text(`Payroll Summary - ${month}/${year}`, 14, 20)

      const tableRows = summaryData.map((s, idx) => [
        idx + 1,
        s.profile_id || 'N/A',
        s.total_working_days || 0,
        s.total_present_days || 0,
        s.total_absent_days || 0,
        s.status || 'draft'
      ])

      autoTable(doc, {
        startY: 30,
        head: [['#', 'Profile ID', 'Working Days', 'Present', 'Absent', 'Status']],
        body: tableRows,
      })

      doc.save(`Payfix_Payslip_Summary_${month}_${year}.pdf`)
    } catch (err) {
      console.error('[EXPORT] Failed to export PDF:', err)
    } finally {
      setIsExportingPdf(false)
    }
  }

  return (
    <div className="flex items-center gap-3">
      <Button
        variant="outline"
        size="sm"
        onClick={handleExportExcel}
        disabled={isExportingExcel || !summaryData?.length}
        className="gap-2"
      >
        {isExportingExcel ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
        )}
        Export Excel
      </Button>

      <Button
        variant="outline"
        size="sm"
        onClick={handleExportPdf}
        disabled={isExportingPdf || !summaryData?.length}
        className="gap-2"
      >
        {isExportingPdf ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <FileText className="h-4 w-4 text-rose-600" />
        )}
        Download Payslips (PDF)
      </Button>
    </div>
  )
}
