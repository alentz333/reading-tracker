'use client'

interface StreakDisplayProps {
  streak: number
  freezes?: number
  size?: 'sm' | 'md' | 'lg'
  showFreezes?: boolean
}

export default function StreakDisplay({ 
  streak, 
  freezes = 0, 
  size = 'md',
  showFreezes = false 
}: StreakDisplayProps) {
  const sizeClasses = {
    sm: 'text-sm gap-1',
    md: 'text-base gap-1.5',
    lg: 'text-xl gap-2',
  }

  const fireEmoji = streak >= 7 ? '🔥' : streak >= 3 ? '🌟' : '✨'
  const isHot = streak >= 7
  
  return (
    <div className={`flex items-center ${sizeClasses[size]}`}>
      <span 
        className={`${isHot ? 'animate-pulse' : ''}`}
        title={`${streak} day streak`}
      >
        {fireEmoji}
      </span>
      <span className={`font-bold ${isHot ? 'text-orange-400' : 'text-white/80'}`}>
        {streak}
      </span>
      {showFreezes && freezes > 0 && (
        <span className="text-blue-400 text-xs ml-1" title={`${freezes} streak freezes`}>
          ❄️{freezes}
        </span>
      )}
    </div>
  )
}
