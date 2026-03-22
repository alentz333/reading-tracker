import { Book } from '@/types/book';
import { isPreviousReadBook } from '@/lib/previous-reads';

export interface NextReadSuggestion {
  book: Book | null;
  reasons: string[];
  consideredCount: number;
  analyzedReadCount: number;
  analyzedPreviousReadCount: number;
}

function normalizeToken(value?: string): string {
  return (value || '').trim().toLowerCase();
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

function parseDateValue(value?: string): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
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
