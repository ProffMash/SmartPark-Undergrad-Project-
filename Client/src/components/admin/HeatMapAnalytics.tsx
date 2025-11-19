import React, { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { LatLngExpression } from 'leaflet';
import { TrendingUp, MapPin, BarChart3, Filter } from 'lucide-react';
import FadeLoader from 'react-spinners/FadeLoader';
import { fetchBookings } from '../../API/bookingApi';
import { useAppStore } from '../../stores/appStore';
import { fetchParkingSlots } from '../../API/parkingSlotApi';
import 'leaflet/dist/leaflet.css';

import L from 'leaflet';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

export const HeatmapAnalytics: React.FC = () => {
  const { bookings: storeBookings } = useAppStore();
  const [slots, setLocalSlots] = useState<any[]>([]);
  const [serverBookings, setServerBookings] = useState<any[]>(storeBookings || []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedZone, setSelectedZone] = useState<string>('all');
  
  const [totalSlotsCount, setTotalSlotsCount] = useState<number | null>(null);
  const [selectedCenter, setSelectedCenter] = useState<LatLngExpression | null>(null);

  // Get unique locations/zones
  const zones = Array.from(new Set(slots.map(slot => slot.location)));

  // Helper: determine if a booking refers to a given slot by id or slot number
  const bookingMatchesSlot = (booking: any, slot: any) => {
    try {
      const bookingSlotId = booking.slotId ?? booking.slot_id ?? null;
      const bookingSlotNumber = booking.slotNumber ?? booking.slot_number ?? (booking.slot && (booking.slot.slot_number ?? booking.slot.number)) ?? null;

      if (bookingSlotId != null && String(bookingSlotId) === String(slot.id)) return true;
      if (bookingSlotId != null && String(bookingSlotId) === String(slot.number)) return true;
      if (bookingSlotNumber != null && String(bookingSlotNumber) === String(slot.number)) return true;
      return false;
    } catch (e) {
      return false;
    }
  };

  // Filter bookings based on time range
  const getFilteredBookings = () => {
    // Prefer serverBookings fetched from the API, fall back to store bookings
    let filteredBookings = serverBookings && serverBookings.length > 0 ? serverBookings : storeBookings;
    // Filter by zone (match bookings to slots by id or slot number)
    if (selectedZone !== 'all') {
      const zoneSlots = slots.filter(slot => slot.location === selectedZone);
      filteredBookings = filteredBookings.filter(booking =>
        zoneSlots.some(slot => bookingMatchesSlot(booking, slot))
      );
    }

    return filteredBookings;
  };

  const mapRef = useRef<any>(null);

  // Fetch slots from API within given bounds (southWest, northEast)
  const fetchSlotsByBounds = async (southWest?: [number, number], northEast?: [number, number]) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchParkingSlots();
      let transformed = response.map(transformApiSlot);
      if (southWest && northEast) {
        const [swLat, swLng] = southWest;
        const [neLat, neLng] = northEast;
        transformed = transformed.filter((s: any) => {
          const [lat, lng] = s.coordinates || [0, 0];
          return lat >= swLat && lat <= neLat && lng >= swLng && lng <= neLng;
        });
      }
  setLocalSlots(transformed);
    } catch (e: any) {
      console.error('Error fetching slots:', e);
      setError(e?.message || 'Failed to fetch slots');
    } finally {
      setLoading(false);
    }
  };

  // Transform API shape to app shape
  const transformApiSlot = (apiSlot: any) => {
    const coords: [number, number] = apiSlot.coordinates
      ? apiSlot.coordinates
      : [apiSlot.coordinates_lat ?? 0, apiSlot.coordinates_lng ?? 0];

    return {
      id: apiSlot.id,
      number: apiSlot.slot_number || apiSlot.number,
      location: apiSlot.location,
      coordinates: coords,
      isBooked: apiSlot.is_booked ?? apiSlot.isBooked ?? false,
      price: apiSlot.price ?? 0,
      type: apiSlot.type ?? 'regular',
      facilities: apiSlot.facilities || [],
      createdAt: apiSlot.created_at || apiSlot.createdAt,
    };
  };

  // Fetch initial slots within a bbox around default center on mount
  useEffect(() => {
  const center: [number, number] = [-1.286389, 36.817223]; const delta = 0.05; // ~small bbox
  const sw: [number, number] = [center[0] - delta, center[1] - delta]; const ne: [number, number] = [center[0] + delta, center[1] + delta]; fetchSlotsByBounds(sw, ne); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch total slots count from API (not dependent on current map bounds)
  useEffect(() => {
    let cancelled = false;
    const loadTotal = async () => {
      try {
        const resp = await fetchParkingSlots();
        if (!cancelled) setTotalSlotsCount(Array.isArray(resp) ? resp.length : null);
      } catch (e) {
        console.error('Failed to fetch total slots count', e);
        if (!cancelled) setTotalSlotsCount(null);
      }
    };
    loadTotal();
    return () => { cancelled = true; };
  }, []);

  // Fetch bookings from server for analytics (run once on mount)
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const resp = await fetchBookings();
        if (!cancelled) setServerBookings(resp as any[]);
      } catch (e) {
        // keep serverBookings empty and rely on storeBookings as fallback
        console.error('Failed to load bookings for analytics', e);
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  // Calculate statistics
  const filteredBookings = getFilteredBookings();
  const totalBookings = filteredBookings.length;
  // Derive unique slots by matching bookings to known slots (prefer slot.number), fallback to booking.slotId
  const uniqueSlotSet = new Set<string>();
  filteredBookings.forEach(b => {
    const matched = slots.find(s => bookingMatchesSlot(b, s));
    if (matched && matched.number != null) uniqueSlotSet.add(String(matched.number));
    else if (b.slotId != null) uniqueSlotSet.add(String(b.slotId));
    else if (b.slot_number != null) uniqueSlotSet.add(String(b.slot_number));
  });
  const uniqueSlots = uniqueSlotSet.size;
  const avgBookingsPerSlot = uniqueSlots > 0 ? (totalBookings / uniqueSlots).toFixed(1) : '0';

  // Get top performing zones
  const zoneStats = zones.map(zone => {
    const zoneSlots = slots.filter(slot => slot.location === zone);
    const zoneBookings = filteredBookings.filter(booking =>
      zoneSlots.some(slot => bookingMatchesSlot(booking, slot))
    );
    return {
      zone,
      bookings: zoneBookings.length,
      slots: zoneSlots.length,
      utilization: zoneSlots.length > 0 ? (zoneBookings.length / zoneSlots.length).toFixed(1) : '0'
    };
  }).sort((a, b) => b.bookings - a.bookings);

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Slots & Zone Analytics</h1>
          <p className="text-gray-600">View parking slots on the map and analytics per zone</p>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
            <div className="flex items-center space-x-2">
              <Filter className="h-5 w-5 text-gray-600" />
              <span className="font-medium text-gray-900">Filters:</span>
            </div>
            
            <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-4">
              <div className="flex items-center space-x-2">
                <label className="text-sm font-medium text-gray-700">Zone:</label>
                <select
                  value={selectedZone}
                  onChange={(e) => setSelectedZone(e.target.value)}
                  className="text-sm border border-gray-300 rounded-lg px-3 py-2"
                >
                  <option value="all">All Zones</option>
                  {zones.map(zone => (
                    <option key={zone} value={zone}>{zone}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 lg:gap-8">
          {/* Statistics Cards */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6">
              <div className="flex items-center">
                <div className="p-3 rounded-lg bg-blue-100">
                  <BarChart3 className="h-6 w-6 text-blue-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Bookings</p>
                  <p className="text-xl sm:text-2xl font-bold text-gray-900">{totalBookings}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6">
              <div className="flex items-center">
                <div className="p-3 rounded-lg bg-green-100">
                      <MapPin className="h-6 w-6 text-green-600" />
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">Total Slots</p>
                      <p className="text-xl sm:text-2xl font-bold text-gray-900">{totalSlotsCount ?? slots.length}</p>
                    </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6">
              <div className="flex items-center">
                <div className="p-3 rounded-lg bg-purple-100">
                  <TrendingUp className="h-6 w-6 text-purple-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Avg per Slot</p>
                  <p className="text-xl sm:text-2xl font-bold text-gray-900">{avgBookingsPerSlot}</p>
                </div>
              </div>
            </div>

            {/* Zone Performance */}
            <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Zone Performance</h3>
              <div className="space-y-3">
                {zoneStats.slice(0, 5).map((zone) => (
                  <div
                    key={zone.zone}
                    className="flex items-center justify-between cursor-pointer hover:bg-gray-50 p-2 rounded"
                    onClick={() => {
                      // compute centroid of slots in this zone and fly to it
                      const zoneSlots = slots.filter(s => s.location === zone.zone && Array.isArray(s.coordinates) && s.coordinates.length >= 2);
                      if (zoneSlots.length > 0) {
                        const avgLat = zoneSlots.reduce((sum, s) => sum + (s.coordinates[0] as number), 0) / zoneSlots.length;
                        const avgLng = zoneSlots.reduce((sum, s) => sum + (s.coordinates[1] as number), 0) / zoneSlots.length;
                        setSelectedCenter([avgLat, avgLng]);
                      }
                    }}
                  >
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900 truncate">{zone.zone}</p>
                      <p className="text-xs text-gray-600">{zone.bookings} bookings</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-blue-600">{zone.utilization}</p>
                      <p className="text-xs text-gray-500">avg/slot</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Map */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-xl shadow-lg overflow-hidden">
              <div className="p-4 sm:p-6 border-b bg-gray-50">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0">
                  <h3 className="text-lg font-semibold text-gray-900">Slots Map</h3>
                </div>
              </div>
              
                  <div className="h-[500px] lg:h-[600px] relative">
                    {error && (
                      <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-20 bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded">
                        {error}
                      </div>
                    )}
                    {loading ? (
                      <div className="flex items-center justify-center h-full">
                        <div className="text-center">
                          <div className="inline-flex items-center justify-center">
                            <FadeLoader color="#2563EB" />
                          </div>
                          <div className="text-sm text-gray-600 mt-3">Loading map data...</div>
                        </div>
                      </div>
                    ) : (
                      <MapContainer
                        ref={mapRef}
                        center={[-1.286389, 36.817223] as LatLngExpression}
                        zoom={13}
                        className="h-full w-full"
                      >
                        <TileLayer
                          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        />
                        {/* Listen for bounds changes and fetch slots for the visible bbox */}
                        <MapBoundsListener onBoundsChange={(sw, ne) => fetchSlotsByBounds(sw, ne)} />
                        {selectedCenter && <FlyToLocation center={selectedCenter} />}
                        {/* Render admin slot markers to match user MapView */}
                        {slots.map((slot) => {
                          const coords = slot.coordinates;
                          // runtime guard: ensure coordinates exist and are numeric [lat, lng]
                          if (!Array.isArray(coords) || coords.length < 2) return null;
                          const [lat, lng] = coords;
                          if (typeof lat !== 'number' || typeof lng !== 'number') return null;

                          return (
                            <Marker
                              key={slot.id}
                              position={[lat, lng] as LatLngExpression}
                              icon={createCustomIcon(slot.isBooked, slot.type)}
                            >
                              <Popup>
                                <div className="p-2">
                                  <h4 className="font-bold">#{slot.number}</h4>
                                  <p className="text-sm text-gray-600">{slot.location}</p>
                                  <p className="text-sm">
                                    <span className="font-medium">${slot.price}/hr</span>
                                    <span className={`ml-2 px-2 py-1 rounded text-xs ${
                                      slot.isBooked ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                                    }`}>
                                      {slot.isBooked ? 'Booked' : 'Available'}
                                    </span>
                                  </p>
                                </div>
                              </Popup>
                            </Marker>
                          );
                        })}
                      </MapContainer>
                    )}
                  </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Reuse the same custom icon style as the user MapView so admin map matches
const createCustomIcon = (isBooked: boolean, type: string) => {
  const color = isBooked ? '#ef4444' : type === 'premium' ? '#8b5cf6' : type === 'disabled' ? '#16a34a' : '#3b82f6';
  return L.divIcon({
    className: 'custom-marker',
    html: `<div style="background-color: ${color}; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.2);"></div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
};

// Fly to a given center when it changes (matching MapView behavior)
const FlyToLocation: React.FC<{ center: LatLngExpression }> = ({ center }) => {
  const map = useMap();
  useEffect(() => {
    try {
      map.flyTo(center, 13);
    } catch (e) {
      // ignore if map not ready
    }
  }, [center, map]);

  return null;
};

// Listen to map moveend events and call onBoundsChange (debounced)
const MapBoundsListener: React.FC<{ onBoundsChange: (sw: [number, number], ne: [number, number]) => void }> = ({ onBoundsChange }) => {
  const map = useMap();
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    const handleMoveEnd = () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = window.setTimeout(() => {
        const bounds = map.getBounds();
        const sw = bounds.getSouthWest();
        const ne = bounds.getNorthEast();
        onBoundsChange([sw.lat, sw.lng], [ne.lat, ne.lng]);
      }, 350);
    };

    map.on('moveend', handleMoveEnd);

    return () => {
      map.off('moveend', handleMoveEnd);
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, [map, onBoundsChange]);

  return null;
};