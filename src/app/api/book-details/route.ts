import { NextRequest, NextResponse } from 'next/server';

const PROVIDER_TIMEOUT_MS = 5000;
const MAX_SERIES_BOOKS = 12;
// Open Library asks API consumers to identify themselves
const USER_AGENT = 'ReadingTracker/1.0 (alexlentz0@gmail.com)';

interface SeriesBook {
  olKey: string;
  title: string;
  author: string;
  coverUrl: string | null;
  publishedYear?: number;
}

interface BookDetails {
  description?: string;
  series?: {
    name: string;
    books: SeriesBook[];
  };
}

// Must be built per-request: AbortSignal.timeout starts counting at creation,
// so a shared signal would permanently abort all fetches after the first 5s
function olFetchOptions() {
  return {
    next: { revalidate: 86400 },
    headers: { 'User-Agent': USER_AGENT },
    signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
  };
}

function extractText(value: unknown): string | undefined {
  if (typeof value === 'string') return value.trim() || undefined;
  if (value && typeof value === 'object') {
    return extractText((value as Record<string, unknown>).value);
  }
  return undefined;
}

// Edition series strings are messy: "Mistborn -- [bk. 1]", "Harry Potter (1)",
// "The Stormlight Archive ;". Strip volume markers and punctuation to get a
// clean series name that can be counted and searched.
function cleanSeriesName(raw: string): string | undefined {
  // "Pocket -- 2658" style entries are numbered publisher series, not the
  // literary series the reader cares about
  if (/--\s*\d+\s*$/.test(raw)) return undefined;
  const cleaned = raw
    .replace(/--.*$/, '')
    .replace(/[([{]?\s*(bk|book|no|vol|volume|#)\.?\s*\d+.*$/i, '')
    .replace(/[(\[][^)\]]*[)\]]/g, '')
    .replace(/[;:,.]+\s*$/, '')
    .trim();
  // Drop junk like bare numbers or single characters
  if (cleaned.length < 2 || /^\d+$/.test(cleaned)) return undefined;
  return cleaned;
}

async function fetchWorkDescription(olKey: string): Promise<string | undefined> {
  const response = await fetch(`https://openlibrary.org${olKey}.json`, olFetchOptions());
  if (!response.ok) return undefined;
  const data = await response.json();
  return extractText(data.description);
}

// Finds the most common series names across the work's editions (translations
// and reissues each carry their own variant — "Mistborn", "The Mistborn Saga").
// Returns up to three variants by frequency; querying them together maximizes
// recall against Open Library's sparse series index.
async function fetchSeriesNames(olKey: string): Promise<string[]> {
  const response = await fetch(
    `https://openlibrary.org${olKey}/editions.json?limit=50`,
    olFetchOptions()
  );
  if (!response.ok) return [];
  const data = await response.json();

  const counts = new Map<string, number>();
  for (const entry of data.entries || []) {
    if (!Array.isArray(entry.series)) continue;
    for (const raw of entry.series) {
      if (typeof raw !== 'string') continue;
      const name = cleanSeriesName(raw);
      if (name) counts.set(name, (counts.get(name) || 0) + 1);
    }
  }

  // Names with digits or quotes ('Buch 2 aus "Harryz Zauberbox"') are box-set
  // or foreign variants — rank them below clean names regardless of count,
  // since the top name is also what the UI displays
  const junkRank = (name: string) => (/[\d"«»]/.test(name) ? 1 : 0);
  return [...counts.entries()]
    .sort((a, b) => junkRank(a[0]) - junkRank(b[0]) || b[1] - a[1])
    .slice(0, 3)
    .map(([name]) => name);
}

// Lucene special characters would break the field-scoped query
function sanitizePhrase(value: string): string {
  return value.replace(/[+\-!(){}[\]^"~*?:\\/|&]/g, ' ').replace(/\s+/g, ' ').trim();
}

async function searchOneSeries(seriesName: string, author: string): Promise<SeriesBook[]> {
  // Series entries nearly always share an author; the filter drops unrelated
  // works (e.g. commentary books) that mention the series name
  const query = author
    ? `series:"${seriesName}" AND author:"${author}"`
    : `series:"${seriesName}"`;

  // Work titles display cleaner than edition titles (editions are frequently
  // mislabeled); the English edition surfaced by lang=en still provides the
  // best cover art
  const fields = 'key,title,author_name,cover_i,first_publish_year,editions,editions.cover_i';
  const response = await fetch(
    `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&fields=${fields}&limit=30&lang=en`,
    olFetchOptions()
  );
  if (!response.ok) return [];
  const data = await response.json();

  const books: SeriesBook[] = [];
  for (const doc of data.docs || []) {
    if (typeof doc.key !== 'string' || typeof doc.title !== 'string') continue;
    const edition = (doc.editions as { docs?: Record<string, unknown>[] } | undefined)?.docs?.[0];
    const coverId = (typeof edition?.cover_i === 'number' ? edition.cover_i : undefined)
      ?? (typeof doc.cover_i === 'number' ? doc.cover_i : undefined);
    books.push({
      olKey: doc.key,
      title: doc.title,
      author: (Array.isArray(doc.author_name) ? doc.author_name[0] : undefined) || 'Unknown Author',
      coverUrl: coverId ? `https://covers.openlibrary.org/b/id/${coverId}-M.jpg` : null,
      publishedYear: typeof doc.first_publish_year === 'number' ? doc.first_publish_year : undefined,
    });
  }
  return books;
}

// Open Library mishandles OR-ed phrase queries (a zero-hit variant collapses
// the whole query), so each series-name variant is searched separately and
// the results merged.
async function fetchSeriesBooks(
  seriesNames: string[],
  author: string | null,
  excludeOlKey: string
): Promise<SeriesBook[]> {
  const names = seriesNames.map(sanitizePhrase).filter(Boolean);
  if (names.length === 0) return [];
  const cleanAuthor = author && author !== 'Unknown Author' ? sanitizePhrase(author) : '';

  const resultSets = await Promise.allSettled(
    names.map((name) => searchOneSeries(name, cleanAuthor))
  );

  const books: SeriesBook[] = [];
  const seen = new Set<string>([excludeOlKey]);
  const normalizeTitle = (title: string) =>
    title.toLowerCase().normalize('NFD').replace(/[^a-z0-9]/g, '');
  // A member titled exactly like the series is a box set or a mislabeled
  // edition; seeding with the series names also dedupes repeat titles
  const seenTitles = new Set<string>(names.map(normalizeTitle));
  for (const result of resultSets) {
    if (result.status !== 'fulfilled') continue;
    for (const book of result.value) {
      if (seen.has(book.olKey) || seenTitles.has(normalizeTitle(book.title))) continue;
      // Skip box sets and omnibus entries that pollute series listings
      if (/\bseries\b|\btrilogy\b|\bpack\b|box(ed)?\s*set|omnibus|collection|\b\d+\s*-\s*\d+\b/i.test(book.title)) continue;
      if ((book.title.match(/\//g) || []).length >= 2) continue;
      seen.add(book.olKey);
      seenTitles.add(normalizeTitle(book.title));
      books.push(book);
    }
  }

  books.sort((a, b) => (a.publishedYear ?? 9999) - (b.publishedYear ?? 9999));
  return books.slice(0, MAX_SERIES_BOOKS);
}

async function fetchGoogleDescription(googleBooksId: string): Promise<string | undefined> {
  const apiKey = process.env.GOOGLE_BOOKS_API_KEY;
  const keyParam = apiKey ? `?key=${apiKey}` : '';
  const response = await fetch(
    `https://www.googleapis.com/books/v1/volumes/${encodeURIComponent(googleBooksId)}${keyParam}`,
    { next: { revalidate: 86400 }, signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS) }
  );
  if (!response.ok) return undefined;
  const data = await response.json();
  const description = data?.volumeInfo?.description;
  if (typeof description !== 'string') return undefined;
  // Google descriptions arrive as HTML; reduce to plain text
  return description
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .trim() || undefined;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const olKey = searchParams.get('olKey');
  const googleBooksId = searchParams.get('googleBooksId');
  const author = searchParams.get('author');

  if (olKey && !/^\/works\/OL\d+W$/.test(olKey)) {
    return NextResponse.json({ error: 'Invalid olKey' }, { status: 400 });
  }
  if (!olKey && !googleBooksId) {
    return NextResponse.json({ error: 'olKey or googleBooksId required' }, { status: 400 });
  }

  const [olDescription, seriesNames, googleDescription] = await Promise.all([
    olKey ? fetchWorkDescription(olKey).catch(() => undefined) : undefined,
    olKey ? fetchSeriesNames(olKey).catch(() => [] as string[]) : ([] as string[]),
    googleBooksId ? fetchGoogleDescription(googleBooksId).catch(() => undefined) : undefined,
  ]);

  const details: BookDetails = {
    // Open Library descriptions read cleaner; Google fills the gaps
    description: olDescription || googleDescription,
  };

  if (seriesNames.length > 0 && olKey) {
    const books = await fetchSeriesBooks(seriesNames, author, olKey).catch(() => []);
    if (books.length > 0) {
      details.series = { name: seriesNames[0], books };
    }
  }

  return NextResponse.json(details, {
    headers: { 'Cache-Control': 'public, max-age=3600, s-maxage=86400' },
  });
}
