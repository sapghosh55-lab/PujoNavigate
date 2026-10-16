import React, { useState, useMemo } from 'react';
import { FoodPlace, BudgetTier, FoodCategory, FoodBudgetFilter } from '../types/food';
import { Pandal } from '../types/pandal';
import { Coordinates } from '../data/kolkataCrossings';
import {
  FoodWithDistance,
  getFoodPlacesWithDistance,
  filterFoodPlaces,
  getFoodNavigationUrl,
  generateFoodShareText,
} from '../utils/foodProximity';

interface FoodExplorerModalProps {
  isOpen: boolean;
  onClose: () => void;
  allFoodPlaces: FoodPlace[];
  userLocation: Coordinates;
  selectedPandal: Pandal | null;
  allPandals: Pandal[];
  onSelectFoodOnMap?: (food: FoodPlace) => void;
  initialPandalId?: string | null;
}

export const FoodExplorerModal: React.FC<FoodExplorerModalProps> = ({
  isOpen,
  onClose,
  allFoodPlaces,
  userLocation,
  selectedPandal,
  allPandals,
  onSelectFoodOnMap,
  initialPandalId,
}) => {
  // Anchor mode: 'pandal' | 'myLocation' | 'region'
  const [anchorMode, setAnchorMode] = useState<'pandal' | 'myLocation' | 'region'>('pandal');
  const [chosenPandalId, setChosenPandalId] = useState<string>(() => {
    if (initialPandalId) return initialPandalId;
    if (selectedPandal) return selectedPandal.id;
    return allPandals[0]?.id || '1';
  });

  const [selectedRegion, setSelectedRegion] = useState<string>('All');
  const [budgetFilter, setBudgetFilter] = useState<FoodBudgetFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState<FoodCategory | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [pureVegOnly, setPureVegOnly] = useState<boolean>(false);
  const [lateNightOnly, setLateNightOnly] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Sync chosen pandal if selectedPandal changes and modal opens
  React.useEffect(() => {
    if (initialPandalId) {
      setChosenPandalId(initialPandalId);
      setAnchorMode('pandal');
    } else if (selectedPandal) {
      setChosenPandalId(selectedPandal.id);
    }
  }, [initialPandalId, selectedPandal]);

  // Determine reference coordinates
  const currentPandal = useMemo(() => {
    return allPandals.find((p) => p.id === chosenPandalId) || selectedPandal || allPandals[0];
  }, [allPandals, chosenPandalId, selectedPandal]);

  const referenceCoords: Coordinates = useMemo(() => {
    if (anchorMode === 'myLocation') {
      return userLocation;
    }
    if (anchorMode === 'pandal' && currentPandal) {
      return {
        latitude: currentPandal.entry_lat ?? currentPandal.latitude ?? 22.5726,
        longitude: currentPandal.entry_lng ?? currentPandal.longitude ?? 88.3639,
      };
    }
    // Region centers
    if (selectedRegion === 'South') return { latitude: 22.518, longitude: 88.358 };
    if (selectedRegion === 'North') return { latitude: 22.598, longitude: 88.368 };
    if (selectedRegion === 'East') return { latitude: 22.585, longitude: 88.405 };
    if (selectedRegion === 'Central') return { latitude: 22.572, longitude: 88.355 };
    return { latitude: 22.5726, longitude: 88.3639 };
  }, [anchorMode, currentPandal, userLocation, selectedRegion]);

  // Compute distances & sort
  const foodWithDistances = useMemo(() => {
    return getFoodPlacesWithDistance(allFoodPlaces, referenceCoords);
  }, [allFoodPlaces, referenceCoords]);

  // Filter food places
  const filteredFood = useMemo(() => {
    return filterFoodPlaces(foodWithDistances, {
      budgetTier: budgetFilter,
      category: categoryFilter,
      searchQuery,
      pureVegOnly,
      lateNightOnly,
      region: anchorMode === 'region' ? selectedRegion : 'All',
    });
  }, [
    foodWithDistances,
    budgetFilter,
    categoryFilter,
    searchQuery,
    pureVegOnly,
    lateNightOnly,
    anchorMode,
    selectedRegion,
  ]);

  if (!isOpen) return null;

  const handleShare = (food: FoodWithDistance) => {
    const text = generateFoodShareText(food, food.formattedDistance);
    const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(whatsappUrl, '_blank');
  };

  const handleCopyAddress = (food: FoodWithDistance) => {
    const addressToCopy = `${food.name}, ${food.address} (Landmark: ${food.landmark})`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(addressToCopy);
      setCopiedId(food.id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const categories: (FoodCategory | 'all')[] = [
    'all',
    'Street Food & Rolls',
    'Biryani & Mughlai',
    'Authentic Bengali',
    'Heritage Cabin & Cafe',
    'Chinese & Tangra',
    'Sweets & Desserts',
  ];

  return (
    <div
      className="fixed inset-0 z-[2000] flex items-end sm:items-center justify-center bg-black/85 backdrop-blur-md p-0 sm:p-4 animate-in fade-in duration-150 select-none"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-2xl max-h-[92vh] bg-[#121622] border border-slate-700/80 rounded-t-3xl sm:rounded-3xl text-slate-100 shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-5 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile drag handle */}
        <div className="w-10 h-1 bg-slate-600/70 rounded-full mx-auto mt-2.5 sm:hidden" />

        {/* Header */}
        <div className="p-4 sm:p-5 pb-3 border-b border-slate-800 flex items-start justify-between gap-3 bg-gradient-to-b from-slate-800/40 to-transparent">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-slate-950 font-black text-xl shadow-lg shadow-amber-500/20">
              🍲
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-white tracking-tight">
                  Nearby Pujo Food & Eateries
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  {filteredFood.length} Spots
                </span>
              </div>
              <p className="text-xs text-amber-400/90 font-medium">
                শারদীয় ভোজন রসিক • Filter Kolkata food by budget & location
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center text-sm transition-colors flex-shrink-0"
          >
            ✕
          </button>
        </div>

        {/* Scrollable controls and cards */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {/* ---------------- 1. ANCHOR LOCATION SELECTOR ---------------- */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <span>📍</span> Find Food Places Near:
              </span>
              <div className="flex items-center bg-slate-800/90 rounded-xl p-0.5 border border-slate-700/60 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setAnchorMode('pandal')}
                  className={`px-2.5 py-1 rounded-lg transition-all ${
                    anchorMode === 'pandal'
                      ? 'bg-amber-400 text-slate-950 font-bold shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  🪔 Near Pandal
                </button>
                <button
                  type="button"
                  onClick={() => setAnchorMode('myLocation')}
                  className={`px-2.5 py-1 rounded-lg transition-all ${
                    anchorMode === 'myLocation'
                      ? 'bg-amber-400 text-slate-950 font-bold shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  🎯 My GPS
                </button>
                <button
                  type="button"
                  onClick={() => setAnchorMode('region')}
                  className={`px-2.5 py-1 rounded-lg transition-all ${
                    anchorMode === 'region'
                      ? 'bg-amber-400 text-slate-950 font-bold shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  🏙️ By Region
                </button>
              </div>
            </div>

            {/* Pandal selector dropdown when anchorMode is 'pandal' */}
            {anchorMode === 'pandal' && (
              <div className="relative">
                <select
                  value={chosenPandalId}
                  onChange={(e) => setChosenPandalId(e.target.value)}
                  className="w-full py-2 px-3 pl-8 rounded-xl bg-slate-800/90 border border-slate-700 text-xs text-white focus:outline-none focus:border-amber-400 transition-all font-medium appearance-none cursor-pointer"
                >
                  {allPandals.map((p) => (
                    <option key={p.id} value={p.id} className="bg-slate-900 text-white">
                      {p.name_en} {p.name_bn ? `(${p.name_bn})` : ''} - {p.cluster || 'Kolkata'}
                    </option>
                  ))}
                </select>
                <span className="absolute left-2.5 top-2.5 text-xs text-amber-400 pointer-events-none">
                  🪔
                </span>
                <span className="absolute right-3 top-2.5 text-xs text-slate-400 pointer-events-none">
                  ▼
                </span>
              </div>
            )}

            {/* GPS notice when anchorMode is 'myLocation' */}
            {anchorMode === 'myLocation' && (
              <div className="flex items-center gap-2 p-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-300 text-xs">
                <span>🎯</span>
                <span>
                  Showing food joints sorted by exact distance from your current GPS location!
                </span>
              </div>
            )}

            {/* Region pills when anchorMode is 'region' */}
            {anchorMode === 'region' && (
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1">
                {['All', 'South', 'North', 'Central', 'East'].map((reg) => (
                  <button
                    key={reg}
                    type="button"
                    onClick={() => setSelectedRegion(reg)}
                    className={`px-3 py-1 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                      selectedRegion === reg
                        ? 'bg-amber-400 text-slate-950 font-bold'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    {reg} {reg !== 'All' ? 'Kolkata' : 'Regions'}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ---------------- 2. BUDGET SELECTOR TABS ---------------- */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                💰 Filter by Your Budget:
              </span>
              <span className="text-[10px] text-amber-400/80 font-medium">Per Person Cost</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {/* All Budgets */}
              <button
                type="button"
                onClick={() => setBudgetFilter('all')}
                className={`p-2.5 rounded-2xl border text-left transition-all ${
                  budgetFilter === 'all'
                    ? 'bg-amber-500/20 border-amber-400 text-white shadow-md shadow-amber-500/10'
                    : 'bg-slate-900/70 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-sm">✨</span>
                  <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                    ALL
                  </span>
                </div>
                <div className="text-xs font-bold text-white">All Budgets</div>
                <div className="text-[10px] text-slate-400">Street to Grand Dine</div>
              </button>

              {/* Pocket Friendly (Budget) */}
              <button
                type="button"
                onClick={() => setBudgetFilter('budget')}
                className={`p-2.5 rounded-2xl border text-left transition-all ${
                  budgetFilter === 'budget'
                    ? 'bg-emerald-500/20 border-emerald-400 text-white shadow-md shadow-emerald-500/10'
                    : 'bg-slate-900/70 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-sm">🪙</span>
                  <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                    ₹
                  </span>
                </div>
                <div className="text-xs font-bold text-emerald-300">Pocket Friendly</div>
                <div className="text-[10px] text-slate-400">&lt; ₹150 / person</div>
              </button>

              {/* Casual & Family (Moderate) */}
              <button
                type="button"
                onClick={() => setBudgetFilter('moderate')}
                className={`p-2.5 rounded-2xl border text-left transition-all ${
                  budgetFilter === 'moderate'
                    ? 'bg-amber-500/20 border-amber-400 text-white shadow-md shadow-amber-500/10'
                    : 'bg-slate-900/70 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-sm">🍽️</span>
                  <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300">
                    ₹₹
                  </span>
                </div>
                <div className="text-xs font-bold text-amber-300">Casual &amp; Family</div>
                <div className="text-[10px] text-slate-400">₹150 – ₹400 / person</div>
              </button>

              {/* Grand Feast (Premium) */}
              <button
                type="button"
                onClick={() => setBudgetFilter('premium')}
                className={`p-2.5 rounded-2xl border text-left transition-all ${
                  budgetFilter === 'premium'
                    ? 'bg-purple-500/20 border-purple-400 text-white shadow-md shadow-purple-500/10'
                    : 'bg-slate-900/70 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-sm">👑</span>
                  <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300">
                    ₹₹₹
                  </span>
                </div>
                <div className="text-xs font-bold text-purple-300">Grand Pujo Feast</div>
                <div className="text-[10px] text-slate-400">₹400+ / person</div>
              </button>
            </div>
          </div>

          {/* ---------------- 3. SEARCH BAR & QUICK TOGGLES ---------------- */}
          <div className="space-y-2">
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search food by dish (kathi roll, biryani, kosha mangsho, paturi, mishti) or place..."
                className="w-full py-2.5 pl-9 pr-8 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-amber-400 transition-all shadow-inner"
              />
              <span className="absolute left-3 top-3 text-xs text-slate-400 pointer-events-none">
                🔍
              </span>
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-white text-xs w-5 h-5 rounded-full flex items-center justify-center"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Category pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
              {categories.map((cat) => {
                const isActive = categoryFilter === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategoryFilter(cat)}
                    className={`whitespace-nowrap px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all ${
                      isActive
                        ? 'bg-amber-400 text-slate-950 font-bold shadow-sm'
                        : 'bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700'
                    }`}
                  >
                    {cat === 'all' ? 'All Cuisines' : cat}
                  </button>
                );
              })}
            </div>

            {/* Quick toggles: Pure Veg & Late Night */}
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setPureVegOnly(!pureVegOnly)}
                className={`px-3 py-1 rounded-xl text-xs font-semibold border flex items-center gap-1.5 transition-all ${
                  pureVegOnly
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-sm'
                    : 'bg-slate-900/80 text-slate-400 border-slate-800 hover:text-slate-200'
                }`}
              >
                <span>🌿</span>
                <span>Pure Veg Only</span>
              </button>

              <button
                type="button"
                onClick={() => setLateNightOnly(!lateNightOnly)}
                className={`px-3 py-1 rounded-xl text-xs font-semibold border flex items-center gap-1.5 transition-all ${
                  lateNightOnly
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm'
                    : 'bg-slate-900/80 text-slate-400 border-slate-800 hover:text-slate-200'
                }`}
              >
                <span>🌙</span>
                <span>Late Night Pujo Food</span>
              </button>
            </div>
          </div>

          {/* ---------------- 4. FOOD LISTINGS ---------------- */}
          <div className="space-y-3 pt-1">
            {filteredFood.length === 0 ? (
              <div className="py-12 text-center text-slate-400 bg-slate-900/50 rounded-2xl border border-slate-800/80">
                <span className="text-3xl block mb-2">🍽️</span>
                <p className="font-semibold text-sm text-slate-200">No food places found</p>
                <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                  Try relaxing your budget filter or clearing the search query to discover more Kolkata food spots.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setBudgetFilter('all');
                    setCategoryFilter('all');
                    setSearchQuery('');
                    setPureVegOnly(false);
                    setLateNightOnly(false);
                  }}
                  className="mt-3 px-3 py-1.5 bg-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow-md"
                >
                  Reset All Filters
                </button>
              </div>
            ) : (
              filteredFood.map((food) => {
                const navUrl = getFoodNavigationUrl(food);

                return (
                  <div
                    key={food.id}
                    className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800/90 hover:border-amber-500/40 transition-all shadow-md flex flex-col justify-between gap-3"
                  >
                    <div>
                      {/* Top Badges: Budget Pill + Distance Pill */}
                      <div className="flex items-center justify-between gap-2 mb-1.5 flex-wrap">
                        {/* Budget Tier Pill */}
                        <div className="flex items-center gap-1.5">
                          {food.budget_tier === 'budget' && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-black px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300">
                              <span>🪙</span>
                              <span>{food.cost_for_two}</span>
                              <span className="font-medium text-emerald-400/70">• Pocket Friendly</span>
                            </span>
                          )}
                          {food.budget_tier === 'moderate' && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-black px-2.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300">
                              <span>🍽️</span>
                              <span>{food.cost_for_two}</span>
                              <span className="font-medium text-amber-400/70">• Casual Dine</span>
                            </span>
                          )}
                          {food.budget_tier === 'premium' && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-black px-2.5 py-0.5 rounded-full bg-purple-500/15 border border-purple-500/30 text-purple-300">
                              <span>👑</span>
                              <span>{food.cost_for_two}</span>
                              <span className="font-medium text-purple-400/70">• Grand Feast</span>
                            </span>
                          )}

                          {food.is_pure_veg && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              Pure Veg
                            </span>
                          )}
                        </div>

                        {/* Real-time Distance Badge */}
                        <div className="inline-flex items-center gap-1 text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-blue-500/15 border border-blue-500/30 text-blue-300">
                          <span>🚶</span>
                          <span>{food.formattedDistance}</span>
                        </div>
                      </div>

                      {/* Name in Bengali & English + Category + Rating */}
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <div>
                          {food.name_bn && (
                            <span className="text-xs font-semibold text-amber-400 tracking-wide block">
                              {food.name_bn}
                            </span>
                          )}
                          <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                            <span>{food.name}</span>
                          </h3>
                        </div>

                        <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-800 border border-slate-700 text-xs font-bold text-amber-300 flex-shrink-0">
                          <span>★</span>
                          <span>{food.rating}</span>
                          <span className="text-[10px] text-slate-400 font-normal">
                            ({food.review_count})
                          </span>
                        </div>
                      </div>

                      {/* Cuisine line */}
                      <p className="text-xs text-slate-300 font-medium mb-2">{food.cuisine}</p>

                      {/* Must-Try Dishes */}
                      <div className="mb-2.5">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                          🔥 Must Try for Pujo:
                        </span>
                        <div className="flex flex-wrap gap-1">
                          {food.famous_dishes.map((dish, i) => (
                            <span
                              key={i}
                              className="text-[11px] font-medium px-2 py-0.5 rounded-lg bg-slate-800/90 text-amber-200 border border-slate-700/60"
                            >
                              {dish}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Detailed Location & Landmark */}
                      <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-xs space-y-1 mb-2">
                        <div className="flex items-start gap-1.5 text-slate-300">
                          <span className="text-amber-400 flex-shrink-0">📍</span>
                          <div>
                            <span className="font-semibold text-white">{food.address}</span>
                            <span className="block text-[11px] text-slate-400">
                              Landmark: {food.landmark}
                            </span>
                          </div>
                        </div>

                        {/* Nearest Metro */}
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-400 pt-0.5 border-t border-slate-800/80">
                          <span className="text-sky-400">🚇</span>
                          <span>
                            {food.nearest_metro} ({food.metro_walk_mins}m walk)
                          </span>
                          <span className="text-slate-600">•</span>
                          <span className="text-amber-400/90">🕒 {food.pujo_timing}</span>
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons: Walk Navigation, View on Map, Share */}
                    <div className="flex items-center gap-2 pt-1">
                      {/* Direct Walking Navigation */}
                      <a
                        href={navUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md shadow-blue-600/20 active:scale-[0.98] transition-all text-center"
                      >
                        <span>📍</span>
                        <span>Walk Navigation</span>
                      </a>

                      {/* View on Map */}
                      {onSelectFoodOnMap && (
                        <button
                          type="button"
                          onClick={() => {
                            onSelectFoodOnMap(food);
                            onClose();
                          }}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 font-bold text-xs active:scale-[0.98] transition-all"
                        >
                          <span>🗺️</span>
                          <span>Show on Map</span>
                        </button>
                      )}

                      {/* WhatsApp Share */}
                      <button
                        type="button"
                        onClick={() => handleShare(food)}
                        className="p-2.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 text-xs font-bold transition-all"
                        title="Share on WhatsApp"
                      >
                        📲
                      </button>

                      {/* Copy Address */}
                      <button
                        type="button"
                        onClick={() => handleCopyAddress(food)}
                        className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-bold transition-all"
                        title="Copy Address"
                      >
                        {copiedId === food.id ? '✓' : '📋'}
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FoodExplorerModal;
