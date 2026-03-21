import { Book, ReadingStats } from '@/types/book';

const STORAGE_KEY = 'reading-tracker-books';

export function getBooks(): Book[] {
  if (typeof window === 'undefined') return [];
  const data = localStorage.getItem(STORAGE_KEY);
  return data ? JSON.parse(data) : [];
}

export function saveBooks(books: Book[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(books));
}

export function addBook(book: Book): Book[] {
  const books = getBooks();
  books.unshift(book);
  saveBooks(books);
  return books;
}

export function updateBook(id: string, updates: Partial<Book>): Book[] {
  const books = getBooks();
  const index = books.findIndex(b => b.id === id);
  if (index !== -1) {
    books[index] = { ...books[index], ...updates };
    saveBooks(books);
  }
  return books;
}

export function deleteBook(id: string): Book[] {
  const books = getBooks().filter(b => b.id !== id);
  saveBooks(books);
  return books;
}

export function parseYear(dateValue?: string): number | null {
  if (!dateValue) return null;

  const yearMatch = dateValue.match(/^(\d{4})/);
  if (yearMatch) {
    return Number(yearMatch[1]);
  }

  const parsed = new Date(dateValue);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.getFullYear();
}

export function isPreviousReadLike(book: Book): boolean {
  if (book.isPreviousRead) return true;

  // Backward compatibility for earlier imports before isPreviousRead existed.
  return (
    book.status === 'read' &&
    book.source === 'manual' &&
    (book.author || '').trim().toLowerCase() === 'unknown author'
  );
}

export function getBookReadYear(book: Book): number | null {
  // Primary signal: explicit finish date
  const finishedYear = parseYear(book.dateFinished);
  if (finishedYear) return finishedYear;

  // Fallback for older entries created as "read" without a finish date
  if (book.status === 'read' && !isPreviousReadLike(book)) {
    return parseYear(book.addedAt);
  }

  return null;
}

export function getActiveReadBooks(books: Book[]): Book[] {
  return books.filter(book => book.status === 'read' && !isPreviousReadLike(book));
}

export function getActiveReadBooksThisYear(
  books: Book[],
  year: number = new Date().getFullYear()
): Book[] {
  return getActiveReadBooks(books).filter(book => getBookReadYear(book) === year);
}

export function calculateStats(books: Book[]): ReadingStats {
  const currentYear = new Date().getFullYear();
  const allReadBooks = books.filter(b => b.status === 'read');
  const activeReadBooks = getActiveReadBooks(books);

  const booksThisYear = getActiveReadBooksThisYear(books, currentYear);

  const pagesThisYear = booksThisYear.reduce((sum, b) => sum + (b.pageCount || 0), 0);

  const ratedBooks = activeReadBooks.filter(b => b.rating);
  const averageRating = ratedBooks.length > 0
    ? ratedBooks.reduce((sum, b) => sum + (b.rating || 0), 0) / ratedBooks.length
    : 0;

  const byYear: Record<number, number> = {};
  activeReadBooks.forEach(b => {
    const year = getBookReadYear(b);
    if (year) {
      byYear[year] = (byYear[year] || 0) + 1;
    }
  });

  const byGenre: Record<string, number> = {};
  activeReadBooks.forEach(b => {
    b.genres?.forEach(g => {
      byGenre[g] = (byGenre[g] || 0) + 1;
    });
  });

  return {
    totalBooks: allReadBooks.length,
    booksThisYear: booksThisYear.length,
    pagesThisYear,
    averageRating: Math.round(averageRating * 10) / 10,
    currentlyReading: books.filter(b => b.status === 'reading').length,
    wantToRead: books.filter(b => b.status === 'want-to-read').length,
    byYear,
    byGenre,
  };
}

export function generateId(): string {
  return `book-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
