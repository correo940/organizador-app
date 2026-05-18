import { NextResponse } from 'next/server';
import { getPhantomConfig, savePhantomConfig } from '@/lib/server/phantom-config';
import { Client } from "@gradio/client";

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { action } = body;

        // Configuration actions
        if (action === 'save_url') {
            const { url } = body;
            savePhantomConfig({ svdApiUrl: url });
            return NextResponse.json({ success: true });
        }
        
        if (action === 'get_url') {
            const config = getPhantomConfig();
            return NextResponse.json({ url: config.svdApiUrl || '' });
        }

        // Generate action
        const config = getPhantomConfig();
        if (!config.svdApiUrl) {
            return NextResponse.json({ error: 'URL del servidor SD Videos no configurada' }, { status: 400 });
        }

        const baseUrl = config.svdApiUrl.replace(/\/$/, '');
        console.log('[SDV] Conectando a Gradio:', baseUrl);
        const app = await Client.connect(baseUrl);
        console.log('[SDV] Conexión exitosa');

        if (action === 'generate_sdv') {
            const {
                prompts,
                seeds = "42, 1337",
                fps = 15,
                inferenceSteps = 30,
                guidanceScale = 7.5
            } = body;

            if (!prompts) {
                return NextResponse.json({ error: 'Debes proporcionar al menos dos prompts' }, { status: 400 });
            }

            console.log('[SDV] Enviando predict con params:', { prompts, seeds, fps, inferenceSteps, guidanceScale });
            
            const result = await app.predict(0, [
                prompts,
                seeds,
                fps,
                inferenceSteps,
                guidanceScale,
            ]);

            console.log('[SDV] Resultado RAW:', JSON.stringify(result, null, 2));

            const data = (result as any).data;
            if (!data || data.length === 0) {
                return NextResponse.json({ error: 'Respuesta inválida de SD Videos Gradio' }, { status: 500 });
            }

            const videoData = data[0];
            let videoUrl = '';
            
            console.log('[SDV] videoData tipo:', typeof videoData);
            console.log('[SDV] videoData completo:', JSON.stringify(videoData));

            // Detectar si Gradio devolvió un error envuelto como fichero
            if (typeof videoData === 'object' && videoData !== null) {
                const origName = videoData.orig_name || videoData.path || '';
                if (origName.startsWith('Error:') || origName.includes('Error:')) {
                    return NextResponse.json({ error: origName }, { status: 400 });
                }
            }
            if (typeof videoData === 'string' && videoData.startsWith('Error:')) {
                return NextResponse.json({ error: videoData }, { status: 400 });
            }

            if (typeof videoData === 'object' && videoData !== null) {
                // El @gradio/client moderno devuelve { url, path, orig_name, ... }
                videoUrl = videoData.url || '';
                
                // Si no hay url directa, intentar construirla desde path
                if (!videoUrl && videoData.path) {
                    videoUrl = `${baseUrl}/file=${videoData.path}`;
                }
            } else if (typeof videoData === 'string') {
                videoUrl = videoData;
            }

            // Si la URL es relativa, añadir el baseUrl
            if (videoUrl && !videoUrl.startsWith('http')) {
                videoUrl = `${baseUrl}/file=${videoUrl}`;
            }

            console.log('[SDV] Video URL final:', videoUrl);

            if (!videoUrl) {
                return NextResponse.json({ error: 'Fallo al inferir la URL del video de SD Walk' }, { status: 500 });
            }

            // Descargar el binario del video final
            console.log('[SDV] Descargando video desde:', videoUrl);
            const videoRes = await fetch(videoUrl);
            console.log('[SDV] Respuesta descarga:', videoRes.status, videoRes.statusText);
            
            if (!videoRes.ok) {
                const errBody = await videoRes.text().catch(() => 'sin body');
                console.error('[SDV] Error descarga body:', errBody);
                throw new Error(`Error al descargar .mp4: ${videoRes.status} ${videoRes.statusText}`);
            }
            
            const videoBuffer = await videoRes.arrayBuffer();

            return new Response(videoBuffer, {
                headers: {
                    'Content-Type': 'video/mp4'
                },
            });

        } else {
            return NextResponse.json({ error: 'Acción no reconocida' }, { status: 400 });
        }

    } catch (error: any) {
        console.error('[SDV Proxy] ERROR COMPLETO:', error);
        return NextResponse.json({ error: error.message || 'Error desconocido' }, { status: 500 });
    }
}
