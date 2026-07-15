'use client'

// Thin alias over the shared BooksProvider context so existing imports keep
// working. The provider (mounted in the root layout) owns the single library
// fetch shared across all pages.
export { useBooksContext as useBooks } from '@/components/BooksProvider'
