# Shelf MCP server

Drive your library from Claude (web, desktop, phone) or any MCP client: search
for books, add them, move them between shelves, rate and review, and read your
stats.

The same tools are served two ways:

- **Remote** — `https://reading-tracker-chi.vercel.app/api/mcp`, streamable HTTP
  with OAuth. Any Shelf user can connect it; it works everywhere Claude does,
  including the phone app. See *Remote server* below.
- **Personal stdio** — `mcp/server.ts`, spawned locally by Claude Desktop or
  Claude Code and signed in with credentials from the client config. Handy for
  development against a local checkout. See *Setup*.

Tool definitions live in `src/lib/mcp/tools.ts` and data access in
`src/lib/mcp/shelf.ts`; the two entry points only differ in how they obtain a
Supabase session.

## What it does not do

It holds no privileges of its own. It signs in with your ordinary account and
uses the **anon key**, never the service-role key, so every query stays subject
to the same row-level security policies the web app relies on. A bug here cannot
reach another user's shelf.

## Setup (personal stdio)

1. Install dependencies once, in the repo root:

   ```bash
   npm install
   ```

2. Add the server to your MCP client. For Claude Desktop, edit
   `claude_desktop_config.json`; for Claude Code, `.mcp.json` or
   `claude mcp add`. Use absolute paths, and pass `--tsconfig` so the `@/`
   imports resolve regardless of the working directory the client launches from:

   ```json
   {
     "mcpServers": {
       "shelf": {
         "command": "npx",
         "args": [
           "tsx",
           "--tsconfig", "/ABSOLUTE/PATH/TO/reading-tracker/tsconfig.json",
           "/ABSOLUTE/PATH/TO/reading-tracker/mcp/server.ts"
         ],
         "env": {
           "NEXT_PUBLIC_SUPABASE_URL": "https://YOUR-PROJECT.supabase.co",
           "NEXT_PUBLIC_SUPABASE_ANON_KEY": "your-anon-key",
           "SHELF_EMAIL": "you@example.com",
           "SHELF_PASSWORD": "your-password"
         }
       }
     }
   }
   ```

   `SHELF_APP_URL` is optional and only changes which deployment `search_books`
   calls; it defaults to the production URL.

3. Restart the client. Ask it something like *"what am I reading right now?"* or
   *"add Piranesi to my want-to-read list"*.

## Tools

| Tool | What it does |
|------|--------------|
| `search_books` | Search Open Library / Google Books / Hardcover. Reads nothing personal. |
| `get_library` | Your books, filterable by status and by year finished. |
| `add_book` | Add a book. Landing on want-to-read puts it at the top of the list. |
| `update_book_status` | Move between want-to-read / reading / read / dnf. |
| `rate_and_review` | Star rating, written review, Top 5 flag. |
| `get_reading_stats` | Totals, pages, average rating, counts by year and genre. |

Books are identified by title — a unique substring is enough. An ambiguous title
comes back with the candidates listed rather than guessing.

## Why writes behave like the app

Every write goes through `src/lib/book-rules.ts`, the same module the web UI
uses. Finishing a book records a finish date and sets progress to 100; starting
one records the start date; shelving one lands it on top of Want to Read. That
module exists so the two clients cannot drift apart — if you change a rule,
change it there and both follow.

The database column mapping is shared the same way, through
`src/lib/supabase/book-mapping.ts`. It matters: statuses are hyphenated in the
app (`want-to-read`) and underscored in Postgres (`want_to_read`).

## Known gaps

- **No finish-summary email.** The web app fires `/api/finish-summary` when a
  book becomes read; that call needs a browser session, so finishing a book
  through MCP does not send the email.
- **Cannot correct catalog metadata.** The `books` table has no UPDATE policy,
  so tools can add rows and change *your* shelf, but cannot fix a wrong author
  or page count. That needs a service-role run.
- **Stdio credentials sit in the client config in plain text.** Acceptable for
  a personal server on your own machine; the remote server exists so nobody
  else has to do this.

## Remote server

Supabase's OAuth 2.1 server is the authorization server; the app is only the
resource server.

1. An unauthenticated request to `/api/mcp` gets a `401` whose
   `WWW-Authenticate` header points at
   `/.well-known/oauth-protected-resource/api/mcp`, which names Supabase as the
   authorization server.
2. The client registers itself with Supabase (dynamic client registration) and
   sends the user to Supabase's authorize endpoint, which redirects to the
   app's consent screen at `/oauth/consent`.
3. The user signs in if needed, approves, and Supabase issues an access token.
   That token is an ordinary Supabase user JWT: `/api/mcp` verifies it with
   `getClaims` and hands it to PostgREST, so row-level security scopes every
   query to that user — exactly as for the stdio server.

**Connect it in Claude:** Settings → Connectors → Add custom connector → URL
`https://reading-tracker-chi.vercel.app/api/mcp`, then sign in on the consent
screen. Connectors added on claude.ai also appear in the desktop and mobile
apps. ChatGPT (developer mode → MCP app) uses the same URL.

**Supabase settings it depends on** (Dashboard → Authentication → OAuth
Server): OAuth server enabled, Authorization Path `/oauth/consent`, and
*Allow Dynamic OAuth Apps* on.

Relevant files: `src/app/api/mcp/route.ts` (endpoint),
`src/lib/mcp/remote.ts` (token verification, discovery metadata),
`src/app/.well-known/` (discovery documents), `src/app/oauth/consent/page.tsx`
(consent screen).
