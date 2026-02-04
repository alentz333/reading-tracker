'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Book, ReadingStatus } from '@/types/book';
import { useBooks } from '@/hooks/useBooks';
import Header from '@/components/Header';
import BookSearch from '@/components/BookSearch';
import BookCard from '@/components/BookCard';
import GoodreadsImport from '@/components/GoodreadsImport';
import CameraScanner from '@/components/CameraScanner';
import UserSearch from '@/components/UserSearch';

type TabType = 'all' | 'reading' | 'read' | 'want-to-read';

export default function Home() {
  const { books, loading, stats, addBook, updateBook, deleteBook, isAuthenticated } = useBooks();
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [showImport, setShowImport] = useState(false);
  const [showCamera, setShowCamera] = useState(false);

  const handleAddBook = async (book: Book) => {
    await addBook(book);
  };

  const handleUpdateBook = async (id: string, updates: Partial<Book>) => {
    await updateBook(id, updates);
  };

  const handleDeleteBook = async (id: string) => {
    if (confirm('Remove this book from your library?')) {
      await deleteBook(id);
    }
  };

  const handleImport = async (importedBooks: Book[]) => {
    // Import books one by one
    for (const book of importedBooks) {
      await addBook(book);
    }
    setShowImport(false);
  };

  const filteredBooks = books.filter(book => {
    if (activeTab === 'all') return true;
    if (activeTab === 'reading') return book.status === 'reading';
    if (activeTab === 'read') return book.status === 'read';
    if (activeTab === 'want-to-read') return book.status === 'want-to-read';
    return true;
  });

  const tabs: { id: TabType; label: string; count: number }[] = [
    { id: 'all', label: 'All Books', count: books.length },
    { id: 'reading', label: 'Currently Reading', count: stats.currentlyReading },
    { id: 'read', label: 'Read', count: stats.totalBooks },
    { id: 'want-to-read', label: 'Want to Read', count: stats.wantToRead },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--color-cream)] flex items-center justify-center">
        <div className="text-xl text-[var(--color-forest)]">Loading your library...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--color-cream)]">
      <Header stats={stats} />
      
      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Add Books */}
          <div className="lg:col-span-1 space-y-6">
            {/* Quick Links */}
            {isAuthenticated && (
              <div className="card p-4 space-y-3">
                <Link 
                  href="/clubs" 
                  className="flex items-center gap-2 text-[var(--color-forest)] hover:underline font-medium"
                >
                  📖 Book Clubs →
                </Link>
                <hr className="border-gray-100" />
                <h2 className="text-sm font-semibold text-[var(--color-forest)]">
                  🔍 Find Readers
                </h2>
                <UserSearch />
              </div>
            )}
            
            <BookSearch onAddBook={handleAddBook} />
            
            {/* Camera Scan Button */}
            <button
              onClick={() => setShowCamera(true)}
              className="w-full btn-primary flex items-center justify-center gap-2"
            >
              <span>📷</span> Scan Book Cover
            </button>
            
            <button
              onClick={() => setShowImport(!showImport)}
              className="w-full btn-secondary"
            >
              {showImport ? 'Hide Goodreads Import' : 'Import from Goodreads'}
            </button>
            
            {showImport && <GoodreadsImport onImport={handleImport} />}
            
            {/* Stats Card */}
            {stats.totalBooks > 0 && (
              <div className="card p-6">
                <h2 className="text-xl font-semibold text-[var(--color-forest)] mb-4">
                  Reading Stats
                </h2>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total books read</span>
                    <span className="font-semibold">{stats.totalBooks}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Books this year</span>
                    <span className="font-semibold">{stats.booksThisYear}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Pages this year</span>
                    <span className="font-semibold">{stats.pagesThisYear.toLocaleString()}</span>
                  </div>
                  {stats.averageRating > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Average rating</span>
                      <span className="font-semibold">⭐ {stats.averageRating}</span>
                    </div>
                  )}
                </div>
                
                {/* Books by Year */}
                {Object.keys(stats.byYear).length > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <h3 className="text-sm font-semibold text-gray-700 mb-2">By Year</h3>
                    <div className="space-y-1">
                      {Object.entries(stats.byYear)
                        .sort(([a], [b]) => Number(b) - Number(a))
                        .slice(0, 5)
                        .map(([year, count]) => (
                          <div key={year} className="flex justify-between text-sm">
                            <span className="text-gray-600">{year}</span>
                            <span>{count} books</span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          
          {/* Right Column - Book List */}
          <div className="lg:col-span-2">
            {/* Tabs */}
            <div className="flex gap-2 mb-6 flex-wrap">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                    activeTab === tab.id
                      ? 'bg-[var(--color-forest)] text-white'
                      : 'bg-white text-[var(--color-ink)] hover:bg-gray-100'
                  }`}
                >
                  {tab.label} ({tab.count})
                </button>
              ))}
            </div>
            
            {/* Book Grid */}
            {filteredBooks.length === 0 ? (
              <div className="card p-12 text-center">
                <div className="text-6xl mb-4">📚</div>
                <h3 className="text-xl font-semibold text-[var(--color-forest)] mb-2">
                  {activeTab === 'all' ? 'Your library is empty' : `No books ${activeTab === 'reading' ? 'being read' : activeTab === 'read' ? 'read yet' : 'on your list'}`}
                </h3>
                <p className="text-gray-600">
                  Search for books above or import from Goodreads to get started.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredBooks.map(book => (
                  <BookCard
                    key={book.id}
                    book={book}
                    onUpdate={handleUpdateBook}
                    onDelete={handleDeleteBook}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
      
      {/* Footer */}
      <footer className="py-8 text-center text-sm text-gray-500">
        <p>
          {isAuthenticated 
            ? 'Your books are synced to the cloud ☁️' 
            : 'Data stored locally • Sign up to sync across devices'}
        </p>
      </footer>
      
      {/* Camera Scanner Modal */}
      {showCamera && (
        <CameraScanner
          onAddBook={handleAddBook}
          onClose={() => setShowCamera(false)}
        />
      )}
    </div>
  );
}
