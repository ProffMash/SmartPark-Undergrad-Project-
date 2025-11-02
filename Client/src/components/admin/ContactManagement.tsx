import React, { useState } from 'react';
import { Mail, Calendar, CheckCircle, Clock, Download } from 'lucide-react';
import { exportFromStore } from '../../utils/exportHelpers';
import { useAppStore } from '../../stores/appStore';
import { format, isValid } from 'date-fns';

export const ContactManagement: React.FC = () => {
  const { contacts, updateContact } = useAppStore();
  const [exportType, setExportType] = useState<'csv'|'pdf'>('csv');

  const handleStatusChange = (contactId: number | string, newStatus: string) => {
    updateContact(contactId, { status: newStatus } as any);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'new':
        return 'bg-blue-100 text-blue-800';
      case 'contacted':
        return 'bg-yellow-100 text-yellow-800';
      case 'resolved':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'new':
        return <Mail className="h-4 w-4 text-blue-600" />;
      case 'contacted':
        return <Clock className="h-4 w-4 text-yellow-600" />;
      case 'resolved':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      default:
        return <Mail className="h-4 w-4 text-gray-600" />;
    }
  };

  const newContacts = contacts.filter(c => String(c.status) === 'new').length;
  const contactedContacts = contacts.filter(c => String(c.status) === 'contacted').length;
  const resolvedContacts = contacts.filter(c => String(c.status) === 'resolved').length;

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
  <div className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Contact Management</h1>
            <p className="text-gray-600">Manage inquiries from the contact form</p>
          </div>
          <div className="flex items-center space-x-2">
            <select
              value={exportType}
              onChange={(e) => setExportType(e.target.value as 'csv'|'pdf')}
              className="text-sm border border-gray-300 rounded px-2 py-2"
              title="Export type"
            >
              <option value="csv">CSV</option>
              <option value="pdf">PDF</option>
            </select>
            <button
              onClick={() => exportFromStore('contacts', { contacts }, exportType)}
              className="bg-white border px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-2"
            >
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">Export Contacts</span>
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6">
            <div className="flex items-center">
              <div className="p-3 rounded-lg bg-blue-100">
                <Mail className="h-6 w-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">New</p>
                <p className="text-xl sm:text-2xl font-bold text-gray-900">{newContacts}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6">
            <div className="flex items-center">
              <div className="p-3 rounded-lg bg-yellow-100">
                <Clock className="h-6 w-6 text-yellow-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Contacted</p>
                <p className="text-xl sm:text-2xl font-bold text-gray-900">{contactedContacts}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 sm:col-span-2 lg:col-span-1">
            <div className="flex items-center">
              <div className="p-3 rounded-lg bg-green-100">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Resolved</p>
                <p className="text-xl sm:text-2xl font-bold text-gray-900">{resolvedContacts}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Contacts List */}
        {contacts.length === 0 ? (
          <div className="bg-white rounded-xl shadow-lg p-12 text-center">
            <Mail className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No Contact Inquiries</h3>
            <p className="text-gray-600">No contact form submissions have been received yet.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {contacts.map((contact) => {
              const created = contact.createdAt ? new Date(contact.createdAt) : null;

              return (
              <div key={contact.id} className="bg-white rounded-xl shadow-lg p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between space-y-3 sm:space-y-0 mb-4">
                  <div className="flex-1">
                    <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-3 mb-3">
                      {getStatusIcon(String(contact.status || ''))}
                      <div>
                        <h3 className="text-base sm:text-lg font-semibold text-gray-900">{contact.name}</h3>
                        <p className="text-sm text-gray-600">{contact.email}</p>
                      </div>
                    </div>
                    
                    <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-4 mb-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(String(contact.status || ''))}`}>
                        {contact.status ?? '—'}
                      </span>
                      <div className="flex items-center space-x-1 text-sm text-gray-600">
                        <Calendar className="h-3 w-3" />
                        <span>{created && isValid(created) ? format(created, 'MMM dd, yyyy HH:mm') : '—'}</span>
                      </div>
                    </div>
                  </div>

                  <select
                    value={contact.status}
                    onChange={(e) => handleStatusChange(contact.id, e.target.value)}
                    className="text-sm border border-gray-300 rounded-lg px-3 py-2 w-full sm:w-auto"
                  >
                    <option value="new">New</option>
                    <option value="contacted">Contacted</option>
                    <option value="resolved">Resolved</option>
                  </select>
                </div>

                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-medium text-gray-900 mb-2">Message:</h4>
                  <p className="text-gray-700 leading-relaxed break-words">{contact.message}</p>
                </div>

                <div className="mt-4 flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3">
                  <a
                    href={`mailto:${contact.email}?subject=Re: Your SmartPark Inquiry`}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center justify-center space-x-2"
                  >
                    <Mail className="h-4 w-4" />
                    <span>Reply via Email</span>
                  </a>
                </div>
              </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};