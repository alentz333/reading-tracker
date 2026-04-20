'use client';

import { useEffect, useState, useCallback } from 'react';
import { subDays, startOfDay } from 'date-fns';
import { createClient } from '@/lib/supabase/client';
import { useCurrentBaby } from '@/hooks/useCurrentBaby';
import { TabBar } from '@/components/TabBar';
import { DailySleepChart } from '@/components/charts/DailySleepChart';
import { NapsPerDayChart } from '@/components/charts/NapsPerDayChart';
import { LongestStretchChart } from '@/components/charts/LongestStretchChart';
import { NightWakingsChart } from '@/components/charts/NightWakingsChart';
import {
  groupByDay,
  buildDaySummary,
  averageWakeWindowMinutes,
  type SleepSession,
  type DaySummary,
} from '@/lib/sleepLogic';
import {
  lookupWakeWindow,
  setCachedWakeWindows,
  type WakeWindowReference,
} from '@/lib/wakeWindows';
import { ageInWeeks, formatDuration } from '@/lib/dateUtils';
import { ANALYSIS_MIN_DAYS_FOR_AVG } from '@/lib/config';
import { useRouter } from 'next/navigation';

const WINDOWS = [7, 14, 30] as const;
type WindowDays = (typeof WINDOWS)[number];

export default function AnalysisPage() {
  const router = useRouter();
  const { baby, loading: babyLoading } = useCurrentBaby();
  const [selectedWindow, setSelectedWindow] = useState<WindowDays>(14);
  const [sessions, setSessions] = useState<SleepSession[]>([]);
  const [wakeWindows, setWakeWindows] = useState<WakeWindowReference[]>([]);
  const [loading, setLoading] = useState(true);

  // Auth guard
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) router.replace('/login');
    });
  }, [router]);

  // Load wake window reference
  useEffect(() => {
    const supabase = createClient();
    supabase
      .from('wake_window_reference')
      .select('*')
      .order('age_weeks_min')
      .then(({ data }) => {
        if (data) {
          setCachedWakeWindows(data as WakeWindowReference[]);
          setWakeWindows(data as WakeWindowReference[]);
        }
      });
  }, []);

  const fetchSessions = useCallback(async (babyId: string, days: number) => {
    setLoading(true);
    const supabase = createClient();
    const rangeStart = subDays(startOfDay(new Date()), days - 1).toISOString();
    const { data } = await supabase
      .from('sleep_session')
      .select('*, night_wakings:night_waking(*)')
      .eq('baby_id', babyId)
      .gte('start_at', rangeStart)
      .order('start_at', { ascending: true });
    setSessions((data ?? []) as SleepSession[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (baby) fetchSessions(baby.id, selectedWindow);
  }, [baby, selectedWindow, fetchSessions]);

  const byDay = groupByDay(sessions);
  const daySummaries: DaySummary[] = Array.from(byDay.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, s]) => buildDaySummary(date, s));

  const avgWake = averageWakeWindowMinutes(sessions);
  const referenceWindow = baby ? lookupWakeWindow(ageInWeeks(baby.dob), wakeWindows) : null;

  const hasEnoughData = sessions.length > 0;

  return (
    <div className="min-h-screen pb-24 md:pb-0">
      <TabBar />

      <main className="max-w-lg mx-auto px-4 pt-6 md:pt-10 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-slate-900">Analysis</h1>

          {/* Window selector */}
          <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
            {WINDOWS.map((w) => (
              <button
                key={w}
                onClick={() => setSelectedWindow(w)}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                  selectedWindow === w
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {w}d
              </button>
            ))}
          </div>
        </div>

        {babyLoading || loading ? (
          <div className="py-12 text-center text-slate-400">Loading…</div>
        ) : !hasEnoughData ? (
          <div className="py-12 text-center space-y-2">
            <div className="text-4xl">📊</div>
            <p className="text-slate-500">No sleep data in the last {selectedWindow} days.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Total sleep per day */}
            <ChartCard title="Total sleep per day" subtitle="Day + night stacked">
              <DailySleepChart data={daySummaries} />
            </ChartCard>

            {/* Average wake window */}
            <div className="bg-white rounded-2xl border border-slate-100 p-4 space-y-1">
              <p className="text-sm font-semibold text-slate-700">Average wake window</p>
              {avgWake !== null && sessions.length >= ANALYSIS_MIN_DAYS_FOR_AVG ? (
                <div className="flex items-baseline gap-3">
                  <span className="text-3xl font-bold text-indigo-600">
                    {formatDuration(avgWake)}
                  </span>
                  {referenceWindow && (
                    <span className="text-sm text-slate-400">
                      typical {referenceWindow.window_min_minutes}–{referenceWindow.window_max_minutes} min
                    </span>
                  )}
                </div>
              ) : (
                <p className="text-sm text-slate-400">
                  Collecting data — check back after 2 weeks.
                </p>
              )}
            </div>

            {/* Naps per day */}
            <ChartCard title="Naps per day">
              <NapsPerDayChart data={daySummaries} />
            </ChartCard>

            {/* Longest night stretch */}
            <ChartCard title="Longest night stretch">
              <LongestStretchChart sessions={sessions} />
            </ChartCard>

            {/* Night wakings */}
            <ChartCard title="Night wakings per night">
              <NightWakingsChart data={daySummaries} />
            </ChartCard>
          </div>
        )}

        {/* Settings / logout */}
        <div className="pt-4 border-t border-slate-200">
          <LogoutButton />
        </div>
      </main>
    </div>
  );
}

function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-4 space-y-3">
      <div>
        <p className="text-sm font-semibold text-slate-700">{title}</p>
        {subtitle && <p className="text-xs text-slate-400">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace('/login');
  }

  return (
    <button
      onClick={handleLogout}
      disabled={loading}
      className="w-full py-3 text-sm text-slate-500 hover:text-slate-700 disabled:opacity-60 transition-colors"
    >
      {loading ? 'Signing out…' : 'Sign out'}
    </button>
  );
}
