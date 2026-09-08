import { Book } from '@/types/book';

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const DAYS_PER_WEEK = 7;

// Normalize a stored date to a UTC midnight timestamp so day math never drifts
// across DST boundaries or the user's timezone.
function parseDateOnly(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  // Postgres `date` columns and everything the app writes locally are YYYY-MM-DD
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return Date.UTC(Number(isoMatch[1]), Number(isoMatch[2]) - 1, Number(isoMatch[3]));
  }

  // Imported values can use other formats (Goodreads writes `2024/03/15`)
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;
  return Date.UTC(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
}

/**
 * Days a finished book took to read, or null when it can't be determined.
 * Books without a start date — most Goodreads imports and previous reads —
 * return null and are left out of duration stats rather than counted as zero.
 */
export function getReadingDurationDays(book: Book): number | null {
  if (book.status !== 'read') return null;
  if (!book.dateStarted || !book.dateFinished) return null;

  const started = parseDateOnly(book.dateStarted);
  const finished = parseDateOnly(book.dateFinished);
  if (started === null || finished === null) return null;

  const days = Math.round((finished - started) / MS_PER_DAY);
  return days < 0 ? null : days; // Finished before started — bad data, not a duration
}

/** Human-readable duration. Weeks once a read runs a week or longer, days below that. */
export function formatReadingDuration(days: number): string {
  if (days <= 0) return 'Same day';

  if (days < DAYS_PER_WEEK) {
    const whole = Math.max(1, Math.round(days));
    return `${whole} day${whole === 1 ? '' : 's'}`;
  }

  const weeks = days / DAYS_PER_WEEK;
  const rounded = weeks < 10 ? Math.round(weeks * 10) / 10 : Math.round(weeks);
  return `${rounded} week${rounded === 1 ? '' : 's'}`;
}

/**
 * Average days-to-finish across the books that record both dates.
 * `sampleSize` is how many books that was, so callers can show the average
 * alongside the slice of the library it actually covers.
 */
export function getAverageReadingDuration(books: Book[]): { averageDays: number; sampleSize: number } {
  const durations = books
    .map(getReadingDurationDays)
    .filter((days): days is number => days !== null);

  if (durations.length === 0) return { averageDays: 0, sampleSize: 0 };

  const total = durations.reduce((sum, days) => sum + days, 0);
  return { averageDays: total / durations.length, sampleSize: durations.length };
}
