'use client';

import {
  DndContext,
  closestCenter,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Book } from '@/types/book';
import BookCoverPlaceholder from '@/components/BookCoverPlaceholder';

interface SortableBookListProps {
  books: Book[];
  onReorder: (orderedIds: string[]) => void;
  onUpdate: (id: string, updates: Partial<Book>) => void;
  onDelete: (id: string) => void;
}

interface SortableBookRowProps {
  book: Book;
  rank: number;
  onUpdate: (id: string, updates: Partial<Book>) => void;
  onDelete: (id: string) => void;
}

function SortableBookRow({ book, rank, onUpdate, onDelete }: SortableBookRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: book.id,
  });

  const startReading = () => {
    onUpdate(book.id, {
      status: 'reading',
      dateStarted: book.dateStarted || new Date().toISOString().split('T')[0],
    });
  };

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-center gap-3 px-3 py-2.5 bg-white/[0.03] first:rounded-t-xl last:rounded-b-xl ${
        isDragging ? 'z-20 opacity-70 bg-indigo-500/10' : ''
      }`}
    >
      {/* Drag handle — only the handle carries drag listeners so the row's
          buttons stay clickable without move/hold activation tricks */}
      <button
        {...attributes}
        {...listeners}
        aria-label={`Reorder ${book.title}`}
        className="touch-none cursor-grab active:cursor-grabbing text-white/30 hover:text-white/70 px-1 py-2 -ml-1 transition-colors"
      >
        <svg width="10" height="16" viewBox="0 0 10 16" fill="currentColor" aria-hidden="true">
          <circle cx="2" cy="2" r="1.5" /><circle cx="8" cy="2" r="1.5" />
          <circle cx="2" cy="8" r="1.5" /><circle cx="8" cy="8" r="1.5" />
          <circle cx="2" cy="14" r="1.5" /><circle cx="8" cy="14" r="1.5" />
        </svg>
      </button>

      <span className="w-6 text-center text-sm font-bold text-indigo-400 flex-shrink-0">{rank}</span>

      {book.coverUrl ? (
        <img
          loading="lazy"
          decoding="async"
          src={book.coverUrl}
          alt={book.title}
          className="w-10 h-14 object-cover rounded flex-shrink-0 shadow"
        />
      ) : (
        <BookCoverPlaceholder title={book.title} className="w-10 h-14 rounded flex-shrink-0" textClassName="text-[0.4rem] line-clamp-3" />
      )}

      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-medium text-white truncate">{book.title}</h3>
        <p className="text-xs text-white/50 truncate">
          {book.author}
          {book.pageCount ? <span className="text-white/30"> · {book.pageCount} pages</span> : null}
        </p>
        {(book.genres?.length ?? 0) > 0 && (
          <div className="hidden sm:flex gap-1 mt-1 flex-wrap">
            {book.genres!.slice(0, 3).map(genre => (
              <span
                key={genre}
                className="inline-flex items-center text-[0.625rem] px-1.5 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 font-medium"
              >
                {genre}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center gap-1 flex-shrink-0">
        <button
          onClick={startReading}
          className="text-xs px-2.5 py-1.5 rounded-lg bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500 hover:text-white transition-all"
          title="Start reading"
        >
          📖 <span className="hidden sm:inline">Start</span>
        </button>
        <button
          onClick={() => onDelete(book.id)}
          className="text-white/30 hover:text-red-400 px-2 py-1.5 transition-colors"
          title="Remove from library"
          aria-label={`Remove ${book.title}`}
        >
          ✕
        </button>
      </div>
    </div>
  );
}

// Compact drag-and-drop list for prioritizing the Want to Read queue.
export default function SortableBookList({ books, onReorder, onUpdate, onDelete }: SortableBookListProps) {
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 100, tolerance: 8 } }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = books.findIndex(b => b.id === active.id);
    const newIndex = books.findIndex(b => b.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    onReorder(arrayMove(books, oldIndex, newIndex).map(b => b.id));
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={books.map(b => b.id)} strategy={verticalListSortingStrategy}>
        <div className="rounded-xl border border-white/10 divide-y divide-white/10 overflow-hidden">
          {books.map((book, index) => (
            <SortableBookRow
              key={book.id}
              book={book}
              rank={index + 1}
              onUpdate={onUpdate}
              onDelete={onDelete}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
