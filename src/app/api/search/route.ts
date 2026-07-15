import { NextRequest, NextResponse } from 'next/server';

function extractText(value: unknown): string | undefined {
  if (!value) return undefined;

  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed || undefined;
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      const extracted = extractText(entry);
      if (extracted) return extracted;
    }
    return undefined;
  }

  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;

    const fromValue = extractText(record.value);
    if (fromValue) return fromValue;

    const fromText = extractText(record.text);
    if (fromText) return fromText;
  }

  return undefined;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('q');
  
  if (!query) {
    return NextResponse.json({ error: 'Query required' }, { status: 400 });
  }
  
  try {
    const response = await fetch(
      `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=10&fields=key,title,author_name,cover_i,isbn,number_of_pages_median,first_publish_year,first_sentence`,
      // Open Library results are stable; cache per-query server-side for a day
      { next: { revalidate: 86400 } }
    );
    
    if (!response.ok) {
      throw new Error('Open Library API error');
    }
    
    const data = await response.json();
    
    const books = (data.docs || []).map((doc: Record<string, unknown>) => ({
      key: doc.key,
      title: doc.title,
      author: (Array.isArray(doc.author_name) ? (doc.author_name[0] as string) : undefined) || 'Unknown Author',
      coverUrl: doc.cover_i 
        ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg`
        : null,
      isbn: Array.isArray(doc.isbn) ? (doc.isbn[0] as string) : undefined,
      pageCount: typeof doc.number_of_pages_median === 'number' ? doc.number_of_pages_median : undefined,
      publishedYear: typeof doc.first_publish_year === 'number' ? doc.first_publish_year : undefined,
      description: extractText(doc.first_sentence),
    }));
    
    return NextResponse.json(
      { books },
      { headers: { 'Cache-Control': 'public, max-age=3600, s-maxage=86400' } }
    );
  } catch (error) {
    console.error('Search error:', error);
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}
