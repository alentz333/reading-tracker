#!/usr/bin/env node
// One-time catalog enrichment: fills MISSING book fields (cover, genres,
// page count, description, isbn, ol_key, published year) from Open Library,
// with Google Books as a fallback. Never overwrites existing values.
//
// The books table has no UPDATE policy, so this script does not write to the
// database — it emits enrich-updates.sql (and .json) for a service-role run:
//   node scripts/enrich-books.mjs [--limit N]
//
// Reads NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY and optional
// GOOGLE_BOOKS_API_KEY from .env.local.

import { readFileSync, writeFileSync } from 'node:fs'

const OUT_SQL = 'enrich-updates.sql'
const OUT_JSON = 'enrich-updates.json'
const OL_DELAY_MS = 350 // stay polite to Open Library

// Same mapping as src/lib/supabase/books.ts — keep in sync.
const GENRE_RULES = [
  [['young adult', 'ya fiction', 'young-adult', 'teen fiction'], 'Young Adult'],
  [["children's", 'juvenile', 'picture book', 'easy reader'], "Children's"],
  [['science fiction', 'sci-fi', 'space opera', 'dystopian', 'cyberpunk', 'time travel', 'speculative fiction'], 'Science Fiction'],
  [['fantasy', 'epic fantasy', 'high fantasy', 'sword and sorcery', 'magical realism', 'wizards', 'dragons'], 'Fantasy'],
  [['mystery', 'detective', 'whodunit', 'cozy mystery', 'hardboiled', 'crime fiction', 'murder mystery'], 'Mystery'],
  [['thriller', 'suspense', 'espionage', 'spy fiction', 'techno-thriller'], 'Thriller'],
  [['horror', 'ghost stories', 'supernatural fiction', 'gothic fiction', 'dark fiction'], 'Horror'],
  [['romance', 'love stories', 'romantic fiction'], 'Romance'],
  [['historical fiction', 'historical novel'], 'Historical Fiction'],
  [['biography', 'autobiography', 'memoir', 'life story', 'personal narratives'], 'Biography'],
  [['self-help', 'personal development', 'self improvement', 'self-improvement', 'motivational'], 'Self-Help'],
  [['history', 'world history', 'ancient history', 'military history'], 'History'],
  [['science', 'physics', 'biology', 'chemistry', 'astronomy', 'natural history', 'popular science'], 'Science'],
  [['psychology', 'psychological', 'psychiatry', 'cognitive', 'behavioral'], 'Psychology'],
  [['philosophy', 'philosophical', 'ethics', 'logic', 'metaphysics'], 'Philosophy'],
  [['business', 'economic', 'finance', 'entrepreneurship', 'management', 'leadership', 'marketing'], 'Business'],
  [['politics', 'political', 'government', 'democracy'], 'Politics'],
  [['religion', 'spiritual', 'theology', 'christian', 'islamic', 'buddhis', 'hindu'], 'Religion'],
  [['adventure', 'action and adventure'], 'Adventure'],
  [['humor', 'comedy', 'satire', 'humorous', 'wit and humor'], 'Humor'],
  [['poetry', 'verse', 'poems'], 'Poetry'],
  [['drama', 'plays', 'theatrical'], 'Drama'],
  [['graphic novel', 'comics', 'manga', 'comic book'], 'Graphic Novel'],
  [['cooking', 'food', 'recipes', 'cuisine', 'baking', 'gastronomy'], 'Cooking'],
  [['travel', 'travelogue', 'travel writing'], 'Travel'],
  [['nonfiction', 'non-fiction', 'popular works'], 'Nonfiction'],
  [['fiction'], 'Fiction'],
]

function normalizeGenres(subjects) {
  const found = []
  for (const subject of subjects) {
    const lower = String(subject).toLowerCase()
    for (const [keywords, genre] of GENRE_RULES) {
      if (found.includes(genre)) continue
      if (keywords.some(kw => lower.includes(kw))) {
        found.push(genre)
        break
      }
    }
    if (found.length >= 5) break
  }
  return found.slice(0, 5)
}

function loadEnv() {
  const env = {}
  for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (m) env[m[1]] = m[2].replace(/^"|"$/g, '')
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

// Titles match when equal, or one is the other plus a subtitle.
function titleMatches(a, b) {
  const na = norm(stripSeries(a))
  const nb = norm(stripSeries(b))
  if (!na || !nb) return false
  return na === nb || na.startsWith(nb + ' ') || nb.startsWith(na + ' ')
}

function authorKnown(author) {
  const a = norm(author)
  return a && a !== 'unknown' && a !== 'unknown author'
}

function authorMatches(bookAuthor, candidateAuthors) {
  const lastName = norm(bookAuthor).split(' ').pop()
  if (!lastName) return false
  return (candidateAuthors || []).some(c => norm(c).includes(lastName))
}

const sleep = ms => new Promise(r => setTimeout(r, ms))

async function getJson(url) {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'shelf-app-enrichment (one-time backfill)' } })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

async function searchOpenLibrary(book) {
  const fields = 'key,title,author_name,cover_i,isbn,number_of_pages_median,first_publish_year'
  const title = stripSeries(book.title)
  let url
  if (authorKnown(book.author)) {
    url = `https://openlibrary.org/search.json?title=${encodeURIComponent(title)}&author=${encodeURIComponent(book.author)}&fields=${fields}&limit=5`
  } else {
    url = `https://openlibrary.org/search.json?title=${encodeURIComponent(title)}&fields=${fields}&limit=5`
  }
  const data = await getJson(url)
  const docs = data?.docs || []
  return docs.find(d =>
    titleMatches(d.title, book.title) &&
    (!authorKnown(book.author) || authorMatches(book.author, d.author_name))
  ) || null
}

async function fetchOlWork(olKey) {
  const data = await getJson(`https://openlibrary.org${olKey}.json`)
  if (!data) return null
  const description = typeof data.description === 'string'
    ? data.description
    : data.description?.value
  return { subjects: data.subjects || [], description: description || null }
}

async function searchGoogleBooks(book, apiKey) {
  if (!apiKey) return null
  const q = authorKnown(book.author)
    ? `intitle:${stripSeries(book.title)} inauthor:${book.author}`
    : `intitle:${stripSeries(book.title)}`
  const data = await getJson(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=5&key=${apiKey}`)
  const items = data?.items || []
  const hit = items.find(i => {
    const v = i.volumeInfo || {}
    return titleMatches(v.title, book.title) &&
      (!authorKnown(book.author) || authorMatches(book.author, v.authors))
  })
  if (!hit) return null
  const v = hit.volumeInfo
  return {
    cover: v.imageLinks?.thumbnail?.replace('http://', 'https://') || null,
    pageCount: v.pageCount || null,
    description: v.description || null,
    genres: normalizeGenres(v.categories || []),
    publishedYear: v.publishedDate ? v.publishedDate.slice(0, 4) : null,
    isbn: (v.industryIdentifiers || []).find(x => x.type === 'ISBN_13')?.identifier
      || (v.industryIdentifiers || []).find(x => x.type === 'ISBN_10')?.identifier
      || null,
  }
}

const sqlText = v => `'${String(v).replace(/'/g, "''")}'`
const sqlArray = arr => `ARRAY[${arr.map(sqlText).join(', ')}]`

async function main() {
  const env = loadEnv()
  const limitArg = process.argv.indexOf('--limit')
  const limit = limitArg > -1 ? Number(process.argv[limitArg + 1]) : Infinity

  const rest = `${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1`
  const headers = {
    apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    Authorization: `Bearer ${env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
  }
  const res = await fetch(
    `${rest}/books?select=id,title,author,isbn,ol_key,cover_url,page_count,description,genres,published_date&limit=1000`,
    { headers }
  )
  if (!res.ok) throw new Error(`Failed to fetch books: ${res.status}`)
  const books = await res.json()

  const needsWork = books.filter(b =>
    !b.cover_url || !b.page_count || !b.description ||
    !b.genres?.length || !b.isbn || !b.ol_key || !b.published_date
  ).slice(0, limit)

  console.log(`${books.length} books in catalog, ${needsWork.length} need enrichment`)

  const updates = []
  const misses = []
  let processed = 0

  for (const book of needsWork) {
    processed++
    const fields = {}

    // Open Library: resolve a work either from the stored key or by search
    let doc = null
    if (!book.ol_key) {
      doc = await searchOpenLibrary(book)
      await sleep(OL_DELAY_MS)
    }
    const olKey = book.ol_key || doc?.key || null

    if (doc) {
      if (!book.cover_url && doc.cover_i) fields.cover_url = `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`
      if (!book.page_count && doc.number_of_pages_median) fields.page_count = doc.number_of_pages_median
      if (!book.published_date && doc.first_publish_year) fields.published_date = String(doc.first_publish_year)
      if (!book.isbn && doc.isbn?.length) fields.isbn = doc.isbn.find(i => i.length === 13) || doc.isbn[0]
      if (!book.ol_key && doc.key) fields.ol_key = doc.key
    }

    if (olKey && (!book.genres?.length || !book.description)) {
      const work = await fetchOlWork(olKey)
      await sleep(OL_DELAY_MS)
      if (work) {
        if (!book.genres?.length) {
          const genres = normalizeGenres(work.subjects)
          if (genres.length) fields.genres = genres
        }
        if (!book.description && work.description) fields.description = work.description.slice(0, 2000)
      }
    }

    // Google Books fallback for whatever is still missing
    const stillMissing =
      (!book.cover_url && !fields.cover_url) ||
      (!book.page_count && !fields.page_count) ||
      (!book.description && !fields.description) ||
      (!book.genres?.length && !fields.genres)
    if (stillMissing && env.GOOGLE_BOOKS_API_KEY) {
      const g = await searchGoogleBooks(book, env.GOOGLE_BOOKS_API_KEY)
      await sleep(150)
      if (g) {
        if (!book.cover_url && !fields.cover_url && g.cover) fields.cover_url = g.cover
        if (!book.page_count && !fields.page_count && g.pageCount) fields.page_count = g.pageCount
        if (!book.description && !fields.description && g.description) fields.description = g.description.slice(0, 2000)
        if (!book.genres?.length && !fields.genres && g.genres.length) fields.genres = g.genres
        if (!book.published_date && !fields.published_date && g.publishedYear) fields.published_date = g.publishedYear
        if (!book.isbn && !fields.isbn && g.isbn) fields.isbn = g.isbn
      }
    }

    if (Object.keys(fields).length) {
      updates.push({ id: book.id, title: book.title, author: book.author, fields })
    } else {
      misses.push({ id: book.id, title: book.title, author: book.author })
    }

    if (processed % 20 === 0) {
      console.log(`  ...${processed}/${needsWork.length} (${updates.length} matched)`)
    }
  }

  const sql = updates.map(u => {
    const sets = Object.entries(u.fields).map(([col, val]) => {
      if (col === 'genres') return `genres = ${sqlArray(val)}`
      if (col === 'page_count') return `page_count = ${Number(val)}`
      return `${col} = ${sqlText(val)}`
    })
    return `UPDATE books SET ${sets.join(', ')} WHERE id = '${u.id}';`
  }).join('\n')

  writeFileSync(OUT_SQL, sql + '\n')
  writeFileSync(OUT_JSON, JSON.stringify({ updates, misses }, null, 2))

  console.log(`\nDone: ${updates.length} books enriched, ${misses.length} with no confident match`)
  console.log(`Wrote ${OUT_SQL} and ${OUT_JSON}`)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
