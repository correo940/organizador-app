import { NextResponse } from 'next/server';

// ──────────────────────────────────────────────────────────────────────────────
// API Route: /api/secretary-chat
// Sync conversacional con Groq (Llama-3.3-70b). Fase 4.3
// ──────────────────────────────────────────────────────────────────────────────

interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface UserContext {
  firstName: string;
  todayTasks: { title: string; is_completed: boolean }[];
  tomorrowTasks: { title: string; due_date?: string }[];
  balance: number;
  plannedExpense?: number;
  shoppingCount: number;
  tomorrowShifts: { title: string; start_time: string; end_time: string }[];
  incompleteToday: { title: string }[];
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { messages, userContext, isFirstMessage } = body as {
      messages: Message[];
      userContext: UserContext;
      isFirstMessage: boolean;
    };

    const groqKey = process.env.GROQ_API_KEY;
    if (!groqKey) {
      return NextResponse.json({ error: 'Falta GROQ_API_KEY' }, { status: 500 });
    }

    // ─── Construir contexto del usuario para el system prompt ───────────────
    const tasksCompletedToday = userContext.todayTasks
      .filter(t => t.is_completed)
      .map(t => `- ${t.title}`)
      .join('\n') || 'Ninguna completada';

    const tomorrowTasksList = userContext.tomorrowTasks
      .map(t => `- ${t.title}`)
      .join('\n') || 'Sin tareas para mañana';

    const shiftsInfo = userContext.tomorrowShifts.length > 0
      ? userContext.tomorrowShifts.map(s => {
        const start = new Date(s.start_time);
        const end = new Date(s.end_time);
        return `${s.title} (${start.getHours()}:${String(start.getMinutes()).padStart(2,'0')} – ${end.getHours()}:${String(end.getMinutes()).padStart(2,'0')})`;
      }).join(', ')
      : 'Día libre mañana';

    const incompleteList = userContext.incompleteToday
      .map(t => `- ${t.title}`)
      .join('\n') || 'Ninguna';

    const systemPrompt = `Eres una secretaria personal inteligente y empática llamada Quioba.
Tu objetivo es hacer el "Sync nocturno" del usuario ${userContext.firstName} a través de una conversación natural.

DATOS DEL DÍA DE HOY (${new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}):
- Tareas completadas hoy: 
${tasksCompletedToday}
- Tareas incompletas de hoy:
${incompleteList}
- Saldo actual: ${userContext.balance.toLocaleString('es-ES', { maximumFractionDigits: 0 })}€
${userContext.plannedExpense ? `- Gasto previsto mañana: ${userContext.plannedExpense}€` : ''}
- Items en lista de compra: ${userContext.shoppingCount}

PARA MAÑANA:
- Turno: ${shiftsInfo}
- Tareas previstas:
${tomorrowTasksList}

INSTRUCCIONES:
1. Haz el sync de forma conversacional y natural, sin formularios.
2. Pregunta sobre las victorias del día, qué quedó pendiente, y cómo se siente el usuario.
3. Pregunta si hay algo importante para mañana que no esté en la lista.
4. Después de 3-4 intercambios, ofrece un resumen breve y cierra el sync.
5. Respuestas CORTAS (máximo 3 frases). Usa emojis con moderación.
6. Habla en español, en segunda persona informal (tú).
7. Sé cálido pero directo. No alargues innecesariamente.

Si es el primer mensaje del día, empieza saludando y preguntando cómo fue el día.
Cuando el usuario indique que quiere terminar o hagas la 4ª pregunta, genera un resumen final en formato JSON:
{"type":"summary","text":"[resumen en 2-3 frases del día]","readyToClose":true}`;

    // ─── Preparar mensajes para Groq ────────────────────────────────────────
    const groqMessages: Message[] = [
      { role: 'system', content: systemPrompt },
      ...messages,
    ];

    // Si es el primer mensaje, añadir el mensaje de apertura automático
    if (isFirstMessage && messages.length === 0) {
      groqMessages.push({
        role: 'user',
        content: 'Hola, estoy listo para hacer el sync.',
      });
    }

    const FALLBACK_MODELS = [
      'llama-3.3-70b-versatile',
      'llama-3.1-8b-instant',
      'mixtral-8x7b-32768',
      'gemma2-9b-it'
    ];

    let response;
    let data;
    let success = false;
    let lastError = '';
    let usedModel = '';

    for (const model of FALLBACK_MODELS) {
      try {
        response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${groqKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: model,
            messages: groqMessages,
            max_tokens: 400,
            temperature: 0.7,
          }),
        });

        if (response.ok) {
          data = await response.json();
          success = true;
          usedModel = model;
          break;
        } else {
          lastError = await response.text();
          console.warn(`[Secretary] Modelo ${model} falló. Probando siguiente...`);
        }
      } catch (err) {
        console.warn(`[Secretary] Error de red con modelo ${model}. Probando siguiente...`);
      }
    }

    if (!success || !data) {
      console.error('Todos los modelos de Groq fallaron en secretary-chat. Último error:', lastError);
      return NextResponse.json({ error: 'Nuestros servidores están muy ocupados. Inténtalo de nuevo.' }, { status: 500 });
    }

    const reply = data.choices?.[0]?.message?.content ?? '';
    console.log(`[Secretary] Respuesta generada con éxito usando: ${usedModel}`);

    // Detectar si el reply contiene un JSON de resumen final
    let isSummary = false;
    let summaryText = '';
    try {
      const jsonMatch = reply.match(/\{[\s\S]*"type"\s*:\s*"summary"[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.type === 'summary' && parsed.readyToClose) {
          isSummary = true;
          summaryText = parsed.text;
        }
      }
    } catch (_) { /* no es JSON, es texto normal */ }

    return NextResponse.json({
      reply: isSummary ? summaryText : reply,
      isSummary,
      summaryText: isSummary ? summaryText : null,
    });

  } catch (error) {
    console.error('API /secretary-chat error:', error);
    return NextResponse.json({ error: 'Error procesando la solicitud' }, { status: 500 });
  }
}
