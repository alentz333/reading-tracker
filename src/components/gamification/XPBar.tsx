'use client'

import { getXPProgress, getLevelName } from '@/lib/supabase/gamification'

interface XPBarProps {
  xp: number
  level: number
  showLabel?: boolean
  size?: 'sm' | 'md' | 'lg'
}

export default function XPBar({ xp, level, showLabel = true, size = 'md' }: XPBarProps) {
  const progress = getXPProgress(xp)
  const levelName = getLevelName(level)

  const sizeClasses = {
    sm: 'h-1.5',
    md: 'h-2',
    lg: 'h-3',
  }

  return (
    <div className="w-full">
      {showLabel && (
        <div className="flex justify-between items-center mb-1">
          <span className="text-xs text-white/60">
            {levelName}
          </span>
          <span className="text-xs text-white/40">
            {progress.current.toLocaleString()} / {progress.required.toLocaleString()} XP
          </span>
        </div>
      )}
      <div className={`w-full bg-white/10 rounded-full overflow-hidden ${sizeClasses[size]}`}>
        <div
          className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-500 ease-out"
          style={{ width: `${progress.percentage}%` }}
        />
      </div>
    </div>
  )
}
