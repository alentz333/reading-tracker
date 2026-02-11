# 📚 ReggieReader

A personal reading tracker with social book club features. Track what you're reading, share your library with friends, and join book clubs.

![Next.js](https://img.shields.io/badge/Next.js-16.x-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)
![Supabase](https://img.shields.io/badge/Supabase-Postgres-green)

---

## Features

### 📖 Personal Library
- Search and add books via Open Library API
- Track reading status: Want to Read → Reading → Read
- Rate books (1-5 stars) and add personal notes
- Scan book covers with camera (AI-powered identification)
- Import from Goodreads CSV export

### 👤 Social Profiles
- Public/private profile pages
- Display name, avatar, and bio
- Control which books are visible to others
- Search and discover other readers

### 📕 Book Clubs
- Create public or private clubs
- Invite members via join code
- Add books as "Current Read" or "Upcoming"
- See what your club is reading together

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | [Next.js 16](https://nextjs.org) (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS 4 |
| Database | [Supabase](https://supabase.com) (Postgres) |
| Auth | Supabase Auth (Email + OAuth) |
| Book Data | [Open Library API](https://openlibrary.org/developers/api) |
| Hosting | [Vercel](https://vercel.com) |

---

## Getting Started

### Prerequisites
- Node.js 18+
- Supabase account (free tier works)

### Installation

```bash
# Clone the repository
git clone https://github.com/alentz333/reading-tracker.git
cd reading-tracker

# Install dependencies
npm install

# Copy environment template
cp .env.example .env.local
```

### Configure Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. Copy your project URL and anon key
3. Update `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

4. Run the database schema (see `SOCIAL_EXPANSION_PLAN.md` for SQL)

### Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── auth/               # Login, signup, callback
│   ├── clubs/              # Book clubs pages
│   ├── profile/            # User profile
│   ├── user/[username]/    # Public profile view
│   └── api/                # API routes (search, identify)
├── components/             # React components
│   ├── auth/               # Auth-related components
│   ├── BookCard.tsx        # Book display card
│   ├── BookSearch.tsx      # Open Library search
│   ├── CameraScanner.tsx   # AI book cover scanning
│   └── ...
├── hooks/                  # Custom React hooks
│   └── useBooks.ts         # Book CRUD operations
├── lib/
│   ├── supabase/           # Supabase client config
│   └── storage.ts          # Storage utilities
└── types/
    └── book.ts             # TypeScript types
```

---

## Deployment

See [DEPLOY.md](./DEPLOY.md) for complete deployment instructions.

**Quick deploy:**
```bash
vercel
```

**Remember to:**
1. Set environment variables in Vercel
2. Configure Supabase auth redirect URLs
3. Test auth flow in production

---

## Roadmap

- [x] Personal library with search
- [x] Supabase auth & cloud sync
- [x] Social profiles (public/private)
- [x] Book clubs MVP
- [ ] Activity feed
- [ ] Reading challenges
- [ ] Discussion threads
- [ ] Mobile PWA

See `SOCIAL_EXPANSION_PLAN.md` for the full feature roadmap.

---

## License

MIT

---

Built with ☕ and 🥔 by [Reggie](https://github.com/alentz333)
