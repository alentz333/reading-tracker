#!/usr/bin/env node
// Resolves the author for catalog rows still sitting on the 'Unknown Author'
// placeholder — books added through the previous-reads importer, which only
// reads title and year and drops any author column the CSV had.
//
// Looks each title up on Open Library, with Google Books as a fallback, and
// only accepts a match whose title agrees with ours. Anything ambiguous is
// left alone and reported as a miss: a wrong author is worse than a blank one,
// because nothing downstream flags it as a guess.
//
// The books table has no UPDATE policy, so this script does not write to the
// database — it emits backfill-authors.sql (and .json) for a service-role run:
//   node scripts/backfill-authors.mjs [--limit N]
//
// Reads NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY and optional
// GOOGLE_BOOKS_API_KEY from the environment, falling back to .env.local.

import { readFileSync, writeFileSync } from 'node:fs'

const OUT_SQL = 'backfill-authors.sql'
const OUT_JSON = 'backfill-authors.json'
const OL_DELAY_MS = 350 // stay polite to Open Library

function loadEnv() {
  const env = {}
  try {
    for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
      if (m) env[m[1]] = m[2].replace(/^"|"$/g, '')
    }
  } catch {
    // No .env.local — fall through to the process environment
  }
  for (const key of ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'GOOGLE_BOOKS_API_KEY']) {
    if (process.env[key]) env[key] = process.env[key]
  }
  return env
}

const norm = s => String(s || '')
  .toLowerCase()
  .normalize('NFKD')
  .replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9 ]+/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

// Goodreads-style titles carry a series suffix: "Wind and Truth (The
// Stormlight Archive, #5)" — drop it for searching and matching.
const stripSeries = t => String(t || '').replace(/\s*\([^)]*\)\s*$/, '').trim()

// Subtitles are inconsistent across providers ("Outlive" vs "Outlive: The
// Science and Art of Longevity"), so treat a shared prefix as a match.
function titleMatches(a, b) {
  const na = norm(stripSeries(a))
  const nb = norm(stripSeries(b))
  if (!na || !nb) return false
  return na === nb || na.startsWith(nb + ' ') || nb.startsWith(na + ' ')
}

// Open Library lists translators, illustrators and editors alongside writers;
// the first credit is the primary author in practice.
function pickAuthor(names) {
  const first = (names || []).map(n => String(n || '').trim()).filter(Boolean)[0]
  if (!first) return null
  const cleaned = first.replace(/\s+/g, ' ').trim()
  return cleaned && norm(cleaned) !== 'unknown author' ? cleaned : null
}

const sleep = ms => new Promise(r => setTimeout(r, ms))

async function getJson(url) {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'shelf-app-enrichment (author backfill)' } })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

// An ISBN is an exact identifier, so it beats any title search when present.
async function authorFromIsbn(isbn) {
  if (!isbn) return null
  const data = await getJson(`https://openlibrary.org/search.json?isbn=${encodeURIComponent(isbn)}&fields=title,author_name&limit=1`)
  const doc = (data?.docs || [])[0]
  if (!doc) return null
  const author = pickAuthor(doc.author_name)
  return author ? { author, via: 'openlibrary:isbn', matchedTitle: doc.title } : null
}

async function authorFromOpenLibrary(book) {
  const title = stripSeries(book.title)
  const data = await getJson(
    `https://openlibrary.org/search.json?title=${encodeURIComponent(title)}&fields=title,author_name,first_publish_year&limit=5`
  )
  const docs = data?.docs || []
  const hit = docs.find(d => titleMatches(d.title, book.title) && pickAuthor(d.author_name))
  if (!hit) return null
  return { author: pickAuthor(hit.author_name), via: 'openlibrary:title', matchedTitle: hit.title }
}

async function authorFromGoogleBooks(book, apiKey) {
  if (!apiKey) return null
  const data = await getJson(
    `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(`intitle:${stripSeries(book.title)}`)}&maxResults=5&key=${apiKey}`
  )
  const items = data?.items || []
  const hit = items.find(i => {
    const v = i.volumeInfo || {}
    return titleMatches(v.title, book.title) && pickAuthor(v.authors)
  })
  if (!hit) return null
  return { author: pickAuthor(hit.volumeInfo.authors), via: 'googlebooks:title', matchedTitle: hit.volumeInfo.title }
}

const sqlText = v => `'${String(v).replace(/'/g, "''")}'`

async function main() {
  const env = loadEnv()
  const limitArg = process.argv.indexOf('--limit')
  const limit = limitArg > -1 ? Number(process.argv[limitArg + 1]) : Infinity

  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY (env or .env.local)')
  }

  const headers = {
    apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    Authorization: `Bearer ${env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
  }
  const res = await fetch(
    `${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/books?select=id,title,author,isbn&author=ilike.unknown%20author&limit=1000`,
    { headers }
  )
  if (!res.ok) throw new Error(`Failed to fetch books: ${res.status}`)
  const books = (await res.json()).slice(0, limit)

  console.log(`${books.length} books with an unknown author`)

  const updates = []
  const misses = []

  for (const [i, book] of books.entries()) {
    const found =
      await authorFromIsbn(book.isbn) ||
      await authorFromOpenLibrary(book) ||
      await authorFromGoogleBooks(book, env.GOOGLE_BOOKS_API_KEY)

    await sleep(OL_DELAY_MS)

    if (found) {
      updates.push({ id: book.id, title: book.title, ...found })
    } else {
      misses.push({ id: book.id, title: book.title })
    }

    if ((i + 1) % 10 === 0) console.log(`  ...${i + 1}/${books.length} (${updates.length} matched)`)
  }

  const sql = updates
    .map(u => `UPDATE books SET author = ${sqlText(u.author)} WHERE id = '${u.id}' AND lower(trim(author)) = 'unknown author';`)
    .join('\n')

  writeFileSync(OUT_SQL, sql + '\n')
  writeFileSync(OUT_JSON, JSON.stringify({ updates, misses }, null, 2))

  console.log(`\nDone: ${updates.length} authors resolved, ${misses.length} with no confident match`)
  console.log(`Wrote ${OUT_SQL} and ${OUT_JSON} — review before applying`)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
