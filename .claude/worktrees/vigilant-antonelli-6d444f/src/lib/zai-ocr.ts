// Z.ai GLM-4.6V-Flash OCR - Motor de análisis de cuadrantes de la Guardia Civil
// Llamada directa a Z.ai API (funciona tanto en web como en móvil/Capacitor)

const ZAI_API_KEY = "1bdabb5b5aa74056b675415c4e24a8a9.Eleh6rSO6x43XSOH";
const ZAI_API_URL = "https://api.z.ai/api/paas/v4/chat/completions";
const MODEL = "glm-4.6v-flash";

export interface UserShiftResult {
    found: boolean;
    date: string;
    targetName: string;
    shift: string;
    service?: string;
    startTime: string;
    endTime: string;
    colleagues: string[];
    rawContext: string;
}

export interface RosterColumn {
    title: string;
    names: string[];
    xStart?: number;
    xEnd?: number;
}

export interface DigitalRoster {
    date: string;
    columns: RosterColumn[];
    rawText: string;
}

/**
 * Llama directamente a la API de Z.ai (sin proxy intermedio)
 */
export async function callZaiVision(base64Image: string, prompt: string): Promise<{ content: string; tokens: number }> {
    // Determine mime type
    let mimeType = 'image/jpeg';
    let pureBase64 = base64Image;

    if (base64Image.startsWith('data:')) {
        const match = base64Image.match(/data:([^;]+);/);
        if (match) mimeType = match[1];
        pureBase64 = base64Image.split(',')[1] || base64Image;
    }

    const body = {
        model: MODEL,
        messages: [
            {
                role: "user",
                content: [
                    {
                        type: "image_url",
                        image_url: {
                            url: `data:${mimeType};base64,${pureBase64}`
                        }
                    },
                    {
                        type: "text",
                        text: prompt
                    }
                ]
            }
        ],
        max_tokens: 8192,
        temperature: 0.1,
        stream: false
    };

    console.log(`[Z.AI] Enviando imagen (${(pureBase64.length / 1024).toFixed(0)} KB base64) a ${MODEL}...`);

    const response = await fetch(ZAI_API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${ZAI_API_KEY}`
        },
        body: JSON.stringify(body)
    });

    const data = await response.json();

    if (!response.ok) {
        console.error('[Z.AI] API Error:', JSON.stringify(data));
        throw new Error(data.error?.message || `Z.ai API Error ${response.status}`);
    }

    const content = data.choices?.[0]?.message?.content || '';
    const tokens = data.usage?.total_tokens || 0;

    console.log(`[Z.AI] Respuesta recibida: ${tokens} tokens, ${content.length} chars`);
    return { content, tokens };
}

/**
 * Busca a una persona específica en la imagen del cuadrante usando IA de visión.
 */
export async function findUserShiftZai(
    base64Image: string,
    targetName: string
): Promise<UserShiftResult | null> {
    console.log(`[Z.AI] 🔍 Buscando a "${targetName}" con GLM-4.6V-Flash...`);

    const prompt = `Eres un experto analizando cuadrantes/hojas de servicio de la GUARDIA CIVIL de España.

ESTRUCTURA DEL CUADRANTE:
- El documento tiene SECCIONES de servicio (ej: "Servicio Centro Penitenciario", "Servicio en Subdelegación", etc.)
- Cada sección tiene filas con columnas: MAÑANA, TARDE, NOCHE
- Cada columna indica un horario específico (ej: "MAÑANA DE 06 A 14 HORAS", "MAÑANA DE 06 A 11 HORAS", "MAÑANA DE 09 A 14 HORAS")
- Una misma sección puede tener VARIAS filas de mañana con horarios DIFERENTES

INSTRUCCIONES:
1. Lee la FECHA EXACTA del encabezado (busca "MARTES, 17 DE FEBRERO DE 2026" o similar)
2. Busca a "${targetName}" (puede ser nombre, apellido o parte del nombre)
3. Identifica en qué SECCIÓN está (la barra gris con título del servicio)
4. Identifica su columna (Mañana/Tarde/Noche) y su horario exacto
5. IMPORTANTE - COMPAÑEROS: Lista TODAS las personas de la MISMA SECCIÓN que trabajan en el MISMO TURNO GENERAL (Mañana/Tarde/Noche), AUNQUE tengan horarios diferentes. Por ejemplo, si la persona está en "Mañana 06-14", incluye también a los de "Mañana 06-11" y "Mañana 09-14" de la misma sección.

FORMATO DE COMPAÑEROS: Usa el formato "NombreCompleto|HH:MM|HH:MM" para cada compañero, indicando SU horario específico.

REGLAS DE FECHA:
- Lee la fecha EXACTAMENTE como aparece en el documento
- Formato: YYYY-MM-DD

RESPONDE SOLO CON JSON VÁLIDO (sin markdown, sin \`\`\`):
Si ENCUENTRAS a la persona:
{"found":true,"date":"YYYY-MM-DD","targetName":"NOMBRE COMPLETO","service":"NOMBRE SECCIÓN","shift":"MAÑANA|TARDE|NOCHE","startTime":"HH:MM","endTime":"HH:MM","colleagues":["Nombre Apellido|06:00|11:00","Otro Nombre|09:00|14:00"]}

Si NO la encuentras:
{"found":false,"date":"YYYY-MM-DD","targetName":"${targetName}","service":"","shift":"","startTime":"","endTime":"","colleagues":[]}`;

    try {
        const { content, tokens } = await callZaiVision(base64Image, prompt);

        if (!content) {
            console.error('[Z.AI] No content in response');
            return null;
        }

        // Parse JSON from response (may have ```json wrapper)
        let jsonStr = content.trim();
        jsonStr = jsonStr.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();

        const result = JSON.parse(jsonStr);
        console.log(`[Z.AI] ✅ Resultado:`, result);

        return {
            found: result.found ?? false,
            date: result.date || new Date().toISOString().split('T')[0],
            targetName: result.targetName || targetName,
            shift: result.shift || '',
            service: result.service || '',
            startTime: result.startTime || '',
            endTime: result.endTime || '',
            colleagues: result.colleagues || [],
            rawContext: `Z.ai GLM-4.6V-Flash | Tokens: ${tokens}`
        };
    } catch (error: any) {
        console.error('[Z.AI] Error:', error.message);
        return null;
    }
}

/**
 * Escaneo completo del cuadrante sin buscar nombre específico.
 */
export async function scanFullRosterZai(base64Image: string): Promise<DigitalRoster | null> {
    console.log('[Z.AI] 📋 Escaneando cuadrante completo con GLM-4.6V-Flash...');

    const prompt = `Eres un experto analizando cuadrantes/hojas de servicio de la GUARDIA CIVIL de España.

Analiza esta imagen de cuadrante completa y extrae TODA la información.

REGLAS:
1. Lee la FECHA EXACTA del encabezado (busca "DÍA XX DE MES DE AÑO")
2. Para CADA sección de servicio, identifica las columnas (Mañana, Tarde, Noche)
3. Lista TODOS los nombres en cada columna

RESPONDE SOLO CON JSON VÁLIDO (sin markdown, sin \`\`\`):
{
  "date": "YYYY-MM-DD",
  "columns": [
    {"title": "MAÑANA - Centro Penitenciario", "names": ["G.C. D. Nombre Apellido", ...]},
    {"title": "TARDE - Centro Penitenciario", "names": [...]},
    {"title": "NOCHE - Centro Penitenciario", "names": [...]},
    {"title": "MAÑANA - Subdelegación", "names": [...]},
    ...
  ]
}

IMPORTANTE: Combina sección+turno en el título de cada columna para mayor claridad.`;

    try {
        const { content, tokens } = await callZaiVision(base64Image, prompt);
        if (!content) return null;

        let jsonStr = content.trim();
        jsonStr = jsonStr.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();

        const result = JSON.parse(jsonStr);

        return {
            date: result.date || new Date().toISOString().split('T')[0],
            columns: (result.columns || []).map((col: any) => ({
                title: col.title || 'Sin título',
                names: col.names || [],
                xStart: 0,
                xEnd: 0
            })),
            rawText: `Analizado por Z.ai GLM-4.6V-Flash | Tokens: ${tokens}`
        };
    } catch (error: any) {
        console.error('[Z.AI] Error escaneo completo:', error.message);
        return null;
    }
}

// ============================================================
// Screenshot → Events: Extracción de eventos de capturas de pantalla
// ============================================================

export interface ExtractedEvent {
    title: string;
    date: string;
    time: string;
    description: string;
    source: string;
    confidence: number;
}

/**
 * Analiza una captura de pantalla de un mensaje (email, WhatsApp, etc.)
 * y extrae los eventos/tareas con fechas para meterlos en el calendario.
 */
export async function analyzeScreenshotForEvents(
    base64Image: string,
    referenceDate?: string
): Promise<ExtractedEvent[]> {
    const today = referenceDate || new Date().toISOString().split('T')[0];
    const dayOfWeek = new Date(today).toLocaleDateString('es-ES', { weekday: 'long' });

    console.log(`[Z.AI] 📸 Analizando screenshot para eventos (ref: ${today}, ${dayOfWeek})...`);

    const prompt = `Eres un experto extrayendo EVENTOS y TAREAS de capturas de pantalla de mensajes.

CONTEXTO:
- Fecha de hoy: ${today} (${dayOfWeek})
- El mensaje puede ser de: email del colegio, WhatsApp de profesores, notificaciones de Web Familia, Gmail, etc.

INSTRUCCIONES:
1. Lee TODO el texto visible en la imagen
2. Identifica CADA evento, prueba, examen, reunión, entrega o tarea mencionada
3. Extrae la FECHA EXACTA. Si dice "el próximo lunes" calcula la fecha real basándote en que hoy es ${today} (${dayOfWeek})
4. Si dice "miércoles y jueves" son DOS eventos separados, uno por cada día
5. Si no hay hora específica, pon "09:00" por defecto
6. Identifica quién envía el mensaje (profesor, tutor, etc.)
7. Extrae los detalles relevantes (páginas del libro, material necesario, temario, etc.)

REGLAS DE FECHAS:
- "el próximo lunes" = calcular el lunes siguiente a ${today}
- "lunes 16 de febrero" = 2026-02-16
- "miércoles y jueves" = dos eventos con fechas diferentes
- Formato SIEMPRE: YYYY-MM-DD
- El año actual es ${today.substring(0, 4)}

RESPONDE SOLO CON JSON VÁLIDO (sin markdown, sin \`\`\`):
{
  "events": [
    {
      "title": "Título descriptivo del evento",
      "date": "YYYY-MM-DD",
      "time": "HH:MM",
      "description": "Detalles: páginas, material, temario, etc.",
      "source": "Nombre del remitente o institución",
      "confidence": 85
    }
  ]
}

Si NO encuentras ningún evento con fecha, responde:
{"events": []}`;

    try {
        const { content, tokens } = await callZaiVision(base64Image, prompt);

        if (!content) {
            console.error('[Z.AI] No content in response');
            return [];
        }

        let jsonStr = content.trim();
        jsonStr = jsonStr.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();

        const result = JSON.parse(jsonStr);
        console.log(`[Z.AI] ✅ Eventos detectados: ${result.events?.length || 0}`, result);

        return (result.events || []).map((evt: any) => ({
            title: evt.title || 'Evento sin título',
            date: evt.date || today,
            time: evt.time || '09:00',
            description: evt.description || '',
            source: evt.source || '',
            confidence: evt.confidence || 50,
        }));
    } catch (error: any) {
        console.error('[Z.AI] Error analizando screenshot:', error.message);
        return [];
    }
}
