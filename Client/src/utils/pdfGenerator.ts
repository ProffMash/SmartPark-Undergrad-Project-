import { jsPDF } from 'jspdf';
import { format, isValid } from 'date-fns';
import { Payment, Booking, ParkingSlot, User } from '../types';

export const generatePaymentReceipt = async (
  payment: Payment,
  booking: Booking,
  slot: ParkingSlot,
  user: User
): Promise<boolean> => {
  try {
    const pdf = new jsPDF();

    // Header
    pdf.setFontSize(20);
    pdf.setTextColor(37, 99, 235); // Blue color
    pdf.text('SmartPark', 20, 25);

    pdf.setFontSize(16);
    pdf.setTextColor(0, 0, 0);
    pdf.text('Payment Receipt', 20, 40);

    // Receipt details
    pdf.setFontSize(12);
    pdf.text(`Receipt #: ${payment.transactionId}`, 20, 60);
  const paymentDate = payment.createdAt ? new Date(payment.createdAt) : null;
  pdf.text(`Date: ${paymentDate && isValid(paymentDate) ? format(paymentDate, 'MMMM dd, yyyy HH:mm') : 'Unknown'}`, 20, 75);

    // Divider line
    pdf.setLineWidth(0.5);
    pdf.line(20, 85, 190, 85);

    // Customer Information
    pdf.setFontSize(14);
    pdf.text('Customer Information:', 20, 100);
    pdf.setFontSize(11);
    pdf.text(`Name: ${user.name}`, 25, 115);
    pdf.text(`Email: ${user.email}`, 25, 125);
    pdf.text(`Vehicle: ${user.vehicleNumber} (${user.vehicleType})`, 25, 135);

    // Booking Information
    pdf.setFontSize(14);
    pdf.text('Booking Details:', 20, 155);
    pdf.setFontSize(11);
    // Support both camelCase and snake_case for slot and booking using index signatures
    const slotNumber = slot.number || (slot as any)['slot_number'] || 'Unknown';
    const slotLocation = slot.location || 'Unknown';
    const startRaw = booking.startTime || (booking as any)['start_time'] || null;
    const endRaw = booking.endTime || (booking as any)['end_time'] || null;
    const start = startRaw ? new Date(startRaw) : null;
    const end = endRaw ? new Date(endRaw) : null;
    pdf.text(`Parking Slot: #${slotNumber}`, 25, 170);
    pdf.text(`Location: ${slotLocation}`, 25, 180);
    pdf.text(`Start Time: ${start && isValid(start) ? format(start, 'MMMM dd, yyyy HH:mm') : 'Unknown'}`, 25, 190);
    pdf.text(`End Time: ${end && isValid(end) ? format(end, 'MMMM dd, yyyy HH:mm') : 'Unknown'}`, 25, 200);

    // Payment Information
    pdf.setFontSize(14);
    pdf.text('Payment Information:', 20, 220);
    pdf.setFontSize(11);
  const method = payment.method ?? 'unknown';
  const status = payment.status ?? 'unknown';
  const prettyMethod = method.length ? method.charAt(0).toUpperCase() + method.slice(1) : 'Unknown';
  const prettyStatus = status.length ? status.charAt(0).toUpperCase() + status.slice(1) : 'Unknown';
  pdf.text(`Payment Method: ${prettyMethod}`, 25, 235);
  pdf.text(`Status: ${prettyStatus}`, 25, 245);

    // Amount (highlighted)
    pdf.setFontSize(16);
    pdf.setTextColor(37, 99, 235);
    pdf.text(`Total Amount: KSh ${payment.amount}`, 25, 265);

    // Footer
    pdf.setFontSize(10);
    pdf.setTextColor(100, 100, 100);
    pdf.text('Thank you for using SmartPark!', 20, 285);
    pdf.text('For support, contact us at support@smartpark.com', 20, 295);

    // Use jsPDF's save() which triggers a download in the browser reliably
    const fileName = `SmartPark_Receipt_${payment.transactionId}.pdf`;
    try {
      pdf.save(fileName);
      return true;
    } catch (e) {
      // Fallback to blob + anchor method if save() fails for any reason
      try {
        const blob = pdf.output('blob');
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        return true;
      } catch (e2) {
        // eslint-disable-next-line no-console
        console.error('Both pdf.save and blob fallback failed', e2);
        return false;
      }
    }
  } catch (error) {
    // Fallback: try to call save() if available, else rethrow
    // eslint-disable-next-line no-console
    console.error('Error generating PDF receipt:', error);
    try {
      // @ts-ignore
      const fallback = new jsPDF();
      // @ts-ignore
      fallback.save(`SmartPark_Receipt_${payment.transactionId}.pdf`);
      return true;
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Fallback PDF save also failed', e);
      return false;
    }
  }
};