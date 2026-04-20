'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { BEDTIME_CUTOFF_HOUR, MORNING_CUTOFF_HOUR } from '@/lib/config';
import { currentHour } from '@/lib/dateUtils';
import type { SleepSession, NightWaking } from '@/lib/sleepLogic';

interface PrimaryActionButtonProps {
  babyId: string;
  openSession: SleepSession | null;
  activeWaking: NightWaking | null;
  onUpdate: () => void;
}

export function PrimaryActionButton({
  babyId,
  openSession,
  activeWaking,
  onUpdate,
}: PrimaryActionButtonProps) {
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleAction(action: 'primary' | 'morning_wake') {
    setSaving(true);
    setErrorMsg(null);
    const supabase = createClient();

    try {
      if (!openSession) {
        // Start new session
        const hour = currentHour();
        const type = hour >= BEDTIME_CUTOFF_HOUR ? 'night' : 'nap';
        const { error } = await supabase.from('sleep_session').insert({
          baby_id: babyId,
          type,
          start_at: new Date().toISOString(),
        });
        if (error) throw error;

      } else if (openSession.type === 'nap') {
        // End nap
        const { error } = await supabase
          .from('sleep_session')
          .update({ end_at: new Date().toISOString() })
          .eq('id', openSession.id);
        if (error) throw error;

      } else if (openSession.type === 'night') {
        if (!activeWaking) {
          // Log night waking
          const { error } = await supabase.from('night_waking').insert({
            session_id: openSession.id,
            woke_at: new Date().toISOString(),
          });
          if (error) throw error;
        } else if (action === 'morning_wake') {
          // Close active waking + close night session
          const now = new Date().toISOString();
          const { error: wakingError } = await supabase
            .from('night_waking')
            .update({ back_asleep_at: now })
            .eq('id', activeWaking.id);
          if (wakingError) throw wakingError;
          const { error: sessionError } = await supabase
            .from('sleep_session')
            .update({ end_at: now })
            .eq('id', openSession.id);
          if (sessionError) throw sessionError;
        } else {
          // Back asleep from waking
          const { error } = await supabase
            .from('night_waking')
            .update({ back_asleep_at: new Date().toISOString() })
            .eq('id', activeWaking.id);
          if (error) throw error;
        }
      }

      onUpdate();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save';
      console.error('PrimaryActionButton:', err);
      setErrorMsg(msg);
    } finally {
      setSaving(false);
    }
  }

  const { label: primaryLabel, showMorningWake } = getButtonState(
    openSession,
    activeWaking
  );

  return (
    <div className="space-y-2">
      {errorMsg && (
        <button
          onClick={() => handleAction('primary')}
          className="w-full text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl py-2 px-4"
        >
          {errorMsg} — Tap to retry
        </button>
      )}

      <button
        onClick={() => handleAction('primary')}
        disabled={saving}
        className="w-full py-5 rounded-2xl text-white text-xl font-bold bg-indigo-600 active:bg-indigo-700 disabled:opacity-60 transition-colors shadow-md shadow-indigo-200"
      >
        {saving ? '…' : primaryLabel}
      </button>

      {showMorningWake && (
        <button
          onClick={() => handleAction('morning_wake')}
          disabled={saving}
          className="w-full py-4 rounded-2xl text-indigo-700 text-lg font-semibold bg-indigo-50 active:bg-indigo-100 disabled:opacity-60 transition-colors border border-indigo-200"
        >
          {saving ? '…' : 'Morning wake'}
        </button>
      )}
    </div>
  );
}

function getButtonState(
  openSession: SleepSession | null,
  activeWaking: NightWaking | null
): { label: string; showMorningWake: boolean } {
  const hour = currentHour();

  if (!openSession) {
    return {
      label: hour >= BEDTIME_CUTOFF_HOUR ? 'Down for night' : 'Down for nap',
      showMorningWake: false,
    };
  }

  if (openSession.type === 'nap') {
    return { label: 'Awake from nap', showMorningWake: false };
  }

  // Night session
  if (!activeWaking) {
    return { label: 'Night waking', showMorningWake: false };
  }

  // Active waking
  const isMorning = hour >= MORNING_CUTOFF_HOUR && hour < BEDTIME_CUTOFF_HOUR;
  return { label: 'Back asleep', showMorningWake: isMorning };
}
