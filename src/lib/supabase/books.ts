import { createClient } from './client'
import { Book, ReadingStatus } from '@/types/book'
import { PREVIOUS_READ_NOTE_TAG } from '@/lib/previous-reads'
import {
  BOOK_SELECT,
  fetchGenresFromOpenLibrary,
  mapStatusToDb,
  mapSupabaseToBook,
  normalizeGenres,
  type SupabaseBook,
} from './book-mapping'

const supabase = createClient()

// getSession() reads the locally stored session (no network round trip),
// unlike getUser() which hits the auth server on every call.
async function getSessionUser() {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.user ?? null
}

// Map our Book type to Supabase user_books + books tables

export async function fetchBooks(): Promise<Book[]> {
  const user = await getSessionUser()
  if (!user) return []

  const { data, error } = await supabase
    .from('user_books')
    .select(BOOK_SELECT)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching books:', error)
    return []
  }

  return (data as unknown as SupabaseBook[]).map(mapSupabaseToBook)
}

export async function addBookToSupabase(book: Book): Promise<Book | null> {
  const user = await getSessionUser()
  if (!user) return null

  let bookId: string

  if (book.isbn) {
    const { data: existingBook } = await supabase
      .from('books')
      .select('id, genres')
      .eq('isbn', book.isbn)
      .single()

    if (existingBook) {
      bookId = existingBook.id
      // Backfill genres if missing and we have an OL key
      if (book.olKey && (!existingBook.genres || existingBook.genres.length === 0)) {
        const genres = await fetchGenresFromOpenLibrary(book.olKey)
        if (genres.length > 0) {
          await supabase.from('books').update({ genres }).eq('id', existingBook.id)
        }
      }
    } else {
      const genres = book.olKey ? await fetchGenresFromOpenLibrary(book.olKey) : []
      const { data: newBook, error } = await supabase
        .from('books')
        .insert({
          title: book.title,
          author: book.author,
          isbn: book.isbn,
          cover_url: book.coverUrl,
          description: book.description,
          page_count: book.pageCount,
          published_date: book.publishedYear?.toString(),
          ol_key: book.olKey,
          genres,
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
    const genres = book.olKey ? await fetchGenresFromOpenLibrary(book.olKey) : []
    const { data: newBook, error } = await supabase
      .from('books')
      .insert({
        title: book.title,
        author: book.author,
        cover_url: book.coverUrl,
        description: book.description,
        page_count: book.pageCount,
        published_date: book.publishedYear?.toString(),
        ol_key: book.olKey,
        genres,
      })
      .select('id')
      .single()

    if (error || !newBook) {
      console.error('Error creating book:', error)
      return null
    }
    bookId = newBook.id
  }

  const { data: userBook, error } = await supabase
    .from('user_books')
    .insert({
      user_id: user.id,
      book_id: bookId,
      status: mapStatusToDb(book.status),
      format: book.format ?? 'book',
      priority: book.priority ?? null,
      started_at: book.dateStarted,
      finished_at: book.dateFinished,
      rating: book.rating,
      review: book.review,
      notes: book.isPreviousRead ? PREVIOUS_READ_NOTE_TAG : null,
      email_summary_on_finish: book.emailSummaryOnFinish ?? false,
    })
    .select(BOOK_SELECT)
    .single()

  if (error || !userBook) {
    console.error('Error adding user book:', error)
    return null
  }

  return mapSupabaseToBook(userBook as unknown as SupabaseBook)
}

export async function updateBookInSupabase(id: string, updates: Partial<Book>): Promise<boolean> {
  const user = await getSessionUser()
  if (!user) return false

  const dbUpdates: Record<string, unknown> = {}

  if ('status' in updates && updates.status) dbUpdates.status = mapStatusToDb(updates.status)
  if ('format' in updates) dbUpdates.format = updates.format ?? 'book'
  if ('priority' in updates) dbUpdates.priority = updates.priority ?? null
  if ('rating' in updates) dbUpdates.rating = updates.rating ?? null
  if ('review' in updates) dbUpdates.review = updates.review ?? null
  if ('progress' in updates) dbUpdates.current_page = updates.progress ?? null // using current_page for progress %
  if ('dateStarted' in updates) dbUpdates.started_at = updates.dateStarted ?? null
  if ('dateFinished' in updates) dbUpdates.finished_at = updates.dateFinished ?? null
  if ('isPublic' in updates) dbUpdates.is_public = updates.isPublic
  if ('isTopFive' in updates) dbUpdates.is_top_five = updates.isTopFive ?? false
  if ('emailSummaryOnFinish' in updates) dbUpdates.email_summary_on_finish = updates.emailSummaryOnFinish ?? false

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

// Persist a manual ordering: ids in display order become priority 1..n.
export async function updateBookPrioritiesInSupabase(orderedIds: string[]): Promise<boolean> {
  const user = await getSessionUser()
  if (!user) return false

  const results = await Promise.all(
    orderedIds.map((id, index) =>
      supabase
        .from('user_books')
        .update({ priority: index + 1 })
        .eq('id', id)
        .eq('user_id', user.id)
    )
  )

  const failed = results.find(r => r.error)
  if (failed) {
    console.error('Error updating book priorities:', failed.error)
    return false
  }

  return true
}

export async function deleteBookFromSupabase(id: string): Promise<boolean> {
  const user = await getSessionUser()
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
