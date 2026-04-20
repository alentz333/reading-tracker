'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { SleepSession, NightWaking } from '@/lib/sleepLogic';

interface OpenSessionState {
  session: SleepSession | null;
  activeWaking: NightWaking | null;
  loading: boolean;
  error: string | null;
}

export function useOpenSession(babyId: string | null) {
  const [state, setState] = useState<OpenSessionState>({
    session: null,
    activeWaking: null,
    loading: true,
    error: null,
  });

  const refresh = useCallback(async () => {
    if (!babyId) {
      setState({ session: null, activeWaking: null, loading: false, error: null });
      return;
    }

    const supabase = createClient();
    const { data: sessions, error } = await supabase
      .from('sleep_session')
      .select('*, night_wakings:night_waking(*)')
      .eq('baby_id', babyId)
      .is('end_at', null)
      .limit(1);

    if (error) {
      console.error('useOpenSession:', error);
      setState((prev) => ({ ...prev, loading: false, error: error.message }));
      return;
    }

    const session = sessions?.[0] ?? null;
    let activeWaking: NightWaking | null = null;

    if (session?.type === 'night') {
      const wakings: NightWaking[] = (session as SleepSession & { night_wakings: NightWaking[] }).night_wakings ?? [];
      activeWaking = wakings.find((w) => !w.back_asleep_at) ?? null;
    }

    setState({ session: session as SleepSession | null, activeWaking, loading: false, error: null });
  }, [babyId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { ...state, refresh };
}
