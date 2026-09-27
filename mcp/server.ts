#!/usr/bin/env -S npx tsx
import { createClient } from '@supabase/supabase-js';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { createShelf, type ShelfSession } from '@/lib/mcp/shelf';
import { buildShelfServer } from '@/lib/mcp/tools';

// A personal, single-user MCP server over stdio. It signs in as one real user
// with credentials from the client config; the remote route (src/app/api/mcp)
// serves the same tools to any user over OAuth.

let current: ShelfSession | null = null;
let connecting: Promise<ShelfSession> | null = null;

/**
 * Sign in on first use rather than at startup. An MCP client spawns this
 * process when it launches, and a failure there closes the connection before
 * the user ever sees why; failing inside a tool call surfaces the reason.
 */
async function connect(): Promise<ShelfSession> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const email = process.env.SHELF_EMAIL;
  const password = process.env.SHELF_PASSWORD;

  if (!url || !anonKey) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY');
  if (!email || !password) throw new Error('Missing SHELF_EMAIL / SHELF_PASSWORD');

  const db = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: true },
  });

  const { data, error } = await db.auth.signInWithPassword({ email, password });
  if (error || !data.user) throw new Error(`Shelf sign-in failed: ${error?.message ?? 'no user'}`);
  return { db, uid: data.user.id };
}

async function session(): Promise<ShelfSession> {
  if (current) return current;
  connecting ??= connect().catch(error => {
    connecting = null;
    throw error;
  });
  current = await connecting;
  return current;
}

const shelf = createShelf(session, process.env.SHELF_APP_URL ?? 'https://reading-tracker-chi.vercel.app');

function main() {
  // No await here: the server must answer initialize and tools/list without a
  // database round trip, so the connection is made on the first tool call.
  serveStdio(() => buildShelfServer(shelf), {
    onerror: error => console.error('[shelf-mcp]', error.message),
  });
}

try {
  main();
} catch (error) {
  console.error('[shelf-mcp] failed to start:', error instanceof Error ? error.message : error);
  process.exit(1);
}
