import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { unparse } from 'papaparse';
import { format } from 'date-fns';

// Generic CSV/PDF export helpers used across admin management pages
export type ExportType = 'csv' | 'pdf';

export function downloadCsv(data: any[], filename: string) {
  const csv = unparse(data);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}_${format(new Date(), 'yyyy-MM-dd')}.csv`;
  link.click();
}

export function downloadPdf(rows: any[], filename: string) {
  const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  const title = `SmartPark ${filename.charAt(0).toUpperCase() + filename.slice(1)} Report`;
  const generatedOn = `Generated on: ${format(new Date(), 'MMMM dd, yyyy')}`;

  // Header
  pdf.setFontSize(18);
  pdf.text(title, 40, 50);
  pdf.setFontSize(10);
  pdf.text(generatedOn, 40, 70);

  if (!rows || rows.length === 0) {
    pdf.setFontSize(12);
    pdf.text('No data available for this export.', 40, 100);
    pdf.save(`${filename}_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    return;
  }

  // Build table header and body from first row keys to keep column order stable
  const keys = Object.keys(rows[0]);
  const body = rows.map((r) => keys.map((k) => (r[k] === null || r[k] === undefined ? '' : String(r[k]))));

  // Compute simple totals for numeric-looking columns (Amount, Price per Hour)
  const totalsRow: (string | number)[] = new Array(keys.length).fill('');
  const numericKeys = ['Amount', 'Price per Hour'];
  let hasTotals = false;
  keys.forEach((k, idx) => {
    if (numericKeys.includes(k)) {
      const total = rows.reduce((sum, r) => sum + (Number(r[k]) || 0), 0);
      totalsRow[idx] = total.toFixed(2);
      hasTotals = true;
    }
  });

  // Use autotable to render a readable table with styling and alternating rows
  (pdf as any).autoTable({
    head: [keys],
    body,
    startY: 90,
    theme: 'striped',
    styles: {
      fontSize: 10,
      cellPadding: 6,
      overflow: 'linebreak'
    },
    headStyles: {
      fillColor: [30, 120, 150],
      textColor: 255,
      halign: 'left'
    },
    alternateRowStyles: { fillColor: [245, 249, 250] },
    columnStyles: keys.reduce((acc: any, key: string, i: number) => {
      // Right-align numeric columns
      if (numericKeys.includes(key)) {
        acc[i] = { halign: 'right' };
      }
      return acc;
    }, {}),
    didDrawPage: (data: any) => {
      // Footer with page number — prefer values provided by autotable's data when available
      const pageCount = data?.pageCount ?? (pdf as any).getNumberOfPages?.() ?? (pdf as any).internal?.pages?.length ?? 1;
      const currentPage = data?.pageNumber ?? data?.page ?? pageCount;
      pdf.setFontSize(9);
      const footerText = `Page ${currentPage} of ${pageCount}`;
      pdf.text(footerText, pageWidth - 100, pageHeight - 30, { align: 'left' });
    }
  });

  // If we computed totals, add a totals row after the table
  if (hasTotals) {
    const lastAuto = (pdf as any).lastAutoTable;
    const finalY = (lastAuto?.finalY ?? 0) + 10;
    (pdf as any).autoTable({
      head: [[{ content: 'Totals', colSpan: keys.length, styles: { halign: 'left', fillColor: [225, 235, 238] } }]],
      body: [totalsRow],
      startY: finalY || 90,
      theme: 'plain',
      styles: { fontSize: 10 }
    });
  }

  pdf.save(`${filename}_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
}

// A thin wrapper that chooses CSV or PDF
export function exportRows(rows: any[], filename: string, exportType: ExportType) {
  if (exportType === 'csv') {
    downloadCsv(rows, filename);
  } else {
    downloadPdf(rows, filename);
  }
}

// Mapping functions to shape store data to export rows for each key
export function shapeDataForExport(key: string, store: any): { rows: any[]; filename: string } {
  switch (key) {
    case 'users':
      return {
        rows: (store.users || []).filter((u: any) => u.role === 'user').map((u: any) => ({
          Name: u.name,
          Email: u.email,
          Phone: u.phone,
          Vehicle: u.vehicleNumber,
          'Vehicle Type': u.vehicleType,
          Status: u.isActive ? 'Active' : 'Inactive',
          'Created At': format(new Date(u.createdAt), 'yyyy-MM-dd HH:mm')
        })),
        filename: 'users'
      };
    case 'slots':
      return {
        rows: (store.slots || []).map((s: any) => ({
          'Slot Number': s.number,
          Location: s.location,
          'Price per Hour': s.price,
          Type: s.type,
          Status: s.isBooked ? 'Booked' : 'Available',
          Facilities: (s.facilities || []).join(', '),
          'Created At': format(new Date(s.createdAt), 'yyyy-MM-dd HH:mm')
        })),
        filename: 'parking-slots'
      };
    case 'bookings':
      return {
        rows: (store.bookings || []).map((b: any) => {
          const user = (store.users || []).find((u: any) => u.id === b.userId);
          const slot = (store.slots || []).find((s: any) => s.id === b.slotId);
          return {
            'Booking ID': b.id,
            User: user?.name || 'Unknown',
            'Slot Number': slot?.number || 'Unknown',
            'Start Time': format(new Date(b.startTime), 'yyyy-MM-dd HH:mm'),
            'End Time': format(new Date(b.endTime), 'yyyy-MM-dd HH:mm'),
            Status: b.status,
            Amount: b.amount,
            'Created At': format(new Date(b.createdAt), 'yyyy-MM-dd HH:mm')
          };
        }),
        filename: 'bookings'
      };
    case 'payments':
      return {
        rows: (store.payments || []).map((p: any) => {
          const user = (store.users || []).find((u: any) => u.id === p.userId);
          return {
            'Transaction ID': p.transactionId,
            User: user?.name || 'Unknown',
            Amount: p.amount,
            Method: p.method,
            Status: p.status,
            'Created At': format(new Date(p.createdAt), 'yyyy-MM-dd HH:mm')
          };
        }),
        filename: 'payments'
      };
    case 'tickets':
      return {
        rows: (store.tickets || []).map((t: any) => {
          const user = (store.users || []).find((u: any) => u.id === t.userId);
          return {
            Subject: t.subject,
            User: user?.name || 'Unknown',
            Priority: t.priority,
            Status: t.status,
            Message: t.message,
            Response: t.response || 'No response',
            'Created At': format(new Date(t.createdAt), 'yyyy-MM-dd HH:mm')
          };
        }),
        filename: 'support-tickets'
      };
    case 'contacts':
      return {
        rows: (store.contacts || []).map((c: any) => ({
          Name: c.name,
          Email: c.email,
          Message: c.message,
          Status: c.status,
          'Created At': format(new Date(c.createdAt), 'yyyy-MM-dd HH:mm')
        })),
        filename: 'contact-inquiries'
      };
    default:
      return { rows: [], filename: 'export' };
  }
}

export function exportFromStore(key: string, store: any, exportType: ExportType = 'csv') {
  const { rows, filename } = shapeDataForExport(key, store);
  if (!rows || rows.length === 0) {
    // nothing to export
    return;
  }
  exportRows(rows, filename, exportType);
}
