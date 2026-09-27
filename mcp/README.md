# Shelf MCP server (personal, stdio)

Drive your own library from Claude Desktop or Claude Code: search for books, add
them, move them between shelves, rate and review, and read your stats.

This is the **personal** server. It signs in as one real user over stdio, so it
works with MCP clients that spawn a local process. ChatGPT connectors require a
remote HTTPS server with OAuth and cannot use this one — see *Going remote*.

## What it does not do

It holds no privileges of its own. It signs in with your ordinary account and
uses the **anon key**, never the service-role key, so every query stays subject
to the same row-level security policies the web app relies on. A bug here cannot
reach another user's shelf.

## Setup

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
- **Credentials sit in the client config in plain text.** Acceptable for a
  personal server on your own machine; not a model for other users.

## Going remote (for other users, and for ChatGPT)

The tool layer here is transport-agnostic. To serve real users:

1. Enable Supabase's OAuth 2.1 server (Dashboard → Authentication → OAuth
   Server), which lets your existing accounts authorise MCP clients.
2. Re-host these same tools behind `mcp-handler` as a Next.js route
   (`src/app/api/mcp/route.ts`), taking the caller's access token and building a
   Supabase client with it — RLS then scopes each request to that user.
3. Register the HTTPS URL as a custom connector in Claude, and as an MCP app in
   ChatGPT developer mode.

Only `mcp/shelf.ts` changes shape; `mcp/server.ts` and the rules do not.
