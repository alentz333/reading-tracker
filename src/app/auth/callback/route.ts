import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// Only same-origin paths are honored, so the callback can't be used as an open redirect.
function safeNextPath(next: string | null) {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : '/'
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const next = safeNextPath(requestUrl.searchParams.get('next'))
  const isPasswordReset = next === '/auth/reset'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    // An expired, reused, or cross-browser reset link can't be exchanged —
    // send the reader back to request a fresh one instead of a dead end.
    if (error && isPasswordReset) {
      return NextResponse.redirect(new URL('/auth/forgot?expired=1', requestUrl.origin))
    }
  } else if (isPasswordReset && requestUrl.searchParams.get('error')) {
    return NextResponse.redirect(new URL('/auth/forgot?expired=1', requestUrl.origin))
  }

  // URL to redirect to after sign in process completes
  return NextResponse.redirect(new URL(next, requestUrl.origin))
}
