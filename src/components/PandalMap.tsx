import React, { useState, useMemo, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Pandal, FilterChip } from '../types/pandal';
import { MOCK_PANDALS } from '../data/mockPandals';
import { Coordinates } from '../data/kolkataCrossings';
import { CrowdReportModal, CrowdReportSubmission } from './CrowdReportModal';
import { CircuitPlannerModal } from './CircuitPlannerModal';
import { PandalListView } from './PandalListView';
import { CuratedCircuitsModal } from './CuratedCircuitsModal';
import { EmergencyHelplineModal } from './EmergencyHelplineModal';
import { CuratedCircuit } from '../data/curatedCircuits';
import { getWaitTimeColorConfig } from '../utils/colorConfig';
import { dhakPlayer } from '../utils/dhakAudio';
import {
  calculateOptimalHoppingCircuit,
  PedestrianHoppingCircuit,
} from '../utils/pedestrianRouter';

// Kolkata City Coordinates (Exact requested center)
const KOLKATA_CENTER: [number, number] = [22.5726, 88.3639];
const DEFAULT_ZOOM = 12;

export type RegionFilter = 'All' | 'South' | 'North' | 'East' | 'Central';

const REGION_CONFIG: Record<
  RegionFilter,
  { center: [number, number]; zoom: number; label: string; count: number }
> = {
  All: { center: [22.5726, 88.3639], zoom: 12, label: 'All Regions', count: 70 },
  South: { center: [22.518, 88.358], zoom: 13, label: 'South Kolkata', count: 28 },
  North: { center: [22.598, 88.368], zoom: 13, label: 'North Kolkata', count: 23 },
  East: { center: [22.585, 88.405], zoom: 13, label: 'Salt Lake & East', count: 12 },
  Central: { center: [22.572, 88.355], zoom: 14, label: 'Central & Howrah', count: 7 },
};

interface PandalMapProps {
  pandals?: Pandal[];
  onReportCrowdClick?: (pandal: Pandal) => void;
}

// ----------------------------------------------------------------------------
// Custom Leaflet Circular Marker with Visited & Circuit Index Badges
// ----------------------------------------------------------------------------
const createPandalIcon = (
  pandal: Pandal,
  isSelected: boolean,
  circuitIndex: number,
  isVisited: boolean
): L.DivIcon => {
  const waitTime = pandal.wait_time_minutes ?? 15;
  const config = getWaitTimeColorConfig(waitTime);
  const isInCircuit = circuitIndex >= 0;

  let badgeContent = `${waitTime}m`;
  let borderStyle = '2px solid rgba(255,255,255,0.9)';
  let bgGradient = config.markerGradient;
  let shadow = config.boxShadow;

  if (isVisited) {
    badgeContent = '✓';
    bgGradient = 'linear-gradient(135deg, #059669, #047857)';
    borderStyle = '2.5px solid #6ee7b7';
    shadow = '0 0 16px rgba(16, 185, 129, 0.85)';
  } else if (isInCircuit) {
    badgeContent = `#${circuitIndex + 1}`;
    bgGradient = 'linear-gradient(135deg, #f59e0b, #d97706)';
    borderStyle = '2.5px solid #fef08a';
    shadow = '0 0 18px rgba(245, 158, 11, 0.85)';
  }

  if (isSelected) {
    borderStyle = '3px solid #ffffff';
  }

  return L.divIcon({
    className: 'custom-pandal-marker-wrapper',
    html: `
      <div style="position: relative; width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; cursor: pointer;">
        <div class="animate-marker-pulse" style="position: absolute; width: 44px; height: 44px; border-radius: 50%; background: radial-gradient(circle, ${config.pulseRgba} 0%, rgba(0,0,0,0) 70%); pointer-events: none;"></div>
        <div style="position: relative; width: 38px; height: 38px; border-radius: 50%; background: ${bgGradient}; border: ${borderStyle}; box-shadow: ${shadow}; display: flex; align-items: center; justify-content: center; color: #ffffff; font-weight: 800; font-size: ${
      isVisited ? '14px' : '11px'
    }; transform: ${
      isSelected ? 'scale(1.22)' : isInCircuit ? 'scale(1.12)' : 'scale(1)'
    }; transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);">
          <span>${badgeContent}</span>
        </div>
      </div>
    `,
    iconSize: [44, 44],
    iconAnchor: [22, 22],
  });
};

// ----------------------------------------------------------------------------
// Map View Controller with offset for bottom drawer & region jumps
// ----------------------------------------------------------------------------
const MapController: React.FC<{
  selectedPandal: Pandal | null;
  targetRegion: RegionFilter;
  flyCoords: [number, number] | null;
}> = ({ selectedPandal, targetRegion, flyCoords }) => {
  const map = useMap();
  const prevRegion = useRef<RegionFilter>('All');

  // Fly to target coordinates
  useEffect(() => {
    if (flyCoords) {
      map.flyTo(flyCoords, 14, { duration: 0.8, easeLinearity: 0.25 });
    }
  }, [flyCoords, map]);

  // Fly to selected pandal with bottom drawer offset
  useEffect(() => {
    if (selectedPandal) {
      const lat = selectedPandal.entry_lat ?? selectedPandal.latitude ?? KOLKATA_CENTER[0];
      const lng = selectedPandal.entry_lng ?? selectedPandal.longitude ?? KOLKATA_CENTER[1];
      map.flyTo([lat - 0.005, lng], 15, { duration: 0.7, easeLinearity: 0.25 });
    }
  }, [selectedPandal, map]);

  // Fly to selected region when tab changes
  useEffect(() => {
    if (targetRegion !== prevRegion.current && !selectedPandal) {
      prevRegion.current = targetRegion;
      const conf = REGION_CONFIG[targetRegion];
      map.flyTo(conf.center, conf.zoom, { duration: 0.8, easeLinearity: 0.25 });
    }
  }, [targetRegion, selectedPandal, map]);

  return null;
};

// ----------------------------------------------------------------------------
// Custom Tile Layer Caching via Browser CacheStorage API
// ----------------------------------------------------------------------------
const TileCacheManager: React.FC = () => {
  const map = useMap();

  useEffect(() => {
    if (typeof window === 'undefined' || !('caches' in window)) return;

    const handleTileLoad = (e: any) => {
      const tile = e.tile as HTMLImageElement;
      if (tile && tile.src && tile.src.startsWith('http')) {
        caches.open('pujo-tile-cache-v1').then((cache) => {
          cache.match(tile.src).then((cached) => {
            if (!cached) {
              fetch(tile.src, { mode: 'no-cors' })
                .then((res) => cache.put(tile.src, res))
                .catch(() => {});
            }
          });
        });
      }
    };

    map.on('tileload', handleTileLoad);
    return () => {
      map.off('tileload', handleTileLoad);
    };
  }, [map]);

  return null;
};

// ----------------------------------------------------------------------------
// Main Component: PandalMap
// ----------------------------------------------------------------------------
export const PandalMap: React.FC<PandalMapProps> = ({
  pandals = MOCK_PANDALS,
  onReportCrowdClick,
}) => {
  const [selectedPandal, setSelectedPandal] = useState<Pandal | null>(null);
  const [selectedRegion, setSelectedRegion] = useState<RegionFilter>('All');
  const [activeFilter, setActiveFilter] = useState<FilterChip>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [viewMode, setViewMode] = useState<'map' | 'list'>('map');
  const [mapFlyTarget, setMapFlyTarget] = useState<[number, number] | null>(null);

  // Audio Ambience
  const [isDhakPlaying, setIsDhakPlaying] = useState<boolean>(false);

  // Modals
  const [isCircuitModalOpen, setIsCircuitModalOpen] = useState<boolean>(false);
  const [isTrailsModalOpen, setIsTrailsModalOpen] = useState<boolean>(false);
  const [isHelplineModalOpen, setIsHelplineModalOpen] = useState<boolean>(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState<boolean>(false);

  // Toast message
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimeoutRef = useRef<number | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = window.setTimeout(() => {
      setToastMessage(null);
    }, 2800);
  };

  // Route Circuit State
  const [circuitPandalIds, setCircuitPandalIds] = useState<string[]>([]);
  const [activeCircuit, setActiveCircuit] = useState<PedestrianHoppingCircuit | null>(null);

  // Wishlist & Visited State persisted in localStorage
  const [savedPandalIds, setSavedPandalIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('pujo_saved_pandals');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [visitedPandalIds, setVisitedPandalIds] = useState<string[]>(() => {
    try {
      const visited = localStorage.getItem('pujo_visited_pandals');
      return visited ? JSON.parse(visited) : [];
    } catch {
      return [];
    }
  });

  // Save to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('pujo_saved_pandals', JSON.stringify(savedPandalIds));
    } catch {}
  }, [savedPandalIds]);

  useEffect(() => {
    try {
      localStorage.setItem('pujo_visited_pandals', JSON.stringify(visitedPandalIds));
    } catch {}
  }, [visitedPandalIds]);

  // User coordinates (defaults to Kolkata center)
  const [userLocation, setUserLocation] = useState<Coordinates>({
    latitude: 22.5726,
    longitude: 88.3639,
  });
  const [isLocating, setIsLocating] = useState<boolean>(false);

  // Swipeable drawer touch state
  const [dragY, setDragY] = useState<number>(0);
  const touchStartY = useRef<number>(0);
  const isDragging = useRef<boolean>(false);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
    isDragging.current = true;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging.current) return;
    const deltaY = e.touches[0].clientY - touchStartY.current;
    if (deltaY > 0) {
      setDragY(deltaY);
    }
  };

  const handleTouchEnd = () => {
    isDragging.current = false;
    if (dragY > 75) {
      setSelectedPandal(null);
    }
    setDragY(0);
  };

  // Dhak Audio Toggle
  const handleToggleDhak = () => {
    const playing = dhakPlayer.toggle();
    setIsDhakPlaying(playing);
    showToast(playing ? '🪘 Dhak & Kashor Ambience: Playing' : '🔇 Dhak Ambience: Paused');
  };

  // Toggle pandal in/out of hopping circuit
  const handleToggleCircuit = (pandalId: string) => {
    setCircuitPandalIds((prev) => {
      if (prev.includes(pandalId)) {
        showToast('Removed from Hopping Circuit');
        return prev.filter((id) => id !== pandalId);
      }
      if (prev.length >= 6) {
        alert('Maximum 6 pandals allowed per hopping circuit.');
        return prev;
      }
      showToast(`Added to Circuit (#${prev.length + 1})`);
      return [...prev, pandalId];
    });
  };

  // Toggle Saved Wishlist
  const handleToggleSaved = (pandalId: string) => {
    setSavedPandalIds((prev) => {
      if (prev.includes(pandalId)) {
        showToast('Removed from Saved Wishlist');
        return prev.filter((id) => id !== pandalId);
      }
      showToast('❤️ Saved to Pujo Wishlist');
      return [...prev, pandalId];
    });
  };

  // Toggle Visited Status
  const handleToggleVisited = (pandalId: string) => {
    setVisitedPandalIds((prev) => {
      if (prev.includes(pandalId)) {
        showToast('Marked as unvisited');
        return prev.filter((id) => id !== pandalId);
      }
      showToast(`🎉 Pandal Checked Off! (${prev.length + 1}/70 visited)`);
      return [...prev, pandalId];
    });
  };

  // Handle Curated Circuit Selection
  const handleSelectCuratedCircuit = (circuit: CuratedCircuit) => {
    setCircuitPandalIds(circuit.pandalIds);
    // Focus camera on first pandal of the circuit
    const firstPandal = pandals.find((p) => p.id === circuit.pandalIds[0]);
    if (firstPandal) {
      setMapFlyTarget([
        firstPandal.entry_lat ?? firstPandal.latitude ?? KOLKATA_CENTER[0],
        firstPandal.entry_lng ?? firstPandal.longitude ?? KOLKATA_CENTER[1],
      ]);
    }
    setViewMode('map');
    showToast(`🗺️ Loaded "${circuit.titleEn}" Circuit`);
  };

  // Re-calculate active circuit polyline when 3-6 pandals are selected
  useEffect(() => {
    if (circuitPandalIds.length >= 3 && circuitPandalIds.length <= 6) {
      try {
        const computed = calculateOptimalHoppingCircuit(
          circuitPandalIds,
          userLocation,
          pandals,
          { walkingSpeedKmH: 4.0 }
        );
        setActiveCircuit(computed);
      } catch (e) {
        console.warn('Circuit computation notice:', e);
      }
    } else {
      setActiveCircuit(null);
    }
  }, [circuitPandalIds, userLocation, pandals]);

  // Request browser GPS position
  const handleLocateMe = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords: Coordinates = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        };
        setUserLocation(coords);
        setMapFlyTarget([coords.latitude, coords.longitude]);
        setIsLocating(false);
        showToast('📍 Centered on your GPS Location');
      },
      (err) => {
        console.warn('GPS location error:', err);
        setIsLocating(false);
        setUserLocation({ latitude: 22.5726, longitude: 88.3639 });
        showToast('Centered on Central Kolkata');
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  // Comprehensive Search and Filter Pipeline
  const filteredPandals = useMemo(() => {
    return pandals.filter((p) => {
      // 1. Region filter
      const cluster = p.cluster || '';
      if (selectedRegion === 'South' && !cluster.startsWith('South-')) return false;
      if (selectedRegion === 'North' && !cluster.startsWith('North-')) return false;
      if (selectedRegion === 'East' && !cluster.startsWith('East-')) return false;
      if (
        selectedRegion === 'Central' &&
        !(cluster.startsWith('Central-') || cluster.startsWith('West-') || cluster.includes('Howrah'))
      ) {
        return false;
      }

      // 2. Feature chip filter
      const wait = p.wait_time_minutes ?? 0;
      const senior = p.senior_line ?? p.senior_queue ?? false;
      const walkMins = p.walk_mins ?? p.metro_walking_mins ?? 99;
      const hasMetro = !!(p.nearest_metro ?? p.nearest_metro_station);
      const isSaved = savedPandalIds.includes(p.id);
      const isVisited = visitedPandalIds.includes(p.id);

      if (activeFilter === 'Low Wait (<30m)' && wait >= 30) return false;
      if (activeFilter === 'Senior Access' && !senior) return false;
      if (activeFilter === 'Near Metro' && (!hasMetro || walkMins > 10)) return false;
      if (activeFilter === 'Saved' && !isSaved) return false;
      if (activeFilter === 'Visited' && !isVisited) return false;

      // 3. Text search (English name, Bengali name, cluster, nearest metro)
      if (searchQuery.trim().length > 0) {
        const query = searchQuery.trim().toLowerCase();
        const enMatch = (p.name_en || p.name || '').toLowerCase().includes(query);
        const bnMatch = (p.name_bn || p.bengali_name || '').includes(query);
        const clusterMatch = cluster.toLowerCase().includes(query);
        const metroMatch = (p.nearest_metro || p.nearest_metro_station || '')
          .toLowerCase()
          .includes(query);
        if (!enMatch && !bnMatch && !clusterMatch && !metroMatch) {
          return false;
        }
      }

      return true;
    });
  }, [pandals, selectedRegion, activeFilter, searchQuery, savedPandalIds, visitedPandalIds]);

  // Selected pandal helpers
  const selectedWaitMins = selectedPandal?.wait_time_minutes ?? 15;
  const colorConfig = getWaitTimeColorConfig(selectedWaitMins);

  const pandalNameEn = selectedPandal?.name_en ?? selectedPandal?.name ?? 'Pandal Entry';
  const pandalNameBn = selectedPandal?.name_bn ?? selectedPandal?.bengali_name;
  const lat = selectedPandal?.entry_lat ?? selectedPandal?.latitude ?? KOLKATA_CENTER[0];
  const lng = selectedPandal?.entry_lng ?? selectedPandal?.longitude ?? KOLKATA_CENTER[1];

  const isSelectedInCircuit = selectedPandal ? circuitPandalIds.includes(selectedPandal.id) : false;
  const selectedCircuitIdx = selectedPandal ? circuitPandalIds.indexOf(selectedPandal.id) : -1;
  const isSelectedSaved = selectedPandal ? savedPandalIds.includes(selectedPandal.id) : false;
  const isSelectedVisited = selectedPandal ? visitedPandalIds.includes(selectedPandal.id) : false;

  const seniorAccess = selectedPandal?.senior_line ?? selectedPandal?.senior_queue;
  const wheelchairAccess = selectedPandal?.wheelchair_access ?? selectedPandal?.wheelchair_accessible;
  const metroStation = selectedPandal?.nearest_metro ?? selectedPandal?.nearest_metro_station;
  const metroLine = selectedPandal?.metro_line;
  const metroGate = selectedPandal?.metro_gate;
  const walkMins = selectedPandal?.walk_mins ?? selectedPandal?.metro_walking_mins;
  const medicalKiosk = selectedPandal?.medical_kiosk ?? selectedPandal?.medical_booth;
  const restroomNearby = selectedPandal?.restroom_nearby;

  // Direct pedestrian barricade walking navigation trigger
  const handleLaunchNavigation = () => {
    const isApple = typeof navigator !== 'undefined' && /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent);
    const navUrl = isApple
      ? `maps://maps.apple.com/?daddr=${lat},${lng}&dirflg=w`
      : `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=walking`;
    window.open(navUrl, '_blank', 'noopener,noreferrer');
  };

  // WhatsApp Share trigger
  const handleShareWhatsApp = () => {
    if (!selectedPandal) return;
    const msg = `🪔 *${pandalNameEn}* (${pandalNameBn || ''})\n⚡ Live Wait Time: ~${selectedWaitMins} mins\n🚇 Nearest Metro: ${
      metroStation || 'Kolkata Metro'
    } (${walkMins ? `${walkMins}m walk` : 'Nearby'})\n📍 Direct Pedestrian Barricade Location: https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=walking\n\nPlan your Durga Puja pandal-hopping route on *PujoNavigate*!`;
    const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;
    window.open(whatsappUrl, '_blank');
  };

  return (
    <div className="relative w-full h-[100dvh] bg-[#0b0e14] text-slate-100 overflow-hidden font-sans select-none">
      {/* ----------------- Floating Toast Notification ----------------- */}
      {toastMessage && (
        <div className="fixed top-3 left-1/2 -translate-x-1/2 z-[3000] px-4 py-2 rounded-2xl bg-amber-500/90 backdrop-blur-md text-slate-950 font-bold text-xs shadow-2xl animate-in slide-in-from-top-3 duration-200 pointer-events-none flex items-center gap-2">
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ----------------- Top Header & Navbar ----------------- */}
      <header className="absolute top-0 left-0 right-0 z-[1000] p-3 pb-2 bg-gradient-to-b from-[#0b0e14]/98 via-[#0b0e14]/90 to-transparent pointer-events-none">
        {/* Brand & Action Controls */}
        <div className="flex items-center justify-between mb-2 pointer-events-auto">
          {/* Logo & Live Pandal Status */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-slate-950 font-black shadow-md shadow-amber-500/30 text-base">
              🪔
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-extrabold text-white tracking-tight leading-none font-heading">
                  PujoNavigate
                </h1>
                <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 uppercase tracking-wider">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  70 Live
                </span>
                {visitedPandalIds.length > 0 && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                    ✓ {visitedPandalIds.length} Visited
                  </span>
                )}
              </div>
              <span className="text-[10px] text-amber-300 font-medium tracking-wide">
                শারদোৎসব ২০২৬ • Kolkata Durga Puja
              </span>
            </div>
          </div>

          {/* Right Action Icons: Dhak Ambience + Curated Trails + SOS Helpline + View Toggle */}
          <div className="flex items-center gap-1.5">
            {/* Dhak Ambience Player */}
            <button
              type="button"
              onClick={handleToggleDhak}
              className={`p-1.5 px-2 rounded-xl text-xs font-bold transition-all border flex items-center gap-1 ${
                isDhakPlaying
                  ? 'bg-amber-400 text-slate-950 border-amber-400 shadow-md shadow-amber-400/30 animate-pulse'
                  : 'bg-slate-900/90 border-slate-700/60 text-amber-300 hover:text-white'
              }`}
              title={isDhakPlaying ? 'Pause Dhak Ambience' : 'Play Festive Dhak Ambience'}
            >
              <span>🪘</span>
              <span className="hidden sm:inline">{isDhakPlaying ? 'Playing' : 'Dhak'}</span>
            </button>

            {/* Curated Trails Button */}
            <button
              type="button"
              onClick={() => setIsTrailsModalOpen(true)}
              className="p-1.5 px-2 rounded-xl text-xs font-bold bg-slate-900/90 border border-slate-700/60 text-amber-300 hover:text-white transition-all flex items-center gap-1"
              title="Curated Pandal Trails"
            >
              <span>✨</span>
              <span className="hidden sm:inline">Trails</span>
            </button>

            {/* Emergency Helpline Button */}
            <button
              type="button"
              onClick={() => setIsHelplineModalOpen(true)}
              className="p-1.5 px-2 rounded-xl text-xs font-bold bg-rose-500/20 border border-rose-500/40 text-rose-300 hover:text-white transition-all flex items-center gap-1"
              title="Emergency & Traffic Helpline"
            >
              <span>🚨</span>
              <span className="hidden sm:inline">SOS</span>
            </button>

            {/* View Mode Switcher */}
            <div className="flex items-center bg-slate-900/90 border border-slate-700/60 rounded-xl p-0.5 shadow-md">
              <button
                type="button"
                onClick={() => setViewMode('map')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                  viewMode === 'map'
                    ? 'bg-amber-400 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Map View"
              >
                🗺️
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                  viewMode === 'list'
                    ? 'bg-amber-400 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="List View"
              >
                📋
              </button>
            </div>

            {/* Circuit Planner Trigger Button */}
            <button
              type="button"
              onClick={() => setIsCircuitModalOpen(true)}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                circuitPandalIds.length > 0
                  ? 'bg-amber-500/20 border-amber-400/80 text-amber-300 shadow-md shadow-amber-500/20 animate-pulse'
                  : 'bg-slate-900/90 border-slate-700/60 text-slate-300 hover:text-white'
              }`}
              title="Open Hopping Circuit Planner"
            >
              <span>🧭</span>
              {circuitPandalIds.length > 0 && (
                <span className="w-4 h-4 rounded-full bg-amber-400 text-slate-950 font-black text-[10px] flex items-center justify-center">
                  {circuitPandalIds.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Search Bar Input */}
        <div className="relative mb-2 pointer-events-auto">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search 70 pandals by name, Bengali, or metro station..."
            className="w-full py-2 pl-9 pr-8 rounded-xl bg-slate-900/90 backdrop-blur-md border border-slate-700/70 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition-all shadow-md"
          />
          <span className="absolute left-3 top-2.5 text-xs text-slate-400 pointer-events-none">
            🔍
          </span>
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-2 text-slate-400 hover:text-white text-xs w-5 h-5 rounded-full flex items-center justify-center"
            >
              ✕
            </button>
          )}
        </div>

        {/* Tier 1: Region Selection Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pointer-events-auto pb-1.5">
          {(['All', 'South', 'North', 'East', 'Central'] as RegionFilter[]).map((region) => {
            const isSelected = selectedRegion === region;
            const conf = REGION_CONFIG[region];
            return (
              <button
                key={region}
                type="button"
                onClick={() => setSelectedRegion(region)}
                className={`whitespace-nowrap px-3 py-1 rounded-xl text-xs font-semibold transition-all duration-150 active:scale-95 ${
                  isSelected
                    ? 'bg-white text-slate-950 font-bold shadow-md shadow-white/10'
                    : 'bg-slate-900/80 backdrop-blur-md text-slate-300 border border-slate-800 hover:bg-slate-800'
                }`}
              >
                {conf.label} ({conf.count})
              </button>
            );
          })}
        </div>

        {/* Tier 2: Feature Quick Filters with Saved & Visited */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pointer-events-auto py-0.5">
          {(
            [
              'All',
              'Low Wait (<30m)',
              'Senior Access',
              'Near Metro',
              'Saved',
              'Visited',
            ] as FilterChip[]
          ).map((chip) => {
            const isActive = activeFilter === chip;
            return (
              <button
                key={chip}
                type="button"
                onClick={() => setActiveFilter(chip)}
                className={`whitespace-nowrap px-2.5 py-0.5 rounded-full text-[11px] font-medium transition-all duration-150 active:scale-95 ${
                  isActive
                    ? 'bg-amber-400 text-slate-950 font-bold shadow-sm'
                    : 'bg-slate-900/60 backdrop-blur text-slate-400 border border-slate-800/80 hover:text-slate-200'
                }`}
              >
                {chip === 'Low Wait (<30m)' && <span className="mr-1">⚡</span>}
                {chip === 'Senior Access' && <span className="mr-1">🧓</span>}
                {chip === 'Near Metro' && <span className="mr-1">🚇</span>}
                {chip === 'Saved' && (
                  <span className="mr-1">
                    ❤️ ({savedPandalIds.length})
                  </span>
                )}
                {chip === 'Visited' && (
                  <span className="mr-1">
                    ✓ ({visitedPandalIds.length})
                  </span>
                )}
                {chip !== 'Saved' && chip !== 'Visited' && chip}
              </button>
            );
          })}
        </div>
      </header>

      {/* ----------------- Wait Time Legend ----------------- */}
      <div className="absolute top-44 right-3 z-[999] flex items-center gap-2 px-2.5 py-1 rounded-full bg-slate-900/85 backdrop-blur border border-slate-700/60 text-[10px] text-slate-300 shadow-lg pointer-events-none">
        <span className="flex items-center gap-1 font-semibold">
          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>&lt;15m
        </span>
        <span className="flex items-center gap-1 font-semibold">
          <span className="w-2 h-2 rounded-full bg-amber-400"></span>15-30m
        </span>
        <span className="flex items-center gap-1 font-semibold">
          <span className="w-2 h-2 rounded-full bg-orange-500"></span>30-60m
        </span>
        <span className="flex items-center gap-1 font-semibold">
          <span className="w-2 h-2 rounded-full bg-rose-500"></span>60m+
        </span>
      </div>

      {/* ----------------- Map View Mode ----------------- */}
      {viewMode === 'map' && (
        <div className="w-full h-full">
          <MapContainer
            center={KOLKATA_CENTER}
            zoom={DEFAULT_ZOOM}
            zoomControl={false}
            style={{ width: '100%', height: '100%' }}
          >
            {/* Custom cached TileLayer with keepBuffer and offline manager */}
            <TileLayer
              url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              maxZoom={19}
              className="dark-mode-tiles"
              keepBuffer={12}
              updateWhenIdle={true}
            />
            <TileCacheManager />
            <MapController
              selectedPandal={selectedPandal}
              targetRegion={selectedRegion}
              flyCoords={mapFlyTarget}
            />

            {/* Glowing Pedestrian Circuit Route Polyline */}
            {activeCircuit && activeCircuit.fullPolylineCoordinates.length > 0 && (
              <>
                {/* Glow Outer Polyline */}
                <Polyline
                  positions={activeCircuit.fullPolylineCoordinates}
                  pathOptions={{
                    color: '#0284c7',
                    weight: 8,
                    opacity: 0.35,
                    lineCap: 'round',
                    lineJoin: 'round',
                  }}
                />
                {/* Core Glowing Polyline */}
                <Polyline
                  positions={activeCircuit.fullPolylineCoordinates}
                  pathOptions={{
                    color: '#38bdf8',
                    weight: 3.5,
                    opacity: 0.95,
                    dashArray: '6, 8',
                    lineCap: 'round',
                    lineJoin: 'round',
                  }}
                />
              </>
            )}

            {/* Pandal Markers */}
            {filteredPandals.map((pandal) => {
              const pLat = pandal.entry_lat ?? pandal.latitude ?? KOLKATA_CENTER[0];
              const pLng = pandal.entry_lng ?? pandal.longitude ?? KOLKATA_CENTER[1];
              const isSelected = selectedPandal?.id === pandal.id;
              const circuitIndex = circuitPandalIds.indexOf(pandal.id);
              const isVisited = visitedPandalIds.includes(pandal.id);

              return (
                <Marker
                  key={pandal.id}
                  position={[pLat, pLng]}
                  icon={createPandalIcon(pandal, isSelected, circuitIndex, isVisited)}
                  eventHandlers={{
                    click: () => setSelectedPandal(pandal),
                  }}
                />
              );
            })}
          </MapContainer>

          {/* Floating Map Action Buttons */}
          <div className="absolute bottom-6 right-3 z-[1000] flex flex-col gap-2 pointer-events-auto">
            {/* Locate Me Button */}
            <button
              type="button"
              onClick={handleLocateMe}
              className={`w-11 h-11 rounded-2xl bg-slate-900/90 backdrop-blur-md border border-slate-700/80 text-white flex items-center justify-center shadow-xl active:scale-90 transition-all ${
                isLocating ? 'animate-spin' : ''
              }`}
              title="My Location"
            >
              <span className="text-lg">🎯</span>
            </button>

            {/* Curated Trails Floating Button */}
            <button
              type="button"
              onClick={() => setIsTrailsModalOpen(true)}
              className="w-11 h-11 rounded-2xl bg-amber-500/20 backdrop-blur-md border border-amber-400/60 text-amber-300 flex items-center justify-center shadow-xl active:scale-90 transition-all"
              title="Curated Trails"
            >
              <span className="text-lg">✨</span>
            </button>

            {/* Reset to Kolkata Center */}
            <button
              type="button"
              onClick={() => {
                setSelectedRegion('All');
                setSelectedPandal(null);
                setMapFlyTarget(KOLKATA_CENTER);
              }}
              className="w-11 h-11 rounded-2xl bg-slate-900/90 backdrop-blur-md border border-slate-700/80 text-white flex items-center justify-center shadow-xl active:scale-90 transition-all"
              title="Reset View"
            >
              <span className="text-lg">🔄</span>
            </button>
          </div>

          {/* Floating Route Circuit Pill (when 1+ pandals selected) */}
          {circuitPandalIds.length > 0 && !selectedPandal && (
            <div className="absolute bottom-6 left-3 right-16 z-[1000] pointer-events-auto max-w-sm">
              <button
                type="button"
                onClick={() => setIsCircuitModalOpen(true)}
                className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-extrabold text-xs shadow-xl shadow-amber-500/30 flex items-center justify-between transition-all active:scale-[0.98]"
              >
                <div className="flex items-center gap-2">
                  <span className="text-base">🧭</span>
                  <span>Circuit ({circuitPandalIds.length} Pandals)</span>
                </div>
                <span className="bg-slate-950/20 px-2 py-0.5 rounded-full text-[11px] font-black">
                  {circuitPandalIds.length >= 3 ? 'View Route ➔' : 'Add 3 to Route'}
                </span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* ----------------- List View Mode ----------------- */}
      {viewMode === 'list' && (
        <PandalListView
          pandals={filteredPandals}
          selectedCircuitIds={circuitPandalIds}
          savedPandalIds={savedPandalIds}
          visitedPandalIds={visitedPandalIds}
          onSelectPandal={(pandal) => {
            setSelectedPandal(pandal);
            setViewMode('map');
          }}
          onToggleCircuit={handleToggleCircuit}
          onToggleSaved={handleToggleSaved}
          onToggleVisited={handleToggleVisited}
          onReportCrowd={(pandal) => {
            setSelectedPandal(pandal);
            setIsReportModalOpen(true);
          }}
        />
      )}

      {/* ----------------- Bottom-Anchored Swipeable Drawer ----------------- */}
      {selectedPandal && (
        <>
          {/* Dimmed backdrop */}
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[1001] transition-opacity duration-200"
            onClick={() => setSelectedPandal(null)}
          />

          {/* Swipeable Drawer */}
          <section
            role="dialog"
            aria-modal="true"
            style={{ transform: `translateY(${dragY}px)` }}
            className="fixed bottom-0 left-0 right-0 max-w-lg mx-auto z-[1002] bg-[#141824]/95 backdrop-blur-2xl border-t border-slate-700/80 rounded-t-3xl shadow-2xl p-4 pb-6 transition-transform duration-150 ease-out max-h-[88vh] overflow-y-auto"
          >
            {/* Draggable Handle for Swipe Down Dismissal */}
            <div
              className="py-1 cursor-grab active:cursor-grabbing touch-none"
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              <div className="w-10 h-1 bg-slate-600/80 rounded-full mx-auto mb-3" />
            </div>

            {/* Names in English & Bengali + Wishlist & Visited shortcuts */}
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                {pandalNameBn && (
                  <p className="text-sm font-semibold text-amber-400 tracking-wide mb-0.5">
                    {pandalNameBn}
                  </p>
                )}
                <h2 className="text-lg font-bold text-white leading-snug font-heading flex items-center gap-2">
                  <span>{pandalNameEn}</span>
                  {isSelectedVisited && (
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 px-2 py-0.5 rounded-full font-bold">
                      ✓ Visited
                    </span>
                  )}
                </h2>
                {selectedPandal.cluster && (
                  <span className="text-[11px] text-slate-400">
                    Cluster: {selectedPandal.cluster}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1.5 flex-shrink-0">
                {/* Wishlist Bookmark Button */}
                <button
                  type="button"
                  onClick={() => handleToggleSaved(selectedPandal.id)}
                  className="w-8 h-8 rounded-full bg-slate-800/80 hover:bg-slate-700 text-sm flex items-center justify-center transition-colors"
                  title={isSelectedSaved ? 'Saved in Wishlist' : 'Save to Wishlist'}
                >
                  {isSelectedSaved ? '❤️' : '🤍'}
                </button>

                {/* Mark as Visited Button */}
                <button
                  type="button"
                  onClick={() => handleToggleVisited(selectedPandal.id)}
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border transition-colors ${
                    isSelectedVisited
                      ? 'bg-emerald-500/30 text-emerald-300 border-emerald-400'
                      : 'bg-slate-800/80 text-slate-400 border-slate-700 hover:text-white'
                  }`}
                  title={isSelectedVisited ? 'Unmark Visited' : 'Mark as Visited'}
                >
                  ✓
                </button>

                {/* Close Drawer Button */}
                <button
                  type="button"
                  onClick={() => setSelectedPandal(null)}
                  aria-label="Close details"
                  className="w-8 h-8 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center text-sm transition-colors"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Wait Time Status Banner */}
            <div
              className={`flex items-center justify-between p-3 rounded-2xl mb-3 border ${colorConfig.badgeBg}`}
            >
              <div className="flex items-center gap-1.5 font-bold text-xs">
                <span>⚡</span>
                <span>{colorConfig.label}</span>
              </div>
              <div className="font-extrabold text-sm tracking-tight">
                ~{selectedWaitMins} min wait
              </div>
            </div>

            {/* 24-Hour Crowd Rush Forecast Bar */}
            <div className="p-3 rounded-2xl bg-slate-800/60 border border-slate-700/60 mb-3 text-xs">
              <span className="block font-bold text-slate-300 mb-1.5 text-[11px] uppercase tracking-wider">
                📊 Estimated 24h Crowd Forecast
              </span>
              <div className="grid grid-cols-4 gap-1.5 text-[10px] text-center">
                <div className="p-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300">
                  <span className="block font-bold">Morning</span>
                  <span>&lt;15m</span>
                </div>
                <div className="p-1 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300">
                  <span className="block font-bold">Noon</span>
                  <span>15–30m</span>
                </div>
                <div className="p-1 rounded-lg bg-orange-500/10 border border-orange-500/20 text-orange-300">
                  <span className="block font-bold">Evening</span>
                  <span>45m+</span>
                </div>
                <div className="p-1 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300">
                  <span className="block font-bold">Midnight</span>
                  <span>Peak Rush</span>
                </div>
              </div>
            </div>

            {/* Pill Badges: Senior, Wheelchair, Metro Line, etc. */}
            <div className="mb-3">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                Accessibility & Transit
              </p>
              <div className="flex flex-wrap gap-1.5">
                {seniorAccess && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 border border-emerald-500/30 text-emerald-300">
                    <span>🧓</span>
                    <span>Senior Friendly</span>
                  </span>
                )}

                {wheelchairAccess && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/15 border border-blue-500/30 text-blue-300">
                    <span>♿</span>
                    <span>Wheelchair Ramp</span>
                  </span>
                )}

                {/* Metro Line Badge */}
                {metroStation && (
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${
                      metroLine === 'Green'
                        ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                        : metroLine === 'Purple'
                        ? 'bg-purple-500/20 border-purple-500/40 text-purple-300'
                        : metroLine === 'Orange'
                        ? 'bg-orange-500/20 border-orange-500/40 text-orange-300'
                        : 'bg-sky-500/20 border-sky-500/40 text-sky-300'
                    }`}
                  >
                    <span>🚇</span>
                    <span>
                      {metroLine ? `${metroLine} Line` : 'Metro'} • {metroStation}
                    </span>
                  </span>
                )}

                {medicalKiosk && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/15 border border-rose-500/30 text-rose-300">
                    <span>🩺</span>
                    <span>Medical Booth</span>
                  </span>
                )}

                {restroomNearby && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-500/15 border border-indigo-500/30 text-indigo-300">
                    <span>🚻</span>
                    <span>Restroom Nearby</span>
                  </span>
                )}
              </div>
            </div>

            {/* Metro Pedestrian Walking Guidance */}
            {metroStation && (
              <div className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/60 mb-3 text-xs text-slate-300 flex items-center gap-2.5">
                <span className="text-base">🚶</span>
                <div>
                  <span className="font-semibold text-white">
                    {walkMins ? `${walkMins} mins walk` : 'Short walk'} from {metroStation}
                  </span>
                  {metroGate && <span className="block text-[11px] text-slate-400">{metroGate}</span>}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="space-y-2 pt-1">
              {/* Row 1: Direct navigation + Add to Circuit */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleLaunchNavigation}
                  className="flex-1 flex items-center justify-center gap-1.5 py-3 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-lg shadow-blue-600/30 active:scale-[0.98] transition-all"
                >
                  <span>📍</span>
                  <span>Pedestrian Entry Nav</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleToggleCircuit(selectedPandal.id)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-3 px-3 rounded-xl font-bold text-xs active:scale-[0.98] transition-all border ${
                    isSelectedInCircuit
                      ? 'bg-amber-400 text-slate-950 border-amber-400 shadow-md shadow-amber-400/20'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                  }`}
                >
                  <span>{isSelectedInCircuit ? '✓ In Circuit' : '+ Add to Circuit'}</span>
                  {isSelectedInCircuit && <span>(#{selectedCircuitIdx + 1})</span>}
                </button>
              </div>

              {/* Row 2: WhatsApp Share + Report Current Wait Time */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleShareWhatsApp}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 font-bold text-xs active:scale-[0.98] transition-all"
                >
                  <span>📲</span>
                  <span>Share on WhatsApp</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (onReportCrowdClick) {
                      onReportCrowdClick(selectedPandal);
                    }
                    setIsReportModalOpen(true);
                  }}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700/60 font-semibold text-xs active:scale-[0.98] transition-all"
                >
                  <span>📢</span>
                  <span>Report Wait Time</span>
                </button>
              </div>
            </div>
          </section>
        </>
      )}

      {/* ----------------- Curated Pandal Trails Modal ----------------- */}
      <CuratedCircuitsModal
        isOpen={isTrailsModalOpen}
        onClose={() => setIsTrailsModalOpen(false)}
        pandals={pandals}
        onSelectCircuit={handleSelectCuratedCircuit}
      />

      {/* ----------------- Emergency & Traffic Helpline Modal ----------------- */}
      <EmergencyHelplineModal
        isOpen={isHelplineModalOpen}
        onClose={() => setIsHelplineModalOpen(false)}
      />

      {/* ----------------- Hopping Circuit Planner Modal ----------------- */}
      <CircuitPlannerModal
        isOpen={isCircuitModalOpen}
        onClose={() => setIsCircuitModalOpen(false)}
        selectedPandalIds={circuitPandalIds}
        pandals={pandals}
        userLocation={userLocation}
        onRemovePandal={(id) => handleToggleCircuit(id)}
        onClearCircuit={() => setCircuitPandalIds([])}
        onViewRouteOnMap={() => {
          setViewMode('map');
          setIsCircuitModalOpen(false);
        }}
      />

      {/* ----------------- Zero-Friction Reporting Dialog ----------------- */}
      <CrowdReportModal
        pandal={selectedPandal}
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        onSubmitReport={(report: CrowdReportSubmission) => {
          if (selectedPandal) {
            selectedPandal.wait_time_minutes = report.wait_time_minutes;
            selectedPandal.status_level = report.status_level;
            selectedPandal.senior_line = report.senior_lane_open;
            showToast('✅ Wait time reported! Thank you.');
          }
        }}
      />
    </div>
  );
};

export default PandalMap;
