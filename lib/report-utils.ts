
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

// Helper: Generate PDF (dynamically imports jsPDF to reduce initial bundle size)
export const generatePDF = async (title: string, headers: string[], rows: string[][], filename: string) => {
    const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
        import('jspdf'),
        import('jspdf-autotable'),
    ])
    const doc = new jsPDF()

    // Handle multi-line title (first line = main title, rest = subtitle/meta)
    const titleLines = title.split('\n')
    let yPos = 22

    // Main title
    doc.setFontSize(18)
    doc.setTextColor(51, 51, 51)
    doc.text(titleLines[0], 14, yPos)
    yPos += 10

    // Subtitle lines (e.g. Employee Name / Designation)
    if (titleLines.length > 1) {
        doc.setFontSize(11)
        doc.setTextColor(80, 80, 80)
        for (let i = 1; i < titleLines.length; i++) {
            doc.text(titleLines[i], 14, yPos)
            yPos += 7
        }
        yPos += 1
    }

    // Date
    doc.setFontSize(10)
    doc.setTextColor(128, 128, 128)
    doc.text(`Generated on: ${formatDate(new Date(), "MMM dd, yyyy 'at' HH:mm:ss")}`, 14, yPos)
    yPos += 10

    // Table
    autoTable(doc, {
        head: [headers],
        body: rows,
        startY: yPos,
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
