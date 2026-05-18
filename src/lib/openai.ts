import OpenAI from "openai";

// NOTE: We will use the key provided by the user in the UI/Env
// For now, we instantiate it dynamically in the function to allow inputting the key at runtime if needed,
// but relying on env vars is standard.

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

export async function findUserShiftOpenAI(base64Image: string, targetName: string, apiKey: string): Promise<UserShiftResult | null> {
    console.log(`[OpenAI] Starting Detective Mode for: ${targetName}`);

    if (!apiKey) {
        console.warn("Missing OpenAI API Key");
        return null;
    }

    const openai = new OpenAI({
        apiKey: apiKey,
        dangerouslyAllowBrowser: true // Enabling client-side usage as requested by user's setup
    });

    try {
        const response = await openai.chat.completions.create({
            model: "gpt-4o", // State-of-the-art for vision
            messages: [
                {
                    role: "system",
                    content: "Eres un experto en analizar cuadrantes y horarios policiales/laborales. Tu objetivo es precisión absoluta."
                },
                {
                    role: "user",
                    content: [
                        {
                            type: "text",
                            text: `Busca el turno de: "${targetName}".
                            
                            INSTRUCCIONES:
                            1. Encuentra el nombre en la imagen.
                            2. Identifica la COLUMNA (Turno) a la que pertenece (Mañana, Tarde, Noche, Saliente, Libre...).
                            3. Lista a los compañeros en ese mismo bloque.
                            4. Extrae la FECHA (cabecera).

                            Responde SOLAMENTE con este JSON:
                            {
                                "found": true,
                                "date": "YYYY-MM-DD",
                                "targetName": "Nombre Tal Cual Aparece",
                                "shift": "NOMBRE DEL TURNO",
                                "startTime": "HH:MM",
                                "endTime": "HH:MM",
                                "colleagues": ["Nombre 1", "Nombre 2"]
                            }`
                        },
                        {
                            type: "image_url",
                            image_url: {
                                "url": base64Image
                            }
                        }
                    ]
                }
            ],
            response_format: { type: "json_object" },
            temperature: 0
        });

        const content = response.choices[0].message.content;
        if (!content) throw new Error("Empty response from OpenAI");

        const data = JSON.parse(content);
        return { ...data, rawContext: "OpenAI GPT-4o" };

    } catch (e: any) {
        console.error("OpenAI Vision Failed:", e);
        return null;
    }
}
