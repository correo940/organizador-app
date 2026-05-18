import Groq from "groq-sdk";

export interface UserShiftResult {
    found: boolean;
    date: string;
    targetName: string;
    shift: string;
    startTime: string;
    endTime: string;
    colleagues: string[];
    rawContext: string;
}

export async function findUserShiftGroq(base64Image: string, targetName: string): Promise<UserShiftResult | null> {
    console.log(`[Groq] Starting Detective Mode for: ${targetName}`);

    try {
        const apiKey = process.env.GROQ_API_KEY || process.env.NEXT_PUBLIC_GROQ_API_KEY;
        if (!apiKey) {
            console.warn("[Groq] Missing GROQ_API_KEY");
            return null;
        }

        const groq = new Groq({ apiKey });
        const chatCompletion = await groq.chat.completions.create({
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": `Actúa como un DETECTIVE experto en cuadrantes de policía.
                            Tu MISIÓN es encontrar el turno del agente "${targetName}".
                            
                            INSTRUCCIONES:
                            1. Escanea la imagen buscando el texto "${targetName}" (o muy similar).
                            2. Identifica la COLUMNA (Turno) a la que pertenece (Mañana, Tarde, Noche).
                            3. Lista a los compañeros en esa misma caja/columna.
                            4. Encuentra la FECHA del documento.
                            
                            Responde SOLO con este JSON (sin markdown):
                            {
                                "found": true,
                                "date": "YYYY-MM-DD",
                                "targetName": "Nombre Encontrado",
                                "shift": "TURNO DETECTADO",
                                "startTime": "HH:MM",
                                "endTime": "HH:MM",
                                "colleagues": ["Nombre1", "Nombre2"]
                            }`
                        },
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": base64Image // Must be data:image/jpeg;base64,...
                            }
                        }
                    ]
                }
            ],
            "model": "llama-3.2-11b-vision-preview",
            "temperature": 0,
            "stream": false,
            "response_format": { "type": "json_object" }
        });

        const content = chatCompletion.choices[0]?.message?.content;
        if (!content) throw new Error("Empty response from Groq");

        const data = JSON.parse(content);
        return { ...data, rawContext: "Groq Llama 3.2" };

    } catch (e: any) {
        console.error("Groq Vision Failed:", e);
        return null;
    }
}
