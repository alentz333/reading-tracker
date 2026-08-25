'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/auth/AuthProvider';
import Header from '@/components/Header';
import {
  fetchReaderDirectory,
  sendConnectionRequest,
  removeConnection,
  acceptConnectionRequest,
  type Reader,
} from '@/lib/supabase/connections';

export default function PeoplePage() {
  const { user, loading: authLoading } = useAuth();
  const [readers, setReaders] = useState<Reader[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    const data = await fetchReaderDirectory(user?.id ?? null);
    setReaders(data);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (authLoading) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [authLoading, load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return readers;
    return readers.filter(
      r => r.username.toLowerCase().includes(q) || (r.displayName || '').toLowerCase().includes(q)
    );
  }, [readers, query]);

  async function withPending(id: string, action: () => Promise<boolean>) {
    setPendingIds(prev => new Set(prev).add(id));
    await action();
    await load();
    setPendingIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  function handleConnect(reader: Reader) {
    if (!user) return;
    withPending(reader.id, () => sendConnectionRequest(user.id, reader.id));
  }

  function handleAccept(reader: Reader) {
    if (!reader.connectionId) return;
    withPending(reader.id, () => acceptConnectionRequest(reader.connectionId!));
  }

  function handleCancel(reader: Reader) {
    if (!reader.connectionId) return;
    withPending(reader.id, () => removeConnection(reader.connectionId!));
  }

  return (
    <div className="min-h-screen">
      <Header />

      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">🔎 Find Readers</h1>
          <p className="text-white/50">See who else is on Shelf and connect with them.</p>
        </div>

        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search by name or @username..."
          className="input mb-6"
        />

        {authLoading || loading ? (
          <div className="text-center text-white/60 py-12">Loading readers...</div>
        ) : filtered.length === 0 ? (
          <div className="bento-card text-center py-12 text-white/50">
            {readers.length === 0 ? 'No other readers have joined yet.' : 'No readers match your search.'}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(reader => (
              <div key={reader.id} className="bento-card flex items-center gap-4">
                <Link href={`/user/${reader.username}`} className="flex items-center gap-4 flex-1 min-w-0">
                  {reader.avatarUrl ? (
                    <img
                      loading="lazy"
                      decoding="async"
                      src={reader.avatarUrl}
                      alt=""
                      className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-sm font-medium flex-shrink-0">
                      {(reader.displayName || reader.username)[0]?.toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="text-white font-medium truncate">
                      {reader.displayName || reader.username}
                    </div>
                    <div className="text-sm text-white/50 truncate">@{reader.username}</div>
                  </div>
                </Link>

                {user && (
                  <div className="flex-shrink-0">
                    {reader.connectionStatus === 'none' && (
                      <button
                        onClick={() => handleConnect(reader)}
                        disabled={pendingIds.has(reader.id)}
                        className="btn btn-primary text-sm disabled:opacity-50"
                      >
                        Connect
                      </button>
                    )}
                    {reader.connectionStatus === 'pending-outgoing' && (
                      <button
                        onClick={() => handleCancel(reader)}
                        disabled={pendingIds.has(reader.id)}
                        className="btn btn-secondary text-sm disabled:opacity-50"
                      >
                        Requested
                      </button>
                    )}
                    {reader.connectionStatus === 'pending-incoming' && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleAccept(reader)}
                          disabled={pendingIds.has(reader.id)}
                          className="btn btn-primary text-sm disabled:opacity-50"
                        >
                          Accept
                        </button>
                        <button
                          onClick={() => handleCancel(reader)}
                          disabled={pendingIds.has(reader.id)}
                          className="btn btn-secondary text-sm disabled:opacity-50"
                        >
                          Decline
                        </button>
                      </div>
                    )}
                    {reader.connectionStatus === 'accepted' && (
                      <span className="text-sm text-white/50 px-2">🤝 Friends</span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {!user && !loading && (
          <div className="bento-card text-center mt-8 py-8">
            <p className="text-white/60 mb-4">Sign up to connect with other readers!</p>
            <Link href="/auth/signup" className="btn btn-primary">
              Sign Up
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
