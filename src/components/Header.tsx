'use client';

import Link from 'next/link';
import { useAuth } from '@/components/auth/AuthProvider';
import { useGamification } from '@/hooks/useGamification';
import { LevelBadge, XPBar, StreakDisplay, XPPopup } from '@/components/gamification';

interface HeaderProps {
  stats?: {
    totalBooks: number;
    currentlyReading: number;
    wantToRead: number;
    streak?: number;
  };
}

export default function Header({ stats }: HeaderProps) {
  const { user, signOut, loading } = useAuth();
  const { stats: gameStats, recentXP, loading: gameLoading } = useGamification();

  return (
    <>
      {/* XP Popup */}
      {recentXP && (
        <XPPopup amount={recentXP.amount} reason={recentXP.reason} />
      )}
      
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-[var(--color-bg)]/80 border-b border-[var(--glass-border)]">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2 group">
              <span className="text-2xl">📚</span>
              <span className="text-lg font-semibold text-white group-hover:text-indigo-400 transition-colors">
                Shelf
              </span>
            </Link>

            {/* Nav */}
            <nav className="hidden md:flex items-center gap-6">
              <Link 
                href="/" 
                className="text-sm text-white/60 hover:text-white transition-colors"
              >
                Library
              </Link>
              <Link 
                href="/quests" 
                className="text-sm text-white/60 hover:text-white transition-colors"
              >
                Quests
              </Link>
              <Link 
                href="/clubs" 
                className="text-sm text-white/60 hover:text-white transition-colors"
              >
                Clubs
              </Link>
              {user && (
                <Link 
                  href="/achievements" 
                  className="text-sm text-white/60 hover:text-white transition-colors"
                >
                  Achievements
                </Link>
              )}
            </nav>

            {/* User Menu */}
            <div className="flex items-center gap-3">
              {loading || gameLoading ? (
                <div className="w-8 h-8 skeleton rounded-full" />
              ) : user ? (
                <div className="flex items-center gap-4">
                  {/* Gamification Stats */}
                  {gameStats && (
                    <div className="hidden sm:flex items-center gap-4">
                      {/* Streak */}
                      <StreakDisplay streak={gameStats.currentStreak} size="sm" />
                      
                      {/* Level + XP */}
                      <div className="flex items-center gap-2">
                        <LevelBadge level={gameStats.level} size="sm" />
                        <div className="w-20">
                          <XPBar xp={gameStats.xp} level={gameStats.level} showLabel={false} size="sm" />
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* Profile dropdown */}
                  <div className="relative group">
                    <button className="flex items-center gap-2 p-1.5 rounded-full hover:bg-white/5 transition-colors">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-sm font-medium">
                        {user.email?.charAt(0).toUpperCase() || '?'}
                      </div>
                    </button>
                    
                    {/* Dropdown */}
                    <div className="absolute right-0 top-full mt-2 w-56 py-2 bg-[var(--color-bg-elevated)] border border-[var(--glass-border)] rounded-xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
                      <div className="px-4 py-2 border-b border-[var(--glass-border)]">
                        <p className="text-sm text-white truncate">{user.email}</p>
                        {gameStats && (
                          <div className="mt-2">
                            <div className="flex items-center justify-between text-xs text-white/60 mb-1">
                              <span>Level {gameStats.level}</span>
                              <span>{gameStats.xp.toLocaleString()} XP</span>
                            </div>
                            <XPBar xp={gameStats.xp} level={gameStats.level} showLabel={false} size="sm" />
                          </div>
                        )}
                      </div>
                      <Link 
                        href="/profile" 
                        className="block px-4 py-2 text-sm text-white/60 hover:text-white hover:bg-white/5 transition-colors"
                      >
                        👤 Profile
                      </Link>
                      <Link 
                        href="/achievements" 
                        className="block px-4 py-2 text-sm text-white/60 hover:text-white hover:bg-white/5 transition-colors"
                      >
                        🏆 Achievements
                      </Link>
                      <Link 
                        href="/quests" 
                        className="block px-4 py-2 text-sm text-white/60 hover:text-white hover:bg-white/5 transition-colors"
                      >
                        📜 Quests
                      </Link>
                      <Link 
                        href="/leaderboard" 
                        className="block px-4 py-2 text-sm text-white/60 hover:text-white hover:bg-white/5 transition-colors"
                      >
                        🥇 Leaderboard
                      </Link>
                      <Link 
                        href="/profile/edit" 
                        className="block px-4 py-2 text-sm text-white/60 hover:text-white hover:bg-white/5 transition-colors"
                      >
                        ⚙️ Settings
                      </Link>
                      <div className="border-t border-[var(--glass-border)] mt-2 pt-2">
                        <button 
                          onClick={() => signOut()}
                          className="w-full text-left px-4 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-white/5 transition-colors"
                        >
                          Sign out
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Link href="/auth/login" className="btn btn-secondary text-sm">
                    Sign in
                  </Link>
                  <Link href="/auth/signup" className="btn btn-primary text-sm">
                    Sign up
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>
    </>
  );
}
