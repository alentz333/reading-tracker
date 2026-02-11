'use client';

import { useState, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Book, ReadingStatus } from '@/types/book';
import { useBooks } from '@/hooks/useBooks';
import Header from '@/components/Header';
import BookCard from '@/components/BookCard';

type FilterType = 'all' | 'reading' | 'read' | 'want';

export default function LibraryPage() {
  const searchParams = useSearchParams();
  const initialFilter = (searchParams.get('filter') as FilterType) || 'all';
  const [filter, setFilter] = useState<FilterType>(initialFilter);
  const [sortBy, setSortBy] = useState<'recent' | 'title' | 'author' | 'rating'>('recent');
  
  const { books, loading, stats, updateBook, deleteBook } = useBooks();

  const filteredBooks = useMemo(() => {
    let filtered = [...books];
    
    // Apply filter
    switch (filter) {
      case 'reading':
        filtered = filtered.filter(b => b.status === 'reading');
        break;
      case 'read':
        filtered = filtered.filter(b => b.status === 'read');
        break;
      case 'want':
        filtered = filtered.filter(b => b.status === 'want-to-read');
        break;
    }
    
    // Apply sort
    switch (sortBy) {
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
          const dateA = b.dateFinished || b.dateStarted || b.dateAdded || '';
          const dateB = a.dateFinished || a.dateStarted || a.dateAdded || '';
          return dateA.localeCompare(dateB);
        });
    }
    
    return filtered;
  }, [books, filter, sortBy]);

  const filterLabels: Record<FilterType, string> = {
    all: '📚 All Books',
    reading: '📖 Currently Reading',
    read: '✅ Read',
    want: '💫 Want to Read',
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

        <h1 className="text-2xl font-bold text-white mb-6">My Library</h1>

        {/* Filters & Sort */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div className="tabs">
            {(Object.keys(filterLabels) as FilterType[]).map(key => (
              <button
                key={key}
                className={`tab ${filter === key ? 'active' : ''}`}
                onClick={() => setFilter(key)}
              >
                {filterLabels[key]}
              </button>
            ))}
          </div>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm text-white"
          >
            <option value="recent">Recently Added</option>
            <option value="title">Title A-Z</option>
            <option value="author">Author A-Z</option>
            <option value="rating">Highest Rated</option>
          </select>
        </div>

        {/* Book Count */}
        <p className="text-white/50 text-sm mb-4">
          {filteredBooks.length} {filteredBooks.length === 1 ? 'book' : 'books'}
        </p>

        {/* Books Grid */}
        {filteredBooks.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {filteredBooks.map(book => (
              <BookCard
                key={book.id}
                book={book}
                onUpdate={updateBook}
                onDelete={deleteBook}
              />
            ))}
          </div>
        ) : (
          <div className="empty-state py-12">
            <div className="empty-state-icon">📚</div>
            <div className="empty-state-title">No books here yet</div>
            <div className="empty-state-description">
              {filter === 'all' 
                ? 'Start by searching for books to add to your library'
                : `No books in "${filterLabels[filter].replace(/📚|📖|✅|💫 /, '')}"`
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
