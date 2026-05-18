import { scanRosterImage as scanRosterLocal } from './roster-scanner';

const GROQ_API_KEY = process.env.GROQ_API_KEY || process.env.NEXT_PUBLIC_GROQ_API_KEY || "";
const GROQ_VISION_MODEL = 'llama-3.2-90b-vision-preview';

// Helper to wait between retries
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

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

export async function identifyProduct(base64Image: string): Promise<string | null> {
    if (!GROQ_API_KEY) return null;
    try {
        const base64Data = base64Image.split(',')[1] || base64Image;
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${GROQ_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: GROQ_VISION_MODEL,
                messages: [{
                    role: 'user',
                    content: [
                        { type: 'text', text: "Identifica el producto. SOLO nombre. Ej 'Coca Cola'." },
                        { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64Data}` } },
                    ],
                }],
                temperature: 0.1,
                max_tokens: 50,
            }),
        });
        if (!response.ok) return null;
        const data = await response.json();
        return data.choices?.[0]?.message?.content?.trim() || null;
    } catch (e) { console.error(e); return null; }
}

export async function extractReceiptData(base64Image: string): Promise<any | null> {
    try {
        const response = await fetch('/api/scan-receipt', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ imageBase64: base64Image.includes(',') ? base64Image.split(',')[1] : base64Image })
        });

        if (!response.ok) {
            return null;
        }

        return await response.json();
    } catch (error) {
        console.error('extractReceiptData failed:', error);
        return null;
    }
}

// Helper for Groq Vision API call
async function callGroqVision(base64Image: string, promptText: string): Promise<string> {
    const base64Data = base64Image.split(',')[1] || base64Image;
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${GROQ_API_KEY}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model: GROQ_VISION_MODEL,
            messages: [{
                role: 'user',
                content: [
                    { type: 'text', text: promptText },
                    { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64Data}` } },
                ],
            }],
            temperature: 0.1,
            max_tokens: 4096,
        }),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Groq Vision API Error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || "";
}

export async function scanRosterImage(base64Image: string): Promise<DigitalRoster | null> {
    console.log("Starting Omni-Scan (v5.0 - GROQ): Cloud AI -> Local...");

    // 1. Groq Vision Cloud
    if (GROQ_API_KEY) {
        const prompt = `Analiza esta imagen y genera una REPLICA DIGITAL JSON:
        { "date": "YYYY-MM-DD", "columns": [{ "title": "MAÑANA", "names": ["..."] }] } 
        IGNORA numéricos basura. RESPETA columnas.
        IMPORTANTE: Si hay una sección abajo llamada "SALIENTES DE SERVICIO", crea columnas separadas para ellos con título "SALIENTE [SERVICIO]" (ej. SALIENTE PUERTAS) o inclúyelos con ese prefijo.`;

        try {
            console.log(`Cloud AI Request (Groq ${GROQ_VISION_MODEL})...`);
            const rawText = await callGroqVision(base64Image, prompt);
            const jsonString = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
            const data = JSON.parse(jsonString);

            if (data.date && Array.isArray(data.columns)) {
                return {
                    date: data.date,
                    columns: data.columns,
                    rawText: "Analizado por IA (Groq " + GROQ_VISION_MODEL + ")"
                };
            }
        } catch (error: any) {
            console.warn(`Cloud AI (Groq) failed:`, error.message);
        }
    } else {
        console.warn("Groq API Key missing, skipping Cloud AI.");
    }

    // 2. Fallback to Local Scanner
    console.warn("All Cloud AI models failed. Falling back to Local Engine...");
    try {
        const localResult = await scanRosterLocal(base64Image);
        if (localResult) {
            localResult.rawText = "[MODO SIN CONEXIÓN] La nube falló. Usando motor local.\n" + localResult.rawText;
            return localResult;
        }
    } catch (localError) {
        console.error("Local Fallback failed too:", localError);
    }

    throw new Error("No se pudo procesar la imagen ni en Nube ni en Local.");
}

export interface UserShiftResult {
    found: boolean;
    date: string;
    targetName: string;
    shift: string;
    startTime: string;
    endTime: string;
    colleagues: string[];
    service?: string;
    rawContext: string;
}

export async function findUserShift(base64Image: string, targetName: string): Promise<UserShiftResult | null> {
    console.log(`Starting Detective Mode for agent: ${targetName}`);
    console.log(`[GROQ] API Key present: ${!!GROQ_API_KEY}`);

    let lastError = "";

    // 1. Try Groq Vision Cloud
    if (GROQ_API_KEY) {
        const prompt = `Eres un EXPERTO analizando cuadrantes de la GUARDIA CIVIL de España.

DOCUMENTO: "PREVISIÓN DE SERVICIOS PARA LA MAÑANA-TARDE-NOCHE"
ESTRUCTURA DEL DOCUMENTO:
1. CABECERA: Contiene "COMANDANCIA DE LA GUARDIA CIVIL" y la fecha completa (ej: "30 DE ENERO DE 2026")
2. SECCIONES DE SERVICIO: Barras grises con nombres como:
   - "SERVICIO CENTRO PENITENCIARIO CASTELLÓN"
   - "SERVICIO EN SUBDELEGACIÓN" 
   - "SERVICIO SEGURIDAD EN ACUARTELAMIENTO"
   - "CONDUCCIÓN DE PRESOS/DETENIDOS"
   - "MONITORES"
   - "CURSOS DE FORMACIÓN"
   - "SALIENTES DE SERVICIO" (al final)
3. CADA SECCIÓN tiene 3 COLUMNAS con sus horarios en la cabecera:
   - MAÑANA: "DE 06 A 14 HORAS" o "DE 07 A 14 HORAS"
   - TARDE: "DE 14 A 22 HORAS" o "DE 15 A 22 HORAS"  
   - NOCHE: "DE 22 A 06 HORAS" o "DE 23 A 07 HORAS"
4. NOMBRES: Aparecen como "G.C. D. NOMBRE APELLIDO1 APELLIDO2" o "G.C. Dª. NOMBRE..."

OBJETIVO: Buscar a "${targetName}" en el documento.

INSTRUCCIONES DE BÚSQUEDA:
1. Busca "${targetName}" (puede ser nombre completo o solo un apellido)
2. Si encuentras a la persona, identifica:
   a) En qué SECCIÓN está (la barra gris superior más cercana)
   b) En qué COLUMNA está (MAÑANA, TARDE o NOCHE)
   c) El HORARIO exacto que aparece en la cabecera de esa columna (ej: "DE 06 A 14")
   d) Los otros nombres que están EN LA MISMA COLUMNA de la misma sección

RESPUESTA OBLIGATORIA EN JSON PURO (sin markdown, sin explicación):
{
  "found": true,
  "date": "2026-01-30",
  "targetName": "G.C. D. NOMBRE COMPLETO TAL CUAL APARECE",
  "service": "NOMBRE DE LA SECCIÓN/SERVICIO",
  "shift": "MAÑANA",
  "startTime": "06:00",
  "endTime": "14:00",
  "colleagues": ["G.C. D. COMPAÑERO 1", "G.C. Dª. COMPAÑERA 2"]
}

Si NO encuentras a la persona:
{
  "found": false,
  "date": "2026-01-30",
  "targetName": "${targetName}",
  "shift": "",
  "startTime": "",
  "endTime": "",
  "colleagues": []
}
`;

        try {
            console.log(`[GROQ] Trying vision model: ${GROQ_VISION_MODEL}`);
            const rawText = await callGroqVision(base64Image, prompt);
            console.log(`[GROQ] Raw response:`, rawText);
            const text = rawText.trim().replace(/```json/g, '').replace(/```/g, '').trim();
            console.log(`[GROQ] Cleaned text:`, text);

            const data = JSON.parse(text);
            console.log(`[GROQ] Parsed data:`, JSON.stringify(data, null, 2));
            console.log(`[GROQ] found=${data.found}, shift="${data.shift}", startTime="${data.startTime}", endTime="${data.endTime}"`);
            console.log(`[GROQ] colleagues:`, data.colleagues);

            if (data.found || data.date) {
                const finalResult = { ...data, rawContext: `Groq ${GROQ_VISION_MODEL}` };
                console.log(`[GROQ] ✅ Returning result:`, JSON.stringify(finalResult, null, 2));
                return finalResult;
            }
        } catch (e: any) {
            lastError = e?.message || String(e);
            console.warn(`[GROQ] ❌ Vision model failed:`, lastError);
        }
    } else {
        lastError = "NO API KEY - process.env.GROQ_API_KEY is undefined";
        console.error("[GROQ] ❌", lastError);
    }

    // 2. Fallback: Local Text Search (Expanded)
    console.warn(`Cloud Detective failed (${lastError}). Trying Local Search...`);
    const localScan = await scanRosterLocal(base64Image);

    if (localScan) {
        // A. Search in Columns (Best Case)
        for (const col of localScan.columns) {
            const match = col.names.find(n => n.toUpperCase().includes(targetName.toUpperCase()));
            if (match) {
                const isSaliente = match.includes("(SALIENTE");
                const finalShift = isSaliente ?
                    match.match(/\(SALIENTE ([^)]+)\)/)?.[1] ? `SALIENTE ${match.match(/\(SALIENTE ([^)]+)\)/)?.[1]}` : "SALIENTE DE SERVICIO"
                    : col.title;

                return {
                    found: true,
                    date: localScan.date,
                    targetName: match,
                    shift: finalShift,
                    startTime: "00:00",
                    endTime: "00:00",
                    colleagues: col.names.filter(n => n !== match),
                    rawContext: `Local Search (Columns) - GROQ FALLÓ: ${lastError}`
                };
            }
        }

        // B. Search in Raw Text (Worst Case)
        if (localScan.rawText.toUpperCase().includes(targetName.toUpperCase())) {
            return {
                found: true,
                date: localScan.date,
                targetName: targetName.toUpperCase(),
                shift: "DETECTADO EN TEXTO (Sin estructura clara)",
                startTime: "--:--",
                endTime: "--:--",
                colleagues: ["No se pudieron determinar compañeros"],
                rawContext: "Local Search (Raw Text)"
            };
        }
    }

    return null;
}
