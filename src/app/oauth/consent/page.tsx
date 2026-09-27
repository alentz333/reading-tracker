'use client'

import { Suspense, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

// Supabase's OAuth server sends the user here (the Authorization Path set in
// the dashboard) when an MCP client such as Claude asks to connect. The page
// signs the user in if needed, shows who is asking, and records the decision;
// Supabase then redirects back to the client with an authorization code.

interface Details {
  clientName: string
  clientUri: string
  email: string
}

function ConsentScreen() {
  const authorizationId = useSearchParams().get('authorization_id')
  const [details, setDetails] = useState<Details | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    if (!authorizationId) return

    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        const next = `/oauth/consent?authorization_id=${encodeURIComponent(authorizationId)}`
        window.location.replace(`/auth/login?next=${encodeURIComponent(next)}`)
        return
      }

      const { data, error } = await supabase.auth.oauth.getAuthorizationDetails(authorizationId)
      if (error || !data) {
        setError(error?.message ?? 'This authorization request was not found or has expired.')
        return
      }

      // Already approved earlier: Supabase hands back the redirect straight away.
      if (data.redirect_url) {
        window.location.replace(data.redirect_url)
        return
      }

      setDetails({
        clientName: data.client.name || 'An application',
        clientUri: data.client.uri,
        email: data.user.email,
      })
    }

    load()
  }, [authorizationId])

  const decide = async (approve: boolean) => {
    if (!authorizationId) return
    setSubmitting(true)
    setError(null)

    const { data, error } = approve
      ? await supabase.auth.oauth.approveAuthorization(authorizationId, { skipBrowserRedirect: true })
      : await supabase.auth.oauth.denyAuthorization(authorizationId, { skipBrowserRedirect: true })

    if (error || !data) {
      setError(error?.message ?? 'Something went wrong. Try connecting again.')
      setSubmitting(false)
      return
    }
    window.location.replace(data.redirect_url)
  }

  const message = authorizationId
    ? error
    : 'This link is missing its authorization request. Start the connection again from the app you were connecting.'

  if (message) {
    return (
      <div className="w-full max-w-md text-center space-y-4">
        <h1 className="text-2xl font-bold text-white">Can&apos;t connect</h1>
        <p className="text-gray-400">{message}</p>
        <Link href="/" className="inline-block text-blue-400 hover:text-blue-300 text-sm">
          Go to Shelf
        </Link>
      </div>
    )
  }

  if (!details) {
    return <p className="text-gray-500 text-sm">Loading…</p>
  }

  return (
    <div className="w-full max-w-md space-y-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-white">Connect {details.clientName}?</h1>
        <p className="mt-2 text-gray-400">
          Signed in as <strong className="text-white">{details.email}</strong>
        </p>
      </div>

      <div className="bg-white/5 border border-white/10 rounded-lg p-4 space-y-3 text-sm text-gray-300">
        <p>
          <strong className="text-white">{details.clientName}</strong> will be able to act on your Shelf as you:
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Read your library, ratings, reviews and reading stats</li>
          <li>Add books and move them between shelves</li>
          <li>Rate and review books and set your Top 5</li>
        </ul>
        <p className="text-gray-500">
          It can&apos;t see or change anyone else&apos;s shelf. Only approve apps you trust.
        </p>
        {details.clientUri && (
          <p className="text-gray-500 break-all">{details.clientUri}</p>
        )}
      </div>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => decide(false)}
          disabled={submitting}
          className="flex-1 py-3 px-4 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
        >
          Deny
        </button>
        <button
          type="button"
          onClick={() => decide(true)}
          disabled={submitting}
          className="flex-1 py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
        >
          {submitting ? 'Connecting…' : 'Allow'}
        </button>
      </div>
    </div>
  )
}

export default function ConsentPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0f] p-4">
      <Suspense>
        <ConsentScreen />
      </Suspense>
    </div>
  )
}
