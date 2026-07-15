import { createClient } from './client'

// ============================================
// Types
// ============================================

export interface Achievement {
  id: string
  name: string
  description: string | null
  icon: string | null
  category: 'milestone' | 'streak' | 'genre' | 'engagement' | 'special'
  requirement: Record<string, unknown>
  sortOrder: number
}

export interface UserAchievement {
  id: string
  achievementId: string
  unlockedAt: string
  achievement?: Achievement
}

// getSession() reads the locally stored session (no network round trip),
// unlike getUser() which hits the auth server on every call.
async function getSessionUserId(): Promise<string | null> {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  return session?.user?.id ?? null
}

// ============================================
// Fetching
// ============================================

export async function fetchAllAchievements(): Promise<Achievement[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('achievements')
    .select('id, name, description, icon, category, requirement, sort_order')
    .order('sort_order', { ascending: true })

  if (error) return []

  return data.map(a => ({
    id: a.id,
    name: a.name,
    description: a.description,
    icon: a.icon,
    category: a.category,
    requirement: a.requirement,
    sortOrder: a.sort_order,
  }))
}

export async function fetchUserAchievements(): Promise<UserAchievement[]> {
  const userId = await getSessionUserId()
  if (!userId) return []

  const supabase = createClient()
  const { data, error } = await supabase
    .from('user_achievements')
    .select(`
      id,
      achievement_id,
      unlocked_at,
      achievement:achievements(id, name, description, icon, category, requirement, sort_order)
    `)
    .eq('user_id', userId)

  if (error) return []

  return data.map(ua => {
    const ach = Array.isArray(ua.achievement) ? ua.achievement[0] : ua.achievement
    return {
      id: ua.id,
      achievementId: ua.achievement_id,
      unlockedAt: ua.unlocked_at,
      achievement: ach ? {
        id: ach.id,
        name: ach.name,
        description: ach.description,
        icon: ach.icon,
        category: ach.category,
        requirement: ach.requirement,
        sortOrder: ach.sort_order,
      } : undefined,
    }
  })
}

// ============================================
// Unlocking
// ============================================

async function unlockAchievement(userId: string, achievementId: string): Promise<boolean> {
  const supabase = createClient()

  const { error } = await supabase
    .from('user_achievements')
    .insert({ user_id: userId, achievement_id: achievementId })

  return !error
}

function meetsRequirement(requirement: Record<string, unknown>, progress: Record<string, unknown>): boolean {
  const num = (v: unknown) => (typeof v === 'number' ? v : 0)

  if (typeof requirement.books_read === 'number') {
    if (num(progress.booksRead) < requirement.books_read) return false
  }

  if (typeof requirement.streak === 'number') {
    if (num(progress.streak) < requirement.streak) return false
  }

  if (typeof requirement.reviews === 'number') {
    if (num(progress.reviews) < requirement.reviews) return false
  }

  if (typeof requirement.ratings === 'number') {
    if (num(progress.ratings) < requirement.ratings) return false
  }

  if (typeof requirement.clubs_joined === 'number') {
    if (num(progress.clubsJoined) < requirement.clubs_joined) return false
  }

  if (typeof requirement.clubs_created === 'number') {
    if (num(progress.clubsCreated) < requirement.clubs_created) return false
  }

  if (typeof requirement.days_to_finish === 'number') {
    if (!progress.fastFinish) return false
  }

  if (typeof requirement.pages === 'number') {
    if (num(progress.maxPagesFinished) < requirement.pages) return false
  }

  // These depended on the retired XP event log; without that signal they can
  // no longer be earned, so they must never auto-unlock.
  if (requirement.early_reading === true && !progress.earlyReading) return false
  if (requirement.late_reading === true && !progress.lateReading) return false

  return true
}

export async function checkAndUnlockAchievements(): Promise<string[]> {
  const userId = await getSessionUserId()
  if (!userId) return []

  const supabase = createClient()

  const [
    achievementsRes,
    unlockedRes,
    booksRes,
    clubsJoinedRes,
    clubsCreatedRes,
  ] = await Promise.all([
    supabase.from('achievements').select('id, requirement').order('sort_order', { ascending: true }),
    supabase.from('user_achievements').select('achievement_id').eq('user_id', userId),
    supabase.from('user_books').select('status, rating, review, started_at, finished_at, books(page_count)').eq('user_id', userId),
    supabase.from('club_members').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    supabase.from('clubs').select('id', { count: 'exact', head: true }).eq('created_by', userId),
  ])

  const achievements = achievementsRes.data || []
  const unlockedIds = new Set((unlockedRes.data || []).map(a => a.achievement_id))
  const books = (booksRes.data || []) as Array<{
    status: string
    rating: number | null
    review: string | null
    started_at: string | null
    finished_at: string | null
    books: { page_count: number | null } | { page_count: number | null }[] | null
  }>

  const pageCountOf = (b: (typeof books)[number]) => {
    const bookRow = Array.isArray(b.books) ? b.books[0] : b.books
    return bookRow?.page_count || 0
  }

  const maxPagesFinished = books
    .filter(b => b.status === 'read' && b.finished_at)
    .reduce((max, b) => Math.max(max, pageCountOf(b)), 0)

  const progress = {
    booksRead: books.filter(b => b.status === 'read').length,
    reviews: books.filter(b => !!b.review && b.review.trim().length > 0).length,
    ratings: books.filter(b => typeof b.rating === 'number').length,
    clubsJoined: clubsJoinedRes.count || 0,
    clubsCreated: clubsCreatedRes.count || 0,
    maxPagesFinished,
    fastFinish: books.some(b => {
      if (!b.started_at || !b.finished_at) return false
      const days = (new Date(b.finished_at).getTime() - new Date(b.started_at).getTime()) / (1000 * 60 * 60 * 24)
      return days >= 0 && days <= 3
    }),
  }

  const newlyUnlocked: string[] = []

  for (const ach of achievements) {
    if (unlockedIds.has(ach.id)) continue
    if (!ach.requirement || typeof ach.requirement !== 'object') continue

    if (meetsRequirement(ach.requirement, progress)) {
      const ok = await unlockAchievement(userId, ach.id)
      if (ok) {
        newlyUnlocked.push(ach.id)
        unlockedIds.add(ach.id)
      }
    }
  }

  return newlyUnlocked
}
