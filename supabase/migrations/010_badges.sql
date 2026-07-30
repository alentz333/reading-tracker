-- Badges: rebrands achievements as profile badges (same tables) and adds
-- genre + audiobook badge definitions.

-- 1) Badges are public: anyone can see what a reader has earned on their profile
DROP POLICY IF EXISTS "Anyone can view unlocked achievements" ON user_achievements;
CREATE POLICY "Anyone can view unlocked achievements"
  ON user_achievements FOR SELECT
  USING (true);

-- 2) Retire badge definitions that can no longer be earned (streaks and the
--    XP-log-based early/night badges) — except where someone already unlocked
--    them, so existing unlocks keep displaying
DELETE FROM achievements a
WHERE (a.category = 'streak' OR a.id IN ('early_bird', 'night_owl'))
  AND NOT EXISTS (SELECT 1 FROM user_achievements ua WHERE ua.achievement_id = a.id);

-- 3) Allow a 'format' badge category for audiobook badges
ALTER TABLE achievements DROP CONSTRAINT IF EXISTS achievements_category_check;
ALTER TABLE achievements ADD CONSTRAINT achievements_category_check
  CHECK (category IN ('milestone', 'streak', 'genre', 'engagement', 'special', 'format'));

-- 4) New genre + audiobook badges
INSERT INTO achievements (id, name, description, icon, category, requirement, sort_order) VALUES
('genre_scifi_5', 'Star Voyager', 'Read 5 science fiction books', '🚀', 'genre', '{"genre": "Science Fiction", "genre_count": 5}', 40),
('genre_fantasy_5', 'Realm Wanderer', 'Read 5 fantasy books', '🐉', 'genre', '{"genre": "Fantasy", "genre_count": 5}', 41),
('genre_mystery_5', 'Master Sleuth', 'Read 5 mystery books', '🔍', 'genre', '{"genre": "Mystery", "genre_count": 5}', 42),
('genre_romance_5', 'Hopeless Romantic', 'Read 5 romance books', '💘', 'genre', '{"genre": "Romance", "genre_count": 5}', 43),
('genre_horror_5', 'Fear Seeker', 'Read 5 horror books', '👻', 'genre', '{"genre": "Horror", "genre_count": 5}', 44),
('genre_nonfiction_5', 'Truth Seeker', 'Read 5 nonfiction books', '🧠', 'genre', '{"genre": "Nonfiction", "genre_count": 5}', 45),
('genre_explorer_5', 'Genre Explorer', 'Read books from 5 different genres', '🧭', 'genre', '{"distinct_genres": 5}', 46),
('first_audiobook', 'Plugged In', 'Finish your first audiobook', '🎧', 'format', '{"audiobooks": 1}', 50),
('audiobooks_10', 'Audiophile', 'Finish 10 audiobooks', '🔊', 'format', '{"audiobooks": 10}', 51),
('audiobooks_25', 'Sound Scholar', 'Finish 25 audiobooks', '🎙️', 'format', '{"audiobooks": 25}', 52)
ON CONFLICT (id) DO NOTHING;
