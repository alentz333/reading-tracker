import { Book } from '@/types/book';
import { isPreviousReadBook } from '@/lib/previous-reads';

export interface NextReadSuggestion {
  book: Book | null;
  reasons: string[];
  consideredCount: number;
  analyzedReadCount: number;
  analyzedPreviousReadCount: number;
}

export interface NewBookSuggestion {
  book: Book | null;
  reasons: string[];
  consideredCount: number;
  searchedQueries: string[];
  analyzedReadCount: number;
  analyzedPreviousReadCount: number;
  fingerprint: string | null;
}

export interface NewBookSuggestionOptions {
  excludeFingerprints?: string[];
  dislikedAuthors?: string[];
  dislikedTitleTerms?: string[];
}

interface QuerySeed {
  query: string;
  reason: string;
}

interface SearchApiBook {
  key?: string;
  title?: string;
  author?: string;
  coverUrl?: string | null;
  isbn?: string;
  pageCount?: number;
  publishedYear?: number;
}

const TITLE_STOP_WORDS = new Set([
  'about',
  'after',
  'again',
  'against',
  'among',
  'around',
  'because',
  'before',
  'between',
  'book',
  'books',
  'from',
  'into',
  'just',
  'more',
  'most',
  'novel',
  'novels',
  'only',
  'other',
  'over',
  'same',
  'some',
  'such',
  'than',
  'that',
  'their',
  'there',
  'these',
  'they',
  'this',
  'those',
  'through',
  'under',
  'very',
  'what',
  'when',
  'which',
  'with',
  'your',
]);

function normalizeToken(value?: string): string {
  return (value || '').trim().toLowerCase();
}

function normalizeTitle(value?: string): string {
  return normalizeToken(value).replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}

export function getBookFingerprint(title?: string, author?: string): string {
  return `${normalizeTitle(title)}::${normalizeToken(author)}`;
}

export function extractTitleKeywords(title?: string): string[] {
  const normalizedTitle = normalizeTitle(title);
  if (!normalizedTitle) return [];

  const keywords = normalizedTitle
    .split(' ')
    .map((token) => token.trim())
    .filter((token) => token.length >= 4)
    .filter((token) => !TITLE_STOP_WORDS.has(token));

  return Array.from(new Set(keywords)).slice(0, 6);
}

function parseDateValue(value?: string): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;

  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2;
  }

  return sorted[middle];
}

function buildDiscoverySeeds(books: Book[]): QuerySeed[] {
  const readHistory = books.filter(book => book.status === 'read');

  const authorCounts: Record<string, { name: string; count: number }> = {};
  const genreCounts: Record<string, number> = {};

  readHistory.forEach((book) => {
    const authorKey = normalizeToken(book.author);
    if (authorKey && authorKey !== 'unknown author') {
      if (!authorCounts[authorKey]) {
        authorCounts[authorKey] = { name: book.author, count: 0 };
      }
      authorCounts[authorKey].count += 1;
    }

    (book.genres || []).forEach((genre) => {
      const genreKey = normalizeToken(genre);
      if (genreKey) {
        genreCounts[genreKey] = (genreCounts[genreKey] || 0) + 1;
      }
    });
  });

  const topAuthors = Object.values(authorCounts)
    .sort((a, b) => b.count - a.count)
    .slice(0, 3)
    .map((entry) => entry.name);

  const topRatedBooks = [...readHistory]
    .filter((book) => (book.rating || 0) >= 4)
    .sort((a, b) => (b.rating || 0) - (a.rating || 0))
    .slice(0, 2);

  const topGenres = Object.entries(genreCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([genre]) => genre);

  const seeds: QuerySeed[] = [];

  topAuthors.forEach((author) => {
    seeds.push({
      query: author,
      reason: `You have a strong history with books by ${author}.`,
    });
  });

  topRatedBooks.forEach((book) => {
    seeds.push({
      query: `${book.title} similar books`,
      reason: `It is related to books you've rated highly like ${book.title}.`,
    });
  });

  topGenres.forEach((genre) => {
    seeds.push({
      query: `${genre} novels`,
      reason: `It aligns with your frequently read genre: ${genre}.`,
    });
  });

  if (seeds.length === 0) {
    seeds.push(
      {
        query: 'best contemporary fiction books',
        reason: 'It broadens your library with a high-signal contemporary pick.',
      },
      {
        query: 'award winning science fiction books',
        reason: 'It adds a critically acclaimed option outside your current list.',
      }
    );
  }

  const deduped = new Map<string, QuerySeed>();
  seeds.forEach((seed) => {
    const key = normalizeToken(seed.query);
    if (!deduped.has(key)) deduped.set(key, seed);
  });

  return Array.from(deduped.values()).slice(0, 6);
}

export function suggestNextRead(books: Book[]): NextReadSuggestion {
  const readHistory = books.filter(book => book.status === 'read');
  const previousReadCount = readHistory.filter(isPreviousReadBook).length;
  const wantToRead = books.filter(book => book.status === 'want-to-read');

  if (wantToRead.length === 0) {
    return {
      book: null,
      reasons: ['Add at least one book to Want to Read to get a recommendation.'],
      consideredCount: 0,
      analyzedReadCount: readHistory.length,
      analyzedPreviousReadCount: previousReadCount,
    };
  }

  const authorCounts: Record<string, number> = {};
  const genreCounts: Record<string, number> = {};

  readHistory.forEach(book => {
    const authorKey = normalizeToken(book.author);
    if (authorKey) {
      authorCounts[authorKey] = (authorCounts[authorKey] || 0) + 1;
    }

    (book.genres || []).forEach(genre => {
      const genreKey = normalizeToken(genre);
      if (genreKey) {
        genreCounts[genreKey] = (genreCounts[genreKey] || 0) + 1;
      }
    });
  });

  const topGenres = Object.entries(genreCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([genre]) => genre);

  const preferredPageCount = (() => {
    const stronglyRatedPages = readHistory
      .filter(book => (book.rating || 0) >= 4 && typeof book.pageCount === 'number')
      .map(book => book.pageCount as number);

    if (stronglyRatedPages.length > 0) {
      return median(stronglyRatedPages);
    }

    const allPages = readHistory
      .filter(book => typeof book.pageCount === 'number')
      .map(book => book.pageCount as number);

    return allPages.length > 0 ? median(allPages) : null;
  })();

  const wantToReadDates = wantToRead
    .map(book => parseDateValue(book.addedAt))
    .filter((value): value is number => value !== null);

  const oldestWantToReadDate = wantToReadDates.length > 0 ? Math.min(...wantToReadDates) : null;
  const newestWantToReadDate = wantToReadDates.length > 0 ? Math.max(...wantToReadDates) : null;

  const scoredCandidates = wantToRead.map(book => {
    let score = 0;
    const weightedReasons: Array<{ text: string; weight: number }> = [];

    const authorKey = normalizeToken(book.author);
    const sameAuthorReadCount = authorCounts[authorKey] || 0;

    if (sameAuthorReadCount > 0) {
      const authorScore = 30 + Math.min(15, (sameAuthorReadCount - 1) * 4);
      score += authorScore;
      weightedReasons.push({
        text: `You have already finished ${sameAuthorReadCount} book${sameAuthorReadCount > 1 ? 's' : ''} by ${book.author}.`,
        weight: authorScore,
      });
    } else {
      score += 4;
    }

    if (topGenres.length > 0 && (book.genres || []).length > 0) {
      const genreMatches = (book.genres || [])
        .map(genre => normalizeToken(genre))
        .filter(genre => topGenres.includes(genre));

      if (genreMatches.length > 0) {
        const genreScore = genreMatches.length * 12;
        score += genreScore;
        weightedReasons.push({
          text: `It matches your frequent genres: ${genreMatches.join(', ')}.`,
          weight: genreScore,
        });
      }
    }

    if (preferredPageCount && book.pageCount) {
      const pageDistance = Math.abs(book.pageCount - preferredPageCount);
      const pageScore = Math.max(0, 14 - pageDistance / 25);

      if (pageScore > 0) {
        score += pageScore;

        if (pageScore >= 6) {
          weightedReasons.push({
            text: `Its length (${book.pageCount} pages) is close to your typical finished-book range.`,
            weight: pageScore,
          });
        }
      }
    }

    const addedAtMs = parseDateValue(book.addedAt);
    if (
      addedAtMs !== null &&
      oldestWantToReadDate !== null &&
      newestWantToReadDate !== null &&
      newestWantToReadDate > oldestWantToReadDate
    ) {
      const normalizedAge = (newestWantToReadDate - addedAtMs) / (newestWantToReadDate - oldestWantToReadDate);
      const backlogScore = normalizedAge * 10;
      score += backlogScore;

      if (backlogScore >= 6) {
        weightedReasons.push({
          text: 'It has been in your Want to Read list for a while, so this clears backlog.',
          weight: backlogScore,
        });
      }
    }

    if (weightedReasons.length === 0) {
      weightedReasons.push({
        text: 'It is a strong next option from your current Want to Read list.',
        weight: 1,
      });
    }

    const reasons = weightedReasons
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 3)
      .map(reason => reason.text);

    return { book, score, reasons };
  });

  scoredCandidates.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;

    const dateA = parseDateValue(a.book.addedAt) || Number.MAX_SAFE_INTEGER;
    const dateB = parseDateValue(b.book.addedAt) || Number.MAX_SAFE_INTEGER;
    if (dateA !== dateB) return dateA - dateB;

    return a.book.title.localeCompare(b.book.title);
  });

  const winner = scoredCandidates[0];

  return {
    book: winner.book,
    reasons: winner.reasons,
    consideredCount: wantToRead.length,
    analyzedReadCount: readHistory.length,
    analyzedPreviousReadCount: previousReadCount,
  };
}

export async function suggestNewBookOutsideLibrary(
  books: Book[],
  options: NewBookSuggestionOptions = {}
): Promise<NewBookSuggestion> {
  const readHistory = books.filter(book => book.status === 'read');
  const previousReadCount = readHistory.filter(isPreviousReadBook).length;
  const seeds = buildDiscoverySeeds(books);

  const excludedFingerprints = new Set(
    (options.excludeFingerprints || []).map((value) => normalizeToken(value)).filter(Boolean)
  );

  const dislikedAuthors = new Set(
    (options.dislikedAuthors || []).map((value) => normalizeToken(value)).filter(Boolean)
  );

  const dislikedTitleTerms = new Set(
    (options.dislikedTitleTerms || []).map((value) => normalizeToken(value)).filter((value) => value.length >= 3)
  );

  const existingFingerprints = new Set(
    books
      .map((book) => getBookFingerprint(book.title, book.author))
      .filter((value) => value !== '::')
  );

  const existingIsbns = new Set(
    books
      .map((book) => normalizeToken(book.isbn))
      .filter(Boolean)
  );

  const existingOpenLibraryKeys = new Set(
    books
      .map((book) => normalizeToken(book.olKey))
      .filter(Boolean)
  );

  const seenCandidateFingerprints = new Set<string>();
  const discoveredCandidates: Array<{
    book: Book;
    seed: QuerySeed;
    seedIndex: number;
    fingerprint: string;
  }> = [];

  for (let seedIndex = 0; seedIndex < seeds.length; seedIndex++) {
    const seed = seeds[seedIndex];

    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(seed.query)}`);
      if (!response.ok) continue;

      const payload = (await response.json()) as { books?: SearchApiBook[] };
      const candidates = payload.books || [];

      candidates.forEach((candidate) => {
        const candidateFingerprint = getBookFingerprint(candidate.title, candidate.author);
        const isbnKey = normalizeToken(candidate.isbn);
        const olKey = normalizeToken(candidate.key);
        const authorKey = normalizeToken(candidate.author);
        const titleTokens = extractTitleKeywords(candidate.title);

        if (!candidate.title || candidateFingerprint === '::') return;
        if (existingFingerprints.has(candidateFingerprint)) return;
        if (excludedFingerprints.has(candidateFingerprint)) return;
        if (isbnKey && existingIsbns.has(isbnKey)) return;
        if (olKey && existingOpenLibraryKeys.has(olKey)) return;
        if (seenCandidateFingerprints.has(candidateFingerprint)) return;

        if (authorKey && dislikedAuthors.has(authorKey)) return;
        if (titleTokens.some((token) => dislikedTitleTerms.has(token))) return;

        const candidateBook: Book = {
          id: `temp-${candidate.key || candidate.isbn || candidateFingerprint.replace(/\s+/g, '-')}`,
          title: candidate.title,
          author: candidate.author || 'Unknown Author',
          status: 'want-to-read',
          coverUrl: candidate.coverUrl || undefined,
          pageCount: candidate.pageCount,
          isbn: candidate.isbn,
          olKey: candidate.key,
          publishedYear: candidate.publishedYear,
          addedAt: new Date().toISOString(),
          source: 'openlibrary',
          isPublic: true,
        };

        seenCandidateFingerprints.add(candidateFingerprint);
        discoveredCandidates.push({
          book: candidateBook,
          seed,
          seedIndex,
          fingerprint: candidateFingerprint,
        });
      });

      if (discoveredCandidates.length >= 24) break;
    } catch (error) {
      console.error('Recommendation search failed for query:', seed.query, error);
    }
  }

  if (discoveredCandidates.length === 0) {
    return {
      book: null,
      reasons: ['No fresh suggestions found right now. Try again in a moment or add a few more rated reads.'],
      consideredCount: 0,
      searchedQueries: seeds.map((seed) => seed.query),
      analyzedReadCount: readHistory.length,
      analyzedPreviousReadCount: previousReadCount,
      fingerprint: null,
    };
  }

  const authorCounts: Record<string, number> = {};
  readHistory.forEach((book) => {
    const authorKey = normalizeToken(book.author);
    if (authorKey) {
      authorCounts[authorKey] = (authorCounts[authorKey] || 0) + 1;
    }
  });

  const preferredPageCount = (() => {
    const highRatedPages = readHistory
      .filter((book) => (book.rating || 0) >= 4 && typeof book.pageCount === 'number')
      .map((book) => book.pageCount as number);

    if (highRatedPages.length > 0) return median(highRatedPages);

    const allPages = readHistory
      .filter((book) => typeof book.pageCount === 'number')
      .map((book) => book.pageCount as number);

    return allPages.length > 0 ? median(allPages) : null;
  })();

  const scored = discoveredCandidates.map(({ book, seed, seedIndex, fingerprint }) => {
    let score = 18 - seedIndex;
    const weightedReasons: Array<{ text: string; weight: number }> = [
      { text: seed.reason, weight: Math.max(1, 8 - seedIndex) },
    ];

    const authorKey = normalizeToken(book.author);
    const priorAuthorReads = authorCounts[authorKey] || 0;

    if (priorAuthorReads > 0) {
      const authorScore = 24 + Math.min(14, (priorAuthorReads - 1) * 5);
      score += authorScore;
      weightedReasons.push({
        text: `You've already finished ${priorAuthorReads} book${priorAuthorReads > 1 ? 's' : ''} by ${book.author}.`,
        weight: authorScore,
      });
    }

    if (preferredPageCount && book.pageCount) {
      const pageDistance = Math.abs(book.pageCount - preferredPageCount);
      const pageScore = Math.max(0, 14 - pageDistance / 30);
      score += pageScore;

      if (pageScore >= 5) {
        weightedReasons.push({
          text: `Length fit: ${book.pageCount} pages is close to your usual finish range.`,
          weight: pageScore,
        });
      }
    }

    if (book.publishedYear) {
      const publishedRecencyScore = Math.max(0, 8 - Math.abs(book.publishedYear - 2018) / 3);
      score += publishedRecencyScore;

      if (publishedRecencyScore >= 4) {
        weightedReasons.push({
          text: `Recent enough to feel current (published ${book.publishedYear}).`,
          weight: publishedRecencyScore,
        });
      }
    }

    const reasons = Array.from(
      new Set(
        weightedReasons
          .sort((a, b) => b.weight - a.weight)
          .slice(0, 3)
          .map((entry) => entry.text)
      )
    );

    return { book, score, reasons, fingerprint };
  });

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;

    const dateA = parseDateValue(a.book.addedAt) || 0;
    const dateB = parseDateValue(b.book.addedAt) || 0;
    if (dateA !== dateB) return dateB - dateA;

    return a.book.title.localeCompare(b.book.title);
  });

  const winner = scored[0];

  return {
    book: winner.book,
    reasons: winner.reasons,
    consideredCount: discoveredCandidates.length,
    searchedQueries: seeds.map((seed) => seed.query),
    analyzedReadCount: readHistory.length,
    analyzedPreviousReadCount: previousReadCount,
    fingerprint: winner.fingerprint,
  };
}
