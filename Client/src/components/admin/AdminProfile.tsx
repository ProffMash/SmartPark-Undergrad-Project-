import React, { useState } from 'react';
import { User, Shield, Calendar } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { format } from 'date-fns';
import { updateUser as apiUpdateUser } from '../../API/usersApi';

export const AdminProfile: React.FC = () => {
  const { user, updateUser } = useAuthStore();

  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!user) return;
    const payload = {
      name: formData.name,
      email: formData.email,
      phone: formData.phone,
    };

    setSaving(true);
    setError(null);
    try {
      const updated = await apiUpdateUser(user.id, payload as any);
      // update local auth store
      updateUser({
        id: updated.id,
        name: (updated as any).name || formData.name,
        email: (updated as any).email || formData.email,
        phone: (updated as any).phone || formData.phone,
      });
      setIsEditing(false);
    } catch (err) {
      console.error('Failed to update admin profile', err);
      setError('Failed to save profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setFormData({
      name: user?.name || '',
      email: user?.email || '',
      phone: user?.phone || '',
    });
    setIsEditing(false);
    setError(null);
  };

  if (!user) return null;

  return (
    <div className="p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-8 py-12 text-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="bg-white bg-opacity-20 p-4 rounded-full">
                  <Shield className="h-8 w-8" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold">{user.name}</h1>
                  <p className="text-indigo-100">{user.email}</p>
                  <div className="flex items-center space-x-2 mt-2">
                    <span className="bg-white bg-opacity-20 px-3 py-1 rounded-full text-sm font-medium">
                      Administrator
                    </span>
                  </div>
                </div>
              </div>

              <div className="ml-4">
                {!isEditing ? (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="inline-flex items-center px-4 py-2 bg-white bg-opacity-20 text-white rounded-lg hover:bg-opacity-30 transition-colors text-sm"
                  >
                    Edit Profile
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className={`inline-flex items-center px-4 py-2 rounded-lg text-sm ${saving ? 'bg-green-400 cursor-not-allowed text-white' : 'bg-white bg-opacity-20 hover:bg-opacity-30 text-white'}`}
                    >
                      {saving ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      onClick={handleCancel}
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
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                    {isEditing ? (
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-200 rounded-md text-gray-900"
                      />
                    ) : (
                      <p className="text-gray-900 py-2">{user.name}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                    {isEditing ? (
                      <input
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-200 rounded-md text-gray-900"
                      />
                    ) : (
                      <p className="text-gray-900 py-2">{user.email}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                    {isEditing ? (
                      <input
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-200 rounded-md text-gray-900"
                      />
                    ) : (
                      <p className="text-gray-900 py-2">{user.phone}</p>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Account Details</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                    <div className="flex items-center space-x-2 py-2">
                      <User className="h-4 w-4 text-indigo-600" />
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
          {error && (
            <div className="p-4 border-t bg-red-50 text-red-700">{error}</div>
          )}
        </div>
      </div>
    </div>
  );
};