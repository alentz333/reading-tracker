'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/components/auth/AuthProvider'
import Link from 'next/link'

interface SearchResult {
  key: string
  title: string
  author_name?: string[]
  cover_i?: number
  first_publish_year?: number
}

export default function AddBookToClubPage() {
  const params = useParams()
  const clubId = params.id as string
  const router = useRouter()
  const { user } = useAuth()
  const supabase = createClient()

  const [search, setSearch] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [selectedBook, setSelectedBook] = useState<SearchResult | null>(null)
  const [status, setStatus] = useState<'upcoming' | 'current' | 'finished'>('upcoming')
  const [targetDate, setTargetDate] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [clubName, setClubName] = useState('')

  useEffect(() => {
    // Fetch club name
    async function loadClub() {
      const { data } = await supabase
        .from('clubs')
        .select('name')
        .eq('id', clubId)
        .single()
      if (data) setClubName(data.name)
    }
    loadClub()
  }, [clubId])

  async function handleSearch() {
    if (!search.trim()) return
    setSearching(true)
    setResults([])

    try {
      const res = await fetch(
        `https://openlibrary.org/search.json?q=${encodeURIComponent(search)}&limit=10`
      )
      const data = await res.json()
      setResults(data.docs || [])
    } catch (err) {
      console.error('Search failed:', err)
    } finally {
      setSearching(false)
    }
  }

  async function handleAdd() {
    if (!selectedBook || !user) return
    setSaving(true)
    setError(null)

    try {
      // First, create or find the book in the books table
      const bookData = {
        title: selectedBook.title,
        author: selectedBook.author_name?.[0] || 'Unknown',
        cover_url: selectedBook.cover_i 
          ? `https://covers.openlibrary.org/b/id/${selectedBook.cover_i}-M.jpg`
          : null,
        ol_key: selectedBook.key,
        published_date: selectedBook.first_publish_year?.toString(),
      }

      // Check if book exists
      let bookId: string
      const { data: existingBook } = await supabase
        .from('books')
        .select('id')
        .eq('ol_key', selectedBook.key)
        .single()

      if (existingBook) {
        bookId = existingBook.id
      } else {
        const { data: newBook, error: bookError } = await supabase
          .from('books')
          .insert(bookData)
          .select('id')
          .single()

        if (bookError || !newBook) {
          throw new Error('Failed to create book')
        }
        bookId = newBook.id
      }

      // Add book to club
      const { error: clubBookError } = await supabase
        .from('club_books')
        .insert({
          club_id: clubId,
          book_id: bookId,
          status,
          target_finish_date: targetDate || null,
          added_by: user.id,
        })

      if (clubBookError) {
        if (clubBookError.code === '23505') {
          throw new Error('This book is already in the club')
        }
        throw new Error(clubBookError.message)
      }

      router.push(`/clubs/${clubId}`)
    } catch (err: any) {
      setError(err.message || 'Failed to add book')
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-[var(--color-cream)]">
      {/* Header */}
      <header className="bg-[var(--color-forest)] text-white py-6">
        <div className="max-w-2xl mx-auto px-6">
          <Link href={`/clubs/${clubId}`} className="text-white/70 hover:text-white text-sm mb-2 inline-block">
            ← Back to {clubName || 'club'}
          </Link>
          <h1 className="text-2xl font-bold">Add Book to Club</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-8">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {!selectedBook ? (
          /* Search Step */
          <div className="card p-6">
            <h2 className="font-semibold text-[var(--color-forest)] mb-4">Search for a book</h2>
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Search by title or author..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-forest)]"
              />
              <button
                onClick={handleSearch}
                disabled={searching}
                className="px-4 py-2 bg-[var(--color-forest)] text-white rounded-lg hover:opacity-90 disabled:opacity-50"
              >
                {searching ? 'Searching...' : 'Search'}
              </button>
            </div>

            {/* Results */}
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {results.map((book) => (
                <button
                  key={book.key}
                  onClick={() => setSelectedBook(book)}
                  className="w-full flex gap-3 p-3 text-left hover:bg-gray-50 rounded-lg transition-colors"
                >
                  {book.cover_i ? (
                    <img
                      src={`https://covers.openlibrary.org/b/id/${book.cover_i}-S.jpg`}
                      alt=""
                      className="w-12 h-16 object-cover rounded"
                    />
                  ) : (
                    <div className="w-12 h-16 bg-gray-200 rounded flex items-center justify-center">📚</div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-[var(--color-forest)] line-clamp-1">{book.title}</div>
                    <div className="text-sm text-gray-600">
                      {book.author_name?.[0] || 'Unknown author'}
                    </div>
                    {book.first_publish_year && (
                      <div className="text-xs text-gray-500">{book.first_publish_year}</div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* Configure Step */
          <div className="card p-6 space-y-6">
            {/* Selected Book */}
            <div className="flex gap-4 pb-4 border-b border-gray-100">
              {selectedBook.cover_i ? (
                <img
                  src={`https://covers.openlibrary.org/b/id/${selectedBook.cover_i}-M.jpg`}
                  alt=""
                  className="w-20 h-28 object-cover rounded"
                />
              ) : (
                <div className="w-20 h-28 bg-gray-200 rounded flex items-center justify-center text-2xl">📚</div>
              )}
              <div>
                <h3 className="text-lg font-semibold text-[var(--color-forest)]">{selectedBook.title}</h3>
                <p className="text-gray-600">{selectedBook.author_name?.[0] || 'Unknown'}</p>
                <button
                  onClick={() => setSelectedBook(null)}
                  className="text-sm text-[var(--color-forest)] underline mt-2"
                >
                  Choose different book
                </button>
              </div>
            </div>

            {/* Status */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Reading Status</label>
              <div className="flex gap-2">
                {(['upcoming', 'current', 'finished'] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setStatus(s)}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                      status === s
                        ? 'bg-[var(--color-forest)] text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {s === 'upcoming' ? '📚 Up Next' : s === 'current' ? '📖 Reading Now' : '✓ Finished'}
                  </button>
                ))}
              </div>
            </div>

            {/* Target Date */}
            {status !== 'finished' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Target Finish Date (optional)
                </label>
                <input
                  type="date"
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-forest)]"
                />
              </div>
            )}

            {/* Submit */}
            <button
              onClick={handleAdd}
              disabled={saving}
              className="w-full py-3 bg-[var(--color-forest)] text-white font-medium rounded-lg hover:opacity-90 disabled:opacity-50"
            >
              {saving ? 'Adding...' : 'Add to Club'}
            </button>
          </div>
        )}
      </main>
    </div>
  )
}
