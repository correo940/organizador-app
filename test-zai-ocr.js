// Test Z.AI GLM-4.6V-Flash Vision - Análisis de cuadrante Guardia Civil
const fs = require('fs');
const path = require('path');

const API_KEY = "1bdabb5b5aa74056b675415c4e24a8a9.Eleh6rSO6x43XSOH";
const API_URL = "https://api.z.ai/api/paas/v4/chat/completions";
const MODEL = "glm-4.6v-flash";

async function testOCR(imagePath) {
    console.log("=== TEST Z.AI GLM-4.6V-Flash (Vision) ===\n");

    const imageBuffer = fs.readFileSync(imagePath);
    const base64Image = imageBuffer.toString('base64');
    const ext = path.extname(imagePath).toLowerCase();
    const mimeType = ext === '.png' ? 'image/png' : 'image/jpeg';

    console.log(`Imagen: ${path.basename(imagePath)}`);
    console.log(`Tamaño: ${(imageBuffer.length / 1024).toFixed(1)} KB`);
    console.log(`Modelo: ${MODEL} (GRATIS)`);
    console.log(`Enviando...\n`);

    const body = {
        model: MODEL,
        messages: [
            {
                role: "user",
                content: [
                    {
                        type: "image_url",
                        image_url: {
                            url: `data:${mimeType};base64,${base64Image}`
                        }
                    },
                    {
                        type: "text",
                        text: `Analiza esta imagen de un cuadrante/hoja de servicio de la Guardia Civil de España.

Extrae TODA la información visible y devuelve un JSON con esta estructura:
{
  "fecha": "fecha del cuadrante",
  "unidad": "comandancia/unidad",
  "servicios": [
    {
      "nombre_servicio": "nombre del servicio/destino",
      "personal": [
        {
          "nombre": "nombre completo",
          "rango": "rango militar",
          "turno": "mañana|tarde|noche",
          "horario": "HH:MM a HH:MM"
        }
      ]
    }
  ]
}

IMPORTANTE: Devuelve SOLO el JSON, sin explicaciones adicionales.`
                    }
                ]
            }
        ],
        max_tokens: 8192,
        thinking: { type: "disabled" },
        temperature: 0.1,
        stream: false
    };

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_KEY}`
            },
            body: JSON.stringify(body)
        });

        const data = await response.json();

        if (!response.ok) {
            console.error("❌ ERROR API:", JSON.stringify(data, null, 2));
            return;
        }

        console.log("✅ Respuesta exitosa!");
        console.log(`Tokens: input=${data.usage?.prompt_tokens}, output=${data.usage?.completion_tokens}, total=${data.usage?.total_tokens}`);

        const content = data.choices[0]?.message?.content || "";
        const reasoning = data.choices[0]?.message?.reasoning_content || "";

        console.log("\n=== RESULTADO ===\n");
        if (content) {
            console.log(content);
        } else if (reasoning) {
            console.log("[Solo reasoning]:", reasoning.substring(0, 2000));
        } else {
            console.log("Sin contenido - respuesta raw:");
            console.log(JSON.stringify(data.choices[0], null, 2));
        }

        // Save full result
        const resultPath = path.join(__dirname, 'test-zai-result.json');
        fs.writeFileSync(resultPath, JSON.stringify({
            model: MODEL,
            usage: data.usage,
            content: content,
            reasoning: reasoning,
            raw_choice: data.choices[0]
        }, null, 2), 'utf8');
        console.log(`\n📄 Guardado en: ${resultPath}`);

    } catch (error) {
        console.error("Error:", error.message);
    }
}

const imagePath = process.argv[2];
if (!imagePath) {
    console.log("Uso: node test-zai-ocr.js <ruta-imagen>");
    process.exit(1);
}
if (!fs.existsSync(imagePath)) {
    console.error(`No se encuentra: ${imagePath}`);
    process.exit(1);
}
testOCR(imagePath);
