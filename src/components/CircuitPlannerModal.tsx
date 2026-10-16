import React, { useMemo } from 'react';
import { Pandal } from '../types/pandal';
import { Coordinates } from '../data/kolkataCrossings';
import { calculateOptimalHoppingCircuit, PedestrianHoppingCircuit } from '../utils/pedestrianRouter';

interface CircuitPlannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedPandalIds: string[];
  pandals: Pandal[];
  userLocation: Coordinates;
  onRemovePandal: (pandalId: string) => void;
  onClearCircuit: () => void;
  onViewRouteOnMap: () => void;
}

export const CircuitPlannerModal: React.FC<CircuitPlannerModalProps> = ({
  isOpen,
  onClose,
  selectedPandalIds,
  pandals,
  userLocation,
  onRemovePandal,
  onClearCircuit,
  onViewRouteOnMap,
}) => {
  const pandalsMap = useMemo(() => new Map(pandals.map((p) => [p.id, p])), [pandals]);

  // Calculate circuit if 3 to 6 pandals are selected
  const circuitResult = useMemo<{
    circuit: PedestrianHoppingCircuit | null;
    error: string | null;
  }>(() => {
    if (selectedPandalIds.length < 3) {
      return {
        circuit: null,
        error: `Select ${3 - selectedPandalIds.length} more pandal${
          3 - selectedPandalIds.length === 1 ? '' : 's'
        } to compute the optimal walking circuit (3 to 6 pandals).`,
      };
    }
    if (selectedPandalIds.length > 6) {
      return {
        circuit: null,
        error: 'A pedestrian hopping circuit can contain a maximum of 6 pandals.',
      };
    }

    try {
      const circuit = calculateOptimalHoppingCircuit(
        selectedPandalIds,
        userLocation,
        pandals,
        {
          walkingSpeedKmH: 4.0, // Festive crowd rush walking speed
          includePandalWaitTimes: true,
        }
      );
      return { circuit, error: null };
    } catch (e: any) {
      return { circuit: null, error: e?.message || 'Error calculating circuit' };
    }
  }, [selectedPandalIds, userLocation, pandals]);

  if (!isOpen) return null;

  const { circuit, error } = circuitResult;

  return (
    <div
      className="fixed inset-0 z-[2000] flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-md p-0 sm:p-4 animate-in fade-in duration-200 select-none"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-lg max-h-[90vh] bg-[#0d121f]/95 backdrop-blur-2xl border border-white/10 rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 text-slate-100 shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-5 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile drag handle */}
        <div className="w-12 h-1.5 bg-slate-600/60 rounded-full mx-auto mb-3 sm:hidden" />

        {/* Modal Header */}
        <div className="flex items-start justify-between gap-3 pb-3.5 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-300 text-xl shadow-lg shadow-amber-500/10">
              🧭
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-extrabold text-white tracking-tight">
                Pedestrian Hopping Circuit
              </h2>
              <p className="text-xs text-amber-400 font-semibold">
                Nearest-Neighbor TSP with Kolkata Police Barrier Bypass
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white flex items-center justify-center text-sm transition-all active:scale-90"
          >
            ✕
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="overflow-y-auto pr-1 py-3 space-y-4 text-xs">
          {/* Selected Count & Quick Actions */}
          <div className="flex items-center justify-between bg-slate-800/60 p-2.5 rounded-xl border border-slate-700/50">
            <span className="text-slate-300 font-semibold">
              Selected: <strong className="text-white">{selectedPandalIds.length}/6</strong> Pandals
            </span>
            {selectedPandalIds.length > 0 && (
              <button
                type="button"
                onClick={onClearCircuit}
                className="text-xs text-rose-400 hover:text-rose-300 font-medium px-2 py-1 rounded hover:bg-rose-500/10 transition-colors"
              >
                Clear All
              </button>
            )}
          </div>

          {/* Under 3 pandals notice */}
          {error && (
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 flex items-start gap-2.5">
              <span className="text-base flex-shrink-0">💡</span>
              <p className="text-xs leading-relaxed">{error}</p>
            </div>
          )}

          {/* Stats Summary Card (when circuit is ready) */}
          {circuit && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="bg-[#141b2d]/80 p-3 rounded-2xl border border-white/[0.08] text-center shadow-md">
                <span className="block text-[10px] text-slate-400 uppercase font-extrabold tracking-wider">Total Walk</span>
                <span className="text-base font-black text-sky-400">{circuit.totalDistanceKm} km</span>
              </div>
              <div className="bg-[#141b2d]/80 p-3 rounded-2xl border border-white/[0.08] text-center shadow-md">
                <span className="block text-[10px] text-slate-400 uppercase font-extrabold tracking-wider">Walk Time</span>
                <span className="text-base font-black text-emerald-400">{circuit.totalWalkingMinutes}m</span>
              </div>
              <div className="bg-[#141b2d]/80 p-3 rounded-2xl border border-white/[0.08] text-center shadow-md">
                <span className="block text-[10px] text-slate-400 uppercase font-extrabold tracking-wider">Queue Time</span>
                <span className="text-base font-black text-amber-400">~{circuit.totalPandalWaitMinutes}m</span>
              </div>
              <div className="bg-[#141b2d]/80 p-3 rounded-2xl border border-white/[0.08] text-center shadow-md">
                <span className="block text-[10px] text-slate-400 uppercase font-extrabold tracking-wider">Total Trip</span>
                <span className="text-base font-black text-purple-400">{circuit.totalTripMinutes}m</span>
              </div>
            </div>
          )}

          {/* Police Barricade Crossings Used */}
          {circuit && circuit.crossingsUsed.length > 0 && (
            <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 shadow-md">
              <div className="flex items-center gap-1.5 font-bold text-xs text-emerald-300 mb-1.5">
                <span>🛡️</span>
                <span>Verified Pedestrian Bypass Waypoints:</span>
              </div>
              <ul className="space-y-1 mt-1 text-[11px] text-slate-300 list-disc list-inside">
                {circuit.crossingsUsed.map((crossing) => (
                  <li key={crossing.id}>
                    <strong className="text-white">{crossing.name}</strong> ({crossing.type})
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Step-by-Step Circuit Itinerary */}
          <div>
            <h4 className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 mb-2.5">
              Optimal Visit Order:
            </h4>
            <div className="space-y-2.5">
              {circuit ? (
                circuit.orderedPandals.map((pandal, idx) => {
                  const leg = circuit.legs[idx];
                  return (
                    <div
                      key={pandal.id}
                      className="p-3.5 rounded-2xl bg-[#141b2d]/80 border border-white/[0.08] hover:border-amber-400/30 relative flex items-start justify-between gap-3 shadow-md transition-all group"
                    >
                      <div className="flex items-start gap-3">
                        <span className="w-6 h-6 rounded-full bg-gradient-to-tr from-amber-400 to-amber-500 text-slate-950 font-black text-xs flex items-center justify-center flex-shrink-0 mt-0.5 shadow-sm">
                          {idx + 1}
                        </span>
                        <div>
                          {pandal.name_bn && (
                            <p className="text-[11px] text-amber-400/90 font-bold font-bengali">
                              {pandal.name_bn}
                            </p>
                          )}
                          <h5 className="font-extrabold text-white text-xs group-hover:text-amber-300 transition-colors">
                            {pandal.name_en}
                          </h5>
                          <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-400">
                            <span className="text-amber-300 font-semibold">Wait: ~{pandal.wait_time_minutes ?? 15}m</span>
                            {pandal.nearest_metro && (
                              <span>• Metro: {pandal.nearest_metro}</span>
                            )}
                          </div>
                          {leg && leg.navigationTip && (
                            <p className="text-[10px] text-emerald-400 mt-1.5 italic font-medium">
                              ↪ {leg.navigationTip}
                            </p>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => onRemovePandal(pandal.id)}
                        className="text-slate-500 hover:text-rose-400 text-xs w-7 h-7 rounded-lg hover:bg-white/5 flex items-center justify-center transition-all"
                        title="Remove from circuit"
                      >
                        ✕
                      </button>
                    </div>
                  );
                })
              ) : (
                selectedPandalIds.map((id, idx) => {
                  const pandal = pandalsMap.get(id);
                  if (!pandal) return null;
                  return (
                    <div
                      key={pandal.id}
                      className="p-3 rounded-2xl bg-[#141b2d]/70 border border-white/[0.08] flex items-center justify-between gap-2 shadow-sm"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="w-5 h-5 rounded-full bg-white/10 text-slate-300 font-extrabold text-[10px] flex items-center justify-center">
                          {idx + 1}
                        </span>
                        <span className="text-xs font-bold text-white">
                          {pandal.name_en}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => onRemovePandal(pandal.id)}
                        className="text-slate-500 hover:text-rose-400 text-xs w-6 h-6 rounded flex items-center justify-center hover:bg-white/5 transition-colors"
                      >
                        ✕
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="pt-3 border-t border-white/10 flex items-center gap-2">
          {circuit ? (
            <button
              type="button"
              onClick={() => {
                onViewRouteOnMap();
                onClose();
              }}
              className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-xs shadow-lg shadow-amber-500/25 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
            >
              <span>🗺️</span>
              <span>View Route on Map</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 px-4 rounded-xl bg-white/5 hover:bg-white/10 text-slate-200 font-bold text-xs active:scale-[0.98] transition-all border border-white/10"
            >
              Back to Map
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
