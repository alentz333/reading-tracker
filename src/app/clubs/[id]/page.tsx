'use client'

import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/components/auth/AuthProvider'
import Link from 'next/link'

interface Club {
  id: string
  name: string
  description: string | null
  cover_url: string | null
  is_public: boolean
  join_code: string | null
  created_by: string
}

interface Member {
  id: string
  user_id: string
  role: 'owner' | 'admin' | 'member'
  joined_at: string
  profile: {
    username: string | null
    display_name: string | null
    avatar_url: string | null
  }
}

interface ClubBook {
  id: string
  book_id: string
  status: 'current' | 'upcoming' | 'finished'
  start_date: string | null
  target_finish_date: string | null
  book: {
    id: string
    title: string
    author: string | null
    cover_url: string | null
  }
}

interface BookSearchResult {
  key: string
  title: string
  author_name?: string[]
  cover_i?: number
}

export default function ClubDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: clubId } = use(params)
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const supabase = createClient()

  const [club, setClub] = useState<Club | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [clubBooks, setClubBooks] = useState<ClubBook[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [userRole, setUserRole] = useState<string | null>(null)
  const [showJoinCode, setShowJoinCode] = useState(false)
  
  // Add book modal state
  const [showAddBook, setShowAddBook] = useState(false)
  const [bookSearch, setBookSearch] = useState('')
  const [searchResults, setSearchResults] = useState<BookSearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [addingBook, setAddingBook] = useState(false)

  useEffect(() => {
    if (authLoading) return
    loadClubData()
  }, [authLoading, clubId, user])

  async function loadClubData() {
    setLoading(true)
    setError(null)

    // Load club info
    const { data: clubData, error: clubError } = await supabase
      .from('clubs')
      .select('*')
      .eq('id', clubId)
      .single()

    if (clubError || !clubData) {
      setError('Club not found')
      setLoading(false)
      return
    }
    setClub(clubData)

    // Load members with profiles
    const { data: membersData } = await supabase
      .from('club_members')
      .select(`
        id,
        user_id,
        role,
        joined_at,
        profiles:user_id (username, display_name, avatar_url)
      `)
      .eq('club_id', clubId)
      .order('role', { ascending: true })

    if (membersData) {
      const formattedMembers = membersData.map((m: any) => ({
        ...m,
        profile: m.profiles || { username: null, display_name: null, avatar_url: null }
      }))
      setMembers(formattedMembers)

      // Check if current user is a member
      if (user) {
        const membership = formattedMembers.find((m: Member) => m.user_id === user.id)
        setUserRole(membership?.role || null)
      }
    }

    // Load club books
    const { data: booksData } = await supabase
      .from('club_books')
      .select(`
        id,
        book_id,
        status,
        start_date,
        target_finish_date,
        books:book_id (id, title, author, cover_url)
      `)
      .eq('club_id', clubId)
      .order('created_at', { ascending: false })

    if (booksData) {
      const formattedBooks = booksData.map((b: any) => ({
        ...b,
        book: b.books
      }))
      setClubBooks(formattedBooks)
    }

    setLoading(false)
  }

  async function handleJoinClub() {
    if (!user) {
      router.push('/auth/login')
      return
    }

    const { error } = await supabase
      .from('club_members')
      .insert({
        club_id: clubId,
        user_id: user.id,
        role: 'member'
      })

    if (error) {
      alert('Failed to join club: ' + error.message)
      return
    }

    loadClubData()
  }

  async function handleLeaveClub() {
    if (!user || userRole === 'owner') return

    if (!confirm('Are you sure you want to leave this club?')) return

    const { error } = await supabase
      .from('club_members')
      .delete()
      .eq('club_id', clubId)
      .eq('user_id', user.id)

    if (error) {
      alert('Failed to leave club: ' + error.message)
      return
    }

    loadClubData()
  }

  async function searchBooks() {
    if (!bookSearch.trim()) return
    setSearching(true)

    try {
      const response = await fetch(
        `https://openlibrary.org/search.json?q=${encodeURIComponent(bookSearch)}&limit=10`
      )
      const data = await response.json()
      setSearchResults(data.docs || [])
    } catch (err) {
      console.error('Search failed:', err)
    }

    setSearching(false)
  }

  async function addBookToClub(result: BookSearchResult, status: 'current' | 'upcoming') {
    if (!user || addingBook) return
    setAddingBook(true)

    try {
      // First, create or find the book in our database
      const bookData = {
        title: result.title,
        author: result.author_name?.[0] || null,
        cover_url: result.cover_i 
          ? `https://covers.openlibrary.org/b/id/${result.cover_i}-L.jpg` 
          : null,
        ol_key: result.key
      }

      // Check if book exists
      let bookId: string
      const { data: existingBook } = await supabase
        .from('books')
        .select('id')
        .eq('ol_key', result.key)
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

      // Add to club
      const { error: clubBookError } = await supabase
        .from('club_books')
        .insert({
          club_id: clubId,
          book_id: bookId,
          status,
          added_by: user.id,
          start_date: status === 'current' ? new Date().toISOString().split('T')[0] : null
        })

      if (clubBookError) {
        if (clubBookError.message.includes('duplicate')) {
          alert('This book is already in the club')
        } else {
          throw clubBookError
        }
      }

      setShowAddBook(false)
      setBookSearch('')
      setSearchResults([])
      loadClubData()
    } catch (err: any) {
      alert('Failed to add book: ' + err.message)
    }

    setAddingBook(false)
  }

  async function updateBookStatus(clubBookId: string, newStatus: 'current' | 'upcoming' | 'finished') {
    // If setting a book to current, move existing current book to finished
    if (newStatus === 'current') {
      const currentBook = clubBooks.find(b => b.status === 'current')
      if (currentBook) {
        await supabase
          .from('club_books')
          .update({ status: 'finished' })
          .eq('id', currentBook.id)
      }
    }

    await supabase
      .from('club_books')
      .update({ status: newStatus })
      .eq('id', clubBookId)

    loadClubData()
  }

  async function removeBookFromClub(clubBookId: string) {
    if (!confirm('Remove this book from the club?')) return

    await supabase
      .from('club_books')
      .delete()
      .eq('id', clubBookId)

    loadClubData()
  }

  const isAdmin = userRole === 'owner' || userRole === 'admin'
  const currentBook = clubBooks.find(b => b.status === 'current')
  const upcomingBooks = clubBooks.filter(b => b.status === 'upcoming')
  const finishedBooks = clubBooks.filter(b => b.status === 'finished')

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-[var(--color-cream)] flex items-center justify-center">
        <div className="text-xl text-[var(--color-forest)]">Loading club...</div>
      </div>
    )
  }

  if (error || !club) {
    return (
      <div className="min-h-screen bg-[var(--color-cream)] flex items-center justify-center">
        <div className="text-center">
          <div className="text-xl text-red-600 mb-4">{error || 'Club not found'}</div>
          <Link href="/clubs" className="text-[var(--color-forest)] underline">
            Back to clubs
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[var(--color-cream)]">
      {/* Header */}
      <header className="bg-[var(--color-forest)] text-white py-8">
        <div className="max-w-4xl mx-auto px-6">
          <Link href="/clubs" className="text-white/70 hover:text-white text-sm mb-4 inline-block">
            ← Back to clubs
          </Link>
          
          <div className="flex gap-6 items-start">
            {club.cover_url ? (
              <img src={club.cover_url} alt="" className="w-24 h-24 rounded-lg object-cover" />
            ) : (
              <div className="w-24 h-24 rounded-lg bg-white/10 flex items-center justify-center text-4xl">
                📚
              </div>
            )}
            
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-bold">{club.name}</h1>
                {!club.is_public && <span className="text-sm bg-white/20 px-2 py-1 rounded">🔒 Private</span>}
              </div>
              {club.description && <p className="text-white/70 mt-2">{club.description}</p>}
              <div className="text-sm text-white/60 mt-2">{members.length} member{members.length !== 1 ? 's' : ''}</div>
            </div>

            {/* Join/Leave button */}
            <div className="flex flex-col gap-2">
              {userRole ? (
                <>
                  <span className={`text-sm px-3 py-1 rounded-full text-center ${
                    userRole === 'owner' ? 'bg-yellow-400 text-yellow-900' :
                    userRole === 'admin' ? 'bg-blue-400 text-blue-900' :
                    'bg-white/20'
                  }`}>
                    {userRole}
                  </span>
                  {userRole !== 'owner' && (
                    <button
                      onClick={handleLeaveClub}
                      className="text-sm text-white/60 hover:text-white"
                    >
                      Leave Club
                    </button>
                  )}
                </>
              ) : (
                <button
                  onClick={handleJoinClub}
                  className="px-4 py-2 bg-[var(--color-gold)] text-[var(--color-forest)] font-medium rounded-lg hover:opacity-90"
                >
                  Join Club
                </button>
              )}
            </div>
          </div>

          {/* Join Code (for owners of private clubs) */}
          {userRole === 'owner' && !club.is_public && club.join_code && (
            <div className="mt-4 pt-4 border-t border-white/20">
              <button
                onClick={() => setShowJoinCode(!showJoinCode)}
                className="text-sm text-white/70 hover:text-white"
              >
                {showJoinCode ? 'Hide' : 'Show'} invite code
              </button>
              {showJoinCode && (
                <div className="mt-2 p-3 bg-white/10 rounded-lg">
                  <span className="font-mono text-lg tracking-wider">{club.join_code}</span>
                  <button
                    onClick={() => navigator.clipboard.writeText(club.join_code!)}
                    className="ml-3 text-sm underline"
                  >
                    Copy
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Left Column: Books */}
        <div className="md:col-span-2 space-y-8">
          {/* Currently Reading */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-[var(--color-forest)]">📖 Currently Reading</h2>
              {isAdmin && (
                <button
                  onClick={() => setShowAddBook(true)}
                  className="text-sm text-[var(--color-forest)] underline"
                >
                  + Add Book
                </button>
              )}
            </div>
            
            {currentBook ? (
              <div className="card p-4 flex gap-4">
                {currentBook.book.cover_url ? (
                  <img src={currentBook.book.cover_url} alt="" className="w-20 h-28 object-cover rounded" />
                ) : (
                  <div className="w-20 h-28 bg-gray-200 rounded flex items-center justify-center">📕</div>
                )}
                <div className="flex-1">
                  <h3 className="font-semibold text-[var(--color-forest)]">{currentBook.book.title}</h3>
                  {currentBook.book.author && (
                    <p className="text-sm text-gray-600">by {currentBook.book.author}</p>
                  )}
                  {currentBook.start_date && (
                    <p className="text-xs text-gray-500 mt-2">Started: {new Date(currentBook.start_date).toLocaleDateString()}</p>
                  )}
                  {isAdmin && (
                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={() => updateBookStatus(currentBook.id, 'finished')}
                        className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded"
                      >
                        Mark Finished
                      </button>
                      <button
                        onClick={() => removeBookFromClub(currentBook.id)}
                        className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded"
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="card p-8 text-center text-gray-500">
                No book currently being read
                {isAdmin && <p className="text-sm mt-2">Click "Add Book" to get started!</p>}
              </div>
            )}
          </section>

          {/* Reading Queue */}
          <section>
            <h2 className="text-xl font-semibold text-[var(--color-forest)] mb-4">📚 Reading Queue</h2>
            {upcomingBooks.length === 0 ? (
              <div className="card p-6 text-center text-gray-500">
                No books in queue yet
              </div>
            ) : (
              <div className="space-y-3">
                {upcomingBooks.map((book) => (
                  <div key={book.id} className="card p-3 flex gap-3 items-center">
                    {book.book.cover_url ? (
                      <img src={book.book.cover_url} alt="" className="w-12 h-16 object-cover rounded" />
                    ) : (
                      <div className="w-12 h-16 bg-gray-200 rounded flex items-center justify-center text-sm">📕</div>
                    )}
                    <div className="flex-1">
                      <h3 className="font-medium text-[var(--color-forest)]">{book.book.title}</h3>
                      {book.book.author && (
                        <p className="text-sm text-gray-600">{book.book.author}</p>
                      )}
                    </div>
                    {isAdmin && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => updateBookStatus(book.id, 'current')}
                          className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded"
                        >
                          Start Reading
                        </button>
                        <button
                          onClick={() => removeBookFromClub(book.id)}
                          className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded"
                        >
                          Remove
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Finished Books */}
          {finishedBooks.length > 0 && (
            <section>
              <h2 className="text-xl font-semibold text-[var(--color-forest)] mb-4">✅ Finished</h2>
              <div className="space-y-3">
                {finishedBooks.map((book) => (
                  <div key={book.id} className="card p-3 flex gap-3 items-center opacity-70">
                    {book.book.cover_url ? (
                      <img src={book.book.cover_url} alt="" className="w-12 h-16 object-cover rounded" />
                    ) : (
                      <div className="w-12 h-16 bg-gray-200 rounded flex items-center justify-center text-sm">📕</div>
                    )}
                    <div className="flex-1">
                      <h3 className="font-medium text-[var(--color-forest)]">{book.book.title}</h3>
                      {book.book.author && (
                        <p className="text-sm text-gray-600">{book.book.author}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Right Column: Members */}
        <aside>
          <h2 className="text-xl font-semibold text-[var(--color-forest)] mb-4">👥 Members</h2>
          <div className="card p-4 space-y-3">
            {members.map((member) => (
              <div key={member.id} className="flex items-center gap-3">
                {member.profile.avatar_url ? (
                  <img src={member.profile.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-[var(--color-forest)] flex items-center justify-center text-white text-sm">
                    {(member.profile.display_name || member.profile.username || '?')[0].toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <Link 
                    href={`/user/${member.profile.username || member.user_id}`}
                    className="font-medium text-[var(--color-forest)] hover:underline truncate block"
                  >
                    {member.profile.display_name || member.profile.username || 'Anonymous'}
                  </Link>
                  <span className={`text-xs px-1.5 py-0.5 rounded ${
                    member.role === 'owner' ? 'bg-yellow-100 text-yellow-700' :
                    member.role === 'admin' ? 'bg-blue-100 text-blue-700' :
                    'bg-gray-100 text-gray-600'
                  }`}>
                    {member.role}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </aside>
      </main>

      {/* Add Book Modal */}
      {showAddBook && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 max-w-lg w-full max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-[var(--color-forest)]">Add Book to Club</h2>
              <button
                onClick={() => {
                  setShowAddBook(false)
                  setBookSearch('')
                  setSearchResults([])
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            <div className="flex gap-2 mb-4">
              <input
                type="text"
                value={bookSearch}
                onChange={(e) => setBookSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && searchBooks()}
                placeholder="Search for a book..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-forest)]"
              />
              <button
                onClick={searchBooks}
                disabled={searching}
                className="px-4 py-2 bg-[var(--color-forest)] text-white rounded-lg hover:opacity-90 disabled:opacity-50"
              >
                {searching ? '...' : 'Search'}
              </button>
            </div>

            <div className="space-y-3">
              {searchResults.map((result) => (
                <div key={result.key} className="flex gap-3 p-3 border border-gray-200 rounded-lg">
                  {result.cover_i ? (
                    <img
                      src={`https://covers.openlibrary.org/b/id/${result.cover_i}-M.jpg`}
                      alt=""
                      className="w-12 h-16 object-cover rounded"
                    />
                  ) : (
                    <div className="w-12 h-16 bg-gray-200 rounded flex items-center justify-center text-sm">📕</div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-[var(--color-forest)] truncate">{result.title}</h3>
                    {result.author_name && (
                      <p className="text-sm text-gray-600 truncate">{result.author_name.join(', ')}</p>
                    )}
                  </div>
                  <div className="flex flex-col gap-1">
                    <button
                      onClick={() => addBookToClub(result, 'current')}
                      disabled={addingBook}
                      className="text-xs px-2 py-1 bg-[var(--color-forest)] text-white rounded hover:opacity-90 disabled:opacity-50"
                    >
                      Read Now
                    </button>
                    <button
                      onClick={() => addBookToClub(result, 'upcoming')}
                      disabled={addingBook}
                      className="text-xs px-2 py-1 border border-[var(--color-forest)] text-[var(--color-forest)] rounded hover:bg-gray-50 disabled:opacity-50"
                    >
                      Add to Queue
                    </button>
                  </div>
                </div>
              ))}

              {searchResults.length === 0 && bookSearch && !searching && (
                <p className="text-center text-gray-500 py-4">No results found. Try a different search.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
