import React, { useState } from 'react';
import { User, Car, Mail, Phone, Edit2, Save, X } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { updateUser as apiUpdateUser, deleteAccount } from '../../API/usersApi';

export const UserProfile: React.FC = () => {
  const { user, updateUser, logout } = useAuthStore();
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    vehicleNumber: user?.vehicleNumber || '',
    vehicleModel: user?.vehicleModel || '',
  });
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = () => {
    if (!user) return;
    // prepare payload mapping UI fields to API field names
    const payload = {
      name: formData.name,
      email: formData.email,
      phone: formData.phone,
      vehicle_number: formData.vehicleNumber,
      vehicle_model: formData.vehicleModel,
    };

    // If avatar file selected, use FormData
    const performSave = () => {
      setSaving(true);
      setError(null);
      if (avatarFile) {
        const fd = new FormData();
        Object.entries(payload).forEach(([k, v]) => fd.append(k, v as any));
        fd.append('avatar', avatarFile);
        apiUpdateUser(user.id, fd)
          .then((updated) => {
            updateUser({
              id: updated.id,
              name: updated.name || formData.name,
              email: updated.email || formData.email,
              phone: (updated as any).phone || formData.phone,
              vehicleNumber: (updated as any).vehicle_number || formData.vehicleNumber,
              vehicleModel: (updated as any).vehicle_model || formData.vehicleModel,
              avatar: (updated as any).avatar || undefined,
            });
            setIsEditing(false);
          })
          .catch((err) => {
            console.error('Failed to update user', err);
            setError('Failed to save profile. Please try again.');
          })
          .finally(() => setSaving(false));
      } else {
        setSaving(true);
        setError(null);
        apiUpdateUser(user.id, payload as any)
          .then((updated) => {
            updateUser({
              id: updated.id,
              name: updated.name || formData.name,
              email: updated.email || formData.email,
              phone: (updated as any).phone || formData.phone,
              vehicleNumber: (updated as any).vehicle_number || formData.vehicleNumber,
              vehicleModel: (updated as any).vehicle_model || formData.vehicleModel,
              avatar: (updated as any).avatar || undefined,
            });
            setIsEditing(false);
          })
          .catch((err) => {
            console.error('Failed to update user', err);
            setError('Failed to save profile. Please try again.');
          })
          .finally(() => setSaving(false));
      }
    };

    performSave();
  };

  const handleCancel = () => {
    setFormData({
      name: user?.name || '',
      email: user?.email || '',
      phone: user?.phone || '',
      vehicleNumber: user?.vehicleNumber || '',
      vehicleModel: user?.vehicleModel || '',
    });
    setIsEditing(false);
  };


  const handleDeleteAccount = async () => {
    if (!window.confirm('Are you sure you want to delete your account? This action cannot be undone.')) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteAccount();
      logout();
      window.location.href = '/'; // Redirect to landing page
    } catch (err) {
      setDeleteError('Failed to delete account. Please try again.');
    } finally {
      setDeleting(false);
    }
  };

  if (!user) {
    return (
      <div className="p-4 lg:p-8">
        <div className="text-center text-gray-500">
          <User className="mx-auto h-12 w-12 mb-4" />
          <p>No user data available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="px-4 lg:px-6 py-4 lg:py-6 border-b border-gray-200">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="text-xl lg:text-2xl font-bold text-gray-900">Profile</h1>
                <p className="text-sm lg:text-base text-gray-600 mt-1">
                  Manage your account information and vehicle details
                </p>
              </div>
              {!isEditing ? (
                <button
                  onClick={() => setIsEditing(true)}
                  className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm lg:text-base"
                >
                  <Edit2 className="h-4 w-4 mr-2" />
                  Edit Profile
                </button>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className={`inline-flex items-center px-4 py-2 rounded-lg transition-colors text-sm lg:text-base ${saving ? 'bg-green-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700 text-white'}`}
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                  <button
                    onClick={handleCancel}
                    className="inline-flex items-center px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm lg:text-base"
                  >
                    <X className="h-4 w-4 mr-2" />
                    Cancel
                  </button>
                </div>
              )}
            </div>
          </div>

          {error && (
            <div className="px-4 lg:px-6 py-3 bg-red-50 text-red-700 border-t border-red-100">
              {error}
            </div>
          )}
          {deleteError && (
            <div className="px-4 lg:px-6 py-3 bg-red-50 text-red-700 border-t border-red-100">
              {deleteError}
            </div>
          )}

          <div className="p-4 lg:p-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
              {/* Personal Information */}
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <User className="h-5 w-5 mr-2 text-blue-600" />
                    Personal Information
                  </h2>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Full Name
                      </label>
                      {isEditing ? (
                        <input
                          type="text"
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm lg:text-base"
                        />
                      ) : (
                        <p className="text-sm lg:text-base text-gray-900 bg-gray-50 px-3 py-2 rounded-lg">
                          {user.name}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Email Address
                      </label>
                      {isEditing ? (
                        <input
                          type="email"
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm lg:text-base"
                        />
                      ) : (
                        <p className="text-sm lg:text-base text-gray-900 bg-gray-50 px-3 py-2 rounded-lg flex items-center">
                          <Mail className="h-4 w-4 mr-2 text-gray-500" />
                          {user.email}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Phone Number
                      </label>
                      {isEditing ? (
                        <input
                          type="tel"
                          value={formData.phone}
                          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm lg:text-base"
                        />
                      ) : (
                        <p className="text-sm lg:text-base text-gray-900 bg-gray-50 px-3 py-2 rounded-lg flex items-center">
                          <Phone className="h-4 w-4 mr-2 text-gray-500" />
                          {user.phone || 'Not provided'}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Avatar area */}
              <div className="w-full">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Avatar</h2>
                <div className="flex items-center gap-4">
                  <div className="h-24 w-24 rounded-full overflow-hidden bg-gray-100">
                    {user.avatar ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={user.avatar} alt="avatar" className="h-full w-full object-cover" />
                    ) : (
                      <User className="h-10 w-10 text-gray-400 m-6" />
                    )}
                  </div>
                  {isEditing && (
                    <div>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => setAvatarFile(e.target.files && e.target.files[0] ? e.target.files[0] : null)}
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Vehicle Information */}
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <Car className="h-5 w-5 mr-2 text-blue-600" />
                    Vehicle Information
                  </h2>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Vehicle Number
                      </label>
                      {isEditing ? (
                        <input
                          type="text"
                          value={formData.vehicleNumber}
                          onChange={(e) => setFormData({ ...formData, vehicleNumber: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm lg:text-base"
                          placeholder="e.g., ABC-1234"
                        />
                      ) : (
                        <p className="text-sm lg:text-base text-gray-900 bg-gray-50 px-3 py-2 rounded-lg">
                          {user.vehicleNumber || 'Not provided'}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Vehicle Model
                      </label>
                      {isEditing ? (
                        <input
                          type="text"
                          value={formData.vehicleModel}
                          onChange={(e) => setFormData({ ...formData, vehicleModel: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm lg:text-base"
                          placeholder="e.g., Toyota Camry"
                        />
                      ) : (
                        <p className="text-sm lg:text-base text-gray-900 bg-gray-50 px-3 py-2 rounded-lg">
                          {user.vehicleModel || 'Not provided'}
                        </p>
                      )}
                    </div>

                    <div className="bg-blue-50 p-4 rounded-lg">
                      <h3 className="text-sm font-medium text-blue-900 mb-2">Account Status</h3>
                      <div className="flex items-center mb-2">
                        <div className="h-2 w-2 bg-green-500 rounded-full mr-2"></div>
                        <span className="text-sm text-blue-800">Active</span>
                      </div>
                      <button
                        onClick={handleDeleteAccount}
                        disabled={deleting}
                        className={`mt-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${deleting ? 'bg-red-400 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700 text-white'}`}
                      >
                        {deleting ? 'Deleting Account...' : 'Delete Account'}
                      </button>
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