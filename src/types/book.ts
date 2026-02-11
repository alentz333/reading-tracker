export type ReadingStatus = 'read' | 'reading' | 'want-to-read';

export interface Book {
  id: string;
  title: string;
  author: string;
  coverUrl?: string;
  isbn?: string;
  googleBooksId?: string;
  pageCount?: number;
  publishedYear?: number;
  publishedDate?: string;
  description?: string;
  status: ReadingStatus;
  rating?: number; // 1-5 stars
  progress?: number; // 0-100 percentage for reading
  dateStarted?: string;
  dateFinished?: string;
  review?: string;
  genres?: string[];
  addedAt?: string;
  source?: 'manual' | 'goodreads' | 'openlibrary' | 'google';
  isPublic?: boolean; // Default true - visible on profile
}

export interface OpenLibraryBook {
  key: string;
  title: string;
  author_name?: string[];
  cover_i?: number;
  isbn?: string[];
  number_of_pages_median?: number;
  first_publish_year?: number;
}

export interface GoodreadsCSVRow {
  'Book Id': string;
  Title: string;
  Author: string;
  'Author l-f': string;
  'Additional Authors': string;
  ISBN: string;
  ISBN13: string;
  'My Rating': string;
  'Average Rating': string;
  Publisher: string;
  Binding: string;
  'Number of Pages': string;
  'Year Published': string;
  'Original Publication Year': string;
  'Date Read': string;
  'Date Added': string;
  Bookshelves: string;
  'Bookshelves with positions': string;
  'Exclusive Shelf': string;
  'My Review': string;
  Spoiler: string;
  'Private Notes': string;
  'Read Count': string;
  'Owned Copies': string;
}

export interface ReadingStats {
  totalBooks: number;
  booksThisYear: number;
  pagesThisYear: number;
  averageRating: number;
  currentlyReading: number;
  wantToRead: number;
  streak?: number;
  byYear: Record<number, number>;
  byGenre: Record<string, number>;
}
