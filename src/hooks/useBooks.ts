'use client'

import { useState, useEffect, useCallback } from 'react'
import { Book, ReadingStats } from '@/types/book'
import { useAuth } from '@/components/auth/AuthProvider'
import { fetchBooks, addBookToSupabase, updateBookInSupabase, deleteBookFromSupabase } from '@/lib/supabase/books'
import { getBooks, saveBooks, addBook as addBookLocal, updateBook as updateBookLocal, deleteBook as deleteBookLocal, calculateStats } from '@/lib/storage'

export function useBooks() {
  const { user, loading: authLoading } = useAuth()
  const [books, setBooks] = useState<Book[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch books based on auth state
  const loadBooks = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      if (user) {
        // User is logged in - fetch from Supabase
        const supabaseBooks = await fetchBooks()
        setBooks(supabaseBooks)
      } else {
        // Not logged in - use localStorage
        setBooks(getBooks())
      }
    } catch (err) {
      console.error('Error loading books:', err)
      setError('Failed to load books')
      // Fallback to localStorage
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
        setBooks(prev => prev.map(b => b.id === id ? { ...b, ...updates } : b))
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

  const stats = calculateStats(books)

  return {
    books,
    loading: authLoading || loading,
    error,
    stats,
    addBook,
    updateBook,
    deleteBook,
    refresh: loadBooks,
    isAuthenticated: !!user,
  }
}
