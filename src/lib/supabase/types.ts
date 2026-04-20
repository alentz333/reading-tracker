// Baby Sleep Tracker — Supabase schema types

export interface Database {
  public: {
    Tables: {
      baby: {
        Row: {
          id: string;
          name: string;
          dob: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          dob: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          dob?: string;
          created_at?: string;
        };
      };
      sleep_session: {
        Row: {
          id: string;
          baby_id: string;
          type: 'nap' | 'night';
          start_at: string;
          end_at: string | null;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          baby_id: string;
          type: 'nap' | 'night';
          start_at: string;
          end_at?: string | null;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          baby_id?: string;
          type?: 'nap' | 'night';
          start_at?: string;
          end_at?: string | null;
          notes?: string | null;
          created_at?: string;
        };
      };
      night_waking: {
        Row: {
          id: string;
          session_id: string;
          woke_at: string;
          back_asleep_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          session_id: string;
          woke_at: string;
          back_asleep_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          session_id?: string;
          woke_at?: string;
          back_asleep_at?: string | null;
          created_at?: string;
        };
      };
      wake_window_reference: {
        Row: {
          id: number;
          age_weeks_min: number;
          age_weeks_max: number;
          window_min_minutes: number;
          window_max_minutes: number;
          typical_naps_per_day: number;
          source: string | null;
        };
        Insert: {
          id?: number;
          age_weeks_min: number;
          age_weeks_max: number;
          window_min_minutes: number;
          window_max_minutes: number;
          typical_naps_per_day: number;
          source?: string | null;
        };
        Update: {
          id?: number;
          age_weeks_min?: number;
          age_weeks_max?: number;
          window_min_minutes?: number;
          window_max_minutes?: number;
          typical_naps_per_day?: number;
          source?: string | null;
        };
      };
    };
  };
}
