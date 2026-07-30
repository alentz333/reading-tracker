// Achievements were rebranded as badges — the logic now lives in badges.ts.
// This re-export keeps older imports working until they migrate.
export { checkAndUnlockBadges as checkAndUnlockAchievements } from './badges'
