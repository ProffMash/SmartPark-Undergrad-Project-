import React, { useEffect, useMemo, useState } from 'react';
import { Users, Edit3, UserCheck, UserX, Car, Mail, Phone, Download } from 'lucide-react';
import { exportFromStore } from '../../utils/exportHelpers';
import { useAppStore } from '../../stores/appStore';
import { useAuthStore } from '../../stores/authStore';
import { User } from '../../types';
import { format, isValid } from 'date-fns';
import usersApi, { ApiUser } from '../../API/usersApi';
import { setAuthToken } from '../../API/apiClient';

export const UserManagement: React.FC<{ forceHideActions?: boolean }> = ({ forceHideActions = false }) => {
  const { users, updateUser } = useAppStore();
  const { setUsers } = useAppStore();
  const { user: currentUser } = useAuthStore();
  const isOperatorView = forceHideActions || currentUser?.role === 'operator';
  const [exportType, setExportType] = useState<'csv'|'pdf'>('csv');
  const [editingUser, setEditingUser] = useState<number | string | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [isImpersonating, setIsImpersonating] = useState<boolean>(false);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    role: 'user',
    vehicleNumber: '',
    vehicleModel: '',
    isActive: true
  });

  const regularUsers = users.filter(user => user.role === 'user');
  const adminUsers = users.filter(user => user.role === 'admin');
  const operatorUsers = users.filter(user => user.role === 'operator');

  const [activeTab, setActiveTab] = useState<'all' | 'users' | 'admins' | 'operators'>('users');

  const filteredUsers = useMemo(() => {
    switch (activeTab) {
      case 'all':
        return users;
      case 'users':
        return regularUsers;
      case 'admins':
        return adminUsers;
      case 'operators':
        return operatorUsers;
      default:
        return users;
    }
  }, [activeTab, users, regularUsers, adminUsers, operatorUsers]);

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
      role: user.role || 'user',
      name: user.name,
      phone: user.phone,
      vehicleNumber: user.vehicleNumber,
      vehicleModel: user.vehicleModel || '',
      isActive: user.isActive
    });
    setEditingUser(user.id);
    setShowEditModal(true);
  };

  const handleSave = () => {
    if (editingUser !== null) {
      // Prepare local (app) update and API payload
      const localUpdates = {
        name: (formData as any).name,
        phone: (formData as any).phone,
        vehicleNumber: (formData as any).vehicleNumber,
        vehicleModel: (formData as any).vehicleModel,
        isActive: (formData as any).isActive,
        role: (formData as any).role,
      } as Partial<User>;

      updateUser(editingUser, localUpdates);

      // Build API payload but omit empty string values to avoid server-side
      // validation errors (e.g. username cannot be blank).
      const rawPayload: Record<string, any> = {
        name: (formData as any).name,
        phone: (formData as any).phone,
        vehicle_number: (formData as any).vehicleNumber,
        vehicle_model: (formData as any).vehicleModel,
        is_active: (formData as any).isActive,
        role: (formData as any).role,
      };

      const apiPayload: Record<string, any> = {};
      Object.entries(rawPayload).forEach(([k, v]) => {
        // include booleans and non-empty strings; skip undefined/null/empty-string
        if (typeof v === 'boolean') {
          apiPayload[k] = v;
        } else if (v !== undefined && v !== null && String(v).trim() !== '') {
          apiPayload[k] = v;
        }
      });

      // If nothing changed (no payload keys), skip API call
      if (Object.keys(apiPayload).length > 0) {
        usersApi.updateUser(editingUser, apiPayload).catch(() => {
          // On failure, refetch users to reconcile.
          fetchAndSyncUsers();
        });
      }
    }
    setEditingUser(null);
    setShowEditModal(false);
  };

  const handleCancel = () => {
    setEditingUser(null);
    setShowEditModal(false);
  };

  useEffect(() => {
    if (!showEditModal) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showEditModal]);

  const IMPERSONATION_ADMIN_TOKEN_KEY = 'impersonation:admin_token';
  const IMPERSONATION_ADMIN_USER_KEY = 'impersonation:admin_user';

  const handleImpersonate = async (userId: number | string) => {
    if (!confirm('Start session as this user? This action will be audited.')) return;
    try {
      const res = await usersApi.impersonate(userId);
      // If backend returned a redirect URL, follow it (server may set cookie/session)
      if (res?.redirectUrl) {
        window.location.href = res.redirectUrl;
        return;
      }

      // If backend returned a token + user, replace local auth state
      if (res?.token) {
        try {
          // Persist original admin token/user to allow restore
          const existingAdminToken = localStorage.getItem('auth:token');
          const existingAdminUser = localStorage.getItem('auth:user');
          if (existingAdminToken && !localStorage.getItem(IMPERSONATION_ADMIN_TOKEN_KEY)) {
            localStorage.setItem(IMPERSONATION_ADMIN_TOKEN_KEY, existingAdminToken);
          }
          if (existingAdminUser && !localStorage.getItem(IMPERSONATION_ADMIN_USER_KEY)) {
            localStorage.setItem(IMPERSONATION_ADMIN_USER_KEY, existingAdminUser);
          }

          // Set impersonated auth values
          if (res.user) {
            try { localStorage.setItem('auth:user', JSON.stringify({
              id: res.user.id,
              name: res.user.name || res.user.username || res.user.email,
              email: res.user.email,
              phone: res.user.phone || '',
              vehicleNumber: res.user.vehicle_number || '',
              vehicleModel: res.user.vehicle_model || undefined,
              vehicleType: (res as any).vehicle_type || '',
              role: (res.user.role as any) === 'admin' ? 'admin' : (res.user.role as any) === 'operator' ? 'operator' : 'user',
              isActive: res.user.is_active ?? true,
              createdAt: res.user.created_at || new Date().toISOString(),
            })); } catch {}
          }
          try { localStorage.setItem('auth:token', res.token); } catch {}
          setAuthToken(res.token);
        } catch (e) {
          // ignore localStorage failures
        }

        // reload so authStore re-initializes from localStorage
        window.location.reload();
        return;
      }

      // fallback: reload to pick up server-set cookie/session
      window.location.reload();
    } catch (err) {
      alert('Failed to start impersonation session');
    }
  };

  const stopImpersonation = () => {
    if (!confirm('Stop impersonating and return to your admin session?')) return;
    try {
      const adminToken = localStorage.getItem(IMPERSONATION_ADMIN_TOKEN_KEY);
      const adminUser = localStorage.getItem(IMPERSONATION_ADMIN_USER_KEY);
      if (adminToken) {
        try { localStorage.setItem('auth:token', adminToken); } catch {}
        setAuthToken(adminToken);
      }
      if (adminUser) {
        try { localStorage.setItem('auth:user', adminUser); } catch {}
      }
      // Clean up impersonation backup keys
      try { localStorage.removeItem(IMPERSONATION_ADMIN_TOKEN_KEY); } catch {}
      try { localStorage.removeItem(IMPERSONATION_ADMIN_USER_KEY); } catch {}

      // reload to reinitialize auth store
      window.location.reload();
    } catch (e) {
      // best-effort; still reload
      window.location.reload();
    }
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
  vehicleType: (apiUser as any).vehicle_type || '',
    role: (apiUser.role as any) === 'admin' ? 'admin' : (apiUser.role as any) === 'operator' ? 'operator' : 'user',
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

  useEffect(() => {
    // Determine if we're currently impersonating by checking for stored admin backup
    setIsImpersonating(!!localStorage.getItem('impersonation:admin_token'));
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

        {isImpersonating && (
          <div className="mb-4 rounded-lg bg-yellow-50 border border-yellow-200 p-3 flex items-center justify-between">
            <div className="text-sm text-yellow-800">You are impersonating another user — actions will be performed as that user.</div>
            <div>
              <button
                onClick={stopImpersonation}
                className="px-3 py-1 bg-yellow-600 text-white rounded hover:bg-yellow-700 text-sm"
              >
                Stop impersonation
              </button>
            </div>
          </div>
        )}

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
                {isOperatorView ? (
                  <button
                    onClick={() => setActiveTab('users')}
                    className={`pb-2 text-sm font-medium ${activeTab === 'users' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600'}`}
                  >
                    Users ({regularUsers.length})
                  </button>
                ) : (
                  <>
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
                    <button
                      onClick={() => setActiveTab('operators')}
                      className={`pb-2 text-sm font-medium ${activeTab === 'operators' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600'}`}
                    >
                      Operators ({operatorUsers.length})
                    </button>
                  </>
                )}
              </nav>
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50 table-header-group">
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
                  <tr key={user.id} className="hover:bg-gray-50 table-row border-b">
                    <td className="px-4 sm:px-6 py-4 table-cell whitespace-nowrap">
                      <div className="hidden">User</div>
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
                    <td className="px-4 sm:px-6 py-4 table-cell whitespace-nowrap">
                      <div className="hidden">Contact</div>
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
                    <td className="px-4 sm:px-6 py-4 table-cell whitespace-nowrap">
                      <div className="hidden">Vehicle</div>
                      <div className="flex items-center space-x-2">
                        <Car className="h-4 w-4 text-gray-400" />
                        <div>
                          <div className="text-sm font-medium text-gray-900">{user.vehicleNumber}</div>
                          <div className="text-sm text-gray-500">{(user as any).vehicleModel ? `${(user as any).vehicleModel} • ` : ''}<span className="capitalize">{user.vehicleType}</span></div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 sm:px-6 py-4 table-cell whitespace-nowrap">
                      <div className="hidden">Status</div>
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        user.isActive 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {user.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 sm:px-6 py-4 table-cell whitespace-nowrap text-sm text-gray-500">
                      <div className="hidden">Joined</div>
                      {user.createdAt && isValid(new Date(user.createdAt)) ? format(new Date(user.createdAt), 'MMM dd, yyyy') : '—'}
                    </td>
                    <td className="px-4 sm:px-6 py-4 table-cell whitespace-nowrap text-sm font-medium">
                      <div className="hidden">Actions</div>
                      <div className="flex items-center space-x-2">
                        {!isOperatorView && (
                          <button
                            onClick={() => handleEdit(user)}
                            className="text-blue-600 hover:text-blue-700 transition-colors"
                          >
                            <Edit3 className="h-4 w-4" />
                          </button>
                        )}
                        <button
                          onClick={() => handleImpersonate(user.id)}
                          title="Access as this user"
                          className="text-indigo-600 hover:text-indigo-700 transition-colors"
                        >
                          <Users className="h-4 w-4" />
                        </button>
                        {!isOperatorView && (
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
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
            {showEditModal && editingUser !== null && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
                <div className="fixed inset-0 bg-black/40" onClick={handleCancel} />
                <div className="relative w-full max-w-2xl bg-white rounded-lg shadow-lg overflow-auto max-h-[90vh] z-10">
                  <div className="px-4 sm:px-6 py-4 border-b">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-gray-900">Edit User</h3>
                      <button onClick={handleCancel} className="text-gray-500 hover:text-gray-700">✕</button>
                    </div>
                  </div>
                  <div className="p-4 sm:p-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                    
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
                        <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                        <select
                          value={(formData as any).role}
                          onChange={(e) => setFormData(prev => ({ ...prev, role: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        >
                          <option value="user">User</option>
                          <option value="admin">Admin</option>
                          <option value="operator">Operator</option>
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

                    <div className="flex flex-col sm:flex-row sm:space-x-3 space-y-3 sm:space-y-0">
                      <button
                        onClick={handleSave}
                        className="w-full sm:w-auto bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors text-center"
                      >
                        Save Changes
                      </button>
                      <button
                        onClick={handleCancel}
                        className="w-full sm:w-auto bg-gray-300 text-gray-700 px-4 py-2 rounded-lg font-medium hover:bg-gray-400 transition-colors text-center"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
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