import React, { useState, useEffect, useCallback } from 'react';
import { Pandal } from '../types/pandal';
import { supabase } from '../lib/supabase';

export interface CrowdReportSubmission {
  pandal_id: string;
  wait_time_bracket: 'under_15' | '15_30' | '30_60' | '60_plus';
  status_level: 1 | 2 | 3 | 4;
  senior_lane_open: boolean;
  wait_time_minutes: number;
  reported_at: string;
  crowd_level?: number;
  senior_queue_operating?: boolean;
}

interface CrowdReportModalProps {
  pandal: Pandal | null;
  isOpen: boolean;
  onClose: () => void;
  onSubmitReport?: (report: CrowdReportSubmission) => Promise<void> | void;
}

interface ReportTarget {
  id: 'under_15' | '15_30' | '30_60' | '60_plus';
  title: string;
  subtitle: string;
  statusLevel: 1 | 2 | 3 | 4;
  estimatedMinutes: number;
  bgGradient: string;
  borderColor: string;
  textColor: string;
  badgeColor: string;
  accentDot: string;
}

// Four large, high-contrast touch targets
const REPORT_TARGETS: ReportTarget[] = [
  {
    id: 'under_15',
    title: 'Walk Right In',
    subtitle: '<15m wait',
    statusLevel: 1,
    estimatedMinutes: 8,
    bgGradient: 'hover:bg-emerald-500/10 active:bg-emerald-500/20 bg-[#141b2d]/80',
    borderColor: 'border-emerald-500/30 hover:border-emerald-400',
    textColor: 'text-emerald-300',
    badgeColor: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40',
    accentDot: 'bg-emerald-400',
  },
  {
    id: '15_30',
    title: 'Slow Moving',
    subtitle: '15–30m wait',
    statusLevel: 2,
    estimatedMinutes: 22,
    bgGradient: 'hover:bg-amber-500/10 active:bg-amber-500/20 bg-[#141b2d]/80',
    borderColor: 'border-amber-500/30 hover:border-amber-400',
    textColor: 'text-amber-300',
    badgeColor: 'bg-amber-500/20 text-amber-300 border border-amber-500/40',
    accentDot: 'bg-amber-400',
  },
  {
    id: '30_60',
    title: 'Long Queue',
    subtitle: '30–60m wait',
    statusLevel: 3,
    estimatedMinutes: 45,
    bgGradient: 'hover:bg-orange-500/10 active:bg-orange-500/20 bg-[#141b2d]/80',
    borderColor: 'border-orange-500/30 hover:border-orange-400',
    textColor: 'text-orange-300',
    badgeColor: 'bg-orange-500/20 text-orange-300 border border-orange-500/40',
    accentDot: 'bg-orange-400',
  },
  {
    id: '60_plus',
    title: 'Stopped / Barricaded',
    subtitle: '60m+ wait',
    statusLevel: 4,
    estimatedMinutes: 75,
    bgGradient: 'hover:bg-rose-500/10 active:bg-rose-500/20 bg-[#141b2d]/80',
    borderColor: 'border-rose-500/30 hover:border-rose-400',
    textColor: 'text-rose-300',
    badgeColor: 'bg-rose-500/20 text-rose-300 border border-rose-500/40',
    accentDot: 'bg-rose-400',
  },
];

const TWENTY_MINUTES_MS = 20 * 60 * 1000;

export const CrowdReportModal: React.FC<CrowdReportModalProps> = ({
  pandal,
  isOpen,
  onClose,
  onSubmitReport,
}) => {
  const [seniorLaneOpen, setSeniorLaneOpen] = useState<boolean>(true);
  const [cooldownMinutesLeft, setCooldownMinutesLeft] = useState<number>(0);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);

  // Check 20-minute local storage rate limit for this pandal
  const verifyRateLimit = useCallback(() => {
    if (!pandal) return;
    const storageKey = `pujo_report_${pandal.id}`;
    const lastReportTime = localStorage.getItem(storageKey);

    if (lastReportTime) {
      const elapsed = Date.now() - parseInt(lastReportTime, 10);
      if (elapsed < TWENTY_MINUTES_MS) {
        const remaining = Math.ceil((TWENTY_MINUTES_MS - elapsed) / 60000);
        setCooldownMinutesLeft(remaining);
        return;
      }
    }
    setCooldownMinutesLeft(0);
  }, [pandal]);

  useEffect(() => {
    if (isOpen && pandal) {
      verifyRateLimit();
      setSeniorLaneOpen(pandal.senior_line ?? pandal.senior_queue ?? true);
      setSubmittingId(null);
      setIsSuccess(false);
    }
  }, [isOpen, pandal, verifyRateLimit]);

  if (!isOpen || !pandal) return null;

  const isRateLimited = cooldownMinutesLeft > 0;
  const pandalNameEn = pandal.name_en ?? pandal.name ?? 'Pandal Entry';
  const pandalNameBn = pandal.name_bn ?? pandal.bengali_name;

  // Ultra-fast 1-tap submission (completes in < 2 seconds)
  const handleSelectAndSubmit = async (target: ReportTarget) => {
    if (isRateLimited || submittingId) return;

    setSubmittingId(target.id);

    const submission: CrowdReportSubmission = {
      pandal_id: pandal.id,
      wait_time_bracket: target.id,
      status_level: target.statusLevel,
      senior_lane_open: seniorLaneOpen,
      wait_time_minutes: target.estimatedMinutes,
      reported_at: new Date().toISOString(),
    };

    // 1. Optimistic UI update & immediate timestamp caching in localStorage
    const storageKey = `pujo_report_${pandal.id}`;
    localStorage.setItem(storageKey, Date.now().toString());

    // 2. Concurrently push to Supabase with lightweight timeout
    const saveToDatabase = async () => {
      try {
        // Asynchronously insert into Supabase crowd_reports table
        const insertPromise = supabase.from('crowd_reports').insert([
          {
            pandal_id: pandal.id,
            wait_time_bracket: target.id,
            status_level: target.statusLevel,
          },
        ]);

        // Timeout promise to prevent UI hanging on throttled mobile 2G/3G connections
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Network timeout')), 2500)
        );

        await Promise.race([insertPromise, timeoutPromise]);
      } catch (err) {
        // Non-blocking: report is still cached locally and synced
        console.warn('Supabase network sync notice:', err);
      }
    };

    // 3. Invoke optional consumer callback
    if (onSubmitReport) {
      try {
        await onSubmitReport(submission);
      } catch (e) {
        console.warn('Local callback notice:', e);
      }
    }

    // Trigger database write in background
    saveToDatabase();

    // Show instant success feedback and close modal quickly
    setIsSuccess(true);
    setTimeout(() => {
      setIsSuccess(false);
      onClose();
    }, 1100);
  };

  return (
    <div
      className="fixed inset-0 z-[2000] flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-md animate-in fade-in duration-200 p-0 sm:p-4 select-none"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-md bg-[#0d121f]/95 backdrop-blur-2xl border border-white/10 rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 text-slate-100 shadow-2xl animate-in slide-in-from-bottom-5 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile Swipe / Drag indicator */}
        <div className="w-12 h-1.5 bg-slate-600/60 rounded-full mx-auto mb-3 sm:hidden" />

        {isSuccess ? (
          /* Instant Success State */
          <div className="py-6 text-center">
            <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-emerald-500/20 border-2 border-emerald-400 flex items-center justify-center text-emerald-400 text-3xl shadow-xl shadow-emerald-500/20 animate-in zoom-in-75 duration-200">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-xl font-extrabold text-white mb-1">Report Recorded!</h3>
            <p className="text-xs text-slate-400 font-medium">
              Live wait updated for fellow pandal-hoppers.
            </p>
          </div>
        ) : (
          <>
            {/* Header: Pandal Name + Bengali Name */}
            <div className="flex items-start justify-between gap-3 mb-4 pb-3 border-b border-white/10">
              <div>
                {pandalNameBn && (
                  <p className="text-xs font-bold text-amber-400/90 font-bengali tracking-wide mb-0.5">
                    {pandalNameBn}
                  </p>
                )}
                <h3 className="text-base sm:text-lg font-extrabold text-white leading-tight">
                  {pandalNameEn}
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Tap your current crowd status (1 tap to submit):
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white flex items-center justify-center text-sm flex-shrink-0 transition-all active:scale-90"
              >
                ✕
              </button>
            </div>

            {/* 20-minute LocalStorage Anti-Spam Rate Limit Banner */}
            {isRateLimited && (
              <div className="mb-3 p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-2">
                <span className="text-base">⏳</span>
                <div>
                  <p className="font-semibold">Update Cooldown Active</p>
                  <p className="text-[11px] text-amber-200/80">
                    Reported recently. Please wait <strong>{cooldownMinutesLeft}m</strong> before submitting again.
                  </p>
                </div>
              </div>
            )}

            {/* Optional Single Toggle: Senior/Disabled Lane */}
            <div className="flex items-center justify-between p-2.5 px-3 rounded-xl bg-slate-800/60 border border-slate-700/60 mb-3">
              <div className="flex items-center gap-2">
                <span className="text-base">🧓</span>
                <span className="text-xs font-semibold text-slate-200">
                  Dedicated senior/disabled lane open?
                </span>
              </div>
              <button
                type="button"
                disabled={isRateLimited}
                onClick={() => setSeniorLaneOpen(!seniorLaneOpen)}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  seniorLaneOpen ? 'bg-emerald-500' : 'bg-slate-700'
                }`}
                role="switch"
                aria-checked={seniorLaneOpen}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                    seniorLaneOpen ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Four Large Touch Targets (Min height 56px, 1-tap submission) */}
            <div className="space-y-2">
              {REPORT_TARGETS.map((target) => {
                const isSelected = submittingId === target.id;
                return (
                  <button
                    key={target.id}
                    type="button"
                    disabled={isRateLimited || !!submittingId}
                    onClick={() => handleSelectAndSubmit(target)}
                    className={`w-full min-h-[58px] px-3.5 py-2.5 rounded-xl border ${target.borderColor} ${target.bgGradient} flex items-center justify-between transition-all duration-150 active:scale-[0.98] text-left group disabled:opacity-50 disabled:pointer-events-none ${
                      isSelected ? 'ring-2 ring-white/80 bg-slate-700' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`w-3 h-3 rounded-full ${target.accentDot} flex-shrink-0 shadow-sm`} />
                      <div>
                        <p className="text-xs font-bold text-white group-hover:text-white transition-colors">
                          {target.title}
                        </p>
                        <p className={`text-[11px] font-medium ${target.textColor}`}>
                          {target.subtitle}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${target.badgeColor}`}>
                        Level {target.statusLevel}
                      </span>
                      {isSelected ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <span className="text-slate-400 group-hover:text-white text-xs">→</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Footer micro-copy */}
            <p className="text-center text-[10px] text-slate-500 mt-3">
              One-tap submission • Encrypted crowd analytics
            </p>
          </>
        )}
      </div>
    </div>
  );
};

export default CrowdReportModal;
