'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Book, ReadingStatus } from '@/types/book';
import { useBooks } from '@/hooks/useBooks';
import { useGamification } from '@/hooks/useGamification';
import Header from '@/components/Header';
import BookSearch from '@/components/BookSearch';

export default function Home() {
  const { books, loading, stats, addBook, updateBook, deleteBook, isAuthenticated } = useBooks();
  const { stats: gameStats, userQuests, onBookStarted, onBookFinished, loading: gameLoading } = useGamification();
  const [showSearch, setShowSearch] = useState(false);

  const currentlyReading = books.filter(b => b.status === 'reading');
  const recentlyRead = books.filter(b => b.status === 'read').slice(0, 6);
  const wantToRead = books.filter(b => b.status === 'want-to-read').slice(0, 8);

  const handleAddBook = async (book: Book, status?: ReadingStatus) => {
    const bookToAdd = { ...book, status: status || book.status };
    if (status === 'reading') {
      bookToAdd.dateStarted = new Date().toISOString().split('T')[0];
    }
    const success = await addBook(bookToAdd);
    
    if (success && status === 'reading') {
      await onBookStarted(book.id);
    }
    
    if (success) {
      setShowSearch(false);
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
    <div className="min-h-screen bg-[#0a0a0b]">
      <Header stats={stats} />
      
      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Stats Bar */}
        <div className="flex items-center justify-between mb-8 p-4 bg-white/5 rounded-xl border border-white/10">
          <div className="flex items-center gap-6">
            {isAuthenticated && gameStats && (
              <div className="flex items-center gap-2">
                <span className="text-2xl">🏆</span>
                <div>
                  <div className="text-sm text-white/50">Level {gameStats.level}</div>
                  <div className="text-xs text-white/30">{gameStats.xp} XP</div>
                </div>
              </div>
            )}
            <div className="text-center">
              <div className="text-2xl font-bold text-white">{stats.totalBooks}</div>
              <div className="text-xs text-white/50">Books Read</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-white">{stats.currentlyReading}</div>
              <div className="text-xs text-white/50">Reading</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-white">{stats.wantToRead}</div>
              <div className="text-xs text-white/50">Want to Read</div>
            </div>
            {gameStats && gameStats.currentStreak > 0 && (
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-400">🔥 {gameStats.currentStreak}</div>
                <div className="text-xs text-white/50">Day Streak</div>
              </div>
            )}
          </div>
          <button 
            onClick={() => setShowSearch(!showSearch)}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium transition-colors"
          >
            + Add Book
          </button>
        </div>

        {/* Search Panel */}
        {showSearch && (
          <div className="mb-8 relative z-50">
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-lg font-semibold text-white">Search Books</h2>
              <button 
                onClick={() => setShowSearch(false)}
                className="text-white/50 hover:text-white"
              >
                ✕ Close
              </button>
            </div>
            <BookSearch onBookSelect={handleAddBook} />
          </div>
        )}

        {/* Currently Reading */}
        {currentlyReading.length > 0 && (
          <section className="mb-10">
            <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
              📖 Currently Reading
            </h2>
            <div className="space-y-4">
              {currentlyReading.map(book => (
                <div key={book.id} className="flex gap-4 p-4 bg-white/5 rounded-xl border border-white/10">
                  {book.coverUrl ? (
                    <img 
                      src={book.coverUrl} 
                      alt={book.title}
                      className="w-16 h-24 object-cover rounded-lg shadow-lg"
                    />
                  ) : (
                    <div className="w-16 h-24 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center text-2xl">📖</div>
                  )}
                  <div className="flex-1">
                    <h3 className="font-semibold text-white">{book.title}</h3>
                    <p className="text-sm text-white/50">{book.author}</p>
                    <div className="mt-3">
                      <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all"
                          style={{ width: `${book.progress || 0}%` }}
                        />
                      </div>
                      <p className="text-xs text-white/40 mt-1">{book.progress || 0}% complete</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Recently Read */}
        {recentlyRead.length > 0 && (
          <section className="mb-10">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                ✅ Recently Read
              </h2>
              <Link href="/library?filter=read" className="text-sm text-indigo-400 hover:underline">
                View all →
              </Link>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-4">
              {recentlyRead.map(book => (
                <div key={book.id} className="group">
                  {book.coverUrl ? (
                    <img 
                      src={book.coverUrl} 
                      alt={book.title}
                      className="w-full aspect-[2/3] object-cover rounded-lg shadow-lg group-hover:shadow-xl transition-shadow"
                    />
                  ) : (
                    <div className="w-full aspect-[2/3] bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center text-3xl">📖</div>
                  )}
                  <div className="mt-2 text-center text-sm text-yellow-400">
                    {'★'.repeat(book.rating || 0)}
                    <span className="text-white/20">{'★'.repeat(5 - (book.rating || 0))}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Want to Read */}
        {wantToRead.length > 0 && (
          <section className="mb-10">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                📚 Want to Read
              </h2>
              <Link href="/library?filter=want" className="text-sm text-indigo-400 hover:underline">
                View all →
              </Link>
            </div>
            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-3">
              {wantToRead.map(book => (
                <div key={book.id} className="group cursor-pointer">
                  {book.coverUrl ? (
                    <img 
                      src={book.coverUrl} 
                      alt={book.title}
                      className="w-full aspect-[2/3] object-cover rounded-lg shadow-md group-hover:shadow-lg group-hover:scale-105 transition-all"
                    />
                  ) : (
                    <div className="w-full aspect-[2/3] bg-gradient-to-br from-blue-500 to-cyan-600 rounded-lg flex items-center justify-center text-2xl group-hover:scale-105 transition-transform">📖</div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Empty State */}
        {books.length === 0 && (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">📚</div>
            <h2 className="text-2xl font-semibold text-white mb-2">Your library is empty</h2>
            <p className="text-white/50 mb-6">Start by adding some books you want to read!</p>
            <button 
              onClick={() => setShowSearch(true)}
              className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium transition-colors"
            >
              🔍 Search for Books
            </button>
          </div>
        )}

        {/* Quick Links */}
        {isAuthenticated && (
          <section className="mt-10 pt-8 border-t border-white/10">
            <div className="flex flex-wrap gap-3">
              <Link 
                href="/library" 
                className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white/70 rounded-lg transition-colors"
              >
                📖 Full Library
              </Link>
              <Link 
                href="/profile" 
                className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white/70 rounded-lg transition-colors"
              >
                👤 Profile
              </Link>
              <Link 
                href="/clubs" 
                className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white/70 rounded-lg transition-colors"
              >
                👥 Book Clubs
              </Link>
              <Link 
                href="/quests" 
                className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white/70 rounded-lg transition-colors"
              >
                📜 Quests
              </Link>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
