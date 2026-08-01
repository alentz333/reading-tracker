'use client';

import { useState, useEffect } from 'react';
import { Book, ReadingStatus } from '@/types/book';
import BookCoverPlaceholder from '@/components/BookCoverPlaceholder';

interface SeriesBook {
  olKey: string;
  title: string;
  author: string;
  coverUrl: string | null;
  publishedYear?: number;
}

interface BookDetails {
  description?: string;
  series?: {
    name: string;
    books: SeriesBook[];
  };
}

interface BookDetailsModalProps {
  book: Book;
  onClose: () => void;
  onSelectStatus: (book: Book, status: ReadingStatus) => void;
}

const STATUS_OPTIONS: { status: ReadingStatus; label: string; className: string }[] = [
  { status: 'want-to-read', label: '📚 Want to Read', className: 'bg-blue-500/15 text-blue-400 hover:bg-blue-500/25' },
  { status: 'reading', label: '📖 Reading', className: 'bg-pink-500/15 text-pink-400 hover:bg-pink-500/25' },
  { status: 'read', label: '✅ Read', className: 'bg-green-500/15 text-green-400 hover:bg-green-500/25' },
];

export default function BookDetailsModal({ book, onClose, onSelectStatus }: BookDetailsModalProps) {
  // The displayed book can change without closing the modal when the user
  // clicks another book in the series
  const [current, setCurrent] = useState<Book>(book);
  const [details, setDetails] = useState<BookDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    setCurrent(book);
  }, [book]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    setDetails(null);
    setExpanded(false);

    if (!current.olKey && !current.googleBooksId) return;

    const controller = new AbortController();
    const params = new URLSearchParams();
    if (current.olKey) params.set('olKey', current.olKey);
    if (current.googleBooksId) params.set('googleBooksId', current.googleBooksId);
    if (current.author) params.set('author', current.author);

    setLoading(true);
    fetch(`/api/book-details?${params.toString()}`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!controller.signal.aborted) setDetails(data);
      })
      .catch((error) => {
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
          console.error('Book details error:', error);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [current.olKey, current.googleBooksId]);

  const viewSeriesBook = (seriesBook: SeriesBook) => {
    setCurrent({
      id: `temp-${seriesBook.olKey}`,
      olKey: seriesBook.olKey,
      title: seriesBook.title,
      author: seriesBook.author,
      coverUrl: seriesBook.coverUrl || undefined,
      publishedYear: seriesBook.publishedYear,
      publishedDate: seriesBook.publishedYear?.toString(),
      status: 'want-to-read',
      source: 'openlibrary',
      isPublic: true,
    });
  };

  const description = details?.description || current.description;
  const otherSeriesBooks = details?.series?.books.filter(
    (seriesBook) => seriesBook.olKey !== current.olKey
  );

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-[70] p-4"
      onClick={onClose}
    >
      <div
        className="bg-[#1a1a1b] rounded-2xl max-w-lg w-full max-h-[85vh] overflow-y-auto border border-white/10 animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          {/* Header */}
          <div className="flex items-start gap-4 mb-5">
            {current.coverUrl ? (
              <img
                loading="lazy"
                decoding="async"
                src={current.coverUrl}
                alt={current.title}
                className="w-24 h-36 object-cover rounded-lg shadow-lg flex-shrink-0"
              />
            ) : (
              <BookCoverPlaceholder title={current.title} className="w-24 h-36 rounded-lg flex-shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-white text-lg leading-snug">{current.title}</h3>
              <p className="text-sm text-white/50 mt-1">{current.author}</p>
              <p className="text-xs text-white/30 mt-2">
                {[
                  current.publishedYear,
                  current.pageCount ? `${current.pageCount} pages` : undefined,
                ]
                  .filter(Boolean)
                  .join(' • ')}
              </p>
              {current.isbn && (
                <p className="text-xs text-white/30 mt-0.5">ISBN {current.isbn}</p>
              )}
            </div>
            <button
              onClick={onClose}
              className="text-white/40 hover:text-white transition-colors text-xl leading-none flex-shrink-0"
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          {/* Status buttons */}
          <div className="grid grid-cols-3 gap-2 mb-5">
            {STATUS_OPTIONS.map(({ status, label, className }) => (
              <button
                key={status}
                onClick={() => onSelectStatus(current, status)}
                className={`px-2 py-2 text-xs sm:text-sm rounded-lg transition-colors ${className}`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Description */}
          <div className="mb-5">
            <h4 className="text-sm font-medium text-white/60 mb-2">About this book</h4>
            {loading && !description ? (
              <div className="space-y-2 animate-pulse">
                <div className="h-3 bg-white/10 rounded w-full" />
                <div className="h-3 bg-white/10 rounded w-11/12" />
                <div className="h-3 bg-white/10 rounded w-4/5" />
              </div>
            ) : description ? (
              <>
                <p
                  className={`text-sm text-white/70 leading-relaxed whitespace-pre-line ${
                    expanded ? '' : 'line-clamp-6'
                  }`}
                >
                  {description}
                </p>
                {description.length > 400 && (
                  <button
                    onClick={() => setExpanded(!expanded)}
                    className="text-xs text-indigo-400 hover:text-indigo-300 mt-1 transition-colors"
                  >
                    {expanded ? 'Show less' : 'Read more'}
                  </button>
                )}
              </>
            ) : (
              <p className="text-sm text-white/30 italic">No description available.</p>
            )}
          </div>

          {/* Series */}
          {loading && !details?.series && (
            <div className="flex gap-3 animate-pulse">
              {[0, 1, 2].map((i) => (
                <div key={i} className="w-16 h-24 bg-white/10 rounded" />
              ))}
            </div>
          )}
          {otherSeriesBooks && otherSeriesBooks.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-white/60 mb-2">
                More in {details!.series!.name}
              </h4>
              <div className="flex gap-3 overflow-x-auto pb-2">
                {otherSeriesBooks.map((seriesBook) => (
                  <button
                    key={seriesBook.olKey}
                    onClick={() => viewSeriesBook(seriesBook)}
                    className="flex-shrink-0 w-20 text-left group"
                    title={`${seriesBook.title}${seriesBook.publishedYear ? ` (${seriesBook.publishedYear})` : ''}`}
                  >
                    {seriesBook.coverUrl ? (
                      <img
                        loading="lazy"
                        decoding="async"
                        src={seriesBook.coverUrl}
                        alt={seriesBook.title}
                        className="w-20 h-30 object-cover rounded shadow-sm group-hover:ring-2 group-hover:ring-indigo-400/60 transition-shadow"
                      />
                    ) : (
                      <BookCoverPlaceholder
                        title={seriesBook.title}
                        className="w-20 h-30 rounded"
                        textClassName="text-[8px] line-clamp-3"
                      />
                    )}
                    <p className="text-[0.65rem] text-white/60 mt-1 line-clamp-2 leading-tight group-hover:text-white/90 transition-colors">
                      {seriesBook.title}
                    </p>
                    {seriesBook.publishedYear && (
                      <p className="text-[0.6rem] text-white/30">{seriesBook.publishedYear}</p>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
