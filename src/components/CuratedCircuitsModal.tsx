import React from 'react';
import { CURATED_CIRCUITS, CuratedCircuit } from '../data/curatedCircuits';
import { Pandal } from '../types/pandal';

interface CuratedCircuitsModalProps {
  isOpen: boolean;
  onClose: () => void;
  pandals: Pandal[];
  onSelectCircuit: (circuit: CuratedCircuit) => void;
}

export const CuratedCircuitsModal: React.FC<CuratedCircuitsModalProps> = ({
  isOpen,
  onClose,
  pandals,
  onSelectCircuit,
}) => {
  if (!isOpen) return null;

  const pandalsMap = new Map<string, Pandal>(pandals.map((p) => [p.id, p]));

  return (
    <div
      className="fixed inset-0 z-[2000] flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-md p-0 sm:p-4 animate-in fade-in duration-150 select-none"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-lg max-h-[90vh] bg-[#141824] border border-slate-700/80 rounded-t-3xl sm:rounded-2xl p-5 text-slate-100 shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-5 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile handle */}
        <div className="w-10 h-1 bg-slate-600/70 rounded-full mx-auto mb-3 sm:hidden" />

        {/* Header */}
        <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 text-lg">
              ✨
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">
                Curated Pandal Trails
              </h2>
              <p className="text-xs text-amber-400 font-medium">
                Hand-picked circuits optimized for walking & crowd flow
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center text-sm transition-colors"
          >
            ✕
          </button>
        </div>

        {/* List of Curated Trails */}
        <div className="overflow-y-auto pr-1 py-3 space-y-3">
          {CURATED_CIRCUITS.map((circuit) => {
            const includedPandals = circuit.pandalIds
              .map((id) => pandalsMap.get(id))
              .filter(Boolean) as Pandal[];

            return (
              <div
                key={circuit.id}
                className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700/70 hover:border-amber-500/50 transition-all shadow-md flex flex-col justify-between gap-3"
              >
                <div>
                  {/* Badge & Distance */}
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      {circuit.badge}
                    </span>
                    <span className="text-xs text-slate-400 font-semibold">
                      ~{circuit.estimatedKm} km • {circuit.estimatedMinutes}m walk
                    </span>
                  </div>

                  {/* Bengali & English titles */}
                  <span className="text-xs font-semibold text-amber-400 block tracking-wide">
                    {circuit.titleBn}
                  </span>
                  <h3 className="text-base font-bold text-white mb-1">
                    {circuit.titleEn}
                  </h3>
                  <p className="text-[11px] text-slate-300 leading-relaxed mb-2.5">
                    {circuit.description}
                  </p>

                  {/* Included Pandals Pills */}
                  <div className="flex flex-wrap gap-1.5">
                    {includedPandals.map((p, idx) => (
                      <span
                        key={p.id}
                        className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-lg bg-slate-900 border border-slate-700/60 text-slate-200"
                      >
                        <strong className="text-amber-400">#{idx + 1}</strong>
                        <span>{p.name_en}</span>
                      </span>
                    ))}
                  </div>
                </div>

                {/* Select Circuit Action Button */}
                <button
                  type="button"
                  onClick={() => {
                    onSelectCircuit(circuit);
                    onClose();
                  }}
                  className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs shadow-md shadow-amber-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5"
                >
                  <span>🗺️</span>
                  <span>Load Trail onto Map & Route</span>
                </button>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="pt-2 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs active:scale-[0.98] transition-all"
          >
            Back to Map
          </button>
        </div>
      </div>
    </div>
  );
};
