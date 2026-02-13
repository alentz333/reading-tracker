-- Gamification System Migration
-- Run this in Supabase SQL Editor

-- ============================================
-- 1. Add XP and Level columns to users table
-- ============================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS xp integer DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS level integer DEFAULT 1;
ALTER TABLE users ADD COLUMN IF NOT EXISTS current_streak integer DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS longest_streak integer DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_active_date date;
ALTER TABLE users ADD COLUMN IF NOT EXISTS streak_freezes integer DEFAULT 0;

-- ============================================
-- 2. XP Events table (history of XP earned)
-- ============================================

CREATE TABLE IF NOT EXISTS xp_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  amount integer NOT NULL,
  reason text NOT NULL, -- 'book_finished', 'review_written', 'quest_completed', etc.
  reference_id uuid, -- book_id, quest_id, achievement_id, etc.
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS xp_events_user_created_idx ON xp_events(user_id, created_at DESC);

-- RLS for xp_events
ALTER TABLE xp_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own xp events"
  ON xp_events FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own xp events"
  ON xp_events FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ============================================
-- 3. Achievements table
-- ============================================

CREATE TABLE IF NOT EXISTS achievements (
  id text PRIMARY KEY, -- 'first_book', 'streak_7', etc.
  name text NOT NULL,
  description text,
  icon text, -- emoji
  xp_reward integer DEFAULT 25,
  category text CHECK (category IN ('milestone', 'streak', 'genre', 'engagement', 'special')),
  requirement jsonb NOT NULL, -- { "books_read": 5 } or { "streak": 7 }
  sort_order integer DEFAULT 0
);

-- User achievements (unlocked)
CREATE TABLE IF NOT EXISTS user_achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  achievement_id text REFERENCES achievements(id) NOT NULL,
  unlocked_at timestamptz DEFAULT now(),
  UNIQUE(user_id, achievement_id)
);

CREATE INDEX IF NOT EXISTS user_achievements_user_idx ON user_achievements(user_id);

-- RLS for achievements
ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view achievements"
  ON achievements FOR SELECT
  USING (true);

CREATE POLICY "Users can view own unlocked achievements"
  ON user_achievements FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can unlock achievements"
  ON user_achievements FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ============================================
-- 4. Reading Goals table
-- ============================================

CREATE TABLE IF NOT EXISTS reading_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  type text CHECK (type IN ('yearly_books', 'monthly_books', 'daily_pages', 'daily_minutes')) NOT NULL,
  target integer NOT NULL,
  year integer, -- for yearly goals
  month integer, -- for monthly goals  
  progress integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, type, year, month)
);

CREATE INDEX IF NOT EXISTS reading_goals_user_idx ON reading_goals(user_id);

-- RLS for reading_goals
ALTER TABLE reading_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own goals"
  ON reading_goals FOR ALL
  USING (auth.uid() = user_id);

-- ============================================
-- 5. Quests table
-- ============================================

CREATE TABLE IF NOT EXISTS quests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  type text CHECK (type IN ('daily', 'weekly', 'monthly', 'event')) NOT NULL,
  xp_reward integer NOT NULL,
  requirement jsonb NOT NULL, -- { "action": "finish_book", "count": 1 }
  active_from timestamptz,
  active_until timestamptz,
  is_active boolean DEFAULT true
);

-- User quest progress
CREATE TABLE IF NOT EXISTS user_quests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  quest_id uuid REFERENCES quests(id) NOT NULL,
  progress integer DEFAULT 0,
  completed boolean DEFAULT false,
  completed_at timestamptz,
  assigned_at timestamptz DEFAULT now(),
  expires_at timestamptz
);

CREATE INDEX IF NOT EXISTS user_quests_user_idx ON user_quests(user_id, completed);

-- RLS for quests
ALTER TABLE quests ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_quests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active quests"
  ON quests FOR SELECT
  USING (is_active = true);

CREATE POLICY "Users can manage own quest progress"
  ON user_quests FOR ALL
  USING (auth.uid() = user_id);

-- ============================================
-- 6. Seed initial achievements
-- ============================================

INSERT INTO achievements (id, name, description, icon, xp_reward, category, requirement, sort_order) VALUES
-- Reading Milestones
('first_book', 'First Steps', 'Finish your first book', '📖', 50, 'milestone', '{"books_read": 1}', 1),
('books_5', 'Page Turner', 'Finish 5 books', '📚', 75, 'milestone', '{"books_read": 5}', 2),
('books_10', 'Bookworm', 'Finish 10 books', '🐛', 100, 'milestone', '{"books_read": 10}', 3),
('books_25', 'Bibliophile', 'Finish 25 books', '🦋', 150, 'milestone', '{"books_read": 25}', 4),
('books_50', 'Library Legend', 'Finish 50 books', '🏛️', 250, 'milestone', '{"books_read": 50}', 5),
('books_100', 'Century Club', 'Finish 100 books', '💯', 500, 'milestone', '{"books_read": 100}', 6),

-- Streak Achievements
('streak_3', 'Getting Started', '3-day reading streak', '🌱', 25, 'streak', '{"streak": 3}', 10),
('streak_7', 'Habit Forming', '7-day reading streak', '🌿', 50, 'streak', '{"streak": 7}', 11),
('streak_30', 'Dedicated Reader', '30-day reading streak', '🌳', 150, 'streak', '{"streak": 30}', 12),
('streak_100', 'Unstoppable', '100-day reading streak', '🔥', 300, 'streak', '{"streak": 100}', 13),
('streak_365', 'Year of Reading', '365-day reading streak', '⭐', 1000, 'streak', '{"streak": 365}', 14),

-- Engagement Achievements  
('first_review', 'Critic', 'Write your first review', '✍️', 25, 'engagement', '{"reviews": 1}', 20),
('reviews_10', 'Prolific Reviewer', 'Write 10 reviews', '📝', 100, 'engagement', '{"reviews": 10}', 21),
('first_club', 'Social Reader', 'Join a book club', '👥', 50, 'engagement', '{"clubs_joined": 1}', 22),
('create_club', 'Club Founder', 'Create a book club', '🎪', 75, 'engagement', '{"clubs_created": 1}', 23),
('first_rating', 'Rater', 'Rate your first book', '⭐', 10, 'engagement', '{"ratings": 1}', 24),

-- Special Achievements
('speed_reader', 'Speed Reader', 'Finish a book in under 3 days', '⚡', 75, 'special', '{"days_to_finish": 3}', 30),
('marathon', 'Marathon Reader', 'Finish a 500+ page book', '🏃', 100, 'special', '{"pages": 500}', 31),
('early_bird', 'Early Bird', 'Log reading before 7 AM', '🌅', 25, 'special', '{"early_reading": true}', 32),
('night_owl', 'Night Owl', 'Log reading after midnight', '🦉', 25, 'special', '{"late_reading": true}', 33)

ON CONFLICT (id) DO NOTHING;

-- ============================================
-- 7. Seed initial quests
-- ============================================

INSERT INTO quests (id, name, description, type, xp_reward, requirement, is_active) VALUES
-- Daily Quests
('d1e5f6a7-0001-4000-8000-000000000001', 'Daily Reader', 'Log any reading activity today', 'daily', 15, '{"action": "log_reading", "count": 1}', true),
('d1e5f6a7-0002-4000-8000-000000000002', 'Progress Check', 'Update your reading progress', 'daily', 10, '{"action": "update_progress", "count": 1}', true),

-- Weekly Quests  
('d1e5f6a7-0003-4000-8000-000000000003', 'Weekly Finish', 'Finish a book this week', 'weekly', 75, '{"action": "finish_book", "count": 1}', true),
('d1e5f6a7-0004-4000-8000-000000000004', 'Century Pages', 'Read 100 pages this week', 'weekly', 50, '{"action": "pages_read", "count": 100}', true),
('d1e5f6a7-0005-4000-8000-000000000005', 'Share Your Thoughts', 'Write a review this week', 'weekly', 50, '{"action": "write_review", "count": 1}', true),

-- Monthly Quests
('d1e5f6a7-0006-4000-8000-000000000006', 'Monthly Marathon', 'Finish 3 books this month', 'monthly', 200, '{"action": "finish_book", "count": 3}', true),
('d1e5f6a7-0007-4000-8000-000000000007', 'Genre Explorer', 'Read a book in a new genre', 'monthly', 100, '{"action": "new_genre", "count": 1}', true)

ON CONFLICT (id) DO NOTHING;

-- ============================================
-- 8. Function to calculate level from XP
-- ============================================

CREATE OR REPLACE FUNCTION calculate_level(xp_amount integer)
RETURNS integer AS $$
DECLARE
  lvl integer := 1;
  xp_required integer := 0;
  xp_per_level integer[] := ARRAY[0, 100, 300, 600, 1000, 1500, 2100, 2800, 3600, 4500];
BEGIN
  -- Levels 1-10 have fixed XP requirements
  FOR i IN 1..10 LOOP
    IF xp_amount >= xp_per_level[i] THEN
      lvl := i;
    END IF;
  END LOOP;
  
  -- Levels 11+ require 1000 XP each
  IF xp_amount >= 4500 THEN
    lvl := 10 + ((xp_amount - 4500) / 1000);
  END IF;
  
  RETURN lvl;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================
-- 9. Function to award XP and update level
-- ============================================

CREATE OR REPLACE FUNCTION award_xp(
  p_user_id uuid,
  p_amount integer,
  p_reason text,
  p_reference_id uuid DEFAULT NULL
)
RETURNS TABLE(new_xp integer, new_level integer, leveled_up boolean) AS $$
DECLARE
  old_level integer;
  updated_xp integer;
  updated_level integer;
BEGIN
  -- Get current level
  SELECT level INTO old_level FROM users WHERE id = p_user_id;
  
  -- Update XP and recalculate level
  UPDATE users 
  SET 
    xp = xp + p_amount,
    level = calculate_level(xp + p_amount)
  WHERE id = p_user_id
  RETURNING xp, level INTO updated_xp, updated_level;
  
  -- Log the XP event
  INSERT INTO xp_events (user_id, amount, reason, reference_id)
  VALUES (p_user_id, p_amount, p_reason, p_reference_id);
  
  RETURN QUERY SELECT updated_xp, updated_level, (updated_level > old_level);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
