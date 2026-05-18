import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { imageBase64, provider, apiKey, modelName } = body;

        if (!imageBase64) {
            return NextResponse.json({ error: 'No se proporcionó imagen' }, { status: 400 });
        }

        // Determine provider and key
        const useProvider = provider || 'groq';
        const useKey = apiKey || (useProvider === 'groq'
            ? process.env.GROQ_API_KEY || process.env.NEXT_PUBLIC_GROQ_API_KEY
            : process.env.OPENROUTER_API_KEY);

        if (!useKey) {
            return NextResponse.json({ error: 'No hay API key configurada. Añade tu clave en Ajustes IA.' }, { status: 400 });
        }

        const prompt = `Analiza esta imagen de un ticket de compra o recibo y extrae la siguiente información en formato JSON.
Si no puedes identificar algún campo, usa null.

Responde SOLO con el JSON, sin texto adicional:
{
  "amount": <número decimal con el total>,
  "date": "<fecha en formato YYYY-MM-DD>",
  "merchant": "<nombre del comercio o establecimiento>"
}`;

        let result;

        if (useProvider === 'groq') {
            const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${useKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: modelName || 'llama-3.2-90b-vision-preview',
                    messages: [
                        {
                            role: 'user',
                            content: [
                                { type: 'text', text: prompt },
                                { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageBase64}` } }
                            ]
                        }
                    ],
                    temperature: 0.1,
                    max_tokens: 200
                })
            });

            if (!response.ok) {
                const err = await response.text();
                throw new Error(`Groq API error: ${err}`);
            }

            const data = await response.json();
            const content = data.choices?.[0]?.message?.content || '';
            result = extractJSON(content);

        } else if (useProvider === 'openrouter') {
            const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${useKey}`,
                    'Content-Type': 'application/json',
                    'HTTP-Referer': 'https://quiova.app',
                    'X-Title': 'Mi Economía - Scanner'
                },
                body: JSON.stringify({
                    model: modelName || 'llama-3.2-90b-vision-preview',
                    messages: [
                        {
                            role: 'user',
                            content: [
                                { type: 'text', text: prompt },
                                { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageBase64}` } }
                            ]
                        }
                    ],
                    temperature: 0.1,
                    max_tokens: 200
                })
            });

            if (!response.ok) {
                const err = await response.text();
                throw new Error(`OpenRouter API error: ${err}`);
            }

            const data = await response.json();
            const content = data.choices?.[0]?.message?.content || '';
            result = extractJSON(content);
        }

        if (!result) {
            return NextResponse.json({ error: 'No se pudo extraer datos del recibo' }, { status: 422 });
        }

        return NextResponse.json(result);

    } catch (error: any) {
        console.error('Scan receipt error:', error);
        return NextResponse.json(
            { error: error.message || 'Error al procesar imagen' },
            { status: 500 }
        );
    }
}

function extractJSON(text: string): any {
    try {
        // Try direct parse
        return JSON.parse(text);
    } catch {
        // Try to find JSON in response
        const match = text.match(/\{[\s\S]*?\}/);
        if (match) {
            try {
                return JSON.parse(match[0]);
            } catch {
                return null;
            }
        }
        return null;
    }
}
