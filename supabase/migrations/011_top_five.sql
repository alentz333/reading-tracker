-- "Top 5" recommended books: readers flag up to five finished books to
-- showcase on their profile (the five-book cap is enforced in the app).
ALTER TABLE user_books ADD COLUMN IF NOT EXISTS is_top_five boolean NOT NULL DEFAULT false;
