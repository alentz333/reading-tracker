'use client';

import { useState } from 'react';
import { Book, ReadingStatus } from '@/types/book';

interface BookCardProps {
  book: Book;
  onUpdate: (id: string, updates: Partial<Book>) => void;
  onDelete: (id: string) => void;
}

export default function BookCard({ book, onUpdate, onDelete }: BookCardProps) {
  const [showDetails, setShowDetails] = useState(false);
  const [editing, setEditing] = useState(false);
  const [review, setReview] = useState(book.review || '');

  const statusLabels: Record<ReadingStatus, string> = {
    'read': 'Read',
    'reading': 'Currently Reading',
    'want-to-read': 'Want to Read',
  };

  const statusClasses: Record<ReadingStatus, string> = {
    'read': 'shelf-read',
    'reading': 'shelf-reading',
    'want-to-read': 'shelf-want',
  };

  const handleStatusChange = (newStatus: ReadingStatus) => {
    const updates: Partial<Book> = { status: newStatus };
    
    if (newStatus === 'reading' && !book.dateStarted) {
      updates.dateStarted = new Date().toISOString().split('T')[0];
    } else if (newStatus === 'read' && !book.dateFinished) {
      updates.dateFinished = new Date().toISOString().split('T')[0];
    }
    
    onUpdate(book.id, updates);
  };

  const handleRating = (rating: number) => {
    onUpdate(book.id, { rating });
  };

  const saveReview = () => {
    onUpdate(book.id, { review });
    setEditing(false);
  };

  return (
    <div className="card p-4 hover:shadow-md transition-shadow">
      <div className="flex gap-4">
        {book.coverUrl ? (
          <img
            src={book.coverUrl}
            alt={book.title}
            className="w-20 h-28 object-cover rounded shadow-sm flex-shrink-0"
          />
        ) : (
          <div className="w-20 h-28 bg-gradient-to-br from-[var(--color-forest)] to-[var(--color-forest-light)] rounded flex items-center justify-center flex-shrink-0">
            <span className="text-white text-2xl">📖</span>
          </div>
        )}
        
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-[var(--color-ink)] truncate">{book.title}</h3>
          <p className="text-sm text-gray-600">{book.author}</p>
          
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span className={`shelf-tag ${statusClasses[book.status]}`}>
              {statusLabels[book.status]}
            </span>
            {book.pageCount && (
              <span className="text-xs text-gray-500">{book.pageCount} pages</span>
            )}
          </div>
          
          {/* Star Rating */}
          {book.status === 'read' && (
            <div className="flex items-center gap-1 mt-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => handleRating(star)}
                  className="star text-xl"
                >
                  {star <= (book.rating || 0) ? '⭐' : '☆'}
                </button>
              ))}
            </div>
          )}
          
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="text-sm text-[var(--color-forest)] underline mt-2"
          >
            {showDetails ? 'Hide details' : 'Show details'}
          </button>
        </div>
      </div>
      
      {/* Expanded Details */}
      {showDetails && (
        <div className="mt-4 pt-4 border-t border-gray-100">
          {/* Status Change */}
          <div className="mb-3">
            <label className="text-sm font-medium text-gray-700 block mb-1">Change Status</label>
            <div className="flex gap-2 flex-wrap">
              {(['want-to-read', 'reading', 'read'] as ReadingStatus[]).map((status) => (
                <button
                  key={status}
                  onClick={() => handleStatusChange(status)}
                  className={`text-xs px-2 py-1 rounded ${
                    book.status === status
                      ? 'bg-[var(--color-forest)] text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {statusLabels[status]}
                </button>
              ))}
            </div>
          </div>
          
          {/* Dates */}
          <div className="grid grid-cols-2 gap-3 mb-3 text-sm">
            {book.dateStarted && (
              <div>
                <span className="text-gray-500">Started:</span>{' '}
                <span className="text-[var(--color-ink)]">{book.dateStarted}</span>
              </div>
            )}
            {book.dateFinished && (
              <div>
                <span className="text-gray-500">Finished:</span>{' '}
                <span className="text-[var(--color-ink)]">{book.dateFinished}</span>
              </div>
            )}
          </div>
          
          {/* Review */}
          {book.status === 'read' && (
            <div className="mb-3">
              <label className="text-sm font-medium text-gray-700 block mb-1">Your Review</label>
              {editing ? (
                <div>
                  <textarea
                    value={review}
                    onChange={(e) => setReview(e.target.value)}
                    className="input-field text-sm"
                    rows={3}
                    placeholder="What did you think?"
                  />
                  <div className="flex gap-2 mt-2">
                    <button onClick={saveReview} className="btn-primary text-xs">
                      Save
                    </button>
                    <button onClick={() => setEditing(false)} className="btn-secondary text-xs">
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  {book.review ? (
                    <p className="text-sm text-gray-600 italic">&quot;{book.review}&quot;</p>
                  ) : (
                    <p className="text-sm text-gray-400">No review yet</p>
                  )}
                  <button
                    onClick={() => setEditing(true)}
                    className="text-xs text-[var(--color-forest)] underline mt-1"
                  >
                    {book.review ? 'Edit review' : 'Add review'}
                  </button>
                </div>
              )}
            </div>
          )}
          
          {/* Privacy Toggle */}
          <div className="flex items-center justify-between mb-3 pt-2 border-t border-gray-100">
            <div>
              <span className="text-sm font-medium text-gray-700">Visibility</span>
              <p className="text-xs text-gray-500">
                {book.isPublic !== false ? 'Visible on your profile' : 'Only you can see this'}
              </p>
            </div>
            <button
              onClick={() => onUpdate(book.id, { isPublic: book.isPublic === false })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                book.isPublic !== false ? 'bg-[var(--color-forest)]' : 'bg-gray-300'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  book.isPublic !== false ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Delete */}
          <button
            onClick={() => onDelete(book.id)}
            className="text-xs text-red-500 hover:text-red-700"
          >
            Remove from library
          </button>
        </div>
      )}
    </div>
  );
}
