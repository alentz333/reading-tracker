'use client';

import { useMemo } from 'react';
import { format } from 'date-fns';
import { ageLabel, minutesSince, formatDurationLive, formatTime } from '@/lib/dateUtils';
import {
  lookupWakeWindow,
  wakeWindowColor,
  predictedNapWindow,
  type WakeWindowReference,
} from '@/lib/wakeWindows';
import { ageInWeeks } from '@/lib/dateUtils';
import type { SleepSession, NightWaking } from '@/lib/sleepLogic';

interface StatusCardProps {
  babyName: string;
  babyDob: string;
  openSession: SleepSession | null;
  activeWaking: NightWaking | null;
  lastCompletedSession: SleepSession | null;
  wakeWindows: WakeWindowReference[];
  tick: number; // increment every second to force re-renders
}

export function StatusCard({
  babyName,
  babyDob,
  openSession,
  activeWaking,
  lastCompletedSession,
  wakeWindows,
  tick,
}: StatusCardProps) {
  const weeks = ageInWeeks(babyDob);
  const currentWindow = lookupWakeWindow(weeks, wakeWindows);

  const stateInfo = useMemo(() => {
    if (!openSession) {
      if (!lastCompletedSession?.end_at) {
        return { text: 'No sleep logged yet', sub: null };
      }
      const elapsed = minutesSince(lastCompletedSession.end_at);
      const awakeFor = formatDurationLive(lastCompletedSession.end_at);
      return { text: `Awake for ${awakeFor}`, sub: currentWindow ? `Window: ${currentWindow.window_min_minutes}–${currentWindow.window_max_minutes} min` : null };
    }

    if (openSession.type === 'nap') {
      return { text: `Napping · ${formatDurationLive(openSession.start_at)}`, sub: null };
    }

    // Night session
    if (activeWaking) {
      return { text: `Night waking · ${formatDurationLive(activeWaking.woke_at)}`, sub: null };
    }
    return {
      text: `Sleeping · down at ${formatTime(openSession.start_at)}`,
      sub: null,
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openSession, activeWaking, lastCompletedSession, currentWindow, tick]);

  const colorBar = useMemo(() => {
    if (openSession || !lastCompletedSession?.end_at || !currentWindow) return null;
    const elapsed = minutesSince(lastCompletedSession.end_at);
    return wakeWindowColor(elapsed, currentWindow.window_min_minutes, currentWindow.window_max_minutes);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openSession, lastCompletedSession, currentWindow, tick]);

  const nextNap = useMemo(() => {
    if (openSession || !lastCompletedSession?.end_at || !currentWindow) return null;
    const { start, end } = predictedNapWindow(
      lastCompletedSession.end_at,
      currentWindow.window_min_minutes,
      currentWindow.window_max_minutes
    );
    return `${format(start, 'h:mma').toLowerCase()} – ${format(end, 'h:mma').toLowerCase()}`;
  }, [openSession, lastCompletedSession, currentWindow]);

  const colorClasses: Record<string, string> = {
    green: 'bg-green-400',
    amber: 'bg-amber-400',
    red: 'bg-red-500',
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 space-y-3">
      <div className="flex items-baseline gap-2">
        <span className="text-xl font-semibold text-slate-800">{babyName}</span>
        <span className="text-sm text-slate-400">{ageLabel(babyDob)}</span>
      </div>

      <p className="text-2xl font-bold text-slate-900">{stateInfo.text}</p>
      {stateInfo.sub && (
        <p className="text-sm text-slate-500">{stateInfo.sub}</p>
      )}

      {colorBar && (
        <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
          <div className={`h-full rounded-full transition-all ${colorClasses[colorBar]}`} style={{ width: '100%' }} />
        </div>
      )}

      {nextNap && (
        <p className="text-sm text-slate-500">
          Next nap: <span className="font-medium text-slate-700">{nextNap}</span>
        </p>
      )}
    </div>
  );
}
