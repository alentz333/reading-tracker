import { createClient } from './client'

// ============================================
// Types
// ============================================

export interface UserStats {
  xp: number
  level: number
  currentStreak: number
  longestStreak: number
  streakFreezes: number
  lastActiveDate: string | null
}

export interface XPEvent {
  id: string
  userId: string
  amount: number
  reason: string
  referenceId: string | null
  createdAt: string
}

export interface Achievement {
  id: string
  name: string
  description: string | null
  icon: string | null
  xpReward: number
  category: 'milestone' | 'streak' | 'genre' | 'engagement' | 'special'
  requirement: Record<string, any>
  sortOrder: number
}

export interface UserAchievement {
  id: string
  achievementId: string
  unlockedAt: string
  achievement?: Achievement
}

export interface Quest {
  id: string
  name: string
  description: string | null
  type: 'daily' | 'weekly' | 'monthly' | 'event'
  xpReward: number
  requirement: Record<string, any>
  isActive: boolean
}

export interface UserQuest {
  id: string
  questId: string
  progress: number
  completed: boolean
  completedAt: string | null
  assignedAt: string
  expiresAt: string | null
  quest?: Quest
}

export interface ReadingGoal {
  id: string
  type: 'yearly_books' | 'monthly_books' | 'daily_pages' | 'daily_minutes'
  target: number
  year: number | null
  month: number | null
  progress: number
}

// ============================================
// XP Amounts (centralized)
// ============================================

export const XP_AMOUNTS = {
  FINISH_BOOK: 100,
  LOG_READING: 10,
  WRITE_REVIEW: 25,
  RATE_BOOK: 5,
  COMPLETE_QUEST: 50, // base, actual varies
  UNLOCK_ACHIEVEMENT: 25, // base, actual varies
  DAILY_STREAK_BONUS: 5, // multiplied by streak days (capped)
  JOIN_CLUB: 25,
  CREATE_CLUB: 50,
  START_BOOK: 10,
} as const

// ============================================
// Level Calculations
// ============================================

const LEVEL_THRESHOLDS = [0, 100, 300, 600, 1000, 1500, 2100, 2800, 3600, 4500]
const XP_PER_LEVEL_AFTER_10 = 1000

export function calculateLevel(xp: number): number {
  // Levels 1-10
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (xp >= LEVEL_THRESHOLDS[i]) {
      if (i === LEVEL_THRESHOLDS.length - 1) {
        // Level 10+
        return 10 + Math.floor((xp - 4500) / XP_PER_LEVEL_AFTER_10)
      }
      return i + 1
    }
  }
  return 1
}

export function getXPForLevel(level: number): number {
  if (level <= 10) {
    return LEVEL_THRESHOLDS[level - 1] || 0
  }
  return 4500 + (level - 10) * XP_PER_LEVEL_AFTER_10
}

export function getXPProgress(xp: number): { current: number; required: number; percentage: number } {
  const level = calculateLevel(xp)
  const currentLevelXP = getXPForLevel(level)
  const nextLevelXP = getXPForLevel(level + 1)
  const xpIntoLevel = xp - currentLevelXP
  const xpNeeded = nextLevelXP - currentLevelXP

  return {
    current: xpIntoLevel,
    required: xpNeeded,
    percentage: Math.min(100, Math.round((xpIntoLevel / xpNeeded) * 100)),
  }
}

export const LEVEL_NAMES: Record<number, string> = {
  1: 'Bookworm Egg',
  2: 'Page Turner',
  3: 'Chapter Chaser',
  4: 'Story Seeker',
  5: 'Novel Navigator',
  6: 'Tome Tracker',
  7: 'Library Legend',
  8: 'Bibliophile',
  9: 'Literary Sage',
  10: 'Grand Reader',
}

export function getLevelName(level: number): string {
  if (level <= 10) return LEVEL_NAMES[level] || 'Reader'
  return `Grand Reader ${level - 9}` // Grand Reader II, III, etc.
}

// ============================================
// Supabase Functions
// ============================================

export async function fetchUserStats(): Promise<UserStats | null> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return null

  const { data, error } = await supabase
    .from('profiles')
    .select('xp, level, current_streak, longest_streak, streak_freezes, last_active_date')
    .eq('id', user.id)
    .single()

  if (error || !data) return null

  return {
    xp: data.xp || 0,
    level: data.level || 1,
    currentStreak: data.current_streak || 0,
    longestStreak: data.longest_streak || 0,
    streakFreezes: data.streak_freezes || 0,
    lastActiveDate: data.last_active_date,
  }
}

export async function awardXP(
  amount: number,
  reason: string,
  referenceId?: string
): Promise<{ newXP: number; newLevel: number; leveledUp: boolean } | null> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return null

  // Call the database function
  const { data, error } = await supabase.rpc('award_xp', {
    p_user_id: user.id,
    p_amount: amount,
    p_reason: reason,
    p_reference_id: referenceId || null,
  })

  if (error) {
    console.error('Error awarding XP:', error)
    return null
  }

  const result = data?.[0]
  return result ? {
    newXP: result.new_xp,
    newLevel: result.new_level,
    leveledUp: result.leveled_up,
  } : null
}

export async function fetchXPHistory(limit = 20): Promise<XPEvent[]> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return []

  const { data, error } = await supabase
    .from('xp_events')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) return []

  return data.map(e => ({
    id: e.id,
    userId: e.user_id,
    amount: e.amount,
    reason: e.reason,
    referenceId: e.reference_id,
    createdAt: e.created_at,
  }))
}

// ============================================
// Achievements
// ============================================

export async function fetchAllAchievements(): Promise<Achievement[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('achievements')
    .select('*')
    .order('sort_order', { ascending: true })

  if (error) return []

  return data.map(a => ({
    id: a.id,
    name: a.name,
    description: a.description,
    icon: a.icon,
    xpReward: a.xp_reward,
    category: a.category,
    requirement: a.requirement,
    sortOrder: a.sort_order,
  }))
}

export async function fetchUserAchievements(): Promise<UserAchievement[]> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return []

  const { data, error } = await supabase
    .from('user_achievements')
    .select(`
      *,
      achievement:achievements(*)
    `)
    .eq('user_id', user.id)

  if (error) return []

  return data.map(ua => ({
    id: ua.id,
    achievementId: ua.achievement_id,
    unlockedAt: ua.unlocked_at,
    achievement: ua.achievement ? {
      id: ua.achievement.id,
      name: ua.achievement.name,
      description: ua.achievement.description,
      icon: ua.achievement.icon,
      xpReward: ua.achievement.xp_reward,
      category: ua.achievement.category,
      requirement: ua.achievement.requirement,
      sortOrder: ua.achievement.sort_order,
    } : undefined,
  }))
}

export async function unlockAchievement(achievementId: string): Promise<boolean> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return false

  // Check if already unlocked
  const { data: existing } = await supabase
    .from('user_achievements')
    .select('id')
    .eq('user_id', user.id)
    .eq('achievement_id', achievementId)
    .single()

  if (existing) return false // Already unlocked

  // Get achievement for XP reward
  const { data: achievement } = await supabase
    .from('achievements')
    .select('xp_reward')
    .eq('id', achievementId)
    .single()

  // Insert achievement unlock
  const { error } = await supabase
    .from('user_achievements')
    .insert({ user_id: user.id, achievement_id: achievementId })

  if (error) return false

  // Award XP for achievement
  if (achievement?.xp_reward) {
    await awardXP(achievement.xp_reward, 'achievement_unlocked', achievementId)
  }

  return true
}

// ============================================
// Streaks
// ============================================

export async function updateStreak(): Promise<{ streak: number; increased: boolean }> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return { streak: 0, increased: false }

  const today = new Date().toISOString().split('T')[0]

  // Get current streak info
  const { data: userData } = await supabase
    .from('profiles')
    .select('current_streak, longest_streak, last_active_date')
    .eq('id', user.id)
    .single()

  if (!userData) return { streak: 0, increased: false }

  const lastActive = userData.last_active_date
  let newStreak = userData.current_streak || 0
  let increased = false

  if (lastActive === today) {
    // Already active today, no change
    return { streak: newStreak, increased: false }
  }

  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = yesterday.toISOString().split('T')[0]

  if (lastActive === yesterdayStr) {
    // Continuing streak
    newStreak += 1
    increased = true
  } else if (!lastActive) {
    // First activity ever
    newStreak = 1
    increased = true
  } else {
    // Streak broken
    newStreak = 1
    increased = true
  }

  // Update user
  const longestStreak = Math.max(newStreak, userData.longest_streak || 0)
  await supabase
    .from('profiles')
    .update({
      current_streak: newStreak,
      longest_streak: longestStreak,
      last_active_date: today,
    })
    .eq('id', user.id)

  // Award streak bonus XP (capped at 50)
  if (increased) {
    const streakBonus = Math.min(newStreak * XP_AMOUNTS.DAILY_STREAK_BONUS, 50)
    await awardXP(streakBonus, 'daily_streak', undefined)
  }

  return { streak: newStreak, increased }
}

// ============================================
// Reading Goals
// ============================================

export async function fetchReadingGoals(): Promise<ReadingGoal[]> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return []

  const { data, error } = await supabase
    .from('reading_goals')
    .select('*')
    .eq('user_id', user.id)

  if (error) return []

  return data.map(g => ({
    id: g.id,
    type: g.type,
    target: g.target,
    year: g.year,
    month: g.month,
    progress: g.progress,
  }))
}

export async function setReadingGoal(
  type: ReadingGoal['type'],
  target: number,
  year?: number,
  month?: number
): Promise<boolean> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return false

  const { error } = await supabase
    .from('reading_goals')
    .upsert({
      user_id: user.id,
      type,
      target,
      year: year || null,
      month: month || null,
      progress: 0,
    }, {
      onConflict: 'user_id,type,year,month',
    })

  return !error
}

export async function updateGoalProgress(
  goalId: string,
  progress: number
): Promise<boolean> {
  const supabase = createClient()

  const { error } = await supabase
    .from('reading_goals')
    .update({ progress })
    .eq('id', goalId)

  return !error
}

// ============================================
// Quests
// ============================================

export async function fetchActiveQuests(): Promise<Quest[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('quests')
    .select('*')
    .eq('is_active', true)

  if (error) return []

  return data.map(q => ({
    id: q.id,
    name: q.name,
    description: q.description,
    type: q.type,
    xpReward: q.xp_reward,
    requirement: q.requirement,
    isActive: q.is_active,
  }))
}

export async function fetchUserQuests(): Promise<UserQuest[]> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return []

  const { data, error } = await supabase
    .from('user_quests')
    .select(`
      *,
      quest:quests(*)
    `)
    .eq('user_id', user.id)
    .eq('completed', false)

  if (error) return []

  return data.map(uq => ({
    id: uq.id,
    questId: uq.quest_id,
    progress: uq.progress,
    completed: uq.completed,
    completedAt: uq.completed_at,
    assignedAt: uq.assigned_at,
    expiresAt: uq.expires_at,
    quest: uq.quest ? {
      id: uq.quest.id,
      name: uq.quest.name,
      description: uq.quest.description,
      type: uq.quest.type,
      xpReward: uq.quest.xp_reward,
      requirement: uq.quest.requirement,
      isActive: uq.quest.is_active,
    } : undefined,
  }))
}

export async function completeQuest(questId: string): Promise<boolean> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return false

  // Get quest for XP reward
  const { data: quest } = await supabase
    .from('quests')
    .select('xp_reward')
    .eq('id', questId)
    .single()

  // Mark as completed
  const { error } = await supabase
    .from('user_quests')
    .update({
      completed: true,
      completed_at: new Date().toISOString(),
    })
    .eq('quest_id', questId)
    .eq('user_id', user.id)

  if (error) return false

  // Award XP
  if (quest?.xp_reward) {
    await awardXP(quest.xp_reward, 'quest_completed', questId)
  }

  return true
}
