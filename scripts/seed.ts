/**
 * One-shot seed script — creates the auth user, baby row, and wake_window_reference rows.
 * Run with: npm run seed
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY plus the SEED_* vars in .env.local.
 * Idempotent — safe to re-run (checks for existing rows first).
 */

import { createClient } from '@supabase/supabase-js';

// Load .env.local
import { config } from 'dotenv';
config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const BABY_NAME = process.env.SEED_BABY_NAME;
const BABY_DOB = process.env.SEED_BABY_DOB;
const USER_EMAIL = process.env.SEED_USER_EMAIL;
const USER_PASSWORD = process.env.SEED_USER_PASSWORD;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌  Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}
if (!BABY_NAME || !BABY_DOB || !USER_EMAIL || !USER_PASSWORD) {
  console.error('❌  Missing one or more SEED_* environment variables');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function seedUser() {
  // Check if user already exists via listUsers
  const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
  if (listError) throw listError;

  const existing = users.find((u) => u.email === USER_EMAIL);
  if (existing) {
    console.log(`  ↳ Auth user already exists (${USER_EMAIL}) — skipping`);
    return existing.id;
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email: USER_EMAIL,
    password: USER_PASSWORD,
    email_confirm: true,
  });
  if (error) throw error;
  console.log(`  ✓ Created auth user: ${USER_EMAIL}`);
  return data.user.id;
}

async function seedBaby() {
  const { data: existing } = await supabase.from('baby').select('id').limit(1);
  if (existing && existing.length > 0) {
    console.log('  ↳ Baby row already exists — skipping');
    return;
  }

  const { error } = await supabase.from('baby').insert({ name: BABY_NAME, dob: BABY_DOB });
  if (error) throw error;
  console.log(`  ✓ Created baby: ${BABY_NAME} (DOB ${BABY_DOB})`);
}

const WAKE_WINDOW_ROWS = [
  { age_weeks_min: 0,   age_weeks_max: 4,   window_min_minutes: 45,  window_max_minutes: 60,  typical_naps_per_day: 6, source: 'Huckleberry; Taking Cara Babies' },
  { age_weeks_min: 5,   age_weeks_max: 8,   window_min_minutes: 60,  window_max_minutes: 90,  typical_naps_per_day: 5, source: 'Huckleberry; Taking Cara Babies' },
  { age_weeks_min: 9,   age_weeks_max: 12,  window_min_minutes: 75,  window_max_minutes: 105, typical_naps_per_day: 4, source: 'Huckleberry; Taking Cara Babies' },
  { age_weeks_min: 13,  age_weeks_max: 16,  window_min_minutes: 90,  window_max_minutes: 120, typical_naps_per_day: 4, source: 'Huckleberry; Taking Cara Babies' },
  { age_weeks_min: 17,  age_weeks_max: 21,  window_min_minutes: 105, window_max_minutes: 135, typical_naps_per_day: 3, source: 'Huckleberry; Taking Cara Babies' },
  { age_weeks_min: 22,  age_weeks_max: 30,  window_min_minutes: 135, window_max_minutes: 165, typical_naps_per_day: 3, source: 'Huckleberry; Taking Cara Babies' },
  { age_weeks_min: 31,  age_weeks_max: 43,  window_min_minutes: 150, window_max_minutes: 210, typical_naps_per_day: 2, source: 'Huckleberry; Taking Cara Babies' },
  { age_weeks_min: 44,  age_weeks_max: 78,  window_min_minutes: 180, window_max_minutes: 240, typical_naps_per_day: 2, source: 'Huckleberry; Taking Cara Babies' },
  { age_weeks_min: 79,  age_weeks_max: 156, window_min_minutes: 300, window_max_minutes: 360, typical_naps_per_day: 1, source: 'Huckleberry; Taking Cara Babies' },
];

async function seedWakeWindows() {
  const { data: existing } = await supabase.from('wake_window_reference').select('id').limit(1);
  if (existing && existing.length > 0) {
    console.log('  ↳ Wake window rows already exist — skipping');
    return;
  }

  const { error } = await supabase.from('wake_window_reference').insert(WAKE_WINDOW_ROWS);
  if (error) throw error;
  console.log(`  ✓ Inserted ${WAKE_WINDOW_ROWS.length} wake window reference rows`);
}

async function main() {
  console.log('🌱 Seeding database…\n');

  try {
    console.log('→ Auth user');
    await seedUser();

    console.log('→ Baby');
    await seedBaby();

    console.log('→ Wake window reference');
    await seedWakeWindows();

    console.log('\n✅ Seed complete!');
  } catch (err) {
    console.error('\n❌ Seed failed:', err);
    process.exit(1);
  }
}

main();
