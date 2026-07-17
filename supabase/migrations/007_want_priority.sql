-- Manual ordering of the Want to Read list.
-- Lower number = higher priority; NULL = never manually ordered.
ALTER TABLE user_books ADD COLUMN IF NOT EXISTS priority integer;

CREATE INDEX IF NOT EXISTS idx_user_books_priority
  ON user_books(user_id, priority);
