'use client';

import { useGamification } from '@/hooks/useGamification';
import { useAuth } from '@/components/auth/AuthProvider';
import Header from '@/components/Header';
import { LevelBadge, XPBar } from '@/components/gamification';
import Link from 'next/link';

const CATEGORY_INFO: Record<string, { icon: string; title: string; color: string }> = {
  milestone: { icon: '📚', title: 'Reading Milestones', color: 'indigo' },
  streak: { icon: '🔥', title: 'Streak Achievements', color: 'orange' },
  genre: { icon: '📖', title: 'Genre Explorer', color: 'green' },
  engagement: { icon: '⭐', title: 'Engagement', color: 'yellow' },
  special: { icon: '✨', title: 'Special', color: 'purple' },
};

export default function AchievementsPage() {
  const { user, loading: authLoading } = useAuth();
  const { 
    stats, 
    achievements, 
    userAchievements, 
    isAchievementUnlocked,
    loading: gameLoading 
  } = useGamification();

  const loading = authLoading || gameLoading;

  // Group achievements by category
  const groupedAchievements = achievements.reduce((acc, achievement) => {
    const category = achievement.category || 'special';
    if (!acc[category]) acc[category] = [];
    acc[category].push(achievement);
    return acc;
  }, {} as Record<string, typeof achievements>);

  if (loading) {
    return (
      <div className="min-h-screen">
        <Header />
        <main className="max-w-4xl mx-auto px-4 py-8">
          <div className="text-center text-white/60">Loading achievements...</div>
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
            <div className="text-5xl mb-4">🏆</div>
            <h1 className="text-2xl font-bold text-white mb-2">Achievements</h1>
            <p className="text-white/50 mb-6">Sign in to track your achievements and earn rewards!</p>
            <Link href="/auth/signup" className="btn btn-primary">
              Get Started
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const unlockedCount = userAchievements.length;
  const totalCount = achievements.length;

  return (
    <div className="min-h-screen">
      <Header />
      
      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Header Section */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">🏆 Achievements</h1>
          <p className="text-white/50">Unlock achievements by reading and engaging with the app!</p>
        </div>

        {/* Progress Summary */}
        <div className="bento-card mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              {stats && <LevelBadge level={stats.level} size="lg" />}
              <div>
                <div className="text-xl font-bold text-white">
                  {unlockedCount} / {totalCount} Unlocked
                </div>
                <div className="text-sm text-white/50">
                  {Math.round((unlockedCount / totalCount) * 100)}% Complete
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-indigo-400">
                {userAchievements.reduce((sum, ua) => sum + (ua.achievement?.xpReward || 0), 0).toLocaleString()}
              </div>
              <div className="text-xs text-white/50">XP from Achievements</div>
            </div>
          </div>
          
          {/* Overall Progress Bar */}
          <div className="reading-progress h-3">
            <div 
              className="reading-progress-bar"
              style={{ width: `${(unlockedCount / totalCount) * 100}%` }}
            />
          </div>
        </div>

        {/* Achievement Categories */}
        {Object.entries(groupedAchievements).map(([category, categoryAchievements]) => {
          const info = CATEGORY_INFO[category] || CATEGORY_INFO.special;
          const unlockedInCategory = categoryAchievements.filter(a => isAchievementUnlocked(a.id)).length;
          
          return (
            <section key={category} className="mb-8">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <span>{info.icon}</span>
                {info.title}
                <span className="text-xs text-white/40 ml-auto">
                  {unlockedInCategory} / {categoryAchievements.length}
                </span>
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {categoryAchievements.map(achievement => {
                  const unlocked = isAchievementUnlocked(achievement.id);
                  const userAchievement = userAchievements.find(ua => ua.achievementId === achievement.id);
                  
                  return (
                    <div 
                      key={achievement.id}
                      className={`bento-card flex items-center gap-4 ${!unlocked ? 'opacity-50' : ''}`}
                    >
                      {/* Achievement Icon */}
                      <div className={`
                        w-14 h-14 rounded-xl flex items-center justify-center text-2xl
                        ${unlocked 
                          ? 'bg-gradient-to-br from-indigo-500/30 to-purple-500/30 ring-2 ring-indigo-500/50' 
                          : 'bg-white/5'
                        }
                      `}>
                        {unlocked ? achievement.icon : '🔒'}
                      </div>
                      
                      {/* Achievement Info */}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-white flex items-center gap-2">
                          {achievement.name}
                          {unlocked && <span className="text-green-400 text-sm">✓</span>}
                        </h3>
                        <p className="text-sm text-white/50 truncate">{achievement.description}</p>
                        {unlocked && userAchievement && (
                          <p className="text-xs text-white/30 mt-1">
                            Unlocked {new Date(userAchievement.unlockedAt).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                      
                      {/* XP Reward */}
                      <div className="text-right">
                        <span className={`text-sm font-bold ${unlocked ? 'text-green-400' : 'text-white/40'}`}>
                          +{achievement.xpReward} XP
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}

        {/* Empty State */}
        {achievements.length === 0 && (
          <div className="bento-card text-center py-12">
            <div className="text-5xl mb-4">🏆</div>
            <h3 className="text-xl font-semibold text-white mb-2">No Achievements Yet</h3>
            <p className="text-white/50">
              Start reading to unlock achievements!
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
