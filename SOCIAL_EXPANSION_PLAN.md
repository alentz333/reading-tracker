# Reading Tracker → Social Book Club Platform

## Overview
Transform the personal reading tracker into a multi-user social platform with book clubs.

---

## Data Model (Supabase/Postgres)

### Users
```sql
create table users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  username text unique not null,
  display_name text,
  avatar_url text,
  bio text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

### Books (Master catalog)
```sql
create table books (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  author text,
  isbn text,
  cover_url text,
  description text,
  page_count integer,
  published_date text,
  -- Open Library / Google Books metadata
  ol_key text,
  google_books_id text,
  created_at timestamptz default now()
);

-- Index for deduplication
create unique index books_isbn_idx on books(isbn) where isbn is not null;
```

### User Books (Personal library)
```sql
create table user_books (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  book_id uuid references books(id) on delete cascade,
  
  -- Reading status
  status text check (status in ('want_to_read', 'reading', 'read', 'dnf')),
  
  -- Progress & dates
  current_page integer,
  started_at date,
  finished_at date,
  
  -- Personal data
  rating integer check (rating >= 1 and rating <= 5),
  review text,
  notes text,
  is_favorite boolean default false,
  
  -- Privacy
  is_public boolean default true,
  
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  
  unique(user_id, book_id)
);
```

### Clubs
```sql
create table clubs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  cover_url text,
  created_by uuid references users(id),
  
  -- Settings
  is_public boolean default true,
  join_code text unique, -- for private clubs
  
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

### Club Members
```sql
create table club_members (
  id uuid primary key default gen_random_uuid(),
  club_id uuid references clubs(id) on delete cascade,
  user_id uuid references users(id) on delete cascade,
  role text check (role in ('owner', 'admin', 'member')) default 'member',
  joined_at timestamptz default now(),
  
  unique(club_id, user_id)
);
```

### Club Books (What the club is reading)
```sql
create table club_books (
  id uuid primary key default gen_random_uuid(),
  club_id uuid references clubs(id) on delete cascade,
  book_id uuid references books(id) on delete cascade,
  
  -- Club-specific
  status text check (status in ('upcoming', 'current', 'finished')),
  start_date date,
  target_finish_date date,
  discussion_notes text,
  
  added_by uuid references users(id),
  created_at timestamptz default now(),
  
  unique(club_id, book_id)
);
```

### Activity Feed
```sql
create table activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  
  -- What happened
  action text not null, -- 'started_reading', 'finished', 'joined_club', 'rated', etc.
  
  -- References (nullable based on action type)
  book_id uuid references books(id) on delete cascade,
  club_id uuid references clubs(id) on delete cascade,
  
  -- Extra data
  metadata jsonb,
  
  created_at timestamptz default now()
);

-- Index for feed queries
create index activities_user_created_idx on activities(user_id, created_at desc);
```

---

## Phased Build Plan

### Phase 1: Auth & Database Foundation (4-6 hours)
**Goal:** Users can sign up, log in, and their existing localStorage data migrates to the cloud.

- [ ] Set up Supabase project
- [ ] Create database schema (tables above)
- [ ] Add Supabase Auth (email/password + Google OAuth)
- [ ] Create auth UI (sign up, log in, profile)
- [ ] Build migration utility: localStorage → Supabase
- [ ] Add API routes for CRUD operations
- [ ] Row Level Security (RLS) policies

**Deliverable:** Users can sign up and see their personal library in the cloud.

---

### Phase 2: Social Profiles & Public Libraries (4-6 hours)
**Goal:** Users have profiles and can see each other's public books.

- [ ] Profile page (`/user/[username]`)
- [ ] Edit profile (avatar, bio, display name)
- [ ] Public/private toggle per book
- [ ] "Currently reading" badge on profile
- [ ] User search
- [ ] Follow system (optional, can skip for MVP)

**Deliverable:** Users can view each other's profiles and reading lists.

---

### Phase 3: Book Clubs MVP (8-12 hours)
**Goal:** Users can create clubs, invite others, and track shared reading.

- [ ] Create club flow (name, description, public/private)
- [ ] Club page (`/club/[id]`)
- [ ] Join club (public) / Join via code (private)
- [ ] Club member list with roles
- [ ] Add book to club (upcoming/current/finished)
- [ ] Club activity feed
- [ ] "My Clubs" dashboard section

**Deliverable:** Fully functional book clubs with shared reading lists.

---

### Phase 4: Activity Feed & Notifications (4-6 hours)
**Goal:** See what friends and club members are reading.

- [ ] Global activity feed (people you follow + your clubs)
- [ ] Activity types: started, finished, rated, reviewed, joined club
- [ ] Realtime updates (Supabase Realtime)
- [ ] Email notifications (optional)
- [ ] Push notifications (optional, requires PWA enhancement)

**Deliverable:** Social feed showing reading activity.

---

### Phase 5: Polish & Launch (4-6 hours)
**Goal:** Production-ready with good UX.

- [ ] Onboarding flow for new users
- [ ] Import existing Goodreads data to cloud account
- [ ] Mobile responsiveness audit
- [ ] Performance optimization
- [ ] Error handling & loading states
- [ ] Landing page with value prop
- [ ] Terms of service / Privacy policy

**Deliverable:** Ready to share publicly.

---

## Tech Stack

| Layer | Technology | Why |
|-------|------------|-----|
| Frontend | Next.js (existing) | Already using it |
| Auth | Supabase Auth | Free, easy, supports OAuth |
| Database | Supabase (Postgres) | Free tier, realtime, RLS |
| Storage | Supabase Storage | For avatars, club covers |
| Hosting | Vercel | Free, auto-deploy |
| Email | Resend (optional) | For notifications |

---

## Migration Strategy

For existing users with localStorage data:

1. On first login, check for localStorage books
2. Show migration prompt: "Import your existing library?"
3. Create book records in master `books` table (dedupe by ISBN)
4. Create `user_books` records linking to user
5. Clear localStorage after successful migration
6. Show success message with book count

---

## Future Ideas (Post-MVP)

- 📚 Reading challenges (yearly goals)
- 💬 Discussion threads per club book
- 📊 Club statistics (books read, avg rating)
- 🏆 Achievements/badges
- 📱 Native mobile app (React Native)
- 🔗 Share to social media
- 📖 Reading progress sync (page tracking)
- 🎯 Personalized recommendations

---

## Estimated Total: 24-36 hours

Spread over 2-4 weekends at comfortable pace.

**Quick Win:** Phase 1 alone gives you a cloud-backed personal library — useful even without the social features.
