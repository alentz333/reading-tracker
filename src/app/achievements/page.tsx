import { redirect } from 'next/navigation'

// Achievements became badges, which live on your profile now.
export default function AchievementsRedirect() {
  redirect('/profile')
}
