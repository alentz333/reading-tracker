import { oauthMetadataResponse } from '@modelcontextprotocol/server';
import { authMetadataOptions } from '@/lib/mcp/remote';

// RFC 9728 protected-resource metadata for /api/mcp: names Supabase as the
// authorization server so MCP clients know where to send the user to sign in.
export async function GET(request: Request): Promise<Response> {
  return oauthMetadataResponse(request, await authMetadataOptions(request)) ?? new Response('Not found', { status: 404 });
}

export { GET as OPTIONS };
