'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Book, ReadingStatus } from '@/types/book';
import { useBooks } from '@/hooks/useBooks';
import { useGamification } from '@/hooks/useGamification';
import Header from '@/components/Header';
import BookSearch from '@/components/BookSearch';
import { XPBar, LevelBadge, StreakDisplay } from '@/components/gamification';

type ViewMode = 'library' | 'quests';

export default function Home() {
  const { books, loading, stats, addBook, updateBook, deleteBook, isAuthenticated } = useBooks();
  const { stats: gameStats, userQuests, onBookStarted, onBookFinished, loading: gameLoading } = useGamification();
  const [viewMode, setViewMode] = useState<ViewMode>('library');
  const [showSearch, setShowSearch] = useState(false);

  const currentlyReading = books.filter(b => b.status === 'reading');
  const recentlyRead = books.filter(b => b.status === 'read').slice(0, 4);
  const wantToRead = books.filter(b => b.status === 'want-to-read').slice(0, 6);

  const handleAddBook = async (book: Book, status?: ReadingStatus) => {
    const bookToAdd = { ...book, status: status || book.status };
    if (status === 'reading') {
      bookToAdd.dateStarted = new Date().toISOString().split('T')[0];
    }
    const success = await addBook(bookToAdd);
    
    // Award XP for starting a book
    if (success && status === 'reading') {
      await onBookStarted(book.id);
    }
  };

  const handleSearchResults = (results: Book[]) => {
    // No longer switching to discover mode - just show search results in a modal or panel
    setShowSearch(true);
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
              className={`tab ${viewMode === 'quests' ? 'active' : ''}`}
              onClick={() => setViewMode('quests')}
            >
              📜 Quests
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
          <div className="bento-card mb-6 animate-fade-in !overflow-visible">
            <BookSearch onBookSelect={handleAddBook} onResults={handleSearchResults} />
          </div>
        )}

        {viewMode === 'library' ? (
          /* Bento Grid Library View */
          <div className="bento-grid">
            {/* Gamification Stats Row */}
            {isAuthenticated && gameStats && (
              <>
                <div className="bento-card span-2">
                  <div className="flex items-center gap-4">
                    <LevelBadge level={gameStats.level} size="lg" />
                    <div className="flex-1">
                      <XPBar xp={gameStats.xp} level={gameStats.level} size="md" />
                    </div>
                  </div>
                </div>
                
                <div className="bento-card span-1">
                  <div className="flex items-center justify-center gap-2">
                    <StreakDisplay streak={gameStats.currentStreak} size="lg" />
                  </div>
                  <div className="stat-label text-center mt-2">Day Streak</div>
                </div>
                
                <div className="bento-card span-1">
                  <Link href="/quests" className="block text-center hover:scale-105 transition-transform">
                    <div className="stat-value">{userQuests.filter(q => !q.completed).length}</div>
                    <div className="stat-label">Active Quests</div>
                  </Link>
                </div>
              </>
            )}

            {/* Stats Cards (for non-authenticated or additional stats) */}
            <div className="bento-card span-1">
              <div className="stat-value">{stats.totalBooks}</div>
              <div className="stat-label">Books Read</div>
            </div>
            
            <div className="bento-card span-1">
              <div className="stat-value">{stats.currentlyReading}</div>
              <div className="stat-label">Reading</div>
            </div>
            
            {!isAuthenticated && (
              <div className="bento-card span-1">
                <div className="flex items-center gap-2">
                  <span className="streak-fire">🔥</span>
                  <div className="stat-value">{stats.streak || 0}</div>
                </div>
                <div className="stat-label">Day Streak</div>
              </div>
            )}
            
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
                onClick={() => setShowSearch(true)}
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
                      <div className="mt-2 flex justify-center gap-0.5">
                        {[1, 2, 3, 4, 5].map(star => (
                          <span 
                            key={star} 
                            className={`text-[10px] ${star <= (book.rating || 0) ? '' : 'opacity-30 grayscale'}`}
                          >
                            ⭐
                          </span>
                        ))}
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
                  <div className="empty-state-description">Search for books to add!</div>
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
          /* Quests View */
          <div className="animate-slide-up">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-white mb-2">📜 Daily Quests</h2>
              <p className="text-white/50">Complete quests to earn XP and level up!</p>
            </div>

            {!isAuthenticated ? (
              <div className="bento-card text-center py-12">
                <div className="text-4xl mb-4">🔒</div>
                <h3 className="text-lg font-semibold text-white mb-2">Sign in to track quests</h3>
                <p className="text-white/50 mb-4">Create an account to earn XP, complete quests, and unlock achievements!</p>
                <Link href="/auth/signup" className="btn btn-primary">
                  Get Started
                </Link>
              </div>
            ) : gameLoading ? (
              <div className="text-center py-12">
                <div className="text-white/60">Loading quests...</div>
              </div>
            ) : userQuests.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2">
                {userQuests.map(uq => (
                  <div key={uq.id} className="bento-card">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          uq.quest?.type === 'daily' ? 'bg-green-500/20 text-green-400' :
                          uq.quest?.type === 'weekly' ? 'bg-blue-500/20 text-blue-400' :
                          'bg-purple-500/20 text-purple-400'
                        }`}>
                          {uq.quest?.type}
                        </span>
                      </div>
                      <span className="text-sm font-bold text-indigo-400">
                        +{uq.quest?.xpReward} XP
                      </span>
                    </div>
                    <h3 className="font-semibold text-white mb-1">{uq.quest?.name}</h3>
                    <p className="text-sm text-white/50 mb-3">{uq.quest?.description}</p>
                    <div className="reading-progress">
                      <div 
                        className="reading-progress-bar"
                        style={{ 
                          width: `${Math.min(100, (uq.progress / (uq.quest?.requirement?.count || 1)) * 100)}%` 
                        }}
                      />
                    </div>
                    <p className="text-xs text-white/40 mt-1">
                      {uq.progress} / {uq.quest?.requirement?.count || 1}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bento-card text-center py-12">
                <div className="text-4xl mb-4">✨</div>
                <h3 className="text-lg font-semibold text-white mb-2">No active quests</h3>
                <p className="text-white/50">Check back tomorrow for new daily quests!</p>
              </div>
            )}

            {/* Link to full quests page */}
            {isAuthenticated && (
              <div className="text-center mt-6">
                <Link href="/quests" className="text-indigo-400 hover:underline">
                  View all quests →
                </Link>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
