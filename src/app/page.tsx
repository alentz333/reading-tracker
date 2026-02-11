'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Book, ReadingStatus } from '@/types/book';
import { useBooks } from '@/hooks/useBooks';
import Header from '@/components/Header';
import BookSearch from '@/components/BookSearch';
import { SwipeStack } from '@/components/SwipeCard';

type ViewMode = 'library' | 'discover';

export default function Home() {
  const { books, loading, stats, addBook, updateBook, deleteBook, isAuthenticated } = useBooks();
  const [viewMode, setViewMode] = useState<ViewMode>('library');
  const [searchResults, setSearchResults] = useState<Book[]>([]);
  const [showSearch, setShowSearch] = useState(false);

  const currentlyReading = books.filter(b => b.status === 'reading');
  const recentlyRead = books.filter(b => b.status === 'read').slice(0, 4);
  const wantToRead = books.filter(b => b.status === 'want-to-read').slice(0, 6);

  const handleAddBook = async (book: Book, status?: ReadingStatus) => {
    const bookToAdd = { ...book, status: status || book.status };
    if (status === 'reading') {
      bookToAdd.dateStarted = new Date().toISOString().split('T')[0];
    }
    await addBook(bookToAdd);
  };

  const handleSearchResults = (results: Book[]) => {
    setSearchResults(results.filter(r => !books.find(b => b.googleBooksId === r.googleBooksId)));
    if (results.length > 0) {
      setViewMode('discover');
    }
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
        {/* View Toggle */}
        <div className="flex items-center justify-between mb-6">
          <div className="tabs">
            <button 
              className={`tab ${viewMode === 'library' ? 'active' : ''}`}
              onClick={() => setViewMode('library')}
            >
              📚 Library
            </button>
            <button 
              className={`tab ${viewMode === 'discover' ? 'active' : ''}`}
              onClick={() => setViewMode('discover')}
            >
              ✨ Discover
            </button>
          </div>
          
          <button 
            className="btn btn-secondary"
            onClick={() => setShowSearch(!showSearch)}
          >
            🔍 Search
          </button>
        </div>

        {/* Search Panel */}
        {showSearch && (
          <div className="bento-card mb-6 animate-fade-in">
            <BookSearch onBookSelect={handleAddBook} onResults={handleSearchResults} />
          </div>
        )}

        {viewMode === 'library' ? (
          /* Bento Grid Library View */
          <div className="bento-grid">
            {/* Stats Cards */}
            <div className="bento-card span-1">
              <div className="stat-value">{stats.totalBooks}</div>
              <div className="stat-label">Books Read</div>
            </div>
            
            <div className="bento-card span-1">
              <div className="stat-value">{stats.currentlyReading}</div>
              <div className="stat-label">Reading</div>
            </div>
            
            <div className="bento-card span-1">
              <div className="flex items-center gap-2">
                <span className="streak-fire">🔥</span>
                <div className="stat-value">{stats.streak || 0}</div>
              </div>
              <div className="stat-label">Day Streak</div>
            </div>
            
            <div className="bento-card span-1">
              <div className="stat-value">{stats.wantToRead}</div>
              <div className="stat-label">Want to Read</div>
            </div>

            {/* Currently Reading - Large Card */}
            <div className="bento-card span-2 row-2">
              <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-4">
                📖 Currently Reading
              </h2>
              {currentlyReading.length > 0 ? (
                <div className="space-y-4">
                  {currentlyReading.slice(0, 2).map(book => (
                    <div key={book.id} className="flex gap-3">
                      {book.coverUrl ? (
                        <img 
                          src={book.coverUrl} 
                          alt={book.title}
                          className="w-16 h-24 object-cover rounded-lg shadow-lg"
                        />
                      ) : (
                        <div className="w-16 h-24 book-cover-placeholder text-2xl">📖</div>
                      )}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-white truncate">{book.title}</h3>
                        <p className="text-sm text-white/50 truncate">{book.author}</p>
                        <div className="reading-progress mt-2">
                          <div 
                            className="reading-progress-bar" 
                            style={{ width: `${book.progress || 30}%` }}
                          />
                        </div>
                        <p className="text-xs text-white/40 mt-1">{book.progress || 30}% complete</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state py-8">
                  <div className="empty-state-icon">📚</div>
                  <div className="empty-state-description">Start reading something!</div>
                </div>
              )}
            </div>

            {/* Quick Add */}
            <div className="bento-card span-2">
              <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-3">
                ✨ Quick Add
              </h2>
              <button 
                className="btn btn-primary w-full"
                onClick={() => { setShowSearch(true); setViewMode('discover'); }}
              >
                🔍 Search Books
              </button>
              <div className="flex gap-2 mt-3">
                <button className="btn btn-secondary flex-1 text-sm">
                  📷 Scan
                </button>
                <button className="btn btn-secondary flex-1 text-sm">
                  📥 Import
                </button>
              </div>
            </div>

            {/* Recently Read */}
            <div className="bento-card span-2 md:span-3 lg:span-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider">
                  ✅ Recently Read
                </h2>
                <Link href="/library?filter=read" className="text-xs text-indigo-400 hover:underline">
                  View all →
                </Link>
              </div>
              {recentlyRead.length > 0 ? (
                <div className="flex gap-3 overflow-x-auto pb-2">
                  {recentlyRead.map(book => (
                    <div key={book.id} className="flex-shrink-0 w-24 group cursor-pointer">
                      {book.coverUrl ? (
                        <img 
                          src={book.coverUrl} 
                          alt={book.title}
                          className="book-cover w-full"
                        />
                      ) : (
                        <div className="book-cover-placeholder w-full">📖</div>
                      )}
                      <div className="mt-2">
                        <div className="star-rating justify-center">
                          {[1, 2, 3, 4, 5].map(star => (
                            <span key={star} className={`star text-xs ${star <= (book.rating || 0) ? 'filled' : ''}`}>
                              ⭐
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state py-6">
                  <div className="empty-state-description">No books read yet</div>
                </div>
              )}
            </div>

            {/* Want to Read */}
            <div className="bento-card span-2 md:span-3 lg:span-2 row-2">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider">
                  📚 Want to Read
                </h2>
                <Link href="/library?filter=want" className="text-xs text-indigo-400 hover:underline">
                  View all →
                </Link>
              </div>
              {wantToRead.length > 0 ? (
                <div className="grid grid-cols-3 gap-2">
                  {wantToRead.map(book => (
                    <div key={book.id} className="cursor-pointer group">
                      {book.coverUrl ? (
                        <img 
                          src={book.coverUrl} 
                          alt={book.title}
                          className="book-cover w-full"
                        />
                      ) : (
                        <div className="book-cover-placeholder w-full text-lg">📖</div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state py-6">
                  <div className="empty-state-description">Swipe to discover books!</div>
                </div>
              )}
            </div>

            {/* Profile / Social */}
            {isAuthenticated && (
              <div className="bento-card span-2">
                <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-3">
                  👤 Profile
                </h2>
                <div className="flex gap-3">
                  <Link href="/profile" className="btn btn-secondary flex-1 text-sm">
                    My Profile
                  </Link>
                  <Link href="/clubs" className="btn btn-secondary flex-1 text-sm">
                    Book Clubs
                  </Link>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Discover / Swipe View */
          <div className="animate-slide-up">
            <div className="text-center mb-6">
              <h2 className="text-xl font-semibold text-white mb-2">Discover Books</h2>
              <p className="text-white/50 text-sm">Swipe left to save, right to skip, up for reading now</p>
            </div>
            
            {searchResults.length > 0 ? (
              <SwipeStack 
                books={searchResults}
                onAddBook={handleAddBook}
                onSkip={() => {}}
              />
            ) : (
              <div className="empty-state py-12">
                <div className="empty-state-icon">🔍</div>
                <div className="empty-state-title">Search for books</div>
                <div className="empty-state-description">
                  Find your next read by searching above
                </div>
                <button 
                  className="btn btn-primary mt-4"
                  onClick={() => setShowSearch(true)}
                >
                  Start Searching
                </button>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
