import React, { useState, useEffect } from 'react';
import { User, Shield, Calendar, Edit3 } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { format } from 'date-fns';
import { updateUser as apiUpdateUser } from '../../API/usersApi';

export const OperatorProfile: React.FC = () => {
  const { user } = useAuthStore();
  const { updateUser } = useAuthStore();

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);

  const [form, setForm] = useState({
    name: user?.name || '',
    phone: user?.phone || '',
    vehicleNumber: user?.vehicleNumber || '',
    vehicleModel: user?.vehicleModel || ''
  });

  useEffect(() => {
    if (user) {
      setForm({
        name: user.name || '',
        phone: user.phone || '',
        vehicleNumber: user.vehicleNumber || '',
        vehicleModel: user.vehicleModel || ''
      });
    }
  }, [user]);

  if (!user) return null;

  return (
    <div className="p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          <div className="bg-gradient-to-r from-orange-600 to-red-600 px-8 py-12 text-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
              <div className="bg-white bg-opacity-20 p-1 rounded-full h-16 w-16 overflow-hidden flex items-center justify-center">
                {user.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={user.avatar} alt="avatar" className="h-16 w-16 object-cover rounded-full" />
                ) : (
                  <Shield className="h-8 w-8" />
                )}
              </div>
              <div>
                <h1 className="text-3xl font-bold">{user.name}</h1>
                <p className="text-orange-100">{user.email}</p>
                <div className="flex items-center space-x-2 mt-2">
                  <span className="bg-white bg-opacity-20 px-3 py-1 rounded-full text-sm font-medium">
                    Operator
                  </span>
                </div>
              </div>
              </div>
              <div className="ml-4">
                {!editing ? (
                  <button
                    onClick={() => setEditing(true)}
                    title="Edit profile"
                    className="inline-flex items-center px-3 py-2 bg-white bg-opacity-20 text-white rounded-lg hover:bg-opacity-30 transition-colors text-sm"
                  >
                    <Edit3 className="h-4 w-4 mr-2" />
                    <span className="hidden sm:inline">Edit</span>
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button
                      onClick={async () => {
                        if (!user) return;
                        setSaving(true); setError(null);
                        try {
                          const payload: any = {
                            name: form.name,
                            phone: form.phone,
                            vehicle_number: form.vehicleNumber,
                            vehicle_model: form.vehicleModel,
                          };
                          let updated: any;
                          if (avatarFile) {
                            const fd = new FormData();
                            Object.entries(payload).forEach(([k, v]) => fd.append(k, v as any));
                            fd.append('avatar', avatarFile);
                            updated = await apiUpdateUser(user.id, fd as any);
                          } else {
                            updated = await apiUpdateUser(user.id, payload);
                          }
                          updateUser({
                            id: updated.id,
                            name: (updated as any).name || form.name,
                            email: (updated as any).email || user.email,
                            phone: (updated as any).phone || form.phone,
                            vehicleNumber: (updated as any).vehicle_number || form.vehicleNumber,
                            vehicleModel: (updated as any).vehicle_model || form.vehicleModel,
                            avatar: (updated as any).avatar || undefined,
                          });
                          setEditing(false);
                          setAvatarFile(null);
                        } catch (err: any) {
                          setError(err?.message || 'Failed to save profile');
                        } finally { setSaving(false); }
                      }}
                      disabled={saving}
                      className={`inline-flex items-center px-4 py-2 rounded-lg text-sm ${saving ? 'bg-green-400 cursor-not-allowed text-white' : 'bg-white bg-opacity-20 hover:bg-opacity-30 text-white'}`}
                    >
                      {saving ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      onClick={() => {
                        setForm({ name: user.name, phone: user.phone, vehicleNumber: user.vehicleNumber || '', vehicleModel: user.vehicleModel || '' });
                        setEditing(false);
                        setError(null);
                      }}
                      className="inline-flex items-center px-4 py-2 bg-white bg-opacity-10 text-white rounded-lg hover:bg-opacity-20 text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="p-8">
            <div className="grid md:grid-cols-2 gap-8">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Account Information</h3>
                <div className="space-y-4">
                  {editing ? (
                    <form onSubmit={(e) => { e.preventDefault(); }} className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                        <input value={form.name} onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                        <p className="text-gray-900 py-2">{user.email}</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Avatar</label>
                        <div className="flex items-center gap-4">
                          <div className="h-16 w-16 rounded-full overflow-hidden bg-gray-100">
                            {user.avatar ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={user.avatar} alt="avatar" className="h-full w-full object-cover" />
                            ) : (
                              <Shield className="h-6 w-6 text-gray-400 m-4" />
                            )}
                          </div>
                          {editing && (
                            <input type="file" accept="image/*" onChange={(e) => setAvatarFile(e.target.files && e.target.files[0] ? e.target.files[0] : null)} />
                          )}
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                        <input value={form.phone} onChange={(e) => setForm(prev => ({ ...prev, phone: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Vehicle Number</label>
                        <input value={form.vehicleNumber} onChange={(e) => setForm(prev => ({ ...prev, vehicleNumber: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Vehicle Model</label>
                        <input value={form.vehicleModel} onChange={(e) => setForm(prev => ({ ...prev, vehicleModel: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                      </div>
                      {error && <div className="text-sm text-red-600">{error}</div>}
                    </form>
                  ) : (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                        <p className="text-gray-900 py-2">{user.name}</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                        <p className="text-gray-900 py-2">{user.email}</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                        <p className="text-gray-900 py-2">{user.phone}</p>
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Account Details</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                    <div className="flex items-center space-x-2 py-2">
                      <User className="h-4 w-4 text-orange-600" />
                      <span className="text-gray-900 capitalize">{user.role}</span>
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Account Created</label>
                    <div className="flex items-center space-x-2 py-2">
                      <Calendar className="h-4 w-4 text-gray-400" />
                      <span className="text-gray-900">
                        {format(new Date(user.createdAt), 'MMMM dd, yyyy')}
                      </span>
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                    <div className="py-2">
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                        user.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {user.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};