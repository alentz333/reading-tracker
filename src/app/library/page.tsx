'use client';

import { useState, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useBooks } from '@/hooks/useBooks';
import Header from '@/components/Header';
import BookCard from '@/components/BookCard';
import SortableBookList from '@/components/SortableBookList';
import { isPreviousReadBook } from '@/lib/previous-reads';
import { parseYear } from '@/lib/storage';

type FilterType = 'all' | 'reading' | 'read' | 'want' | 'dnf';
type SortType = 'recent' | 'title' | 'author' | 'rating' | 'priority';

function LibraryContent() {
  const searchParams = useSearchParams();
  const initialFilter = (searchParams.get('filter') as FilterType) || 'all';
  const [filter, setFilter] = useState<FilterType>(initialFilter);
  const [sortBy, setSortBy] = useState<SortType>(initialFilter === 'want' ? 'priority' : 'recent');
  // Narrows the Read tab to books finished this year; only that tab offers it
  const [readThisYearOnly, setReadThisYearOnly] = useState(false);

  const currentYear = new Date().getFullYear();

  const { books, loading, stats, updateBook, deleteBook, reorderBooks } = useBooks();

  const topFiveCount = useMemo(() => books.filter(b => b.isTopFive).length, [books]);

  const selectFilter = (key: FilterType) => {
    setFilter(key);
    // Priority ordering only exists on the Want to Read list
    if (key === 'want') {
      setSortBy('priority');
    } else if (sortBy === 'priority') {
      setSortBy('recent');
    }
    // Leaving the Read tab drops its year narrowing rather than keeping it
    // applied invisibly for when the user comes back
    if (key !== 'read') {
      setReadThisYearOnly(false);
    }
  };

  const filteredBooks = useMemo(() => {
    let filtered = books.filter(book => !isPreviousReadBook(book));

    // Apply filter
    switch (filter) {
      case 'reading':
        filtered = filtered.filter(b => b.status === 'reading');
        break;
      case 'read':
        filtered = filtered.filter(b => b.status === 'read');
        if (readThisYearOnly) {
          // Deliberately the finish date alone, not getBookReadYear: that
          // helper falls back to the date a book was added when it has no
          // finish date, which labels imported backlog as read this year.
          // A book with no finish date has an unknown read year, so it is
          // left out rather than guessed into the current one.
          filtered = filtered.filter(b => parseYear(b.dateFinished) === currentYear);
        }
        break;
      case 'want':
        filtered = filtered.filter(b => b.status === 'want-to-read');
        break;
      case 'dnf':
        filtered = filtered.filter(b => b.status === 'dnf');
        break;
    }

    // Apply sort
    switch (sortBy) {
      case 'priority':
        // Prioritized books first (1 = top), then unprioritized newest-first
        filtered.sort((a, b) => {
          const pa = a.priority ?? Infinity;
          const pb = b.priority ?? Infinity;
          if (pa !== pb) return pa - pb;
          return (b.addedAt || '').localeCompare(a.addedAt || '');
        });
        break;
      case 'title':
        filtered.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case 'author':
        filtered.sort((a, b) => a.author.localeCompare(b.author));
        break;
      case 'rating':
        filtered.sort((a, b) => (b.rating || 0) - (a.rating || 0));
        break;
      case 'recent':
      default:
        filtered.sort((a, b) => {
          const dateA = b.dateFinished || b.dateStarted || b.addedAt || '';
          const dateB = a.dateFinished || a.dateStarted || a.addedAt || '';
          return dateA.localeCompare(dateB);
        });
    }

    return filtered;
  }, [books, filter, sortBy, readThisYearOnly, currentYear]);

  const isPriorityMode = filter === 'want' && sortBy === 'priority';

  const filterLabels: Record<FilterType, string> = {
    all: '📚 All Books',
    reading: '📖 Currently Reading',
    read: '✅ Read',
    want: '💫 Want to Read',
    dnf: '🚫 Did Not Finish',
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl text-white/60">Loading your library...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Header stats={stats} />

      <main className="max-w-6xl mx-auto px-4 py-6">
        {/* Back Link */}
        <Link href="/" className="text-white/50 hover:text-white text-sm mb-4 inline-block">
          ← Back to Home
        </Link>

        <h1 className="text-2xl font-bold text-white mb-4">My Library</h1>

        {/* Library Tabs */}
        <div className="mb-6 flex items-center gap-2 border-b border-white/10 pb-3">
          <Link
            href="/library"
            className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-sm font-medium"
          >
            Library
          </Link>
          <Link
            href="/library/previous-reads"
            className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-white/80 text-sm font-medium transition-colors"
          >
            Previous Reads
          </Link>
        </div>

        {/* Filters & Sort */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div className="tabs">
            {(Object.keys(filterLabels) as FilterType[]).map(key => (
              <button
                key={key}
                className={`tab ${filter === key ? 'active' : ''}`}
                onClick={() => selectFilter(key)}
              >
                {filterLabels[key]}
              </button>
            ))}
          </div>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortType)}
            className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm text-white"
          >
            {filter === 'want' && <option value="priority">My Priority</option>}
            <option value="recent">Recently Added</option>
            <option value="title">Title A-Z</option>
            <option value="author">Author A-Z</option>
            <option value="rating">Highest Rated</option>
          </select>
        </div>

        {/* Read-tab year narrowing */}
        {filter === 'read' && (
          <div className="flex items-center gap-2 mb-4">
            {([
              { label: 'All time', value: false },
              { label: `Read in ${currentYear}`, value: true },
            ] as const).map(option => (
              <button
                key={option.label}
                onClick={() => setReadThisYearOnly(option.value)}
                aria-pressed={readThisYearOnly === option.value}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  readThisYearOnly === option.value
                    ? 'bg-green-500/25 text-green-300 border border-green-400/40'
                    : 'bg-white/5 text-white/60 border border-white/10 hover:bg-white/10'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        )}

        {/* Book Count */}
        <p className="text-white/50 text-sm mb-4">
          {filteredBooks.length} {filteredBooks.length === 1 ? 'book' : 'books'}
          {isPriorityMode && filteredBooks.length > 1 && (
            <span className="ml-2 text-indigo-400">· drag books to reorder your priority</span>
          )}
        </p>

        {/* Books Grid */}
        {filteredBooks.length > 0 ? (
          isPriorityMode ? (
            <SortableBookList
              books={filteredBooks}
              onReorder={reorderBooks}
              onUpdate={updateBook}
              onDelete={deleteBook}
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {filteredBooks.map(book => (
                <BookCard
                  key={book.id}
                  book={book}
                  onUpdate={updateBook}
                  onDelete={deleteBook}
                  topFiveFull={topFiveCount - (book.isTopFive ? 1 : 0) >= 5}
                />
              ))}
            </div>
          )
        ) : (
          <div className="empty-state py-12">
            <div className="empty-state-icon">📚</div>
            <div className="empty-state-title">No books here yet</div>
            <div className="empty-state-description">
              {filter === 'all'
                ? 'Start by searching for books to add to your library'
                : filter === 'read' && readThisYearOnly
                  ? `No books finished in ${currentYear} yet — switch to All time to see everything you've read`
                  : `No books in "${filterLabels[filter].replace(/📚|📖|✅|💫|🚫/, '').trim()}"`
              }
            </div>
            <Link href="/" className="btn btn-primary mt-4">
              Discover Books
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}

export default function LibraryPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl text-white/60">Loading...</div>
      </div>
    }>
      <LibraryContent />
    </Suspense>
  );
}
