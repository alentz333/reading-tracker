import { createClient } from './client'

// ============================================
// Types
// ============================================

// Badges live in the legacy `achievements` / `user_achievements` tables —
// the feature was rebranded, the storage kept.
export interface Badge {
  id: string
  name: string
  description: string | null
  icon: string | null
  category: 'milestone' | 'streak' | 'genre' | 'engagement' | 'special' | 'format'
  requirement: Record<string, unknown>
  sortOrder: number
}

export interface UserBadge {
  id: string
  badgeId: string
  unlockedAt: string
  badge?: Badge
}

const BADGE_ROW_SELECT = 'id, name, description, icon, category, requirement, sort_order'

interface BadgeRow {
  id: string
  name: string
  description: string | null
  icon: string | null
  category: Badge['category']
  requirement: Record<string, unknown>
  sort_order: number
}

function mapBadge(row: BadgeRow): Badge {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    icon: row.icon,
    category: row.category,
    requirement: row.requirement,
    sortOrder: row.sort_order,
  }
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

export async function fetchAllBadges(): Promise<Badge[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('achievements')
    .select(BADGE_ROW_SELECT)
    .order('sort_order', { ascending: true })

  if (error) return []

  return (data as BadgeRow[]).map(mapBadge)
}

// Works for any user, not just the signed-in one — earned badges are public
// so they can be shown on public profiles.
export async function fetchUserBadges(userId: string): Promise<UserBadge[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('user_achievements')
    .select(`
      id,
      achievement_id,
      unlocked_at,
      achievement:achievements(${BADGE_ROW_SELECT})
    `)
    .eq('user_id', userId)

  if (error) return []

  return data.map(ua => {
    const badge = Array.isArray(ua.achievement) ? ua.achievement[0] : ua.achievement
    return {
      id: ua.id,
      badgeId: ua.achievement_id,
      unlockedAt: ua.unlocked_at,
      badge: badge ? mapBadge(badge as BadgeRow) : undefined,
    }
  })
}

// ============================================
// Unlocking
// ============================================

async function unlockBadge(userId: string, badgeId: string): Promise<boolean> {
  const supabase = createClient()

  const { error } = await supabase
    .from('user_achievements')
    .insert({ user_id: userId, achievement_id: badgeId })

  return !error
}

interface BadgeProgress {
  booksRead: number
  reviews: number
  ratings: number
  clubsJoined: number
  clubsCreated: number
  maxPagesFinished: number
  fastFinish: boolean
  audiobooksRead: number
  genreCounts: Record<string, number>
}

function meetsRequirement(requirement: Record<string, unknown>, progress: BadgeProgress): boolean {
  if (typeof requirement.books_read === 'number') {
    if (progress.booksRead < requirement.books_read) return false
  }

  if (typeof requirement.reviews === 'number') {
    if (progress.reviews < requirement.reviews) return false
  }

  if (typeof requirement.ratings === 'number') {
    if (progress.ratings < requirement.ratings) return false
  }

  if (typeof requirement.clubs_joined === 'number') {
    if (progress.clubsJoined < requirement.clubs_joined) return false
  }

  if (typeof requirement.clubs_created === 'number') {
    if (progress.clubsCreated < requirement.clubs_created) return false
  }

  if (typeof requirement.days_to_finish === 'number') {
    if (!progress.fastFinish) return false
  }

  if (typeof requirement.pages === 'number') {
    if (progress.maxPagesFinished < requirement.pages) return false
  }

  if (typeof requirement.audiobooks === 'number') {
    if (progress.audiobooksRead < requirement.audiobooks) return false
  }

  if (typeof requirement.genre_count === 'number') {
    const genre = typeof requirement.genre === 'string' ? requirement.genre : ''
    if ((progress.genreCounts[genre] ?? 0) < requirement.genre_count) return false
  }

  if (typeof requirement.distinct_genres === 'number') {
    if (Object.keys(progress.genreCounts).length < requirement.distinct_genres) return false
  }

  // These depended on the retired XP event log and streaks; without those
  // signals they can no longer be earned, so they must never auto-unlock.
  if (requirement.early_reading === true) return false
  if (requirement.late_reading === true) return false
  if (typeof requirement.streak === 'number') return false

  return true
}

export async function checkAndUnlockBadges(): Promise<string[]> {
  const userId = await getSessionUserId()
  if (!userId) return []

  const supabase = createClient()

  const [
    badgesRes,
    unlockedRes,
    booksRes,
    clubsJoinedRes,
    clubsCreatedRes,
  ] = await Promise.all([
    supabase.from('achievements').select('id, requirement').order('sort_order', { ascending: true }),
    supabase.from('user_achievements').select('achievement_id').eq('user_id', userId),
    supabase.from('user_books').select('status, format, rating, review, started_at, finished_at, books(page_count, genres)').eq('user_id', userId),
    supabase.from('club_members').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    supabase.from('clubs').select('id', { count: 'exact', head: true }).eq('created_by', userId),
  ])

  const badges = badgesRes.data || []
  const unlockedIds = new Set((unlockedRes.data || []).map(a => a.achievement_id))
  const books = (booksRes.data || []) as Array<{
    status: string
    format: string | null
    rating: number | null
    review: string | null
    started_at: string | null
    finished_at: string | null
    books: { page_count: number | null; genres: string[] | null } | { page_count: number | null; genres: string[] | null }[] | null
  }>

  const bookRowOf = (b: (typeof books)[number]) =>
    Array.isArray(b.books) ? b.books[0] : b.books

  const readBooks = books.filter(b => b.status === 'read')

  const maxPagesFinished = readBooks
    .filter(b => b.finished_at)
    .reduce((max, b) => Math.max(max, bookRowOf(b)?.page_count || 0), 0)

  const genreCounts: Record<string, number> = {}
  for (const b of readBooks) {
    for (const genre of bookRowOf(b)?.genres || []) {
      genreCounts[genre] = (genreCounts[genre] || 0) + 1
    }
  }

  const progress: BadgeProgress = {
    booksRead: readBooks.length,
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
    audiobooksRead: readBooks.filter(b => b.format === 'audiobook').length,
    genreCounts,
  }

  const newlyUnlocked: string[] = []

  for (const badge of badges) {
    if (unlockedIds.has(badge.id)) continue
    if (!badge.requirement || typeof badge.requirement !== 'object') continue

    if (meetsRequirement(badge.requirement, progress)) {
      const ok = await unlockBadge(userId, badge.id)
      if (ok) {
        newlyUnlocked.push(badge.id)
        unlockedIds.add(badge.id)
      }
    }
  }

  return newlyUnlocked
}
