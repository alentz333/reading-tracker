'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Book } from '@/types/book'
import Link from 'next/link'
import { useAuth } from '@/components/auth/AuthProvider'

interface Profile {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  bio: string | null
}

interface PublicBook {
  id: string
  title: string
  author: string
  cover_url: string | null
  status: string
  rating: number | null
  finished_at: string | null
}

export default function UserProfilePage() {
  const params = useParams()
  const username = params.username as string
  const { user } = useAuth()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [books, setBooks] = useState<PublicBook[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const supabase = createClient()

  const isOwnProfile = user?.user_metadata?.username === username

  useEffect(() => {
    async function loadProfile() {
      setLoading(true)
      
      // Fetch profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('username', username)
        .single()

      if (profileError || !profileData) {
        setNotFound(true)
        setLoading(false)
        return
      }

      setProfile(profileData)

      // Fetch public books
      const { data: booksData } = await supabase
        .from('user_books')
        .select(`
          id,
          status,
          rating,
          finished_at,
          books (
            title,
            author,
            cover_url
          )
        `)
        .eq('user_id', profileData.id)
        .eq('is_public', true)
        .order('created_at', { ascending: false })

      if (booksData) {
        setBooks(booksData.map((b: any) => ({
          id: b.id,
          title: b.books.title,
          author: b.books.author,
          cover_url: b.books.cover_url,
          status: b.status,
          rating: b.rating,
          finished_at: b.finished_at,
        })))
      }

      setLoading(false)
    }

    loadProfile()
  }, [username])

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--color-cream)] flex items-center justify-center">
        <div className="text-xl text-[var(--color-forest)]">Loading profile...</div>
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-[var(--color-cream)] flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">🔍</div>
          <h1 className="text-2xl font-bold text-[var(--color-forest)] mb-2">User not found</h1>
          <p className="text-gray-600 mb-4">The user @{username} doesn't exist.</p>
          <Link href="/" className="text-[var(--color-forest)] hover:underline">
            ← Back to home
          </Link>
        </div>
      </div>
    )
  }

  const currentlyReading = books.filter(b => b.status === 'reading')
  const readBooks = books.filter(b => b.status === 'read')
  const wantToRead = books.filter(b => b.status === 'want_to_read')

  const statusLabel = (status: string) => {
    const labels: Record<string, string> = {
      'reading': 'Currently Reading',
      'read': 'Read',
      'want_to_read': 'Want to Read',
    }
    return labels[status] || status
  }

  return (
    <div className="min-h-screen bg-[var(--color-cream)]">
      {/* Header */}
      <header className="bg-[var(--color-forest)] text-white py-8">
        <div className="max-w-4xl mx-auto px-6">
          <Link href="/" className="text-white/70 hover:text-white text-sm mb-4 inline-block">
            ← Back to your library
          </Link>
          
          <div className="flex items-start gap-6">
            {/* Avatar */}
            {profile?.avatar_url ? (
              <img 
                src={profile.avatar_url} 
                alt={profile.display_name || username}
                className="w-24 h-24 rounded-full border-4 border-white/20"
              />
            ) : (
              <div className="w-24 h-24 rounded-full bg-[var(--color-gold)] flex items-center justify-center text-[var(--color-forest)] text-3xl font-bold">
                {(profile?.display_name || username)[0]?.toUpperCase()}
              </div>
            )}
            
            {/* Profile Info */}
            <div className="flex-1">
              <h1 className="text-3xl font-bold">
                {profile?.display_name || username}
              </h1>
              <p className="text-white/70">@{username}</p>
              
              {profile?.bio && (
                <p className="mt-2 text-white/90">{profile.bio}</p>
              )}
              
              {/* Stats */}
              <div className="flex gap-6 mt-4">
                <div>
                  <span className="text-2xl font-bold text-[var(--color-gold)]">{readBooks.length}</span>
                  <span className="text-white/70 ml-2">books read</span>
                </div>
                {currentlyReading.length > 0 && (
                  <div>
                    <span className="text-2xl font-bold text-[var(--color-gold)]">{currentlyReading.length}</span>
                    <span className="text-white/70 ml-2">reading now</span>
                  </div>
                )}
              </div>
            </div>
            
            {/* Edit Button */}
            {isOwnProfile && (
              <Link 
                href="/profile/edit"
                className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm transition-colors"
              >
                Edit Profile
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Currently Reading Section */}
      {currentlyReading.length > 0 && (
        <section className="max-w-4xl mx-auto px-6 py-8">
          <h2 className="text-xl font-semibold text-[var(--color-forest)] mb-4 flex items-center gap-2">
            <span className="text-2xl">📖</span> Currently Reading
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {currentlyReading.map(book => (
              <div key={book.id} className="card p-4">
                {book.cover_url ? (
                  <img 
                    src={book.cover_url} 
                    alt={book.title}
                    className="w-full h-40 object-cover rounded mb-2"
                  />
                ) : (
                  <div className="w-full h-40 bg-gray-200 rounded mb-2 flex items-center justify-center text-gray-400">
                    📚
                  </div>
                )}
                <h3 className="font-medium text-sm text-[var(--color-forest)] line-clamp-2">{book.title}</h3>
                <p className="text-xs text-gray-500">{book.author}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* All Books */}
      <section className="max-w-4xl mx-auto px-6 py-8">
        <h2 className="text-xl font-semibold text-[var(--color-forest)] mb-4">
          📚 Library ({books.length} books)
        </h2>
        
        {books.length === 0 ? (
          <div className="card p-8 text-center text-gray-500">
            No public books yet
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {books.map(book => (
              <div key={book.id} className="card p-4 flex gap-4">
                {book.cover_url ? (
                  <img 
                    src={book.cover_url} 
                    alt={book.title}
                    className="w-16 h-24 object-cover rounded flex-shrink-0"
                  />
                ) : (
                  <div className="w-16 h-24 bg-gray-200 rounded flex-shrink-0 flex items-center justify-center text-gray-400">
                    📖
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-[var(--color-forest)] line-clamp-1">{book.title}</h3>
                  <p className="text-sm text-gray-500">{book.author}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      book.status === 'reading' ? 'bg-blue-100 text-blue-700' :
                      book.status === 'read' ? 'bg-green-100 text-green-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {statusLabel(book.status)}
                    </span>
                    {book.rating && (
                      <span className="text-sm">{'⭐'.repeat(book.rating)}</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
