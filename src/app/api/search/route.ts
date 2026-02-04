import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('q');
  
  if (!query) {
    return NextResponse.json({ error: 'Query required' }, { status: 400 });
  }
  
  try {
    const response = await fetch(
      `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=10&fields=key,title,author_name,cover_i,isbn,number_of_pages_median,first_publish_year`
    );
    
    if (!response.ok) {
      throw new Error('Open Library API error');
    }
    
    const data = await response.json();
    
    const books = data.docs.map((doc: any) => ({
      key: doc.key,
      title: doc.title,
      author: doc.author_name?.[0] || 'Unknown Author',
      coverUrl: doc.cover_i 
        ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg`
        : null,
      isbn: doc.isbn?.[0],
      pageCount: doc.number_of_pages_median,
      publishedYear: doc.first_publish_year,
    }));
    
    return NextResponse.json({ books });
  } catch (error) {
    console.error('Search error:', error);
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}
