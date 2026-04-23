import { createClient } from './client'
import { Book, ReadingStatus } from '@/types/book'
import { PREVIOUS_READ_NOTE_TAG } from '@/lib/previous-reads'

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
    genres: string[] | null
  }
}

// Ordered from most-specific to least-specific so earlier rules win.
const GENRE_RULES: [string[], string][] = [
  [['young adult', 'ya fiction', 'young-adult', 'teen fiction'], 'Young Adult'],
  [["children's", 'juvenile', 'picture book', 'easy reader'], "Children's"],
  [['science fiction', 'sci-fi', 'space opera', 'dystopian', 'cyberpunk', 'time travel', 'speculative fiction'], 'Science Fiction'],
  [['fantasy', 'epic fantasy', 'high fantasy', 'sword and sorcery', 'magical realism', 'wizards', 'dragons'], 'Fantasy'],
  [['mystery', 'detective', 'whodunit', 'cozy mystery', 'hardboiled', 'crime fiction', 'murder mystery'], 'Mystery'],
  [['thriller', 'suspense', 'espionage', 'spy fiction', 'techno-thriller'], 'Thriller'],
  [['horror', 'ghost stories', 'supernatural fiction', 'gothic fiction', 'dark fiction'], 'Horror'],
  [['romance', 'love stories', 'romantic fiction'], 'Romance'],
  [['historical fiction', 'historical novel'], 'Historical Fiction'],
  [['biography', 'autobiography', 'memoir', 'life story', 'personal narratives'], 'Biography'],
  [['self-help', 'personal development', 'self improvement', 'self-improvement', 'motivational'], 'Self-Help'],
  [['history', 'world history', 'ancient history', 'military history'], 'History'],
  [['science', 'physics', 'biology', 'chemistry', 'astronomy', 'natural history', 'popular science'], 'Science'],
  [['psychology', 'psychological', 'psychiatry', 'cognitive', 'behavioral'], 'Psychology'],
  [['philosophy', 'philosophical', 'ethics', 'logic', 'metaphysics'], 'Philosophy'],
  [['business', 'economic', 'finance', 'entrepreneurship', 'management', 'leadership', 'marketing'], 'Business'],
  [['politics', 'political', 'government', 'democracy'], 'Politics'],
  [['religion', 'spiritual', 'theology', 'christian', 'islamic', 'buddhis', 'hindu'], 'Religion'],
  [['adventure', 'action and adventure'], 'Adventure'],
  [['humor', 'comedy', 'satire', 'humorous', 'wit and humor'], 'Humor'],
  [['poetry', 'verse', 'poems'], 'Poetry'],
  [['drama', 'plays', 'theatrical'], 'Drama'],
  [['graphic novel', 'comics', 'manga', 'comic book'], 'Graphic Novel'],
  [['cooking', 'food', 'recipes', 'cuisine', 'baking', 'gastronomy'], 'Cooking'],
  [['travel', 'travelogue', 'travel writing'], 'Travel'],
  [['nonfiction', 'non-fiction', 'popular works'], 'Nonfiction'],
  [['fiction'], 'Fiction'],
]

function normalizeGenres(subjects: string[]): string[] {
  const found: string[] = []
  for (const subject of subjects) {
    const lower = subject.toLowerCase()
    for (const [keywords, genre] of GENRE_RULES) {
      if (found.includes(genre)) continue
      if (keywords.some(kw => lower.includes(kw))) {
        found.push(genre)
        break
      }
    }
    if (found.length >= 5) break
  }
  return found.slice(0, 5)
}

async function fetchGenresFromOpenLibrary(olKey: string): Promise<string[]> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 4000)
    const response = await fetch(`https://openlibrary.org${olKey}.json`, { signal: controller.signal })
    clearTimeout(timeout)
    if (!response.ok) return []
    const data = await response.json()
    const subjects: string[] = data.subjects || []
    return normalizeGenres(subjects)
  } catch {
    return []
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
  const author = sb.books.author || 'Unknown'
  const status = mapStatusFromDb(sb.status)
  const isTaggedPreviousRead = (sb.notes || '').includes(PREVIOUS_READ_NOTE_TAG)
  const isLegacyPreviousRead =
    status === 'read' &&
    author.trim().toLowerCase() === 'unknown author'

  return {
    id: sb.id, // user_books id
    title: sb.books.title,
    author,
    coverUrl: sb.books.cover_url || undefined,
    isbn: sb.books.isbn || undefined,
    pageCount: sb.books.page_count || undefined,
    publishedYear: sb.books.published_date ? parseInt(sb.books.published_date) : undefined,
    status,
    rating: sb.rating || undefined,
    progress: sb.current_page || undefined, // current_page stores progress percentage (0-100)
    dateStarted: sb.started_at || undefined,
    dateFinished: sb.finished_at || undefined,
    review: sb.review || undefined,
    genres: sb.books.genres ?? undefined,
    addedAt: sb.created_at,
    source: 'manual',
    isPublic: sb.is_public,
    isPreviousRead: isTaggedPreviousRead || isLegacyPreviousRead,
  }
}

const BOOK_SELECT = `
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
    published_date,
    genres
  )
`

export async function fetchBooks(): Promise<Book[]> {
  const { data: { user } } = await supabase.auth.getUser()
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
  const { data: { user } } = await supabase.auth.getUser()
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
      started_at: book.dateStarted,
      finished_at: book.dateFinished,
      rating: book.rating,
      review: book.review,
      notes: book.isPreviousRead ? PREVIOUS_READ_NOTE_TAG : null,
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
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false

  const dbUpdates: Record<string, unknown> = {}

  if ('status' in updates && updates.status) dbUpdates.status = mapStatusToDb(updates.status)
  if ('rating' in updates) dbUpdates.rating = updates.rating ?? null
  if ('review' in updates) dbUpdates.review = updates.review ?? null
  if ('progress' in updates) dbUpdates.current_page = updates.progress ?? null // using current_page for progress %
  if ('dateStarted' in updates) dbUpdates.started_at = updates.dateStarted ?? null
  if ('dateFinished' in updates) dbUpdates.finished_at = updates.dateFinished ?? null
  if ('isPublic' in updates) dbUpdates.is_public = updates.isPublic

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
