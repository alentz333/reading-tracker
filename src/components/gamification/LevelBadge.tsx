'use client'

import { getLevelName } from '@/lib/supabase/gamification'

interface LevelBadgeProps {
  level: number
  size?: 'sm' | 'md' | 'lg'
  showName?: boolean
}

const LEVEL_COLORS: Record<number, string> = {
  1: 'from-gray-400 to-gray-500',
  2: 'from-green-400 to-green-500',
  3: 'from-blue-400 to-blue-500',
  4: 'from-indigo-400 to-indigo-500',
  5: 'from-purple-400 to-purple-500',
  6: 'from-pink-400 to-pink-500',
  7: 'from-red-400 to-red-500',
  8: 'from-orange-400 to-orange-500',
  9: 'from-yellow-400 to-yellow-500',
  10: 'from-amber-400 to-amber-500',
}

const LEVEL_ICONS: Record<number, string> = {
  1: '🥚',
  2: '📖',
  3: '📚',
  4: '🔍',
  5: '🧭',
  6: '📜',
  7: '🏛️',
  8: '🦋',
  9: '🧙',
  10: '👑',
}

export default function LevelBadge({ level, size = 'md', showName = false }: LevelBadgeProps) {
  const colorClass = LEVEL_COLORS[Math.min(level, 10)] || 'from-amber-400 to-amber-500'
  const icon = LEVEL_ICONS[Math.min(level, 10)] || '👑'

  const sizeClasses = {
    sm: 'w-6 h-6 text-xs',
    md: 'w-8 h-8 text-sm',
    lg: 'w-12 h-12 text-lg',
  }

  const fontSizes = {
    sm: 'text-[10px]',
    md: 'text-xs',
    lg: 'text-sm',
  }

  return (
    <div className="flex items-center gap-2">
      <div
        className={`
          ${sizeClasses[size]}
          bg-gradient-to-br ${colorClass}
          rounded-full flex items-center justify-center
          shadow-lg ring-2 ring-white/20
          relative
        `}
        title={`Level ${level}: ${getLevelName(level)}`}
      >
        <span className="drop-shadow-md">{icon}</span>
        <span
          className={`
            absolute -bottom-1 -right-1
            bg-black/80 rounded-full
            ${fontSizes[size]} font-bold text-white
            px-1 min-w-[1.25rem] text-center
            ring-1 ring-white/20
          `}
        >
          {level}
        </span>
      </div>
      {showName && (
        <span className="text-sm text-white/80 font-medium">
          {getLevelName(level)}
        </span>
      )}
    </div>
  )
}
