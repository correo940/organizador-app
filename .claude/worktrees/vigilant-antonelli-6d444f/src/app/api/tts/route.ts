import { NextResponse } from 'next/server';
import { getPhantomConfig } from '@/lib/server/phantom-config';
import { Client } from "@gradio/client";

export async function POST(req: Request) {
    try {
        const config = getPhantomConfig();
        if (!config.xttsApiUrl) {
            return NextResponse.json({ error: 'URL del servidor XTTS no configurada' }, { status: 400 });
        }

        const body = await req.json();
        const { action } = body;
        const baseUrl = config.xttsApiUrl.replace(/\/$/, '');

        // Initialize Gradio client to abstract queueing/websockets
        const app = await Client.connect(baseUrl);

        if (action === 'load_model') {
            const {
                checkpoint = '/content/xtts-webui/model/model.pth',
                configPath = '/content/xtts-webui/model/config.json',
                vocabPath = '/content/xtts-webui/model/vocab.json',
                speakerPath = '/content/xtts-webui/model/speakers_xtts.pth',
            } = body;

            // Depending on the exact app loaded, sometimes it's index 6, sometimes named "/load_model"
            const result = await app.predict("/load_model", [
                checkpoint, configPath, vocabPath, speakerPath
            ]);
            
            const message = (result as any).data?.[0];
            return NextResponse.json({ success: true, message: message || 'Modelo cargado' });

        } else if (action === 'load_names') {
            const result = await app.predict("/load_names", [body.language]);
            
            const namesData = (result as any).data?.[0];
            // Format can be an object with choices or directly an array
            let names = [];
            if (namesData && Array.isArray(namesData.choices)) {
                names = namesData.choices;
            } else if (Array.isArray(namesData)) {
                names = namesData;
            }
            
            return NextResponse.json({ names });

        } else if (action === 'generate') {
            const {
                selectedLanguage = 'Spanish',
                ttsLanguage = 'es',
                text,
                speakerName,
                temperature = 0.75,
                lengthPenalty = 1,
                repetitionPenalty = 5,
                topK = 50,
                topP = 0.85,
                sentenceSplit = true,
                useConfig = false,
            } = body;

            if (!text) {
                return NextResponse.json({ error: 'El texto es obligatorio' }, { status: 400 });
            }
            if (!speakerName) {
                return NextResponse.json({ error: 'Selecciona una voz' }, { status: 400 });
            }

            // run_tts0 executes the TTS algorithm
            const result = await app.predict("/run_tts0", [
                selectedLanguage,
                ttsLanguage,
                text,
                speakerName,
                temperature,
                lengthPenalty,
                repetitionPenalty,
                topK,
                topP,
                sentenceSplit,
                useConfig
            ]);

            const data = (result as any).data;
            if (!data || data.length < 2) {
                return NextResponse.json({ error: 'Respuesta inválida de Gradio' }, { status: 500 });
            }

            const [message, audioData, refAudio] = data;
            
            let audioUrl = '';
            // audioData can be an object with url/path or just a string
            if (typeof audioData === 'object' && audioData !== null) {
                audioUrl = audioData.url || audioData.path || '';
            } else if (typeof audioData === 'string') {
                audioUrl = audioData;
            }

            if (!audioUrl) {
                return NextResponse.json({ error: message || 'Fallo al generar audio' }, { status: 500 });
            }

            // Descargar el binario del audio final
            const audioRes = await fetch(audioUrl);
            if (!audioRes.ok) throw new Error('Error al descargar WAV del servidor Gradio');
            
            const audioBuffer = await audioRes.arrayBuffer();

            return new Response(audioBuffer, {
                headers: {
                    'Content-Type': 'audio/wav',
                    'X-TTS-Message': encodeURIComponent(typeof message === 'string' ? message : 'Generado'),
                },
            });

        } else {
            return NextResponse.json({ error: 'Acción no reconocida' }, { status: 400 });
        }

    } catch (error: any) {
        console.error('[TTS Proxy] Error conectando a Gradio:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
