'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/components/auth/AuthProvider'
import Link from 'next/link'

interface Club {
  id: string
  name: string
  description: string | null
  cover_url: string | null
  is_public: boolean
  member_count: number
  created_by: string
}

interface MyClub extends Club {
  role: string
}

export default function ClubsPage() {
  const { user, loading: authLoading } = useAuth()
  const [myClubs, setMyClubs] = useState<MyClub[]>([])
  const [publicClubs, setPublicClubs] = useState<Club[]>([])
  const [loading, setLoading] = useState(true)
  const [joinCode, setJoinCode] = useState('')
  const [joinError, setJoinError] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    if (authLoading) return
    loadClubs()
  }, [authLoading, user])

  async function loadClubs() {
    setLoading(true)

    // Load my clubs if logged in
    if (user) {
      const { data: memberships } = await supabase
        .from('club_members')
        .select(`
          role,
          clubs (
            id,
            name,
            description,
            cover_url,
            is_public,
            created_by
          )
        `)
        .eq('user_id', user.id)

      if (memberships) {
        const clubs = memberships.map((m: any) => ({
          ...m.clubs,
          role: m.role,
          member_count: 0, // Will be fetched separately if needed
        }))
        setMyClubs(clubs)
      }
    }

    // Load public clubs
    const { data: publicData } = await supabase
      .from('clubs')
      .select('id, name, description, cover_url, is_public, created_by')
      .eq('is_public', true)
      .limit(20)

    if (publicData) {
      setPublicClubs(publicData.map(c => ({ ...c, member_count: 0 })))
    }

    setLoading(false)
  }

  async function handleJoinByCode() {
    if (!joinCode.trim() || !user) return
    setJoinError(null)

    const { data: club, error } = await supabase
      .from('clubs')
      .select('id, name')
      .eq('join_code', joinCode.trim())
      .single()

    if (error || !club) {
      setJoinError('Invalid club code')
      return
    }

    // Check if already a member
    const { data: existing } = await supabase
      .from('club_members')
      .select('id')
      .eq('club_id', club.id)
      .eq('user_id', user.id)
      .single()

    if (existing) {
      setJoinError('You\'re already a member of this club')
      return
    }

    // Join the club
    const { error: joinError } = await supabase
      .from('club_members')
      .insert({
        club_id: club.id,
        user_id: user.id,
        role: 'member',
      })

    if (joinError) {
      setJoinError('Failed to join club')
      return
    }

    setJoinCode('')
    loadClubs()
  }

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-[var(--color-cream)] flex items-center justify-center">
        <div className="text-xl text-[var(--color-forest)]">Loading clubs...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[var(--color-cream)]">
      {/* Header */}
      <header className="bg-[var(--color-forest)] text-white py-8">
        <div className="max-w-4xl mx-auto px-6">
          <Link href="/" className="text-white/70 hover:text-white text-sm mb-2 inline-block">
            ← Back to library
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">📖 Book Clubs</h1>
              <p className="text-white/70 mt-1">Read together, discuss together</p>
            </div>
            {user && (
              <Link
                href="/clubs/create"
                className="px-4 py-2 bg-[var(--color-gold)] text-[var(--color-forest)] font-medium rounded-lg hover:opacity-90 transition-opacity"
              >
                + Create Club
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">
        {/* Join by Code */}
        {user && (
          <div className="card p-4 mb-8">
            <h2 className="font-semibold text-[var(--color-forest)] mb-2">Join a Private Club</h2>
            <div className="flex gap-2">
              <input
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="Enter club code"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-forest)]"
              />
              <button
                onClick={handleJoinByCode}
                className="px-4 py-2 bg-[var(--color-forest)] text-white rounded-lg hover:opacity-90"
              >
                Join
              </button>
            </div>
            {joinError && <p className="text-red-500 text-sm mt-2">{joinError}</p>}
          </div>
        )}

        {/* My Clubs */}
        {user && myClubs.length > 0 && (
          <section className="mb-8">
            <h2 className="text-xl font-semibold text-[var(--color-forest)] mb-4">My Clubs</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {myClubs.map(club => (
                <Link
                  key={club.id}
                  href={`/clubs/${club.id}`}
                  className="card p-4 hover:shadow-md transition-shadow flex gap-4"
                >
                  {club.cover_url ? (
                    <img src={club.cover_url} alt="" className="w-16 h-16 rounded-lg object-cover" />
                  ) : (
                    <div className="w-16 h-16 rounded-lg bg-[var(--color-forest)] flex items-center justify-center text-white text-2xl">
                      📚
                    </div>
                  )}
                  <div className="flex-1">
                    <h3 className="font-semibold text-[var(--color-forest)]">{club.name}</h3>
                    {club.description && (
                      <p className="text-sm text-gray-600 line-clamp-2">{club.description}</p>
                    )}
                    <div className="flex items-center gap-2 mt-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        club.role === 'owner' ? 'bg-yellow-100 text-yellow-700' :
                        club.role === 'admin' ? 'bg-blue-100 text-blue-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {club.role}
                      </span>
                      {!club.is_public && (
                        <span className="text-xs text-gray-500">🔒 Private</span>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Discover Public Clubs */}
        <section>
          <h2 className="text-xl font-semibold text-[var(--color-forest)] mb-4">Discover Clubs</h2>
          {publicClubs.length === 0 ? (
            <div className="card p-8 text-center text-gray-500">
              No public clubs yet. Be the first to create one!
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {publicClubs.map(club => (
                <Link
                  key={club.id}
                  href={`/clubs/${club.id}`}
                  className="card p-4 hover:shadow-md transition-shadow flex gap-4"
                >
                  {club.cover_url ? (
                    <img src={club.cover_url} alt="" className="w-16 h-16 rounded-lg object-cover" />
                  ) : (
                    <div className="w-16 h-16 rounded-lg bg-[var(--color-forest)] flex items-center justify-center text-white text-2xl">
                      📚
                    </div>
                  )}
                  <div className="flex-1">
                    <h3 className="font-semibold text-[var(--color-forest)]">{club.name}</h3>
                    {club.description && (
                      <p className="text-sm text-gray-600 line-clamp-2">{club.description}</p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Not logged in prompt */}
        {!user && (
          <div className="card p-8 text-center mt-8">
            <p className="text-gray-600 mb-4">Sign up to create and join book clubs!</p>
            <Link
              href="/auth/signup"
              className="px-6 py-2 bg-[var(--color-forest)] text-white rounded-lg hover:opacity-90"
            >
              Sign Up
            </Link>
          </div>
        )}
      </main>
    </div>
  )
}
