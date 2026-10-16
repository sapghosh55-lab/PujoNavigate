import React, { useState } from 'react';
import { Pandal } from '../types/pandal';
import { getWaitTimeColorConfig } from '../utils/colorConfig';

interface PandalListViewProps {
  pandals: Pandal[];
  selectedCircuitIds: string[];
  savedPandalIds: string[];
  visitedPandalIds: string[];
  onSelectPandal: (pandal: Pandal) => void;
  onToggleCircuit: (pandalId: string) => void;
  onToggleSaved: (pandalId: string) => void;
  onToggleVisited: (pandalId: string) => void;
  onReportCrowd: (pandal: Pandal) => void;
  onExploreFoodForPandal?: (pandal: Pandal) => void;
}

export const PandalListView: React.FC<PandalListViewProps> = ({
  pandals,
  selectedCircuitIds,
  savedPandalIds,
  visitedPandalIds,
  onSelectPandal,
  onToggleCircuit,
  onToggleSaved,
  onToggleVisited,
  onReportCrowd,
  onExploreFoodForPandal,
}) => {
  const [sortBy, setSortBy] = useState<'wait' | 'metro' | 'name'>('wait');

  const sortedPandals = [...pandals].sort((a, b) => {
    if (sortBy === 'wait') {
      return (a.wait_time_minutes ?? 15) - (b.wait_time_minutes ?? 15);
    }
    if (sortBy === 'metro') {
      return (a.walk_mins ?? 99) - (b.walk_mins ?? 99);
    }
    return (a.name_en ?? '').localeCompare(b.name_en ?? '');
  });

  return (
    <div className="w-full h-full overflow-y-auto px-3.5 pt-36 sm:pt-32 pb-28 text-slate-100 max-w-5xl mx-auto">
      {/* List Toolbar / Sort */}
      <div className="flex items-center justify-between mb-5 bg-[#0f1424]/85 backdrop-blur-xl p-3.5 rounded-2xl border border-white/10 shadow-xl">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_8px_#fbbf24]"></span>
          <span className="text-xs text-slate-300 font-bold">
            Showing <strong className="text-white font-extrabold">{sortedPandals.length}</strong> Pandals
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-400 font-medium">Sort:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="bg-[#182035] text-amber-300 font-bold rounded-xl px-3 py-1.5 text-xs border border-white/10 outline-none cursor-pointer hover:border-amber-400/40 transition-colors shadow-sm"
          >
            <option value="wait">⚡ Lowest Wait Time</option>
            <option value="metro">🚶 Nearest Metro</option>
            <option value="name">🔤 Name (A-Z)</option>
          </select>
        </div>
      </div>

      {/* Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {sortedPandals.map((pandal) => {
          const waitTime = pandal.wait_time_minutes ?? 15;
          const colorConfig = getWaitTimeColorConfig(waitTime);
          const isSelectedInCircuit = selectedCircuitIds.includes(pandal.id);
          const circuitIndex = selectedCircuitIds.indexOf(pandal.id);
          const isSaved = savedPandalIds.includes(pandal.id);
          const isVisited = visitedPandalIds.includes(pandal.id);

          return (
            <div
              key={pandal.id}
              className={`group bg-[#101524]/90 hover:bg-[#141b2f] backdrop-blur-xl transition-all duration-300 border rounded-3xl p-5 shadow-xl hover:shadow-2xl hover:shadow-amber-500/5 flex flex-col justify-between ${
                isVisited
                  ? 'border-emerald-500/40 bg-emerald-950/20'
                  : 'border-white/[0.08] hover:border-amber-400/40'
              }`}
            >
              <div>
                {/* Top Row: Bengali name + Wait Badge + Saved heart */}
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex-1 min-w-0">
                    {pandal.name_bn && (
                      <span className="text-xs font-bold text-amber-400/90 block tracking-wide font-bengali mb-0.5">
                        {pandal.name_bn}
                      </span>
                    )}
                    <h3 className="text-base sm:text-lg font-extrabold text-white leading-snug group-hover:text-amber-300 transition-colors flex items-center gap-2">
                      <span className="truncate">{pandal.name_en}</span>
                      {isVisited && (
                        <span className="text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 px-2 py-0.5 rounded-full font-bold flex-shrink-0">
                          ✓ Visited
                        </span>
                      )}
                    </h3>
                  </div>

                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {/* Bookmark Heart */}
                    <button
                      type="button"
                      onClick={() => onToggleSaved(pandal.id)}
                      className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-sm transition-all active:scale-90"
                      title={isSaved ? 'Remove from wishlist' : 'Save to wishlist'}
                    >
                      {isSaved ? '❤️' : '🤍'}
                    </button>

                    {/* Wait Time Gauge */}
                    <div
                      className={`px-3 py-1 rounded-full text-xs font-black border flex items-center gap-1.5 shadow-sm ${colorConfig.badgeBg}`}
                    >
                      <span
                        className="w-2 h-2 rounded-full shadow-sm animate-pulse"
                        style={{ background: colorConfig.pulseRgba }}
                      />
                      <span>~{waitTime}m</span>
                    </div>
                  </div>
                </div>

                {/* Cluster & Location Subtext */}
                <div className="text-xs text-slate-400 flex items-center gap-2 mb-3.5">
                  {pandal.cluster && (
                    <span className="bg-slate-800/80 border border-white/5 px-2.5 py-0.5 rounded-lg text-slate-300 text-[11px] font-medium">
                      {pandal.cluster}
                    </span>
                  )}
                  {pandal.nearest_metro && (
                    <span className="text-slate-300 text-[11px] flex items-center gap-1">
                      <span>🚇</span>
                      <span>{pandal.nearest_metro} ({pandal.walk_mins ?? 10}m walk)</span>
                    </span>
                  )}
                </div>

                {/* Feature Tags */}
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {pandal.senior_line && (
                    <span className="inline-flex items-center gap-1 text-[11px] px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-semibold">
                      🧓 Senior Lane
                    </span>
                  )}
                  {pandal.wheelchair_access && (
                    <span className="inline-flex items-center gap-1 text-[11px] px-2.5 py-0.5 rounded-full bg-blue-500/15 border border-blue-500/30 text-blue-300 font-semibold">
                      ♿ Wheelchair
                    </span>
                  )}
                  {pandal.medical_kiosk && (
                    <span className="inline-flex items-center gap-1 text-[11px] px-2.5 py-0.5 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-300 font-semibold">
                      🩺 Medical
                    </span>
                  )}
                  {pandal.metro_line && (
                    <span className="inline-flex items-center gap-1 text-[11px] px-2.5 py-0.5 rounded-full bg-slate-800/90 border border-white/10 text-slate-300 font-semibold">
                      {pandal.metro_line} Line
                    </span>
                  )}
                </div>
              </div>

              {/* Action Buttons Row */}
              <div className="flex items-center gap-2 pt-3 border-t border-white/[0.08]">
                <button
                  type="button"
                  onClick={() => onSelectPandal(pandal)}
                  className="flex-1 py-2 px-3 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 font-bold text-xs active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 shadow-sm"
                >
                  <span>📍</span>
                  <span>View Map</span>
                </button>

                <button
                  type="button"
                  onClick={() => onToggleCircuit(pandal.id)}
                  className={`py-2 px-3 rounded-xl font-bold text-xs active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 border ${
                    isSelectedInCircuit
                      ? 'bg-amber-400 text-slate-950 border-amber-400 shadow-md shadow-amber-400/20 font-black'
                      : 'bg-white/5 hover:bg-white/10 text-slate-200 border-white/10'
                  }`}
                  title={isSelectedInCircuit ? 'Remove from circuit' : 'Add to circuit'}
                >
                  {isSelectedInCircuit ? (
                    <>
                      <span>✓</span>
                      <span>#{circuitIndex + 1}</span>
                    </>
                  ) : (
                    <>
                      <span>+</span>
                      <span>Circuit</span>
                    </>
                  )}
                </button>

                {/* Mark as Visited Button */}
                <button
                  type="button"
                  onClick={() => onToggleVisited(pandal.id)}
                  className={`py-2 px-2.5 rounded-xl border transition-all active:scale-95 ${
                    isVisited
                      ? 'bg-emerald-500/25 text-emerald-300 border-emerald-500/50 shadow-sm'
                      : 'bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white border-white/10'
                  }`}
                  title={isVisited ? 'Mark unvisited' : 'Mark as visited'}
                >
                  ✓
                </button>

                {/* Nearby Food Shortcut */}
                {onExploreFoodForPandal && (
                  <button
                    type="button"
                    onClick={() => onExploreFoodForPandal(pandal)}
                    className="py-2 px-3 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-400/30 transition-all text-xs font-bold flex items-center gap-1 shadow-sm active:scale-95"
                    title="Find nearby food places by budget"
                  >
                    <span>🍲</span>
                    <span>Food</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => onReportCrowd(pandal)}
                  className="py-2 px-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white border border-white/10 transition-all active:scale-95"
                  title="Report Wait Time"
                >
                  📢
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
