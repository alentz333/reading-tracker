import { Book, ReadingStatus } from '@/types/book'
import { PREVIOUS_READ_NOTE_TAG } from '@/lib/previous-reads'

// Row shape, status mapping and genre normalisation, kept apart from the
// browser Supabase client in books.ts so a Node process (the MCP server) can
// import them. Nothing here constructs a client or reads a session.
//
// Note the status mapping: the app uses 'want-to-read' and the database uses
// 'want_to_read'. Every client must go through these two functions.

export interface SupabaseBook {
  id: string
  book_id: string
  status: string
  format: string | null
  current_page: number | null
  started_at: string | null
  finished_at: string | null
  rating: number | null
  review: string | null
  notes: string | null
  is_favorite: boolean
  is_public: boolean
  is_top_five: boolean
  email_summary_on_finish: boolean
  priority: number | null
  created_at: string
  books: {
    id: string
    title: string
    author: string | null
    isbn: string | null
    cover_url: string | null
    page_count: number | null
    published_date: string | null
    genres: string[] | null
  }
}

// Ordered from most-specific to least-specific so earlier rules win.
export const GENRE_RULES: [string[], string][] = [
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

export function normalizeGenres(subjects: string[]): string[] {
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

export async function fetchGenresFromOpenLibrary(olKey: string): Promise<string[]> {
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

export function mapStatusToDb(status: ReadingStatus): string {
  const map: Record<ReadingStatus, string> = {
    'read': 'read',
    'reading': 'reading',
    'want-to-read': 'want_to_read',
    'dnf': 'dnf',
  }
  return map[status] || 'want_to_read'
}

export function mapStatusFromDb(status: string): ReadingStatus {
  const map: Record<string, ReadingStatus> = {
    'read': 'read',
    'reading': 'reading',
    'want_to_read': 'want-to-read',
    'dnf': 'dnf',
  }
  return map[status] || 'want-to-read'
}

export function mapSupabaseToBook(sb: SupabaseBook): Book {
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
    format: sb.format === 'audiobook' ? 'audiobook' : 'book',
    priority: sb.priority ?? undefined,
    rating: sb.rating || undefined,
    progress: sb.current_page || undefined, // current_page stores progress percentage (0-100)
    dateStarted: sb.started_at || undefined,
    dateFinished: sb.finished_at || undefined,
    review: sb.review || undefined,
    genres: sb.books.genres ?? undefined,
    addedAt: sb.created_at,
    source: 'manual',
    isPublic: sb.is_public,
    isTopFive: sb.is_top_five,
    emailSummaryOnFinish: sb.email_summary_on_finish,
    isPreviousRead: isTaggedPreviousRead || isLegacyPreviousRead,
  }
}

export const BOOK_SELECT = `
  id,
  book_id,
  status,
  format,
  current_page,
  started_at,
  finished_at,
  rating,
  review,
  notes,
  is_favorite,
  is_public,
  is_top_five,
  email_summary_on_finish,
  priority,
  created_at,
  books (
    id,
    title,
    author,
    isbn,
    cover_url,
    page_count,
    published_date,
    genres
  )
`
