import React, { useState } from 'react';
import { Download, FileText, Table, Calendar, Users, CreditCard, Mail } from 'lucide-react';
import { useAppStore } from '../../stores/appStore';
import jsPDF from 'jspdf';
import { unparse } from 'papaparse';
import { format } from 'date-fns';

export const DataExport: React.FC = () => {
  const { users, slots, bookings, payments, tickets, contacts } = useAppStore();
  const [isExporting, setIsExporting] = useState(false);
  const [exportType, setExportType] = useState<'pdf' | 'csv'>('csv');

  const exportData = async (dataType: string) => {
    setIsExporting(true);
    
    // Simulate export delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    let data: any[] = [];
    let filename = '';

    switch (dataType) {
      case 'users':
        data = users.filter(u => u.role === 'user').map(u => ({
          Name: u.name,
          Email: u.email,
          Phone: u.phone,
          Vehicle: u.vehicleNumber,
          'Vehicle Type': u.vehicleType,
          Status: u.isActive ? 'Active' : 'Inactive',
          'Created At': format(new Date(u.createdAt), 'yyyy-MM-dd HH:mm')
        }));
        filename = 'users';
        break;
      case 'slots':
        data = slots.map(s => ({
          'Slot Number': s.number,
          Location: s.location,
          'Price per Hour': s.price,
          Type: s.type,
          Status: s.isBooked ? 'Booked' : 'Available',
          Facilities: s.facilities.join(', '),
          'Created At': format(new Date(s.createdAt), 'yyyy-MM-dd HH:mm')
        }));
        filename = 'parking-slots';
        break;
      case 'bookings':
        data = bookings.map(b => {
          const user = users.find(u => u.id === b.userId);
          const slot = slots.find(s => s.id === b.slotId);
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
        });
        filename = 'bookings';
        break;
      case 'payments':
        data = payments.map(p => {
          const user = users.find(u => u.id === p.userId);
          return {
            'Transaction ID': p.transactionId,
            User: user?.name || 'Unknown',
            Amount: p.amount,
            Method: p.method,
            Status: p.status,
            'Created At': format(new Date(p.createdAt), 'yyyy-MM-dd HH:mm')
          };
        });
        filename = 'payments';
        break;
      case 'tickets':
        data = tickets.map(t => {
          const user = users.find(u => u.id === t.userId);
          return {
            Subject: t.subject,
            User: user?.name || 'Unknown',
            Priority: t.priority,
            Status: t.status,
            Message: t.message,
            Response: t.response || 'No response',
            'Created At': format(new Date(t.createdAt), 'yyyy-MM-dd HH:mm')
          };
        });
        filename = 'support-tickets';
        break;
      case 'contacts':
        data = contacts.map(c => ({
          Name: c.name,
          Email: c.email,
          Message: c.message,
          Status: c.status,
          'Created At': format(new Date(c.createdAt), 'yyyy-MM-dd HH:mm')
        }));
        filename = 'contact-inquiries';
        break;
      default:
        setIsExporting(false);
        return;
    }

    if (exportType === 'csv') {
      const csv = unparse(data);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${filename}_${format(new Date(), 'yyyy-MM-dd')}.csv`;
      link.click();
    } else {
      const pdf = new jsPDF();
      pdf.setFontSize(16);
      pdf.text(`SmartPark ${filename.charAt(0).toUpperCase() + filename.slice(1)} Report`, 20, 20);
      pdf.setFontSize(10);
      pdf.text(`Generated on: ${format(new Date(), 'MMMM dd, yyyy')}`, 20, 35);
      
      let yPosition = 50;
      data.forEach((item, index) => {
        if (yPosition > 270) {
          pdf.addPage();
          yPosition = 20;
        }
        
        pdf.text(`${index + 1}. ${Object.values(item).join(' | ')}`, 20, yPosition);
        yPosition += 10;
      });
      
      pdf.save(`${filename}_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    }

    setIsExporting(false);
  };

  const exportOptions = [
    { 
      key: 'users', 
      label: 'User Data', 
      icon: Users, 
      description: 'Export all user information and profiles',
      count: users.filter(u => u.role === 'user').length
    },
    { 
      key: 'slots', 
      label: 'Parking Slots', 
      icon: Table, 
      description: 'Export parking slot details and availability',
      count: slots.length
    },
    { 
      key: 'bookings', 
      label: 'Bookings', 
      icon: Calendar, 
      description: 'Export booking history and reservations',
      count: bookings.length
    },
    { 
      key: 'payments', 
      label: 'Payments', 
      icon: CreditCard, 
      description: 'Export payment transactions and revenue data',
      count: payments.length
    },
    { 
      key: 'tickets', 
      label: 'Support Tickets', 
      icon: FileText, 
      description: 'Export support tickets and user issues',
      count: tickets.length
    },
    { 
      key: 'contacts', 
      label: 'Contact Inquiries', 
      icon: Mail, 
      description: 'Export contact form submissions',
      count: contacts.length
    }
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Data Export</h1>
          <p className="text-gray-600">Export system data for reporting and analysis</p>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 mb-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Export Format</h3>
          <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4">
            <label className="flex items-center">
              <input
                type="radio"
                value="csv"
                checked={exportType === 'csv'}
                onChange={(e) => setExportType(e.target.value as 'csv' | 'pdf')}
                className="mr-2 text-blue-600"
              />
              <span className="text-gray-700">CSV (Excel Compatible)</span>
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                value="pdf"
                checked={exportType === 'pdf'}
                onChange={(e) => setExportType(e.target.value as 'csv' | 'pdf')}
                className="mr-2 text-blue-600"
              />
              <span className="text-gray-700">PDF Report</span>
            </label>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
          {exportOptions.map((option) => {
            const Icon = option.icon;
            
            return (
              <div key={option.key} className="bg-white rounded-xl shadow-lg p-4 sm:p-6">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="p-3 rounded-lg bg-blue-100">
                    <Icon className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-semibold text-gray-900">{option.label}</h3>
                    <p className="text-sm text-gray-600">{option.count} records</p>
                  </div>
                </div>
                
                <p className="text-gray-600 text-sm mb-6">{option.description}</p>
                
                <button
                  onClick={() => exportData(option.key)}
                  disabled={isExporting || option.count === 0}
                  className="w-full bg-blue-600 text-white px-4 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                >
                  {isExporting ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  ) : (
                    <>
                      <Download className="h-4 w-4" />
                      <span>Export {exportType.toUpperCase()}</span>
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>

        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-xl p-4 sm:p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-2">Export Information</h3>
          <div className="text-sm text-blue-800 space-y-1">
            <p>• CSV files can be opened in Excel, Google Sheets, or any spreadsheet application</p>
            <p>• PDF reports provide a formatted view suitable for printing and sharing</p>
            <p>• All exports include data as of {format(new Date(), 'MMMM dd, yyyy at HH:mm')}</p>
          </div>
        </div>
      </div>
    </div>
  );
};