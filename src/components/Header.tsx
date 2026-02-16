'use client';

import { useState, useRef, useEffect } from 'react';
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
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSignOut = async () => {
    setShowDropdown(false);
    await signOut();
  };

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

            {/* Nav - Desktop only */}
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
                  {/* Gamification Stats - Desktop only */}
                  {gameStats && (
                    <div className="hidden sm:flex items-center gap-4">
                      <StreakDisplay streak={gameStats.currentStreak} size="sm" />
                      <div className="flex items-center gap-2">
                        <LevelBadge level={gameStats.level} size="sm" />
                        <div className="w-20">
                          <XPBar xp={gameStats.xp} level={gameStats.level} showLabel={false} size="sm" />
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* Profile dropdown - Click to toggle */}
                  <div className="relative" ref={dropdownRef}>
                    <button 
                      onClick={() => setShowDropdown(!showDropdown)}
                      className="flex items-center gap-2 p-1.5 rounded-full hover:bg-white/5 active:bg-white/10 transition-colors touch-manipulation"
                    >
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-sm font-medium">
                        {user.email?.charAt(0).toUpperCase() || '?'}
                      </div>
                    </button>
                    
                    {/* Dropdown */}
                    {showDropdown && (
                      <div className="absolute right-0 top-full mt-2 w-64 py-2 bg-[#1a1a1b] border border-white/10 rounded-xl shadow-2xl z-50">
                        <div className="px-4 py-3 border-b border-white/10">
                          <p className="text-sm text-white truncate font-medium">{user.email}</p>
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
                        
                        <div className="py-1">
                          <Link 
                            href="/profile" 
                            onClick={() => setShowDropdown(false)}
                            className="flex items-center gap-3 px-4 py-2.5 text-sm text-white/70 hover:text-white hover:bg-white/5 transition-colors"
                          >
                            <span>👤</span> My Profile
                          </Link>
                          <Link 
                            href="/library" 
                            onClick={() => setShowDropdown(false)}
                            className="flex items-center gap-3 px-4 py-2.5 text-sm text-white/70 hover:text-white hover:bg-white/5 transition-colors"
                          >
                            <span>📖</span> Library
                          </Link>
                          <Link 
                            href="/achievements" 
                            onClick={() => setShowDropdown(false)}
                            className="flex items-center gap-3 px-4 py-2.5 text-sm text-white/70 hover:text-white hover:bg-white/5 transition-colors"
                          >
                            <span>🏆</span> Achievements
                          </Link>
                          <Link 
                            href="/quests" 
                            onClick={() => setShowDropdown(false)}
                            className="flex items-center gap-3 px-4 py-2.5 text-sm text-white/70 hover:text-white hover:bg-white/5 transition-colors"
                          >
                            <span>📜</span> Quests
                          </Link>
                          <Link 
                            href="/clubs" 
                            onClick={() => setShowDropdown(false)}
                            className="flex items-center gap-3 px-4 py-2.5 text-sm text-white/70 hover:text-white hover:bg-white/5 transition-colors"
                          >
                            <span>👥</span> Book Clubs
                          </Link>
                        </div>
                        
                        <div className="border-t border-white/10 pt-1 mt-1">
                          <button 
                            onClick={handleSignOut}
                            className="flex items-center gap-3 w-full text-left px-4 py-2.5 text-sm text-red-400 hover:text-red-300 hover:bg-white/5 transition-colors"
                          >
                            <span>🚪</span> Log Out
                          </button>
                        </div>
                      </div>
                    )}
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
