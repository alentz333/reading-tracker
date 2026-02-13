'use client'

import { useEffect, useState } from 'react'

interface XPPopupProps {
  amount: number
  reason?: string
  onComplete?: () => void
}

export default function XPPopup({ amount, reason, onComplete }: XPPopupProps) {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false)
      onComplete?.()
    }, 2000)

    return () => clearTimeout(timer)
  }, [onComplete])

  if (!visible) return null

  return (
    <div 
      className="fixed top-20 left-1/2 -translate-x-1/2 z-50 pointer-events-none animate-xp-popup"
    >
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-2 rounded-full shadow-lg">
        <span className="text-white font-bold text-lg">
          +{amount} XP
        </span>
        {reason && (
          <span className="text-white/70 text-sm ml-2">
            {reason}
          </span>
        )}
      </div>
    </div>
  )
}

// Hook for managing XP popups
export function useXPPopup() {
  const [popup, setPopup] = useState<{ amount: number; reason?: string; key: number } | null>(null)

  const showXP = (amount: number, reason?: string) => {
    setPopup({ amount, reason, key: Date.now() })
  }

  const clearPopup = () => setPopup(null)

  return { popup, showXP, clearPopup }
}
