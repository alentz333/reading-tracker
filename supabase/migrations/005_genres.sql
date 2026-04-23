-- Add genres array column to books table.
--
-- NOTE: Existing books will have genres = '{}' (empty array). Genres are
-- populated lazily when a book is added to a user's library via the Open
-- Library works API. No backfill is attempted here — handle empty genre
-- arrays gracefully in the UI (show nothing when genres is empty).

ALTER TABLE public.books
  ADD COLUMN IF NOT EXISTS genres text[] DEFAULT '{}';
