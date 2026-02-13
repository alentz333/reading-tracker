# Reading Tracker — Gamification System

## Overview
Replace the swipe-to-discover feature with a comprehensive gamification system to increase engagement and make reading more rewarding.

---

## Features to Implement

### 1. XP & Leveling System (Foundation)
Everything else builds on this.

**XP Sources:**
| Action | XP |
|--------|-----|
| Finish a book | 100 |
| Log reading session | 10 |
| Write a review | 25 |
| Rate a book | 5 |
| Complete a quest | 50-200 |
| Unlock achievement | 25 |
| Daily login streak | 5 × streak_days |

**Levels:**
- Level 1: 0 XP (Bookworm Egg)
- Level 2: 100 XP (Page Turner)
- Level 3: 300 XP (Chapter Chaser)
- Level 4: 600 XP (Story Seeker)
- Level 5: 1000 XP (Novel Navigator)
- Level 6: 1500 XP (Tome Tracker)
- Level 7: 2100 XP (Library Legend)
- Level 8: 2800 XP (Bibliophile)
- Level 9: 3600 XP (Literary Sage)
- Level 10: 4500 XP (Grand Reader)
- Level 11+: 1000 XP per level

**Database:**
```sql
-- Add to users table
alter table users add column xp integer default 0;
alter table users add column level integer default 1;

-- XP history for transparency
create table xp_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  amount integer not null,
  reason text not null, -- 'book_finished', 'review_written', etc.
  reference_id uuid, -- book_id, quest_id, etc.
  created_at timestamptz default now()
);
```

---

### 2. Achievements / Badges
Milestone-based rewards that appear on profile.

**Achievement Categories:**

**📚 Reading Milestones**
- First Steps — Finish your first book
- Page Turner — Finish 5 books
- Bookworm — Finish 10 books
- Bibliophile — Finish 25 books
- Library Legend — Finish 50 books
- Century Club — Finish 100 books

**🔥 Streak Achievements**
- Getting Started — 3-day streak
- Habit Forming — 7-day streak
- Dedicated Reader — 30-day streak
- Unstoppable — 100-day streak
- Year of Reading — 365-day streak

**📖 Genre Explorer**
- Fiction Fan — Read 5 fiction books
- Non-Fiction Nerd — Read 5 non-fiction
- Sci-Fi Explorer — Read 5 sci-fi/fantasy
- Mystery Maven — Read 5 mysteries
- Genre Hopper — Read books in 5+ different genres

**⭐ Engagement**
- Critic — Write your first review
- Prolific Reviewer — Write 10 reviews
- Social Reader — Join a book club
- Club Founder — Create a book club
- Recruiter — Invite a friend who signs up

**🎯 Special**
- Speed Reader — Finish a book in under 3 days
- Marathon Reader — Finish a 500+ page book
- Early Bird — Log reading before 7 AM
- Night Owl — Log reading after midnight
- Completionist — Finish all books on your "want to read" list

**Database:**
```sql
create table achievements (
  id text primary key, -- 'first_book', 'streak_7', etc.
  name text not null,
  description text,
  icon text, -- emoji
  xp_reward integer default 25,
  category text, -- 'milestone', 'streak', 'genre', 'engagement', 'special'
  requirement jsonb -- { "books_read": 5 } or { "streak": 7 }
);

create table user_achievements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  achievement_id text references achievements(id),
  unlocked_at timestamptz default now(),
  unique(user_id, achievement_id)
);
```

---

### 3. Reading Challenges (Streaks & Goals)

**Daily Streak:**
- Track consecutive days with reading activity
- Reading activity = logging time, finishing book, or marking progress
- Visual flame indicator 🔥
- Streak freezes available (earn or purchase with XP)

**Goals:**
- Yearly reading goal (e.g., "Read 24 books in 2026")
- Monthly mini-goals
- Custom goals (pages per day, minutes per day)

**Database:**
```sql
-- Streak tracking
alter table users add column current_streak integer default 0;
alter table users add column longest_streak integer default 0;
alter table users add column last_active_date date;
alter table users add column streak_freezes integer default 0;

-- Reading goals
create table reading_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  type text check (type in ('yearly_books', 'monthly_books', 'daily_pages', 'daily_minutes')),
  target integer not null,
  year integer, -- for yearly goals
  month integer, -- for monthly goals
  progress integer default 0,
  created_at timestamptz default now(),
  unique(user_id, type, year, month)
);
```

---

### 4. Reading Quests
Time-limited challenges for bonus XP.

**Quest Types:**

**Daily Quests** (reset at midnight)
- "Read for 15 minutes today" — 15 XP
- "Log your reading progress" — 10 XP
- "Rate a book you've read" — 10 XP

**Weekly Quests** (reset Sunday)
- "Finish a book this week" — 75 XP
- "Read 100 pages" — 50 XP
- "Write a review" — 50 XP
- "Discover 3 new books" — 30 XP

**Monthly Challenges**
- "Read 3 books" — 200 XP
- "Try a new genre" — 100 XP
- "Read a book over 400 pages" — 100 XP

**Special Events** (seasonal)
- "Summer Reading Sprint" — Read 5 books in June-August
- "Spooky October" — Read 3 horror/thriller books
- "New Year, New Books" — Finish a book in January

**Database:**
```sql
create table quests (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  type text check (type in ('daily', 'weekly', 'monthly', 'event')),
  xp_reward integer not null,
  requirement jsonb not null, -- { "action": "finish_book", "count": 1 }
  active_from timestamptz,
  active_until timestamptz,
  is_active boolean default true
);

create table user_quests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  quest_id uuid references quests(id),
  progress integer default 0,
  completed boolean default false,
  completed_at timestamptz,
  assigned_at timestamptz default now(),
  expires_at timestamptz
);
```

---

### 5. Leaderboards
Social competition among friends and club members.

**Leaderboard Types:**
- **Weekly XP** — Most XP earned this week
- **Books This Month** — Most books finished
- **Current Streak** — Longest active streak
- **All-Time Level** — Highest level readers

**Scopes:**
- Global (all users)
- Friends only
- Book club specific

**Implementation:**
```sql
-- Materialized view for performance (refresh periodically)
create materialized view weekly_leaderboard as
select 
  u.id,
  u.username,
  u.display_name,
  u.avatar_url,
  u.level,
  coalesce(sum(xe.amount), 0) as weekly_xp
from users u
left join xp_events xe on xe.user_id = u.id 
  and xe.created_at > now() - interval '7 days'
group by u.id
order by weekly_xp desc
limit 100;

-- Refresh job
-- refresh materialized view weekly_leaderboard;
```

---

## UI Components to Build

### New Components
1. `XPBar.tsx` — Progress bar showing current level and XP to next
2. `LevelBadge.tsx` — Display user's level with icon
3. `AchievementCard.tsx` — Individual achievement display
4. `AchievementGrid.tsx` — Grid of all achievements (locked/unlocked)
5. `QuestCard.tsx` — Single quest with progress
6. `QuestList.tsx` — Daily/weekly quest lists
7. `StreakDisplay.tsx` — Fire emoji + streak count + freeze status
8. `GoalProgress.tsx` — Yearly/monthly goal ring
9. `Leaderboard.tsx` — Ranked list with avatars
10. `XPPopup.tsx` — "+25 XP!" animation on earn

### Modified Pages
1. `page.tsx` — Replace discover tab with "Quests" tab, add XP bar to header
2. `profile/page.tsx` — Add achievements section, level display
3. `Header.tsx` — Add streak, level, XP bar

### New Pages
1. `/achievements` — Full achievement gallery
2. `/quests` — All active quests
3. `/leaderboard` — Full leaderboard view
4. `/goals` — Set and track reading goals

---

## Implementation Order

### Phase 1: Foundation (4-6 hours)
- [ ] Database migrations for XP, levels, streaks
- [ ] XP service (award, calculate level)
- [ ] Remove SwipeCard.tsx and discover mode
- [ ] Add XPBar and LevelBadge to header
- [ ] Update user_books hooks to award XP on actions

### Phase 2: Streaks & Goals (3-4 hours)
- [ ] Streak tracking logic
- [ ] StreakDisplay component
- [ ] Reading goals table + UI
- [ ] GoalProgress component
- [ ] Streak freeze system

### Phase 3: Achievements (4-5 hours)
- [ ] Seed achievements table
- [ ] Achievement check service
- [ ] AchievementCard + AchievementGrid
- [ ] Profile achievements section
- [ ] Achievement unlock animation/notification

### Phase 4: Quests (4-5 hours)
- [ ] Quest seeding (daily/weekly/monthly)
- [ ] Quest assignment logic
- [ ] Quest progress tracking
- [ ] QuestCard + QuestList
- [ ] Replace discover tab with quests

### Phase 5: Leaderboards (2-3 hours)
- [ ] Leaderboard queries/views
- [ ] Leaderboard component
- [ ] Scope filtering (global/friends/club)
- [ ] Weekly refresh logic

### Phase 6: Polish (2-3 hours)
- [ ] XP popup animations
- [ ] Sound effects (optional)
- [ ] Onboarding for new users
- [ ] Empty states
- [ ] Mobile optimization

---

## Estimated Total: 20-26 hours

---

## Questions for Alex

1. **Start with which phase?** (I'd suggest Phase 1 to get the foundation in)
2. **Sound effects?** Fun but might be annoying — toggle?
3. **Leaderboard privacy?** Should users be able to opt out?
4. **Quest reset times?** Midnight local time or UTC?
5. **Streak freeze cost?** Earn through achievements or XP purchase?

---

Ready to build! 🎮📚
