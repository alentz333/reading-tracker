'use client'

import { Suspense, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

function ForgotPasswordForm() {
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  // The callback sends expired or reused reset links back here with ?expired=1
  const [error, setError] = useState<string | null>(
    searchParams.get('expired') ? 'That reset link is invalid or has expired. Request a new one below.' : null
  )
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const supabase = createClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    // The email link lands on the callback, which exchanges the PKCE code for a
    // session and forwards to the page where the new password is chosen.
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/auth/reset`,
    })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      setSent(true)
    }
  }

  if (sent) {
    return (
      <div className="w-full max-w-md text-center space-y-4">
        <div className="text-5xl">📬</div>
        <h1 className="text-2xl font-bold text-white">Check your email</h1>
        <p className="text-gray-400">
          If an account exists for <strong className="text-white">{email}</strong>, we sent a link to reset its password.
        </p>
        <p className="text-gray-500 text-sm">
          Open it in this browser. The link works once and expires after an hour.
        </p>
        <Link href="/auth/login" className="inline-block text-blue-400 hover:text-blue-300 text-sm">
          Back to sign in
        </Link>
      </div>
    )
  }

  return (
    <div className="w-full max-w-md space-y-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-white">Reset your password</h1>
        <p className="mt-2 text-gray-400">Enter your email and we&apos;ll send you a reset link</p>
      </div>

      <form onSubmit={handleSubmit} className="mt-8 space-y-6">
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-1">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="you@example.com"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Sending...' : 'Send reset link'}
        </button>
      </form>

      <p className="text-center text-gray-400 text-sm">
        Remembered it?{' '}
        <Link href="/auth/login" className="text-blue-400 hover:text-blue-300">
          Sign in
        </Link>
      </p>
    </div>
  )
}

export default function ForgotPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0f] p-4">
      <Suspense>
        <ForgotPasswordForm />
      </Suspense>
    </div>
  )
}
