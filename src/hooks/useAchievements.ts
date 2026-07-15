'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/components/auth/AuthProvider'
import {
  Achievement,
  UserAchievement,
  fetchAllAchievements,
  fetchUserAchievements,
  checkAndUnlockAchievements,
} from '@/lib/supabase/achievements'

export function useAchievements() {
  const { user, loading: authLoading } = useAuth()
  const [achievements, setAchievements] = useState<Achievement[]>([])
  const [userAchievements, setUserAchievements] = useState<UserAchievement[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (authLoading) return

    if (!user) {
      setLoading(false)
      return
    }

    let cancelled = false

    const load = async () => {
      setLoading(true)
      try {
        // Unlock anything newly earned, then fetch definitions + unlocks together
        await checkAndUnlockAchievements()
        const [all, unlocked] = await Promise.all([
          fetchAllAchievements(),
          fetchUserAchievements(),
        ])
        if (!cancelled) {
          setAchievements(all)
          setUserAchievements(unlocked)
        }
      } catch (error) {
        console.error('Error loading achievements:', error)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [user, authLoading])

  const isAchievementUnlocked = useCallback(
    (achievementId: string) => userAchievements.some(ua => ua.achievementId === achievementId),
    [userAchievements]
  )

  return {
    achievements,
    userAchievements,
    loading: authLoading || loading,
    isAchievementUnlocked,
  }
}
