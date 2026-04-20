'use client';

import { useState, useEffect, useCallback } from 'react';
import { startOfDay, endOfDay, subDays } from 'date-fns';
import { createClient } from '@/lib/supabase/client';
import type { SleepSession } from '@/lib/sleepLogic';

export function useTodaySessions(babyId: string | null) {
  const [sessions, setSessions] = useState<SleepSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!babyId) {
      setSessions([]);
      setLoading(false);
      return;
    }

    const supabase = createClient();
    const dayStart = startOfDay(new Date()).toISOString();
    const dayEnd = endOfDay(new Date()).toISOString();

    const { data, error } = await supabase
      .from('sleep_session')
      .select('*, night_wakings:night_waking(*)')
      .eq('baby_id', babyId)
      .gte('start_at', dayStart)
      .lte('start_at', dayEnd)
      .order('start_at', { ascending: false });

    if (error) {
      console.error('useTodaySessions:', error);
      setError(error.message);
    } else {
      setSessions((data ?? []) as SleepSession[]);
    }
    setLoading(false);
  }, [babyId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { sessions, loading, error, refresh };
}

export function useSessionRange(babyId: string | null, daysBack: number) {
  const [sessions, setSessions] = useState<SleepSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!babyId) {
      setSessions([]);
      setLoading(false);
      return;
    }

    const supabase = createClient();
    const rangeStart = subDays(startOfDay(new Date()), daysBack - 1).toISOString();

    const { data, error } = await supabase
      .from('sleep_session')
      .select('*, night_wakings:night_waking(*)')
      .eq('baby_id', babyId)
      .gte('start_at', rangeStart)
      .order('start_at', { ascending: true });

    if (error) {
      console.error('useSessionRange:', error);
      setError(error.message);
    } else {
      setSessions((data ?? []) as SleepSession[]);
    }
    setLoading(false);
  }, [babyId, daysBack]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { sessions, loading, error, refresh };
}
