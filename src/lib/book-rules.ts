import { Book, ReadingStatus } from '@/types/book';

// The rules about what a write *means*, kept free of IO and of React so that
// every client applies them identically. The web app reaches them through
// BooksProvider; the MCP server imports them directly. Persistence lives
// elsewhere (lib/supabase/books.ts for the app, mcp/shelf.ts for the server) —
// nothing here touches a database or the browser.

export const TOP_FIVE_LIMIT = 5;

export function todayIso(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * The field changes implied by moving a book to a new status.
 *
 * Previously each surface had its own version of this and they disagreed: the
 * card set dates but never progress, the edit modal set progress but reset it
 * to zero even for a book already being read, and the add path did a third
 * thing. This is the single reconciled rule.
 */
export function statusChangeUpdates(
  current: Pick<Book, 'status' | 'dateStarted' | 'dateFinished' | 'progress'>,
  next: ReadingStatus,
  today: string = todayIso()
): Partial<Book> {
  const updates: Partial<Book> = { status: next };

  switch (next) {
    case 'read':
      // Keep the original finish date if the book already had one, so
      // re-saving a finished book doesn't restamp it as finished today.
      updates.progress = 100;
      updates.dateFinished = current.dateFinished || today;
      break;

    case 'reading':
      updates.dateStarted = current.dateStarted || today;
      updates.dateFinished = undefined;
      // Only a book that wasn't already being read starts at zero. Re-saving a
      // book you are part-way through used to reset it to 0%.
      updates.progress = current.status === 'reading' ? current.progress ?? 0 : 0;
      break;

    case 'want-to-read':
      updates.progress = 0;
      updates.dateFinished = undefined;
      break;

    case 'dnf':
      // Progress is the point of a DNF — it records how far you got — but a
      // book you abandoned was never finished.
      updates.dateFinished = undefined;
      break;
  }

  return updates;
}

/**
 * Priority that lands a book at the top of Want to Read.
 *
 * Lower sorts higher and an unset priority sorts last, so taking one below the
 * current minimum avoids renumbering every other row. Values may reach zero and
 * below; the sort handles it and a manual reorder renormalises to 1..n.
 */
export function topOfWantToReadPriority(books: Book[]): number {
  const priorities = books
    .filter(b => b.status === 'want-to-read' && typeof b.priority === 'number')
    .map(b => b.priority as number);

  return priorities.length > 0 ? Math.min(...priorities) - 1 : 1;
}

/** Whether the Top 5 slots are taken, ignoring the book being edited. */
export function isTopFiveFull(books: Book[], excludingId?: string): boolean {
  return books.filter(b => b.isTopFive && b.id !== excludingId).length >= TOP_FIVE_LIMIT;
}

/** True when this change moves a book into Want to Read from somewhere else. */
export function isEnteringWantToRead(
  previousStatus: ReadingStatus | undefined,
  nextStatus: ReadingStatus | undefined
): boolean {
  return nextStatus === 'want-to-read' && previousStatus !== 'want-to-read';
}
