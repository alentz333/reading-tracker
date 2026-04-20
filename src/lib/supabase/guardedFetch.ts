const REST_ROOT_PATH_REGEX = /^\/rest\/v1\/?$/

function extractUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input
  if (input instanceof URL) return input.toString()
  return input.url
}

export function createGuardedSupabaseFetch(
  supabaseProjectUrl: string,
  baseFetch: typeof fetch = fetch
): typeof fetch {
  if (!supabaseProjectUrl) return baseFetch;
  const projectOrigin = new URL(supabaseProjectUrl).origin

  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const rawUrl = extractUrl(input)
    const resolvedUrl = new URL(rawUrl, supabaseProjectUrl)

    if (
      resolvedUrl.origin === projectOrigin &&
      REST_ROOT_PATH_REGEX.test(resolvedUrl.pathname)
    ) {
      throw new Error(
        'Blocked request to Supabase Data API root (/rest/v1/). Use table endpoints like /rest/v1/<table>.'
      )
    }

    return baseFetch(input, init)
  }) as typeof fetch
}
