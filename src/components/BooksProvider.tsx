'use client'

import { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { Book, ReadingStats } from '@/types/book'
import { useAuth } from '@/components/auth/AuthProvider'
import { fetchBooks, addBookToSupabase, updateBookInSupabase, deleteBookFromSupabase, updateBookPrioritiesInSupabase } from '@/lib/supabase/books'
import { getBooks, addBook as addBookLocal, updateBook as updateBookLocal, deleteBook as deleteBookLocal, reorderBooks as reorderBooksLocal, calculateStats } from '@/lib/storage'

interface BooksContextValue {
  books: Book[]
  loading: boolean
  error: string | null
  stats: ReadingStats
  addBook: (book: Book) => Promise<boolean>
  updateBook: (id: string, updates: Partial<Book>) => Promise<boolean>
  deleteBook: (id: string) => Promise<boolean>
  reorderBooks: (orderedIds: string[]) => Promise<boolean>
  refresh: () => Promise<void>
  isAuthenticated: boolean
}

const BooksContext = createContext<BooksContextValue | null>(null)

// Lower number sorts higher, and an unset priority sorts last. A book entering
// the Want to Read list takes one below the current minimum so it lands on top
// without renumbering every other row — priorities already have gaps where
// books left the list, so there is nothing to preserve by renumbering. Values
// can reach zero and below, which the sort handles and which a manual drag
// reorder renormalizes back to 1..n.
function topOfWantToReadPriority(books: Book[]): number {
  const priorities = books
    .filter(b => b.status === 'want-to-read' && typeof b.priority === 'number')
    .map(b => b.priority as number)

  return priorities.length > 0 ? Math.min(...priorities) - 1 : 1
}

// Single library load shared by every page — mounted once in the root layout
// so navigating between pages doesn't refetch the whole library.
export function BooksProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth()
  const [books, setBooks] = useState<Book[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Current books, readable inside stable callbacks without re-creating them
  const booksRef = useRef(books)
  booksRef.current = books

  const loadBooks = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      if (user) {
        const supabaseBooks = await fetchBooks()
        setBooks(supabaseBooks)
      } else {
        setBooks(getBooks())
      }
    } catch (err) {
      console.error('Error loading books:', err)
      setError('Failed to load books')
      setBooks(getBooks())
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (!authLoading) {
      loadBooks()
    }
  }, [authLoading, loadBooks])

  const addBook = useCallback(async (book: Book) => {
    // Added straight to Want to Read: put it at the top of the priority list,
    // unless the caller already chose a position
    const bookToAdd = book.status === 'want-to-read' && book.priority === undefined
      ? { ...book, priority: topOfWantToReadPriority(booksRef.current) }
      : book

    if (user) {
      const newBook = await addBookToSupabase(bookToAdd)
      if (newBook) {
        setBooks(prev => [newBook, ...prev])
        return true
      }
      return false
    } else {
      setBooks(addBookLocal(bookToAdd))
      return true
    }
  }, [user])

  const updateBook = useCallback(async (id: string, updates: Partial<Book>) => {
    // At most five Top 5 picks, whatever UI path the update came through
    if (updates.isTopFive === true) {
      const otherPicks = booksRef.current.filter(b => b.isTopFive && b.id !== id).length
      if (otherPicks >= 5) {
        setError('Your Top 5 is full — remove another pick first')
        return false
      }
    }

    // Read before awaiting, so "previous" is the state this update replaces
    const previous = booksRef.current.find(b => b.id === id)

    // Moving a book into Want to Read counts as adding it to that list, so it
    // goes on top too — unless the caller set a priority itself, as a drag
    // reorder does
    const enteringWantToRead =
      updates.status === 'want-to-read' && previous?.status !== 'want-to-read'
    const effectiveUpdates: Partial<Book> =
      enteringWantToRead && !('priority' in updates)
        ? { ...updates, priority: topOfWantToReadPriority(booksRef.current) }
        : updates

    if (user) {
      const success = await updateBookInSupabase(id, effectiveUpdates)
      if (success) {
        setBooks(prev => prev.map(b => b.id === id ? { ...b, ...effectiveUpdates } : b))

        // Fire-and-forget: email the reader a summary when a book transitions
        // to read and its email-summary toggle is on.
        const becameRead = updates.status === 'read' && previous?.status !== 'read'
        const emailEnabled = updates.emailSummaryOnFinish ?? previous?.emailSummaryOnFinish
        if (becameRead && emailEnabled) {
          fetch('/api/finish-summary', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userBookId: id }),
          }).catch(err => console.error('Failed to request finish summary email:', err))
        }

        return true
      }
      return false
    } else {
      setBooks(updateBookLocal(id, effectiveUpdates))
      return true
    }
  }, [user])

  const deleteBook = useCallback(async (id: string) => {
    if (user) {
      const success = await deleteBookFromSupabase(id)
      if (success) {
        setBooks(prev => prev.filter(b => b.id !== id))
        return true
      }
      return false
    } else {
      setBooks(deleteBookLocal(id))
      return true
    }
  }, [user])

  // Assign priority 1..n to the given ids (their new display order).
  // Optimistic: state updates immediately, then persists in the background.
  const reorderBooks = useCallback(async (orderedIds: string[]) => {
    const priorityById = new Map(orderedIds.map((id, index) => [id, index + 1]))
    setBooks(prev => prev.map(b =>
      priorityById.has(b.id) ? { ...b, priority: priorityById.get(b.id) } : b
    ))

    if (user) {
      const success = await updateBookPrioritiesInSupabase(orderedIds)
      if (!success) setError('Failed to save book order')
      return success
    } else {
      reorderBooksLocal(orderedIds)
      return true
    }
  }, [user])

  const stats = useMemo(() => calculateStats(books), [books])

  const value = useMemo<BooksContextValue>(() => ({
    books,
    loading: authLoading || loading,
    error,
    stats,
    addBook,
    updateBook,
    deleteBook,
    reorderBooks,
    refresh: loadBooks,
    isAuthenticated: !!user,
  }), [books, authLoading, loading, error, stats, addBook, updateBook, deleteBook, reorderBooks, loadBooks, user])

  return <BooksContext.Provider value={value}>{children}</BooksContext.Provider>
}

export function useBooksContext(): BooksContextValue {
  const context = useContext(BooksContext)
  if (!context) {
    throw new Error('useBooks must be used within a BooksProvider')
  }
  return context
}
