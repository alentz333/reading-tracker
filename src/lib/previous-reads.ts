import { Book } from '@/types/book';
import { generateId } from '@/lib/storage';

export const PREVIOUS_READ_NOTE_TAG = '[previous-read]';

export interface PreviousReadRow {
  title: string;
  yearRead?: number;
}

export function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      cells.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  cells.push(current.trim());
  return cells;
}

export function normalizeYear(value?: string): number | undefined {
  if (!value) return undefined;

  const trimmed = value.trim();
  if (!trimmed) return undefined;

  const fullYearMatch = trimmed.match(/\b(\d{4})\b/);
  if (fullYearMatch) {
    const year = Number.parseInt(fullYearMatch[1], 10);
    if (!Number.isNaN(year) && year >= 1000 && year <= 9999) {
      return year;
    }
  }

  const shortDateMatch = trimmed.match(/\b\d{1,2}[\/.\-]\d{1,2}[\/.\-](\d{2})\b/);
  if (shortDateMatch) {
    const twoDigitYear = Number.parseInt(shortDateMatch[1], 10);
    if (!Number.isNaN(twoDigitYear)) {
      return twoDigitYear <= 50 ? 2000 + twoDigitYear : 1900 + twoDigitYear;
    }
  }

  const twoDigitOnlyMatch = trimmed.match(/^\d{2}$/);
  if (twoDigitOnlyMatch) {
    const twoDigitYear = Number.parseInt(twoDigitOnlyMatch[0], 10);
    if (!Number.isNaN(twoDigitYear)) {
      return twoDigitYear <= 50 ? 2000 + twoDigitYear : 1900 + twoDigitYear;
    }
  }

  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.getFullYear();
  }

  return undefined;
}

export function parsePreviousReadsCsv(text: string): PreviousReadRow[] {
  const lines = text
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);

  if (lines.length === 0) return [];

  const firstRow = parseCsvLine(lines[0]).map(cell => cell.toLowerCase().trim());
  const looksLikeHeader = firstRow.some(cell => cell.includes('title') || cell === 'book' || cell.includes('year'));

  const titleIndex = looksLikeHeader
    ? Math.max(0, firstRow.findIndex(cell => cell.includes('title') || cell === 'book'))
    : 0;

  const yearIndex = looksLikeHeader
    ? firstRow.findIndex(
      cell => cell.includes('year') || (cell.includes('date') && cell.includes('read'))
    )
    : 1;

  const shelfIndex = looksLikeHeader
    ? firstRow.findIndex(cell => cell.includes('shelf'))
    : -1;

  const startIndex = looksLikeHeader ? 1 : 0;
  const rows: PreviousReadRow[] = [];

  for (let i = startIndex; i < lines.length; i++) {
    const cells = parseCsvLine(lines[i]);
    const title = (cells[titleIndex] || cells[0] || '').trim();
    if (!title) continue;

    const shelf = shelfIndex >= 0 ? (cells[shelfIndex] || '').trim().toLowerCase() : '';
    if (shelf && shelf !== 'read') continue;

    const yearRaw = yearIndex >= 0 ? cells[yearIndex] : cells[1];
    rows.push({
      title,
      yearRead: normalizeYear(yearRaw),
    });
  }

  return rows;
}

export function isPreviousReadBook(book: Book): boolean {
  if (book.isPreviousRead) return true;

  // Backward compatibility for earlier imports before isPreviousRead existed.
  return (
    book.status === 'read' &&
    book.source === 'manual' &&
    (book.author || '').trim().toLowerCase() === 'unknown author'
  );
}

export function getBookReadYear(book: Book): number | undefined {
  if (book.dateFinished) {
    const directYear = normalizeYear(book.dateFinished);
    if (directYear) return directYear;

    const parsed = new Date(book.dateFinished);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.getFullYear();
    }
  }

  return undefined;
}

export function createPreviousReadBook(title: string, yearRead?: number): Book {
  return {
    id: generateId(),
    title,
    author: 'Unknown Author',
    status: 'read',
    dateFinished: yearRead ? `${yearRead}-01-01` : undefined,
    addedAt: new Date().toISOString(),
    source: 'manual',
    isPreviousRead: true,
  };
}
