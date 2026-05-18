import { NextRequest, NextResponse } from 'next/server';
import { checkApiLimit, getAuthUser, recordApiUsage } from '@/lib/api-limit';

export const runtime = 'nodejs';

const OPENROUTER_MODEL = 'meta-llama/llama-3.3-70b-instruct';
const ALLOWED_CATEGORIES = ['Electrodoméstico', 'Climatización', 'Mobiliario', 'Vehículo', 'Tecnología', 'Otros'];
const MIN_EXTRACTED_TEXT_LENGTH = 10;

type AssetAnalysis = {
    title: string;
    category: string;
    date: string | null;
    price: number | null;
    store: string | null;
    warranty_years: number;
    summary: string;
    confidence: number;
    extracted_text_preview?: string;
};

// ========================
// FALLBACK EXTRACCIÓN (Regex)
// ========================

function sanitizeText(value: string | null | undefined) {
    return value?.trim() || null;
}

function normalizeDate(value: string | null | undefined) {
    if (!value) return null;
    const trimmed = value.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
    const slashMatch = trimmed.match(/^(\d{2})[\/.-](\d{2})[\/.-](\d{4})$/);
    if (slashMatch) {
        const [, day, month, year] = slashMatch;
        return `${year}-${month}-${day}`;
    }
    return null;
}

function extractAmountFallback(text: string): number | null {
    const lines = text.split('\n');
    let maxAmount = 0;
    for (const line of lines) {
        const match = line.match(/\b(\d+)[.,](\d{2})\b/g);
        if (match) {
            match.forEach(m => {
                const val = parseFloat(m.replace(',', '.'));
                if (val > maxAmount && val < 50000) maxAmount = val;
            });
        }
    }
    return maxAmount > 0 ? maxAmount : null;
}

function extractDateFallback(text: string) {
    const matches = text.match(/\b(\d{2}[\/.-]\d{2}[\/.-]\d{4}|\d{4}[\/.-]\d{2}[\/.-]\d{2})\b/g) || [];
    return [...new Set(matches)][0] || null;
}

function buildFallbackAnalysis(fileName: string, extractedText: string): AssetAnalysis {
    const lower = `${fileName} ${extractedText}`.toLowerCase();

    let category = 'Otros';
    if (/(frigorifico|nevera|lavadora|horno|microondas|lavavajillas|thermomix|cafetera)/.test(lower)) category = 'Electrodoméstico';
    else if (/(aire|acondicionado|caldera|estufa|calefactor|radiador)/.test(lower)) category = 'Climatización';
    else if (/(sofa|silla|mesa|colchon|armario|ikea)/.test(lower)) category = 'Mobiliario';
    else if (/(televisor|tv|ordenador|pc|portatil|tablet|movil|auriculares)/.test(lower)) category = 'Tecnología';
    else if (/(coche|moto|bicicleta|patinete)/.test(lower)) category = 'Vehículo';

    let rawTitle = fileName.replace(/\.[^/.]+$/, '').replace(/[-_]+/g, ' ').trim();
    if (rawTitle.length < 3 || rawTitle.includes('ticket') || rawTitle.includes('receipt') || rawTitle.includes('image')) {
        const topWords = extractedText.split('\n')[0].replace(/[^a-zA-Z ]/g, '').trim();
        rawTitle = topWords.length > 3 ? topWords : 'Activo Desconocido';
    }

    const title = rawTitle.charAt(0).toUpperCase() + rawTitle.slice(1);
    const price = extractAmountFallback(extractedText);
    const date = normalizeDate(extractDateFallback(extractedText));

    return {
        title: title.slice(0, 50),
        category,
        price,
        date,
        store: title.slice(0, 40),
        warranty_years: 3, // Default EU warranty
        summary: extractedText.trim().slice(0, 100),
        confidence: extractedText.trim() ? 0.4 : 0.1,
        extracted_text_preview: extractedText.slice(0, 400),
    };
}

// ========================
// IA & OCR SERVICES
// ========================

function normalizeAnalysis(data: any, fallback: AssetAnalysis): AssetAnalysis {
    const category = ALLOWED_CATEGORIES.includes(data?.category) ? data.category : fallback.category;
    const date = normalizeDate(data?.date) || fallback.date || null;
    const confidence = typeof data?.confidence === 'number'
        ? Math.max(0, Math.min(1, data.confidence))
        : fallback.confidence;

    let price = typeof data?.price === 'number' ? data.price : fallback.price;
    if (typeof data?.price === 'string') {
        const parsedAmount = parseFloat(data.price.replace(',', '.'));
        if (!isNaN(parsedAmount)) price = parsedAmount;
    }

    return {
        title: typeof data?.title === 'string' && data.title.trim() ? data.title.trim() : fallback.title,
        category,
        price,
        date,
        store: sanitizeText(data?.store) || fallback.store,
        warranty_years: typeof data?.warranty_years === 'number' ? data.warranty_years : fallback.warranty_years,
        summary: typeof data?.summary === 'string' && data.summary.trim() ? data.summary.trim() : fallback.summary,
        confidence,
        extracted_text_preview: fallback.extracted_text_preview,
    };
}

function extractJson(text: string) {
    try {
        return JSON.parse(text);
    } catch {
        const match = text.match(/\{[\s\S]*\}/);
        if (!match) return null;
        try {
            return JSON.parse(match[0]);
        } catch {
            return null;
        }
    }
}

async function extractTextWithOcrSpace(fileLike: Blob, fileName: string) {
    const formData = new FormData();
    formData.append('file', fileLike, fileName);
    formData.append('language', 'spa');
    formData.append('isOverlayRequired', 'false');
    formData.append('OCREngine', '2'); // Engine 2 is better for receipts
    formData.append('isCreateSearchablePdf', 'false');

    const response = await fetch('https://api.ocr.space/parse/image', {
        method: 'POST',
        headers: {
            apikey: process.env.OCR_SPACE_API_KEY || 'helloworld',
        },
        body: formData,
    });

    if (!response.ok) {
        throw new Error(`OCR.space API error: ${await response.text()}`);
    }

    const data = await response.json();

    if (data?.IsErroredOnProcessing) {
        const details = Array.isArray(data?.ErrorMessage) ? data.ErrorMessage.join(' ') : data?.ErrorMessage;
        throw new Error(details || 'OCR.space no pudo procesar el archivo.');
    }

    const parsedText = Array.isArray(data?.ParsedResults)
        ? data.ParsedResults.map((item: any) => item?.ParsedText || '').join('\n')
        : '';

    return parsedText.trim();
}

async function analyzeWithOpenRouter(fileName: string, extractedText: string) {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://quioba.com',
            'X-Title': 'Quioba Asset Parser',
        },
        body: JSON.stringify({
            model: OPENROUTER_MODEL,
            temperature: 0.1,
            max_tokens: 500,
            response_format: { type: 'json_object' },
            messages: [
                {
                    role: 'system',
                    content: `Eres un asistente inteligente para extracción de datos patrimoniales desde tickets de compra o pegatinas de características.
Debes extraer la información clave para registrar un electrodoméstico o activo en una bóveda patrimonial.
Determina el Titular de forma precisa indicando Marca y Modelo (ej. 'Samsung Galaxy S24' o 'Lavadora Balay 3TS994').
Extrae el precio total EXACTO en formato numérico (price).
Busca fechas de compra (date) y si el texto menciona "garantía 3 años", plásmalo en warranty_years (sino pon 3 por la ley Europea actual o 2 por la antigua).
Determina la categoría (category) de la lista. Identifica la tienda (store).
Responde en JSON estricto con este esquema exacto:
{
  "title": "Marca y Modelo (string breve)",
  "category": "Electrodoméstico|Climatización|Mobiliario|Vehículo|Tecnología|Otros",
  "price": number,
  "date": "YYYY-MM-DD o null",
  "store": "Nombre tienda o null",
  "warranty_years": number (entero, ej 3),
  "summary": "Breve descripción general del activo. DEBES incluir una sugerencia predictiva de mantenimiento (Ej: 'Requiere descalcificación cada 3 meses' o 'Limpiar filtros semestralmente')",
  "confidence": float (0.0 a 1.0)
}`,
                },
                {
                    role: 'user',
                    content: `Nombre original: ${fileName}\n\nTexto de activo extraído por OCR:\n${extractedText.slice(0, 14000)}`,
                },
            ],
        }),
    });

    if (!response.ok) {
        throw new Error(`OpenRouter API error: ${await response.text()}`);
    }

    const data = await response.json();
    return data?.choices?.[0]?.message?.content || '';
}

export async function POST(request: NextRequest) {
    try {
        const user = await getAuthUser(request);
        if (!user) {
            return NextResponse.json({ error: 'No autenticado.' }, { status: 401 });
        }

        const limitCheck = await checkApiLimit(user.id, user.email || null, 'expense-analysis'); // Using same quota as expenses
        if (!limitCheck.allowed) {
            return NextResponse.json(
                {
                    error: `Has alcanzado el límite mensual de ${limitCheck.limit} escaneos. (${limitCheck.used}/${limitCheck.limit})`,
                },
                { status: 429 }
            );
        }

        const formData = await request.formData();
        const file = formData.get('file');

        if (!(file instanceof File)) {
            return NextResponse.json({ error: 'No se ha enviado ningún archivo.' }, { status: 400 });
        }

        const fileName = file.name || 'manual';
        const fileType = file.type || '';
        const isPdf = fileType.includes('pdf') || fileName.toLowerCase().endsWith('.pdf');
        const isImage = fileType.startsWith('image/');

        if (!isImage && !isPdf) {
            return NextResponse.json(
                { error: 'Solo se admiten PNG/JPG o PDF.' },
                { status: 400 }
            );
        }

        let extractedText = '';
        if (isImage || isPdf) { // Note: OCR.space can handle PDFs too mostly
            extractedText = await extractTextWithOcrSpace(file, fileName);
        }

        if (!extractedText || extractedText.trim().length < MIN_EXTRACTED_TEXT_LENGTH) {
            return NextResponse.json(
                { error: 'No se detectó texto en el documento. Asegúrate de que la foto sea nitida.' },
                { status: 422 }
            );
        }

        const fallback = buildFallbackAnalysis(fileName, extractedText);
        let analysis = fallback;

        if (process.env.OPENROUTER_API_KEY) {
            try {
                const content = await analyzeWithOpenRouter(fileName, extractedText);
                const parsed = extractJson(content);
                if (parsed) {
                    analysis = normalizeAnalysis(parsed, fallback);
                }
            } catch (error) {
                console.error('[Asset Analyze] OpenRouter error:', error);
            }
        }

        await recordApiUsage(user.id, 'expense-analysis');

        return NextResponse.json({
            analysis,
            source: isPdf ? 'pdf' : 'image',
            model: process.env.OPENROUTER_API_KEY ? OPENROUTER_MODEL : 'fallback',
        });
    } catch (error: any) {
        console.error('[Asset Analyze] Error:', error);
        return NextResponse.json({ error: error.message || 'Error interno del servidor' }, { status: 500 });
    }
}
