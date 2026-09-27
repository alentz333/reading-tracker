#!/usr/bin/env -S npx tsx
import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/server';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { Book, ReadingStatus } from '@/types/book';
import { calculateStats } from '@/lib/storage';
import { statusChangeUpdates, isTopFiveFull, topOfWantToReadPriority } from '@/lib/book-rules';
import { parseYear } from '@/lib/storage';
import * as shelf from './shelf';

// A personal, single-user MCP server over stdio. Every write goes through the
// same rules in lib/book-rules.ts that the web app uses, so finishing a book
// here records a finish date and shelving one lands it on top of Want to Read,
// exactly as it would in the UI.

const STATUSES = ['want-to-read', 'reading', 'read', 'dnf'] as const;

const text = (value: unknown) => ({
  content: [{ type: 'text' as const, text: typeof value === 'string' ? value : JSON.stringify(value, null, 2) }],
});

/** Books are easier to name than to reference by id, so accept either. */
function resolveBook(books: Book[], reference: string): Book {
  const byId = books.find(b => b.id === reference);
  if (byId) return byId;

  const needle = reference.trim().toLowerCase();
  const matches = books.filter(b => b.title.toLowerCase().includes(needle));

  if (matches.length === 1) return matches[0];
  if (matches.length === 0) throw new Error(`No book in your library matches "${reference}"`);
  throw new Error(
    `"${reference}" matches ${matches.length} books — be more specific: ` +
      matches.slice(0, 8).map(b => `"${b.title}"`).join(', ')
  );
}

const summarise = (b: Book) => ({
  id: b.id,
  title: b.title,
  author: b.author,
  status: b.status,
  rating: b.rating,
  pageCount: b.pageCount,
  dateStarted: b.dateStarted,
  dateFinished: b.dateFinished,
});

function buildServer(): McpServer {
  const server = new McpServer({ name: 'shelf', version: '0.1.0' });

  server.registerTool(
    'search_books',
    {
      title: 'Search books',
      description:
        'Search for books by title, author or ISBN across Open Library, Google Books and Hardcover. ' +
        'Use this to find a book before adding it. Does not read the user library.',
      inputSchema: z.object({ query: z.string().min(2).describe('Title, author or ISBN') }),
    },
    async ({ query }) => text(await shelf.searchBooks(query))
  );

  server.registerTool(
    'get_library',
    {
      title: 'Get library',
      description:
        "The user's own books. Filter by status, and optionally by the year a book was finished. " +
        'Use this before recommending or comparing books so suggestions reflect what they have actually read.',
      inputSchema: z.object({
        status: z.enum(STATUSES).optional().describe('Only books with this status'),
        finishedInYear: z.number().int().optional().describe('Only books finished in this calendar year'),
      }),
    },
    async ({ status, finishedInYear }) => {
      let books = await shelf.getLibrary();
      if (status) books = books.filter(b => b.status === status);
      if (finishedInYear) books = books.filter(b => parseYear(b.dateFinished) === finishedInYear);
      return text({ count: books.length, books: books.map(summarise) });
    }
  );

  server.registerTool(
    'add_book',
    {
      title: 'Add book',
      description:
        'Add a book to the library. Prefer calling search_books first and passing its title, author and isbn ' +
        'so the catalog entry carries a cover and page count. Adding to want-to-read places it at the top of the list.',
      inputSchema: z.object({
        title: z.string(),
        author: z.string(),
        status: z.enum(STATUSES).default('want-to-read'),
        isbn: z.string().optional(),
        coverUrl: z.string().optional(),
        pageCount: z.number().int().positive().optional(),
      }),
    },
    async ({ title, author, status, isbn, coverUrl, pageCount }) => {
      const library = await shelf.getLibrary();
      const rules = statusChangeUpdates({ status }, status);
      const priority =
        status === 'want-to-read' ? topOfWantToReadPriority(library) : undefined;

      const added = await shelf.addToLibrary(
        { title, author, isbn, coverUrl, pageCount },
        status,
        { ...rules, priority }
      );
      return text({ added: summarise(added) });
    }
  );

  server.registerTool(
    'update_book_status',
    {
      title: 'Update book status',
      description:
        'Move a book between want-to-read, reading, read and dnf. Dates and progress are set automatically: ' +
        'starting a book records the start date, finishing it records the finish date, and shelving it puts it ' +
        'on top of Want to Read. Identify the book by title or id.',
      inputSchema: z.object({
        book: z.string().describe('Book title (or id) as it appears in the library'),
        status: z.enum(STATUSES),
      }),
    },
    async ({ book, status }) => {
      const library = await shelf.getLibrary();
      const target = resolveBook(library, book);

      const updates: Partial<Book> = statusChangeUpdates(target, status as ReadingStatus);
      if (status === 'want-to-read' && target.status !== 'want-to-read') {
        updates.priority = topOfWantToReadPriority(library);
      }

      await shelf.applyUpdate(target.id, updates);
      return text({ updated: { ...summarise(target), ...updates } });
    }
  );

  server.registerTool(
    'rate_and_review',
    {
      title: 'Rate and review',
      description:
        'Set a 1-5 star rating and/or a written review on a book, and optionally mark it as one of the ' +
        "user's Top 5 recommended books. Identify the book by title or id.",
      inputSchema: z.object({
        book: z.string(),
        rating: z.number().int().min(1).max(5).optional(),
        review: z.string().optional(),
        topFive: z.boolean().optional().describe('Showcase under Top 5 Recommended (max five books)'),
      }),
    },
    async ({ book, rating, review, topFive }) => {
      const library = await shelf.getLibrary();
      const target = resolveBook(library, book);

      if (topFive === true && isTopFiveFull(library, target.id)) {
        throw new Error('Top 5 is already full — remove another pick first');
      }

      const updates: Partial<Book> = {};
      if (rating !== undefined) updates.rating = rating;
      if (review !== undefined) updates.review = review;
      if (topFive !== undefined) updates.isTopFive = topFive;

      await shelf.applyUpdate(target.id, updates);
      return text({ updated: { ...summarise(target), ...updates } });
    }
  );

  server.registerTool(
    'get_reading_stats',
    {
      title: 'Get reading stats',
      description: 'Totals for the library: books read, books and pages this year, average rating, and counts by year and genre.',
      inputSchema: z.object({}),
    },
    async () => text(calculateStats(await shelf.getLibrary()))
  );

  return server;
}

function main() {
  // No await here: the server must answer initialize and tools/list without a
  // database round trip, so the connection is made on the first tool call.
  serveStdio(() => buildServer(), {
    onerror: error => console.error('[shelf-mcp]', error.message),
  });
}

try {
  main();
} catch (error) {
  console.error('[shelf-mcp] failed to start:', error instanceof Error ? error.message : error);
  process.exit(1);
}
