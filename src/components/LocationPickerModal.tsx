import React, { useState, useEffect, useCallback, Component, ErrorInfo, ReactNode } from 'react';
import {
  MapPin,
  Crosshair,
  X,
  Search,
  Check,
  Trash2,
  AlertCircle,
  ExternalLink,
  Navigation,
  Globe,
  Loader2,
} from 'lucide-react';
import type { JournalLocation } from '../types';

interface LocationErrorBoundaryProps {
  children: ReactNode;
}

interface LocationErrorBoundaryState {
  hasError: boolean;
  errorMessage?: string;
}

/**
 * Resilient Error Boundary to ensure map rendering or third-party script failures
 * never crash the application or modal.
 */
class LocationErrorBoundary extends Component<
  LocationErrorBoundaryProps,
  LocationErrorBoundaryState
> {
  constructor(props: LocationErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): LocationErrorBoundaryState {
    return { hasError: true, errorMessage: error?.message || 'An unexpected error occurred.' };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('LocationErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-xl border border-[#e8c2ba] bg-[#faf2f0] p-4 text-xs text-[#8a3324] space-y-2">
          <div className="flex items-center gap-2 font-medium">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>Map preview encountered an issue</span>
          </div>
          <p className="text-[11px] text-natural-text-muted">
            You can still detect your location using the Geolocation API or enter coordinates manually below.
          </p>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false })}
            className="rounded-lg bg-natural-surface border border-natural-border px-2.5 py-1 text-[11px] font-medium text-natural-text hover:bg-natural-surface-alt cursor-pointer"
          >
            Retry Map
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

interface LocationPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentLocation?: JournalLocation;
  onSaveLocation: (location: JournalLocation | undefined) => void;
}

export const LocationPickerModal: React.FC<LocationPickerModalProps> = ({
  isOpen,
  onClose,
  currentLocation,
  onSaveLocation,
}) => {
  // Coordinates state
  const [lat, setLat] = useState<number>(currentLocation?.latitude ?? 37.7749);
  const [lng, setLng] = useState<number>(currentLocation?.longitude ?? -122.4194);
  const [locationName, setLocationName] = useState<string>(currentLocation?.name ?? '');
  const [address, setAddress] = useState<string>(currentLocation?.address ?? '');
  const [accuracy, setAccuracy] = useState<number | undefined>(currentLocation?.accuracy);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<Array<{
    display_name: string;
    lat: string;
    lon: string;
    name?: string;
  }>>([]);

  // Status & error states
  const [isLocating, setIsLocating] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const googleMapsApiKey = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '').trim();

  // Reset or sync with props when opening
  useEffect(() => {
    if (isOpen) {
      if (currentLocation) {
        setLat(currentLocation.latitude);
        setLng(currentLocation.longitude);
        setLocationName(currentLocation.name || '');
        setAddress(currentLocation.address || '');
        setAccuracy(currentLocation.accuracy);
      } else {
        // Default to San Francisco
        setLat(37.7749);
        setLng(-122.4194);
        setLocationName('');
        setAddress('');
        setAccuracy(undefined);
      }
      setSearchQuery('');
      setSearchResults([]);
      setStatusMessage(null);
      setErrorMessage(null);
    }
  }, [isOpen, currentLocation]);

  // Reverse geocode coordinates to get a friendly address/city name
  const reverseGeocode = useCallback(async (targetLat: number, targetLng: number) => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${targetLat}&lon=${targetLng}&zoom=14&addressdetails=1`,
        { headers: { 'User-Agent': 'ReflectAI-Journal/1.0' } }
      );
      if (res.ok) {
        const data = await res.json();
        const display = data.display_name || '';
        const namePart =
          data.address?.suburb ||
          data.address?.city ||
          data.address?.town ||
          data.address?.village ||
          data.name ||
          '';

        setAddress(display);
        if (!locationName && namePart) {
          const stateOrCountry = data.address?.state || data.address?.country || '';
          setLocationName(stateOrCountry ? `${namePart}, ${stateOrCountry}` : namePart);
        }
      }
    } catch {
      // Graceful ignore - coordinates remain valid
    }
  }, [locationName]);

  // Geolocation trigger using HTML5 Geolocation with automatic Google Geolocation API fallback
  const handleGetCurrentLocation = async () => {
    setIsLocating(true);
    setStatusMessage('Acquiring your location...');
    setErrorMessage(null);

    // 1. First attempt browser HTML5 Geolocation
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const newLat = position.coords.latitude;
          const newLng = position.coords.longitude;
          const newAcc = Math.round(position.coords.accuracy);

          setLat(newLat);
          setLng(newLng);
          setAccuracy(newAcc);
          setIsLocating(false);
          setStatusMessage(`Location acquired via device GPS (within ±${newAcc}m).`);
          reverseGeocode(newLat, newLng);
        },
        async (error) => {
          console.warn('Browser HTML5 Geolocation was unavailable or denied:', error.message);
          // 2. Fallback to Google Geolocation API via server proxy
          await queryGoogleGeolocation();
        },
        {
          enableHighAccuracy: true,
          timeout: 8000,
          maximumAge: 30000,
        }
      );
    } else {
      await queryGoogleGeolocation();
    }
  };

  // Query Google Geolocation API (for keys restricted specifically to Geolocation API)
  const queryGoogleGeolocation = async () => {
    try {
      setStatusMessage('Querying Google Geolocation API...');
      const response = await fetch('/api/geolocation/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: googleMapsApiKey || undefined }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      if (typeof data.latitude === 'number' && typeof data.longitude === 'number') {
        setLat(data.latitude);
        setLng(data.longitude);
        setAccuracy(data.accuracy ? Math.round(data.accuracy) : undefined);
        setIsLocating(false);
        setStatusMessage(
          `Location acquired via Google Geolocation API${
            data.accuracy ? ` (within ±${Math.round(data.accuracy)}m)` : ''
          }.`
        );
        reverseGeocode(data.latitude, data.longitude);
        return;
      }
      throw new Error('Google Geolocation did not return coordinates.');
    } catch (err: any) {
      setIsLocating(false);
      setStatusMessage(null);
      setErrorMessage(
        'Could not auto-detect location. You can search an address or enter coordinates manually below.'
      );
    }
  };

  // Search place / address
  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setErrorMessage(null);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          searchQuery.trim()
        )}&limit=5&addressdetails=1`,
        { headers: { 'User-Agent': 'ReflectAI-Journal/1.0' } }
      );
      if (res.ok) {
        const results = await res.json();
        setSearchResults(results);
        if (results.length === 0) {
          setErrorMessage(`No matching places found for "${searchQuery}". Try a broader term.`);
        }
      }
    } catch {
      setErrorMessage('Search request failed. Please check your internet connection.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectSearchResult = (result: any) => {
    const newLat = parseFloat(result.lat);
    const newLng = parseFloat(result.lon);
    if (!isNaN(newLat) && !isNaN(newLng)) {
      setLat(newLat);
      setLng(newLng);
      setAddress(result.display_name || '');
      setLocationName(result.name || result.display_name?.split(',')[0] || searchQuery);
      setSearchResults([]);
      setSearchQuery('');
      setStatusMessage(`Selected: ${result.display_name?.split(',')[0] || 'Location'}`);
    }
  };

  const handleSave = () => {
    const finalLocation: JournalLocation = {
      latitude: Number(lat.toFixed(6)),
      longitude: Number(lng.toFixed(6)),
      name: locationName.trim() || undefined,
      address: address.trim() || undefined,
      accuracy: accuracy || undefined,
      timestamp: Date.now(),
    };
    onSaveLocation(finalLocation);
    onClose();
  };

  const handleRemove = () => {
    onSaveLocation(undefined);
    onClose();
  };

  if (!isOpen) return null;

  // Calculate bounding box for map embed
  const delta = 0.008;
  const bbox = `${(lng - delta).toFixed(5)},${(lat - delta * 0.7).toFixed(5)},${(lng + delta).toFixed(5)},${(lat + delta * 0.7).toFixed(5)}`;
  const mapEmbedUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat.toFixed(5)},${lng.toFixed(5)}`;
  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${lat.toFixed(6)},${lng.toFixed(6)}`;

  return (
    <LocationErrorBoundary>
      <div
        id="location-picker-modal-backdrop"
        className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/40 backdrop-blur-xs animate-in fade-in"
        onClick={onClose}
      >
        <div
          id="location-picker-modal"
          className="w-full max-w-2xl rounded-2xl border border-natural-border bg-natural-card shadow-2xl text-natural-text overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-natural-border px-5 py-3.5 bg-natural-surface/50">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#eef1e6] border border-[#d6dec7] text-natural-olive">
                <MapPin className="h-4 w-4" />
              </div>
              <div>
                <h2 className="font-serif text-sm sm:text-base font-semibold text-natural-text">
                  Pin Location to Reflection
                </h2>
                <p className="text-[11px] text-natural-text-muted">
                  Keep track of where you were when journaling to create location-aware entries
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1 text-natural-text-light hover:text-natural-text rounded-md cursor-pointer transition-colors"
              title="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Content Body */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
            {/* Quick Actions: Detect Device Location */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <button
                id="get-current-location-btn"
                type="button"
                onClick={handleGetCurrentLocation}
                disabled={isLocating}
                className="inline-flex items-center gap-2 rounded-xl bg-natural-olive px-3.5 py-2 text-xs font-medium text-[#fdfcf8] hover:bg-[#38462b] transition-colors focus:outline-none focus:ring-2 focus:ring-natural-olive/40 disabled:opacity-60 cursor-pointer shadow-xs"
              >
                {isLocating ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Detecting location...</span>
                  </>
                ) : (
                  <>
                    <Navigation className="h-3.5 w-3.5" />
                    <span>Use Current Location</span>
                  </>
                )}
              </button>

              <div className="flex items-center gap-2 text-[11px] text-natural-text-muted">
                {accuracy !== undefined && (
                  <span className="inline-flex items-center gap-1 rounded-lg bg-natural-surface border border-natural-border px-2.5 py-1 text-natural-text-muted">
                    <span>GPS Accuracy: ±{accuracy}m</span>
                  </span>
                )}
                <a
                  href={googleMapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-natural-olive hover:underline font-medium"
                >
                  <ExternalLink className="h-3 w-3" />
                  <span>View in Google Maps</span>
                </a>
              </div>
            </div>

            {/* Place / Address Search */}
            <form onSubmit={handleSearch} className="relative">
              <div className="flex items-center rounded-xl border border-natural-border bg-natural-surface px-3 py-1.5 focus-within:border-natural-olive focus-within:ring-1 focus-within:ring-natural-olive">
                <Search className="h-3.5 w-3.5 text-natural-text-light mr-2 shrink-0" />
                <input
                  id="location-search-input"
                  type="text"
                  placeholder="Search landmark, neighborhood, or city..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-transparent text-xs text-natural-text placeholder-natural-text-light focus:outline-none"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setSearchResults([]);
                    }}
                    className="p-1 text-natural-text-light hover:text-natural-text"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
                <button
                  type="submit"
                  disabled={isSearching || !searchQuery.trim()}
                  className="ml-2 rounded-lg bg-natural-card border border-natural-border px-2 py-1 text-[11px] font-medium text-natural-text hover:bg-natural-surface-alt disabled:opacity-50 cursor-pointer"
                >
                  {isSearching ? 'Searching...' : 'Find'}
                </button>
              </div>

              {/* Search Results Dropdown */}
              {searchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 z-20 mt-1 rounded-xl border border-natural-border bg-natural-card shadow-lg max-h-48 overflow-y-auto divide-y divide-natural-border-subtle">
                  {searchResults.map((res, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSelectSearchResult(res)}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-natural-surface transition-colors cursor-pointer flex items-start gap-2"
                    >
                      <MapPin className="h-3.5 w-3.5 text-natural-olive shrink-0 mt-0.5" />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-natural-text truncate">
                          {res.display_name.split(',')[0]}
                        </p>
                        <p className="text-[10px] text-natural-text-muted truncate">
                          {res.display_name}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </form>

            {/* Status / Error Notices */}
            {statusMessage && (
              <div className="rounded-xl border border-[#d6dec7] bg-[#f7f9f3] p-2.5 text-xs text-natural-olive flex items-center gap-2">
                <Check className="h-3.5 w-3.5 shrink-0" />
                <span>{statusMessage}</span>
              </div>
            )}

            {errorMessage && (
              <div className="rounded-xl border border-[#e8c2ba] bg-[#faf2f0] p-2.5 text-xs text-[#8a3324] flex items-center gap-2">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Interactive Map Canvas / Embed */}
            <div className="relative rounded-xl border border-natural-border overflow-hidden h-56 sm:h-64 bg-natural-surface">
              <iframe
                id="location-map-frame"
                title="Location Map"
                src={mapEmbedUrl}
                className="w-full h-full border-0 pointer-events-auto"
                loading="lazy"
              />

              {/* Pinned Coordinates Floating Badge */}
              <div className="absolute bottom-2 left-2 z-10 rounded-lg bg-natural-card/90 backdrop-blur-xs border border-natural-border px-2.5 py-1 text-[10px] font-mono text-natural-text shadow-xs flex items-center gap-1.5">
                <div className="h-2 w-2 rounded-full bg-natural-olive animate-pulse" />
                <span>
                  {lat.toFixed(5)}°, {lng.toFixed(5)}°
                </span>
              </div>
            </div>

            {/* Place Details Form */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-natural-text-muted mb-1">
                  Place or Venue Name
                </label>
                <input
                  id="location-name-input"
                  type="text"
                  placeholder="e.g., Redwood Grove, SF"
                  value={locationName}
                  onChange={(e) => setLocationName(e.target.value)}
                  className="w-full rounded-xl border border-natural-border bg-natural-surface px-3 py-2 text-xs text-natural-text placeholder-natural-text-light focus:outline-none focus:ring-1 focus:ring-natural-olive"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-natural-text-muted mb-1">
                  Address or Neighborhood
                </label>
                <input
                  id="location-address-input"
                  type="text"
                  placeholder="e.g., Golden Gate Park, CA"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full rounded-xl border border-natural-border bg-natural-surface px-3 py-2 text-xs text-natural-text placeholder-natural-text-light focus:outline-none focus:ring-1 focus:ring-natural-olive"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-natural-text-muted mb-1">
                  Latitude
                </label>
                <input
                  id="location-latitude-input"
                  type="number"
                  step="0.0001"
                  value={lat}
                  onChange={(e) => {
                    const parsed = parseFloat(e.target.value);
                    if (!isNaN(parsed) && parsed >= -90 && parsed <= 90) {
                      setLat(parsed);
                    }
                  }}
                  className="w-full rounded-xl border border-natural-border bg-natural-surface px-3 py-2 text-xs font-mono text-natural-text focus:outline-none focus:ring-1 focus:ring-natural-olive"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-natural-text-muted mb-1">
                  Longitude
                </label>
                <input
                  id="location-longitude-input"
                  type="number"
                  step="0.0001"
                  value={lng}
                  onChange={(e) => {
                    const parsed = parseFloat(e.target.value);
                    if (!isNaN(parsed) && parsed >= -180 && parsed <= 180) {
                      setLng(parsed);
                    }
                  }}
                  className="w-full rounded-xl border border-natural-border bg-natural-surface px-3 py-2 text-xs font-mono text-natural-text focus:outline-none focus:ring-1 focus:ring-natural-olive"
                />
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="border-t border-natural-border px-5 py-3.5 bg-natural-surface/50 flex flex-wrap items-center justify-between gap-2">
            {currentLocation ? (
              <button
                id="remove-location-pin-btn"
                type="button"
                onClick={handleRemove}
                className="inline-flex items-center gap-1.5 text-xs text-[#b84a37] hover:text-[#8a3324] font-medium cursor-pointer"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Remove Pin</span>
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2">
              <button
                id="cancel-location-btn"
                type="button"
                onClick={onClose}
                className="rounded-xl border border-natural-border bg-natural-card px-3.5 py-2 text-xs font-medium text-natural-text hover:bg-natural-surface transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                id="save-location-pin-btn"
                type="button"
                onClick={handleSave}
                className="inline-flex items-center gap-1.5 rounded-xl bg-natural-olive px-4 py-2 text-xs font-medium text-[#fdfcf8] hover:bg-[#38462b] transition-colors focus:outline-none focus:ring-2 focus:ring-natural-olive/40 cursor-pointer shadow-xs"
              >
                <Check className="h-3.5 w-3.5" />
                <span>Attach Location</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </LocationErrorBoundary>
  );
};
