import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// Detecta qué módulos son relevantes para el mensaje del usuario
function detectNeededModules(userMsg: string): Set<string> {
  const msg = userMsg.toLowerCase();
  const modules = new Set<string>();
  modules.add('base');

  if (/tarea|pendiente|todo|hacer|completar/.test(msg)) modules.add('tasks');
  if (/compr|mercado|supermercado/.test(msg)) modules.add('shopping');
  if (/dinero|saldo|gast|ahorro|finanz|euro|€|cuenta|sobre|presupuesto/.test(msg)) modules.add('finance');
  if (/turno|trabajo|jornada|guardia|horario/.test(msg)) modules.add('shifts');
  if (/medicin|pastilla|fármaco|medicación|dosis/.test(msg)) modules.add('medicines');
  if (/manual|avería|hogar|casa|instrucción|mantenimiento/.test(msg)) modules.add('manuals');
  if (/contraseña|password|bóveda|clave/.test(msg)) modules.add('passwords');
  if (/sync|balance|día|victoria|logro|cómo ha ido/.test(msg)) modules.add('sync');
  if (/conocimiento|aprendido|enseñado|recuerdas/.test(msg)) modules.add('knowledge');

  // Mensaje general → incluir resumen básico
  if (modules.size <= 1) {
    modules.add('tasks');
    modules.add('finance');
    modules.add('sync');
  }

  return modules;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    let { messages, userId, secretarySettings, todaySyncStatus } = body as {
      messages: Message[];
      userId: string;
      secretarySettings?: any;
      todaySyncStatus?: any;
    };

    const groqKey = process.env.GROQ_API_KEY;
    if (!groqKey) return NextResponse.json({ error: 'Falta GROQ_API_KEY' }, { status: 500 });
    if (!userId) return NextResponse.json({ error: 'Falta userId' }, { status: 400 });

    const lastUserMsg = messages.findLast(m => m.role === 'user')?.content || '';
    const needed = detectNeededModules(lastUserMsg);

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const today = new Date().toISOString().split('T')[0];

    // Solo consultamos lo que necesitamos (consultas paralelas)
    const queries: any[] = [];
    const queryKeys: string[] = [];

    if (needed.has('tasks')) {
      queries.push(supabase.from('tasks').select('title,due_date').eq('user_id', userId).eq('is_completed', false).limit(5));
      queryKeys.push('tasks');
    }
    if (needed.has('shopping')) {
      queries.push(supabase.from('shopping_items').select('name,quantity').eq('user_id', userId).eq('is_checked', false).limit(8));
      queryKeys.push('shopping');
    }
    if (needed.has('finance')) {
      queries.push(supabase.from('savings_accounts').select('name,current_balance').eq('user_id', userId));
      queries.push(supabase.from('expenses').select('title,amount').eq('user_id', userId).gte('date', `${today.substring(0, 7)}-01`).order('date', { ascending: false }).limit(3));
      queryKeys.push('savings', 'expenses');
    }
    if (needed.has('shifts')) {
      queries.push(supabase.from('work_shifts').select('title,start_time,end_time').eq('user_id', userId).gte('start_time', today).limit(3));
      queryKeys.push('shifts');
    }
    if (needed.has('medicines')) {
      queries.push(supabase.from('medicines').select('name,dosage,frequency').eq('user_id', userId).limit(5));
      queryKeys.push('medicines');
    }
    if (needed.has('manuals')) {
      queries.push(supabase.from('manuals').select('title,category,content').eq('user_id', userId).limit(3));
      queryKeys.push('manuals');
    }
    if (needed.has('passwords')) {
      queries.push(supabase.from('passwords').select('id,name').eq('user_id', userId));
      queryKeys.push('passwords');
    }
    if (needed.has('sync') && !todaySyncStatus) {
      queries.push(supabase.from('secretary_syncs').select('completed_at,victories').eq('user_id', userId).eq('sync_date', today).maybeSingle());
      queryKeys.push('sync');
    }

    const results = await Promise.all(queries);
    const dataMap: Record<string, any> = {};
    queryKeys.forEach((key, i) => { dataMap[key] = results[i]?.data; });

    if (needed.has('sync') && !todaySyncStatus && dataMap['sync']) {
      todaySyncStatus = dataMap['sync'];
    }

    // Conocimiento (solo si relevante)
    let knowledge: { title: string; content: string }[] = [];
    let globalKnowledge: { title: string; content: string; category?: string }[] = [];

    if (needed.has('knowledge') || needed.size <= 4) {
      try {
        const { data } = await supabase.from('ai_knowledge').select('title,content').eq('user_id', userId).order('created_at', { ascending: false }).limit(5);
        knowledge = data || [];
      } catch { /* tabla no existe */ }

      try {
        const { data } = await supabase.from('ai_global_knowledge').select('title,content,category').order('created_at', { ascending: false }).limit(8);
        globalKnowledge = data || [];
      } catch { /* tabla no existe */ }
    }

    // ── Construir prompt compacto ──────────────────────────────────────
    const personality = secretarySettings?.personality || 'friendly';
    const traitsMap: Record<string, string> = {
      formal: 'Profesional y elegante. Sin exceso de emojis.',
      friendly: 'Amable, cercana. Usa emojis. Tono informal.',
      sergeant: 'Directa, breve, autoritaria. Sin rodeos.',
    };
    const trait = traitsMap[personality] || traitsMap.friendly;

    const parts: string[] = [];

    // Fecha y sync
    const dateStr = new Date().toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
    const syncStr = todaySyncStatus
      ? `Sync:${todaySyncStatus.completed_at ? '✅' : '🌙'}${todaySyncStatus.victories?.length ? ` victorias:${todaySyncStatus.victories.join('/')}` : ''}`
      : 'Sync:🌙pendiente';
    parts.push(`HOY:${dateStr} ${syncStr}`);

    // Finanzas
    if (needed.has('finance')) {
      const bal = (dataMap['savings'] as any[] || []).reduce((s: number, a: any) => s + (a.current_balance || 0), 0);
      const spent = (dataMap['expenses'] as any[] || []).reduce((s: number, e: any) => s + (e.amount || 0), 0);
      const lastExp = (dataMap['expenses'] as any[] || []).slice(0, 3).map((e: any) => `${e.title}:${e.amount}€`).join(',');
      parts.push(`FINANZAS:saldo=${bal.toFixed(0)}€ mes=${spent.toFixed(0)}€${lastExp ? ` últimos:${lastExp}` : ''}`);
    }

    // Tareas
    if (needed.has('tasks')) {
      const t = (dataMap['tasks'] as any[] || []);
      parts.push(t.length ? `TAREAS(${t.length}):${t.map((x: any) => x.title + (x.due_date ? `[${x.due_date}]` : '')).join('|')}` : 'TAREAS:ninguna');
    }

    // Compra
    if (needed.has('shopping')) {
      const s = (dataMap['shopping'] as any[] || []);
      parts.push(s.length ? `COMPRA(${s.length}):${s.map((x: any) => x.name + (x.quantity ? `×${x.quantity}` : '')).join('|')}` : 'COMPRA:vacía');
    }

    // Turnos
    if (needed.has('shifts')) {
      const sh = (dataMap['shifts'] as any[] || []);
      if (sh.length) parts.push(`TURNOS:${sh.map((x: any) => { const d = new Date(x.start_time); return `${x.title} ${d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })} ${d.getHours()}h`; }).join('|')}`);
    }

    // Medicación
    if (needed.has('medicines')) {
      const m = (dataMap['medicines'] as any[] || []);
      if (m.length) parts.push(`MED:${m.map((x: any) => x.name + (x.dosage ? ` ${x.dosage}` : '')).join('|')}`);
    }

    // Manuales (solo títulos)
    if (needed.has('manuals')) {
      const mn = (dataMap['manuals'] as any[] || []);
      if (mn.length) parts.push(`MANUALES:${mn.map((x: any) => x.title).join('|')}`);
    }

    // Contraseñas
    if (needed.has('passwords')) {
      const pw = (dataMap['passwords'] as any[] || []);
      if (pw.length) parts.push(`CLAVES:${pw.map((x: any) => `${x.name}(ID:${x.id})`).join('|')}`);
    }

    // Conocimiento global
    if (globalKnowledge.length > 0) {
      parts.push(`INFO_QUIOBA:\n${globalKnowledge.map(k => `[${k.title}]: ${k.content}`).join('\n---\n')}`);
    }

    // Conocimiento del usuario
    if (knowledge.length > 0) {
      parts.push(`SABE:\n${knowledge.map(k => `[${k.title}]: ${k.content}`).join('\n---\n')}`);
    }

    const systemPrompt = `Eres Quioba, asistente personal IA. Responde SIEMPRE con JSON válido. ${trait} Idioma: español. No menciones modelos de IA. Nunca cites nombres propios de personas del conocimiento inyectado.

REGLA FUNDAMENTAL — BASA TODO EN LOS DATOS REALES:
- Usa TODA la información del bloque DATOS para construir tus respuestas.
- Si el usuario pide un plan, recomendación o resumen, créalo extrayendo y organizando lo que hay en los DATOS, aunque sea poco.
- Si los datos son escasos, sé transparente: indícalo brevemente y trabaja con lo que tienes ("Con los datos que tengo hasta ahora...").
- NUNCA inventes datos concretos que no estén en el bloque DATOS: no añadas números, nombres, fechas, calorías, precios ni detalles específicos que no aparezcan allí.
- Si no tienes absolutamente ningún dato relevante sobre lo que pide el usuario, responde: {"type":"text","content":"Aún no tengo información sobre eso registrada. Puedes añadirla desde la app para que pueda ayudarte mejor."}

DATOS REALES DEL USUARIO: ${parts.join(' || ')}

SYNC: si el usuario pide sync/balance del día, guíale conversacionalmente y tras 3-4 msgs usa tipo "summary".

JSON obligatorio:
{"type":"text","content":"..."} para respuestas normales
{"type":"list","title":"...","icon":"🛒","items":[{"icon":"✅","text":"..."}]} para listas
{"type":"password_request","name":"servicio","id":"ID_EXACTO"} para contraseñas
{"type":"summary","text":"resumen 2 frases","readyToClose":true} para cerrar sync`;

    const groqMessages: Message[] = [
      { role: 'system', content: systemPrompt },
      ...messages.slice(-6),
    ];

    const FALLBACK_MODELS = [
      'llama-3.3-70b-versatile',
      'llama-3.1-8b-instant'
    ];

    let data;
    let lastError = '';
    let usedModel = '';

    for (const model of FALLBACK_MODELS) {
      try {
        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${groqKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model,
            messages: groqMessages,
            max_tokens: 400,
            temperature: 0.7,
          }),
        });

        if (res.ok) {
          data = await res.json();
          usedModel = model;
          break;
        } else {
          lastError = await res.text();
          console.warn(`Modelo ${model} falló. Probando siguiente...`);
        }
      } catch (err) {
        console.warn(`Error de red con modelo ${model}.`);
      }
    }

    if (!data) {
      console.error('Todos los modelos fallaron. Último error:', lastError);
      return NextResponse.json({ error: 'Nuestros servidores de IA están muy ocupados. Inténtalo en unos segundos.' }, { status: 500 });
    }

    let rawReply = data.choices?.[0]?.message?.content ?? '{"type":"text","content":"Lo siento, no pude procesar tu mensaje."}';
    let reply = rawReply;
    try {
      JSON.parse(reply);
    } catch {
      const match = reply.match(/```(?:json)?\n([\s\S]*?)\n```/);
      if (match) {
        reply = match[1];
      } else {
        const firstIdx = reply.indexOf('{');
        const lastIdx = reply.lastIndexOf('}');
        if (firstIdx !== -1 && lastIdx !== -1) {
          reply = reply.substring(firstIdx, lastIdx + 1);
        } else {
          reply = JSON.stringify({ type: 'text', content: rawReply });
        }
      }
    }
    console.log(`✅ Respuesta OK con modelo: ${usedModel}`);

    return NextResponse.json({ reply });

  } catch (error) {
    console.error('API /ai-chat error:', error);
    return NextResponse.json({ error: 'Error procesando la solicitud' }, { status: 500 });
  }
}
