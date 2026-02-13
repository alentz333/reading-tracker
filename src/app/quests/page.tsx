'use client';

import { useGamification } from '@/hooks/useGamification';
import { useAuth } from '@/components/auth/AuthProvider';
import Header from '@/components/Header';
import { XPBar, LevelBadge, StreakDisplay } from '@/components/gamification';
import Link from 'next/link';

export default function QuestsPage() {
  const { user, loading: authLoading } = useAuth();
  const { 
    stats, 
    quests, 
    userQuests, 
    loading: gameLoading 
  } = useGamification();

  const loading = authLoading || gameLoading;

  // Group quests by type
  const dailyQuests = userQuests.filter(q => q.quest?.type === 'daily');
  const weeklyQuests = userQuests.filter(q => q.quest?.type === 'weekly');
  const monthlyQuests = userQuests.filter(q => q.quest?.type === 'monthly');

  if (loading) {
    return (
      <div className="min-h-screen">
        <Header />
        <main className="max-w-4xl mx-auto px-4 py-8">
          <div className="text-center text-white/60">Loading quests...</div>
        </main>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen">
        <Header />
        <main className="max-w-4xl mx-auto px-4 py-8">
          <div className="bento-card text-center py-16">
            <div className="text-5xl mb-4">📜</div>
            <h1 className="text-2xl font-bold text-white mb-2">Quests</h1>
            <p className="text-white/50 mb-6">Sign in to start completing quests and earning XP!</p>
            <Link href="/auth/signup" className="btn btn-primary">
              Get Started
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
        {/* Header Section */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">📜 Quests</h1>
          <p className="text-white/50">Complete quests to earn XP and level up!</p>
        </div>

        {/* Stats Summary */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="bento-card">
              <div className="flex items-center gap-3">
                <LevelBadge level={stats.level} size="md" />
                <div>
                  <div className="text-lg font-bold text-white">Level {stats.level}</div>
                  <div className="text-xs text-white/50">{stats.xp.toLocaleString()} XP</div>
                </div>
              </div>
            </div>
            
            <div className="bento-card text-center">
              <StreakDisplay streak={stats.currentStreak} size="lg" />
              <div className="text-xs text-white/50 mt-1">Day Streak</div>
            </div>
            
            <div className="bento-card text-center">
              <div className="text-2xl font-bold text-white">
                {userQuests.filter(q => q.completed).length}
              </div>
              <div className="text-xs text-white/50">Completed</div>
            </div>
            
            <div className="bento-card text-center">
              <div className="text-2xl font-bold text-indigo-400">
                {userQuests.filter(q => !q.completed).length}
              </div>
              <div className="text-xs text-white/50">Active</div>
            </div>
          </div>
        )}

        {/* Daily Quests */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <span className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center text-green-400">☀️</span>
            Daily Quests
            <span className="text-xs text-white/40 ml-auto">Resets at midnight</span>
          </h2>
          
          {dailyQuests.length > 0 ? (
            <div className="grid gap-3">
              {dailyQuests.map(uq => (
                <QuestCard key={uq.id} userQuest={uq} />
              ))}
            </div>
          ) : (
            <div className="bento-card text-center py-8 text-white/50">
              No daily quests available. Check back tomorrow!
            </div>
          )}
        </section>

        {/* Weekly Quests */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <span className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400">📅</span>
            Weekly Quests
            <span className="text-xs text-white/40 ml-auto">Resets Sunday</span>
          </h2>
          
          {weeklyQuests.length > 0 ? (
            <div className="grid gap-3">
              {weeklyQuests.map(uq => (
                <QuestCard key={uq.id} userQuest={uq} />
              ))}
            </div>
          ) : (
            <div className="bento-card text-center py-8 text-white/50">
              No weekly quests available. Check back next week!
            </div>
          )}
        </section>

        {/* Monthly Quests */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <span className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-400">🗓️</span>
            Monthly Challenges
            <span className="text-xs text-white/40 ml-auto">Resets on the 1st</span>
          </h2>
          
          {monthlyQuests.length > 0 ? (
            <div className="grid gap-3">
              {monthlyQuests.map(uq => (
                <QuestCard key={uq.id} userQuest={uq} />
              ))}
            </div>
          ) : (
            <div className="bento-card text-center py-8 text-white/50">
              No monthly challenges available. Check back next month!
            </div>
          )}
        </section>

        {/* All Quests Empty State */}
        {userQuests.length === 0 && (
          <div className="bento-card text-center py-12">
            <div className="text-5xl mb-4">✨</div>
            <h3 className="text-xl font-semibold text-white mb-2">No Active Quests</h3>
            <p className="text-white/50 mb-4">
              Start reading to get assigned quests!
            </p>
            <Link href="/" className="btn btn-primary">
              Go to Library
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}

// Quest Card Component
function QuestCard({ userQuest }: { userQuest: any }) {
  const { quest, progress, completed } = userQuest;
  const target = quest?.requirement?.count || 1;
  const percentage = Math.min(100, Math.round((progress / target) * 100));

  return (
    <div className={`bento-card ${completed ? 'opacity-60' : ''}`}>
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1">
          <h3 className="font-semibold text-white flex items-center gap-2">
            {completed && <span className="text-green-400">✓</span>}
            {quest?.name}
          </h3>
          <p className="text-sm text-white/50">{quest?.description}</p>
        </div>
        <div className="text-right">
          <span className="text-sm font-bold text-indigo-400">+{quest?.xpReward} XP</span>
        </div>
      </div>
      
      <div className="mt-3">
        <div className="flex justify-between text-xs text-white/40 mb-1">
          <span>Progress</span>
          <span>{progress} / {target}</span>
        </div>
        <div className="reading-progress">
          <div 
            className={`reading-progress-bar ${completed ? 'bg-green-500!' : ''}`}
            style={{ 
              width: `${percentage}%`,
              background: completed ? '#22c55e' : undefined
            }}
          />
        </div>
      </div>
    </div>
  );
}
