import { createMcpHandler, requireBearerAuth } from '@modelcontextprotocol/server';
import { createShelf } from '@/lib/mcp/shelf';
import { buildShelfServer } from '@/lib/mcp/tools';
import { resourceMetadataUrl, sessionFromAuth, verifier } from '@/lib/mcp/remote';

// Remote Shelf MCP endpoint (streamable HTTP). Every request must carry a
// Supabase OAuth access token; an unauthenticated request gets a 401 whose
// WWW-Authenticate header points at our protected-resource metadata, which is
// how Claude and ChatGPT discover where to send the user to sign in.

const handler = createMcpHandler(
  ({ authInfo, requestInfo }) => {
    if (!authInfo) throw new Error('Missing auth');
    const appUrl = requestInfo ? new URL(requestInfo.url).origin : 'https://reading-tracker-chi.vercel.app';
    const shelf = createShelf(async () => sessionFromAuth(authInfo), appUrl);
    return buildShelfServer(shelf);
  },
  { onerror: error => console.error('[shelf-mcp]', error.message) }
);

async function serve(request: Request): Promise<Response> {
  const gate = requireBearerAuth({ verifier, resourceMetadataUrl: resourceMetadataUrl(request) });
  const auth = await gate(request);
  if (auth instanceof Response) return auth;
  return handler.fetch(request, { authInfo: auth });
}

export { serve as GET, serve as POST, serve as DELETE };
