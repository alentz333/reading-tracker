'use client'

import { useState } from 'react'
import { Badge, UserBadge } from '@/lib/supabase/badges'

interface BadgeShowcaseProps {
  badges: Badge[]
  userBadges: UserBadge[]
  showLocked?: boolean // Own profile: also show badges still to be earned
}

// Styled for the light-themed public profile page.
export default function BadgeShowcase({ badges, userBadges, showLocked = false }: BadgeShowcaseProps) {
  const [expanded, setExpanded] = useState(false)

  const unlockedById = new Map(userBadges.map(ub => [ub.badgeId, ub]))
  const earned = badges.filter(b => unlockedById.has(b.id))
  const locked = showLocked ? badges.filter(b => !unlockedById.has(b.id)) : []

  if (earned.length === 0 && locked.length === 0) return null

  const visibleLocked = expanded ? locked : []

  return (
    <section className="max-w-4xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-[var(--color-forest)] flex items-center gap-2">
          <span className="text-2xl">🏅</span> Badges
          <span className="text-sm font-normal text-gray-500">
            {earned.length} earned{showLocked ? ` · ${locked.length} to go` : ''}
          </span>
        </h2>
        {showLocked && locked.length > 0 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-sm text-[var(--color-forest)] hover:underline"
          >
            {expanded ? 'Hide locked badges' : 'Show locked badges'}
          </button>
        )}
      </div>

      {earned.length === 0 ? (
        <div className="card p-6 text-center text-gray-500">
          No badges earned yet — finish some books to start collecting!
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {earned.map(badge => {
            const unlock = unlockedById.get(badge.id)
            return (
              <div key={badge.id} className="card p-4 text-center" title={badge.description || badge.name}>
                <div className="w-14 h-14 mx-auto rounded-full bg-[var(--color-gold)]/20 ring-2 ring-[var(--color-gold)] flex items-center justify-center text-3xl mb-2">
                  {badge.icon || '🏅'}
                </div>
                <h3 className="font-medium text-sm text-[var(--color-forest)]">{badge.name}</h3>
                <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{badge.description}</p>
                {unlock && (
                  <p className="text-[0.625rem] text-gray-400 mt-1">
                    {new Date(unlock.unlockedAt).toLocaleDateString()}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}

      {visibleLocked.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mt-3">
          {visibleLocked.map(badge => (
            <div key={badge.id} className="card p-4 text-center opacity-50" title={badge.description || badge.name}>
              <div className="w-14 h-14 mx-auto rounded-full bg-gray-200 flex items-center justify-center text-3xl mb-2">
                🔒
              </div>
              <h3 className="font-medium text-sm text-[var(--color-forest)]">{badge.name}</h3>
              <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{badge.description}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
