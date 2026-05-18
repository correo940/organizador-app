import { useState, useRef, useCallback } from 'react';

interface TTSParams {
    selectedLanguage: string;
    ttsLanguage: string;
    text: string;
    speakerName: string;
    temperature: number;
    lengthPenalty: number;
    repetitionPenalty: number;
    topK: number;
    topP: number;
    sentenceSplit: boolean;
    useConfig: boolean;
}

interface UseTTSReturn {
    generate: (params: TTSParams) => Promise<void>;
    loadModel: () => Promise<string>;
    loadVoices: (language: string) => Promise<string[]>;
    stop: () => void;
    loading: boolean;
    modelLoading: boolean;
    modelLoaded: boolean;
    error: string | null;
    isPlaying: boolean;
    audioUrl: string | null;
}

export function useTTS(): UseTTSReturn {
    const [loading, setLoading] = useState(false);
    const [modelLoading, setModelLoading] = useState(false);
    const [modelLoaded, setModelLoaded] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    const loadModel = useCallback(async (): Promise<string> => {
        setModelLoading(true);
        setError(null);
        try {
            const res = await fetch('/api/tts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'load_model',
                    checkpoint: '/content/xtts-webui/model/model.pth',
                    configPath: '/content/xtts-webui/model/config.json',
                    vocabPath: '/content/xtts-webui/model/vocab.json',
                    speakerPath: '/content/xtts-webui/model/speakers_xtts.pth',
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Error cargando modelo');
            setModelLoaded(true);
            return data.message || 'Modelo cargado';
        } catch (err: any) {
            setError(err.message);
            throw err;
        } finally {
            setModelLoading(false);
        }
    }, []);

    const loadVoices = useCallback(async (language: string): Promise<string[]> => {
        try {
            const res = await fetch('/api/tts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'load_names', language }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Error cargando voces');

            // Gradio returns the dropdown update in data.names
            // It can be: { choices: [...], value: ... } or just an array
            const names = data.names;
            if (Array.isArray(names)) {
                // Could be nested: [[choices], value] or [{ choices, value }]
                if (names.length > 0) {
                    const first = names[0];
                    if (typeof first === 'object' && first !== null && 'choices' in first) {
                        return first.choices || [];
                    }
                    if (Array.isArray(first)) {
                        return first;
                    }
                    // It's a flat array of strings
                    if (typeof first === 'string') {
                        return names as string[];
                    }
                }
            }
            return [];
        } catch (err: any) {
            console.error('[useTTS] Error cargando voces:', err);
            return [];
        }
    }, []);

    const generate = useCallback(async (params: TTSParams) => {
        setLoading(true);
        setError(null);

        try {
            const res = await fetch('/api/tts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'generate',
                    ...params,
                }),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Error generando audio');
            }

            const blob = await res.blob();
            const url = URL.createObjectURL(blob);

            // Clean up previous audio
            if (audioRef.current) {
                audioRef.current.pause();
                if (audioUrl) URL.revokeObjectURL(audioUrl);
            }

            setAudioUrl(url);

            const audio = new Audio(url);
            audioRef.current = audio;

            audio.onplay = () => setIsPlaying(true);
            audio.onended = () => setIsPlaying(false);
            audio.onerror = () => {
                setIsPlaying(false);
                setError('Error en la reproducción');
            };

            await audio.play();
        } catch (err: any) {
            console.error('[useTTS] Error:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [audioUrl]);

    const stop = useCallback(() => {
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
            setIsPlaying(false);
        }
    }, []);

    return {
        generate,
        loadModel,
        loadVoices,
        stop,
        loading,
        modelLoading,
        modelLoaded,
        error,
        isPlaying,
        audioUrl,
    };
}
