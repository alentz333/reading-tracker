import { oauthMetadataResponse } from '@modelcontextprotocol/server';
import { authMetadataOptions } from '@/lib/mcp/remote';

// Mirrors Supabase's RFC 8414 metadata at this origin for older MCP clients
// that look for the authorization server on the resource's own host.
export async function GET(request: Request): Promise<Response> {
  return oauthMetadataResponse(request, await authMetadataOptions(request)) ?? new Response('Not found', { status: 404 });
}

export { GET as OPTIONS };
