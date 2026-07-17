import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
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

  const anthropic = new Anthropic({ apiKey })

  const params: Anthropic.MessageCreateParamsNonStreaming = {
    model: 'claude-haiku-4-5',
    max_tokens: 2048,
    tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 3 }],
    messages: [
      {
        role: 'user',
        content:
          `Write a summary of the book "${book.title}"${book.author ? ` by ${book.author}` : ''} ` +
          `for a reader who has just finished it. Aim for 250-350 words. Cover the main plot or ` +
          `argument, key themes, and one or two takeaways worth remembering. Spoilers are fine — ` +
          `the reader has finished the book. Write in plain prose paragraphs with no headings or ` +
          `bullet points. If you are not confident you know this specific book from training, ` +
          `search the web for existing summaries, reviews, or the publisher's description and ` +
          `base your summary on those instead. Never invent plot details; if you can't find ` +
          `reliable information either, say so in one sentence and summarize what the book ` +
          `appears to be about. The final response should be only the summary itself — no ` +
          `preamble about searching or sources.` +
          context,
      },
    ],
  }

  try {
    let response = await anthropic.messages.create(params)

    // Server-side web search can pause a long tool loop; resume until done.
    for (let i = 0; i < 3 && response.stop_reason === 'pause_turn'; i++) {
      response = await anthropic.messages.create({
        ...params,
        messages: [...params.messages, { role: 'assistant', content: response.content }],
      })
    }

    // Web search splits the answer across multiple text blocks (citations).
    const summary = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map(block => block.text)
      .join('')
      .trim()
    return summary || null
  } catch (err) {
    console.error('Claude summary error:', err)
    return null
  }
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

  const anthropicKey = process.env.ANTHROPIC_API_KEY
  const resendKey = process.env.RESEND_API_KEY
  if (!anthropicKey || !resendKey) {
    console.error('finish-summary: missing', anthropicKey ? 'RESEND_API_KEY' : 'ANTHROPIC_API_KEY')
    return NextResponse.json({ error: 'Email summaries are not configured on the server' }, { status: 500 })
  }

  const book = (Array.isArray(row.books) ? row.books[0] : row.books) as BookRow | null
  if (!book?.title) {
    return NextResponse.json({ error: 'Book details missing' }, { status: 404 })
  }

  const summary = await generateSummary(book, anthropicKey)
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
