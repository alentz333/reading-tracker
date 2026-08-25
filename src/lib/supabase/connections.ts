import { createClient } from './client'

// ============================================
// Types
// ============================================

export interface ConnectionProfile {
  id: string
  username: string
  displayName: string | null
  avatarUrl: string | null
}

export interface Reader extends ConnectionProfile {
  // Connection state between the signed-in user and this reader, if any
  connectionId: string | null
  connectionStatus: 'none' | 'pending-outgoing' | 'pending-incoming' | 'accepted'
}

export interface ConnectionRequest extends ConnectionProfile {
  connectionId: string
}

export interface UserConnections {
  friends: ConnectionRequest[]
  incomingRequests: ConnectionRequest[]
  outgoingRequests: ConnectionRequest[]
}

interface ProfileRow {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
}

function mapProfile(row: ProfileRow): ConnectionProfile {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
  }
}

// ============================================
// Directory ("see who else is on the app")
// ============================================

// All other readers, annotated with the signed-in user's connection status
// toward each one. Works for signed-out visitors too (connectionStatus is
// always 'none' then, since there's no one to have a connection as).
export async function fetchReaderDirectory(currentUserId: string | null): Promise<Reader[]> {
  const supabase = createClient()

  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url')
    .not('username', 'is', null)
    .order('username', { ascending: true })
    .limit(100)

  if (error || !profiles) return []

  const others = (profiles as ProfileRow[]).filter(p => p.id !== currentUserId)

  if (!currentUserId) {
    return others.map(p => ({ ...mapProfile(p), connectionId: null, connectionStatus: 'none' }))
  }

  const { data: connections } = await supabase
    .from('user_connections')
    .select('id, requester_id, addressee_id, status')
    .or(`requester_id.eq.${currentUserId},addressee_id.eq.${currentUserId}`)

  const statusByOtherId = new Map<string, { id: string; status: Reader['connectionStatus'] }>()
  for (const c of connections || []) {
    const otherId = c.requester_id === currentUserId ? c.addressee_id : c.requester_id
    const status: Reader['connectionStatus'] =
      c.status === 'accepted' ? 'accepted' : c.requester_id === currentUserId ? 'pending-outgoing' : 'pending-incoming'
    statusByOtherId.set(otherId, { id: c.id, status })
  }

  return others.map(p => {
    const conn = statusByOtherId.get(p.id)
    return {
      ...mapProfile(p),
      connectionId: conn?.id ?? null,
      connectionStatus: conn?.status ?? 'none',
    }
  })
}

// ============================================
// This user's connections (for the Friends tab)
// ============================================

export async function fetchConnections(userId: string): Promise<UserConnections> {
  const supabase = createClient()

  const [asRequester, asAddressee] = await Promise.all([
    supabase
      .from('user_connections')
      .select('id, status, addressee:profiles!user_connections_addressee_id_fkey(id, username, display_name, avatar_url)')
      .eq('requester_id', userId),
    supabase
      .from('user_connections')
      .select('id, status, requester:profiles!user_connections_requester_id_fkey(id, username, display_name, avatar_url)')
      .eq('addressee_id', userId),
  ])

  const friends: ConnectionRequest[] = []
  const outgoingRequests: ConnectionRequest[] = []
  const incomingRequests: ConnectionRequest[] = []

  for (const row of asRequester.data || []) {
    const profile = Array.isArray(row.addressee) ? row.addressee[0] : row.addressee
    if (!profile) continue
    const entry = { ...mapProfile(profile as ProfileRow), connectionId: row.id }
    if (row.status === 'accepted') friends.push(entry)
    else outgoingRequests.push(entry)
  }

  for (const row of asAddressee.data || []) {
    const profile = Array.isArray(row.requester) ? row.requester[0] : row.requester
    if (!profile) continue
    const entry = { ...mapProfile(profile as ProfileRow), connectionId: row.id }
    if (row.status === 'accepted') friends.push(entry)
    else incomingRequests.push(entry)
  }

  return { friends, incomingRequests, outgoingRequests }
}

// Lightweight count for the nav badge — avoids fetching full profile rows
export async function fetchIncomingRequestCount(userId: string): Promise<number> {
  const supabase = createClient()
  const { count } = await supabase
    .from('user_connections')
    .select('id', { count: 'exact', head: true })
    .eq('addressee_id', userId)
    .eq('status', 'pending')

  return count || 0
}

// ============================================
// Mutations
// ============================================

export async function sendConnectionRequest(currentUserId: string, addresseeId: string): Promise<boolean> {
  const supabase = createClient()
  const { error } = await supabase
    .from('user_connections')
    .insert({ requester_id: currentUserId, addressee_id: addresseeId, status: 'pending' })

  return !error
}

export async function acceptConnectionRequest(connectionId: string): Promise<boolean> {
  const supabase = createClient()
  const { error } = await supabase
    .from('user_connections')
    .update({ status: 'accepted' })
    .eq('id', connectionId)

  return !error
}

// Covers declining an incoming request, cancelling an outgoing one, and
// unfriending an accepted connection — all are just row deletes.
export async function removeConnection(connectionId: string): Promise<boolean> {
  const supabase = createClient()
  const { error } = await supabase
    .from('user_connections')
    .delete()
    .eq('id', connectionId)

  return !error
}
