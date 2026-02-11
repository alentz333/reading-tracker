'use client';

import { useState } from 'react';
import { Book, ReadingStatus } from '@/types/book';

interface BookCardProps {
  book: Book;
  onUpdate: (id: string, updates: Partial<Book>) => void;
  onDelete: (id: string) => void;
  compact?: boolean;
}

export default function BookCard({ book, onUpdate, onDelete, compact = false }: BookCardProps) {
  const [showDetails, setShowDetails] = useState(false);
  const [editing, setEditing] = useState(false);
  const [review, setReview] = useState(book.review || '');

  const statusConfig: Record<ReadingStatus, { label: string; class: string; emoji: string }> = {
    'read': { label: 'Read', class: 'status-read', emoji: '✅' },
    'reading': { label: 'Reading', class: 'status-reading', emoji: '📖' },
    'want-to-read': { label: 'Want to Read', class: 'status-want', emoji: '📚' },
  };

  const handleStatusChange = (newStatus: ReadingStatus) => {
    const updates: Partial<Book> = { status: newStatus };
    
    if (newStatus === 'reading' && !book.dateStarted) {
      updates.dateStarted = new Date().toISOString().split('T')[0];
    } else if (newStatus === 'read' && !book.dateFinished) {
      updates.dateFinished = new Date().toISOString().split('T')[0];
      // Trigger confetti!
      triggerConfetti();
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

  const triggerConfetti = () => {
    const colors = ['#6366f1', '#f472b6', '#34d399', '#f59e0b', '#60a5fa'];
    for (let i = 0; i < 50; i++) {
      const confetti = document.createElement('div');
      confetti.className = 'confetti';
      confetti.style.left = `${Math.random() * 100}vw`;
      confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
      confetti.style.animationDelay = `${Math.random() * 0.5}s`;
      document.body.appendChild(confetti);
      setTimeout(() => confetti.remove(), 3000);
    }
  };

  if (compact) {
    return (
      <div className="group cursor-pointer" onClick={() => setShowDetails(true)}>
        {book.coverUrl ? (
          <img 
            src={book.coverUrl} 
            alt={book.title}
            className="book-cover w-full"
          />
        ) : (
          <div className="book-cover-placeholder w-full">📖</div>
        )}
        <div className="mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <p className="text-xs text-white truncate">{book.title}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bento-card hover:border-indigo-500/30 transition-all">
      <div className="flex gap-4">
        {/* Cover */}
        {book.coverUrl ? (
          <img
            src={book.coverUrl}
            alt={book.title}
            className="w-20 h-28 object-cover rounded-lg shadow-lg flex-shrink-0"
          />
        ) : (
          <div className="w-20 h-28 book-cover-placeholder flex-shrink-0 text-2xl">📖</div>
        )}
        
        {/* Info */}
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-white truncate">{book.title}</h3>
          <p className="text-sm text-white/50">{book.author}</p>
          
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span className={`status-pill ${statusConfig[book.status].class}`}>
              {statusConfig[book.status].emoji} {statusConfig[book.status].label}
            </span>
            {book.pageCount && (
              <span className="text-xs text-white/40">{book.pageCount} pages</span>
            )}
          </div>
          
          {/* Star Rating */}
          {book.status === 'read' && (
            <div className="star-rating mt-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => handleRating(star)}
                  className={`star ${star <= (book.rating || 0) ? 'filled' : ''}`}
                >
                  ⭐
                </button>
              ))}
            </div>
          )}
          
          {/* Progress for reading */}
          {book.status === 'reading' && (
            <div className="mt-2">
              <div className="reading-progress">
                <div 
                  className="reading-progress-bar" 
                  style={{ width: `${book.progress || 0}%` }}
                />
              </div>
              <p className="text-xs text-white/40 mt-1">{book.progress || 0}% complete</p>
            </div>
          )}
          
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="text-xs text-indigo-400 hover:text-indigo-300 mt-2 transition-colors"
          >
            {showDetails ? '← Hide details' : 'More →'}
          </button>
        </div>
      </div>
      
      {/* Expanded Details */}
      {showDetails && (
        <div className="mt-4 pt-4 border-t border-[var(--glass-border)] animate-fade-in">
          {/* Status Change */}
          <div className="mb-4">
            <label className="text-xs font-medium text-white/40 uppercase tracking-wider block mb-2">
              Change Status
            </label>
            <div className="flex gap-2 flex-wrap">
              {(['want-to-read', 'reading', 'read'] as ReadingStatus[]).map((status) => (
                <button
                  key={status}
                  onClick={() => handleStatusChange(status)}
                  className={`text-xs px-3 py-1.5 rounded-lg transition-all ${
                    book.status === status
                      ? 'bg-indigo-500 text-white'
                      : 'bg-white/5 text-white/60 hover:bg-white/10'
                  }`}
                >
                  {statusConfig[status].emoji} {statusConfig[status].label}
                </button>
              ))}
            </div>
          </div>

          {/* Progress slider for reading */}
          {book.status === 'reading' && (
            <div className="mb-4">
              <label className="text-xs font-medium text-white/40 uppercase tracking-wider block mb-2">
                Progress
              </label>
              <input
                type="range"
                min="0"
                max="100"
                value={book.progress || 0}
                onChange={(e) => onUpdate(book.id, { progress: parseInt(e.target.value) })}
                className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-indigo-500"
              />
              <p className="text-xs text-white/40 mt-1">{book.progress || 0}%</p>
            </div>
          )}
          
          {/* Dates */}
          <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
            {book.dateStarted && (
              <div>
                <span className="text-white/40 text-xs">Started</span>
                <p className="text-white/80">{book.dateStarted}</p>
              </div>
            )}
            {book.dateFinished && (
              <div>
                <span className="text-white/40 text-xs">Finished</span>
                <p className="text-white/80">{book.dateFinished}</p>
              </div>
            )}
          </div>
          
          {/* Review */}
          {book.status === 'read' && (
            <div className="mb-4">
              <label className="text-xs font-medium text-white/40 uppercase tracking-wider block mb-2">
                Your Review
              </label>
              {editing ? (
                <div>
                  <textarea
                    value={review}
                    onChange={(e) => setReview(e.target.value)}
                    className="input text-sm"
                    rows={3}
                    placeholder="What did you think?"
                  />
                  <div className="flex gap-2 mt-2">
                    <button onClick={saveReview} className="btn btn-primary text-xs">
                      Save
                    </button>
                    <button onClick={() => setEditing(false)} className="btn btn-secondary text-xs">
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  {book.review ? (
                    <p className="text-sm text-white/60 italic">&ldquo;{book.review}&rdquo;</p>
                  ) : (
                    <p className="text-sm text-white/30">No review yet</p>
                  )}
                  <button
                    onClick={() => setEditing(true)}
                    className="text-xs text-indigo-400 hover:text-indigo-300 mt-1"
                  >
                    {book.review ? 'Edit review' : 'Add review'}
                  </button>
                </div>
              )}
            </div>
          )}
          
          {/* Privacy Toggle */}
          <div className="flex items-center justify-between mb-4 pt-3 border-t border-[var(--glass-border)]">
            <div>
              <span className="text-sm font-medium text-white/80">Visibility</span>
              <p className="text-xs text-white/40">
                {book.isPublic !== false ? 'Visible on your profile' : 'Only you can see this'}
              </p>
            </div>
            <button
              onClick={() => onUpdate(book.id, { isPublic: book.isPublic === false })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                book.isPublic !== false ? 'bg-indigo-500' : 'bg-white/20'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm ${
                  book.isPublic !== false ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Delete */}
          <button
            onClick={() => onDelete(book.id)}
            className="text-xs text-red-400 hover:text-red-300 transition-colors"
          >
            Remove from library
          </button>
        </div>
      )}
    </div>
  );
}
