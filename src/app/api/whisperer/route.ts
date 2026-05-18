import { NextRequest, NextResponse } from 'next/server';
import { checkApiLimit, getAuthUser, recordApiUsage } from '@/lib/api-limit';

const BASE_URL = 'https://llmwhisperer-api.us-central.unstract.com/api/v2';

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (user) {
      const limitCheck = await checkApiLimit(user.id, user.email || null, 'whisperer');
      if (!limitCheck.allowed) {
        return NextResponse.json({ error: `Límite mensual alcanzado (${limitCheck.used}/${limitCheck.limit})` }, { status: 429 });
      }
    }

    const formData = await request.formData();
    const file = formData.get('file');
    const apiKey = request.headers.get('unstract-key');

    if (!file || !apiKey) {
      return NextResponse.json({ error: 'Missing file or API key' }, { status: 400 });
    }

    const upstreamFormData = new FormData();
    upstreamFormData.append('file', file);
    upstreamFormData.append('mode', 'layout_preserving');
    upstreamFormData.append('output_format', 'text');

    const response = await fetch(`${BASE_URL}/whisper`, {
      method: 'POST',
      headers: {
        'unstract-key': apiKey,
      },
      body: upstreamFormData,
    });

    if (!response.ok) {
      return NextResponse.json({ error: await response.text() }, { status: response.status });
    }

    if (user) {
      await recordApiUsage(user.id, 'whisperer');
    }

    return NextResponse.json(await response.json());
  } catch (error: any) {
    console.error('[Whisperer] POST error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const hash = searchParams.get('hash');
    const apiKey = request.headers.get('unstract-key');

    if (!hash || !apiKey) {
      return NextResponse.json({ error: 'Missing hash or API key' }, { status: 400 });
    }

    const response = await fetch(`${BASE_URL}/whisper-status?whisper_hash=${hash}`, {
      headers: {
        'unstract-key': apiKey,
      },
    });

    if (!response.ok) {
      return NextResponse.json({ error: 'Status Check Failed' }, { status: response.status });
    }

    return NextResponse.json(await response.json());
  } catch (error: any) {
    console.error('[Whisperer] GET error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
