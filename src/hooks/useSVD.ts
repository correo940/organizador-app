import { useState, useCallback, useEffect } from 'react';

export interface SdvParams {
    prompts: string;
    seeds: string;
    interpolationSteps: number;
    fps: number;
    inferenceSteps: number;
    guidanceScale: number;
}

export function useSVD() {
    const [svdApiUrl, setSvdApiUrl] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [videoUrl, setVideoUrl] = useState<string | null>(null);

    useEffect(() => {
        fetch('/api/svd', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'get_url' })
        })
        .then(res => res.json())
        .then(data => {
            if (data.url) setSvdApiUrl(data.url);
        })
        .catch(console.error);
    }, []);

    const saveApiUrl = async (url: string) => {
        try {
            await fetch('/api/svd', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'save_url', url })
            });
            setSvdApiUrl(url);
            return true;
        } catch (err) {
            console.error('Error saving API url:', err);
            return false;
        }
    };

    const generateVideo = useCallback(async (params: SdvParams) => {
        setIsGenerating(true);
        setError(null);
        setVideoUrl(null);

        try {
            const res = await fetch('/api/svd', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'generate_sdv', ...params })
            });

            if (!res.ok) {
                let errText = 'Error en la petición de renderizado';
                try {
                    const errorData = await res.json();
                    errText = errorData.error || errText;
                } catch (e) {
                    errText = await res.text();
                }
                throw new Error(errText);
            }

            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            setVideoUrl(url);

        } catch (err: any) {
            setError(err.message || 'Error desconocido generando el video');
        } finally {
            setIsGenerating(false);
        }
    }, []);

    return {
        svdApiUrl,
        saveApiUrl,
        isGenerating,
        error,
        videoUrl,
        generateVideo
    };
}
