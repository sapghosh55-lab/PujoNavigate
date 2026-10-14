import React from 'react';

interface EmergencyHelplineModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface HelplineItem {
  name: string;
  number: string;
  icon: string;
  desc: string;
  badge: string;
  badgeColor: string;
}

const HELPLINES: HelplineItem[] = [
  {
    name: 'Kolkata Traffic Police Control',
    number: '033-22143644',
    icon: '🚦',
    desc: 'Road closures, barricade crossing updates & traffic routing assistance',
    badge: '24x7 Traffic SOS',
    badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  },
  {
    name: 'Police Emergency Assistance',
    number: '100',
    icon: '👮',
    desc: 'Immediate emergency police dispatch & nearest police booth assistance',
    badge: 'Toll-Free',
    badgeColor: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  },
  {
    name: 'Medical & Ambulance SOS',
    number: '102',
    icon: '🚑',
    desc: 'Government emergency ambulance & quick medical aid stations',
    badge: 'Medical Aid',
    badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  },
  {
    name: 'Women Helpline (Shakti)',
    number: '1091',
    icon: '🛡️',
    desc: 'Dedicated women safety patrol & emergency assistance squads',
    badge: 'Priority Support',
    badgeColor: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
  },
  {
    name: 'Disaster Management Helpline',
    number: '1070',
    icon: '🚨',
    desc: 'City-wide festival crowd emergencies & disaster coordination cell',
    badge: 'State Control Room',
    badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  },
];

export const EmergencyHelplineModal: React.FC<EmergencyHelplineModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

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
            <div className="w-9 h-9 rounded-xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 text-lg">
              🚨
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">
                Emergency & Puja Helpline
              </h2>
              <p className="text-xs text-rose-400 font-medium">
                Official Kolkata Police & Medical Support Numbers
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

        {/* Content */}
        <div className="overflow-y-auto pr-1 py-3 space-y-3">
          {/* Kolkata Metro Night Advisory */}
          <div className="p-3.5 rounded-2xl bg-sky-950/40 border border-sky-500/30 text-xs">
            <div className="flex items-center gap-2 font-bold text-sky-300 mb-1">
              <span>🚇</span>
              <span>Kolkata Metro Special Puja Night Services:</span>
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              Operating all-night trains on <strong>Blue Line (Dakshineswar - Kavi Subhash)</strong>{' '}
              and <strong>Green Line (Howrah Maidan - Esplanade / Sealdah - Sector V)</strong> with
              6–10 minute frequency till 5:00 AM on Saptami, Ashtami, and Nabami nights.
            </p>
          </div>

          {/* Emergency Helplines Cards */}
          <div className="space-y-2">
            {HELPLINES.map((item) => (
              <div
                key={item.number}
                className="p-3 rounded-2xl bg-slate-800/80 border border-slate-700/60 flex items-center justify-between gap-3 hover:border-slate-600 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <span className="text-xl mt-0.5">{item.icon}</span>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-bold text-white">{item.name}</h4>
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.2 rounded border ${item.badgeColor}`}
                      >
                        {item.badge}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">{item.desc}</p>
                  </div>
                </div>

                <a
                  href={`tel:${item.number}`}
                  className="px-3 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-xs shadow-md shadow-rose-600/30 active:scale-95 transition-all flex items-center gap-1.5 flex-shrink-0"
                >
                  <span>📞</span>
                  <span>{item.number}</span>
                </a>
              </div>
            ))}
          </div>

          {/* Police Barricade Pedestrian Guidelines */}
          <div className="p-3 rounded-2xl bg-slate-800/40 border border-slate-700/40 text-[11px] text-slate-400 space-y-1">
            <span className="block font-bold text-slate-300">
              📌 Kolkata Police Pedestrian Advisory:
            </span>
            <p>• Avoid crossing Rashbehari Avenue or Central Avenue at street level during rush hours.</p>
            <p>• Always utilize marked pedestrian subways or designated foot overbridges.</p>
            <p>• Carry identification and take advantage of senior citizen fast-track lines.</p>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs active:scale-[0.98] transition-all"
          >
            Close Helplines
          </button>
        </div>
      </div>
    </div>
  );
};
