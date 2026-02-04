'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/components/auth/AuthProvider'
import Link from 'next/link'

function generateJoinCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

export default function CreateClubPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const supabase = createClient()

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [coverUrl, setCoverUrl] = useState('')
  const [isPublic, setIsPublic] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user || !name.trim()) return

    setSaving(true)
    setError(null)

    const joinCode = isPublic ? null : generateJoinCode()

    // Create the club
    const { data: club, error: clubError } = await supabase
      .from('clubs')
      .insert({
        name: name.trim(),
        description: description.trim() || null,
        cover_url: coverUrl.trim() || null,
        is_public: isPublic,
        join_code: joinCode,
        created_by: user.id,
      })
      .select('id')
      .single()

    if (clubError || !club) {
      setError(clubError?.message || 'Failed to create club')
      setSaving(false)
      return
    }

    // Add creator as owner
    const { error: memberError } = await supabase
      .from('club_members')
      .insert({
        club_id: club.id,
        user_id: user.id,
        role: 'owner',
      })

    if (memberError) {
      setError('Club created but failed to add you as owner')
      setSaving(false)
      return
    }

    router.push(`/clubs/${club.id}`)
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[var(--color-cream)] flex items-center justify-center">
        <div className="text-xl text-[var(--color-forest)]">Loading...</div>
      </div>
    )
  }

  if (!user) {
    router.push('/auth/login')
    return null
  }

  return (
    <div className="min-h-screen bg-[var(--color-cream)]">
      {/* Header */}
      <header className="bg-[var(--color-forest)] text-white py-6">
        <div className="max-w-2xl mx-auto px-6">
          <Link href="/clubs" className="text-white/70 hover:text-white text-sm mb-2 inline-block">
            ← Back to clubs
          </Link>
          <h1 className="text-2xl font-bold">Create a Book Club</h1>
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

          {/* Club Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Club Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={100}
              placeholder="e.g., Sci-Fi Enthusiasts"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-forest)]"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder="What's your club about? What books do you read?"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-forest)] resize-none"
            />
          </div>

          {/* Cover URL */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Cover Image URL
            </label>
            <input
              type="url"
              value={coverUrl}
              onChange={(e) => setCoverUrl(e.target.value)}
              placeholder="https://example.com/cover.jpg"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-forest)]"
            />
            {coverUrl && (
              <img src={coverUrl} alt="Preview" className="mt-2 w-32 h-32 object-cover rounded-lg" />
            )}
          </div>

          {/* Privacy */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Visibility
            </label>
            <div className="space-y-2">
              <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                <input
                  type="radio"
                  name="visibility"
                  checked={isPublic}
                  onChange={() => setIsPublic(true)}
                  className="text-[var(--color-forest)]"
                />
                <div>
                  <div className="font-medium">🌍 Public</div>
                  <div className="text-sm text-gray-500">Anyone can find and join this club</div>
                </div>
              </label>
              <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                <input
                  type="radio"
                  name="visibility"
                  checked={!isPublic}
                  onChange={() => setIsPublic(false)}
                  className="text-[var(--color-forest)]"
                />
                <div>
                  <div className="font-medium">🔒 Private</div>
                  <div className="text-sm text-gray-500">Only people with the invite code can join</div>
                </div>
              </label>
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={saving || !name.trim()}
            className="w-full py-3 bg-[var(--color-forest)] text-white font-medium rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {saving ? 'Creating...' : 'Create Club'}
          </button>
        </form>
      </main>
    </div>
  )
}
