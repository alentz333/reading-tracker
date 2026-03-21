import { createBrowserClient } from '@supabase/ssr'
import { createGuardedSupabaseFetch } from './guardedFetch'

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!

  return createBrowserClient(
    supabaseUrl,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        fetch: createGuardedSupabaseFetch(supabaseUrl),
      },
    }
  )
}
