import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { createGuardedSupabaseFetch } from './guardedFetch'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  // Without a Supabase auth cookie there is no session to verify or refresh,
  // so signed-out traffic skips the client construction and the auth call
  // entirely instead of paying for a lookup that can only come back empty.
  const hasAuthCookie = request.cookies
    .getAll()
    .some(cookie => cookie.name.startsWith('sb-'))
  if (!hasAuthCookie) {
    return supabaseResponse
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!

  const supabase = createServerClient(
    supabaseUrl,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
      global: {
        fetch: createGuardedSupabaseFetch(supabaseUrl),
      },
    }
  )

  // Refresh session if expired, then verify it.
  //
  // getClaims reads the session first (which is what performs the refresh) and
  // then validates the JWT signature locally with WebCrypto, so a signed-in
  // request no longer makes a network round trip to Supabase Auth on every
  // navigation. That local path needs the project to sign tokens with
  // asymmetric keys; on legacy shared-secret (HS*) tokens the SDK falls back to
  // the same getUser call this replaced, so this is never slower than before.
  await supabase.auth.getClaims()

  return supabaseResponse
}
