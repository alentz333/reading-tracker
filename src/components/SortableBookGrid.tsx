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
  rectSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Book } from '@/types/book';
import BookCard from '@/components/BookCard';

interface SortableBookGridProps {
  books: Book[];
  onReorder: (orderedIds: string[]) => void;
  onUpdate: (id: string, updates: Partial<Book>) => void;
  onDelete: (id: string) => void;
}

interface SortableBookCardProps {
  book: Book;
  rank: number;
  onUpdate: (id: string, updates: Partial<Book>) => void;
  onDelete: (id: string) => void;
}

function SortableBookCard({ book, rank, onUpdate, onDelete }: SortableBookCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: book.id,
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...listeners}
      className={`relative touch-manipulation ${isDragging ? 'z-20 opacity-60 scale-105' : ''}`}
    >
      <div className="absolute -top-2 -left-2 z-10 w-7 h-7 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center shadow-lg pointer-events-none">
        {rank}
      </div>
      <BookCard book={book} onUpdate={onUpdate} onDelete={onDelete} />
    </div>
  );
}

// Drag-and-drop grid for manually prioritizing books. Buttons inside cards
// stay clickable because dragging only activates after the pointer moves
// (mouse) or after a press-and-hold (touch).
export default function SortableBookGrid({ books, onReorder, onUpdate, onDelete }: SortableBookGridProps) {
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
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
      <SortableContext items={books.map(b => b.id)} strategy={rectSortingStrategy}>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {books.map((book, index) => (
            <SortableBookCard
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
