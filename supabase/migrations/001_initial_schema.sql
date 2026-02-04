-- Reading Tracker Initial Schema
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New Query)

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================
-- USERS (extends Supabase auth.users)
-- ============================================
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  display_name text,
  avatar_url text,
  bio text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================
-- BOOKS (Master catalog)
-- ============================================
create table public.books (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  author text,
  isbn text,
  cover_url text,
  description text,
  page_count integer,
  published_date text,
  ol_key text,
  google_books_id text,
  created_at timestamptz default now()
);

create unique index books_isbn_idx on public.books(isbn) where isbn is not null;
create index books_title_idx on public.books(title);

-- ============================================
-- USER_BOOKS (Personal library)
-- ============================================
create table public.user_books (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  book_id uuid references public.books(id) on delete cascade not null,
  
  status text check (status in ('want_to_read', 'reading', 'read', 'dnf')) default 'want_to_read',
  current_page integer,
  started_at date,
  finished_at date,
  rating integer check (rating >= 1 and rating <= 5),
  review text,
  notes text,
  is_favorite boolean default false,
  is_public boolean default true,
  
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  
  unique(user_id, book_id)
);

create index user_books_user_idx on public.user_books(user_id);
create index user_books_status_idx on public.user_books(user_id, status);

-- ============================================
-- CLUBS
-- ============================================
create table public.clubs (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  description text,
  cover_url text,
  created_by uuid references public.profiles(id),
  is_public boolean default true,
  join_code text unique,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================
-- CLUB_MEMBERS
-- ============================================
create table public.club_members (
  id uuid primary key default uuid_generate_v4(),
  club_id uuid references public.clubs(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  role text check (role in ('owner', 'admin', 'member')) default 'member',
  joined_at timestamptz default now(),
  
  unique(club_id, user_id)
);

create index club_members_club_idx on public.club_members(club_id);
create index club_members_user_idx on public.club_members(user_id);

-- ============================================
-- CLUB_BOOKS
-- ============================================
create table public.club_books (
  id uuid primary key default uuid_generate_v4(),
  club_id uuid references public.clubs(id) on delete cascade not null,
  book_id uuid references public.books(id) on delete cascade not null,
  status text check (status in ('upcoming', 'current', 'finished')) default 'upcoming',
  start_date date,
  target_finish_date date,
  discussion_notes text,
  added_by uuid references public.profiles(id),
  created_at timestamptz default now(),
  
  unique(club_id, book_id)
);

-- ============================================
-- ACTIVITIES (Feed)
-- ============================================
create table public.activities (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  action text not null,
  book_id uuid references public.books(id) on delete cascade,
  club_id uuid references public.clubs(id) on delete cascade,
  metadata jsonb,
  created_at timestamptz default now()
);

create index activities_user_created_idx on public.activities(user_id, created_at desc);
create index activities_created_idx on public.activities(created_at desc);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

-- Enable RLS on all tables
alter table public.profiles enable row level security;
alter table public.books enable row level security;
alter table public.user_books enable row level security;
alter table public.clubs enable row level security;
alter table public.club_members enable row level security;
alter table public.club_books enable row level security;
alter table public.activities enable row level security;

-- Profiles: viewable by all, editable by owner
create policy "Profiles are viewable by everyone" on public.profiles
  for select using (true);
create policy "Users can update own profile" on public.profiles
  for update using (auth.uid() = id);

-- Books: viewable by all, insertable by authenticated
create policy "Books are viewable by everyone" on public.books
  for select using (true);
create policy "Authenticated users can insert books" on public.books
  for insert with check (auth.role() = 'authenticated');

-- User Books: own books or public books
create policy "Users can view own books" on public.user_books
  for select using (auth.uid() = user_id);
create policy "Users can view public books" on public.user_books
  for select using (is_public = true);
create policy "Users can insert own books" on public.user_books
  for insert with check (auth.uid() = user_id);
create policy "Users can update own books" on public.user_books
  for update using (auth.uid() = user_id);
create policy "Users can delete own books" on public.user_books
  for delete using (auth.uid() = user_id);

-- Clubs: public clubs visible to all, private to members
create policy "Public clubs are viewable" on public.clubs
  for select using (is_public = true);
create policy "Members can view private clubs" on public.clubs
  for select using (
    exists (select 1 from public.club_members where club_id = id and user_id = auth.uid())
  );
create policy "Authenticated users can create clubs" on public.clubs
  for insert with check (auth.role() = 'authenticated');
create policy "Owners can update clubs" on public.clubs
  for update using (created_by = auth.uid());

-- Club Members: viewable if in club
create policy "Club members are viewable by members" on public.club_members
  for select using (
    exists (select 1 from public.club_members cm where cm.club_id = club_id and cm.user_id = auth.uid())
  );
create policy "Users can join clubs" on public.club_members
  for insert with check (auth.uid() = user_id);
create policy "Users can leave clubs" on public.club_members
  for delete using (auth.uid() = user_id);

-- Club Books: viewable by club members
create policy "Club books viewable by members" on public.club_books
  for select using (
    exists (select 1 from public.club_members where club_id = club_books.club_id and user_id = auth.uid())
  );
create policy "Admins can manage club books" on public.club_books
  for all using (
    exists (select 1 from public.club_members where club_id = club_books.club_id and user_id = auth.uid() and role in ('owner', 'admin'))
  );

-- Activities: viewable based on user/club visibility
create policy "Own activities are viewable" on public.activities
  for select using (auth.uid() = user_id);
create policy "Users can insert own activities" on public.activities
  for insert with check (auth.uid() = user_id);

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Update timestamp trigger
create or replace function public.update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.update_updated_at();
create trigger user_books_updated_at before update on public.user_books
  for each row execute function public.update_updated_at();
create trigger clubs_updated_at before update on public.clubs
  for each row execute function public.update_updated_at();
