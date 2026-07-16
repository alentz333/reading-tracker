import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface BookRow {
  title: string
  author: string | null
  description: string | null
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function summaryToHtml(summary: string): string {
  return summary
    .split(/\n{2,}/)
    .map(p => `<p style="margin:0 0 14px 0;">${escapeHtml(p.trim()).replace(/\n/g, '<br/>')}</p>`)
    .join('')
}

async function generateSummary(book: BookRow, apiKey: string): Promise<string | null> {
  const context = book.description
    ? `\n\nFor reference, here is a short description of the book: ${book.description}`
    : ''

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'user',
          content:
            `Write a summary of the book "${book.title}"${book.author ? ` by ${book.author}` : ''} ` +
            `for a reader who has just finished it. Aim for 250-350 words. Cover the main plot or ` +
            `argument, key themes, and one or two takeaways worth remembering. Spoilers are fine — ` +
            `the reader has finished the book. Write in plain prose paragraphs with no headings or ` +
            `bullet points. If you are not confident you know this specific book, say so in one ` +
            `sentence and summarize what it appears to be about instead of inventing details.` +
            context,
        },
      ],
      max_tokens: 700,
      temperature: 0.4,
    }),
  })

  if (!response.ok) {
    console.error('OpenAI summary error:', response.status, await response.text())
    return null
  }

  const data = await response.json()
  const summary = data.choices?.[0]?.message?.content?.trim()
  return summary || null
}

export async function POST(request: NextRequest) {
  let userBookId: string | undefined
  try {
    const body = await request.json()
    userBookId = body.userBookId
  } catch {
    // fall through to the validation error below
  }

  if (!userBookId) {
    return NextResponse.json({ error: 'userBookId required' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user?.email) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { data: row, error } = await supabase
    .from('user_books')
    .select('id, email_summary_on_finish, books(title, author, description)')
    .eq('id', userBookId)
    .eq('user_id', user.id)
    .single()

  if (error || !row) {
    return NextResponse.json({ error: 'Book not found' }, { status: 404 })
  }

  if (!row.email_summary_on_finish) {
    return NextResponse.json({ skipped: 'Email summary is not enabled for this book' })
  }

  const openaiKey = process.env.OPENAI_API_KEY
  const resendKey = process.env.RESEND_API_KEY
  if (!openaiKey || !resendKey) {
    console.error('finish-summary: missing', openaiKey ? 'RESEND_API_KEY' : 'OPENAI_API_KEY')
    return NextResponse.json({ error: 'Email summaries are not configured on the server' }, { status: 500 })
  }

  const book = (Array.isArray(row.books) ? row.books[0] : row.books) as BookRow | null
  if (!book?.title) {
    return NextResponse.json({ error: 'Book details missing' }, { status: 404 })
  }

  const summary = await generateSummary(book, openaiKey)
  if (!summary) {
    return NextResponse.json({ error: 'Failed to generate summary' }, { status: 502 })
  }

  const html = `
    <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#1a1a1b;">
      <p style="font-size:13px;color:#6b7280;margin:0 0 4px 0;">You finished a book 🎉</p>
      <h1 style="font-size:22px;margin:0 0 2px 0;">${escapeHtml(book.title)}</h1>
      ${book.author ? `<p style="font-size:14px;color:#6b7280;margin:0 0 20px 0;">by ${escapeHtml(book.author)}</p>` : '<div style="height:20px;"></div>'}
      <div style="font-size:15px;line-height:1.6;">${summaryToHtml(summary)}</div>
      <p style="font-size:12px;color:#9ca3af;margin-top:28px;border-top:1px solid #e5e7eb;padding-top:12px;">
        Sent by Shelf because email summaries are turned on for this book.
      </p>
    </div>`

  const from = process.env.SUMMARY_EMAIL_FROM || 'Shelf <onboarding@resend.dev>'

  const sendResponse = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [user.email],
      subject: `📚 You finished "${book.title}" — here's your summary`,
      html,
    }),
  })

  if (!sendResponse.ok) {
    console.error('Resend error:', sendResponse.status, await sendResponse.text())
    return NextResponse.json({ error: 'Failed to send email' }, { status: 502 })
  }

  return NextResponse.json({ sent: true })
}
