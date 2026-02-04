'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/auth/AuthProvider'

export default function ProfileRedirect() {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (loading) return
    
    if (!user) {
      router.push('/auth/login')
      return
    }

    const username = user.user_metadata?.username || user.email?.split('@')[0]
    router.push(`/user/${username}`)
  }, [user, loading, router])

  return (
    <div className="min-h-screen bg-[var(--color-cream)] flex items-center justify-center">
      <div className="text-xl text-[var(--color-forest)]">Loading profile...</div>
    </div>
  )
}
