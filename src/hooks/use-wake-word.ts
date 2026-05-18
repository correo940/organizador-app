'use client';
import { useEffect, useRef } from 'react';

interface UseWakeWordOptions {
    onWakeWord: () => void;
    enabled?: boolean;
    paused?: boolean;
}

export function useWakeWord({ onWakeWord, enabled = true, paused = false }: UseWakeWordOptions) {
    const onWakeWordRef = useRef(onWakeWord);
    const recognitionRef = useRef<any>(null);
    const enabledRef = useRef(enabled);
    const pausedRef = useRef(paused);
    const timeoutRef = useRef<any>(null);

    useEffect(() => { onWakeWordRef.current = onWakeWord; }, [onWakeWord]);
    useEffect(() => { enabledRef.current = enabled; }, [enabled]);
    useEffect(() => { pausedRef.current = paused; }, [paused]);

    useEffect(() => {
        let isActive = true;

        if (!enabled || paused || typeof window === 'undefined') {
            return;
        }

        const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SR) {
            console.warn("SpeechRecognition no soportado en este navegador");
            return;
        }

        function start() {
            if (!isActive) return;
            clearTimeout(timeoutRef.current);
            if (!enabledRef.current || pausedRef.current) return;
            if (recognitionRef.current) return;

            try {
                const recognition = new SR();
                recognition.lang = 'es-ES';
                recognition.continuous = true;
                recognition.interimResults = false;
                recognition.maxAlternatives = 5;

                recognition.onresult = (e: any) => {
                    if (!isActive) return;
                    for (let i = e.resultIndex; i < e.results.length; i++) {
                        if (!e.results[i].isFinal) continue;
                        for (let j = 0; j < e.results[i].length; j++) {
                            const t = e.results[i][j].transcript.toLowerCase().trim();
                            console.log('🗣️ Escuché:', t);
                            if (
                                t.includes('quioba') ||
                                t.includes('kioba') ||
                                t.includes('quiova') ||
                                t.includes('kiova') ||
                                t.includes('gioba') ||
                                t.includes('quiroba') ||
                                t.includes('quiroga') ||
                                t.includes('nova') ||
                                t.includes('quio') ||
                                t.includes('jehova') ||
                                t.includes('jehová')
                            ) {
                                console.log('🎯 WAKE WORD DETECTADO!');
                                onWakeWordRef.current();
                                return;
                            }
                        }
                    }
                };

                recognition.onerror = (e: any) => {
                    if (!isActive) return;
                    // 'aborted' y 'no-speech' son normales en Chrome/Windows, ignorar
                    if (e.error !== 'no-speech' && e.error !== 'aborted') {
                        console.log('⚠️ Wake word error:', e.error);
                    }
                    if (e.error === 'not-allowed') return; // Bloqueado, no insistir
                };

                recognition.onend = () => {
                    recognitionRef.current = null;
                    if (!isActive) return;

                    if (enabledRef.current && !pausedRef.current) {
                        timeoutRef.current = setTimeout(start, 1500);
                    }
                };

                recognitionRef.current = recognition;
                recognition.start();
                console.log('🎙️ Reconocimiento activo');
            } catch (err) {
                if (isActive) {
                    timeoutRef.current = setTimeout(start, 500);
                }
            }
        }

        function stop() {
            isActive = false; // Bloquea todo futuro reinicio de onend o catch
            clearTimeout(timeoutRef.current);
            if (recognitionRef.current) {
                try { recognitionRef.current.abort(); } catch { }
                recognitionRef.current = null;
            }
        }

        start();
        return stop;

    }, [enabled, paused]);
}
