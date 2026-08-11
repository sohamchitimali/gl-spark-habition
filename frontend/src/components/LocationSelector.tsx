import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import Loading from './Loading';

// Fix for default marker icon in react-leaflet
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

interface LocationSelectorProps {
  latitude: number | null;
  longitude: number | null;
  addressDisplay: string;
  onChange: (lat: number | null, lng: number | null, address: string) => void;
}

// Component to dynamically update map center
const MapUpdater = ({ lat, lng }: { lat: number, lng: number }) => {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], 13);
  }, [lat, lng, map]);
  return null;
};

const LocationSelector: React.FC<LocationSelectorProps> = ({ latitude, longitude, addressDisplay, onChange }) => {
  const [query, setQuery] = useState(addressDisplay);
  const [results, setResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  // Sync internal query state if addressDisplay prop changes
  useEffect(() => {
    if (addressDisplay && query !== addressDisplay) {
        setQuery(addressDisplay);
    }
  }, [addressDisplay]);

  const searchLocation = async (e?: React.FormEvent | React.MouseEvent | React.KeyboardEvent) => {
    if (e) e.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`);
      const data = await res.json();
      setResults(data);
    } catch (err) {
      console.error("Failed to fetch location", err);
    } finally {
      setSearching(false);
    }
  };

  const handleSelect = (result: any) => {
    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);
    onChange(lat, lng, result.display_name);
    setQuery(result.display_name);
    setResults([]);
  };

  const handleClear = () => {
    setQuery('');
    setResults([]);
    onChange(null, null, '');
  };

  return (
    <div className="space-y-4">
      <div className="relative">
        <div className="flex gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && searchLocation(e)}
            placeholder="Search for a city or neighborhood..."
            className="w-full px-4 py-3 rounded-xl text-white placeholder-gray-500 outline-none transition-all"
            style={{ background: '#363634', border: '1px solid #424240' }}
            onFocus={(e) => { e.target.style.borderColor = '#534AB7'; }}
            onBlur={(e) => { e.target.style.borderColor = '#424240'; }}
          />
          <button 
            type="button" 
            onClick={searchLocation}
            disabled={searching}
            className="px-4 rounded-xl font-medium text-white transition-all hover:opacity-80"
            style={{ background: '#534AB7' }}
          >
            {searching ? '...' : 'Search'}
          </button>
          {latitude && (
            <button 
                type="button" 
                onClick={handleClear}
                className="px-4 rounded-xl font-medium text-white transition-all hover:bg-red-500/20 text-red-400"
            >
                Clear
            </button>
          )}
        </div>

        {/* Dropdown Results */}
        {results.length > 0 && (
          <ul className="absolute z-50 w-full mt-2 rounded-xl overflow-hidden shadow-2xl max-h-60 overflow-y-auto"
              style={{ background: '#2C2C2A', border: '1px solid #424240' }}>
            {results.map((r, i) => (
              <li 
                key={i} 
                onClick={() => handleSelect(r)}
                className="px-4 py-3 text-sm text-gray-300 hover:text-white cursor-pointer transition-colors"
                style={{ borderBottom: i === results.length - 1 ? 'none' : '1px solid #363634' }}
              >
                {r.display_name}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Map Display */}
      <div className="h-72 w-full rounded-xl overflow-hidden border border-gray-700 relative z-0">
        {searching && (
          <div className="absolute inset-0 z-[1000] bg-[#1a1a18]/80 backdrop-blur-sm flex items-center justify-center">
            <Loading size={16} />
          </div>
        )}
        <MapContainer 
          center={latitude && longitude ? [latitude, longitude] : [39.8283, -98.5795]} 
          zoom={latitude && longitude ? 13 : 3} 
          scrollWheelZoom={false}
          style={{ height: '100%', width: '100%', background: '#1a1a18' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {latitude && longitude && (
            <>
              <Marker position={[latitude, longitude]} />
              <MapUpdater lat={latitude} lng={longitude} />
            </>
          )}
        </MapContainer>
      </div>
    </div>
  );
};

export default LocationSelector;
