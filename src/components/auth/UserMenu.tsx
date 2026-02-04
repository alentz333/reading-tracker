'use client'

import { useState, useRef, useEffect } from 'react'
import { useAuth } from './AuthProvider'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function UserMenu() {
  const { user, loading, signOut } = useAuth()
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  if (loading) {
    return (
      <div className="w-8 h-8 rounded-full bg-white/20 animate-pulse" />
    )
  }

  if (!user) {
    return (
      <div className="flex items-center gap-2">
        <Link
          href="/auth/login"
          className="px-3 py-1.5 text-sm text-white/80 hover:text-white transition-colors"
        >
          Log in
        </Link>
        <Link
          href="/auth/signup"
          className="px-3 py-1.5 text-sm bg-[var(--color-gold)] hover:bg-[var(--color-gold)]/90 text-[var(--color-forest)] font-medium rounded-lg transition-colors"
        >
          Sign up
        </Link>
      </div>
    )
  }

  const handleSignOut = async () => {
    await signOut()
    setOpen(false)
    router.push('/')
    router.refresh()
  }

  const displayName = user.user_metadata?.full_name || user.user_metadata?.username || user.email?.split('@')[0]
  const avatarUrl = user.user_metadata?.avatar_url

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 hover:opacity-80 transition-opacity"
      >
        {avatarUrl ? (
          <img src={avatarUrl} alt="" className="w-8 h-8 rounded-full border-2 border-white/30" />
        ) : (
          <div className="w-8 h-8 rounded-full bg-[var(--color-gold)] flex items-center justify-center text-[var(--color-forest)] text-sm font-bold">
            {displayName?.[0]?.toUpperCase() || '?'}
          </div>
        )}
        <span className="text-sm text-white hidden sm:block">{displayName}</span>
        <svg className="w-4 h-4 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-xl py-1 z-50">
          <div className="px-4 py-2 border-b border-gray-100">
            <p className="text-sm font-medium text-gray-900 truncate">{displayName}</p>
            <p className="text-xs text-gray-500 truncate">{user.email}</p>
          </div>
          <Link
            href="/profile"
            onClick={() => setOpen(false)}
            className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Profile
          </Link>
          <Link
            href="/settings"
            onClick={() => setOpen(false)}
            className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Settings
          </Link>
          <button
            onClick={handleSignOut}
            className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-50 transition-colors"
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  )
}
