'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Book, ReadingStatus } from '@/types/book';
import { useBooks } from '@/hooks/useBooks';
import { useGamification } from '@/hooks/useGamification';
import Header from '@/components/Header';
import BookSearch from '@/components/BookSearch';
import { isPreviousReadBook } from '@/lib/previous-reads';
import { getActiveReadBooksThisYear } from '@/lib/storage';
import {
  suggestNextRead,
  suggestNewBookOutsideLibrary,
  type NextReadSuggestion,
  type NewBookSuggestion,
} from '@/lib/recommendations';
import {
  loadDiscoveryFeedback,
  recordDislikedBook,
  saveDiscoveryFeedback,
  type DiscoveryFeedbackState,
} from '@/lib/discovery-feedback';

export default function Home() {
  const { books, loading, stats, addBook, updateBook, deleteBook } = useBooks();
  const { onBookStarted, onBookFinished } = useGamification();
  const [showSearch, setShowSearch] = useState(false);
  const [finishingBook, setFinishingBook] = useState<string | null>(null);
  const [pendingRating, setPendingRating] = useState<number>(0);
  const [editingBook, setEditingBook] = useState<Book | null>(null);
  const [editStatus, setEditStatus] = useState<ReadingStatus>('read');
  const [editRating, setEditRating] = useState<number>(0);
  const [editReview, setEditReview] = useState<string>('');
  const [localProgress, setLocalProgress] = useState<Record<string, number>>({});
  const [showSuggestionModal, setShowSuggestionModal] = useState(false);
  const [nextSuggestion, setNextSuggestion] = useState<NextReadSuggestion | null>(null);
  const [startingSuggestion, setStartingSuggestion] = useState(false);
  const [showDiscoveryModal, setShowDiscoveryModal] = useState(false);
  const [discoveringNewBook, setDiscoveringNewBook] = useState(false);
  const [newBookSuggestion, setNewBookSuggestion] = useState<NewBookSuggestion | null>(null);
  const [addingDiscoveredBook, setAddingDiscoveredBook] = useState(false);
  const [sessionExcludedDiscoveries, setSessionExcludedDiscoveries] = useState<string[]>([]);
  const [discoveryFeedback, setDiscoveryFeedback] = useState<DiscoveryFeedbackState>({
    rejectedFingerprints: [],
    rejectedAuthors: [],
    rejectedTitleTerms: [],
  });

  const activeLibraryBooks = books.filter(book => !isPreviousReadBook(book));
  const currentlyReading = activeLibraryBooks.filter(b => b.status === 'reading');
  const recentlyRead = [...getActiveReadBooksThisYear(books)].sort((a, b) => {
    const dateA = a.dateFinished || a.addedAt || '';
    const dateB = b.dateFinished || b.addedAt || '';
    return dateB.localeCompare(dateA);
  });
  const wantToRead = activeLibraryBooks.filter(b => b.status === 'want-to-read').slice(0, 8);

  useEffect(() => {
    setDiscoveryFeedback(loadDiscoveryFeedback());
  }, []);

  const handleAddBook = async (book: Book, status?: ReadingStatus) => {
    const today = new Date().toISOString().split('T')[0];
    const nextStatus = status || book.status;
    const bookToAdd = { ...book, status: nextStatus };

    if (nextStatus === 'reading') {
      bookToAdd.dateStarted = today;
      bookToAdd.progress = bookToAdd.progress ?? 0;
    }

    if (nextStatus === 'read') {
      bookToAdd.dateFinished = bookToAdd.dateFinished || today;
      bookToAdd.progress = 100;
    }

    const success = await addBook(bookToAdd);
    
    if (success && status === 'reading') {
      await onBookStarted(book.id);
    }
    
    if (success) {
      setShowSearch(false);
    }

    return success;
  };

  const handleProgressChange = (bookId: string, progress: number) => {
    // Update local state immediately for smooth UI
    setLocalProgress(prev => ({ ...prev, [bookId]: progress }));
  };

  const saveProgress = (bookId: string) => {
    const progress = localProgress[bookId];
    if (progress !== undefined) {
      updateBook(bookId, { progress });
    }
  };

  const getProgress = (book: Book) => {
    return localProgress[book.id] ?? book.progress ?? 0;
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
    setEditStatus(book.status);
    setEditRating(book.rating || 0);
    setEditReview(book.review || '');
  };

  const saveEditBook = async () => {
    if (!editingBook) return;

    const today = new Date().toISOString().split('T')[0];
    const updates: Partial<Book> = {
      status: editStatus,
      rating: editRating || undefined,
      review: editReview || undefined,
    };

    if (editStatus === 'read') {
      updates.progress = 100;
      updates.dateFinished = editingBook.dateFinished || today;
    } else if (editStatus === 'reading') {
      updates.progress = 0;
      updates.dateStarted = editingBook.dateStarted || today;
      updates.dateFinished = undefined;
    } else {
      updates.progress = 0;
      updates.dateFinished = undefined;
    }

    await updateBook(editingBook.id, updates);
    closeEditBook();
  };

  const handleRemoveBook = async () => {
    if (!editingBook) return;

    const shouldDelete = window.confirm(`Remove "${editingBook.title}" from your library? This cannot be undone.`);
    if (!shouldDelete) return;

    await deleteBook(editingBook.id);
    closeEditBook();
  };

  const closeEditBook = () => {
    setEditingBook(null);
    setEditStatus('read');
    setEditRating(0);
    setEditReview('');
  };

  const openSuggestionModal = () => {
    setNextSuggestion(suggestNextRead(books));
    setShowSuggestionModal(true);
  };

  const closeSuggestionModal = () => {
    setShowSuggestionModal(false);
    setStartingSuggestion(false);
  };

  const startSuggestedBook = async () => {
    if (!nextSuggestion?.book) return;

    setStartingSuggestion(true);
    const today = new Date().toISOString().split('T')[0];

    const success = await updateBook(nextSuggestion.book.id, {
      status: 'reading',
      progress: 0,
      dateStarted: nextSuggestion.book.dateStarted || today,
      dateFinished: undefined,
    });

    if (success) {
      await onBookStarted(nextSuggestion.book.id);
      closeSuggestionModal();
      return;
    }

    setStartingSuggestion(false);
  };

  const fetchNewDiscoverySuggestion = async (
    extraExcludedFingerprints: string[] = [],
    feedbackOverride?: DiscoveryFeedbackState
  ) => {
    setDiscoveringNewBook(true);
    setNewBookSuggestion(null);

    const feedback = feedbackOverride || discoveryFeedback;

    const suggestion = await suggestNewBookOutsideLibrary(books, {
      excludeFingerprints: [
        ...sessionExcludedDiscoveries,
        ...feedback.rejectedFingerprints,
        ...extraExcludedFingerprints,
      ],
      dislikedAuthors: feedback.rejectedAuthors,
      dislikedTitleTerms: feedback.rejectedTitleTerms,
    });

    setNewBookSuggestion(suggestion);

    if (suggestion.fingerprint) {
      const fingerprint = suggestion.fingerprint;
      setSessionExcludedDiscoveries((previous) =>
        previous.includes(fingerprint)
          ? previous
          : [...previous, fingerprint]
      );
    }

    setDiscoveringNewBook(false);
  };

  const openDiscoveryModal = () => {
    setSessionExcludedDiscoveries([]);
    setShowDiscoveryModal(true);
    fetchNewDiscoverySuggestion();
  };

  const closeDiscoveryModal = () => {
    setShowDiscoveryModal(false);
    setDiscoveringNewBook(false);
    setAddingDiscoveredBook(false);
    setSessionExcludedDiscoveries([]);
  };

  const addDiscoveredToWantToRead = async () => {
    if (!newBookSuggestion?.book) return;

    setAddingDiscoveredBook(true);
    const success = await handleAddBook(newBookSuggestion.book, 'want-to-read');

    if (success) {
      closeDiscoveryModal();
      return;
    }

    setAddingDiscoveredBook(false);
  };

  const tryAnotherDiscovery = () => {
    const currentFingerprint = newBookSuggestion?.fingerprint ? [newBookSuggestion.fingerprint] : [];
    fetchNewDiscoverySuggestion(currentFingerprint);
  };

  const thumbsDownDiscovery = () => {
    if (!newBookSuggestion?.book) return;

    const nextFeedback = recordDislikedBook(
      {
        title: newBookSuggestion.book.title,
        author: newBookSuggestion.book.author,
        fingerprint: newBookSuggestion.fingerprint || undefined,
      },
      discoveryFeedback
    );

    setDiscoveryFeedback(nextFeedback);
    saveDiscoveryFeedback(nextFeedback);

    const currentFingerprint = newBookSuggestion.fingerprint ? [newBookSuggestion.fingerprint] : [];
    fetchNewDiscoverySuggestion(currentFingerprint, nextFeedback);
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
            
            {/* Status */}
            <div className="mb-5">
              <label className="text-sm text-white/60 block mb-2">Status</label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => setEditStatus('want-to-read')}
                  className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                    editStatus === 'want-to-read'
                      ? 'bg-blue-500/25 text-blue-300 border border-blue-400/40'
                      : 'bg-white/5 text-white/70 border border-white/10 hover:bg-white/10'
                  }`}
                >
                  📚 Want to Read
                </button>
                <button
                  onClick={() => setEditStatus('reading')}
                  className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                    editStatus === 'reading'
                      ? 'bg-pink-500/25 text-pink-300 border border-pink-400/40'
                      : 'bg-white/5 text-white/70 border border-white/10 hover:bg-white/10'
                  }`}
                >
                  📖 Reading
                </button>
                <button
                  onClick={() => setEditStatus('read')}
                  className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                    editStatus === 'read'
                      ? 'bg-green-500/25 text-green-300 border border-green-400/40'
                      : 'bg-white/5 text-white/70 border border-white/10 hover:bg-white/10'
                  }`}
                >
                  ✅ Read
                </button>
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
            <div className="space-y-3">
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

              <button
                onClick={handleRemoveBook}
                className="w-full px-4 py-2 bg-red-500/15 hover:bg-red-500/25 text-red-300 rounded-lg border border-red-400/30 transition-colors"
              >
                Remove from Library
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Next Read Suggestion Modal */}
      {showSuggestionModal && nextSuggestion && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60] p-4">
          <div className="bg-[#1a1a1b] rounded-2xl max-w-md w-full p-6 border border-white/10">
            <h3 className="text-lg font-semibold text-white mb-1">✨ Next Read Suggestion</h3>
            <p className="text-xs text-white/50 mb-5">
              Analyzed {nextSuggestion.analyzedReadCount} read books ({nextSuggestion.analyzedPreviousReadCount} previous reads) and {nextSuggestion.consideredCount} Want to Read candidates.
            </p>

            {nextSuggestion.book ? (
              <>
                <div className="flex gap-4 mb-5">
                  {nextSuggestion.book.coverUrl ? (
                    <img
                      src={nextSuggestion.book.coverUrl}
                      alt={nextSuggestion.book.title}
                      className="w-20 h-28 object-cover rounded-lg shadow-lg"
                    />
                  ) : (
                    <div className="w-20 h-28 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center text-2xl">📖</div>
                  )}
                  <div>
                    <h4 className="text-white font-semibold leading-snug">{nextSuggestion.book.title}</h4>
                    <p className="text-sm text-white/60 mt-1">{nextSuggestion.book.author}</p>
                    {nextSuggestion.book.pageCount && (
                      <p className="text-xs text-white/40 mt-1">{nextSuggestion.book.pageCount} pages</p>
                    )}
                  </div>
                </div>

                <div className="mb-6">
                  <p className="text-sm font-medium text-white/75 mb-2">Why this pick</p>
                  <ul className="space-y-2">
                    {nextSuggestion.reasons.map((reason) => (
                      <li key={reason} className="text-sm text-white/65 flex gap-2">
                        <span className="text-indigo-300">•</span>
                        <span>{reason}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={startSuggestedBook}
                    disabled={startingSuggestion}
                    className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
                  >
                    {startingSuggestion ? 'Starting...' : '📖 Start Reading'}
                  </button>
                  <button
                    onClick={closeSuggestionModal}
                    className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white/70 rounded-lg transition-colors"
                  >
                    Close
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm text-white/65 mb-6">{nextSuggestion.reasons[0]}</p>
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      closeSuggestionModal();
                      setShowSearch(true);
                    }}
                    className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium transition-colors"
                  >
                    + Add Book
                  </button>
                  <button
                    onClick={closeSuggestionModal}
                    className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white/70 rounded-lg transition-colors"
                  >
                    Close
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Discover New Book Modal */}
      {showDiscoveryModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60] p-4">
          <div className="bg-[#1a1a1b] rounded-2xl max-w-md w-full p-6 border border-white/10">
            <h3 className="text-lg font-semibold text-white mb-1">🌟 Discover New Book</h3>
            <p className="text-xs text-white/50 mb-5">
              Finds books outside your current database based on your read history and backlog.
            </p>

            {discoveringNewBook ? (
              <div className="py-8 flex flex-col items-center gap-3 text-white/70">
                <div className="w-6 h-6 border-2 border-purple-400/30 border-t-purple-300 rounded-full animate-spin" />
                <p className="text-sm">Finding a fresh recommendation...</p>
              </div>
            ) : newBookSuggestion?.book ? (
              <>
                <div className="flex gap-4 mb-5">
                  {newBookSuggestion.book.coverUrl ? (
                    <img
                      src={newBookSuggestion.book.coverUrl}
                      alt={newBookSuggestion.book.title}
                      className="w-20 h-28 object-cover rounded-lg shadow-lg"
                    />
                  ) : (
                    <div className="w-20 h-28 bg-gradient-to-br from-purple-500 to-fuchsia-600 rounded-lg flex items-center justify-center text-2xl">📘</div>
                  )}
                  <div>
                    <h4 className="text-white font-semibold leading-snug">{newBookSuggestion.book.title}</h4>
                    <p className="text-sm text-white/60 mt-1">{newBookSuggestion.book.author}</p>
                    {newBookSuggestion.book.pageCount && (
                      <p className="text-xs text-white/40 mt-1">{newBookSuggestion.book.pageCount} pages</p>
                    )}
                    {newBookSuggestion.book.publishedYear && (
                      <p className="text-xs text-white/35 mt-1">Published {newBookSuggestion.book.publishedYear}</p>
                    )}
                  </div>
                </div>

                <div className="mb-3">
                  <p className="text-sm font-medium text-white/75 mb-2">Why this pick</p>
                  <ul className="space-y-2">
                    {newBookSuggestion.reasons.map((reason) => (
                      <li key={reason} className="text-sm text-white/65 flex gap-2">
                        <span className="text-purple-300">•</span>
                        <span>{reason}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <p className="text-xs text-white/45 mb-5">
                  Searched {newBookSuggestion.consideredCount} new candidates across {newBookSuggestion.searchedQueries.length} query {newBookSuggestion.searchedQueries.length === 1 ? 'seed' : 'seeds'}.
                </p>

                <div className="flex gap-3 flex-wrap">
                  <button
                    onClick={addDiscoveredToWantToRead}
                    disabled={addingDiscoveredBook || discoveringNewBook}
                    className="flex-1 min-w-[180px] px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
                  >
                    {addingDiscoveredBook ? 'Adding...' : '➕ Add to Want to Read'}
                  </button>
                  <button
                    onClick={tryAnotherDiscovery}
                    disabled={discoveringNewBook || addingDiscoveredBook}
                    className="px-4 py-2 bg-white/10 hover:bg-white/20 disabled:opacity-60 disabled:cursor-not-allowed text-white/70 rounded-lg transition-colors"
                  >
                    Try Another
                  </button>
                  <button
                    onClick={thumbsDownDiscovery}
                    disabled={discoveringNewBook || addingDiscoveredBook}
                    className="px-4 py-2 bg-red-500/15 hover:bg-red-500/25 disabled:opacity-60 disabled:cursor-not-allowed text-red-300 rounded-lg border border-red-400/30 transition-colors"
                  >
                    👎 Not for me
                  </button>
                  <button
                    onClick={closeDiscoveryModal}
                    className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white/70 rounded-lg transition-colors"
                  >
                    Close
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm text-white/65 mb-6">{newBookSuggestion?.reasons[0] || 'Could not find a suggestion yet.'}</p>
                <div className="flex gap-3">
                  <button
                    onClick={() => fetchNewDiscoverySuggestion()}
                    className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-medium transition-colors"
                  >
                    Try Again
                  </button>
                  <button
                    onClick={closeDiscoveryModal}
                    className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white/70 rounded-lg transition-colors"
                  >
                    Close
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
      
      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Stats Bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/10">
            <div className="flex items-center gap-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-white">{stats.booksThisYear}</div>
                <div className="text-xs text-white/50">Read This Year</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-white">{stats.totalBooks}</div>
                <div className="text-xs text-white/50">Read All Time</div>
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
          </div>

          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Link
              href="/library"
              className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white/70 rounded-lg border border-white/10 text-center transition-colors"
            >
              📖 Full Library
            </Link>
            <Link
              href="/library/previous-reads"
              className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white/70 rounded-lg border border-white/10 text-center transition-colors"
            >
              🗓️ Previous Reads
            </Link>
            <button
              onClick={openSuggestionModal}
              className="px-4 py-2 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-200 rounded-lg border border-indigo-400/30 text-center transition-colors"
            >
              ✨ Suggest Next Read
            </button>
            <button
              onClick={openDiscoveryModal}
              className="px-4 py-2 bg-purple-600/20 hover:bg-purple-600/30 text-purple-200 rounded-lg border border-purple-400/30 text-center transition-colors"
            >
              🌟 Discover New Book
            </button>
            <button
              onClick={() => setShowSearch(!showSearch)}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium text-center transition-colors"
            >
              + Add Book
            </button>
          </div>
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
                            value={getProgress(book)}
                            onChange={(e) => handleProgressChange(book.id, parseInt(e.target.value))}
                            onMouseUp={() => saveProgress(book.id)}
                            onTouchEnd={() => saveProgress(book.id)}
                            className="flex-1 h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                          />
                          <span className="text-sm text-white/60 w-12 text-right">{getProgress(book)}%</span>
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
                        className="w-full aspect-[2/3] object-cover rounded-lg shadow-md group-hover:shadow-lg group-hover:scale-105 group-hover:ring-2 group-hover:ring-indigo-500 transition-all"
                      />
                    ) : (
                      <div className="w-full aspect-[2/3] bg-gradient-to-br from-blue-500 to-cyan-600 rounded-lg flex items-center justify-center text-2xl group-hover:scale-105 group-hover:ring-2 group-hover:ring-indigo-500 transition-all">📖</div>
                    )}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/35 rounded-lg flex items-center justify-center transition-all">
                      <span className="text-white opacity-0 group-hover:opacity-100 text-xs font-medium">Update Status</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Empty State */}
        {activeLibraryBooks.length === 0 && (
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
      </main>
    </div>
  );
}
