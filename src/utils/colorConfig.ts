export interface WaitTimeColorConfig {
  key: 'green' | 'yellow' | 'orange' | 'red';
  label: string;
  badgeBg: string;
  pulseRgba: string;
  markerGradient: string;
  boxShadow: string;
}

/**
 * Wait-time color configuration:
 * Green: <15m
 * Yellow: 15–30m
 * Orange: 30–60m
 * Red: 60m+ (Gridlock)
 */
export const getWaitTimeColorConfig = (waitMinutes: number): WaitTimeColorConfig => {
  if (waitMinutes < 15) {
    return {
      key: 'green',
      label: 'Smooth (<15m)',
      badgeBg: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300',
      pulseRgba: 'rgba(16, 185, 129, 0.65)',
      markerGradient: 'linear-gradient(135deg, #10b981, #059669)',
      boxShadow: '0 0 16px rgba(16, 185, 129, 0.65)',
    };
  }
  if (waitMinutes <= 30) {
    return {
      key: 'yellow',
      label: 'Steady (15–30m)',
      badgeBg: 'bg-amber-400/15 border-amber-400/30 text-amber-300',
      pulseRgba: 'rgba(251, 191, 36, 0.65)',
      markerGradient: 'linear-gradient(135deg, #fbbf24, #d97706)',
      boxShadow: '0 0 16px rgba(251, 191, 36, 0.65)',
    };
  }
  if (waitMinutes <= 60) {
    return {
      key: 'orange',
      label: 'Heavy (30–60m)',
      badgeBg: 'bg-orange-500/15 border-orange-500/30 text-orange-300',
      pulseRgba: 'rgba(249, 115, 22, 0.65)',
      markerGradient: 'linear-gradient(135deg, #f97316, #ea580c)',
      boxShadow: '0 0 16px rgba(249, 115, 22, 0.65)',
    };
  }
  return {
    key: 'red',
    label: 'Gridlock (60m+)',
    badgeBg: 'bg-rose-500/15 border-rose-500/30 text-rose-300',
    pulseRgba: 'rgba(244, 63, 94, 0.75)',
    markerGradient: 'linear-gradient(135deg, #f43f5e, #e11d48)',
    boxShadow: '0 0 18px rgba(244, 63, 94, 0.75)',
  };
};
