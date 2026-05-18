import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { checkApiLimit, getAuthUser, recordApiUsage } from '@/lib/api-limit';

const GROQ_API_KEY = process.env.GROQ_API_KEY || process.env.NEXT_PUBLIC_GROQ_API_KEY || '';
const GROQ_MODEL = 'llama-3.3-70b-versatile';



const PROMPT = `Eres un experto en extractos bancarios españoles y europeos. Analiza el siguiente texto y extrae todas las transacciones.
Devuelve únicamente un JSON array válido con elementos de este tipo:
{"date":"YYYY-MM-DD","description":"texto descriptivo","amount":123.45}
Importe positivo = ingreso. Importe negativo = gasto.`;

async function callGroq(textForAI: string) {
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [
        { role: 'system', content: PROMPT },
        { role: 'user', content: textForAI },
      ],
      temperature: 0.1,
      max_tokens: 2500,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Groq API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

function parseAIResponse(content: string) {
  const cleaned = content.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');

  try {
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) {
      return parsed;
    }
  } catch {
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  }

  throw new Error('No se encontró JSON válido en la respuesta de la IA');
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: 'No autenticado.' }, { status: 401 });
    }

    const limitCheck = await checkApiLimit(user.id, user.email || null, 'parse-bank-statement');
    if (!limitCheck.allowed) {
      return NextResponse.json(
        {
          error: `Has alcanzado el límite mensual de ${limitCheck.limit} usos para esta función. (Usados: ${limitCheck.used}/${limitCheck.limit})`,
          used: limitCheck.used,
          limit: limitCheck.limit,
        },
        { status: 429 }
      );
    }

    if (!GROQ_API_KEY) {
      return NextResponse.json({ error: 'Falta configurar GROQ_API_KEY en el servidor.' }, { status: 500 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No se ha subido ningún archivo.' }, { status: 400 });
    }

    const fileName = file.name.toLowerCase();
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    let extractedText = '';

    if (fileName.endsWith('.pdf')) {
      const PDFParser = (await import('pdf2json')).default;
      // Using "as any" to bypass recent TypeScript definition updates in pdf2json
      const pdfParser = new (PDFParser as any)(null, 1); // 1 = raw text mode
      
      extractedText = await new Promise<string>((resolve, reject) => {
        pdfParser.on("pdfParser_dataError", (errData: any) => reject(new Error(errData.parserError)));
        pdfParser.on("pdfParser_dataReady", () => resolve(pdfParser.getRawTextContent().replace(/\r\n/g, ' ')));
        pdfParser.parseBuffer(buffer);
      });
    } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls') || fileName.endsWith('.csv')) {
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      extractedText = XLSX.utils.sheet_to_csv(sheet, { FS: ' | ', RS: '\n' });
    } else {
      return NextResponse.json({ error: 'Formato no soportado. Usa PDF, XLSX, XLS o CSV.' }, { status: 400 });
    }

    if (extractedText.trim().length < 20) {
      return NextResponse.json(
        { error: 'No se pudo extraer texto del archivo. ¿Está vacío o es un PDF de imagen?' },
        { status: 400 }
      );
    }

    // Limit text to roughly ~5500 tokens (approx 22,000 characters)
    // We slice from the END to prioritize parsing the most recent transactions
    if (extractedText.length > 22000) {
      console.warn(`[Parse Bank Statement] Truncating text from ${extractedText.length} to 22000 chars to avoid TPM limit.`);
      extractedText = extractedText.slice(-22000);
    }

    console.log(`[Parse Bank Statement] Extracted ${extractedText.length} chars from ${fileName}, sending to Groq...`);
    const rawResponse = await callGroq(extractedText);
    const transactions = parseAIResponse(rawResponse)
      .filter((tx: any) => tx.date && tx.description && tx.amount !== undefined)
      .map((tx: any) => ({
        date: String(tx.date),
        description: String(tx.description).slice(0, 200),
        amount: typeof tx.amount === 'number' ? tx.amount : parseFloat(String(tx.amount).replace(',', '.')) || 0,
      }));

    if (transactions.length === 0) {
      return NextResponse.json({ error: 'No se detectaron movimientos en el archivo.' }, { status: 400 });
    }

    await recordApiUsage(user.id, 'parse-bank-statement');

    return NextResponse.json({
      transactions,
      count: transactions.length,
      source: fileName,
      provider: 'groq',
    });
  } catch (error: any) {
    console.error('[Parse Bank Statement] Error:', error);
    return NextResponse.json({ error: error.message || 'Error interno del servidor' }, { status: 500 });
  }
}
