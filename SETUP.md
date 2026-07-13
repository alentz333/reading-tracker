# Reading Tracker Setup (New Computer + Claude Code + Production Deploy)

This guide gets you from a fresh machine to:
1) editing with Claude Code,
2) pushing to GitHub,
3) deploying to production.

Repo: `https://github.com/alentz333/reading-tracker`

---

## 1) One-time prerequisites

Install:
- Node.js 18+ (recommended: latest LTS)
- Git
- GitHub CLI (`gh`)
- Vercel CLI (`npm i -g vercel`)

Then authenticate:

```bash
gh auth login
vercel login
```

---

## 2) Clone + run locally

```bash
git clone https://github.com/alentz333/reading-tracker.git
cd reading-tracker
npm install
cp .env.example .env.local
```

Fill `.env.local` with real values:

```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
OPENAI_API_KEY=... # optional
```

Start dev server:

```bash
npm run dev
```

---

## 3) Connect Vercel project (first time on this machine)

Inside the repo:

```bash
vercel link
```

Use the existing project when prompted:
- Project name: `reading-tracker`

If needed, add env vars to Vercel:

```bash
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
vercel env add OPENAI_API_KEY
```

---

## 4) Daily workflow with Claude Code

1. Open the cloned repo in Claude Code.
2. Make changes.
3. Commit and push:

```bash
git add -A
git commit -m "your change"
git push origin main
```

---

## 5) Production deploy options

### Option A (recommended): Git-based deploy
If Vercel Git integration is enabled, pushing to `main` triggers deploy automatically.

### Option B: Manual deploy from terminal

```bash
vercel --prod
```

---

## 6) Verify after deploy

- Open production URL and sanity-check homepage + auth.
- If auth fails, verify Supabase redirect URLs include:
  - `https://<your-production-domain>/auth/callback`

---

## 7) Useful commands

```bash
git remote -v
npm run build
vercel ls
vercel logs
```

---

## Notes

- `origin` should point to `https://github.com/alentz333/reading-tracker.git`.
- Keep secrets only in `.env.local` / Vercel env vars (never commit secrets).
