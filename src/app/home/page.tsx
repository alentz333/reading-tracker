'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useCurrentBaby } from '@/hooks/useCurrentBaby';
import { useOpenSession } from '@/hooks/useOpenSession';
import { useTodaySessions } from '@/hooks/useTodaySessions';
import { useRealtimeSync } from '@/hooks/useRealtimeSync';
import { StatusCard } from '@/components/StatusCard';
import { PrimaryActionButton } from '@/components/PrimaryActionButton';
import { SessionRow } from '@/components/SessionRow';
import { TabBar } from '@/components/TabBar';
import { setCachedWakeWindows, type WakeWindowReference } from '@/lib/wakeWindows';
import type { SleepSession } from '@/lib/sleepLogic';
import { useRouter } from 'next/navigation';

export default function HomePage() {
  const router = useRouter();
  const { baby, loading: babyLoading } = useCurrentBaby();
  const [wakeWindows, setWakeWindows] = useState<WakeWindowReference[]>([]);
  const [tick, setTick] = useState(0);

  const {
    session: openSession,
    activeWaking,
    refresh: refreshSession,
  } = useOpenSession(baby?.id ?? null);

  const {
    sessions: todaySessions,
    refresh: refreshToday,
  } = useTodaySessions(baby?.id ?? null);

  // Clock tick every 30s to refresh elapsed times
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  // Load wake window reference data once
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

  const handleUpdate = useCallback(() => {
    refreshSession();
    refreshToday();
  }, [refreshSession, refreshToday]);

  useRealtimeSync(handleUpdate);

  // Check auth on mount
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) router.replace('/login');
    });
  }, [router]);

  if (babyLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-slate-400">Loading…</div>
      </div>
    );
  }

  if (!baby) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center space-y-2">
          <div className="text-4xl">🌙</div>
          <p className="text-slate-600 font-medium">No baby profile found.</p>
          <p className="text-sm text-slate-400">Run the seed script to get started.</p>
        </div>
      </div>
    );
  }

  // Find the last completed session to power the wake window display
  const sortedSessions = [...todaySessions].sort(
    (a, b) => new Date(b.start_at).getTime() - new Date(a.start_at).getTime()
  );
  const lastCompleted: SleepSession | null =
    sortedSessions.find((s) => s.end_at !== null) ?? null;

  return (
    <div className="min-h-screen pb-24 md:pb-0">
      <TabBar />

      <main className="max-w-lg mx-auto px-4 pt-6 md:pt-10 space-y-4">
        <StatusCard
          babyName={baby.name}
          babyDob={baby.dob}
          openSession={openSession}
          activeWaking={activeWaking}
          lastCompletedSession={lastCompleted}
          wakeWindows={wakeWindows}
          tick={tick}
        />

        <PrimaryActionButton
          babyId={baby.id}
          openSession={openSession}
          activeWaking={activeWaking}
          onUpdate={handleUpdate}
        />

        {/* Today's log */}
        {todaySessions.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide px-1">
              Today
            </h2>
            {todaySessions.map((s) => (
              <SessionRow key={s.id} session={s} compact />
            ))}
          </section>
        )}

        {todaySessions.length === 0 && !openSession && (
          <p className="text-center text-sm text-slate-400 py-6">
            No sleep logged today. Tap the button above to start!
          </p>
        )}
      </main>
    </div>
  );
}
