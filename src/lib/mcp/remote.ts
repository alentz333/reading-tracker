import { createClient } from '@supabase/supabase-js';
import {
  OAuthError,
  OAuthErrorCode,
  getOAuthProtectedResourceMetadataUrl,
  type AuthInfo,
  type AuthMetadataOptions,
  type OAuthTokenVerifier,
} from '@modelcontextprotocol/server';
import { createGuardedSupabaseFetch } from '@/lib/supabase/guardedFetch';
import type { ShelfSession } from './shelf';

// Supabase's OAuth 2.1 server is the authorization server; this app is only
// the resource server. Clients discover Supabase from the protected-resource
// metadata we publish, sign the user in on /oauth/consent, and call /api/mcp
// with the access token Supabase issues. That token is an ordinary Supabase
// user JWT, so handing it to PostgREST scopes every query to that user by RLS.

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const MCP_PATH = '/api/mcp';

export function resourceUrl(request: Request): URL {
  return new URL(MCP_PATH, new URL(request.url).origin);
}

export function resourceMetadataUrl(request: Request): string {
  return getOAuthProtectedResourceMetadataUrl(resourceUrl(request));
}

let authServerMetadata: Promise<AuthMetadataOptions['oauthMetadata']> | null = null;

/** Supabase's RFC 8414 document, fetched once per server instance. */
function fetchAuthServerMetadata(): Promise<AuthMetadataOptions['oauthMetadata']> {
  authServerMetadata ??= fetch(`${supabaseUrl}/.well-known/oauth-authorization-server/auth/v1`)
    .then(res => {
      if (!res.ok) throw new Error(`Authorization server metadata: ${res.status}`);
      return res.json();
    })
    .catch(error => {
      authServerMetadata = null;
      throw error;
    });
  return authServerMetadata;
}

export async function authMetadataOptions(request: Request): Promise<AuthMetadataOptions> {
  return {
    oauthMetadata: await fetchAuthServerMetadata(),
    resourceServerUrl: resourceUrl(request),
    resourceName: 'Shelf',
  };
}

/**
 * Verify a Supabase access token. getClaims checks the signature locally
 * against the project's JWKS when tokens are asymmetrically signed, and falls
 * back to asking Supabase Auth otherwise, so a forged or expired token is
 * refused either way.
 */
export const verifier: OAuthTokenVerifier = {
  async verifyAccessToken(token: string): Promise<AuthInfo> {
    const auth = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    }).auth;
    // getClaims throws, rather than returning an error, on a malformed token.
    const { data, error } = await auth.getClaims(token).catch(() => ({ data: null, error: true }));

    if (error || !data?.claims?.sub) {
      throw new OAuthError(OAuthErrorCode.InvalidToken, 'Invalid or expired access token');
    }

    const claims = data.claims as Record<string, unknown>;
    return {
      token,
      clientId: typeof claims.client_id === 'string' ? claims.client_id : 'supabase',
      scopes: typeof claims.scope === 'string' ? claims.scope.split(' ').filter(Boolean) : [],
      expiresAt: typeof claims.exp === 'number' ? claims.exp : undefined,
      extra: { userId: claims.sub },
    };
  },
};

/** A database session acting as the token's user, subject to RLS. */
export function sessionFromAuth(authInfo: AuthInfo): ShelfSession {
  const db = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      headers: { Authorization: `Bearer ${authInfo.token}` },
      fetch: createGuardedSupabaseFetch(supabaseUrl),
    },
  });
  return { db, uid: String(authInfo.extra?.userId) };
}
