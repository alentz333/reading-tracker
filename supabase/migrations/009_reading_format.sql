-- Track how a book was consumed: print/ebook ('book') vs audiobook
ALTER TABLE user_books ADD COLUMN IF NOT EXISTS format text NOT NULL DEFAULT 'book'
  CHECK (format IN ('book', 'audiobook'));
