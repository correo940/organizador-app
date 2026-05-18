import { NextResponse } from 'next/server';
import { checkApiLimit, getAuthUser, recordApiUsage } from '@/lib/api-limit';

const GROQ_API_KEY = process.env.GROQ_API_KEY || process.env.NEXT_PUBLIC_GROQ_API_KEY || '';
const GROQ_MODEL = 'llama-3.3-70b-versatile';

export async function POST(request: Request) {
  if (!GROQ_API_KEY) {
    return NextResponse.json({ success: false, error: 'Clave API no configurada' }, { status: 500 });
  }

  try {
    const user = await getAuthUser(request);
    if (user) {
      const limitCheck = await checkApiLimit(user.id, user.email || null, 'generate-recipe');
      if (!limitCheck.allowed) {
        return NextResponse.json(
          { success: false, error: `Límite mensual alcanzado (${limitCheck.used}/${limitCheck.limit})` },
          { status: 429 }
        );
      }
    }

    const { pantryItems } = await request.json();
    if (!Array.isArray(pantryItems) || pantryItems.length === 0) {
      return NextResponse.json(
        { success: false, error: 'La despensa está vacía. Añade productos primero.' },
        { status: 400 }
      );
    }

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          {
            role: 'system',
            content: 'Eres un chef experto. Responde SOLO con JSON válido, sin texto adicional ni bloques de código.',
          },
          {
            role: 'user',
            content: `Crea una receta con estos ingredientes: ${pantryItems.join(', ')}.
Devuelve solo JSON:
{
  "title": "Nombre",
  "description": "Resumen apetitoso",
  "cooking_time": "Tiempo",
  "difficulty": "Fácil/Media/Difícil",
  "ingredients": [{"name":"Ingrediente","quantity":"Cantidad","has_it":true}],
  "steps": ["Paso 1", "Paso 2"]
}`,
          },
        ],
        temperature: 0.7,
        max_tokens: 1024,
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
      await recordApiUsage(user.id, 'generate-recipe');
    }

    return NextResponse.json({ success: true, data: parsed });
  } catch (error: any) {
    console.error('[Generate Recipe] Error:', error);
    return NextResponse.json({ success: false, error: `Error interno: ${error.message}` }, { status: 500 });
  }
}
