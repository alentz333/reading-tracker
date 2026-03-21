import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface BookRef {
  title: string
  author: string | null
}

interface ExportRow {
  books: BookRef
  started_at: string | null
  finished_at: string | null
  rating: number | null
}

interface ExportRowRaw {
  books: BookRef | BookRef[] | null
  started_at: string | null
  finished_at: string | null
  rating: number | null
}

function escapeCsv(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return ''
  const str = String(value)
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

function toCsv(rows: ExportRow[]): string {
  const header = ['Book Title', 'Author', 'Started At', 'Finished At', 'Rating']
  const body = rows.map((row) => [
    escapeCsv(row.books.title),
    escapeCsv(row.books.author || ''),
    escapeCsv(row.started_at),
    escapeCsv(row.finished_at),
    escapeCsv(row.rating),
  ].join(','))

  return [header.join(','), ...body].join('\n')
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  try {
    const { username } = await params
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Ensure this export only works for the authenticated user's own profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', user.id)
      .single()

    if (!profile || profile.username !== username) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { data, error } = await supabase
      .from('user_books')
      .select(`
        started_at,
        finished_at,
        rating,
        books (
          title,
          author
        )
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Export query failed:', error)
      return NextResponse.json({ error: 'Failed to export reading data' }, { status: 500 })
    }

    const rawRows = ((data as unknown as ExportRowRaw[] | null) || [])

    const rows: ExportRow[] = rawRows
      .map((row) => {
        const book = Array.isArray(row.books) ? row.books[0] : row.books
        if (!book) return null

        return {
          books: book,
          started_at: row.started_at,
          finished_at: row.finished_at,
          rating: row.rating,
        }
      })
      .filter((row): row is ExportRow => Boolean(row?.books?.title))

    const csv = toCsv(rows)
    const date = new Date().toISOString().slice(0, 10)

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="reading-database-${date}.csv"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    console.error('Reading export error:', error)
    return NextResponse.json({ error: 'Failed to export reading data' }, { status: 500 })
  }
}
