'use client'

import { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { Book, ReadingStats } from '@/types/book'
import { useAuth } from '@/components/auth/AuthProvider'
import { fetchBooks, addBookToSupabase, updateBookInSupabase, deleteBookFromSupabase } from '@/lib/supabase/books'
import { getBooks, addBook as addBookLocal, updateBook as updateBookLocal, deleteBook as deleteBookLocal, calculateStats } from '@/lib/storage'

interface BooksContextValue {
  books: Book[]
  loading: boolean
  error: string | null
  stats: ReadingStats
  addBook: (book: Book) => Promise<boolean>
  updateBook: (id: string, updates: Partial<Book>) => Promise<boolean>
  deleteBook: (id: string) => Promise<boolean>
  refresh: () => Promise<void>
  isAuthenticated: boolean
}

const BooksContext = createContext<BooksContextValue | null>(null)

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
    if (user) {
      const newBook = await addBookToSupabase(book)
      if (newBook) {
        setBooks(prev => [newBook, ...prev])
        return true
      }
      return false
    } else {
      setBooks(addBookLocal(book))
      return true
    }
  }, [user])

  const updateBook = useCallback(async (id: string, updates: Partial<Book>) => {
    if (user) {
      const success = await updateBookInSupabase(id, updates)
      if (success) {
        const previous = booksRef.current.find(b => b.id === id)
        setBooks(prev => prev.map(b => b.id === id ? { ...b, ...updates } : b))

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
      setBooks(updateBookLocal(id, updates))
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

  const stats = useMemo(() => calculateStats(books), [books])

  const value = useMemo<BooksContextValue>(() => ({
    books,
    loading: authLoading || loading,
    error,
    stats,
    addBook,
    updateBook,
    deleteBook,
    refresh: loadBooks,
    isAuthenticated: !!user,
  }), [books, authLoading, loading, error, stats, addBook, updateBook, deleteBook, loadBooks, user])

  return <BooksContext.Provider value={value}>{children}</BooksContext.Provider>
}

export function useBooksContext(): BooksContextValue {
  const context = useContext(BooksContext)
  if (!context) {
    throw new Error('useBooks must be used within a BooksProvider')
  }
  return context
}
