-- Baby Sleep Tracker - Initial Schema
-- Run this in Supabase SQL editor after creating your project

-- baby table: stores the single baby being tracked
CREATE TABLE IF NOT EXISTS baby (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text        NOT NULL,
  dob         date        NOT NULL,
  created_at  timestamptz DEFAULT now()
);

-- sleep_session table: naps and night sleep sessions
CREATE TABLE IF NOT EXISTS sleep_session (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  baby_id    uuid        NOT NULL REFERENCES baby(id) ON DELETE CASCADE,
  type       text        NOT NULL CHECK (type IN ('nap', 'night')),
  start_at   timestamptz NOT NULL,
  end_at     timestamptz,
  notes      text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sleep_session_baby_start
  ON sleep_session (baby_id, start_at DESC);

-- Prevent more than one open session per baby
CREATE UNIQUE INDEX IF NOT EXISTS one_open_session_per_baby
  ON sleep_session (baby_id)
  WHERE end_at IS NULL;

-- night_waking table: wakings within a night session
CREATE TABLE IF NOT EXISTS night_waking (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id     uuid        NOT NULL REFERENCES sleep_session(id) ON DELETE CASCADE,
  woke_at        timestamptz NOT NULL,
  back_asleep_at timestamptz,
  created_at     timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_night_waking_session
  ON night_waking (session_id, woke_at);

-- wake_window_reference table: age-appropriate wake window ranges
CREATE TABLE IF NOT EXISTS wake_window_reference (
  id                   serial  PRIMARY KEY,
  age_weeks_min        int     NOT NULL,
  age_weeks_max        int     NOT NULL,
  window_min_minutes   int     NOT NULL,
  window_max_minutes   int     NOT NULL,
  typical_naps_per_day int     NOT NULL,
  source               text
);

-- Seed wake window reference data
INSERT INTO wake_window_reference
  (age_weeks_min, age_weeks_max, window_min_minutes, window_max_minutes, typical_naps_per_day, source)
VALUES
  (0,   4,   45,  60,  6, 'Huckleberry; Taking Cara Babies'),
  (5,   8,   60,  90,  5, 'Huckleberry; Taking Cara Babies'),
  (9,   12,  75,  105, 4, 'Huckleberry; Taking Cara Babies'),
  (13,  16,  90,  120, 4, 'Huckleberry; Taking Cara Babies'),
  (17,  21,  105, 135, 3, 'Huckleberry; Taking Cara Babies'),
  (22,  30,  135, 165, 3, 'Huckleberry; Taking Cara Babies'),
  (31,  43,  150, 210, 2, 'Huckleberry; Taking Cara Babies'),
  (44,  78,  180, 240, 2, 'Huckleberry; Taking Cara Babies'),
  (79,  156, 300, 360, 1, 'Huckleberry; Taking Cara Babies')
ON CONFLICT DO NOTHING;

-- Enable Row Level Security on all tables
ALTER TABLE baby ENABLE ROW LEVEL SECURITY;
ALTER TABLE sleep_session ENABLE ROW LEVEL SECURITY;
ALTER TABLE night_waking ENABLE ROW LEVEL SECURITY;
ALTER TABLE wake_window_reference ENABLE ROW LEVEL SECURITY;

-- RLS policies: authenticated users have full access
-- (safe because there is exactly one shared account in v1)
CREATE POLICY "authenticated full access" ON baby
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "authenticated full access" ON sleep_session
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "authenticated full access" ON night_waking
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- wake_window_reference is read-only for authenticated users
CREATE POLICY "authenticated read access" ON wake_window_reference
  FOR SELECT TO authenticated USING (true);
