'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/components/auth/AuthProvider'
import {
  UserStats,
  Achievement,
  UserAchievement,
  Quest,
  UserQuest,
  ReadingGoal,
  fetchUserStats,
  awardXP,
  fetchAllAchievements,
  fetchUserAchievements,
  unlockAchievement,
  updateStreak,
  fetchReadingGoals,
  fetchActiveQuests,
  fetchUserQuests,
  XP_AMOUNTS,
} from '@/lib/supabase/gamification'

interface GamificationState {
  stats: UserStats | null
  achievements: Achievement[]
  userAchievements: UserAchievement[]
  quests: Quest[]
  userQuests: UserQuest[]
  goals: ReadingGoal[]
  loading: boolean
}

interface XPGain {
  amount: number
  reason: string
  newXP?: number
  newLevel?: number
  leveledUp?: boolean
}

export function useGamification() {
  const { user } = useAuth()
  const [state, setState] = useState<GamificationState>({
    stats: null,
    achievements: [],
    userAchievements: [],
    quests: [],
    userQuests: [],
    goals: [],
    loading: true,
  })
  const [recentXP, setRecentXP] = useState<XPGain | null>(null)

  // Load all gamification data
  const loadData = useCallback(async () => {
    if (!user) {
      setState(prev => ({ ...prev, loading: false }))
      return
    }

    setState(prev => ({ ...prev, loading: true }))

    try {
      const [stats, achievements, userAchievements, quests, userQuests, goals] = await Promise.all([
        fetchUserStats(),
        fetchAllAchievements(),
        fetchUserAchievements(),
        fetchActiveQuests(),
        fetchUserQuests(),
        fetchReadingGoals(),
      ])

      setState({
        stats,
        achievements,
        userAchievements,
        quests,
        userQuests,
        goals,
        loading: false,
      })
    } catch (error) {
      console.error('Error loading gamification data:', error)
      setState(prev => ({ ...prev, loading: false }))
    }
  }, [user])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Award XP and show notification
  const gainXP = useCallback(async (
    amount: number,
    reason: string,
    referenceId?: string
  ): Promise<XPGain | null> => {
    const result = await awardXP(amount, reason, referenceId)
    
    if (result) {
      const gain: XPGain = {
        amount,
        reason,
        newXP: result.newXP,
        newLevel: result.newLevel,
        leveledUp: result.leveledUp,
      }
      
      setRecentXP(gain)
      
      // Update local state
      setState(prev => ({
        ...prev,
        stats: prev.stats ? {
          ...prev.stats,
          xp: result.newXP,
          level: result.newLevel,
        } : null,
      }))
      
      // Clear popup after delay
      setTimeout(() => setRecentXP(null), 2500)
      
      return gain
    }
    
    return null
  }, [])

  // Quick XP actions
  const onBookFinished = useCallback(async (bookId: string) => {
    await gainXP(XP_AMOUNTS.FINISH_BOOK, 'Finished a book', bookId)
    await updateStreak()
    await checkAchievements()
  }, [gainXP])

  const onBookStarted = useCallback(async (bookId: string) => {
    await gainXP(XP_AMOUNTS.START_BOOK, 'Started a book', bookId)
    await updateStreak()
  }, [gainXP])

  const onReviewWritten = useCallback(async (bookId: string) => {
    await gainXP(XP_AMOUNTS.WRITE_REVIEW, 'Wrote a review', bookId)
    await checkAchievements()
  }, [gainXP])

  const onBookRated = useCallback(async (bookId: string) => {
    await gainXP(XP_AMOUNTS.RATE_BOOK, 'Rated a book', bookId)
    await checkAchievements()
  }, [gainXP])

  const onReadingLogged = useCallback(async () => {
    await gainXP(XP_AMOUNTS.LOG_READING, 'Logged reading')
    await updateStreak()
  }, [gainXP])

  // Check and unlock achievements
  const checkAchievements = useCallback(async () => {
    // This would ideally be done server-side, but for MVP we can check client-side
    // Re-fetch user achievements after any action
    const newUserAchievements = await fetchUserAchievements()
    setState(prev => ({ ...prev, userAchievements: newUserAchievements }))
  }, [])

  // Get unlock status for an achievement
  const isAchievementUnlocked = useCallback((achievementId: string): boolean => {
    return state.userAchievements.some(ua => ua.achievementId === achievementId)
  }, [state.userAchievements])

  // Computed values
  const unlockedCount = state.userAchievements.length
  const totalAchievements = state.achievements.length
  const activeQuestsCount = state.userQuests.filter(q => !q.completed).length

  return {
    // State
    stats: state.stats,
    achievements: state.achievements,
    userAchievements: state.userAchievements,
    quests: state.quests,
    userQuests: state.userQuests,
    goals: state.goals,
    loading: state.loading,
    
    // XP notification
    recentXP,
    
    // Actions
    gainXP,
    onBookFinished,
    onBookStarted,
    onReviewWritten,
    onBookRated,
    onReadingLogged,
    checkAchievements,
    
    // Helpers
    isAchievementUnlocked,
    refresh: loadData,
    
    // Computed
    unlockedCount,
    totalAchievements,
    activeQuestsCount,
  }
}
