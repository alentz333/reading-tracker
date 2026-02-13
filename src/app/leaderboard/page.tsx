'use client';

import { useAuth } from '@/components/auth/AuthProvider';
import Header from '@/components/Header';
import { LevelBadge } from '@/components/gamification';
import Link from 'next/link';

// Placeholder - will be implemented with real data in Phase 5
export default function LeaderboardPage() {
  const { user, loading: authLoading } = useAuth();

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

  return (
    <div className="min-h-screen">
      <Header />
      
      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Header Section */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">🥇 Leaderboard</h1>
          <p className="text-white/50">See how you stack up against other readers!</p>
        </div>

        {/* Coming Soon */}
        <div className="bento-card text-center py-16">
          <div className="text-6xl mb-4">🏆</div>
          <h2 className="text-2xl font-bold text-white mb-2">Coming Soon!</h2>
          <p className="text-white/50 max-w-md mx-auto mb-6">
            Leaderboards are being built. Soon you'll be able to compete with friends 
            and see who's reading the most!
          </p>
          
          {/* Preview of what's coming */}
          <div className="max-w-md mx-auto text-left">
            <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-3">
              What to expect
            </h3>
            <ul className="space-y-2 text-sm text-white/50">
              <li className="flex items-center gap-2">
                <span className="text-indigo-400">✓</span>
                Weekly XP leaderboard
              </li>
              <li className="flex items-center gap-2">
                <span className="text-indigo-400">✓</span>
                Books read this month
              </li>
              <li className="flex items-center gap-2">
                <span className="text-indigo-400">✓</span>
                Longest streak competition
              </li>
              <li className="flex items-center gap-2">
                <span className="text-indigo-400">✓</span>
                Book club rankings
              </li>
              <li className="flex items-center gap-2">
                <span className="text-indigo-400">✓</span>
                Friends-only view
              </li>
            </ul>
          </div>

          <Link href="/" className="btn btn-primary mt-8">
            Back to Library
          </Link>
        </div>
      </main>
    </div>
  );
}
