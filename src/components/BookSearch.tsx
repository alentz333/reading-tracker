'use client';

import { useState, useEffect, useRef } from 'react';
import { Book } from '@/types/book';

interface BookSearchProps {
  onBookSelect: (book: Book) => void;
  onResults?: (results: Book[]) => void;
}

export default function BookSearch({ onBookSelect, onResults }: BookSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Book[]>([]);
  const [loading, setLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const searchBooks = async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(
        `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(searchQuery)}&maxResults=10`
      );
      const data = await response.json();
      
      const books: Book[] = (data.items || []).map((item: any) => ({
        id: `temp-${item.id}`,
        googleBooksId: item.id,
        title: item.volumeInfo.title,
        author: item.volumeInfo.authors?.join(', ') || 'Unknown Author',
        coverUrl: item.volumeInfo.imageLinks?.thumbnail?.replace('http:', 'https:'),
        pageCount: item.volumeInfo.pageCount,
        description: item.volumeInfo.description,
        isbn: item.volumeInfo.industryIdentifiers?.[0]?.identifier,
        publishedDate: item.volumeInfo.publishedDate,
        status: 'want-to-read' as const,
        isPublic: true,
      }));
      
      setResults(books);
    } catch (error) {
      console.error('Search error:', error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    setShowResults(true);

    // Debounce search
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      searchBooks(value);
    }, 300);
  };

  const handleSelect = (book: Book) => {
    onBookSelect(book);
    setQuery('');
    setResults([]);
    setShowResults(false);
  };

  const handleSwipeMode = () => {
    if (results.length > 0 && onResults) {
      onResults(results);
      setShowResults(false);
    }
  };

  return (
    <div ref={searchRef} className="relative">
      {/* Search Input */}
      <div className="search-container">
        <span className="search-icon">🔍</span>
        <input
          type="text"
          value={query}
          onChange={handleInputChange}
          onFocus={() => setShowResults(true)}
          placeholder="Search books by title, author, or ISBN..."
          className="input search-input"
        />
        {loading && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            <div className="w-5 h-5 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
          </div>
        )}
      </div>

      {/* Results Dropdown */}
      {showResults && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-[var(--color-bg-elevated)] border border-[var(--glass-border)] rounded-xl shadow-2xl overflow-hidden z-50 animate-fade-in">
          {/* Swipe Mode Button */}
          {onResults && (
            <button
              onClick={handleSwipeMode}
              className="w-full px-4 py-3 flex items-center justify-between bg-indigo-500/10 hover:bg-indigo-500/20 transition-colors border-b border-[var(--glass-border)]"
            >
              <span className="text-sm font-medium text-indigo-400">
                ✨ Swipe through {results.length} results
              </span>
              <span className="text-xs text-white/40">→</span>
            </button>
          )}

          {/* Results List */}
          <div className="max-h-80 overflow-y-auto">
            {results.map((book) => (
              <button
                key={book.googleBooksId}
                onClick={() => handleSelect(book)}
                className="w-full px-4 py-3 flex items-start gap-3 hover:bg-white/5 transition-colors text-left"
              >
                {book.coverUrl ? (
                  <img
                    src={book.coverUrl}
                    alt={book.title}
                    className="w-10 h-14 object-cover rounded shadow-sm flex-shrink-0"
                  />
                ) : (
                  <div className="w-10 h-14 bg-gradient-to-br from-indigo-500 to-purple-600 rounded flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-xs">📖</span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-white text-sm truncate">{book.title}</p>
                  <p className="text-xs text-white/50 truncate">{book.author}</p>
                  {book.publishedDate && (
                    <p className="text-xs text-white/30 mt-0.5">
                      {book.publishedDate.split('-')[0]}
                    </p>
                  )}
                </div>
                <span className="text-xs text-indigo-400 flex-shrink-0">+ Add</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* No Results */}
      {showResults && query && !loading && results.length === 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 p-6 bg-[var(--color-bg-elevated)] border border-[var(--glass-border)] rounded-xl shadow-2xl text-center">
          <p className="text-white/50 text-sm">No books found for &ldquo;{query}&rdquo;</p>
          <p className="text-white/30 text-xs mt-1">Try a different search term</p>
        </div>
      )}
    </div>
  );
}
