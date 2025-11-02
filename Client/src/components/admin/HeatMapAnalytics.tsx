import React, { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { LatLngExpression } from 'leaflet';
import { TrendingUp, MapPin, BarChart3, Filter } from 'lucide-react';
import { useAppStore } from '../../stores/appStore';
import { fetchParkingSlots } from '../../API/parkingSlotApi';
import { subDays, isAfter } from 'date-fns';
import 'leaflet/dist/leaflet.css';

// Import leaflet.heat
import L from 'leaflet';
import 'leaflet.heat';

// Fix for default markers in React-Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface HeatmapLayerProps {
  heatmapData: [number, number, number][];
  intensity: number;
}

const HeatmapLayer: React.FC<HeatmapLayerProps> = ({ heatmapData, intensity }) => {
  const map = useMap();
  const heatmapRef = useRef<L.Layer | null>(null);

  useEffect(() => {
    if (heatmapRef.current) {
      map.removeLayer(heatmapRef.current);
    }

    if (heatmapData.length > 0) {
      heatmapRef.current = (L as any).heatLayer(heatmapData, {
        radius: 25,
        blur: 15,
        maxZoom: 17,
        max: intensity,
        gradient: {
          0.0: '#313695',
          0.1: '#4575b4',
          0.2: '#74add1',
          0.3: '#abd9e9',
          0.4: '#e0f3f8',
          0.5: '#ffffcc',
          0.6: '#fee090',
          0.7: '#fdae61',
          0.8: '#f46d43',
          0.9: '#d73027',
          1.0: '#a50026'
        }
      }).addTo(map);
    }

    return () => {
      if (heatmapRef.current) {
        map.removeLayer(heatmapRef.current);
      }
    };
  }, [map, heatmapData, intensity]);

  return null;
};

export const HeatmapAnalytics: React.FC = () => {
  const { slots: storeSlots, bookings, setSlots } = useAppStore();
  const [slots, setLocalSlots] = useState<typeof storeSlots>(storeSlots);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d' | 'all'>('30d');
  const [selectedZone, setSelectedZone] = useState<string>('all');
  const [heatmapData, setHeatmapData] = useState<[number, number, number][]>([]);
  const [maxIntensity, setMaxIntensity] = useState(1);

  // Get unique locations/zones
  const zones = Array.from(new Set(slots.map(slot => slot.location)));

  // Filter bookings based on time range
  const getFilteredBookings = () => {
    let filteredBookings = bookings;

    // Filter by time range
    if (timeRange !== 'all') {
      const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;
      const cutoffDate = subDays(new Date(), days);
      filteredBookings = filteredBookings.filter(booking => 
        isAfter(new Date(booking.createdAt), cutoffDate)
      );
    }

    // Filter by zone
    if (selectedZone !== 'all') {
      const zoneSlotIds: (string | number)[] = slots
        .filter(slot => slot.location === selectedZone)
        .map(slot => slot.id);
      filteredBookings = filteredBookings.filter(booking => 
        zoneSlotIds.map(String).includes(String(booking.slotId))
      );
    }

    return filteredBookings;
  };

  // Generate heatmap data
  useEffect(() => {
    const filteredBookings = getFilteredBookings();
    
  // Count bookings per slot (keys can be string or number per types)
  const slotBookingCounts = new Map<string | number, number>();
    filteredBookings.forEach(booking => {
      const key = booking.slotId as string | number;
      const count = slotBookingCounts.get(key) || 0;
      slotBookingCounts.set(key, count + 1);
    });

    // Convert to heatmap format [lat, lng, intensity]
    const heatData: [number, number, number][] = [];
    let maxCount = 0;

    slots.forEach(slot => {
      const count = slotBookingCounts.get(slot.id as string | number) || 0;
      // Ensure coordinates are available and valid
      if (count > 0 && Array.isArray(slot.coordinates) && slot.coordinates.length >= 2) {
        const lat = slot.coordinates[0] as number;
        const lng = slot.coordinates[1] as number;
        if (typeof lat === 'number' && typeof lng === 'number') {
          heatData.push([lat, lng, count]);
          maxCount = Math.max(maxCount, count);
        }
      }
    });

    setHeatmapData(heatData);
    setMaxIntensity(Math.max(maxCount, 1));
  }, [timeRange, selectedZone, bookings, slots]);

  // Sync store -> local
  useEffect(() => {
    setLocalSlots(storeSlots);
  }, [storeSlots]);

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

  // Fetch slots from API on mount
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const resp = await fetchParkingSlots();
        const transformed = resp.map(transformApiSlot);
        if (!mounted) return;
        setLocalSlots(transformed);
        setSlots(transformed);
      } catch (e: any) {
        console.error('Error loading slots for heatmap', e);
        setError(e?.message || 'Failed to load slots');
      } finally {
        setLoading(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, [setSlots]);

  // Calculate statistics
  const filteredBookings = getFilteredBookings();
  const totalBookings = filteredBookings.length;
  const uniqueSlots = new Set(filteredBookings.map(b => String(b.slotId))).size;
  const avgBookingsPerSlot = uniqueSlots > 0 ? (totalBookings / uniqueSlots).toFixed(1) : '0';

  // Get top performing zones
  const zoneStats = zones.map(zone => {
    const zoneSlots = slots.filter(slot => slot.location === zone);
    const zoneBookings = filteredBookings.filter(booking => 
      zoneSlots.some(slot => String(slot.id) === String(booking.slotId))
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
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Booking Heatmap Analytics</h1>
          <p className="text-gray-600">Visualize booking density and popular parking zones</p>
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
                <label className="text-sm font-medium text-gray-700">Time Range:</label>
                <select
                  value={timeRange}
                  onChange={(e) => setTimeRange(e.target.value as any)}
                  className="text-sm border border-gray-300 rounded-lg px-3 py-2"
                >
                  <option value="7d">Last 7 days</option>
                  <option value="30d">Last 30 days</option>
                  <option value="90d">Last 90 days</option>
                  <option value="all">All time</option>
                </select>
              </div>
              
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
                  <p className="text-sm font-medium text-gray-600">Active Slots</p>
                  <p className="text-xl sm:text-2xl font-bold text-gray-900">{uniqueSlots}</p>
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
                  <div key={zone.zone} className="flex items-center justify-between">
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

          {/* Heatmap */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-xl shadow-lg overflow-hidden">
              <div className="p-4 sm:p-6 border-b bg-gray-50">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0">
                  <h3 className="text-lg font-semibold text-gray-900">Booking Density Heatmap</h3>
                  <div className="flex items-center space-x-4 text-sm text-gray-600">
                    <div className="flex items-center space-x-2">
                      <div className="w-4 h-4 bg-blue-500 rounded"></div>
                      <span>Low Activity</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-4 h-4 bg-yellow-500 rounded"></div>
                      <span>Medium Activity</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-4 h-4 bg-red-500 rounded"></div>
                      <span>High Activity</span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="h-[500px] lg:h-[600px] relative">
                <MapContainer
                  center={[-1.286389, 36.817223] as LatLngExpression}
                  zoom={13}
                  className="h-full w-full"
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
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

                  <HeatmapLayer heatmapData={heatmapData} intensity={maxIntensity} />
                </MapContainer>
              </div>
            </div>
          </div>
        </div>

        {/* Insights */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-xl p-4 sm:p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-4">Insights & Recommendations</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-blue-800">
            <div>
              <h4 className="font-medium mb-2">High-Demand Areas:</h4>
              <ul className="space-y-1">
                {zoneStats.slice(0, 3).map(zone => (
                  <li key={zone.zone}>• {zone.zone} ({zone.bookings} bookings)</li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-2">Optimization Opportunities:</h4>
              <ul className="space-y-1">
                <li>• Consider adding more slots in high-demand zones</li>
                <li>• Implement dynamic pricing for popular areas</li>
                <li>• Monitor underutilized zones for potential improvements</li>
              </ul>
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