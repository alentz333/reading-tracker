'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Database } from '@/lib/supabase/types';

type Baby = Database['public']['Tables']['baby']['Row'];

export function useCurrentBaby() {
  const [baby, setBaby] = useState<Baby | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from('baby')
      .select('*')
      .limit(1)
      .single()
      .then(({ data, error }) => {
        if (error) {
          console.error('useCurrentBaby:', error);
          setError(error.message);
        } else {
          setBaby(data);
        }
        setLoading(false);
      });
  }, []);

  return { baby, loading, error };
}
