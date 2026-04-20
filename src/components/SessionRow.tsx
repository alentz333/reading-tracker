'use client';

import { useState } from 'react';
import {
  formatTime,
  formatTimeRange,
  formatDuration,
  minutesBetween,
  minutesSince,
} from '@/lib/dateUtils';
import type { SleepSession, NightWaking } from '@/lib/sleepLogic';
import { sessionDurationMinutes } from '@/lib/sleepLogic';

interface SessionRowProps {
  session: SleepSession;
  compact?: boolean;
}

export function SessionRow({ session, compact = false }: SessionRowProps) {
  const [expanded, setExpanded] = useState(false);
  const isNight = session.type === 'night';
  const wakings: NightWaking[] = (session as SleepSession & { night_wakings?: NightWaking[] }).night_wakings ?? [];
  const durationMins = sessionDurationMinutes(session);

  return (
    <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
      <div
        className={`flex items-center gap-3 px-4 py-3 ${isNight && wakings.length > 0 ? 'cursor-pointer' : ''}`}
        onClick={() => isNight && wakings.length > 0 && setExpanded((e) => !e)}
      >
        {/* Icon */}
        <span className="text-xl flex-shrink-0" aria-hidden>
          {isNight ? '🌙' : '☀️'}
        </span>

        {/* Time range + duration */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-800 truncate">
            {formatTimeRange(session.start_at, session.end_at)}
          </p>
          {!compact && (
            <p className="text-xs text-slate-400 mt-0.5">
              {session.end_at
                ? formatDuration(durationMins)
                : `${formatDuration(durationMins)} so far`}
              {isNight && wakings.length > 0 && ` · ${wakings.length} waking${wakings.length > 1 ? 's' : ''}`}
            </p>
          )}
        </div>

        {/* Duration badge (compact mode) */}
        {compact && (
          <span className="text-xs text-slate-500 flex-shrink-0">
            {session.end_at ? formatDuration(durationMins) : `${formatDuration(durationMins)}+`}
          </span>
        )}

        {/* Expand chevron for night sessions with wakings */}
        {isNight && wakings.length > 0 && (
          <span className={`text-slate-400 transition-transform ${expanded ? 'rotate-180' : ''}`} aria-hidden>
            ▾
          </span>
        )}
      </div>

      {/* Expanded wakings list */}
      {isNight && expanded && wakings.length > 0 && (
        <div className="border-t border-slate-100 px-4 py-2 space-y-1 bg-slate-50">
          {wakings
            .sort((a, b) => new Date(a.woke_at).getTime() - new Date(b.woke_at).getTime())
            .map((w) => (
              <div key={w.id} className="flex items-center gap-2 text-xs text-slate-600 py-1">
                <span aria-hidden>😴</span>
                <span>
                  {formatTimeRange(w.woke_at, w.back_asleep_at)}
                  {w.back_asleep_at && (
                    <span className="text-slate-400 ml-1">
                      ({formatDuration(minutesBetween(w.woke_at, w.back_asleep_at))})
                    </span>
                  )}
                  {!w.back_asleep_at && <span className="text-amber-600 ml-1">active</span>}
                </span>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
