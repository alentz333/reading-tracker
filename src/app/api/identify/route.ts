import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { image } = await request.json();
    
    if (!image) {
      return NextResponse.json({ error: 'Image required' }, { status: 400 });
    }

    // Get API key from environment
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 500 });
    }

    // Call OpenAI Vision API
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Look at this book cover image and identify the book. Return ONLY a JSON object with this exact format, no other text:
{"title": "Book Title", "author": "Author Name"}

If you can't identify the book or it's not a book cover, return:
{"error": "Could not identify book"}`,
              },
              {
                type: 'image_url',
                image_url: {
                  url: image,
                  detail: 'low',
                },
              },
            ],
          },
        ],
        max_tokens: 150,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('OpenAI error:', error);
      return NextResponse.json({ error: 'Failed to identify book' }, { status: 500 });
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content?.trim();
    
    // Parse the JSON response
    try {
      const result = JSON.parse(content);
      if (result.error) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
      return NextResponse.json(result);
    } catch {
      // Try to extract title/author from text if JSON parsing fails
      console.error('Failed to parse response:', content);
      return NextResponse.json({ error: 'Could not parse book info' }, { status: 400 });
    }
  } catch (error) {
    console.error('Identify error:', error);
    return NextResponse.json({ error: 'Failed to process image' }, { status: 500 });
  }
}
