import { format as formatDate } from "date-fns"
import { loadImageAsBase64 } from "@/lib/utils/tenant-logo-upload"

export interface TenantReportBranding {
    appName?: string | null;
    companyLegalName?: string | null;
    companyAddress?: string | null;
    city?: string | null;
    state?: string | null;
    pincode?: string | null;
    country?: string | null;
    contactEmail?: string | null;
    contactPhone?: string | null;
    website?: string | null;
    taxId?: string | null;
    logoUrl?: string | null;
    reportLogoHeight?: number | null;
    reportLogoAlignment?: 'left' | 'center' | 'right' | null;
    payslipNotes?: string | null;
}

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

/**
 * Adds official tenant letterhead with logo, business details, tax ID and report meta
 * Returns the adjusted Y position where table or content should start
 */
export async function addTenantPdfHeader(
    doc: any,
    branding?: TenantReportBranding | null,
    options?: {
        title: string;
        subtitle?: string;
        pageWidth?: number;
    }
): Promise<number> {
    const pageWidth = options?.pageWidth || doc.internal?.pageSize?.getWidth() || 210;
    const margin = 14;
    let yPos = 14;

    const companyName = branding?.companyLegalName || branding?.appName || 'PayFix';
    const logoHeight = branding?.reportLogoHeight || 20; // in mm
    const alignment = branding?.reportLogoAlignment || 'left';

    let logoAdded = false;
    let logoWidth = 0;

    // 1. Attempt to render logo
    if (branding?.logoUrl) {
        try {
            const imgData = await loadImageAsBase64(branding.logoUrl);
            if (imgData) {
                const aspectRatio = (imgData.width || 1) / (imgData.height || 1);
                logoWidth = Math.min(logoHeight * aspectRatio, 55); // Max width 55mm

                let logoX = margin;
                if (alignment === 'center') {
                    logoX = (pageWidth - logoWidth) / 2;
                } else if (alignment === 'right') {
                    logoX = pageWidth - margin - logoWidth;
                }

                doc.addImage(imgData.dataUrl, imgData.format, logoX, yPos, logoWidth, logoHeight);
                logoAdded = true;
            }
        } catch (e) {
            console.warn('[PDFHeader] Failed to embed tenant logo:', e);
        }
    }

    // 2. Render Company Name & Business Info
    if (alignment === 'center') {
        if (logoAdded) {
            yPos += logoHeight + 4;
        }
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(15);
        doc.setTextColor(30, 41, 59);
        doc.text(companyName, pageWidth / 2, yPos, { align: 'center' });
        yPos += 5;

        // Address & Tax Info
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(100, 116, 139);

        const addressParts = [
            branding?.companyAddress,
            [branding?.city, branding?.state, branding?.pincode].filter(Boolean).join(', '),
            branding?.country
        ].filter(Boolean).join(' • ');

        if (addressParts) {
            doc.text(addressParts, pageWidth / 2, yPos, { align: 'center' });
            yPos += 4;
        }

        const contactParts = [
            branding?.taxId ? `GSTIN/Tax ID: ${branding.taxId}` : null,
            branding?.contactPhone ? `Phone: ${branding.contactPhone}` : null,
            branding?.contactEmail ? `Email: ${branding.contactEmail}` : null,
        ].filter(Boolean).join(' | ');

        if (contactParts) {
            doc.text(contactParts, pageWidth / 2, yPos, { align: 'center' });
            yPos += 5;
        }
    } else {
        // Left logo or right logo layout
        const textX = logoAdded && alignment === 'left' ? margin + logoWidth + 5 : margin;
        const textMaxWidth = logoAdded ? pageWidth - margin * 2 - logoWidth - 8 : pageWidth - margin * 2;
        let textY = yPos + 4;

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.setTextColor(30, 41, 59);
        doc.text(companyName, textX, textY);
        textY += 5;

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(100, 116, 139);

        const fullAddress = [
            branding?.companyAddress,
            branding?.city,
            branding?.state,
            branding?.pincode,
        ].filter(Boolean).join(', ');

        if (fullAddress) {
            doc.text(doc.splitTextToSize(fullAddress, textMaxWidth), textX, textY);
            textY += 4;
        }

        const metaLine = [
            branding?.taxId ? `GSTIN: ${branding.taxId}` : null,
            branding?.contactPhone ? `Tel: ${branding.contactPhone}` : null,
            branding?.contactEmail ? branding.contactEmail : null,
            branding?.website ? branding.website : null,
        ].filter(Boolean).join(' • ');

        if (metaLine) {
            doc.text(doc.splitTextToSize(metaLine, textMaxWidth), textX, textY);
            textY += 4;
        }

        yPos = Math.max(textY, logoAdded ? yPos + logoHeight + 2 : textY);
    }

    // 3. Subtle horizontal divider line
    yPos += 2;
    doc.setDrawColor(226, 232, 240); // slate-200
    doc.setLineWidth(0.5);
    doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 6;

    // 4. Report Title & Generation timestamp
    const titleLines = (options?.title || 'Report').split('\n');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(15, 23, 42);
    doc.text(titleLines[0], margin, yPos);

    // Date on right
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(`Generated: ${formatDate(new Date(), "MMM dd, yyyy HH:mm")}`, pageWidth - margin, yPos, { align: 'right' });
    yPos += 5;

    // Subtitle if provided
    if (titleLines.length > 1 || options?.subtitle) {
        doc.setFontSize(9);
        doc.setTextColor(71, 85, 105);
        const sub = options?.subtitle || titleLines.slice(1).join(' - ');
        doc.text(sub, margin, yPos);
        yPos += 6;
    }

    return yPos + 2;
}

// Helper: Generate PDF with tenant branding
export const generatePDF = async (
    title: string,
    headers: string[],
    rows: string[][],
    filename: string,
    branding?: TenantReportBranding | null
) => {
    const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
        import('jspdf'),
        import('jspdf-autotable'),
    ])
    const doc = new jsPDF()

    // Add Branded Tenant Header
    const startY = await addTenantPdfHeader(doc, branding, { title });

    // Table
    autoTable(doc, {
        head: [headers],
        body: rows,
        startY: startY,
        styles: {
            fontSize: 8,
            cellPadding: 3,
        },
        headStyles: {
            fillColor: [30, 41, 59],
            textColor: 255,
            fontStyle: 'bold',
        },
        alternateRowStyles: {
            fillColor: [248, 250, 252],
        },
        margin: { left: 14, right: 14 },
    })

    // Custom payslip/report footer note if available
    if (branding?.payslipNotes) {
        const pageHeight = doc.internal.pageSize.getHeight();
        doc.setFontSize(7.5);
        doc.setTextColor(148, 163, 184);
        doc.text(branding.payslipNotes, 14, pageHeight - 10);
    }

    doc.save(filename)
}
