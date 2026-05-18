import { NextResponse } from 'next/server';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { imageB64 } = body;

        if (!imageB64) {
            return NextResponse.json({ error: 'Imagen requerida' }, { status: 400 });
        }

        const base64Data = imageB64.replace(/^data:image\/\w+;base64,/, '');

        // 1. PlantNet Identification (opcional, para referencia)
        let plantnetSpecies = "Por identificar";
        let plantnetCommon = "Por identificar";

        try {
            const formData = new FormData();
            
            const byteCharacters = atob(base64Data);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: 'image/jpeg' });
            
            formData.append('images', blob, 'plant.jpg');
            formData.append('organs', 'auto');

            console.log("🔍 Enviando imagen a PlantNet...");
            const plantnetRes = await fetch(`https://my-api.plantnet.org/v2/identify/all?api-key=${process.env.PLANTNET_API_KEY}`, {
                method: 'POST',
                body: formData
            });

            if (plantnetRes.ok) {
                const pnData = await plantnetRes.json();
                console.log("PlantNet response:", JSON.stringify(pnData).substring(0, 200));
                
                if (pnData.results && pnData.results.length > 0) {
                    const bestMatch = pnData.results[0];
                    const score = bestMatch.score || 0;
                    
                    if (score > 0.1) { // Solo si tiene confianza mínima
                        plantnetSpecies = bestMatch.species?.scientificNameWithoutAuthor || plantnetSpecies;
                        plantnetCommon = bestMatch.species?.commonNames?.[0] || bestMatch.species?.scientificNameWithoutAuthor || plantnetCommon;
                        console.log(`✅ PlantNet identificó: ${plantnetCommon} (confianza: ${(score * 100).toFixed(1)}%)`);
                    } else {
                        console.warn(`⚠️ PlantNet encontró algo pero con baja confianza (${(score * 100).toFixed(1)}%)`);
                    }
                } else {
                    console.warn("⚠️ PlantNet no encontró resultados");
                }
            } else {
                const err = await plantnetRes.text();
                console.warn(`⚠️ PlantNet HTTP ${plantnetRes.status}: ${err.substring(0, 100)}`);
            }
        } catch (pnError) {
            console.error("❌ PlantNet Exception:", pnError);
        }

        // 2. Vision Analysis: Intentar múltiples modelos
        let careData: any = {
            scientific_name: 'Por identificar',
            common_name: 'Planta desconocida',
            health_status: 'Saludable',
            care_instructions: 'Riega cuando la tierra esté seca.',
            watering_frequency_days: 7,
            sunlight_needs: 'Luz indirecta'
        };

        const systemPrompt = `Eres un experto botánico agrícola con capacidad de identificación de plantas.

${plantnetCommon !== "Por identificar" ? `PlantNet sugiere: ${plantnetCommon} (${plantnetSpecies})` : 'PlantNet no pudo identificarla. IDENTIFICA tú mismo basándote en las características visibles.'}

INSTRUCCIONES CRÍTICAS:
- SIEMPRE identifica la planta (nombre común Y científico)
- Nunca respondas "Desconocida" 
- Si tienes dudas, usa lo que VES en la imagen para tu mejor estimación
- Responde ÚNICAMENTE con JSON válido (sin comentarios, sin markdown)

FORMATO REQUERIDO:
{
    "common_name": "Nombre en español (NO PUEDE SER VACÍO)",
    "scientific_name": "Nombre científico latino (NO PUEDE SER VACÍO O 'Desconocida')",
    "health_status": "Saludable / Con problemas / Enfermo - descripción breve",
    "care_instructions": "Cómo cuidar esta planta específica",
    "watering_frequency_days": 7,
    "sunlight_needs": "Sol directo / Sombra parcial / Luz indirecta / Sombra"
}

EJEMPLOS VÁLIDOS:
{"common_name":"Tomate","scientific_name":"Solanum lycopersicum","health_status":"Saludable","care_instructions":"Riego regular, suelo drenado","watering_frequency_days":2,"sunlight_needs":"Sol directo"}
{"common_name":"Pothos","scientific_name":"Epipremnum aureum","health_status":"Hojas amarillas, poco riego","care_instructions":"Menos agua, mejor ventilación","watering_frequency_days":7,"sunlight_needs":"Luz indirecta"}
{"common_name":"Helecho","scientific_name":"Nephrolepis exaltata","health_status":"Saludable","care_instructions":"Mantener tierra húmeda, humedad alta","watering_frequency_days":3,"sunlight_needs":"Sombra parcial"}`;

        // Intentar OpenRouter con modelos gratis verificados
        if (process.env.OPENROUTER_API_KEY) {
            try {
                // Primer intento: Llama 3.3 70B (modelo muy capaz)
                console.log("🤖 Intentando OpenRouter (Llama 3.3 70B Instruct)...");
                const llamaRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
                        'Content-Type': 'application/json',
                        'HTTP-Referer': 'https://quioba.com',
                        'X-Title': 'Quioba Plant Analyzer'
                    },
                    body: JSON.stringify({
                        model: 'meta-llama/llama-3.3-70b-instruct',
                        messages: [
                            {
                                role: "user",
                                content: systemPrompt
                            }
                        ]
                    })
                });

                if (llamaRes.ok) {
                    const llamaData = await llamaRes.json();
                    const content = llamaData.choices?.[0]?.message?.content;
                    if (content) {
                        try {
                            careData = JSON.parse(content);
                            console.log("✅ Llama 3.3 respondió exitosamente");
                        } catch (parseErr) {
                            console.warn("⚠️ Llama parse error, intentando Qwen...");
                            throw new Error("Parse error");
                        }
                    }
                } else {
                    const err = await llamaRes.text();
                    console.warn(`⚠️ Llama fallo (${llamaRes.status}): ${err.substring(0, 150)}`);
                    throw new Error("Llama failed");
                }
            } catch (llamaError) {
                console.warn("⚠️ Llama Exception, intentando Qwen3...");
                
                // Segundo intento: Qwen3 (modelo gratuito capaz)
                if (process.env.OPENROUTER_API_KEY) {
                    try {
                        console.log("🤖 Intentando OpenRouter (Qwen3)...");
                        const qwenRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                            method: 'POST',
                            headers: {
                                'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
                                'Content-Type': 'application/json',
                                'HTTP-Referer': 'https://quioba.com',
                                'X-Title': 'Quioba Plant Analyzer'
                            },
                            body: JSON.stringify({
                                model: 'qwen/qwen-2.5-7b-instruct',
                                messages: [
                                    {
                                        role: "user",
                                        content: systemPrompt
                                    }
                                ]
                            })
                        });

                        if (qwenRes.ok) {
                            const qwenData = await qwenRes.json();
                            const content = qwenData.choices?.[0]?.message?.content;
                            if (content) {
                                try {
                                    careData = JSON.parse(content);
                                    console.log("✅ Qwen3 respondió exitosamente");
                                } catch (parseErr) {
                                    console.log("ℹ️ Usando análisis genérico (Qwen parse error)");
                                }
                            }
                        } else {
                            const err = await qwenRes.text();
                            console.warn(`⚠️ Qwen fallo (${qwenRes.status}): ${err.substring(0, 150)}`);
                            console.log("ℹ️ Usando análisis genérico");
                        }
                    } catch (qwenError) {
                        console.warn("⚠️ Qwen Exception:", qwenError);
                        console.log("ℹ️ Usando análisis genérico");
                    }
                } else {
                    console.warn("⚠️ OPENROUTER_API_KEY no configurada");
                    console.log("ℹ️ Usando análisis genérico");
                }
            }
        } else {
            console.warn("⚠️ OPENROUTER_API_KEY no configurada");
            console.log("ℹ️ Usando análisis genérico con PlantNet solo");
        }

        const result = {
            species: careData.scientific_name || plantnetSpecies,
            common_name: careData.common_name || plantnetCommon,
            watering_frequency_days: careData.watering_frequency_days || 7,
            sunlight_needs: careData.sunlight_needs || 'Luz indirecta',
            health_status: careData.health_status || 'Saludable',
            care_instructions: careData.care_instructions || 'Riega cuando la tierra esté seca.',
        };

        console.log("✅ Análisis completado:", result);
        return NextResponse.json(result);

    } catch (error: any) {
        console.error("❌ Error en /api/plants/analyze:", error);
        return NextResponse.json(
            { 
                error: 'Error al analizar la planta',
                species: 'Por identificar',
                common_name: 'Planta desconocida',
                health_status: 'Saludable',
                care_instructions: 'Riega cuando la tierra esté seca.',
                watering_frequency_days: 7,
                sunlight_needs: 'Luz indirecta'
            },
            { status: 200 }
        );
    }
}
