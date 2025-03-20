import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    const response = await fetch('http://153.37.96.42:21006/v1/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Ollama API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch from Ollama' },
      { status: 500 }
    );
  }
}