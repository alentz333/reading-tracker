# 🌙 Baby Sleep Tracker

A PWA-ready web app for tracking your baby's naps and night sleep. Two parents, one shared account, real-time sync.

**Stack:** Next.js 16 · TypeScript · Tailwind CSS 4 · Supabase (Postgres + Auth + Realtime) · Recharts

---

## Setup

### 1. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) and create a new project.
2. Copy the **Project URL**, **anon key**, and **service role key** from Project Settings → API.

### 2. Configure environment variables

```bash
cp .env.example .env.local
# Fill in your Supabase credentials and baby details
```

`.env.local` values:

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key (public) |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (seed script only — never commit) |
| `SEED_BABY_NAME` | Baby's first name |
| `SEED_BABY_DOB` | Baby's date of birth (`YYYY-MM-DD`) |
| `SEED_USER_EMAIL` | Shared email for both parents |
| `SEED_USER_PASSWORD` | Initial password (change after first login) |

### 3. Run the database migration

Open the Supabase SQL editor and paste the contents of `supabase/migrations/0001_init.sql`. Run it. This creates all tables, indexes, and RLS policies.

### 4. Seed the database

```bash
npm run seed
```

This script (using the service role key):
- Creates the auth user with your `SEED_USER_EMAIL` / `SEED_USER_PASSWORD`.
- Inserts the baby row.
- Inserts the wake window reference rows.

Safe to re-run — it checks for existing rows first.

### 5. Start locally

```bash
npm run dev
# Open http://localhost:3000
```

### 6. Deploy to Vercel

1. Push to GitHub.
2. Import the repo into Vercel.
3. Set the following environment variables in the Vercel dashboard (do **not** include `SUPABASE_SERVICE_ROLE_KEY` or `SEED_*` vars):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. In Supabase Auth settings, set:
   - **Site URL:** `https://your-app.vercel.app`
   - **Redirect URL:** `https://your-app.vercel.app/auth/callback`
5. Trigger a deployment.

### 7. Install as PWA

- **iOS Safari:** open the app → Share → Add to Home Screen.
- **Android Chrome:** open the app → menu → Add to Home Screen / Install App.

---

## Usage

### Logging sleep

1. Sign in with the shared credentials.
2. On the **Home** tab:
   - Tap **"Down for nap"** (before 6 pm) or **"Down for night"** (6 pm or later) when the baby goes to sleep.
   - Tap **"Awake from nap"** when the baby wakes from a nap.
   - For night sleep: tap **"Night waking"** each time the baby wakes, then **"Back asleep"** when they settle. Tap **"Morning wake"** (available after 5 am) to close everything at once.
3. Both parents see live updates within ~2 seconds.

### Reading the status card

The color bar under "Awake for…" shows how far through the age-appropriate wake window the baby is:

- **Green** — below the minimum (likely still has time before next nap)
- **Amber** — in the target window (good time to start the nap routine)
- **Red** — over the maximum (overtired territory, start now)

### Analysis

The **Analysis** tab shows rolling charts for the last 7, 14, or 30 days including total sleep, naps per day, longest night stretch, and night wakings.

---

## Development commands

```bash
npm run dev      # Start dev server at http://localhost:3000
npm run build    # Production build
npm run lint     # ESLint
npm run seed     # Seed Supabase with user + baby + wake window data
```

---

## Project structure

```
src/
├── app/
│   ├── page.tsx            # Redirects to /home or /login
│   ├── login/page.tsx
│   ├── home/page.tsx       # Home tab
│   ├── log/page.tsx        # Log tab
│   └── analysis/page.tsx   # Analysis tab
├── components/
│   ├── StatusCard.tsx
│   ├── PrimaryActionButton.tsx
│   ├── SessionRow.tsx
│   ├── TabBar.tsx
│   └── charts/
├── hooks/
│   ├── useCurrentBaby.ts
│   ├── useOpenSession.ts
│   ├── useTodaySessions.ts
│   └── useRealtimeSync.ts
├── lib/
│   ├── config.ts           # BEDTIME_CUTOFF_HOUR, MORNING_CUTOFF_HOUR, etc.
│   ├── wakeWindows.ts      # Wake window lookup + color cue logic
│   ├── sleepLogic.ts       # Derived calculations (longest stretch, avg wake window)
│   ├── dateUtils.ts        # Formatting helpers
│   └── supabase/
scripts/
└── seed.ts                 # One-shot database seed
supabase/
└── migrations/
    └── 0001_init.sql       # All tables, indexes, RLS
```

---

## Wake window reference

Age-appropriate wake windows are stored in the `wake_window_reference` Supabase table (seeded by `npm run seed`). They are sourced from Huckleberry and Taking Cara Babies published ranges. Edit directly in Supabase if you need to adjust them.

---

## Known limitations (v1)

- **No edit/delete from the UI.** If you tap the wrong button, edit directly in Supabase.
- **Shared account only.** One email + password for both parents.
- **No offline support.** Requires an internet connection.
- **6 pm bedtime cutoff** is a heuristic — a 5:30 pm nap will be logged as a nap.
