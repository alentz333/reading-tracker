'use client';

import { useState } from 'react';
import { Book, ReadingStatus } from '@/types/book';
import { generateId } from '@/lib/storage';

interface SearchResult {
  key: string;
  title: string;
  author: string;
  coverUrl: string | null;
  isbn?: string;
  pageCount?: number;
  publishedYear?: number;
}

interface BookSearchProps {
  onAddBook: (book: Book) => void;
}

export default function BookSearch({ onAddBook }: BookSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [manualBook, setManualBook] = useState({
    title: '',
    author: '',
    pageCount: '',
    publishedYear: '',
  });

  const search = async () => {
    if (!query.trim()) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      const data = await response.json();
      setResults(data.books || []);
    } catch (error) {
      console.error('Search error:', error);
    }
    setLoading(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') search();
  };

  const addFromSearch = (result: SearchResult, status: ReadingStatus) => {
    const book: Book = {
      id: generateId(),
      title: result.title,
      author: result.author,
      coverUrl: result.coverUrl || undefined,
      isbn: result.isbn,
      pageCount: result.pageCount,
      publishedYear: result.publishedYear,
      status,
      addedAt: new Date().toISOString(),
      source: 'openlibrary',
    };
    
    if (status === 'reading') {
      book.dateStarted = new Date().toISOString().split('T')[0];
    } else if (status === 'read') {
      book.dateFinished = new Date().toISOString().split('T')[0];
    }
    
    onAddBook(book);
    setResults([]);
    setQuery('');
  };

  const addManualBook = (status: ReadingStatus) => {
    if (!manualBook.title.trim() || !manualBook.author.trim()) return;
    
    const book: Book = {
      id: generateId(),
      title: manualBook.title,
      author: manualBook.author,
      pageCount: manualBook.pageCount ? parseInt(manualBook.pageCount) : undefined,
      publishedYear: manualBook.publishedYear ? parseInt(manualBook.publishedYear) : undefined,
      status,
      addedAt: new Date().toISOString(),
      source: 'manual',
    };
    
    if (status === 'reading') {
      book.dateStarted = new Date().toISOString().split('T')[0];
    } else if (status === 'read') {
      book.dateFinished = new Date().toISOString().split('T')[0];
    }
    
    onAddBook(book);
    setManualBook({ title: '', author: '', pageCount: '', publishedYear: '' });
    setShowManual(false);
  };

  return (
    <div className="card p-6">
      <h2 className="text-xl font-semibold text-[var(--color-forest)] mb-4">
        Add a Book
      </h2>
      
      {/* Search */}
      <div className="flex gap-3 mb-4">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Search by title or author..."
          className="input-field flex-1"
        />
        <button onClick={search} disabled={loading} className="btn-primary">
          {loading ? 'Searching...' : 'Search'}
        </button>
      </div>
      
      <button
        onClick={() => setShowManual(!showManual)}
        className="text-[var(--color-forest)] underline text-sm mb-4"
      >
        {showManual ? 'Hide manual entry' : 'Or add manually'}
      </button>
      
      {/* Manual Entry Form */}
      {showManual && (
        <div className="bg-[var(--color-parchment)] p-4 rounded-lg mb-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
            <input
              type="text"
              value={manualBook.title}
              onChange={(e) => setManualBook({ ...manualBook, title: e.target.value })}
              placeholder="Title *"
              className="input-field"
            />
            <input
              type="text"
              value={manualBook.author}
              onChange={(e) => setManualBook({ ...manualBook, author: e.target.value })}
              placeholder="Author *"
              className="input-field"
            />
            <input
              type="number"
              value={manualBook.pageCount}
              onChange={(e) => setManualBook({ ...manualBook, pageCount: e.target.value })}
              placeholder="Page count"
              className="input-field"
            />
            <input
              type="number"
              value={manualBook.publishedYear}
              onChange={(e) => setManualBook({ ...manualBook, publishedYear: e.target.value })}
              placeholder="Year published"
              className="input-field"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => addManualBook('read')} className="btn-primary text-sm">
              Add as Read
            </button>
            <button onClick={() => addManualBook('reading')} className="btn-secondary text-sm">
              Currently Reading
            </button>
            <button onClick={() => addManualBook('want-to-read')} className="btn-secondary text-sm">
              Want to Read
            </button>
          </div>
        </div>
      )}
      
      {/* Search Results */}
      {results.length > 0 && (
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {results.map((result) => (
            <div
              key={result.key}
              className="flex gap-4 p-3 bg-[var(--color-parchment)] rounded-lg"
            >
              {result.coverUrl ? (
                <img
                  src={result.coverUrl}
                  alt={result.title}
                  className="w-16 h-24 object-cover rounded shadow"
                />
              ) : (
                <div className="w-16 h-24 bg-gray-200 rounded flex items-center justify-center text-gray-400 text-xs">
                  No cover
                </div>
              )}
              <div className="flex-1">
                <h3 className="font-semibold text-[var(--color-ink)]">{result.title}</h3>
                <p className="text-sm text-gray-600">{result.author}</p>
                {result.publishedYear && (
                  <p className="text-xs text-gray-500">{result.publishedYear}</p>
                )}
                <div className="flex gap-2 mt-2 flex-wrap">
                  <button
                    onClick={() => addFromSearch(result, 'read')}
                    className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200"
                  >
                    Read
                  </button>
                  <button
                    onClick={() => addFromSearch(result, 'reading')}
                    className="text-xs px-2 py-1 bg-yellow-100 text-yellow-700 rounded hover:bg-yellow-200"
                  >
                    Reading
                  </button>
                  <button
                    onClick={() => addFromSearch(result, 'want-to-read')}
                    className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                  >
                    Want to Read
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
