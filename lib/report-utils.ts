
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { format as formatDate } from "date-fns"

// Helper: Generate CSV content
export const generateCSV = (headers: string[], rows: string[][]): string => {
    const csvContent = [
        headers.join(","),
        ...rows.map(row => row.map(cell => `"${(cell || '').replace(/"/g, '""')}"`).join(","))
    ].join("\n")
    return csvContent
}

// Helper: Download file
export const downloadFile = (content: string | Blob, filename: string, mimeType: string) => {
    const blob = content instanceof Blob ? content : new Blob([content], { type: mimeType })
    const link = document.createElement("a")
    const url = URL.createObjectURL(blob)
    link.setAttribute("href", url)
    link.setAttribute("download", filename)
    link.style.visibility = "hidden"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
}

// Helper: Generate PDF
export const generatePDF = (title: string, headers: string[], rows: string[][], filename: string) => {
    const doc = new jsPDF()

    // Title
    doc.setFontSize(18)
    doc.setTextColor(51, 51, 51)
    doc.text(title, 14, 22)

    // Date
    doc.setFontSize(10)
    doc.setTextColor(128, 128, 128)
    doc.text(`Generated on: ${formatDate(new Date(), "MMM dd, yyyy 'at' HH:mm:ss")}`, 14, 30)

    // Table
    autoTable(doc, {
        head: [headers],
        body: rows,
        startY: 40,
        styles: {
            fontSize: 8,
            cellPadding: 3,
        },
        headStyles: {
            fillColor: [66, 66, 66],
            textColor: 255,
            fontStyle: 'bold',
        },
        alternateRowStyles: {
            fillColor: [245, 245, 245],
        },
    })

    doc.save(filename)
}
