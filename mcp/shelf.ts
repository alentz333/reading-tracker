import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { Book, ReadingStatus } from '@/types/book';
import {
  BOOK_SELECT,
  mapStatusToDb,
  mapSupabaseToBook,
  type SupabaseBook,
} from '@/lib/supabase/book-mapping';

// Data access for the stdio MCP server. The web app talks to Supabase through
// a browser client that reads cookies, which a Node process has no access to,
// so this builds its own client and signs in with stored credentials. It does
// NOT use the service-role key: the server acts as one real user, so every
// query stays subject to the same row-level security the app relies on, and a
// bug here cannot reach another user's shelf.

let client: SupabaseClient | null = null;
let userId: string | null = null;
let connecting: Promise<void> | null = null;

/**
 * Sign in on first use rather than at startup. An MCP client spawns this
 * process when it launches, and a failure there closes the connection before
 * the user ever sees why; failing inside a tool call surfaces the reason.
 */
async function connect(): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const email = process.env.SHELF_EMAIL;
  const password = process.env.SHELF_PASSWORD;

  if (!url || !anonKey) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY');
  if (!email || !password) throw new Error('Missing SHELF_EMAIL / SHELF_PASSWORD');

  client = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: true },
  });

  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.user) throw new Error(`Shelf sign-in failed: ${error?.message ?? 'no user'}`);
  userId = data.user.id;
}

async function session(): Promise<{ db: SupabaseClient; uid: string }> {
  if (!client || !userId) {
    connecting ??= connect().catch(error => {
      connecting = null;
      throw error;
    });
    await connecting;
  }
  return { db: client!, uid: userId! };
}

export async function getLibrary(): Promise<Book[]> {
  const { db, uid } = await session();
  const { data, error } = await db
    .from('user_books')
    .select(BOOK_SELECT)
    .eq('user_id', uid)
    .order('created_at', { ascending: false });

  if (error) throw new Error(`Could not read library: ${error.message}`);
  return (data as unknown as SupabaseBook[]).map(mapSupabaseToBook);
}

/** Find an existing catalog row by ISBN or exact title+author, else create one. */
async function resolveCatalogBook(
  input: { title: string; author: string; isbn?: string; coverUrl?: string; pageCount?: number }
): Promise<string> {
  const { db } = await session();

  if (input.isbn) {
    const { data } = await db.from('books').select('id').eq('isbn', input.isbn).maybeSingle();
    if (data?.id) return data.id;
  }

  const { data: byTitle } = await db
    .from('books')
    .select('id')
    .ilike('title', input.title)
    .ilike('author', input.author)
    .maybeSingle();
  if (byTitle?.id) return byTitle.id;

  const { data: created, error } = await db
    .from('books')
    .insert({
      title: input.title,
      author: input.author,
      isbn: input.isbn ?? null,
      cover_url: input.coverUrl ?? null,
      page_count: input.pageCount ?? null,
    })
    .select('id')
    .single();

  if (error || !created) throw new Error(`Could not create book: ${error?.message}`);
  return created.id;
}

export async function addToLibrary(
  input: { title: string; author: string; isbn?: string; coverUrl?: string; pageCount?: number },
  status: ReadingStatus,
  extras: Partial<Book>
): Promise<Book> {
  const { db, uid } = await session();
  const bookId = await resolveCatalogBook(input);

  const { data: existing } = await db
    .from('user_books')
    .select('id')
    .eq('user_id', uid)
    .eq('book_id', bookId)
    .maybeSingle();
  if (existing?.id) throw new Error(`"${input.title}" is already in your library`);

  const { data, error } = await db
    .from('user_books')
    .insert({
      user_id: uid,
      book_id: bookId,
      status: mapStatusToDb(status),
      priority: extras.priority ?? null,
      started_at: extras.dateStarted ?? null,
      finished_at: extras.dateFinished ?? null,
      current_page: extras.progress ?? null,
    })
    .select(BOOK_SELECT)
    .single();

  if (error || !data) throw new Error(`Could not add book: ${error?.message}`);
  return mapSupabaseToBook(data as unknown as SupabaseBook);
}

/** Apply a partial Book update, mapped to database columns. */
export async function applyUpdate(userBookId: string, updates: Partial<Book>): Promise<void> {
  const { db, uid } = await session();
  const row: Record<string, unknown> = {};

  if ('status' in updates && updates.status) row.status = mapStatusToDb(updates.status);
  if ('priority' in updates) row.priority = updates.priority ?? null;
  if ('rating' in updates) row.rating = updates.rating ?? null;
  if ('review' in updates) row.review = updates.review ?? null;
  if ('progress' in updates) row.current_page = updates.progress ?? null;
  if ('dateStarted' in updates) row.started_at = updates.dateStarted ?? null;
  if ('dateFinished' in updates) row.finished_at = updates.dateFinished ?? null;
  if ('isTopFive' in updates) row.is_top_five = updates.isTopFive ?? false;
  if ('format' in updates) row.format = updates.format ?? 'book';

  if (Object.keys(row).length === 0) return;

  const { error } = await db.from('user_books').update(row).eq('id', userBookId).eq('user_id', uid);
  if (error) throw new Error(`Could not update book: ${error.message}`);
}

/** Book search, reusing the deployed app's public search endpoint. */
export async function searchBooks(query: string): Promise<Array<Record<string, unknown>>> {
  const base = process.env.SHELF_APP_URL ?? 'https://reading-tracker-chi.vercel.app';
  const res = await fetch(`${base}/api/search?q=${encodeURIComponent(query)}`);
  if (!res.ok) throw new Error(`Search failed: ${res.status}`);
  const body = await res.json();
  return body.books ?? [];
}
