import { NextResponse } from 'next/server';
import { checkApiLimit, getAuthUser, recordApiUsage } from '@/lib/api-limit';

const GROQ_API_KEY = process.env.GROQ_API_KEY || process.env.NEXT_PUBLIC_GROQ_API_KEY || '';
const GROQ_VISION_MODEL = 'llama-3.2-90b-vision-preview';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function POST(request: Request) {
  if (!GROQ_API_KEY) {
    return NextResponse.json(
      { success: false, error: 'Clave API no configurada en el servidor' },
      { status: 500, headers: corsHeaders }
    );
  }

  try {
    const user = await getAuthUser(request);
    if (user) {
      const limitCheck = await checkApiLimit(user.id, user.email || null, 'identify-product');
      if (!limitCheck.allowed) {
        return NextResponse.json(
          { success: false, error: `Límite mensual alcanzado (${limitCheck.used}/${limitCheck.limit})` },
          { status: 429, headers: corsHeaders }
        );
      }
    }

    const body = await request.json();
    const base64Image = body.image || body.base64Image;

    if (!base64Image) {
      return NextResponse.json(
        { success: false, error: 'Imagen no proporcionada' },
        { status: 400, headers: corsHeaders }
      );
    }

    const base64Data = base64Image.includes('base64,')
      ? base64Image.split('base64,')[1]
      : base64Image;

    const prompt = `Identifica el producto en esta imagen.
Devuelve un JSON con:
{
  "productName": "Nombre del producto",
  "supermarket": "Supermercado si se puede deducir"
}
Si no se puede identificar, devuelve {"productName":"Desconocido","supermarket":null}.`;

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
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64Data}` } },
            ],
          },
        ],
        temperature: 0.1,
        max_tokens: 200,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Groq API error: ${err}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    const cleanedContent = content.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleanedContent);

    if (parsed.productName?.toLowerCase().includes('desconocido')) {
      return NextResponse.json(
        { success: false, error: 'No se pudo identificar el producto' },
        { headers: corsHeaders }
      );
    }

    if (user) {
      await recordApiUsage(user.id, 'identify-product');
    }

    return NextResponse.json(
      {
        success: true,
        productName: parsed.productName,
        supermarket: parsed.supermarket || undefined,
      },
      { headers: corsHeaders }
    );
  } catch (error: any) {
    console.error('[Identify Product] Error:', error);
    return NextResponse.json(
      { success: false, error: `Error interno: ${error.message}` },
      { status: 500, headers: corsHeaders }
    );
  }
}
