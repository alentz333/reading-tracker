'use client';

import { useEffect, useState, useCallback } from 'react';
import { format, subDays, startOfDay } from 'date-fns';
import { createClient } from '@/lib/supabase/client';
import { useCurrentBaby } from '@/hooks/useCurrentBaby';
import { useRealtimeSync } from '@/hooks/useRealtimeSync';
import { SessionRow } from '@/components/SessionRow';
import { TabBar } from '@/components/TabBar';
import { groupByDay, buildDaySummary, type SleepSession } from '@/lib/sleepLogic';
import { formatDuration, formatDateHeading, isTodayDate } from '@/lib/dateUtils';
import { useRouter } from 'next/navigation';

const INITIAL_DAYS = 14;
const LOAD_MORE_DAYS = 14;

export default function LogPage() {
  const router = useRouter();
  const { baby, loading: babyLoading } = useCurrentBaby();
  const [sessions, setSessions] = useState<SleepSession[]>([]);
  const [daysBack, setDaysBack] = useState(INITIAL_DAYS);
  const [loading, setLoading] = useState(true);

  const fetchSessions = useCallback(async (babyId: string, days: number) => {
    setLoading(true);
    const supabase = createClient();
    const rangeStart = subDays(startOfDay(new Date()), days - 1).toISOString();
    const { data } = await supabase
      .from('sleep_session')
      .select('*, night_wakings:night_waking(*)')
      .eq('baby_id', babyId)
      .gte('start_at', rangeStart)
      .order('start_at', { ascending: false });
    setSessions((data ?? []) as SleepSession[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (baby) fetchSessions(baby.id, daysBack);
  }, [baby, daysBack, fetchSessions]);

  const handleUpdate = useCallback(() => {
    if (baby) fetchSessions(baby.id, daysBack);
  }, [baby, daysBack, fetchSessions]);

  useRealtimeSync(handleUpdate);

  // Auth guard
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) router.replace('/login');
    });
  }, [router]);

  const byDay = groupByDay(sessions);
  const sortedDays = Array.from(byDay.keys()).sort((a, b) => b.localeCompare(a));

  return (
    <div className="min-h-screen pb-24 md:pb-0">
      <TabBar />

      <main className="max-w-lg mx-auto px-4 pt-6 md:pt-10">
        <h1 className="text-xl font-bold text-slate-900 mb-4">Sleep Log</h1>

        {babyLoading || loading ? (
          <div className="py-12 text-center text-slate-400">Loading…</div>
        ) : sessions.length === 0 ? (
          <div className="py-12 text-center space-y-2">
            <div className="text-4xl">🌙</div>
            <p className="text-slate-500">No sleep logged in the last {daysBack} days.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {sortedDays.map((day) => {
              const daySessions = byDay.get(day)!;
              const summary = buildDaySummary(day, daySessions);
              const dayDate = new Date(day + 'T00:00:00');
              const isToday = isTodayDate(dayDate);

              return (
                <section key={day} className="space-y-2">
                  {/* Day heading */}
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-slate-700">
                      {isToday ? 'Today' : formatDateHeading(dayDate)}
                    </h2>
                    <div className="flex gap-3 text-xs text-slate-400">
                      {summary.napMinutes > 0 && (
                        <span>☀️ {formatDuration(summary.napMinutes)}</span>
                      )}
                      {summary.nightMinutes > 0 && (
                        <span>🌙 {formatDuration(summary.nightMinutes)}</span>
                      )}
                    </div>
                  </div>

                  {/* Sessions */}
                  {daySessions.map((s) => (
                    <SessionRow key={s.id} session={s} />
                  ))}
                </section>
              );
            })}

            <button
              onClick={() => setDaysBack((d) => d + LOAD_MORE_DAYS)}
              className="w-full py-3 text-sm text-slate-500 hover:text-slate-700 border border-slate-200 rounded-xl transition-colors"
            >
              Load more
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
