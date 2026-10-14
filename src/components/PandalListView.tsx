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
    <div className="w-full h-full overflow-y-auto px-3.5 pt-44 pb-28 text-slate-100 max-w-4xl mx-auto">
      {/* List Toolbar / Sort */}
      <div className="flex items-center justify-between mb-4 bg-slate-900/80 backdrop-blur-md p-3 rounded-2xl border border-slate-800">
        <span className="text-xs text-slate-400 font-semibold">
          Showing <strong className="text-white">{sortedPandals.length}</strong> Pandals
        </span>
        <div className="flex items-center gap-1.5 text-xs">
          <span className="text-slate-400">Sort by:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="bg-slate-800 text-amber-300 font-semibold rounded-lg px-2.5 py-1 text-xs border border-slate-700 outline-none cursor-pointer"
          >
            <option value="wait">⚡ Lowest Wait</option>
            <option value="metro">🚶 Nearest Metro</option>
            <option value="name">🔤 Name (A-Z)</option>
          </select>
        </div>
      </div>

      {/* Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
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
              className={`group bg-slate-900/85 hover:bg-slate-800/90 transition-all duration-200 border rounded-2xl p-4 shadow-lg flex flex-col justify-between ${
                isVisited
                  ? 'border-emerald-500/40 bg-emerald-950/15'
                  : 'border-slate-800/80 hover:border-slate-700'
              }`}
            >
              <div>
                {/* Top Row: Bengali name + Wait Badge + Saved heart */}
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <div className="flex-1">
                    {pandal.name_bn && (
                      <span className="text-xs font-semibold text-amber-400 block tracking-wide">
                        {pandal.name_bn}
                      </span>
                    )}
                    <h3 className="text-base font-bold text-white leading-snug group-hover:text-amber-300 transition-colors flex items-center gap-2">
                      <span>{pandal.name_en}</span>
                      {isVisited && (
                        <span className="text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 px-1.5 py-0.2 rounded-full font-bold">
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
                      className="p-1 rounded-lg text-sm text-slate-400 hover:text-rose-400 transition-colors"
                      title={isSaved ? 'Remove from wishlist' : 'Save to wishlist'}
                    >
                      {isSaved ? '❤️' : '🤍'}
                    </button>

                    {/* Wait Time Gauge */}
                    <div
                      className={`px-2.5 py-1 rounded-xl text-xs font-extrabold border flex items-center gap-1.5 ${colorConfig.badgeBg}`}
                    >
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ background: colorConfig.pulseRgba }}
                      />
                      <span>~{waitTime}m</span>
                    </div>
                  </div>
                </div>

                {/* Cluster & Location Subtext */}
                <div className="text-[11px] text-slate-400 flex items-center gap-2 mb-3">
                  {pandal.cluster && (
                    <span className="bg-slate-800 px-2 py-0.5 rounded text-slate-300">
                      {pandal.cluster}
                    </span>
                  )}
                  {pandal.nearest_metro && (
                    <span className="text-slate-300">
                      🚇 {pandal.nearest_metro} ({pandal.walk_mins ?? 10}m walk)
                    </span>
                  )}
                </div>

                {/* Feature Tags */}
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {pandal.senior_line && (
                    <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-300">
                      🧓 Senior Lane
                    </span>
                  )}
                  {pandal.wheelchair_access && (
                    <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-300">
                      ♿ Wheelchair
                    </span>
                  )}
                  {pandal.medical_kiosk && (
                    <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-300">
                      🩺 Medical
                    </span>
                  )}
                  {pandal.metro_line && (
                    <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-300">
                      {pandal.metro_line} Line
                    </span>
                  )}
                </div>
              </div>

              {/* Action Buttons Row */}
              <div className="flex items-center gap-2 pt-2 border-t border-slate-800/80">
                <button
                  type="button"
                  onClick={() => onSelectPandal(pandal)}
                  className="flex-1 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs active:scale-[0.98] transition-all flex items-center justify-center gap-1.5"
                >
                  <span>📍</span>
                  <span>View on Map</span>
                </button>

                <button
                  type="button"
                  onClick={() => onToggleCircuit(pandal.id)}
                  className={`py-2 px-3 rounded-xl font-bold text-xs active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 border ${
                    isSelectedInCircuit
                      ? 'bg-amber-400 text-slate-950 border-amber-400 shadow-md shadow-amber-400/20'
                      : 'bg-slate-800/70 hover:bg-slate-700 text-slate-300 border-slate-700/60'
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
                  className={`py-2 px-2.5 rounded-xl border transition-colors ${
                    isVisited
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border-slate-700/60'
                  }`}
                  title={isVisited ? 'Mark unvisited' : 'Mark as visited'}
                >
                  ✓
                </button>

                <button
                  type="button"
                  onClick={() => onReportCrowd(pandal)}
                  className="py-2 px-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700/60 transition-colors"
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
