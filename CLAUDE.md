# CLAUDE.md — Reading Tracker

This file provides guidance for AI assistants (Claude and others) working with this codebase.

---

## Project Overview

**Reading Tracker** (also called the **"Shelf" app** — Alex uses the two names interchangeably) is a full-stack web app for tracking personal reading, discovering new books, and participating in book clubs. It includes profile badges and social features (public profiles, book clubs). The former XP/quests/streaks gamification layer was removed in July 2026 (its DB tables still exist but are unused); achievements were rebranded as **badges** shown on profiles in July 2026.

**Live stack:** Next.js 16 (App Router) · TypeScript 5 · Tailwind CSS 4 · Supabase (PostgreSQL + Auth) · Vercel

---

## Development Commands

```bash
npm run dev      # Start dev server at http://localhost:3000
npm run build    # Production build → .next/
npm start        # Start production server
npm run lint     # Run ESLint (eslint-config-next)
```

There is **no test suite** configured. Manual testing via the dev server is the primary verification method.

---

## Environment Variables

Create `.env.local` with:

```
NEXT_PUBLIC_SUPABASE_URL=<your-supabase-project-url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-supabase-anon-key>
OPENAI_API_KEY=<optional-for-camera-scanning>
ANTHROPIC_API_KEY=<optional-for-finish-summary-emails>
RESEND_API_KEY=<optional-for-finish-summary-emails>
SUMMARY_EMAIL_FROM=<optional-sender-override>
GOOGLE_BOOKS_API_KEY=<optional-for-book-search>
HARDCOVER_API_TOKEN=<optional-for-book-search>
```

The `OPENAI_API_KEY` is required for camera-based book cover scanning (`/api/identify`). `ANTHROPIC_API_KEY` (Claude) and `RESEND_API_KEY` are required only for the finish-summary emails (`/api/finish-summary`); `SUMMARY_EMAIL_FROM` defaults to `Shelf <onboarding@resend.dev>`. `GOOGLE_BOOKS_API_KEY` (free, Google Cloud console with the Books API enabled — no billing required, 1,000 requests/day) and `HARDCOVER_API_TOKEN` (free, hardcover.app account settings → Hardcover API; tokens expire yearly) each enable an extra `/api/search` provider whose results are merged with Open Library's; search degrades gracefully to Open Library only when they are absent.

---

## Repository Structure

```
src/
├── app/                        # Next.js App Router (pages + API routes)
│   ├── page.tsx                # Home: dashboard, discovery, add books
│   ├── layout.tsx              # Root layout with AuthProvider
│   ├── globals.css             # Global Tailwind CSS
│   ├── api/
│   │   ├── search/route.ts     # GET /api/search?q= → Open Library + Google Books + Hardcover
│   │   ├── identify/route.ts   # POST /api/identify → GPT-4 Vision book ID
│   │   └── user/[username]/reading-export/route.ts  # CSV export
│   ├── auth/
│   │   ├── login/page.tsx
│   │   ├── signup/page.tsx
│   │   └── callback/route.ts   # Supabase OAuth callback
│   ├── library/
│   │   ├── page.tsx            # User's book library
│   │   └── previous-reads/page.tsx
│   ├── clubs/
│   │   ├── page.tsx            # Book clubs list
│   │   ├── [id]/page.tsx       # Club detail
│   │   ├── [id]/add-book/page.tsx
│   │   └── create/page.tsx
│   ├── profile/
│   │   ├── page.tsx            # User profile + stats
│   │   └── edit/page.tsx
│   ├── user/[username]/page.tsx  # Public profile view (badges + public books)
│   ├── leaderboard/page.tsx
│   └── achievements/page.tsx   # Legacy route — redirects to /profile
├── components/
│   ├── Header.tsx              # Navigation bar
│   ├── BookCard.tsx            # Book display/interaction (status, rating, review)
│   ├── BookSearch.tsx          # Open Library search UI
│   ├── CameraScanner.tsx       # Camera + GPT-4 Vision book identification
│   ├── GoodreadsImport.tsx     # Goodreads CSV import
│   ├── UserSearch.tsx          # User discovery
│   ├── AuthModal.tsx           # Login/signup modal
│   ├── BooksProvider.tsx       # Shared library state (single fetch, mounted in layout)
│   ├── BadgeShowcase.tsx       # Earned/locked badge grid on profile pages
│   ├── SortableBookList.tsx    # Drag-and-drop Want to Read priority list
│   ├── BookCoverPlaceholder.tsx # Title-on-gradient fallback when no cover art
│   └── auth/
│       ├── AuthProvider.tsx    # Supabase auth context
│       └── UserMenu.tsx        # User dropdown with logout
├── hooks/
│   └── useBooks.ts             # Alias for the BooksProvider context
├── lib/
│   ├── storage.ts              # localStorage API (offline fallback)
│   ├── previous-reads.ts       # Previous reads timeline logic
│   ├── recommendations.ts      # Smart book suggestions
│   ├── discovery-feedback.ts   # User preference tracking
│   └── supabase/
│       ├── client.ts           # Browser Supabase client
│       ├── server.ts           # Server-side Supabase client
│       ├── middleware.ts       # Session refresh middleware
│       ├── books.ts            # Book DB operations
│       ├── badges.ts           # Badge definitions, unlocks, requirement checks
│       ├── achievements.ts     # Thin re-export shim → badges.ts (legacy imports)
│       ├── guardedFetch.ts     # Prevents accidental root API calls
│       └── types.ts            # Auto-generated DB types
└── types/
    └── book.ts                 # Core TypeScript interfaces
supabase/
└── migrations/
    ├── 001_initial_schema.sql  # Core tables
    ├── 003_gamification.sql   # Achievements tables (+ legacy XP/quests tables, now unused)
    ├── 005_genres.sql          # books.genres column
    ├── 006_email_summary.sql   # user_books.email_summary_on_finish toggle
    ├── 007_want_priority.sql   # user_books.priority (Want to Read manual order)
    ├── 009_reading_format.sql  # user_books.format ('book' | 'audiobook')
    ├── 010_badges.sql          # Public badge policy + genre/audiobook badge seeds
    └── 011_top_five.sql        # user_books.is_top_five (profile Top 5 picks)
middleware.ts                   # Root middleware: session refresh (skips /api/search, /api/identify)
```

---

## Key TypeScript Types

Defined in `src/types/book.ts`:

```typescript
type ReadingStatus = 'read' | 'reading' | 'want-to-read' | 'dnf';
type BookFormat = 'book' | 'audiobook';

interface Book {
  id: string;
  title: string;
  author: string;
  status: ReadingStatus;
  format?: BookFormat;      // How it was consumed; defaults to 'book'
  priority?: number;        // Manual Want to Read order (1 = top)
  isTopFive?: boolean;      // Profile "Top 5 Recommended" pick (max 5, read books only)
  rating?: number;          // 1–5
  progress?: number;        // 0–100 (percentage) for 'reading' status
  dateStarted?: string;
  dateFinished?: string;
  review?: string;
  genres?: string[];
  coverUrl?: string;
  isbn?: string;
  pageCount?: number;
  publishedYear?: number;
  source?: 'manual' | 'goodreads' | 'openlibrary' | 'google';
  isPublic?: boolean;
  isPreviousRead?: boolean;
}
```

**Important:** `ReadingStatus` uses hyphens (`want-to-read`) in TypeScript but underscores (`want_to_read`) in the Supabase DB. Use the mapping helpers in `src/lib/supabase/books.ts` (`mapStatusToDb`, `mapStatusFromDb`) when reading or writing status values.

---

## Data Layer

### Dual Storage Pattern

The app supports both authenticated (Supabase) and unauthenticated (localStorage) modes:

```typescript
// useBooks hook
if (user) {
  // Supabase: fetchBooks(), addBookToSupabase(), etc.
} else {
  // localStorage: getBooks(), saveBooks() from src/lib/storage.ts
}
```

Always support both paths when modifying book-related code.

### Supabase Database Schema

**Core tables:**

| Table | Key columns | Notes |
|-------|-------------|-------|
| `profiles` | `id` (FK to auth.users), `username`, `display_name` | One per user (legacy xp/level/streak columns unused) |
| `books` | `id`, `title`, `author`, `isbn`, `cover_url`, `page_count` | Shared catalog, deduplicated by ISBN |
| `user_books` | `user_id`, `book_id`, `status`, `format`, `rating`, `progress`, `review`, `date_started`, `date_finished`, `priority`, `is_top_five` | Per-user reading state; `format` is `book` \| `audiobook`, `priority` orders Want to Read, `is_top_five` marks profile Top 5 picks (cap enforced in `BooksProvider.updateBook`) |
| `clubs` | `id`, `name`, `description`, `owner_id`, `is_private` | Book clubs |
| `club_members` | `club_id`, `user_id`, `role` | `role`: `owner` \| `admin` \| `member` |
| `club_books` | `club_id`, `book_id`, `status` | `status`: `upcoming` \| `current` \| `finished` |
| `xp_events` | `user_id`, `amount`, `reason`, `book_id` | Legacy XP audit log (unused) |
| `achievements` | `id`, `name`, `description`, `icon`, `category`, `requirement` | Badge definitions (legacy table name; `xp_reward` no longer surfaced) |
| `user_achievements` | `user_id`, `achievement_id`, `unlocked_at` | Per-user badge unlocks (publicly readable for profile display) |
| `quests` | `id`, `title`, `type`, `goal`, `xp_reward` | Legacy (unused) |
| `user_quests` | `user_id`, `quest_id`, `progress`, `completed_at` | Legacy (unused) |
| `reading_goals` | `user_id`, `type`, `target`, `year` | Reading targets |
| `activities` | `user_id`, `type`, `book_id`, `data` | Social activity feed |

Row-Level Security (RLS) is enabled. Users can only read/write their own rows. Public data (clubs, profiles, leaderboards) is readable by all.

### Supabase Client Setup

- **Browser code:** import from `@/lib/supabase/client`
- **Server components / API routes:** import from `@/lib/supabase/server`
- Never import the browser client in server-side code.

---

## API Routes

| Route | Method | Description |
|-------|--------|-------------|
| `/api/search` | GET | Book search. Query param: `q` (min 2 chars; ISBN-10/13 input is detected and searched as an ISBN). Queries Open Library (field-scoped title/author Solr query, English editions preferred) plus Google Books and Hardcover when their keys are set, merges/dedupes by ISBN and title+author, and returns up to 20 books. Each result carries a `source` field. |
| `/api/identify` | POST | Body: `{ imageBase64: string }`. Uses GPT-4 Vision to identify book from cover photo. Returns `{ title, author }`. |
| `/api/user/[username]/reading-export` | GET | Returns the user's full reading list as a CSV file. |
| `/api/finish-summary` | POST | Body: `{ userBookId }`. If the book's `email_summary_on_finish` flag is set, generates a ~300-word summary (Claude, `claude-haiku-4-5` + web search for books it doesn't know) and emails it to the signed-in user via Resend. Triggered fire-and-forget from `BooksProvider.updateBook` when a book transitions to read. Needs `ANTHROPIC_API_KEY` + `RESEND_API_KEY`. |
| `/auth/callback` | GET | Supabase OAuth callback. Exchanges `code` for session, redirects to `/`. |

---

## Badges

Badges (formerly "achievements") are the only remaining gamification feature (XP, levels, streaks, and quests were removed). Definitions live in the legacy `achievements` table; unlocks in `user_achievements`. Earned badges display on profile pages (`/user/[username]`) — everyone can see them; your own profile also shows locked badges behind a toggle.

- `src/lib/supabase/badges.ts` — fetch definitions/unlocks and `checkAndUnlockBadges()`, which computes progress (books read, reviews, ratings, clubs, page counts, fast finishes, per-genre read counts, audiobooks finished) in one parallel query batch and inserts any newly earned unlocks. The check runs when a signed-in user views their own profile.
- `src/lib/supabase/achievements.ts` — thin re-export shim (`checkAndUnlockAchievements` → `checkAndUnlockBadges`) kept for older imports.
- `src/components/BadgeShowcase.tsx` — presentational badge grid used by the profile page.
- Badges whose requirements depended on the retired XP event log (`early_reading`, `late_reading`) or streaks can no longer be newly earned; never-unlocked ones were deleted in migration 010 and any remaining are skipped by the unlock check, while existing unlocks still display.

---

## Code Conventions

### Component structure
- Pages live in `src/app/**` and handle data fetching via hooks.
- Components in `src/components/` are **presentational** — they accept data and callback props. Avoid fetching data directly inside components.
- Component filenames: **PascalCase** (`BookCard.tsx`)
- Utility/lib filenames: **camelCase** (`fetchBooks`, `checkAndUnlockBadges`)
- Custom hooks: prefixed with `use` (`useBooks`)

### Styling
- Tailwind CSS 4 utility classes only — no CSS modules, no `styled-components`.
- Responsive design is required. Use `sm:`, `md:`, `lg:` breakpoints.
- Mobile navigation is handled by a bottom nav bar (see `Header.tsx`).
- Dark mode: not yet implemented. Default is light/white UI with slate/gray tones.

### Error handling
- Prefer returning `null` or `false` on error over throwing, except at API route boundaries.
- Log errors with `console.error()`.
- Graceful degradation: if Supabase fails, fall back to localStorage where applicable.
- Do not add `try/catch` around every statement — wrap at function boundaries.

### TypeScript
- Strict mode is enabled. Avoid `any`; prefer `unknown` with type guards.
- Use the types from `src/types/book.ts` and `src/lib/supabase/types.ts`.
- The `@/*` path alias maps to `src/*`.

### Path alias
```typescript
import { Book } from '@/types/book';          // src/types/book.ts
import { useBooks } from '@/hooks/useBooks';   // src/hooks/useBooks.ts
import { createClient } from '@/lib/supabase/client';
```

---

## Deployment

Deployment is to **Vercel** with Supabase as the backend.

1. Push to `main` — Vercel auto-deploys.
2. Required environment variables in Vercel dashboard:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `OPENAI_API_KEY` (optional, camera scanning)
   - `GOOGLE_BOOKS_API_KEY` (optional, extra book-search provider)
   - `HARDCOVER_API_TOKEN` (optional, extra book-search provider)
   - `ANTHROPIC_API_KEY` (optional, finish-summary emails)
   - `RESEND_API_KEY` (optional, finish-summary emails)
3. In Supabase Auth settings, configure:
   - **Site URL:** `https://your-app.vercel.app`
   - **Redirect URL:** `https://your-app.vercel.app/auth/callback`
4. Run DB migrations via Supabase SQL editor (`supabase/migrations/`).

See `DEPLOY.md` for the full step-by-step guide.

---

## Common Tasks

### Adding a new page
1. Create `src/app/<route>/page.tsx`.
2. Fetch data via a custom hook or `async` server component.
3. Add navigation link to `src/components/Header.tsx`.

### Adding a new database table
1. Write migration SQL in `supabase/migrations/` with the next sequence number.
2. Add TypeScript types to `src/lib/supabase/types.ts`.
3. Add CRUD functions to the appropriate file in `src/lib/supabase/`.

### Adding a new badge
1. Insert the definition into the `achievements` table with a `requirement` JSON (e.g. `{"genre": "Fantasy", "genre_count": 5}` or `{"audiobooks": 10}`).
2. If it needs a new progress signal, extend `checkAndUnlockBadges()` in `src/lib/supabase/badges.ts`.

### Modifying book status
- Always go through `useBooks` hook methods (`addBook`, `updateBook`, `deleteBook`).
- Remember to use `mapStatusToDb` / `mapStatusFromDb` for the `status` field.

---

## Files to Be Aware Of

| File | Why it matters |
|------|---------------|
| `src/lib/supabase/guardedFetch.ts` | Prevents accidental calls to the Supabase REST root — do not bypass |
| `middleware.ts` | Refreshes Supabase auth sessions on every request (except /api/search and /api/identify) |
| `src/app/layout.tsx` | Root layout wraps everything in `<AuthProvider>` + `<BooksProvider>` — auth and library state are site-wide |
| `src/components/BooksProvider.tsx` | Central book state manager — all book mutations go through here (via the `useBooks` alias) |
| `src/lib/supabase/books.ts` | All direct Supabase book/user_books queries live here |
| `src/lib/supabase/badges.ts` | Badge definitions, unlocks, and requirement checks live here |
| `supabase/migrations/` | Schema history — do not edit existing migration files |
