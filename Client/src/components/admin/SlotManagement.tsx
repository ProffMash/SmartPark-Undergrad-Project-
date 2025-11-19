import React, { useEffect, useState } from 'react';
import FadeLoader from 'react-spinners/FadeLoader';
import { Plus, Edit3, Trash2, MapPin, DollarSign, Download } from 'lucide-react';
import { exportFromStore } from '../../utils/exportHelpers';
import { useAppStore } from '../../stores/appStore';
import { ParkingSlot } from '../../types';
import {
  fetchParkingSlots,
  createParkingSlot,
  updateParkingSlot,
  deleteParkingSlot as apiDeleteParkingSlot,
  ParkingSlot as ApiParkingSlot
} from '../../API/parkingSlotApi';

export const SlotManagement: React.FC = () => {
  const { slots, updateSlot, deleteSlot, setSlots, upsertSlot } = useAppStore();
  const [exportType, setExportType] = useState<'csv'|'pdf'>('csv');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingSlot, setEditingSlot] = useState<number | string | null>(null);
  type FormData = {
    number: string;
    location: string;
    coordinates: [number | string, number | string];
    price: number | string;
    type: 'regular' | 'premium' | 'vip';
    facilities: string[];
  };

  const [formData, setFormData] = useState<FormData>({
    number: '',
    location: '',
    // start empty so inputs show as blank for new slots
    coordinates: ['', ''],
    price: '',
    type: 'regular',
    facilities: []
  });

  const facilityOptions = [
    'Security Camera',
    'Lighting',
    'EV Charging',
    'Valet Service',
    'Shuttle Service',
    'Wheelchair Access',
    'Cover/Shelter',
    '24/7 Access'
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    (async () => {
      try {
        if (editingSlot !== null) {
          // call API update
          const id = Number(editingSlot);
          const payload = {
            slot_number: formData.number,
            location: formData.location,
            // coerce string/number union to numbers for API
            coordinates_lat: Number(formData.coordinates[0]),
            coordinates_lng: Number(formData.coordinates[1]),
            price: Number(formData.price),
            type: formData.type,
            facilities: formData.facilities,
            is_booked: false
          } as Partial<ApiParkingSlot>;
          const updated = await updateParkingSlot(id, payload);
          // map API shape to app shape and update store
          updateSlot(updated.id, {
            number: updated.slot_number,
            location: updated.location,
            coordinates: [updated.coordinates_lat, updated.coordinates_lng] as [number, number],
            price: updated.price,
            type: updated.type,
            facilities: updated.facilities,
            isBooked: updated.is_booked,
            createdAt: updated.created_at
          });
          setEditingSlot(null);
        } else {
          const payload = {
            slot_number: formData.number,
            location: formData.location,
            coordinates_lat: Number(formData.coordinates[0]),
            coordinates_lng: Number(formData.coordinates[1]),
            price: Number(formData.price),
            type: formData.type,
            facilities: formData.facilities,
            is_booked: false
          } as Omit<ApiParkingSlot, 'id' | 'created_at'>;
          const created = await createParkingSlot(payload);
          upsertSlot({
            id: created.id,
            number: created.slot_number,
            location: created.location,
            coordinates: [created.coordinates_lat, created.coordinates_lng] as [number, number],
            price: created.price,
            type: created.type,
            facilities: created.facilities,
            isBooked: created.is_booked,
            createdAt: created.created_at
          } as ParkingSlot);
        }
      } catch (err: any) {
        console.error(err);
        setError(err?.message || 'Failed to save slot');
      }
    })();
    
    setFormData({
      number: '',
      location: '',
      coordinates: ['', ''],
      price: '',
      type: 'regular',
      facilities: []
    });
    setShowForm(false);
  };

  const handleEdit = (slot: ParkingSlot) => {
    const coords: [number, number] = slot.coordinates ?? (
      slot.coordinates_lat !== undefined && slot.coordinates_lng !== undefined
        ? [slot.coordinates_lat, slot.coordinates_lng]
        : [40.7128, -74.0060]
    );
    setFormData({
      number: slot.number,
      location: slot.location,
      coordinates: coords,
      price: slot.price,
      type: slot.type,
      facilities: slot.facilities
    });
    setEditingSlot(slot.id);
    setShowForm(true);
  };

  const handleDelete = (slotId: number | string) => {
    if (!window.confirm('Are you sure you want to delete this slot?')) return;
    setError(null);
    (async () => {
      try {
        const id = Number(slotId);
        await apiDeleteParkingSlot(id);
        deleteSlot(slotId);
      } catch (err: any) {
        console.error(err);
        setError(err?.message || 'Failed to delete slot');
      }
    })();
  };

  const handleFacilityToggle = (facility: string) => {
    setFormData(prev => ({
      ...prev,
      facilities: prev.facilities.includes(facility)
        ? prev.facilities.filter(f => f !== facility)
        : [...prev.facilities, facility]
    }));
  };

  // Toggle availability and persist to API (optimistic update)
  const handleToggleAvailability = (slot: ParkingSlot) => {
    const newStatus = !slot.isBooked;
    // optimistic update
    updateSlot(slot.id, { isBooked: newStatus });
    (async () => {
      try {
        const payload = { is_booked: newStatus } as Partial<ApiParkingSlot>;
        const updated = await updateParkingSlot(Number(slot.id), payload);
        // map API shape back into store shape to ensure consistency
        updateSlot(updated.id, {
          number: updated.slot_number,
          location: updated.location,
          coordinates: [updated.coordinates_lat, updated.coordinates_lng] as [number, number],
          price: updated.price,
          type: updated.type,
          facilities: updated.facilities,
          isBooked: updated.is_booked,
          createdAt: updated.created_at
        });
      } catch (err: any) {
        console.error(err);
        setError(err?.message || 'Failed to update availability');
        // revert optimistic update
        updateSlot(slot.id, { isBooked: slot.isBooked });
      }
    })();
  };

  // Fetch slots from API on mount and sync to store
  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const data = await fetchParkingSlots();
        if (!mounted) return;
        // map API slots to AppState shape and replace store slots by adding each (simple sync)
        // Clear existing slots by setting a replace - but store has no replace API, so we add missing and update existing
        const mappedSlots: ParkingSlot[] = data.map(s => ({
          id: s.id,
          number: s.slot_number,
          location: s.location,
          coordinates: [s.coordinates_lat, s.coordinates_lng] as [number, number],
          price: s.price,
          type: s.type,
          facilities: s.facilities,
          isBooked: s.is_booked,
          createdAt: s.created_at
        }));
        setSlots(mappedSlots as any);
      } catch (err: any) {
        console.error(err);
        if (mounted) setError(err?.message || 'Failed to load slots');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0 mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Slot Management</h1>
            <p className="text-gray-600">Create and manage parking slots</p>
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
              onClick={() => exportFromStore('slots', { slots }, exportType)}
              className="bg-white border px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-2"
            >
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">Export Slots</span>
            </button>
            <button
              onClick={() => setShowForm(true)}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center justify-center space-x-2 w-full sm:w-auto"
            >
              <Plus className="h-5 w-5" />
              <span>Add Slot</span>
            </button>
          </div>
        </div>

        {/* Loading and Error states */}
        {loading && (
          <div className="my-4 p-3 bg-blue-50 text-blue-700 rounded">
            <div className="flex items-center justify-center min-h-[120px]">
              <FadeLoader color="#2563EB" />
            </div>
          </div>
        )}
        {error && (
          <div className="my-4 p-3 bg-red-50 text-red-700 rounded">Error: {error}</div>
        )}
        {/* Slots Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
          {slots.map((slot) => (
            <div key={String(slot.id)} className="bg-white rounded-xl shadow-lg p-4 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <h3 className="text-lg sm:text-xl font-bold text-gray-900">#{slot.number}</h3>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    slot.type === 'premium' 
                      ? 'bg-purple-100 text-purple-800'
                      : slot.type === 'vip'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {slot.type}
                  </span>
                </div>
                
                <div className="flex space-x-2">
                  <button
                    onClick={() => handleEdit(slot)}
                    className="text-blue-600 hover:text-blue-700 transition-colors"
                  >
                    <Edit3 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(slot.id)}
                    className="text-red-600 hover:text-red-700 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center text-gray-600">
                  <MapPin className="h-4 w-4 mr-2" />
                  <span className="text-sm">{slot.location}</span>
                </div>
                
                <div className="flex items-center text-gray-600">
                  <DollarSign className="h-4 w-4 mr-2" />
                  <span className="text-sm">${slot.price}/hour</span>
                </div>

                <div className="flex items-center space-x-2">
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                    slot.isBooked ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                  }`}>
                    {slot.isBooked ? 'Booked' : 'Available'}
                  </span>
                  <button
                    onClick={() => handleToggleAvailability(slot)}
                    className={`ml-2 text-xs px-3 py-1 rounded-lg font-medium transition-colors ${
                      slot.isBooked ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-red-600 text-white hover:bg-red-700'
                    }`}
                    title={slot.isBooked ? 'Mark as Available' : 'Mark as Booked'}
                  >
                    {slot.isBooked ? 'Make Available' : 'Mark Booked'}
                  </button>
                </div>

                <div className="pt-2">
                  <p className="text-xs text-gray-500 mb-2">Facilities:</p>
                  <div className="flex flex-wrap gap-1">
                    {slot.facilities.map((facility, index) => (
                      <span
                        key={index}
                        className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded"
                      >
                        {facility}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Form Modal */}
        {showForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-4 sm:p-6 max-h-[90vh] overflow-y-auto">
              <h3 className="text-xl font-bold text-gray-900 mb-6">
                {editingSlot !== null ? 'Edit Slot' : 'Add New Slot'}
              </h3>
              
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Slot Number</label>
                    <input
                      type="text"
                      value={formData.number}
                      onChange={(e) => setFormData(prev => ({ ...prev, number: e.target.value }))}
                      placeholder="A-001"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Price per Hour ($)</label>
                    <input
                      type="number"
                      value={formData.price}
                      onChange={(e) => setFormData(prev => ({ ...prev, price: Number(e.target.value) }))}
                      min="1"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                    placeholder="Downtown Mall"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Slot Type</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value as any }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="regular">Regular</option>
                    <option value="premium">Premium</option>
                    <option value="vip">VIP</option>
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Latitude</label>
                    <input
                      type="number"
                      step="any"
                      value={formData.coordinates[0]}
                      onChange={(e) => setFormData(prev => ({ 
                        ...prev, 
                        coordinates: [Number(e.target.value), prev.coordinates[1]]
                      }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Longitude</label>
                    <input
                      type="number"
                      step="any"
                      value={formData.coordinates[1]}
                      onChange={(e) => setFormData(prev => ({ 
                        ...prev, 
                        coordinates: [prev.coordinates[0], Number(e.target.value)]
                      }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">Facilities</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {facilityOptions.map((facility) => (
                      <label key={facility} className="flex items-center">
                        <input
                          type="checkbox"
                          checked={formData.facilities.includes(facility)}
                          onChange={() => handleFacilityToggle(facility)}
                          className="mr-2 text-blue-600"
                        />
                        <span className="text-sm text-gray-700">{facility}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-3">
                  <button
                    type="submit"
                    className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors flex-1 text-center"
                  >
                    {editingSlot !== null ? 'Update Slot' : 'Create Slot'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowForm(false);
                      setEditingSlot(null);
                      setFormData({
                        number: '',
                        location: '',
                        coordinates: ['', ''],
                        price: '',
                        type: 'regular',
                        facilities: []
                      });
                    }}
                    className="bg-gray-300 text-gray-700 px-6 py-2 rounded-lg font-medium hover:bg-gray-400 transition-colors text-center"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};