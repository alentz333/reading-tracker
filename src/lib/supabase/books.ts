import { createClient } from './client'
import { Book, ReadingStatus } from '@/types/book'

const supabase = createClient()

// Map our Book type to Supabase user_books + books tables
interface SupabaseBook {
  id: string
  book_id: string
  status: string
  current_page: number | null
  started_at: string | null
  finished_at: string | null
  rating: number | null
  review: string | null
  notes: string | null
  is_favorite: boolean
  is_public: boolean
  created_at: string
  books: {
    id: string
    title: string
    author: string | null
    isbn: string | null
    cover_url: string | null
    description: string | null
    page_count: number | null
    published_date: string | null
  }
}

function mapStatusToDb(status: ReadingStatus): string {
  const map: Record<ReadingStatus, string> = {
    'read': 'read',
    'reading': 'reading',
    'want-to-read': 'want_to_read',
  }
  return map[status] || 'want_to_read'
}

function mapStatusFromDb(status: string): ReadingStatus {
  const map: Record<string, ReadingStatus> = {
    'read': 'read',
    'reading': 'reading',
    'want_to_read': 'want-to-read',
    'dnf': 'read', // Map DNF to read for simplicity
  }
  return map[status] || 'want-to-read'
}

function mapSupabaseToBook(sb: SupabaseBook): Book {
  return {
    id: sb.id, // user_books id
    title: sb.books.title,
    author: sb.books.author || 'Unknown',
    coverUrl: sb.books.cover_url || undefined,
    isbn: sb.books.isbn || undefined,
    pageCount: sb.books.page_count || undefined,
    publishedYear: sb.books.published_date ? parseInt(sb.books.published_date) : undefined,
    status: mapStatusFromDb(sb.status),
    rating: sb.rating || undefined,
    dateStarted: sb.started_at || undefined,
    dateFinished: sb.finished_at || undefined,
    review: sb.review || undefined,
    addedAt: sb.created_at,
    source: 'manual',
    isPublic: sb.is_public,
  }
}

export async function fetchBooks(): Promise<Book[]> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from('user_books')
    .select(`
      id,
      book_id,
      status,
      current_page,
      started_at,
      finished_at,
      rating,
      review,
      notes,
      is_favorite,
      is_public,
      created_at,
      books (
        id,
        title,
        author,
        isbn,
        cover_url,
        description,
        page_count,
        published_date
      )
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching books:', error)
    return []
  }

  return (data as unknown as SupabaseBook[]).map(mapSupabaseToBook)
}

export async function addBookToSupabase(book: Book): Promise<Book | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // First, create or find the book in the books table
  let bookId: string

  // Check if book exists by ISBN
  if (book.isbn) {
    const { data: existingBook } = await supabase
      .from('books')
      .select('id')
      .eq('isbn', book.isbn)
      .single()

    if (existingBook) {
      bookId = existingBook.id
    } else {
      const { data: newBook, error } = await supabase
        .from('books')
        .insert({
          title: book.title,
          author: book.author,
          isbn: book.isbn,
          cover_url: book.coverUrl,
          page_count: book.pageCount,
          published_date: book.publishedYear?.toString(),
        })
        .select('id')
        .single()

      if (error || !newBook) {
        console.error('Error creating book:', error)
        return null
      }
      bookId = newBook.id
    }
  } else {
    // No ISBN, just create a new book entry
    const { data: newBook, error } = await supabase
      .from('books')
      .insert({
        title: book.title,
        author: book.author,
        cover_url: book.coverUrl,
        page_count: book.pageCount,
        published_date: book.publishedYear?.toString(),
      })
      .select('id')
      .single()

    if (error || !newBook) {
      console.error('Error creating book:', error)
      return null
    }
    bookId = newBook.id
  }

  // Now create the user_book entry
  const { data: userBook, error } = await supabase
    .from('user_books')
    .insert({
      user_id: user.id,
      book_id: bookId,
      status: mapStatusToDb(book.status),
      started_at: book.dateStarted,
      finished_at: book.dateFinished,
      rating: book.rating,
      review: book.review,
    })
    .select(`
      id,
      book_id,
      status,
      current_page,
      started_at,
      finished_at,
      rating,
      review,
      notes,
      is_favorite,
      is_public,
      created_at,
      books (
        id,
        title,
        author,
        isbn,
        cover_url,
        description,
        page_count,
        published_date
      )
    `)
    .single()

  if (error || !userBook) {
    console.error('Error adding user book:', error)
    return null
  }

  return mapSupabaseToBook(userBook as unknown as SupabaseBook)
}

export async function updateBookInSupabase(id: string, updates: Partial<Book>): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false

  const dbUpdates: Record<string, unknown> = {}
  
  if (updates.status) dbUpdates.status = mapStatusToDb(updates.status)
  if (updates.rating !== undefined) dbUpdates.rating = updates.rating
  if (updates.review !== undefined) dbUpdates.review = updates.review
  if (updates.dateStarted !== undefined) dbUpdates.started_at = updates.dateStarted
  if (updates.dateFinished !== undefined) dbUpdates.finished_at = updates.dateFinished
  if (updates.isPublic !== undefined) dbUpdates.is_public = updates.isPublic

  const { error } = await supabase
    .from('user_books')
    .update(dbUpdates)
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) {
    console.error('Error updating book:', error)
    return false
  }

  return true
}

export async function deleteBookFromSupabase(id: string): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false

  const { error } = await supabase
    .from('user_books')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) {
    console.error('Error deleting book:', error)
    return false
  }

  return true
}
