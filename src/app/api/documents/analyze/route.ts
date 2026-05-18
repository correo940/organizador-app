import { NextRequest, NextResponse } from 'next/server';
import { checkApiLimit, getAuthUser, recordApiUsage } from '@/lib/api-limit';

export const runtime = 'nodejs';

const OPENROUTER_MODEL = 'meta-llama/llama-3.3-70b-instruct';
const ALLOWED_CATEGORIES = ['Identidad', 'Vehiculo', 'Seguro', 'Hogar', 'Salud', 'Finanzas', 'Otros'];
const MAX_METADATA_FIELDS = 12;
const MIN_EXTRACTED_TEXT_LENGTH = 20;

type DocumentAnalysis = {
  title: string;
  category: string;
  expiration_date: string | null;
  issuer: string | null;
  summary: string;
  tags: string[];
  confidence: number;
  document_type: string | null;
  metadata: Record<string, string | number | boolean | null>;
  extracted_text_preview?: string;
};

function sanitizeText(value: string | null | undefined) {
  return value?.trim() || null;
}

function detectDates(text: string) {
  const matches = text.match(/\b(\d{2}[\/.-]\d{2}[\/.-]\d{4}|\d{4}[\/.-]\d{2}[\/.-]\d{2})\b/g) || [];
  return [...new Set(matches)].slice(0, 6);
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

function sanitizeMetadata(input: unknown) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {} as Record<string, string | number | boolean | null>;
  return Object.fromEntries(
    Object.entries(input as Record<string, unknown>)
      .filter(([key, value]) => {
        const validType = ['string', 'number', 'boolean'].includes(typeof value) || value === null;
        return key.trim() && validType;
      })
      .slice(0, MAX_METADATA_FIELDS)
      .map(([key, value]) => [key.trim(), value as string | number | boolean | null])
  );
}

function inferDocumentType(category: string, lower: string) {
  if (category === 'Identidad') {
    if (/\bdni\b/.test(lower)) return 'DNI';
    if (/\bnie\b/.test(lower)) return 'NIE';
    if (/pasaporte/.test(lower)) return 'Pasaporte';
    if (/permiso de conducir|carnet/.test(lower)) return 'Carnet de conducir';
    return 'Documento de identidad';
  }
  if (category === 'Vehiculo') {
    if (/itv/.test(lower)) return 'ITV';
    if (/permiso de circulacion/.test(lower)) return 'Permiso de circulacion';
    if (/ficha tecnica/.test(lower)) return 'Ficha tecnica';
    return 'Documento de vehiculo';
  }
  if (category === 'Seguro') return /hogar/.test(lower) ? 'Seguro de hogar' : /salud/.test(lower) ? 'Seguro de salud' : /coche|vehiculo/.test(lower) ? 'Seguro de vehiculo' : 'Poliza';
  if (category === 'Salud') return /receta/.test(lower) ? 'Receta' : /analitica/.test(lower) ? 'Analitica' : /informe/.test(lower) ? 'Informe medico' : 'Documento de salud';
  if (category === 'Finanzas') return /factura/.test(lower) ? 'Factura' : /recibo/.test(lower) ? 'Recibo' : /nomina/.test(lower) ? 'Nomina' : 'Documento financiero';
  if (category === 'Hogar') return /contrato/.test(lower) ? 'Contrato' : /garantia/.test(lower) ? 'Garantia' : /suministro|luz|agua|gas/.test(lower) ? 'Suministro' : 'Documento de hogar';
  return null;
}

function buildMetadataHints(category: string, extractedText: string) {
  const text = extractedText.replace(/\s+/g, ' ').trim();
  const lower = text.toLowerCase();
  const metadata: Record<string, string | number | boolean | null> = {};
  const dates = detectDates(text);

  if (category === 'Identidad') {
    const documentNumber = text.match(/\b\d{8}[A-Z]\b|\b[XYZ]\d{7}[A-Z]\b/i)?.[0] || null;
    const birthDate = normalizeDate(dates[0] || null);
    const expirationDate = normalizeDate(dates[dates.length - 1] || null);
    if (documentNumber) metadata.numero_documento = documentNumber.toUpperCase();
    if (birthDate) metadata.fecha_nacimiento = birthDate;
    if (expirationDate) metadata.fecha_validez = expirationDate;
    metadata.requiere_doble_cara = !/direccion|domicilio|equipo|sexo|valido hasta|soporte/.test(lower);
  }

  if (category === 'Vehiculo') {
    const plate = text.match(/\b\d{4}\s?[A-Z]{3}\b|\b[A-Z]{1,2}-\d{4}-[A-Z]{1,2}\b/i)?.[0] || null;
    const vin = text.match(/\b[A-HJ-NPR-Z0-9]{17}\b/)?.[0] || null;
    if (plate) metadata.matricula = plate.toUpperCase().replace(/\s+/g, ' ');
    if (vin) metadata.bastidor = vin;
    if (dates[0]) metadata.fecha_documento = normalizeDate(dates[0]);
  }

  if (category === 'Seguro') {
    const policy = text.match(/(?:poliza|p\u00f3liza)\s*[:#-]?\s*([A-Z0-9\-\/]+)/i)?.[1] || null;
    const phone = text.match(/\b(?:6|7|8|9)\d{8}\b/)?.[0] || null;
    if (policy) metadata.numero_poliza = policy;
    if (phone) metadata.telefono_asistencia = phone;
  }

  if (category === 'Salud') {
    if (dates[0]) metadata.fecha_documento = normalizeDate(dates[0]);
    const patient = text.match(/paciente\s*:?\s*([A-Z\u00c1\u00c9\u00cd\u00d3\u00da\u00d1\s]{5,})/i)?.[1]?.trim() || null;
    if (patient) metadata.paciente = patient;
  }

  if (category === 'Finanzas') {
    const amount = text.match(/\b\d+[\.,]\d{2}\s?\u20ac\b|\b\u20ac\s?\d+[\.,]\d{2}\b/)?.[0] || null;
    const iban = text.match(/\bES\d{2}[A-Z0-9]{20}\b/i)?.[0] || null;
    if (amount) metadata.importe = amount.replace(/\s+/g, '');
    if (iban) metadata.iban = `${iban.slice(0, 6)}...${iban.slice(-4)}`;
  }

  return sanitizeMetadata(metadata);
}

function buildFallbackAnalysis(fileName: string, extractedText: string): DocumentAnalysis {
  const lower = `${fileName} ${extractedText}`.toLowerCase();

  let category = 'Otros';
  if (/(dni|pasaporte|nie|permiso de conducir|carnet)/.test(lower)) category = 'Identidad';
  else if (/(seguro|poliza|aseguradora)/.test(lower)) category = 'Seguro';
  else if (/(factura|iban|banco|recibo|nomina|impuesto)/.test(lower)) category = 'Finanzas';
  else if (/(salud|medico|clinica|hospital|receta|analitica)/.test(lower)) category = 'Salud';
  else if (/(coche|vehiculo|itv|matricula|circulacion|bastidor)/.test(lower)) category = 'Vehiculo';
  else if (/(hogar|vivienda|alquiler|comunidad|luz|agua|gas|hipoteca|garantia)/.test(lower)) category = 'Hogar';

  const rawTitle = fileName.replace(/\.[^/.]+$/, '').replace(/[-_]+/g, ' ').trim();
  const title = rawTitle ? rawTitle.charAt(0).toUpperCase() + rawTitle.slice(1) : 'Documento';
  const preview = extractedText.trim().slice(0, 240);
  const metadata = buildMetadataHints(category, extractedText);
  const documentType = inferDocumentType(category, lower);
  const expirationFromMetadata = typeof metadata.fecha_validez === 'string' ? normalizeDate(metadata.fecha_validez) : null;

  return {
    title,
    category,
    expiration_date: expirationFromMetadata,
    issuer: null,
    summary: preview ? `Texto detectado: ${preview}` : 'No se pudo resumir automaticamente el documento.',
    tags: documentType ? [category, documentType] : [category],
    confidence: extractedText.trim() ? 0.45 : 0.2,
    document_type: documentType,
    metadata,
    extracted_text_preview: extractedText.slice(0, 400),
  };
}

function normalizeAnalysis(data: any, fallback: DocumentAnalysis): DocumentAnalysis {
  const category = ALLOWED_CATEGORIES.includes(data?.category) ? data.category : fallback.category;
  const expiration = normalizeDate(data?.expiration_date) || fallback.expiration_date || null;
  const tags = Array.isArray(data?.tags)
    ? data.tags.filter((tag: unknown) => typeof tag === 'string').slice(0, 8)
    : fallback.tags;
  const confidence = typeof data?.confidence === 'number'
    ? Math.max(0, Math.min(1, data.confidence))
    : fallback.confidence;
  const metadata = { ...fallback.metadata, ...sanitizeMetadata(data?.metadata) };

  return {
    title: typeof data?.title === 'string' && data.title.trim() ? data.title.trim() : fallback.title,
    category,
    expiration_date: expiration,
    issuer: sanitizeText(data?.issuer) || fallback.issuer,
    summary: typeof data?.summary === 'string' && data.summary.trim() ? data.summary.trim() : fallback.summary,
    tags: tags.length > 0 ? tags : fallback.tags,
    confidence,
    document_type: sanitizeText(data?.document_type) || fallback.document_type,
    metadata,
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
  formData.append('OCREngine', '2');
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

async function extractTextFromPdf(file: File) {
  return extractTextWithOcrSpace(file, file.name || 'documento.pdf');
}

async function extractTextFromImage(file: File) {
  return extractTextWithOcrSpace(file, file.name || 'documento.png');
}

async function analyzeWithOpenRouter(fileName: string, extractedText: string) {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://quioba.com',
      'X-Title': 'Quioba Document Center',
    },
    body: JSON.stringify({
      model: OPENROUTER_MODEL,
      temperature: 0.1,
      max_tokens: 900,
      messages: [
        {
          role: 'system',
          content: `Eres un clasificador documental preciso. Debes extraer metadatos utiles de documentos personales y del hogar. En el campo summary incluye los datos clave visibles de forma breve y util. Para documentos de identidad intenta mencionar nombre completo, numero de documento, fecha de nacimiento, fecha de validez y si falta la cara trasera. Para vehiculo intenta matricula, bastidor e ITV. Para seguros intenta poliza, cobertura y telefono de asistencia. Para salud intenta paciente, centro, fecha y tipo de informe. Para finanzas intenta emisor, importe, periodo e iban parcial. Responde solo JSON valido con este esquema exacto:\n{\n  "title": "string",\n  "category": "Identidad|Vehiculo|Seguro|Hogar|Salud|Finanzas|Otros",\n  "document_type": "string o null",\n  "expiration_date": "YYYY-MM-DD o null",\n  "issuer": "string o null",\n  "summary": "string breve en espanol",\n  "tags": ["tag1", "tag2"],\n  "confidence": 0.0,\n  "metadata": {"clave": "valor"}\n}\nSi un dato no esta claro, usa null o no lo pongas en metadata.`,
        },
        {
          role: 'user',
          content: `Nombre del archivo: ${fileName}\n\nTexto extraido:\n${extractedText.slice(0, 14000)}`,
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

    const limitCheck = await checkApiLimit(user.id, user.email || null, 'document-analysis');
    if (!limitCheck.allowed) {
      return NextResponse.json(
        {
          error: `Has alcanzado el limite mensual de ${limitCheck.limit} analisis. (${limitCheck.used}/${limitCheck.limit})`,
        },
        { status: 429 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'No se ha enviado ningun archivo.' }, { status: 400 });
    }

    const fileName = file.name || 'documento';
    const fileType = file.type || '';
    const isPdf = fileType.includes('pdf') || fileName.toLowerCase().endsWith('.pdf');
    const isImage = fileType.startsWith('image/');

    if (!isPdf && !isImage) {
      return NextResponse.json(
        { error: 'Solo se admiten PDF o imagenes para el analisis automatico.' },
        { status: 400 }
      );
    }

    const extractedText = isPdf ? await extractTextFromPdf(file) : await extractTextFromImage(file);

    if (!extractedText || extractedText.trim().length < MIN_EXTRACTED_TEXT_LENGTH) {
      return NextResponse.json(
        { error: 'No se pudo extraer suficiente texto del documento. Si es un PDF escaneado, prueba con mejor calidad o subelo como imagen.' },
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
        console.error('[Document Analyze] OpenRouter error:', error);
      }
    }

    await recordApiUsage(user.id, 'document-analysis');

    return NextResponse.json({
      analysis,
      source: isPdf ? 'pdf' : 'image',
      model: process.env.OPENROUTER_API_KEY ? OPENROUTER_MODEL : 'fallback',
    });
  } catch (error: any) {
    console.error('[Document Analyze] Error:', error);
    return NextResponse.json({ error: error.message || 'Error interno del servidor' }, { status: 500 });
  }
}
