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
      className="fixed inset-0 z-[2000] flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-md p-0 sm:p-4 animate-in fade-in duration-200 select-none"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-lg max-h-[90vh] bg-[#0d121f]/95 backdrop-blur-2xl border border-white/10 rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 text-slate-100 shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-5 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile handle */}
        <div className="w-12 h-1.5 bg-slate-600/60 rounded-full mx-auto mb-3 sm:hidden" />

        {/* Header */}
        <div className="flex items-start justify-between gap-3 pb-3.5 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-300 text-xl shadow-lg shadow-amber-500/10">
              ✨
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-extrabold text-white tracking-tight">
                Curated Pandal Trails
              </h2>
              <p className="text-xs text-amber-400 font-semibold">
                Hand-picked circuits optimized for walking & crowd flow
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

        {/* List of Curated Trails */}
        <div className="overflow-y-auto pr-1 py-3.5 space-y-3.5">
          {CURATED_CIRCUITS.map((circuit) => {
            const includedPandals = circuit.pandalIds
              .map((id) => pandalsMap.get(id))
              .filter(Boolean) as Pandal[];

            return (
              <div
                key={circuit.id}
                className="p-4 rounded-2xl bg-[#141b2d]/80 hover:bg-[#182138] border border-white/[0.08] hover:border-amber-400/40 transition-all duration-200 shadow-lg flex flex-col justify-between gap-3 group"
              >
                <div>
                  {/* Badge & Distance */}
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 tracking-wide uppercase">
                      {circuit.badge}
                    </span>
                    <span className="text-xs text-slate-400 font-semibold flex items-center gap-1">
                      <span>🚶</span>
                      <span>~{circuit.estimatedKm} km • {circuit.estimatedMinutes}m walk</span>
                    </span>
                  </div>

                  {/* Bengali & English titles */}
                  <span className="text-xs font-bold text-amber-400/90 block tracking-wide font-bengali mb-0.5">
                    {circuit.titleBn}
                  </span>
                  <h3 className="text-base font-extrabold text-white mb-1 group-hover:text-amber-300 transition-colors">
                    {circuit.titleEn}
                  </h3>
                  <p className="text-xs text-slate-300 leading-relaxed mb-3">
                    {circuit.description}
                  </p>

                  {/* Included Pandals Pills */}
                  <div className="flex flex-wrap gap-1.5">
                    {includedPandals.map((p, idx) => (
                      <span
                        key={p.id}
                        className="inline-flex items-center gap-1.5 text-[10px] px-2.5 py-1 rounded-xl bg-slate-900/90 border border-white/10 text-slate-200 font-medium"
                      >
                        <strong className="text-amber-400 font-black">#{idx + 1}</strong>
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
                  className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-xs shadow-md shadow-amber-500/25 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                >
                  <span>🧭</span>
                  <span>Load Trail onto Map & Route</span>
                </button>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="pt-2 border-t border-white/10">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 px-4 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 font-bold text-xs active:scale-[0.98] transition-all border border-white/10"
          >
            Back to Map
          </button>
        </div>
      </div>
    </div>
  );
};
