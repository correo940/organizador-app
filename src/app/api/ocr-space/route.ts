import { NextRequest, NextResponse } from 'next/server';
import { checkApiLimit, getAuthUser, recordApiUsage } from '@/lib/api-limit';

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (user) {
      const limitCheck = await checkApiLimit(user.id, user.email || null, 'ocr-space');
      if (!limitCheck.allowed) {
        return NextResponse.json({ error: `Límite mensual alcanzado (${limitCheck.used}/${limitCheck.limit})` }, { status: 429 });
      }
    }

    const formData = await request.formData();
    const upstreamFormData = new FormData();
    for (const [key, value] of formData.entries()) {
      upstreamFormData.append(key, value);
    }

    const response = await fetch('https://api.ocr.space/parse/image', {
      method: 'POST',
      headers: {
        apikey: (upstreamFormData.get('apikey') as string) || 'helloworld',
      },
      body: upstreamFormData,
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: 'OCR.space API Error', details: await response.text() },
        { status: response.status }
      );
    }

    const data = await response.json();
    if (user) {
      await recordApiUsage(user.id, 'ocr-space');
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('[OCR Space] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
