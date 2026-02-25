import React, { useEffect, useRef, useState } from 'react';
import FadeLoader from 'react-spinners/FadeLoader';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { LatLngExpression } from 'leaflet';
import { Navigation, MapPin, DollarSign, Clock, Route } from 'lucide-react';
import { useAppStore } from '../../stores/appStore';
import { fetchParkingSlots } from '../../API/parkingSlotApi';
import 'leaflet/dist/leaflet.css';

// Fix for default markers in React-Leaflet
import L from 'leaflet';
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const FlyToLocation: React.FC<{ center: LatLngExpression }> = ({ center }) => {
  const map = useMap();
  
  useEffect(() => {
    map.flyTo(center, 13);
  }, [center, map]);

  return null;
};

// Calculate distance between two coordinates using Haversine formula
const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in kilometers
};

// Format distance for display
const formatDistance = (distanceKm: number): string => {
  if (distanceKm < 1) {
    return `${Math.round(distanceKm * 1000)} m`;
  }
  return `${distanceKm.toFixed(1)} km`;
};

// Estimate travel time based on distance (assuming average city driving speed of 30 km/h)
const estimateTravelTime = (distanceKm: number): string => {
  const avgSpeedKmH = 30; // Average city driving speed
  const timeHours = distanceKm / avgSpeedKmH;
  const timeMinutes = Math.round(timeHours * 60);
  
  if (timeMinutes < 1) {
    return '< 1 min';
  } else if (timeMinutes < 60) {
    return `${timeMinutes} min`;
  } else {
    const hours = Math.floor(timeMinutes / 60);
    const mins = timeMinutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  }
};

// Component to listen to map movements and call a callback with bounds (debounced)
const MapBoundsListener: React.FC<{ onBoundsChange: (sw: [number, number], ne: [number, number]) => void }> = ({ onBoundsChange }) => {
  const map = useMap();
  const timeoutRef = React.useRef<number | null>(null);

  useEffect(() => {
    const handleMoveEnd = () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
      // debounce by 350ms
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

export const MapView: React.FC = () => {
    // Helper to recenter map on user location
    const recenterOnUser = () => {
      if (userLocation && mapRef.current) {
        mapRef.current.setView(userLocation, 15);
        setSelectedLocation(userLocation);
      }
    };
  const { slots: storeSlots, setSlots } = useAppStore();
  const [slots, setLocalSlots] = useState<typeof storeSlots>(storeSlots);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<[number, number] | null>([-1.2864, 36.8172]); // ✅ Nairobi CBD
  const [selectedSlot, setSelectedSlot] = useState<string | number | null>(null);
  const mapRef = useRef<any>(null);


  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation([position.coords.latitude, position.coords.longitude]);
        setSelectedLocation([position.coords.latitude, position.coords.longitude]);
      },
      (error) => {
        console.log('Could not get user location:', error);
      }
    );
  }, []);

  // Initial load: fetch slots around selectedLocation (or default center)
  useEffect(() => {
    const center = selectedLocation ?? [-1.2864, 36.8172];
    // create a small bbox around center (approx ~0.05 degrees)
    const delta = 0.05;
    const sw: [number, number] = [center[0] - delta, center[1] - delta];
    const ne: [number, number] = [center[0] + delta, center[1] + delta];
    fetchSlotsByBounds(sw, ne);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLocation]);

  // Sync store -> local
  useEffect(() => {
    setLocalSlots(storeSlots);
  }, [storeSlots]);

  // Helper: transform API slot shape to app state shape (if needed)
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

  // Fetch slots from API within given bounds (southWest, northEast)
  const fetchSlotsByBounds = async (southWest?: [number, number], northEast?: [number, number]) => {
    setLoading(true);
    setError(null);
    try {
      // If API supports bounding box query, pass as params; otherwise fetch all and filter client-side
      const response = await fetchParkingSlots();
      // transform and optionally filter by bounds
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
      // also update global store so other components see latest
      setSlots(transformed);
    } catch (e: any) {
      console.error('Error fetching slots:', e);
      setError(e?.message || 'Failed to fetch slots');
    } finally {
      setLoading(false);
    }
  };

  const handleSlotSelect = (slotId: string | number) => {
    const slot = slots.find(s => s.id === slotId);
    if (slot && slot.coordinates) {
      setSelectedSlot(slotId);
      setSelectedLocation(slot.coordinates as [number, number]);
    }
  };

  const getDirections = (slotId: string | number) => {
    const slot = slots.find(s => s.id === slotId);
    if (slot && userLocation) {
      const coords = slot.coordinates || [0, 0];
      const url = `https://www.google.com/maps/dir/${userLocation[0]},${userLocation[1]}/${coords[0]},${coords[1]}`;
      window.open(url, '_blank');
    }
  };

  const createCustomIcon = (isBooked: boolean, type: string) => {
    const color = isBooked ? '#ef4444' : type === 'premium' ? '#8b5cf6' : type === 'disabled' ? '#16a34a' : '#3b82f6';
    
    return L.divIcon({
      className: 'custom-marker',
      html: `<div style="background-color: ${color}; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.2);"></div>`,
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    });
  };

  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Parking Slot Map</h1>
          <p className="text-gray-600">Find and navigate to available parking slots near you</p>
        </div>

        <div className="grid lg:grid-cols-4 gap-8">
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Available Slots</h3>
              
              <div className="space-y-3">
                {loading && (
                  <div className="flex items-center justify-center min-h-[120px]">
                    <FadeLoader color="#2563EB" />
                  </div>
                )}
                {error && <div className="text-sm text-red-500">{error}</div>}
                {slots.map((slot) => (
                  <div
                    key={slot.id}
                    onClick={() => handleSlotSelect(slot.id)}
                    className={`p-3 border rounded-lg cursor-pointer transition-all duration-200 ${
                      selectedSlot === slot.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    } ${slot.isBooked ? 'opacity-50' : ''}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-gray-900">#{slot.number}</span>
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        slot.isBooked 
                          ? 'bg-red-100 text-red-800' 
                          : 'bg-green-100 text-green-800'
                      }`}>
                        {slot.isBooked ? 'Booked' : 'Free'}
                      </span>
                    </div>
                    
                    <div className="flex items-center text-sm text-gray-600 mb-2">
                      <MapPin className="h-3 w-3 mr-1" />
                      {slot.location}
                    </div>

                    {/* Distance and Time from user */}
                    {userLocation && slot.coordinates && (() => {
                      const distance = calculateDistance(
                        userLocation[0], userLocation[1],
                        slot.coordinates[0], slot.coordinates[1]
                      );
                      return (
                        <div className="flex items-center gap-3 text-xs text-gray-500 mb-2 bg-gray-50 rounded px-2 py-1">
                          <div className="flex items-center">
                            <Route className="h-3 w-3 mr-1 text-blue-500" />
                            <span>{formatDistance(distance)}</span>
                          </div>
                          <div className="flex items-center">
                            <Clock className="h-3 w-3 mr-1 text-orange-500" />
                            <span>{estimateTravelTime(distance)}</span>
                          </div>
                        </div>
                      );
                    })()}
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center text-sm">
                        <DollarSign className="h-3 w-3 text-blue-600" />
                        <span className="font-medium text-blue-600">KSh {slot.price}/hr</span>
                      </div>
                      
                      {!slot.isBooked && userLocation && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            getDirections(slot.id);
                          }}
                          className="text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700 transition-colors flex items-center space-x-1"
                        >
                          <Navigation className="h-3 w-3" />
                          <span>Navigate</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="lg:col-span-3">
            <div className="bg-white rounded-xl shadow-lg overflow-hidden">
              <div className="h-[600px] relative">
                {/* Locate Me Button */}
                {userLocation && (
                  <button
                    onClick={recenterOnUser}
                    className="absolute z-[1000] top-4 right-4 bg-blue-600 text-white px-3 py-2 rounded shadow hover:bg-blue-700 transition-colors"
                  >
                    Locate Me
                  </button>
                )}
                <MapContainer
                  ref={mapRef}
                  center={selectedLocation ?? [-1.2864, 36.8172]}
                  zoom={13}
                  className="h-full w-full"
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  {selectedLocation && <FlyToLocation center={selectedLocation} />}
                  <MapBoundsListener onBoundsChange={(sw, ne) => fetchSlotsByBounds(sw, ne)} />
                  {/* User marker with clear label */}
                  {userLocation && (
                    <Marker 
                      position={userLocation as [number, number]}
                      icon={L.divIcon({
                        className: 'user-marker',
                        html: '<div style="background-color: #16a34a; width: 20px; height: 20px; border-radius: 50%; border: 3px solid #2563eb; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>',
                        iconSize: [20, 20],
                        iconAnchor: [10, 10],
                      })}
                    >
                      <Popup>
                        <div style={{fontWeight: 'bold', color: '#16a34a'}}>You are here</div>
                      </Popup>
                    </Marker>
                  )}
                  {/* Slot markers */}
                  {slots.map((slot) => (
                    <Marker
                      key={slot.id}
                      position={(slot.coordinates || [0, 0]) as [number, number]}
                      icon={createCustomIcon(slot.isBooked, slot.type)}
                    >
                      <Popup>
                        <div className="p-2">
                          <h4 className="font-bold">#{slot.number}</h4>
                          <p className="text-sm text-gray-600">{slot.location}</p>
                          <p className="text-sm">
                            <span className="font-medium">KSh {slot.price}/hr</span>
                            <span className={`ml-2 px-2 py-1 rounded text-xs ${
                              slot.isBooked 
                                ? 'bg-red-100 text-red-800' 
                                : 'bg-green-100 text-green-800'
                            }`}>
                              {slot.isBooked ? 'Booked' : 'Available'}
                            </span>
                          </p>
                          {/* Distance and time in popup */}
                          {userLocation && slot.coordinates && (() => {
                            const distance = calculateDistance(
                              userLocation[0], userLocation[1],
                              slot.coordinates[0], slot.coordinates[1]
                            );
                            return (
                              <div className="mt-2 pt-2 border-t border-gray-200">
                                <p className="text-xs text-gray-600 flex items-center gap-2">
                                  <span className="flex items-center">
                                    <span style={{marginRight: '4px'}}>📍</span>
                                    {formatDistance(distance)}
                                  </span>
                                  <span className="flex items-center">
                                    <span style={{marginRight: '4px'}}>🕐</span>
                                    {estimateTravelTime(distance)}
                                  </span>
                                </p>
                              </div>
                            );
                          })()}
                        </div>
                      </Popup>
                    </Marker>
                  ))}
                </MapContainer>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};