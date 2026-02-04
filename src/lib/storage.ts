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

export function calculateStats(books: Book[]): ReadingStats {
  const currentYear = new Date().getFullYear();
  const readBooks = books.filter(b => b.status === 'read');
  
  const booksThisYear = readBooks.filter(b => {
    if (!b.dateFinished) return false;
    return new Date(b.dateFinished).getFullYear() === currentYear;
  });
  
  const pagesThisYear = booksThisYear.reduce((sum, b) => sum + (b.pageCount || 0), 0);
  
  const ratedBooks = readBooks.filter(b => b.rating);
  const averageRating = ratedBooks.length > 0
    ? ratedBooks.reduce((sum, b) => sum + (b.rating || 0), 0) / ratedBooks.length
    : 0;
  
  const byYear: Record<number, number> = {};
  readBooks.forEach(b => {
    if (b.dateFinished) {
      const year = new Date(b.dateFinished).getFullYear();
      byYear[year] = (byYear[year] || 0) + 1;
    }
  });
  
  const byGenre: Record<string, number> = {};
  readBooks.forEach(b => {
    b.genres?.forEach(g => {
      byGenre[g] = (byGenre[g] || 0) + 1;
    });
  });
  
  return {
    totalBooks: readBooks.length,
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
