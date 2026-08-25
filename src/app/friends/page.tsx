'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/auth/AuthProvider';
import Header from '@/components/Header';
import {
  fetchConnections,
  acceptConnectionRequest,
  removeConnection,
  type ConnectionRequest,
  type UserConnections,
} from '@/lib/supabase/connections';

const EMPTY: UserConnections = { friends: [], incomingRequests: [], outgoingRequests: [] };

export default function FriendsPage() {
  const { user, loading: authLoading } = useAuth();
  const [connections, setConnections] = useState<UserConnections>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());

  const load = useCallback(async (userId: string) => {
    setLoading(true);
    setConnections(await fetchConnections(userId));
    setLoading(false);
  }, []);

  useEffect(() => {
    if (authLoading || !user) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLoading(false);
      return;
    }
    load(user.id);
  }, [authLoading, user, load]);

  async function withPending(connectionId: string, action: () => Promise<boolean>) {
    setPendingIds(prev => new Set(prev).add(connectionId));
    await action();
    if (user) await load(user.id);
    setPendingIds(prev => {
      const next = new Set(prev);
      next.delete(connectionId);
      return next;
    });
  }

  function Row({ person, children }: { person: ConnectionRequest; children?: React.ReactNode }) {
    return (
      <div className="bento-card flex items-center gap-4">
        <Link href={`/user/${person.username}`} className="flex items-center gap-4 flex-1 min-w-0">
          {person.avatarUrl ? (
            <img
              loading="lazy"
              decoding="async"
              src={person.avatarUrl}
              alt=""
              className="w-10 h-10 rounded-full object-cover flex-shrink-0"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-sm font-medium flex-shrink-0">
              {(person.displayName || person.username)[0]?.toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <div className="text-white font-medium truncate">{person.displayName || person.username}</div>
            <div className="text-sm text-white/50 truncate">@{person.username}</div>
          </div>
        </Link>
        {children && <div className="flex-shrink-0 flex gap-2">{children}</div>}
      </div>
    );
  }

  if (authLoading) {
    return (
      <div className="min-h-screen">
        <Header />
        <main className="max-w-4xl mx-auto px-4 py-8">
          <div className="text-center text-white/60">Loading...</div>
        </main>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen">
        <Header />
        <main className="max-w-4xl mx-auto px-4 py-8">
          <div className="bento-card text-center py-12">
            <p className="text-white/60 mb-4">Sign in to see your friends.</p>
            <Link href="/auth/login" className="btn btn-primary">
              Log In
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Header />

      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">🤝 Friends</h1>
            <p className="text-white/50">People you&apos;re connected with on Shelf.</p>
          </div>
          <Link href="/people" className="btn btn-secondary text-sm">
            + Find Readers
          </Link>
        </div>

        {loading ? (
          <div className="text-center text-white/60 py-12">Loading...</div>
        ) : (
          <div className="space-y-10">
            {connections.incomingRequests.length > 0 && (
              <section>
                <h2 className="text-lg font-semibold text-white mb-3">
                  Requests ({connections.incomingRequests.length})
                </h2>
                <div className="space-y-3">
                  {connections.incomingRequests.map(person => (
                    <Row key={person.connectionId} person={person}>
                      <button
                        onClick={() => withPending(person.connectionId, () => acceptConnectionRequest(person.connectionId))}
                        disabled={pendingIds.has(person.connectionId)}
                        className="btn btn-primary text-sm disabled:opacity-50"
                      >
                        Accept
                      </button>
                      <button
                        onClick={() => withPending(person.connectionId, () => removeConnection(person.connectionId))}
                        disabled={pendingIds.has(person.connectionId)}
                        className="btn btn-secondary text-sm disabled:opacity-50"
                      >
                        Decline
                      </button>
                    </Row>
                  ))}
                </div>
              </section>
            )}

            <section>
              <h2 className="text-lg font-semibold text-white mb-3">
                Friends ({connections.friends.length})
              </h2>
              {connections.friends.length === 0 ? (
                <div className="bento-card text-center py-10 text-white/50">
                  No friends yet.{' '}
                  <Link href="/people" className="text-indigo-400 hover:underline">
                    Find readers to connect with
                  </Link>
                  .
                </div>
              ) : (
                <div className="space-y-3">
                  {connections.friends.map(person => (
                    <Row key={person.connectionId} person={person}>
                      <button
                        onClick={() => withPending(person.connectionId, () => removeConnection(person.connectionId))}
                        disabled={pendingIds.has(person.connectionId)}
                        className="btn btn-secondary text-sm disabled:opacity-50"
                      >
                        Remove
                      </button>
                    </Row>
                  ))}
                </div>
              )}
            </section>

            {connections.outgoingRequests.length > 0 && (
              <section>
                <h2 className="text-lg font-semibold text-white mb-3">
                  Sent ({connections.outgoingRequests.length})
                </h2>
                <div className="space-y-3">
                  {connections.outgoingRequests.map(person => (
                    <Row key={person.connectionId} person={person}>
                      <button
                        onClick={() => withPending(person.connectionId, () => removeConnection(person.connectionId))}
                        disabled={pendingIds.has(person.connectionId)}
                        className="btn btn-secondary text-sm disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    </Row>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
