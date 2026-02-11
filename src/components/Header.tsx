'use client';

import Link from 'next/link';
import { useAuth } from '@/components/auth/AuthProvider';

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

  return (
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
              href="/clubs" 
              className="text-sm text-white/60 hover:text-white transition-colors"
            >
              Clubs
            </Link>
            {user && (
              <Link 
                href="/profile" 
                className="text-sm text-white/60 hover:text-white transition-colors"
              >
                Profile
              </Link>
            )}
          </nav>

          {/* User Menu */}
          <div className="flex items-center gap-3">
            {loading ? (
              <div className="w-8 h-8 skeleton rounded-full" />
            ) : user ? (
              <div className="flex items-center gap-3">
                {/* Streak badge */}
                {stats?.streak && stats.streak > 0 && (
                  <div className="hidden sm:flex items-center gap-1 text-sm">
                    <span className="streak-fire text-base">🔥</span>
                    <span className="text-white/60">{stats.streak}</span>
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
                  <div className="absolute right-0 top-full mt-2 w-48 py-2 bg-[var(--color-bg-elevated)] border border-[var(--glass-border)] rounded-xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
                    <div className="px-4 py-2 border-b border-[var(--glass-border)]">
                      <p className="text-sm text-white truncate">{user.email}</p>
                    </div>
                    <Link 
                      href="/profile" 
                      className="block px-4 py-2 text-sm text-white/60 hover:text-white hover:bg-white/5 transition-colors"
                    >
                      Profile
                    </Link>
                    <Link 
                      href="/profile/edit" 
                      className="block px-4 py-2 text-sm text-white/60 hover:text-white hover:bg-white/5 transition-colors"
                    >
                      Settings
                    </Link>
                    <button 
                      onClick={() => signOut()}
                      className="w-full text-left px-4 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-white/5 transition-colors"
                    >
                      Sign out
                    </button>
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
  );
}
