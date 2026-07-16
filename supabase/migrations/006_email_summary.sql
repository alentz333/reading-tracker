-- Per-book opt-in: email the reader a summary when they mark the book as read.
-- Applied to the live project on 2026-07-16 via the Supabase MCP.

alter table public.user_books
  add column if not exists email_summary_on_finish boolean not null default false;
