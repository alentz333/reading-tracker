export interface WakeWindowReference {
  id: number;
  age_weeks_min: number;
  age_weeks_max: number;
  window_min_minutes: number;
  window_max_minutes: number;
  typical_naps_per_day: number;
  source: string | null;
}

let cachedWindows: WakeWindowReference[] | null = null;

export function setCachedWakeWindows(windows: WakeWindowReference[]) {
  cachedWindows = windows;
}

export function getCachedWakeWindows(): WakeWindowReference[] | null {
  return cachedWindows;
}

export function lookupWakeWindow(
  ageInWeeks: number,
  windows: WakeWindowReference[]
): WakeWindowReference | null {
  if (windows.length === 0) return null;

  const match = windows.find(
    (w) => ageInWeeks >= w.age_weeks_min && ageInWeeks <= w.age_weeks_max
  );
  if (match) return match;

  // Fallback to last row if baby is older than any defined max
  const sorted = [...windows].sort((a, b) => b.age_weeks_max - a.age_weeks_max);
  return sorted[0];
}

export type WakeWindowColor = 'green' | 'amber' | 'red';

export function wakeWindowColor(
  elapsedMinutes: number,
  windowMin: number,
  windowMax: number
): WakeWindowColor {
  if (elapsedMinutes < windowMin) return 'green';
  if (elapsedMinutes <= windowMax) return 'amber';
  return 'red';
}

export function predictedNapWindow(
  lastWakeEndTs: string | Date,
  windowMinMinutes: number,
  windowMaxMinutes: number
): { start: Date; end: Date } {
  const base = new Date(lastWakeEndTs).getTime();
  return {
    start: new Date(base + windowMinMinutes * 60 * 1000),
    end: new Date(base + windowMaxMinutes * 60 * 1000),
  };
}
