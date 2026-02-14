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
  const [finishingBook, setFinishingBook] = useState<string | null>(null);
  const [pendingRating, setPendingRating] = useState<number>(0);
  const [editingBook, setEditingBook] = useState<Book | null>(null);
  const [editRating, setEditRating] = useState<number>(0);
  const [editReview, setEditReview] = useState<string>('');

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

  const handleProgressChange = (bookId: string, progress: number) => {
    updateBook(bookId, { progress });
  };

  const handleMarkAsRead = (bookId: string) => {
    setFinishingBook(bookId);
    setPendingRating(0);
  };

  const confirmFinishBook = async (bookId: string) => {
    await updateBook(bookId, { 
      status: 'read', 
      progress: 100,
      rating: pendingRating || undefined,
      dateFinished: new Date().toISOString().split('T')[0]
    });
    await onBookFinished(bookId);
    setFinishingBook(null);
    setPendingRating(0);
  };

  const handleStopReading = (bookId: string) => {
    updateBook(bookId, { status: 'want-to-read', progress: 0 });
  };

  const openEditBook = (book: Book) => {
    setEditingBook(book);
    setEditRating(book.rating || 0);
    setEditReview(book.review || '');
  };

  const saveEditBook = async () => {
    if (!editingBook) return;
    await updateBook(editingBook.id, {
      rating: editRating || undefined,
      review: editReview || undefined,
    });
    setEditingBook(null);
    setEditRating(0);
    setEditReview('');
  };

  const closeEditBook = () => {
    setEditingBook(null);
    setEditRating(0);
    setEditReview('');
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
      
      {/* Edit Book Modal */}
      {editingBook && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1a1b] rounded-2xl max-w-md w-full p-6 border border-white/10">
            <div className="flex gap-4 mb-6">
              {editingBook.coverUrl ? (
                <img 
                  src={editingBook.coverUrl} 
                  alt={editingBook.title}
                  className="w-20 h-28 object-cover rounded-lg shadow-lg"
                />
              ) : (
                <div className="w-20 h-28 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center text-2xl">📖</div>
              )}
              <div>
                <h3 className="font-semibold text-white text-lg">{editingBook.title}</h3>
                <p className="text-sm text-white/50">{editingBook.author}</p>
                {editingBook.dateFinished && (
                  <p className="text-xs text-white/30 mt-1">Finished {editingBook.dateFinished}</p>
                )}
              </div>
            </div>
            
            {/* Rating */}
            <div className="mb-4">
              <label className="text-sm text-white/60 block mb-2">Your Rating</label>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map(star => (
                  <button
                    key={star}
                    onClick={() => setEditRating(star)}
                    className={`text-3xl transition-transform hover:scale-110 ${
                      star <= editRating ? 'text-yellow-400' : 'text-white/20'
                    }`}
                  >
                    ★
                  </button>
                ))}
                {editRating > 0 && (
                  <button 
                    onClick={() => setEditRating(0)}
                    className="ml-3 text-xs text-white/40 hover:text-white/60"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
            
            {/* Review */}
            <div className="mb-6">
              <label className="text-sm text-white/60 block mb-2">Your Review</label>
              <textarea
                value={editReview}
                onChange={(e) => setEditReview(e.target.value)}
                placeholder="What did you think of this book?"
                className="w-full h-32 bg-white/5 border border-white/10 rounded-lg p-3 text-white placeholder-white/30 resize-none focus:outline-none focus:border-indigo-500"
              />
            </div>
            
            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={saveEditBook}
                className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium transition-colors"
              >
                Save Changes
              </button>
              <button
                onClick={closeEditBook}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white/70 rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      
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
                <div key={book.id} className="p-4 bg-white/5 rounded-xl border border-white/10">
                  <div className="flex gap-4">
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
                      
                      {/* Progress Section */}
                      <div className="mt-3">
                        <div className="flex items-center gap-3">
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={book.progress || 0}
                            onChange={(e) => handleProgressChange(book.id, parseInt(e.target.value))}
                            className="flex-1 h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                          />
                          <span className="text-sm text-white/60 w-12 text-right">{book.progress || 0}%</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Action Buttons */}
                  {finishingBook === book.id ? (
                    <div className="mt-4 p-3 bg-white/5 rounded-lg">
                      <p className="text-sm text-white/70 mb-2">Rate this book:</p>
                      <div className="flex items-center gap-1 mb-3">
                        {[1, 2, 3, 4, 5].map(star => (
                          <button
                            key={star}
                            onClick={() => setPendingRating(star)}
                            className={`text-2xl transition-transform hover:scale-110 ${
                              star <= pendingRating ? 'text-yellow-400' : 'text-white/20'
                            }`}
                          >
                            ★
                          </button>
                        ))}
                        {pendingRating > 0 && (
                          <button 
                            onClick={() => setPendingRating(0)}
                            className="ml-2 text-xs text-white/40 hover:text-white/60"
                          >
                            Clear
                          </button>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => confirmFinishBook(book.id)}
                          className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg text-sm font-medium transition-colors"
                        >
                          ✓ Confirm Finished
                        </button>
                        <button
                          onClick={() => setFinishingBook(null)}
                          className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white/70 rounded-lg text-sm transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-4 flex gap-2">
                      <button
                        onClick={() => handleMarkAsRead(book.id)}
                        className="px-3 py-1.5 bg-green-600/20 hover:bg-green-600/30 text-green-400 rounded-lg text-sm transition-colors"
                      >
                        ✓ Mark as Read
                      </button>
                      <button
                        onClick={() => handleStopReading(book.id)}
                        className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white/50 rounded-lg text-sm transition-colors"
                      >
                        ✕ Stop Reading
                      </button>
                    </div>
                  )}
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
                <div 
                  key={book.id} 
                  className="group cursor-pointer"
                  onClick={() => openEditBook(book)}
                >
                  <div className="relative">
                    {book.coverUrl ? (
                      <img 
                        src={book.coverUrl} 
                        alt={book.title}
                        className="w-full aspect-[2/3] object-cover rounded-lg shadow-lg group-hover:shadow-xl group-hover:ring-2 group-hover:ring-indigo-500 transition-all"
                      />
                    ) : (
                      <div className="w-full aspect-[2/3] bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center text-3xl group-hover:ring-2 group-hover:ring-indigo-500 transition-all">📖</div>
                    )}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 rounded-lg flex items-center justify-center transition-all">
                      <span className="text-white opacity-0 group-hover:opacity-100 text-sm font-medium">Edit</span>
                    </div>
                  </div>
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
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
