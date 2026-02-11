'use client';

import { useState, useRef, useEffect } from 'react';
import { Book, ReadingStatus } from '@/types/book';

interface SwipeCardProps {
  book: Book;
  onSwipe: (direction: 'left' | 'right' | 'up') => void;
  isTop: boolean;
}

export default function SwipeCard({ book, onSwipe, isTop }: SwipeCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [rotation, setRotation] = useState(0);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [showIndicator, setShowIndicator] = useState<'want' | 'skip' | 'reading' | null>(null);
  const [isExiting, setIsExiting] = useState(false);

  const SWIPE_THRESHOLD = 100;
  const SWIPE_UP_THRESHOLD = 80;

  const handleStart = (clientX: number, clientY: number) => {
    if (!isTop) return;
    setIsDragging(true);
    setStartPos({ x: clientX, y: clientY });
  };

  const handleMove = (clientX: number, clientY: number) => {
    if (!isDragging || !isTop) return;
    
    const deltaX = clientX - startPos.x;
    const deltaY = clientY - startPos.y;
    
    setPosition({ x: deltaX, y: deltaY });
    setRotation(deltaX * 0.05);

    // Determine indicator
    if (deltaY < -SWIPE_UP_THRESHOLD && Math.abs(deltaX) < SWIPE_THRESHOLD) {
      setShowIndicator('reading');
    } else if (deltaX > SWIPE_THRESHOLD / 2) {
      setShowIndicator('skip');
    } else if (deltaX < -SWIPE_THRESHOLD / 2) {
      setShowIndicator('want');
    } else {
      setShowIndicator(null);
    }
  };

  const handleEnd = () => {
    if (!isDragging || !isTop) return;
    setIsDragging(false);

    const { x, y } = position;

    // Check for swipe
    if (y < -SWIPE_UP_THRESHOLD && Math.abs(x) < SWIPE_THRESHOLD) {
      // Swipe up - currently reading
      exitCard('up');
    } else if (x > SWIPE_THRESHOLD) {
      // Swipe right - skip
      exitCard('right');
    } else if (x < -SWIPE_THRESHOLD) {
      // Swipe left - want to read
      exitCard('left');
    } else {
      // Reset position
      setPosition({ x: 0, y: 0 });
      setRotation(0);
      setShowIndicator(null);
    }
  };

  const exitCard = (direction: 'left' | 'right' | 'up') => {
    setIsExiting(true);
    
    const exitX = direction === 'left' ? -500 : direction === 'right' ? 500 : 0;
    const exitY = direction === 'up' ? -600 : 0;
    const exitRotation = direction === 'up' ? 0 : direction === 'left' ? -30 : 30;
    
    setPosition({ x: exitX, y: exitY });
    setRotation(exitRotation);
    
    setTimeout(() => {
      onSwipe(direction);
    }, 300);
  };

  // Mouse events
  const handleMouseDown = (e: React.MouseEvent) => handleStart(e.clientX, e.clientY);
  const handleMouseMove = (e: React.MouseEvent) => handleMove(e.clientX, e.clientY);
  const handleMouseUp = () => handleEnd();
  const handleMouseLeave = () => isDragging && handleEnd();

  // Touch events
  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    handleStart(touch.clientX, touch.clientY);
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    handleMove(touch.clientX, touch.clientY);
  };
  const handleTouchEnd = () => handleEnd();

  // Button handlers
  const handleButtonSwipe = (direction: 'left' | 'right' | 'up') => {
    if (!isTop) return;
    setShowIndicator(direction === 'left' ? 'want' : direction === 'right' ? 'skip' : 'reading');
    setTimeout(() => exitCard(direction), 100);
  };

  const cardStyle = {
    transform: `translate(${position.x}px, ${position.y}px) rotate(${rotation}deg) scale(${isTop ? 1 : 0.95})`,
    zIndex: isTop ? 10 : 5,
    opacity: isTop ? 1 : 0.5,
  };

  return (
    <div
      ref={cardRef}
      className={`swipe-card ${isDragging ? 'swiping' : ''} ${isExiting ? 'exiting' : ''}`}
      style={cardStyle}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Swipe Indicators */}
      <div 
        className="swipe-indicator want" 
        style={{ opacity: showIndicator === 'want' ? 1 : 0 }}
      >
        📚 Want
      </div>
      <div 
        className="swipe-indicator skip" 
        style={{ opacity: showIndicator === 'skip' ? 1 : 0 }}
      >
        Skip →
      </div>
      <div 
        className="swipe-indicator reading" 
        style={{ opacity: showIndicator === 'reading' ? 1 : 0 }}
      >
        📖 Reading
      </div>

      {/* Book Cover */}
      <div className="h-3/5 overflow-hidden">
        {book.coverUrl ? (
          <img
            src={book.coverUrl}
            alt={book.title}
            className="w-full h-full object-cover"
            draggable={false}
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
            <span className="text-6xl">📖</span>
          </div>
        )}
      </div>

      {/* Book Info */}
      <div className="p-5 flex-1 flex flex-col">
        <h3 className="text-lg font-semibold text-white line-clamp-2 mb-1">
          {book.title}
        </h3>
        <p className="text-sm text-white/60 mb-3">{book.author}</p>
        
        {book.pageCount && (
          <p className="text-xs text-white/40 mb-2">{book.pageCount} pages</p>
        )}
        
        {book.description && (
          <p className="text-xs text-white/50 line-clamp-3 mb-auto">
            {book.description}
          </p>
        )}

        {/* Action hint */}
        <div className="mt-4 flex justify-center gap-6 text-xs text-white/30">
          <span>← Want</span>
          <span>↑ Reading</span>
          <span>Skip →</span>
        </div>
      </div>
    </div>
  );
}

// Swipe Stack component that manages multiple cards
interface SwipeStackProps {
  books: Book[];
  onAddBook: (book: Book, status: ReadingStatus) => void;
  onSkip: (book: Book) => void;
}

export function SwipeStack({ books, onAddBook, onSkip }: SwipeStackProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  const handleSwipe = (direction: 'left' | 'right' | 'up') => {
    const book = books[currentIndex];
    
    if (direction === 'left') {
      onAddBook(book, 'want-to-read');
    } else if (direction === 'up') {
      onAddBook(book, 'reading');
    } else {
      onSkip(book);
    }
    
    setCurrentIndex(prev => prev + 1);
  };

  const visibleBooks = books.slice(currentIndex, currentIndex + 2);

  if (visibleBooks.length === 0) {
    return (
      <div className="swipe-container flex items-center justify-center">
        <div className="empty-state">
          <div className="empty-state-icon">🎉</div>
          <div className="empty-state-title">All caught up!</div>
          <div className="empty-state-description">
            Search for more books to add to your library
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center">
      <div className="swipe-container">
        {visibleBooks.map((book, index) => (
          <SwipeCard
            key={book.id}
            book={book}
            onSwipe={handleSwipe}
            isTop={index === 0}
          />
        )).reverse()}
      </div>
      
      {/* Action Buttons */}
      <div className="swipe-actions">
        <button 
          className="swipe-btn swipe-btn-want"
          onClick={() => handleSwipe('left')}
          title="Want to read"
        >
          📚
        </button>
        <button 
          className="swipe-btn swipe-btn-reading"
          onClick={() => handleSwipe('up')}
          title="Currently reading"
        >
          📖
        </button>
        <button 
          className="swipe-btn swipe-btn-skip"
          onClick={() => handleSwipe('right')}
          title="Skip"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
