import { NextResponse } from 'next/server';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { monthlyStats, recentTransactions } = body;

        const groqKey = process.env.GROQ_API_KEY;

        if (!groqKey) {
            return NextResponse.json({ error: 'Falta la clave API de Groq' }, { status: 500 });
        }

        // Prepare context
        const context = `
Estadísticas de este mes:
- Ingresos: ${monthlyStats?.income || 0} EUR
- Gastos: ${monthlyStats?.expense || 0} EUR
- Tasa de Ahorro: ${monthlyStats?.savingsRate?.toFixed(1) || 0}%

Últimas transacciones (categoría/banco - cantidad):
${(recentTransactions || []).slice(0, 5).map((t: any) => `- ${t.description}: ${t.amount} EUR`).join('\n')}
        `;

        const prompt = `
Eres la Inteligencia Artificial financiera de Quioba, un asesor de alto nivel y extremadamente observador.
Tu objetivo es dar un análisis empírico, útil y al grano sobre el estado financiero del usuario de este mes.
EVITA decir generalidades. DEBES basarte estrictamente en los números provistos.
Si la tasa de ahorro es negativa o menor al 10%, da una advertencia clara. Si hay gastos grandes en las últimas transacciones, menciónalos.
Si la tasa de ahorro es buena (>20%), felicita mencionando el margen de maniobra.

Datos reales del usuario actual:
${context}

Responde EXCLUSIVAMENTE con el siguiente formato JSON estricto, sin markdown (\`\`\`json) y con las siguientes propiedades:
- "insight": Una explicación analítica de 3 a 4 oraciones. TIENES que mencionar cantidades exactas de los datos proporcionados (ej. "Tus gastos están en X EUR, dejándote una tasa de ahorro del Y%. El gasto en [Transacción] ha impactado tu liquidez."). Haz que suene a un análisis real y personalizado. Máximo 450 caracteres.
- "metricHighlight": Una frase ultracorta pero muy contundente que resuma el estado actual (ej. "Alerta de Liquidez", "Ahorro Impecable", "Cuidado con los Gastos", "Mes en Rojo"). Máximo 30 caracteres.
- "type": "positive", "warning", o "neutral", dependiendo puramente de la salud de estos números.
`;

        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${groqKey}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                "model": "llama-3.3-70b-versatile",
                "messages": [
                    { "role": "system", "content": "Eres un asistente financiero estricto que solo responde en JSON válido." },
                    { "role": "user", "content": prompt }
                ],
                "response_format": { "type": "json_object" }
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Groq Error:', errorText);
            return NextResponse.json({ error: 'Error al contactar con Groq' }, { status: 500 });
        }

        const data = await response.json();
        
        if (!data.choices || !data.choices[0] || !data.choices[0].message) {
            console.error('Groq invalid response:', data);
            return NextResponse.json({ error: 'Respuesta inválida de la IA' }, { status: 500 });
        }

        const rawContent = data.choices[0].message.content;
        
        let parsed;
        try {
            parsed = JSON.parse(rawContent);
        } catch (e) {
            // Eliminar markdown de JSON si la IA se equivocó
            const match = rawContent.match(/```json\n([\s\S]*?)\n```/);
            if (match) {
                parsed = JSON.parse(match[1]);
            } else {
                parsed = JSON.parse(rawContent.replace(/```/g, '').trim());
            }
        }

        return NextResponse.json(parsed);

    } catch (error) {
        console.error('API /financial-insights error:', error);
        return NextResponse.json({ error: 'Error procesando la solicitud' }, { status: 500 });
    }
}
