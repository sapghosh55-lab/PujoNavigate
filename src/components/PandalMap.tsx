import React, { useState, useMemo, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Pandal, FilterChip } from '../types/pandal';
import { FoodPlace } from '../types/food';
import { MOCK_PANDALS } from '../data/mockPandals';
import { KOLKATA_FOOD_PLACES } from '../data/kolkataFoodPlaces';
import { Coordinates } from '../data/kolkataCrossings';
import { CrowdReportModal, CrowdReportSubmission } from './CrowdReportModal';
import { CircuitPlannerModal } from './CircuitPlannerModal';
import { PandalListView } from './PandalListView';
import { CuratedCircuitsModal } from './CuratedCircuitsModal';
import { EmergencyHelplineModal } from './EmergencyHelplineModal';
import { FoodExplorerModal } from './FoodExplorerModal';
import { CuratedCircuit } from '../data/curatedCircuits';
import { getWaitTimeColorConfig } from '../utils/colorConfig';
import { dhakPlayer } from '../utils/dhakAudio';
import {
  calculateOptimalHoppingCircuit,
  PedestrianHoppingCircuit,
} from '../utils/pedestrianRouter';
import {
  getNearbyFoodForPandal,
  getFoodNavigationUrl,
  generateFoodShareText,
} from '../utils/foodProximity';

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
  let borderStyle = '2px solid rgba(255,255,255,0.95)';
  let bgGradient = config.markerGradient;
  let shadow = config.boxShadow;

  if (isVisited) {
    badgeContent = '✓';
    bgGradient = 'linear-gradient(135deg, #10b981, #047857)';
    borderStyle = '2.5px solid #a7f3d0';
    shadow = '0 0 18px rgba(16, 185, 129, 0.9)';
  } else if (isInCircuit) {
    badgeContent = `#${circuitIndex + 1}`;
    bgGradient = 'linear-gradient(135deg, #f59e0b, #b45309)';
    borderStyle = '2.5px solid #fef08a';
    shadow = '0 0 20px rgba(245, 158, 11, 0.9)';
  }

  if (isSelected) {
    borderStyle = '3px solid #ffffff';
  }

  return L.divIcon({
    className: 'custom-pandal-marker-wrapper',
    html: `
      <div style="position: relative; width: 44px; height: 50px; display: flex; flex-direction: column; align-items: center; justify-content: flex-start; cursor: pointer;">
        <div class="animate-marker-pulse" style="position: absolute; top: 0; width: 44px; height: 44px; border-radius: 50%; background: radial-gradient(circle, ${config.pulseRgba} 0%, rgba(0,0,0,0) 70%); pointer-events: none;"></div>
        <div style="position: relative; width: 38px; height: 38px; border-radius: 50%; background: ${bgGradient}; border: ${borderStyle}; box-shadow: ${shadow}, inset 0 2px 4px rgba(255,255,255,0.35); display: flex; align-items: center; justify-content: center; color: #ffffff; font-weight: 800; font-size: ${
      isVisited ? '14px' : '11px'
    }; transform: ${
      isSelected ? 'scale(1.22)' : isInCircuit ? 'scale(1.12)' : 'scale(1)'
    }; transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);">
          <span>${badgeContent}</span>
        </div>
        <div style="width: 0; height: 0; border-left: 4px solid transparent; border-right: 4px solid transparent; border-top: 5px solid ${isSelected ? '#ffffff' : 'rgba(255,255,255,0.75)'}; margin-top: -1px; filter: drop-shadow(0 2px 3px rgba(0,0,0,0.6));"></div>
      </div>
    `,
    iconSize: [44, 50],
    iconAnchor: [22, 44],
  });
};

// ----------------------------------------------------------------------------
// Custom Leaflet Marker for Food & Street Bites by Budget Tier
// ----------------------------------------------------------------------------
const createFoodIcon = (food: FoodPlace, isSelected: boolean): L.DivIcon => {
  let badgeSymbol = '🪙';
  let bgGradient = 'linear-gradient(135deg, #10b981, #047857)';
  let borderColor = '#6ee7b7';
  let shadow = '0 0 16px rgba(16, 185, 129, 0.8)';

  if (food.budget_tier === 'moderate') {
    badgeSymbol = '🍽️';
    bgGradient = 'linear-gradient(135deg, #f59e0b, #b45309)';
    borderColor = '#fef08a';
    shadow = '0 0 18px rgba(245, 158, 11, 0.85)';
  } else if (food.budget_tier === 'premium') {
    badgeSymbol = '👑';
    bgGradient = 'linear-gradient(135deg, #9333ea, #6b21a8)';
    borderColor = '#f3e8ff';
    shadow = '0 0 20px rgba(168, 85, 247, 0.9)';
  }

  return L.divIcon({
    className: 'custom-food-marker-wrapper',
    html: `
      <div style="position: relative; width: 42px; height: 48px; display: flex; flex-direction: column; align-items: center; justify-content: flex-start; cursor: pointer;">
        <div style="position: absolute; top: 0; width: 38px; height: 38px; border-radius: 50%; background: ${bgGradient}; opacity: 0.35; filter: blur(3px); pointer-events: none;"></div>
        <div style="position: relative; width: 34px; height: 34px; border-radius: 50%; background: ${bgGradient}; border: 2.5px solid ${
      isSelected ? '#ffffff' : borderColor
    }; box-shadow: ${shadow}, inset 0 2px 4px rgba(255,255,255,0.35); display: flex; align-items: center; justify-content: center; font-size: 14px; transform: ${
      isSelected ? 'scale(1.25)' : 'scale(1)'
    }; transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);">
          <span>${badgeSymbol}</span>
        </div>
        <div style="width: 0; height: 0; border-left: 4px solid transparent; border-right: 4px solid transparent; border-top: 5px solid ${isSelected ? '#ffffff' : borderColor}; margin-top: -1px; filter: drop-shadow(0 2px 3px rgba(0,0,0,0.6));"></div>
      </div>
    `,
    iconSize: [42, 48],
    iconAnchor: [21, 42],
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
  const [isFoodModalOpen, setIsFoodModalOpen] = useState<boolean>(false);
  const [foodModalPandalId, setFoodModalPandalId] = useState<string | null>(null);

  // Food Layer & Selection
  const [showFoodMarkers, setShowFoodMarkers] = useState<boolean>(true);
  const [selectedFood, setSelectedFood] = useState<FoodPlace | null>(null);

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

  // Nearby Food Places for selected pandal
  const nearbyFoods = useMemo(() => {
    return selectedPandal ? getNearbyFoodForPandal(selectedPandal, KOLKATA_FOOD_PLACES, 3) : [];
  }, [selectedPandal]);

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

      {/* ----------------- Top Floating Luxury Island Navbar ----------------- */}
      <header className="absolute top-2.5 left-2.5 right-2.5 z-[1000] max-w-6xl mx-auto pointer-events-none">
        <div className="p-3 bg-[#0a0e1a]/85 backdrop-blur-2xl border border-white/10 rounded-2xl sm:rounded-3xl shadow-[0_16px_40px_-10px_rgba(0,0,0,0.7)] pointer-events-auto space-y-2.5">
          {/* Row 1: Brand Logo + Search Input + Glass Actions */}
          <div className="flex items-center justify-between gap-3 flex-wrap sm:flex-nowrap">
            {/* Brand Title & Live Indicator */}
            <div className="flex items-center gap-2.5 flex-shrink-0">
              <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-amber-400 via-amber-500 to-amber-600 flex items-center justify-center text-slate-950 font-black shadow-[0_0_20px_rgba(245,158,11,0.45)] text-lg">
                🪔
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-base sm:text-lg font-black tracking-tight leading-none text-transparent bg-clip-text bg-gradient-to-r from-white via-amber-100 to-amber-300 font-heading">
                    PujoNavigate
                  </h1>
                  <span className="inline-flex items-center gap-1.5 text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.2)] uppercase tracking-wider">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    70 Live
                  </span>
                  {visitedPandalIds.length > 0 && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                      ✓ {visitedPandalIds.length} Visited
                    </span>
                  )}
                </div>
                <span className="text-[10px] text-amber-300/80 font-medium tracking-wide">
                  শারদোৎসব ২০২৬ • Kolkata Durga Puja
                </span>
              </div>
            </div>

            {/* Centered Desktop Search Input */}
            <div className="relative flex-1 max-w-sm hidden md:block">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search 70 pandals, metro, or dishes..."
                className="w-full py-1.5 pl-8 pr-7 rounded-xl bg-slate-900/90 border border-white/10 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-amber-400/80 focus:ring-1 focus:ring-amber-400/50 transition-all shadow-inner"
              />
              <span className="absolute left-2.5 top-2 text-xs text-slate-400 pointer-events-none">
                🔍
              </span>
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1.5 text-slate-400 hover:text-white text-xs w-4 h-4 rounded-full flex items-center justify-center"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Action Buttons Cluster */}
            <div className="flex items-center gap-1.5 ml-auto">
              {/* Dhak Ambience Player */}
              <button
                type="button"
                onClick={handleToggleDhak}
                className={`p-1.5 px-2.5 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5 ${
                  isDhakPlaying
                    ? 'bg-amber-400 text-slate-950 border-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.4)] animate-pulse'
                    : 'bg-slate-900/80 border-white/10 text-amber-300 hover:text-white hover:border-amber-400/40'
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
                className="p-1.5 px-2.5 rounded-xl text-xs font-bold bg-slate-900/80 border border-white/10 text-amber-300 hover:text-white hover:border-amber-400/40 transition-all flex items-center gap-1.5"
                title="Curated Pandal Trails"
              >
                <span>✨</span>
                <span className="hidden sm:inline">Trails</span>
              </button>

              {/* Food Spots Explorer Button (Highlighted Gold Glow) */}
              <button
                type="button"
                onClick={() => {
                  setFoodModalPandalId(selectedPandal?.id || null);
                  setIsFoodModalOpen(true);
                }}
                className="p-1.5 px-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-amber-500/20 to-amber-600/20 border border-amber-400/50 text-amber-300 hover:bg-amber-400 hover:text-slate-950 hover:border-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.2)] transition-all flex items-center gap-1.5"
                title="Find Nearby Food Places by Budget"
              >
                <span>🍲</span>
                <span className="hidden sm:inline">Food</span>
              </button>

              {/* Emergency Helpline Button */}
              <button
                type="button"
                onClick={() => setIsHelplineModalOpen(true)}
                className="p-1.5 px-2.5 rounded-xl text-xs font-bold bg-rose-500/15 border border-rose-500/35 text-rose-300 hover:bg-rose-500/25 hover:text-white transition-all flex items-center gap-1.5"
                title="Emergency & Traffic Helpline"
              >
                <span>🚨</span>
                <span className="hidden sm:inline">SOS</span>
              </button>

              {/* View Mode Switcher */}
              <div className="flex items-center bg-slate-900/90 border border-white/10 rounded-xl p-0.5 shadow-sm">
                <button
                  type="button"
                  onClick={() => setViewMode('map')}
                  className={`px-2 py-1 rounded-lg text-xs font-bold transition-all ${
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
                  className={`px-2 py-1 rounded-lg text-xs font-bold transition-all ${
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
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                  circuitPandalIds.length > 0
                    ? 'bg-amber-500/20 border-amber-400 text-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.25)] animate-pulse'
                    : 'bg-slate-900/80 border-white/10 text-slate-300 hover:text-white hover:border-slate-600'
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

          {/* Mobile Search Bar (Only shown on small screens) */}
          <div className="relative block md:hidden">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search 70 pandals by name, Bengali, or metro station..."
              className="w-full py-2 pl-8 pr-7 rounded-xl bg-slate-900/90 border border-white/10 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-amber-400 transition-all shadow-inner"
            />
            <span className="absolute left-2.5 top-2.5 text-xs text-slate-400 pointer-events-none">
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

          {/* Row 2: Unified Filter Rail (Region Pills + Separator + Quick Chips) */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-0.5 border-t border-white/5">
            {/* Regions */}
            {(['All', 'South', 'North', 'East', 'Central'] as RegionFilter[]).map((region) => {
              const isSelected = selectedRegion === region;
              const conf = REGION_CONFIG[region];
              return (
                <button
                  key={region}
                  type="button"
                  onClick={() => setSelectedRegion(region)}
                  className={`whitespace-nowrap px-2.5 py-1 rounded-xl text-xs font-bold transition-all duration-150 active:scale-95 ${
                    isSelected
                      ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                      : 'bg-slate-900/70 text-slate-300 border border-white/5 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  {conf.label.split(' ')[0]} ({conf.count})
                </button>
              );
            })}

            {/* Vertical Divider */}
            <div className="h-4 w-px bg-slate-700/60 flex-shrink-0 mx-1"></div>

            {/* Feature quick chips */}
            {(
              [
                'Nearby Food',
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
                  onClick={() => {
                    if (chip === 'Nearby Food') {
                      setFoodModalPandalId(selectedPandal?.id || null);
                      setIsFoodModalOpen(true);
                    } else {
                      setActiveFilter(chip);
                    }
                  }}
                  className={`whitespace-nowrap px-2.5 py-1 rounded-xl text-[11px] font-semibold transition-all duration-150 active:scale-95 ${
                    isActive
                      ? 'bg-amber-400 text-slate-950 font-bold shadow-sm'
                      : chip === 'Nearby Food'
                      ? 'bg-amber-500/15 text-amber-300 border border-amber-400/40 hover:bg-amber-500/25'
                      : 'bg-slate-900/60 text-slate-400 border border-white/5 hover:text-slate-200'
                  }`}
                >
                  {chip === 'Nearby Food' && <span className="mr-1">🍲</span>}
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
        </div>
      </header>

      {/* ----------------- Wait Time Legend ----------------- */}
      {viewMode === 'map' && circuitPandalIds.length === 0 && (
        <div className="absolute bottom-6 left-4 z-[990] hidden sm:flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-[#0d121f]/90 backdrop-blur-xl border border-white/10 text-[11px] text-slate-300 shadow-2xl pointer-events-none">
          <span className="flex items-center gap-1.5 font-bold">
            <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]"></span>&lt;15m
          </span>
          <span className="flex items-center gap-1.5 font-bold">
            <span className="w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_8px_#fbbf24]"></span>15-30m
          </span>
          <span className="flex items-center gap-1.5 font-bold">
            <span className="w-2 h-2 rounded-full bg-orange-500 shadow-[0_0_8px_#f97316]"></span>30-60m
          </span>
          <span className="flex items-center gap-1.5 font-bold">
            <span className="w-2 h-2 rounded-full bg-rose-500 shadow-[0_0_8px_#f43f5e]"></span>60m+
          </span>
        </div>
      )}

      {/* ----------------- Map View Mode ----------------- */}
      {viewMode === 'map' && (
        <div className="w-full h-full">
          <MapContainer
            center={KOLKATA_CENTER}
            zoom={DEFAULT_ZOOM}
            zoomControl={false}
            style={{ width: '100%', height: '100%' }}
          >
            {/* Pristine Midnight Dark Map Tiles (Zero API key watermark) */}
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              subdomains="abc"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              maxZoom={19}
              keepBuffer={8}
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

            {/* Food Places Markers (when showFoodMarkers is true) */}
            {showFoodMarkers &&
              KOLKATA_FOOD_PLACES.map((food) => {
                const isSelected = selectedFood?.id === food.id;
                return (
                  <Marker
                    key={food.id}
                    position={[food.latitude, food.longitude]}
                    icon={createFoodIcon(food, isSelected)}
                    eventHandlers={{
                      click: () => {
                        setSelectedFood(food);
                        setSelectedPandal(null);
                      },
                    }}
                  />
                );
              })}
          </MapContainer>

          {/* Floating Map Action Buttons */}
          <div className="absolute bottom-6 right-3 z-[1000] flex flex-col gap-2.5 pointer-events-auto">
            {/* Locate Me Button */}
            <button
              type="button"
              onClick={handleLocateMe}
              className={`w-12 h-12 rounded-2xl bg-[#0f1422]/90 backdrop-blur-xl border border-white/10 text-white flex items-center justify-center shadow-2xl hover:border-amber-400/50 hover:bg-[#161d30] active:scale-90 transition-all group ${
                isLocating ? 'animate-spin' : ''
              }`}
              title="My Location"
            >
              <span className="text-xl group-hover:scale-110 transition-transform">🎯</span>
            </button>

            {/* Toggle Food Layer on Map Button */}
            <button
              type="button"
              onClick={() => {
                setShowFoodMarkers((prev) => {
                  const next = !prev;
                  showToast(next ? '🍲 Food Spots Layer: Visible on Map' : '🍲 Food Spots Layer: Hidden');
                  return next;
                });
              }}
              className={`w-12 h-12 rounded-2xl backdrop-blur-xl border flex items-center justify-center shadow-2xl active:scale-90 transition-all group ${
                showFoodMarkers
                  ? 'bg-gradient-to-tr from-amber-400 to-amber-500 text-slate-950 border-amber-300 shadow-[0_0_20px_rgba(251,191,36,0.4)] font-bold'
                  : 'bg-[#0f1422]/90 border-white/10 text-amber-300 hover:border-amber-400/40 hover:bg-[#161d30]'
              }`}
              title={showFoodMarkers ? 'Hide Food Spots on Map' : 'Show Food Spots on Map'}
            >
              <span className="text-xl group-hover:scale-110 transition-transform">🍲</span>
            </button>

            {/* Curated Trails Floating Button */}
            <button
              type="button"
              onClick={() => setIsTrailsModalOpen(true)}
              className="w-12 h-12 rounded-2xl bg-amber-500/20 backdrop-blur-xl border border-amber-400/60 text-amber-300 flex items-center justify-center shadow-2xl hover:bg-amber-500/30 hover:shadow-[0_0_20px_rgba(245,158,11,0.35)] active:scale-90 transition-all group"
              title="Curated Trails"
            >
              <span className="text-xl group-hover:scale-110 transition-transform">✨</span>
            </button>

            {/* Reset to Kolkata Center */}
            <button
              type="button"
              onClick={() => {
                setSelectedRegion('All');
                setSelectedPandal(null);
                setSelectedFood(null);
                setMapFlyTarget(KOLKATA_CENTER);
              }}
              className="w-12 h-12 rounded-2xl bg-[#0f1422]/90 backdrop-blur-xl border border-white/10 text-white flex items-center justify-center shadow-2xl hover:border-white/30 hover:bg-[#161d30] active:scale-90 transition-all group"
              title="Reset View"
            >
              <span className="text-xl group-hover:rotate-180 transition-transform duration-500">🔄</span>
            </button>
          </div>

          {/* Floating Route Circuit Pill (when 1+ pandals selected) */}
          {circuitPandalIds.length > 0 && !selectedPandal && !selectedFood && (
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
          onExploreFoodForPandal={(pandal) => {
            setFoodModalPandalId(pandal.id);
            setIsFoodModalOpen(true);
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

            {/* ----------------- Nearby Food Spots by Budget ----------------- */}
            {nearbyFoods.length > 0 && (
              <div className="p-3.5 rounded-2xl bg-gradient-to-br from-slate-900/90 via-slate-900/70 to-amber-950/20 border border-amber-500/30 mb-3 text-xs shadow-md">
                <div className="flex items-center justify-between mb-2.5">
                  <div className="flex items-center gap-1.5 font-bold text-amber-300">
                    <span>🍲</span>
                    <span>Nearby Food Spots</span>
                    <span className="text-[10px] font-normal text-slate-400">by Budget</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setFoodModalPandalId(selectedPandal.id);
                      setIsFoodModalOpen(true);
                    }}
                    className="text-[11px] font-bold text-amber-400 hover:text-amber-300 transition-colors flex items-center gap-0.5"
                  >
                    <span>All ({KOLKATA_FOOD_PLACES.length})</span>
                    <span>➔</span>
                  </button>
                </div>

                <div className="space-y-2">
                  {nearbyFoods.map((food) => {
                    const navUrl = getFoodNavigationUrl(food);
                    return (
                      <div
                        key={food.id}
                        className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 hover:border-amber-500/30 transition-all flex items-start justify-between gap-2.5"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                            <span className="font-bold text-white text-xs truncate">
                              {food.name}
                            </span>
                            {food.budget_tier === 'budget' && (
                              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                                🪙 {food.cost_for_two}
                              </span>
                            )}
                            {food.budget_tier === 'moderate' && (
                              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-amber-500/15 text-amber-300 border border-amber-500/30">
                                🍽️ {food.cost_for_two}
                              </span>
                            )}
                            {food.budget_tier === 'premium' && (
                              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-purple-500/15 text-purple-300 border border-purple-500/30">
                                👑 {food.cost_for_two}
                              </span>
                            )}
                          </div>

                          <p className="text-[11px] text-slate-400 truncate">
                            🔥 {food.famous_dishes[0] || food.cuisine}
                          </p>

                          <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-1">
                            <span className="text-blue-300 font-semibold">
                              🚶 {food.formattedDistance}
                            </span>
                            <span>•</span>
                            <span className="text-slate-400 truncate">{food.landmark}</span>
                          </div>
                        </div>

                        <div className="flex flex-col gap-1 flex-shrink-0">
                          <a
                            href={navUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="py-1 px-2.5 rounded-lg bg-blue-600/90 hover:bg-blue-600 text-white font-bold text-[10px] flex items-center justify-center gap-1 shadow-sm transition-all"
                            title="Get Walking Directions"
                          >
                            <span>📍</span>
                            <span>Walk</span>
                          </a>

                          <button
                            type="button"
                            onClick={() => {
                              setSelectedFood(food);
                              setSelectedPandal(null);
                              setMapFlyTarget([food.latitude - 0.004, food.longitude]);
                            }}
                            className="py-1 px-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-medium transition-all"
                            title="View on Map"
                          >
                            Map
                          </button>
                        </div>
                      </div>
                    );
                  })}
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

      {/* ----------------- Floating Food Details Bottom Card ----------------- */}
      {selectedFood && !selectedPandal && (
        <>
          {/* Dimmed backdrop */}
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-xs z-[1001] transition-opacity duration-200"
            onClick={() => setSelectedFood(null)}
          />

          <section
            role="dialog"
            aria-modal="true"
            className="fixed bottom-0 left-0 right-0 max-w-lg mx-auto z-[1002] bg-[#141824]/95 backdrop-blur-2xl border-t border-amber-500/30 rounded-t-3xl shadow-2xl p-4 pb-6 transition-transform duration-150 animate-in slide-in-from-bottom-5 max-h-[85vh] overflow-y-auto"
          >
            {/* Draggable indicator */}
            <div className="w-10 h-1 bg-slate-600/70 rounded-full mx-auto mb-3" />

            {/* Header: Bengali name + English Name + Rating + Close */}
            <div className="flex items-start justify-between gap-3 mb-2.5">
              <div>
                {selectedFood.name_bn && (
                  <span className="text-xs font-semibold text-amber-400 tracking-wide block mb-0.5">
                    {selectedFood.name_bn}
                  </span>
                )}
                <h2 className="text-lg font-bold text-white font-heading flex items-center gap-2">
                  <span>{selectedFood.name}</span>
                  <span className="text-xs px-2 py-0.5 rounded-lg bg-slate-800 border border-slate-700 font-bold text-amber-300">
                    ★ {selectedFood.rating}
                  </span>
                </h2>
                <span className="text-[11px] text-slate-400">{selectedFood.cuisine}</span>
              </div>

              <button
                type="button"
                onClick={() => setSelectedFood(null)}
                aria-label="Close food card"
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center text-sm transition-colors flex-shrink-0"
              >
                ✕
              </button>
            </div>

            {/* Budget & Price Banner */}
            <div className="flex items-center justify-between p-3 rounded-2xl mb-2.5 bg-slate-800/80 border border-slate-700/80">
              <div className="flex items-center gap-1.5">
                {selectedFood.budget_tier === 'budget' && (
                  <span className="text-xs font-bold text-emerald-300 flex items-center gap-1">
                    <span>🪙</span> Pocket Friendly
                  </span>
                )}
                {selectedFood.budget_tier === 'moderate' && (
                  <span className="text-xs font-bold text-amber-300 flex items-center gap-1">
                    <span>🍽️</span> Casual &amp; Family Dining
                  </span>
                )}
                {selectedFood.budget_tier === 'premium' && (
                  <span className="text-xs font-bold text-purple-300 flex items-center gap-1">
                    <span>👑</span> Grand Pujo Feast
                  </span>
                )}
              </div>
              <div className="text-xs font-extrabold text-white">
                {selectedFood.cost_for_two}
              </div>
            </div>

            {/* Famous Signature Dishes */}
            <div className="mb-2.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                🔥 Must Try Signature Dishes:
              </span>
              <div className="flex flex-wrap gap-1">
                {selectedFood.famous_dishes.map((dish, i) => (
                  <span
                    key={i}
                    className="text-[11px] font-medium px-2.5 py-0.5 rounded-lg bg-slate-800 text-amber-200 border border-slate-700"
                  >
                    {dish}
                  </span>
                ))}
              </div>
            </div>

            {/* Location, Landmark & Metro */}
            <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 text-xs mb-3 space-y-1.5">
              <div className="flex items-start gap-1.5 text-slate-300">
                <span className="text-amber-400 text-sm flex-shrink-0">📍</span>
                <div>
                  <span className="font-semibold text-white">{selectedFood.address}</span>
                  <span className="block text-[11px] text-slate-400">
                    Landmark: {selectedFood.landmark}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 text-[11px] text-slate-400 pt-1.5 border-t border-slate-800/80">
                <span className="text-sky-400">
                  🚇 {selectedFood.nearest_metro} ({selectedFood.metro_walk_mins}m walk)
                </span>
                <span>•</span>
                <span className="text-amber-400/90">🕒 {selectedFood.pujo_timing}</span>
              </div>
            </div>

            {/* Action Buttons: Walk Navigation + Share + Open Full Explorer */}
            <div className="flex items-center gap-2">
              <a
                href={getFoodNavigationUrl(selectedFood)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 py-3 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-lg shadow-blue-600/20 active:scale-[0.98] transition-all text-center flex items-center justify-center gap-1.5"
              >
                <span>📍</span>
                <span>Walking Nav</span>
              </a>

              <button
                type="button"
                onClick={() => {
                  const text = generateFoodShareText(selectedFood);
                  const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
                  window.open(whatsappUrl, '_blank');
                }}
                className="py-3 px-3.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 text-xs font-bold transition-all"
                title="Share on WhatsApp"
              >
                📲 Share
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsFoodModalOpen(true);
                }}
                className="py-3 px-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 text-xs font-bold transition-all"
                title="Open Food Explorer"
              >
                🍲 Explorer
              </button>
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

      {/* ----------------- Food Explorer Modal ----------------- */}
      <FoodExplorerModal
        isOpen={isFoodModalOpen}
        onClose={() => setIsFoodModalOpen(false)}
        allFoodPlaces={KOLKATA_FOOD_PLACES}
        userLocation={userLocation}
        selectedPandal={selectedPandal}
        allPandals={pandals}
        initialPandalId={foodModalPandalId}
        onSelectFoodOnMap={(food) => {
          setSelectedFood(food);
          setSelectedPandal(null);
          setMapFlyTarget([food.latitude - 0.005, food.longitude]);
          setViewMode('map');
          showToast(`📍 Centered on ${food.name}`);
        }}
      />
    </div>
  );
};

export default PandalMap;
