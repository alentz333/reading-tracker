import { NextRequest, NextResponse } from 'next/server';

const PROVIDER_TIMEOUT_MS = 5000;
const MAX_RESULTS = 20;
// Open Library asks API consumers to identify themselves
const USER_AGENT = 'ReadingTracker/1.0 (alexlentz0@gmail.com)';

interface SearchBook {
  key?: string;
  googleBooksId?: string;
  title: string;
  author: string;
  coverUrl: string | null;
  isbn?: string;
  pageCount?: number;
  publishedYear?: number;
  description?: string;
  source: 'openlibrary' | 'google' | 'hardcover';
}

function extractText(value: unknown): string | undefined {
  if (!value) return undefined;

  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed || undefined;
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      const extracted = extractText(entry);
      if (extracted) return extracted;
    }
    return undefined;
  }

  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;

    const fromValue = extractText(record.value);
    if (fromValue) return fromValue;

    const fromText = extractText(record.text);
    if (fromText) return fromText;
  }

  return undefined;
}

// Returns bare ISBN digits when the query looks like an ISBN-10/13, else null
function detectIsbn(query: string): string | null {
  const digits = query.replace(/[-\s]/g, '');
  if (/^\d{13}$/.test(digits) || /^\d{9}[\dXx]$/.test(digits)) {
    return digits.toUpperCase();
  }
  return null;
}

function pickIsbn(...candidates: unknown[]): string | undefined {
  const flat: string[] = [];
  for (const candidate of candidates) {
    if (typeof candidate === 'string') flat.push(candidate);
    else if (Array.isArray(candidate)) {
      for (const entry of candidate) {
        if (typeof entry === 'string') flat.push(entry);
      }
    }
  }
  return (
    flat.find((value) => /^\d{13}$/.test(value)) ||
    flat.find((value) => /^\d{9}[\dXx]$/i.test(value))
  );
}

// Normalized title+author key used to dedupe the same book across providers.
// All whitespace is removed so "J. R. R. Tolkien" and "J.R.R. Tolkien" match.
function getFingerprint(title: string, author: string): string {
  const norm = (value: string) =>
    value
      .toLowerCase()
      .split(':')[0]
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/^\s*(the|a|an)\s+/, '')
      .replace(/\s+/g, '');
  return `${norm(title)}|${norm(author)}`;
}

async function searchOpenLibrary(query: string, isbn: string | null): Promise<SearchBook[]> {
  let olQuery: string;
  if (isbn) {
    olQuery = `isbn:${isbn}`;
  } else {
    // Lucene special characters would break the field-scoped query below
    const sanitized = query.replace(/[+\-!(){}[\]^"~*?:\\/|&]/g, ' ').replace(/\s+/g, ' ').trim();
    // Field-scoped clauses rank exact title/author matches far better than
    // Open Library's bare keyword search; the general clause keeps recall.
    olQuery = sanitized
      ? `title:(${sanitized}) OR author:(${sanitized}) OR (${sanitized})`
      : query;
  }

  const fields = [
    'key', 'title', 'author_name', 'cover_i', 'isbn', 'number_of_pages_median',
    'first_publish_year', 'first_sentence',
    'editions', 'editions.key', 'editions.isbn', 'editions.cover_i', 'editions.language',
  ].join(',');

  const response = await fetch(
    `https://openlibrary.org/search.json?q=${encodeURIComponent(olQuery)}&limit=${MAX_RESULTS}&lang=en&fields=${fields}`,
    // Open Library results are stable; cache per-query server-side for a day
    {
      next: { revalidate: 86400 },
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
    }
  );

  if (!response.ok) {
    throw new Error('Open Library API error');
  }

  const data = await response.json();

  return (data.docs || []).map((doc: Record<string, unknown>): SearchBook => {
    // lang=en surfaces the best-matching (English) edition per work, whose
    // ISBN/cover are far more reliable than the work-level isbn[0]
    const editions = doc.editions as { docs?: Record<string, unknown>[] } | undefined;
    const edition = editions?.docs?.[0];
    const isbnValue = pickIsbn(edition?.isbn, doc.isbn);

    const coverId = (typeof edition?.cover_i === 'number' ? edition.cover_i : undefined)
      ?? (typeof doc.cover_i === 'number' ? doc.cover_i : undefined);
    const coverUrl = coverId
      ? `https://covers.openlibrary.org/b/id/${coverId}-M.jpg`
      : isbnValue
        ? `https://covers.openlibrary.org/b/isbn/${isbnValue}-M.jpg`
        : null;

    return {
      key: typeof doc.key === 'string' ? doc.key : undefined,
      title: typeof doc.title === 'string' ? doc.title : 'Unknown Title',
      author: (Array.isArray(doc.author_name) ? (doc.author_name[0] as string) : undefined) || 'Unknown Author',
      coverUrl,
      isbn: isbnValue,
      pageCount: typeof doc.number_of_pages_median === 'number' ? doc.number_of_pages_median : undefined,
      publishedYear: typeof doc.first_publish_year === 'number' ? doc.first_publish_year : undefined,
      description: extractText(doc.first_sentence),
      source: 'openlibrary',
    };
  });
}

// Resolves to null when the provider is not configured, so an unconfigured
// provider is never mistaken for a successful-but-empty search.
async function searchGoogleBooks(query: string, isbn: string | null): Promise<SearchBook[] | null> {
  const apiKey = process.env.GOOGLE_BOOKS_API_KEY;
  if (!apiKey) return null;

  const gQuery = isbn ? `isbn:${isbn}` : query;
  const fields = 'items(id,volumeInfo(title,authors,publishedDate,description,industryIdentifiers,pageCount,imageLinks))';

  const response = await fetch(
    `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(gQuery)}&maxResults=10&printType=books&fields=${encodeURIComponent(fields)}&key=${apiKey}`,
    {
      next: { revalidate: 86400 },
      signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
    }
  );

  if (!response.ok) {
    throw new Error('Google Books API error');
  }

  const data = await response.json();

  return (data.items || []).map((item: Record<string, unknown>): SearchBook => {
    const info = (item.volumeInfo || {}) as Record<string, unknown>;
    const identifiers = Array.isArray(info.industryIdentifiers)
      ? (info.industryIdentifiers as { type?: string; identifier?: string }[])
      : [];
    const isbnValue =
      identifiers.find((id) => id.type === 'ISBN_13')?.identifier ||
      identifiers.find((id) => id.type === 'ISBN_10')?.identifier;

    const imageLinks = info.imageLinks as { thumbnail?: string } | undefined;
    const coverUrl = imageLinks?.thumbnail
      ? imageLinks.thumbnail.replace(/^http:/, 'https:').replace(/&edge=curl/, '')
      : null;

    const publishedYear = typeof info.publishedDate === 'string'
      ? Number(info.publishedDate.slice(0, 4)) || undefined
      : undefined;

    return {
      googleBooksId: typeof item.id === 'string' ? item.id : undefined,
      title: typeof info.title === 'string' ? info.title : 'Unknown Title',
      author: (Array.isArray(info.authors) ? (info.authors[0] as string) : undefined) || 'Unknown Author',
      coverUrl,
      isbn: isbnValue,
      pageCount: typeof info.pageCount === 'number' ? info.pageCount : undefined,
      publishedYear,
      description: typeof info.description === 'string' ? info.description : undefined,
      source: 'google',
    };
  });
}

async function searchHardcover(query: string, isbn: string | null): Promise<SearchBook[] | null> {
  const token = process.env.HARDCOVER_API_TOKEN;
  if (!token) return null;

  const response = await fetch('https://api.hardcover.app/v1/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      query: `query Search($query: String!) {
        search(query: $query, query_type: "Book", per_page: 10, page: 1) { results }
      }`,
      variables: { query: isbn ?? query },
    }),
    signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error('Hardcover API error');
  }

  const data = await response.json();
  // results is a raw Typesense response: { hits: [{ document: {...} }] }
  const hits = data?.data?.search?.results?.hits;
  if (!Array.isArray(hits)) return [];

  return hits.map((hit: Record<string, unknown>): SearchBook => {
    const doc = (hit.document || {}) as Record<string, unknown>;
    const image = doc.image as { url?: string } | undefined;
    const contributions = Array.isArray(doc.author_names) ? (doc.author_names as string[]) : [];

    return {
      title: typeof doc.title === 'string' ? doc.title : 'Unknown Title',
      author: contributions[0] || 'Unknown Author',
      coverUrl: typeof image?.url === 'string' ? image.url : null,
      isbn: pickIsbn(doc.isbns),
      pageCount: typeof doc.pages === 'number' ? doc.pages : undefined,
      publishedYear: typeof doc.release_year === 'number' ? doc.release_year : undefined,
      description: typeof doc.description === 'string' ? doc.description : undefined,
      source: 'hardcover',
    };
  });
}

// Open Library results lead (their olKey powers genre enrichment at save time);
// secondary providers backfill missing fields on duplicates and append new books.
function mergeResults(primary: SearchBook[], ...secondary: SearchBook[][]): SearchBook[] {
  const merged = [...primary];
  const byFingerprint = new Map<string, SearchBook>();
  const byIsbn = new Map<string, SearchBook>();

  for (const book of merged) {
    byFingerprint.set(getFingerprint(book.title, book.author), book);
    if (book.isbn) byIsbn.set(book.isbn, book);
  }

  for (const results of secondary) {
    for (const book of results) {
      const fingerprint = getFingerprint(book.title, book.author);
      const existing = (book.isbn && byIsbn.get(book.isbn)) || byFingerprint.get(fingerprint);

      if (existing) {
        existing.isbn ||= book.isbn;
        existing.coverUrl ||= book.coverUrl;
        existing.pageCount ||= book.pageCount;
        existing.publishedYear ||= book.publishedYear;
        existing.description ||= book.description;
        continue;
      }

      merged.push(book);
      byFingerprint.set(fingerprint, book);
      if (book.isbn) byIsbn.set(book.isbn, book);
    }
  }

  return merged.slice(0, MAX_RESULTS);
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('q');

  if (!query) {
    return NextResponse.json({ error: 'Query required' }, { status: 400 });
  }

  const normalized = query.trim().replace(/\s+/g, ' ');
  if (normalized.length < 2) {
    return NextResponse.json({ books: [] });
  }

  const isbn = detectIsbn(normalized);

  const [olResult, googleResult, hardcoverResult] = await Promise.allSettled([
    searchOpenLibrary(normalized, isbn),
    searchGoogleBooks(normalized, isbn),
    searchHardcover(normalized, isbn),
  ]);

  for (const result of [olResult, googleResult, hardcoverResult]) {
    if (result.status === 'rejected') {
      console.error('Search provider error:', result.reason);
    }
  }

  // 500 only when every *configured* provider failed (null = not configured)
  const anySucceeded = [olResult, googleResult, hardcoverResult].some(
    (result) => result.status === 'fulfilled' && result.value !== null
  );
  if (!anySucceeded) {
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }

  const books = mergeResults(
    olResult.status === 'fulfilled' ? olResult.value ?? [] : [],
    googleResult.status === 'fulfilled' ? googleResult.value ?? [] : [],
    hardcoverResult.status === 'fulfilled' ? hardcoverResult.value ?? [] : []
  );

  return NextResponse.json(
    { books },
    { headers: { 'Cache-Control': 'public, max-age=3600, s-maxage=86400' } }
  );
}
