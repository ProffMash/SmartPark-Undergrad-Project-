import React, { useEffect, useMemo, useState } from 'react';
import { Users, Edit3, UserCheck, UserX, Car, Mail, Phone, Download } from 'lucide-react';
import { exportFromStore } from '../../utils/exportHelpers';
import { useAppStore } from '../../stores/appStore';
import { User } from '../../types';
import { format, isValid } from 'date-fns';
import usersApi, { ApiUser } from '../../API/usersApi';

export const UserManagement: React.FC = () => {
  const { users, updateUser } = useAppStore();
  const { setUsers } = useAppStore();
  const [exportType, setExportType] = useState<'csv'|'pdf'>('csv');
  const [editingUser, setEditingUser] = useState<number | string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    username: '',
    role: 'user',
    vehicleNumber: '',
    vehicleModel: '',
    vehicleType: '',
    isActive: true
  });

  const regularUsers = users.filter(user => user.role === 'user');
  const adminUsers = users.filter(user => user.role === 'admin');

  const [activeTab, setActiveTab] = useState<'all' | 'users' | 'admins'>('users');

  const filteredUsers = activeTab === 'all' ? users : (activeTab === 'users' ? regularUsers : adminUsers);

  // Pagination 
  const ROWS_PER_PAGE = 6;
  const [currentPage, setCurrentPage] = useState<number>(1);
  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / ROWS_PER_PAGE));

  useEffect(() => {
    // reset to first page when filter/tab changes
    setCurrentPage(1);
  }, [activeTab]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [filteredUsers.length, currentPage, totalPages]);

  const paginatedUsers = useMemo(() => {
    const start = (currentPage - 1) * ROWS_PER_PAGE;
    return filteredUsers.slice(start, start + ROWS_PER_PAGE);
  }, [filteredUsers, currentPage]);

  const handleEdit = (user: User) => {
    setFormData({
      username: (user as any).username || '',
      role: user.role || 'user',
      name: user.name,
      phone: user.phone,
      vehicleNumber: user.vehicleNumber,
      vehicleModel: user.vehicleModel || '',
      vehicleType: user.vehicleType,
      isActive: user.isActive
    });
    setEditingUser(user.id);
  };

  const handleSave = () => {
    if (editingUser !== null) {
      // Prepare local (app) update and API payload
      const localUpdates = {
        name: (formData as any).name,
        phone: (formData as any).phone,
        vehicleNumber: (formData as any).vehicleNumber,
        vehicleModel: (formData as any).vehicleModel,
        vehicleType: (formData as any).vehicleType,
        isActive: (formData as any).isActive,
        role: (formData as any).role,
      } as Partial<User>;

      updateUser(editingUser, localUpdates);

      const apiPayload = {
        username: (formData as any).username,
        name: (formData as any).name,
        phone: (formData as any).phone,
        vehicle_number: (formData as any).vehicleNumber,
        vehicle_model: (formData as any).vehicleModel,
        vehicle_type: (formData as any).vehicleType,
        is_active: (formData as any).isActive,
        role: (formData as any).role,
      };

      usersApi.updateUser(editingUser, apiPayload).catch(() => {
        // On failure, refetch users to reconcile.
        fetchAndSyncUsers();
      });
    }
    setEditingUser(null);
  };

  const handleCancel = () => {
    setEditingUser(null);
  };

  const toggleUserStatus = (userId: number | string, currentStatus: boolean) => {
    // Optimistic UI
    updateUser(userId, { isActive: !currentStatus });
    usersApi.updateUser(userId, { is_active: !currentStatus }).catch(() => {
      fetchAndSyncUsers();
    });
  };

  // Convert API user shape to app User shape
  const mapApiUserToApp = (apiUser: ApiUser): User => ({
    id: apiUser.id,
    name: apiUser.name || apiUser.username || apiUser.email,
    email: apiUser.email,
    phone: apiUser.phone || '',
    vehicleNumber: apiUser.vehicle_number || '',
    vehicleModel: apiUser.vehicle_model || undefined,
    vehicleType: (apiUser.vehicle_type as any) || 'regular',
    role: (apiUser.role as any) === 'admin' ? 'admin' : 'user',
    isActive: apiUser.is_active ?? true,
    createdAt: apiUser.created_at || new Date().toISOString(),
  });

  const fetchAndSyncUsers = async () => {
    try {
      const data = await usersApi.fetchUsers();
      const mapped = data.map(mapApiUserToApp);
      setUsers(mapped);
    } catch (err) {
      // Failed to fetch users; keep local state (mock data)
      // Optionally, you could show a notification here.
      // console.error('Failed to fetch users', err);
    }
  };

  useEffect(() => {
    fetchAndSyncUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
          <div className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">User Management</h1>
            <p className="text-gray-600">Manage registered users and their accounts</p>
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
              onClick={() => exportFromStore('users', { users }, exportType)}
              className="bg-white border px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-2"
            >
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">Export Users</span>
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="px-4 sm:px-6 py-4 border-b bg-gray-50">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Registered Users</h3>
              <div className="flex items-center space-x-2 text-sm text-gray-600">
                <Users className="h-4 w-4" />
                <span>{users.length} total</span>
              </div>
            </div>

            <div className="mt-3">
              <nav className="-mb-px flex space-x-6" aria-label="Tabs">
                <button
                  onClick={() => setActiveTab('all')}
                  className={`pb-2 text-sm font-medium ${activeTab === 'all' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600'}`}
                >
                  All ({users.length})
                </button>
                <button
                  onClick={() => setActiveTab('users')}
                  className={`pb-2 text-sm font-medium ${activeTab === 'users' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600'}`}
                >
                  Users ({regularUsers.length})
                </button>
                <button
                  onClick={() => setActiveTab('admins')}
                  className={`pb-2 text-sm font-medium ${activeTab === 'admins' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600'}`}
                >
                  Admins ({adminUsers.length})
                </button>
              </nav>
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50 hidden sm:table-header-group">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Contact
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Vehicle
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Joined
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {paginatedUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50 block sm:table-row border-b sm:border-b-0">
                    {editingUser === user.id ? (
                      <td colSpan={6} className="px-4 sm:px-6 py-4 block sm:table-cell">
                        <div className="bg-blue-50 p-4 rounded-lg">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
                              <input
                                type="text"
                                value={(formData as any).username}
                                onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                              <select
                                value={(formData as any).role}
                                onChange={(e) => setFormData(prev => ({ ...prev, role: e.target.value }))}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              >
                                <option value="user">User</option>
                                <option value="admin">Admin</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                              <input
                                type="text"
                                value={formData.name}
                                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                              <input
                                type="tel"
                                value={formData.phone}
                                onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Vehicle Number</label>
                              <input
                                type="text"
                                value={formData.vehicleNumber}
                                onChange={(e) => setFormData(prev => ({ ...prev, vehicleNumber: e.target.value }))}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Vehicle Model</label>
                              <input
                                type="text"
                                value={(formData as any).vehicleModel}
                                onChange={(e) => setFormData(prev => ({ ...prev, vehicleModel: e.target.value }))}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Vehicle Type</label>
                              <select
                                value={formData.vehicleType}
                                onChange={(e) => setFormData(prev => ({ ...prev, vehicleType: e.target.value }))}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              >
                                <option value="sedan">Sedan</option>
                                <option value="suv">SUV</option>
                                <option value="hatchback">Hatchback</option>
                                <option value="truck">Truck</option>
                                <option value="motorcycle">Motorcycle</option>
                              </select>
                            </div>
                          </div>
                          
                          <div className="flex items-center space-x-2 mb-4">
                            <input
                              type="checkbox"
                              checked={formData.isActive}
                              onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
                              className="text-blue-600"
                            />
                            <label className="text-sm font-medium text-gray-700">Account Active</label>
                          </div>
                          
                          <div className="flex space-x-3">
                            <button
                              onClick={handleSave}
                              className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors flex-1 sm:flex-none text-center"
                            >
                              Save Changes
                            </button>
                            <button
                              onClick={handleCancel}
                              className="bg-gray-300 text-gray-700 px-4 py-2 rounded-lg font-medium hover:bg-gray-400 transition-colors flex-1 sm:flex-none text-center"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      </td>
                    ) : (
                      <>
                        <td className="px-4 sm:px-6 py-4 block sm:table-cell sm:whitespace-nowrap">
                          <div className="sm:hidden text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">User</div>
                          <div className="flex items-center">
                            <div className="flex-shrink-0 h-10 w-10">
                              <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center">
                                <Users className="h-5 w-5 text-gray-600" />
                              </div>
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-medium text-gray-900">{user.name} <span className="text-xs text-gray-400">{(user as any).username ? `@${(user as any).username}` : ''}</span></div>
                              <div className="text-sm text-gray-500">{user.email} <span className="ml-2 px-2 py-0.5 text-xs font-medium rounded bg-gray-100 text-gray-600">{user.role}</span></div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 sm:px-6 py-4 block sm:table-cell sm:whitespace-nowrap">
                          <div className="sm:hidden text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Contact</div>
                          <div className="space-y-1">
                            <div className="flex items-center text-sm text-gray-600">
                              <Mail className="h-3 w-3 mr-1" />
                              {user.email}
                            </div>
                            <div className="flex items-center text-sm text-gray-600">
                              <Phone className="h-3 w-3 mr-1" />
                              {user.phone}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 sm:px-6 py-4 block sm:table-cell sm:whitespace-nowrap">
                          <div className="sm:hidden text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Vehicle</div>
                          <div className="flex items-center space-x-2">
                            <Car className="h-4 w-4 text-gray-400" />
                            <div>
                              <div className="text-sm font-medium text-gray-900">{user.vehicleNumber}</div>
                              <div className="text-sm text-gray-500">{(user as any).vehicleModel ? `${(user as any).vehicleModel} • ` : ''}<span className="capitalize">{user.vehicleType}</span></div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 sm:px-6 py-4 block sm:table-cell sm:whitespace-nowrap">
                          <div className="sm:hidden text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Status</div>
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                            user.isActive 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {user.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-4 sm:px-6 py-4 block sm:table-cell sm:whitespace-nowrap text-sm text-gray-500">
                          <div className="sm:hidden text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Joined</div>
                          {user.createdAt && isValid(new Date(user.createdAt)) ? format(new Date(user.createdAt), 'MMM dd, yyyy') : '—'}
                        </td>
                        <td className="px-4 sm:px-6 py-4 block sm:table-cell sm:whitespace-nowrap text-sm font-medium">
                          <div className="sm:hidden text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Actions</div>
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => handleEdit(user)}
                              className="text-blue-600 hover:text-blue-700 transition-colors"
                            >
                              <Edit3 className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => toggleUserStatus(user.id, user.isActive)}
                              className={`transition-colors ${
                                user.isActive
                                  ? 'text-red-600 hover:text-red-700'
                                  : 'text-green-600 hover:text-green-700'
                              }`}
                            >
                              {user.isActive ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                            </button>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Pagination controls */}
          <div className="px-4 sm:px-6 py-3 border-t bg-white flex items-center justify-between">
            <div className="text-sm text-gray-600">
              Showing {filteredUsers.length === 0 ? 0 : (Math.min(currentPage * ROWS_PER_PAGE, filteredUsers.length) - ( (currentPage - 1) * ROWS_PER_PAGE))} of {filteredUsers.length}
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className={`px-3 py-1 rounded-md text-sm ${currentPage === 1 ? 'text-gray-400 bg-gray-100' : 'text-gray-700 bg-white shadow-sm hover:bg-gray-50'}`}
              >
                Prev
              </button>
              <div className="hidden sm:flex items-center space-x-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`px-3 py-1 rounded-md text-sm ${page === currentPage ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
                  >{page}</button>
                ))}
              </div>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className={`px-3 py-1 rounded-md text-sm ${currentPage === totalPages ? 'text-gray-400 bg-gray-100' : 'text-gray-700 bg-white shadow-sm hover:bg-gray-50'}`}
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};