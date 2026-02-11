# 🚀 ReggieReader Deployment Guide

Complete guide to deploy the Reading Tracker to production.

---

## Pre-Deployment Checklist

- [x] App builds successfully (`npm run build`)
- [x] Supabase project configured (project: `ReggieReader`)
- [x] Auth callback route implemented (`/auth/callback`)
- [x] Environment variables documented
- [ ] Push latest code to GitHub
- [ ] Configure Supabase redirect URLs (see below)
- [ ] Deploy to Vercel
- [ ] Test auth flow in production

---

## Step 1: Push to GitHub

If not already done:

```bash
cd ~/reading-tracker

# Initialize git if needed
git init

# Create GitHub repo (using gh CLI)
gh repo create reading-tracker --public --source=. --remote=origin

# Or if repo exists, add remote
git remote add origin https://github.com/YOUR_USERNAME/reading-tracker.git

# Push
git add .
git commit -m "Ready for deployment"
git push -u origin main
```

---

## Step 2: Deploy to Vercel

### Option A: Vercel CLI (Recommended)

```bash
# Install Vercel CLI if needed
npm i -g vercel

# Deploy from project directory
cd ~/reading-tracker
vercel

# Follow prompts:
# - Link to existing project? No (first time)
# - Project name: reading-tracker (or your choice)
# - Directory: ./
# - Override settings? No
```

### Option B: Vercel Dashboard

1. Go to [vercel.com/new](https://vercel.com/new)
2. Import your GitHub repository
3. Vercel auto-detects Next.js settings
4. Add environment variables (see Step 3)
5. Click "Deploy"

---

## Step 3: Configure Environment Variables

In Vercel Dashboard → Project Settings → Environment Variables, add:

| Variable | Value | Notes |
|----------|-------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://jwqhdyeycfaqtrcomwms.supabase.co` | Your Supabase URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJhbG...` (your anon key) | From Supabase Dashboard |
| `OPENAI_API_KEY` | (optional) | For book cover scanning |

**Important:** These are already in `.env.local` for reference. Copy the values to Vercel.

---

## Step 4: Configure Supabase Auth Redirects ⚠️

**This is critical for authentication to work in production.**

1. Go to [Supabase Dashboard](https://supabase.com/dashboard/project/jwqhdyeycfaqtrcomwms)
2. Navigate to: **Authentication → URL Configuration**
3. Update settings:

| Setting | Value |
|---------|-------|
| Site URL | `https://your-vercel-app.vercel.app` |
| Redirect URLs | Add: `https://your-vercel-app.vercel.app/auth/callback` |

Also keep localhost for development:
- `http://localhost:3000/auth/callback`

**If using custom domain later:**
- `https://yourdomain.com/auth/callback`

---

## Step 5: Post-Deployment Testing

After deploy completes, verify each feature:

### Core Functionality
- [ ] Homepage loads without errors
- [ ] Can search and add books via Open Library
- [ ] Book cards display correctly with covers
- [ ] Status changes (Reading → Read) work
- [ ] Ratings and notes save

### Authentication
- [ ] Sign up with email works
- [ ] Login with email works
- [ ] OAuth (Google) redirects properly
- [ ] Logout works
- [ ] Protected routes redirect to login

### Social Features
- [ ] Profile page loads (`/profile`)
- [ ] Can edit profile (`/profile/edit`)
- [ ] User search finds other users
- [ ] Public profiles visible (`/user/[username]`)
- [ ] Book clubs list loads (`/clubs`)
- [ ] Can create a club (`/clubs/create`)
- [ ] Can view club details (`/clubs/[id]`)
- [ ] Can add books to club

### Edge Cases
- [ ] Unauthenticated users see appropriate UI
- [ ] Mobile responsive (test on phone)
- [ ] Books persist after refresh (Supabase sync)

---

## Step 6: Custom Domain (Optional)

### In Vercel:
1. Project Settings → Domains
2. Add your domain (e.g., `books.yourdomain.com`)
3. Follow DNS configuration instructions

### In Supabase:
1. Add new domain to Redirect URLs:
   - `https://books.yourdomain.com/auth/callback`

---

## Troubleshooting

### "Auth callback failed" or redirect loops
- Check Supabase redirect URLs match exactly
- Ensure Site URL is set in Supabase
- Clear browser cookies and try again

### Books not saving / loading
- Check browser console for Supabase errors
- Verify environment variables are set in Vercel
- Check Supabase RLS policies allow operations

### Build failures on Vercel
- Check Node.js version matches (18.x+)
- Review build logs for TypeScript errors
- Verify all dependencies in package.json

### OAuth not working
- Verify Google OAuth is configured in Supabase Auth Providers
- Check redirect URI in Google Cloud Console matches Supabase

---

## Quick Deploy Commands

```bash
# Full deploy flow
cd ~/reading-tracker
git add . && git commit -m "Deploy updates"
git push origin main
vercel --prod

# Check deployment status
vercel ls

# View production logs
vercel logs your-app.vercel.app
```

---

## Architecture Reference

```
┌─────────────────┐     ┌─────────────────┐
│   Vercel CDN    │────▶│   Next.js App   │
│   (Frontend)    │     │   (SSR + API)   │
└────────┬────────┘     └────────┬────────┘
         │                       │
         │                       ▼
         │              ┌─────────────────┐
         │              │    Supabase     │
         │              │  ┌───────────┐  │
         └──────────────▶  │  Postgres │  │
                        │  │ (Database)│  │
                        │  └───────────┘  │
                        │  ┌───────────┐  │
                        │  │   Auth    │  │
                        │  └───────────┘  │
                        └─────────────────┘
```

---

## Current Supabase Details

- **Project:** ReggieReader
- **URL:** `https://jwqhdyeycfaqtrcomwms.supabase.co`
- **Region:** (check dashboard)
- **Database:** Postgres with RLS enabled

---

## Next Steps After Deployment

1. **Share with friends** to test multi-user features
2. **Create first book club** to validate social features
3. **Monitor Supabase usage** (free tier limits)
4. **Set up error tracking** (Sentry optional)
5. **Custom domain** when ready to go public

---

*Last updated: 2026-02-06*
