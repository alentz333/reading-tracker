'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
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
  role: string
  username: string
  display_name: string | null
  avatar_url: string | null
}

interface ClubBook {
  id: string
  status: string
  start_date: string | null
  target_finish_date: string | null
  book: {
    id: string
    title: string
    author: string | null
    cover_url: string | null
  }
}

export default function ClubDetailPage() {
  const params = useParams()
  const clubId = params.id as string
  const router = useRouter()
  const { user } = useAuth()
  const supabase = createClient()

  const [club, setClub] = useState<Club | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [books, setBooks] = useState<ClubBook[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [membership, setMembership] = useState<{ role: string } | null>(null)
  const [showInviteCode, setShowInviteCode] = useState(false)

  useEffect(() => {
    loadClub()
  }, [clubId, user])

  async function loadClub() {
    setLoading(true)

    // Fetch club
    const { data: clubData, error } = await supabase
      .from('clubs')
      .select('*')
      .eq('id', clubId)
      .single()

    if (error || !clubData) {
      setNotFound(true)
      setLoading(false)
      return
    }

    setClub(clubData)

    // Check membership
    if (user) {
      const { data: memberData } = await supabase
        .from('club_members')
        .select('role')
        .eq('club_id', clubId)
        .eq('user_id', user.id)
        .single()

      setMembership(memberData)
    }

    // Fetch members
    const { data: membersData } = await supabase
      .from('club_members')
      .select(`
        id,
        user_id,
        role,
        profiles (
          username,
          display_name,
          avatar_url
        )
      `)
      .eq('club_id', clubId)

    if (membersData) {
      setMembers(membersData.map((m: any) => ({
        id: m.id,
        user_id: m.user_id,
        role: m.role,
        ...m.profiles,
      })))
    }

    // Fetch club books
    const { data: booksData } = await supabase
      .from('club_books')
      .select(`
        id,
        status,
        start_date,
        target_finish_date,
        books (
          id,
          title,
          author,
          cover_url
        )
      `)
      .eq('club_id', clubId)
      .order('created_at', { ascending: false })

    if (booksData) {
      setBooks(booksData.map((b: any) => ({
        id: b.id,
        status: b.status,
        start_date: b.start_date,
        target_finish_date: b.target_finish_date,
        book: b.books,
      })))
    }

    setLoading(false)
  }

  async function handleJoin() {
    if (!user || !club) return

    const { error } = await supabase
      .from('club_members')
      .insert({
        club_id: club.id,
        user_id: user.id,
        role: 'member',
      })

    if (!error) {
      loadClub()
    }
  }

  async function handleLeave() {
    if (!user || !club || membership?.role === 'owner') return

    if (!confirm('Are you sure you want to leave this club?')) return

    const { error } = await supabase
      .from('club_members')
      .delete()
      .eq('club_id', club.id)
      .eq('user_id', user.id)

    if (!error) {
      setMembership(null)
      loadClub()
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--color-cream)] flex items-center justify-center">
        <div className="text-xl text-[var(--color-forest)]">Loading club...</div>
      </div>
    )
  }

  if (notFound || !club) {
    return (
      <div className="min-h-screen bg-[var(--color-cream)] flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">📚</div>
          <h1 className="text-2xl font-bold text-[var(--color-forest)] mb-2">Club not found</h1>
          <Link href="/clubs" className="text-[var(--color-forest)] hover:underline">
            ← Back to clubs
          </Link>
        </div>
      </div>
    )
  }

  const currentBook = books.find(b => b.status === 'current')
  const upcomingBooks = books.filter(b => b.status === 'upcoming')
  const finishedBooks = books.filter(b => b.status === 'finished')
  const isAdmin = membership?.role === 'owner' || membership?.role === 'admin'

  return (
    <div className="min-h-screen bg-[var(--color-cream)]">
      {/* Header */}
      <header className="bg-[var(--color-forest)] text-white py-8">
        <div className="max-w-4xl mx-auto px-6">
          <Link href="/clubs" className="text-white/70 hover:text-white text-sm mb-4 inline-block">
            ← Back to clubs
          </Link>

          <div className="flex items-start gap-6">
            {club.cover_url ? (
              <img src={club.cover_url} alt="" className="w-24 h-24 rounded-lg object-cover" />
            ) : (
              <div className="w-24 h-24 rounded-lg bg-[var(--color-gold)] flex items-center justify-center text-4xl">
                📚
              </div>
            )}

            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h1 className="text-3xl font-bold">{club.name}</h1>
                {!club.is_public && <span className="text-white/70">🔒</span>}
              </div>
              {club.description && (
                <p className="text-white/80 mt-2">{club.description}</p>
              )}
              <div className="flex items-center gap-4 mt-4">
                <span className="text-white/70">{members.length} members</span>
                {currentBook && (
                  <span className="text-[var(--color-gold)]">
                    📖 Reading: {currentBook.book.title}
                  </span>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-2">
              {!membership && user && club.is_public && (
                <button
                  onClick={handleJoin}
                  className="px-4 py-2 bg-[var(--color-gold)] text-[var(--color-forest)] font-medium rounded-lg hover:opacity-90"
                >
                  Join Club
                </button>
              )}
              {membership && membership.role !== 'owner' && (
                <button
                  onClick={handleLeave}
                  className="px-4 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20"
                >
                  Leave Club
                </button>
              )}
              {isAdmin && !club.is_public && (
                <button
                  onClick={() => setShowInviteCode(!showInviteCode)}
                  className="px-4 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20 text-sm"
                >
                  {showInviteCode ? 'Hide' : 'Show'} Invite Code
                </button>
              )}
            </div>
          </div>

          {/* Invite Code */}
          {showInviteCode && club.join_code && (
            <div className="mt-4 p-4 bg-white/10 rounded-lg">
              <p className="text-sm text-white/70 mb-1">Share this code to invite members:</p>
              <div className="flex items-center gap-2">
                <code className="text-2xl font-mono font-bold tracking-wider">{club.join_code}</code>
                <button
                  onClick={() => navigator.clipboard.writeText(club.join_code!)}
                  className="text-sm text-white/70 hover:text-white"
                >
                  📋 Copy
                </button>
              </div>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Books Column */}
          <div className="lg:col-span-2 space-y-8">
            {/* Currently Reading */}
            {currentBook && (
              <section>
                <h2 className="text-xl font-semibold text-[var(--color-forest)] mb-4 flex items-center gap-2">
                  📖 Currently Reading
                </h2>
                <div className="card p-4 flex gap-4">
                  {currentBook.book.cover_url ? (
                    <img src={currentBook.book.cover_url} alt="" className="w-24 h-36 object-cover rounded" />
                  ) : (
                    <div className="w-24 h-36 bg-gray-200 rounded flex items-center justify-center text-2xl">📚</div>
                  )}
                  <div>
                    <h3 className="text-lg font-semibold text-[var(--color-forest)]">{currentBook.book.title}</h3>
                    <p className="text-gray-600">{currentBook.book.author}</p>
                    {currentBook.target_finish_date && (
                      <p className="text-sm text-gray-500 mt-2">
                        Target finish: {new Date(currentBook.target_finish_date).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </div>
              </section>
            )}

            {/* Up Next */}
            {upcomingBooks.length > 0 && (
              <section>
                <h2 className="text-xl font-semibold text-[var(--color-forest)] mb-4">📚 Up Next</h2>
                <div className="space-y-3">
                  {upcomingBooks.map(b => (
                    <div key={b.id} className="card p-3 flex gap-3 items-center">
                      {b.book.cover_url ? (
                        <img src={b.book.cover_url} alt="" className="w-12 h-16 object-cover rounded" />
                      ) : (
                        <div className="w-12 h-16 bg-gray-200 rounded flex items-center justify-center">📖</div>
                      )}
                      <div>
                        <h3 className="font-medium text-[var(--color-forest)]">{b.book.title}</h3>
                        <p className="text-sm text-gray-600">{b.book.author}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Previously Read */}
            {finishedBooks.length > 0 && (
              <section>
                <h2 className="text-xl font-semibold text-[var(--color-forest)] mb-4">✓ Previously Read</h2>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {finishedBooks.map(b => (
                    <div key={b.id} className="card p-3 text-center">
                      {b.book.cover_url ? (
                        <img src={b.book.cover_url} alt="" className="w-full h-32 object-cover rounded mb-2" />
                      ) : (
                        <div className="w-full h-32 bg-gray-200 rounded mb-2 flex items-center justify-center text-2xl">📖</div>
                      )}
                      <h3 className="text-sm font-medium text-[var(--color-forest)] line-clamp-2">{b.book.title}</h3>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {books.length === 0 && (
              <div className="card p-8 text-center text-gray-500">
                No books added yet.
                {isAdmin && ' Add some books to get started!'}
              </div>
            )}

            {/* Add Book Button (for admins) */}
            {isAdmin && (
              <Link
                href={`/clubs/${club.id}/add-book`}
                className="block card p-4 text-center text-[var(--color-forest)] hover:bg-gray-50 transition-colors"
              >
                + Add a Book
              </Link>
            )}
          </div>

          {/* Members Sidebar */}
          <div>
            <h2 className="text-xl font-semibold text-[var(--color-forest)] mb-4">Members</h2>
            <div className="card p-4 space-y-3">
              {members.map(member => (
                <Link
                  key={member.id}
                  href={`/user/${member.username}`}
                  className="flex items-center gap-3 hover:bg-gray-50 p-2 -m-2 rounded-lg transition-colors"
                >
                  {member.avatar_url ? (
                    <img src={member.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-[var(--color-gold)] flex items-center justify-center text-[var(--color-forest)] font-bold">
                      {(member.display_name || member.username)[0]?.toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 truncate">
                      {member.display_name || member.username}
                    </div>
                    <div className="text-xs text-gray-500">@{member.username}</div>
                  </div>
                  {member.role !== 'member' && (
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      member.role === 'owner' ? 'bg-yellow-100 text-yellow-700' : 'bg-blue-100 text-blue-700'
                    }`}>
                      {member.role}
                    </span>
                  )}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
