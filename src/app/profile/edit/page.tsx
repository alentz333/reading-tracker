'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/components/auth/AuthProvider'
import Link from 'next/link'

export default function EditProfilePage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const supabase = createClient()
  
  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [bio, setBio] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    if (authLoading) return
    
    if (!user) {
      router.push('/auth/login')
      return
    }

    async function loadProfile() {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user!.id)
        .single()

      if (data) {
        setUsername(data.username || '')
        setDisplayName(data.display_name || '')
        setBio(data.bio || '')
        setAvatarUrl(data.avatar_url || '')
      }
      setLoading(false)
    }

    loadProfile()
  }, [user, authLoading])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setSuccess(false)

    // Check if username is taken (if changed)
    const { data: existing } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', username)
      .neq('id', user!.id)
      .single()

    if (existing) {
      setError('Username is already taken')
      setSaving(false)
      return
    }

    const { error } = await supabase
      .from('profiles')
      .update({
        username,
        display_name: displayName,
        bio,
        avatar_url: avatarUrl || null,
      })
      .eq('id', user!.id)

    if (error) {
      setError(error.message)
    } else {
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    }
    setSaving(false)
  }

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-[var(--color-cream)] flex items-center justify-center">
        <div className="text-xl text-[var(--color-forest)]">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[var(--color-cream)]">
      {/* Header */}
      <header className="bg-[var(--color-forest)] text-white py-6">
        <div className="max-w-2xl mx-auto px-6">
          <Link href="/" className="text-white/70 hover:text-white text-sm mb-2 inline-block">
            ← Back to library
          </Link>
          <h1 className="text-2xl font-bold">Edit Profile</h1>
        </div>
      </header>

      {/* Form */}
      <main className="max-w-2xl mx-auto px-6 py-8">
        <form onSubmit={handleSubmit} className="card p-6 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}
          
          {success && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
              Profile updated successfully!
            </div>
          )}

          {/* Avatar Preview */}
          <div className="flex items-center gap-4">
            {avatarUrl ? (
              <img 
                src={avatarUrl} 
                alt="Avatar preview"
                className="w-20 h-20 rounded-full object-cover border-2 border-gray-200"
              />
            ) : (
              <div className="w-20 h-20 rounded-full bg-[var(--color-gold)] flex items-center justify-center text-[var(--color-forest)] text-2xl font-bold">
                {(displayName || username || '?')[0]?.toUpperCase()}
              </div>
            )}
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Avatar URL
              </label>
              <input
                type="url"
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                placeholder="https://example.com/avatar.jpg"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-forest)]"
              />
              <p className="text-xs text-gray-500 mt-1">Paste a URL to your profile picture</p>
            </div>
          </div>

          {/* Username */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Username
            </label>
            <div className="flex items-center">
              <span className="text-gray-500 mr-1">@</span>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                required
                maxLength={30}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-forest)]"
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">Your unique URL: /user/{username || 'username'}</p>
          </div>

          {/* Display Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Display Name
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={50}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-forest)]"
            />
          </div>

          {/* Bio */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Bio
            </label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={3}
              maxLength={200}
              placeholder="Tell others about yourself and what you like to read..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-forest)] resize-none"
            />
            <p className="text-xs text-gray-500 mt-1">{bio.length}/200 characters</p>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-3 bg-[var(--color-forest)] text-white font-medium rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
            <Link
              href={`/user/${username}`}
              className="px-6 py-3 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors text-center"
            >
              View Profile
            </Link>
          </div>
        </form>
      </main>
    </div>
  )
}
