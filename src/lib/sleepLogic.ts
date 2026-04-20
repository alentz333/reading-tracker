import { differenceInMinutes } from 'date-fns';
import { calendarDayOf, minutesBetween } from './dateUtils';
import { MAX_VALID_WAKE_WINDOW_HOURS } from './config';

export interface SleepSession {
  id: string;
  baby_id: string;
  type: 'nap' | 'night';
  start_at: string;
  end_at: string | null;
  notes: string | null;
  created_at: string;
  night_wakings?: NightWaking[];
}

export interface NightWaking {
  id: string;
  session_id: string;
  woke_at: string;
  back_asleep_at: string | null;
  created_at: string;
}

// Longest continuous sleep stretch within a night session
export function longestNightStretch(session: SleepSession): number | null {
  if (session.type !== 'night') return null;
  const wakings = (session.night_wakings ?? []).sort(
    (a, b) => new Date(a.woke_at).getTime() - new Date(b.woke_at).getTime()
  );

  const stretches: number[] = [];
  let cursor = new Date(session.start_at);

  for (const waking of wakings) {
    if (!waking.back_asleep_at) break; // skip incomplete and all subsequent
    stretches.push(differenceInMinutes(new Date(waking.woke_at), cursor));
    cursor = new Date(waking.back_asleep_at);
  }

  // Final stretch from last back_asleep (or session start) to end
  if (session.end_at && wakings.every((w) => w.back_asleep_at)) {
    stretches.push(differenceInMinutes(new Date(session.end_at), cursor));
  }

  if (stretches.length === 0) {
    // No wakings resolved — full session length if complete
    if (session.end_at) {
      return differenceInMinutes(new Date(session.end_at), new Date(session.start_at));
    }
    return null;
  }

  return Math.max(...stretches);
}

// Total minutes for a session (0 if still open)
export function sessionDurationMinutes(session: SleepSession): number {
  if (!session.end_at) {
    return differenceInMinutes(new Date(), new Date(session.start_at));
  }
  return differenceInMinutes(new Date(session.end_at), new Date(session.start_at));
}

// Total minutes of night waking (awake time) for a session
export function totalWakingMinutes(wakings: NightWaking[]): number {
  return wakings.reduce((acc, w) => {
    if (!w.back_asleep_at) return acc;
    return acc + differenceInMinutes(new Date(w.back_asleep_at), new Date(w.woke_at));
  }, 0);
}

export interface DaySummary {
  date: string; // yyyy-MM-dd
  napMinutes: number;
  nightMinutes: number;
  napCount: number;
  nightWakingCount: number;
  sessions: SleepSession[];
}

// Group sessions by calendar day of start_at (in local time)
export function groupByDay(sessions: SleepSession[]): Map<string, SleepSession[]> {
  const map = new Map<string, SleepSession[]>();
  for (const s of sessions) {
    const day = calendarDayOf(s.start_at);
    if (!map.has(day)) map.set(day, []);
    map.get(day)!.push(s);
  }
  return map;
}

export function buildDaySummary(date: string, sessions: SleepSession[]): DaySummary {
  let napMinutes = 0;
  let nightMinutes = 0;
  let napCount = 0;
  let nightWakingCount = 0;

  for (const s of sessions) {
    const dur = sessionDurationMinutes(s);
    if (s.type === 'nap') {
      napMinutes += dur;
      napCount++;
    } else {
      nightMinutes += dur;
      nightWakingCount += (s.night_wakings ?? []).length;
    }
  }

  return { date, napMinutes, nightMinutes, napCount, nightWakingCount, sessions };
}

// Average wake window over a set of sessions (consecutive pairs, < 6 hours gap)
export function averageWakeWindowMinutes(sessions: SleepSession[]): number | null {
  const completed = sessions
    .filter((s) => s.end_at)
    .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime());

  const gaps: number[] = [];
  for (let i = 0; i < completed.length - 1; i++) {
    const earlier = completed[i];
    const later = completed[i + 1];
    if (!earlier.end_at) continue;
    const gapMins = minutesBetween(earlier.end_at, later.start_at);
    if (gapMins > 0 && gapMins < MAX_VALID_WAKE_WINDOW_HOURS * 60) {
      gaps.push(gapMins);
    }
  }

  if (gaps.length === 0) return null;
  return Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length);
}
