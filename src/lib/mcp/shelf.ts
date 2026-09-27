import type { SupabaseClient } from '@supabase/supabase-js';
import { Book, ReadingStatus } from '@/types/book';
import {
  BOOK_SELECT,
  mapStatusToDb,
  mapSupabaseToBook,
  type SupabaseBook,
} from '@/lib/supabase/book-mapping';

// Data access for the MCP tools, shared by both transports: the personal stdio
// server (mcp/server.ts) signs in with stored credentials, and the remote HTTP
// route (src/app/api/mcp) acts on the caller's OAuth access token. Neither uses
// the service-role key: each acts as one real user, so every query stays
// subject to the same row-level security the app relies on, and a bug here
// cannot reach another user's shelf.

export interface ShelfSession {
  db: SupabaseClient;
  uid: string;
}

export interface BookInput {
  title: string;
  author: string;
  isbn?: string;
  coverUrl?: string;
  pageCount?: number;
}

export type Shelf = ReturnType<typeof createShelf>;

/**
 * Bind the data operations to a session. The session is a function so the
 * stdio server can sign in lazily on the first tool call, rather than at
 * startup where a failure would close the connection before the user sees why.
 */
export function createShelf(session: () => Promise<ShelfSession>, appUrl: string) {
  async function getLibrary(): Promise<Book[]> {
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
  async function resolveCatalogBook(input: BookInput): Promise<string> {
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

  async function addToLibrary(input: BookInput, status: ReadingStatus, extras: Partial<Book>): Promise<Book> {
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
  async function applyUpdate(userBookId: string, updates: Partial<Book>): Promise<void> {
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

  /** Book search, reusing the app's public search endpoint. */
  async function searchBooks(query: string): Promise<Array<Record<string, unknown>>> {
    const res = await fetch(`${appUrl}/api/search?q=${encodeURIComponent(query)}`);
    if (!res.ok) throw new Error(`Search failed: ${res.status}`);
    const body = await res.json();
    return body.books ?? [];
  }

  return { getLibrary, addToLibrary, applyUpdate, searchBooks };
}
