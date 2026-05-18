import { NextResponse } from 'next/server';
import { checkApiLimit, getAuthUser, recordApiUsage } from '@/lib/api-limit';

const GROQ_API_KEY = process.env.GROQ_API_KEY || process.env.NEXT_PUBLIC_GROQ_API_KEY || '';
const GROQ_VISION_MODEL = 'llama-3.2-90b-vision-preview';

export async function POST(request: Request) {
  if (!GROQ_API_KEY) {
    return NextResponse.json({ success: false, error: 'Clave API no configurada' }, { status: 500 });
  }

  try {
    const user = await getAuthUser(request);
    if (user) {
      const limitCheck = await checkApiLimit(user.id, user.email || null, 'identify-medicine');
      if (!limitCheck.allowed) {
        return NextResponse.json(
          { success: false, error: `Límite mensual alcanzado (${limitCheck.used}/${limitCheck.limit})` },
          { status: 429 }
        );
      }
    }

    const { base64Image } = await request.json();
    if (!base64Image) {
      return NextResponse.json({ success: false, error: 'Imagen no proporcionada' }, { status: 400 });
    }

    const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, '');

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: GROQ_VISION_MODEL,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Analiza esta imagen de una caja de medicamento y devuelve solo JSON:
{
  "name": "Nombre del medicamento",
  "description": "Para qué sirve en una frase",
  "expiration_date": "YYYY-MM-DD o null"
}`,
              },
              { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64Data}` } },
            ],
          },
        ],
        temperature: 0.1,
        max_tokens: 300,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Groq API error: ${err}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    const parsed = JSON.parse(content.replace(/```json/g, '').replace(/```/g, '').trim());

    if (user) {
      await recordApiUsage(user.id, 'identify-medicine');
    }

    return NextResponse.json({ success: true, data: parsed });
  } catch (error: any) {
    console.error('[Identify Medicine] Error:', error);
    return NextResponse.json({ success: false, error: `Error interno: ${error.message}` }, { status: 500 });
  }
}
