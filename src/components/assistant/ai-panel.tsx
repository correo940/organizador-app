'use client';
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useAi } from '@/context/AiContext';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, Loader2, Volume2, VolumeX, BookOpen, Trash2, Plus, Fingerprint, Lock, Unlock, Eye, EyeOff, Settings, CalendarDays } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useAuth } from '@/components/apps/mi-hogar/auth-context';
import { toast } from 'sonner';
import { useWakeWord } from '@/hooks/use-wake-word';
import { supabase } from '@/lib/supabase';
import CryptoJS from 'crypto-js';
import { getSecretarySettings, getAvatarById } from '@/lib/secretary-settings';
import { format } from 'date-fns';

function EphemeralPasswordRequest({ passwordId, passwordName, userId }: { passwordId: string, passwordName: string, userId: string }) {
    const [state, setState] = useState<'idle' | 'verifying' | 'unlocked' | 'faded'>('idle');
    const [decryptedValue, setDecryptedValue] = useState('');
    const [error, setError] = useState('');

    const handleUnlock = async () => {
        setState('verifying');
        setError('');
        try {
            const storedKey = localStorage.getItem(`passwords_bio_key_${userId}`);
            if (!storedKey) {
                setError('No tienes biometría vinculada. Entra en tu Bóveda antes para vincular este dispositivo.');
                setState('idle');
                return;
            }

            if (!window.PublicKeyCredential) {
                setError('Biometría de seguridad nativa no soportada en tu dispositivo.');
                setState('idle');
                return;
            }

            const challenge = new Uint8Array(32);
            window.crypto.getRandomValues(challenge);

            await navigator.credentials.get({
                publicKey: {
                    challenge,
                    rpId: window.location.hostname,
                    userVerification: "required"
                }
            });

            const { data } = await supabase.from('passwords').select('password_hash').eq('id', passwordId).single();
            if (!data) throw new Error("Contraseña no encontrada en la bóveda.");

            const bytes = CryptoJS.AES.decrypt(data.password_hash, storedKey);
            const decryptedStr = bytes.toString(CryptoJS.enc.Utf8);
            if (!decryptedStr) throw new Error("Error de descifrado local.");

            setDecryptedValue(decryptedStr);
            setState('unlocked');

            setTimeout(() => {
                setState('faded');
                setDecryptedValue('');
            }, 10000);

        } catch (err) {
            console.error(err);
            setError('Fallo de Verificación Biométrica o Acción Cancelada.');
            setState('idle');
        }
    };

    if (state === 'faded') {
        return (
            <div className="bg-zinc-100 dark:bg-zinc-900 border border-dashed border-zinc-300 dark:border-zinc-800 rounded-xl p-4 text-center my-2 opacity-50">
                <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                    <Lock className="w-3 h-3" /> Contraseña destruida por seguridad
                </p>
            </div>
        );
    }

    if (state === 'unlocked') {
        return (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-green-50 dark:bg-green-800-950/20 border border-green-200 dark:border-green-950/50 rounded-xl p-4 my-2 text-center shadow-inner relative overflow-hidden">
                <div className="absolute top-0 left-0 h-1 bg-green-500 origin-left animate-timer" style={{ animation: 'shrik 10s linear forwards' }} />
                <style>{`@keyframes shrik { from { width: 100%; } to { width: 0%; } }`}</style>
                <p className="text-xs text-green-950 dark:text-green-400 font-bold mb-2 flex items-center justify-center gap-1">
                    <Unlock className="w-3 h-3" /> Acceso Concedido - {passwordName}
                </p>
                <div className="relative group mx-auto inline-block">
                    <p className="text-xl font-mono font-black tracking-widest text-green-800-950 dark:text-white bg-white dark:bg-black/50 px-4 py-2 rounded-lg border border-green-100 dark:border-zinc-800 custom-blur blur-md group-hover:blur-none transition-all duration-300 select-all cursor-pointer">
                        {decryptedValue}
                    </p>
                </div>
                <p className="text-[10px] text-green-800 dark:text-green-500 mt-3 flex items-center justify-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin duration-1000" /> Se autodestruirá en 10s
                </p>
            </motion.div>
        );
    }

    return (
        <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/50 rounded-xl p-4 my-2">
            <h4 className="text-sm font-bold text-blue-900 dark:text-blue-300 flex items-center gap-2 mb-1">
                <Lock className="w-4 h-4" /> Bóveda Local: {passwordName}
            </h4>
            <p className="text-xs text-blue-700/80 dark:text-blue-400/80 leading-relaxed mb-4">
                El sistema de IA no conoce tu contraseña. Para descifrarla en este momento, verifica tu biometría. (Desaparecerá a los 10 segundos).
            </p>
            <Button
                onClick={handleUnlock}
                disabled={state === 'verifying'}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-md font-bold"
            >
                {state === 'verifying' ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Fingerprint className="w-4 h-4 mr-2" />}
                Autenticación Local Requerida
            </Button>
            {error && <p className="text-[10px] text-red-500 mt-2 text-center font-semibold">{error}</p>}
        </div>
    );
}

function AiReply({ content, userId }: { content: string, userId: string }) {
    try {
        const parsed = JSON.parse(content);
        if (parsed.type === 'password_request') {
            return <EphemeralPasswordRequest passwordId={parsed.id} passwordName={parsed.name} userId={userId} />;
        }
        if (parsed.type === 'list' && Array.isArray(parsed.items)) {
            return (
                <div>
                    <div className="flex items-center gap-1.5 mb-2 font-semibold text-sm">
                        <span>{parsed.icon}</span>
                        <span>{parsed.title}</span>
                    </div>
                    <ul className="space-y-1">
                        {parsed.items.map((item: { icon: string; text: string }, i: number) => (
                            <li key={i} className="flex items-center gap-2 justify-between bg-white dark:bg-zinc-800 rounded-xl px-3 py-2 shadow-sm border border-slate-100 dark:border-zinc-700">
                                <span className="shrink-0">{item.icon}</span>
                                {(() => {
                                    const match = item.text.match(/^(.*?)\s*(x\d+)$/);
                                    if (match) {
                                        return (
                                            <>
                                                <span className="text-sm text-slate-700 dark:text-slate-200 flex-1">{match[1]}</span>
                                                <span className="text-[10px] font-semibold bg-slate-100 dark:bg-zinc-700 text-slate-400 px-2 py-0.5 rounded-full shrink-0">{match[2]}</span>
                                            </>
                                        );
                                    }
                                    return <span className="text-sm text-slate-700 dark:text-slate-200 flex-1">{item.text}</span>;
                                })()}
                            </li>
                        ))}
                    </ul>
                </div>
            );
        }
        if (parsed.type === 'summary') {
            return (
                <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 rounded-xl p-4 my-2">
                    <p className="text-xs font-bold text-amber-800 dark:text-amber-400 mb-2 flex items-center gap-1">
                        ✨ Resumen del Día Completado
                    </p>
                    <p className="text-sm italic text-amber-900/80 dark:text-amber-200/80">
                        "{parsed.text}"
                    </p>
                </div>
            );
        }
        if (parsed.type === 'text') {
            return <p className="text-sm">{parsed.content}</p>;
        }
    } catch {
        // fallback texto plano
    }
    return <p className="text-sm">{content}</p>;
}

interface Message {
    role: 'user' | 'assistant';
    content: string;
}

interface KnowledgeItem {
    id: string;
    title: string;
    content: string;
    created_at: string;
}



// Emite un pitido agradable y futurista al reconocer la palabra
function playWakeBeep() {
    try {
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioContext) return;
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.1);

        gain.gain.setValueAtTime(0, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.2, ctx.currentTime + 0.05);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.15);

        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.2);
    } catch {
        // Ignorar si el navegador bloquea el audio
    }
}

// ── Modal de Conocimiento ─────────────────────────────────────────────────
function KnowledgeModal({ userId, onClose }: { userId: string; onClose: () => void }) {
    const [items, setItems] = useState<KnowledgeItem[]>([]);
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch(`/api/ai-knowledge?userId=${userId}`)
            .then(r => r.json())
            .then(d => { setItems(d.knowledge || []); setLoading(false); })
            .catch(() => setLoading(false));
    }, [userId]);

    const handleSave = async () => {
        if (!title.trim() || !content.trim()) return toast.error("Llena ambos campos");
        setSaving(true);
        try {
            const res = await fetch('/api/ai-knowledge', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, title, content })
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            setItems([data.knowledge, ...items]);
            setTitle('');
            setContent('');
            toast.success("Conocimiento añadido");
        } catch {
            toast.error("Error al guardar");
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        try {
            await fetch(`/api/ai-knowledge?id=${id}&userId=${userId}`, { method: 'DELETE' });
            setItems(items.filter(i => i.id !== id));
            toast.success("Conocimiento eliminado");
        } catch {
            toast.error("Error al eliminar");
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4 backdrop-blur-sm"
        >
            <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-white dark:bg-zinc-900 w-full max-w-md rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[85vh]"
            >
                <div className="flex items-center justify-between p-4 border-b border-border">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                            <BookOpen className="w-4 h-4" />
                        </div>
                        <div>
                            <h3 className="font-bold text-sm">Base de Conocimiento</h3>
                            <p className="text-[10px] text-muted-foreground">Enseña datos a Quioba</p>
                        </div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8"><X className="w-4 h-4" /></Button>
                </div>
                <div className="p-4 overflow-y-auto space-y-4">
                    {/* Banner informativo sobre sincronización */}
                    <div className="flex items-start gap-2.5 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/50 rounded-xl p-3">
                        <span className="text-base mt-0.5">☁️</span>
                        <div>
                            <p className="text-[11px] font-semibold text-amber-800 dark:text-amber-300 mb-0.5">
                                Sincronizado entre dispositivos
                            </p>
                            <p className="text-[10px] text-amber-700/80 dark:text-amber-400/70 leading-relaxed">
                                Tu conocimiento personal se guarda en la nube y estará disponible en todos tus dispositivos (PC, móvil, tablet). Solo tú y tu IA pueden verlo.
                            </p>
                        </div>
                    </div>

                    <div className="space-y-3 bg-muted/50 p-3 rounded-xl">
                        <h4 className="text-xs font-semibold">Añadir nuevo dato</h4>
                        <input
                            placeholder="Título (ej: Mi número de socio)"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="w-full text-sm rounded-lg px-3 py-2 border border-border bg-background"
                        />
                        <textarea
                            placeholder="Contenido (ej: 48923-A)"
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            className="w-full text-sm rounded-lg px-3 py-2 border border-border bg-background min-h-[80px]"
                        />
                        <Button
                            onClick={handleSave}
                            disabled={saving}
                            className="w-full h-8 text-xs bg-blue-600 hover:bg-blue-700 text-white"
                        >
                            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3 mr-1" />}
                            Guardar Conocimiento
                        </Button>
                    </div>

                    <div>
                        <h4 className="text-xs font-semibold mb-2">Conocimiento Guardado</h4>
                        {loading ? (
                            <div className="flex justify-center p-4"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>
                        ) : items.length === 0 ? (
                            <p className="text-xs text-muted-foreground text-center py-4">No le has enseñado nada interesante aún.</p>
                        ) : (
                            <div className="space-y-2">
                                {items.map(item => (
                                    <div key={item.id} className="bg-background border border-border rounded-xl p-3 flex flex-col gap-1 relative group">
                                        <h5 className="text-sm font-semibold pr-6">{item.title}</h5>
                                        <p className="text-xs text-muted-foreground whitespace-pre-wrap">{item.content}</p>
                                        <button
                                            onClick={() => handleDelete(item.id)}
                                            className="absolute top-2 right-2 p-1.5 text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-md transition-colors"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </motion.div>
        </motion.div>
    );
}

export default function AiPanel() {
    const { isOpen, setIsOpen, width, isWakeWordEnabled, pendingPrompt, setPendingPrompt } = useAi();
    const { user } = useAuth();
    const pathname = usePathname();
    const isSecretaryContext = pathname?.includes('/apps/organizador');

    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [listening, setListening] = useState(false);
    const [voiceMode, setVoiceMode] = useState(false); // toggle texto/voz
    const [speaking, setSpeaking] = useState(false);
    const [waitingForMic, setWaitingForMic] = useState(false);
    const [showKnowledge, setShowKnowledge] = useState(false);
    const bottomRef = useRef<HTMLDivElement>(null);

    // Contexto de secretaria
    const secretarySettings = getSecretarySettings();
    const assistantProfile = getAvatarById(secretarySettings.avatarId);
    const assistantName = 'Quioba';
    const assistantEmoji = assistantProfile.emoji;

    const voiceModeRef = useRef(voiceMode);
    useEffect(() => { voiceModeRef.current = voiceMode; }, [voiceMode]);

    const isOpenRef = useRef(isOpen);
    useEffect(() => { isOpenRef.current = isOpen; }, [isOpen]);

    const listeningRef = useRef(listening);
    useEffect(() => { listeningRef.current = listening; }, [listening]);

    const loadingRef = useRef(loading);
    useEffect(() => { loadingRef.current = loading; }, [loading]);

    const messagesRef = useRef(messages);
    useEffect(() => { messagesRef.current = messages; }, [messages]);

    const cancelRef = useRef(false);

    // ── Pre-rellenar prompt desde contexto ─────────────────────────────
    useEffect(() => {
        if (pendingPrompt && isOpen) {
            const prompt = pendingPrompt;

            // Un pequeño delay para asegurar que el panel ha terminado de montar/animar
            setTimeout(() => {
                sendMessageWithText(prompt);
                setPendingPrompt(null);
            }, 600);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pendingPrompt, isOpen]);

    // ── Enviar mensaje (acepta texto directo o usa el input) ──────────
    const sendMessageWithText = async (text: string) => {
        if (!text.trim() || loading) return;
        const userMsg = text.trim();
        setInput('');

        // Guardamos el historial actual ANTES de actualizar el estado para evitar duplicados
        const currentHistory = [...messagesRef.current];

        setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
        setLoading(true);

        try {
            toast.loading("Quioba está pensando...", { id: 'ai-loading' });

            // Obtener contexto de secretaria
            const settings = getSecretarySettings();

            const response = await fetch('/api/ai-chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: [...currentHistory, { role: 'user', content: userMsg }],
                    userId: user?.id,
                    secretarySettings: settings
                    // Eliminamos todaySyncStatus del cliente, la API lo consultará si es necesario o usaremos el userId
                }),
            });

            if (!response.ok) throw new Error("Error en la respuesta del servidor");

            const data = await response.json();
            const reply = data.reply;
            toast.dismiss('ai-loading');
            setMessages(prev => [...prev, { role: 'assistant', content: reply }]);

            // Leer en voz alta si voiceMode está activo
            if (voiceMode) {
                try {
                    const parsed = JSON.parse(reply);
                    if (parsed.type === 'text') speak(parsed.content);
                    else if (parsed.type === 'list') speak(`Tu ${parsed.title} tiene ${parsed.items.length} elementos.`);
                } catch {
                    speak(reply);
                }
            }
        } catch (err) {
            console.error("AiPanel sendMessage error:", err);
            setMessages(prev => [...prev, { role: 'assistant', content: JSON.stringify({ type: 'text', content: 'Lo siento, no he podido conectar con el cerebro de Quioba. Prueba de nuevo en un momento.' }) }]);
        } finally {
            setLoading(false);
        }
    };

    const sendMessage = () => sendMessageWithText(input);

    const startListening = () => {
        if (listeningRef.current || !isOpenRef.current) {
            setWaitingForMic(false);
            return;
        }
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SpeechRecognition) {
            toast.error('Tu navegador no soporta reconocimiento de voz');
            setWaitingForMic(false);
            return;
        }
        const recognition = new SpeechRecognition();
        recognition.lang = 'es-ES';
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.onstart = () => {
            setListening(true);
            setWaitingForMic(false);
        };
        recognition.onend = () => {
            setListening(false);
            setWaitingForMic(false);
        };
        recognition.onresult = (e: any) => {
            const transcript = e.results[0][0].transcript;
            sendMessageWithText(transcript);
        };
        recognition.onerror = () => {
            setListening(false);
            setWaitingForMic(false);
        };
        try {
            recognition.start();
        } catch (e) {
            setListening(false);
            setWaitingForMic(false);
        }
    };

    // Wake word — escuchar "Quioba" continuamente
    const handleWakeWord = () => {
        playWakeBeep(); // <--- Emite pitido de confirmación

        setVoiceMode(true);
        if (!isOpen) {
            setIsOpen(true);
            setTimeout(() => startListening(), 800);
        } else {
            // Ya está abierto, solo reactivamos el dictado
            startListening();
        }
    };

    useWakeWord({
        onWakeWord: handleWakeWord,
        enabled: isWakeWordEnabled,
        paused: listening || speaking || waitingForMic,  // Solo pausa si ya te está escuchando o si ella misma está hablando
    });

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // ── Síntesis de voz ───────────────────────────────────────────────
    const speak = (text: string) => {
        if (!window.speechSynthesis) return;
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'es-ES';
        utterance.rate = 0.95;
        utterance.pitch = 1.1;

        // Buscar la voz española más natural disponible
        const voices = window.speechSynthesis.getVoices();
        const preferred = voices.find(v => v.name.includes('Monica') || v.name.includes('Paulina') || v.name.includes('Jorge'));
        const spanish = preferred || voices.find(v => v.lang === 'es-ES') || voices.find(v => v.lang.startsWith('es'));
        if (spanish) utterance.voice = spanish;

        // Solución técnica: guardar la referencia globalmente evita que el garbage collector la destruya en Chrome
        (window as any).__quiobaVoiceUtterance = utterance;

        cancelRef.current = false;
        utterance.onstart = () => setSpeaking(true);
        utterance.onend = () => {
            setSpeaking(false);

            if (!voiceModeRef.current || !isOpenRef.current || cancelRef.current) {
                toast.error(`Debug 1: voice=${voiceModeRef.current}, open=${isOpenRef.current}, cancel=${cancelRef.current}`);
            }

            if (voiceModeRef.current && isOpenRef.current && !cancelRef.current) {
                setWaitingForMic(true);
                setTimeout(() => {
                    if (listeningRef.current || loadingRef.current) {
                        toast.error(`Debug 2: listening=${listeningRef.current}, loading=${loadingRef.current}`);
                        setWaitingForMic(false);
                    } else {
                        toast("🎤 Te toca, dime...", { position: 'top-center' });
                        startListening();
                    }
                }, 1000); // 1000ms delay to ensure Chrome TTS audio hardware releases the microphone
            }
        };
        window.speechSynthesis.speak(utterance);
    };

    const stopSpeaking = () => {
        cancelRef.current = true;
        window.speechSynthesis?.cancel();
        setSpeaking(false);
        setWaitingForMic(false);
    };

    return (
        <>
            {/* Modal de Conocimiento (Z-index superior) */}
            <AnimatePresence>
                {showKnowledge && user?.id && (
                    <KnowledgeModal userId={user.id} onClose={() => setShowKnowledge(false)} />
                )}
            </AnimatePresence>

            <AnimatePresence>
                {isOpen && (
                    <>
                        {/* Overlay para oscurecer la parte superior en móvil y poder cerrar al pulsar fuera */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsOpen(false)}
                            className="fixed inset-0 bg-black/20 dark:bg-black/40 z-[55] md:hidden backdrop-blur-sm"
                        />
                        <motion.div
                            initial={{ opacity: 0, y: '100%' }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: '100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                            style={{ '--ai-desktop-width': `${width}%` } as React.CSSProperties}
                            className="fixed bottom-0 left-0 right-0 h-[60vh] md:h-full md:top-0 md:bottom-auto md:left-auto md:w-[var(--ai-desktop-width)] border-t md:border-t-0 md:border-l shadow-2xl z-[60] flex flex-col rounded-t-[2rem] md:rounded-none overflow-hidden bg-background border-border"
                        >
                            {/* Header */}
                            <div className="flex items-center justify-between p-3 border-b shrink-0 bg-muted/30 border-border">
                                <div className="flex items-center gap-2 shrink-0">
                                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-xl shadow-sm shrink-0 bg-background border border-border">
                                        {assistantEmoji}
                                    </div>
                                    <div>
                                        <h2 className="font-bold text-sm leading-tight">{assistantName}</h2>
                                        <p className="text-[10px] text-muted-foreground">Asistente IA</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1">
                                    {/* Enseñar — solo icono */}
                                    <button
                                        onClick={() => setShowKnowledge(true)}
                                        className="w-7 h-7 flex items-center justify-center rounded-full transition-colors bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-900/60"
                                        title="Enseñar a Quioba"
                                    >
                                        <BookOpen className="w-3.5 h-3.5" />
                                    </button>
                                    {/* Planificar — solo icono */}
                                    <Link
                                        href="/apps/organizador"
                                        title="Planificar con Quioba"
                                        onClick={() => setIsOpen(false)}
                                        className="w-7 h-7 flex items-center justify-center rounded-full transition-colors bg-indigo-100 text-indigo-700 hover:bg-indigo-200 dark:bg-indigo-900/40 dark:text-indigo-300 dark:hover:bg-indigo-900/60"
                                    >
                                        <CalendarDays className="w-3.5 h-3.5" />
                                    </Link>
                                    {/* Toggle texto/voz */}
                                    <button
                                        onClick={() => {
                                            setVoiceMode(v => !v);
                                            if (speaking) stopSpeaking();
                                        }}
                                        className={`w-7 h-7 flex items-center justify-center rounded-full transition-colors ${voiceMode
                                            ? 'bg-green-100 text-green-900 dark:bg-green-950/40 dark:text-green-300'
                                            : 'bg-slate-100 text-slate-500 dark:bg-zinc-800 dark:text-zinc-400'
                                            }`}
                                        title={voiceMode ? 'Modo voz activo — pulsa para desactivar' : 'Activar respuestas por voz'}
                                    >
                                        {voiceMode ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
                                    </button>
                                    {/* Parar voz */}
                                    {speaking && (
                                        <button
                                            onClick={stopSpeaking}
                                            className="w-7 h-7 flex items-center justify-center rounded-full bg-red-100 text-red-500 hover:bg-red-200 transition-colors"
                                            title="Parar voz"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                                                <rect x="6" y="6" width="12" height="12" rx="2" />
                                            </svg>
                                        </button>
                                    )}
                                    <button
                                        onClick={() => {
                                            if (confirm('¿Vaciar conversación?')) setMessages([]);
                                        }}
                                        className="w-7 h-7 flex items-center justify-center rounded-full transition-colors bg-slate-100 hover:bg-rose-100 text-slate-500 hover:text-rose-600 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-rose-900/30"
                                        title="Nueva conversación"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => setIsOpen(false)}
                                        className="h-7 w-7"
                                    >
                                        <X className="w-4 h-4" />
                                    </Button>
                                </div>
                            </div>

                            {/* Mensajes */}
                            <div className={`flex-1 overflow-y-auto p-4 space-y-3 ${isSecretaryContext ? 'scrollbar-thin scrollbar-thumb-indigo-800' : ''}`}>
                                {messages.length === 0 && (
                                    <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground gap-4">
                                        <div className={`w-16 h-16 rounded-3xl flex items-center justify-center text-4xl shadow-sm animate-bounce-subtle ${isSecretaryContext ? 'bg-indigo-900/40 border border-indigo-800' : 'bg-muted border border-border'
                                            }`}>
                                            {assistantEmoji}
                                        </div>
                                        <p className={`text-sm max-w-[200px] ${isSecretaryContext ? 'text-indigo-200/50' : ''}`}>
                                            ¡Hola! Soy {assistantName}. ¿En qué te ayudo hoy?
                                        </p>
                                        {voiceMode && (
                                            <p className="text-[10px] text-green-800 dark:text-green-400">🔊 Modo voz activo — te responderé en voz alta</p>
                                        )}
                                    </div>
                                )}
                                {messages.map((msg, i) => (
                                    <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${msg.role === 'user'
                                            ? 'bg-green-500 text-white rounded-br-sm'
                                            : 'bg-muted text-foreground rounded-bl-sm'
                                            }`}>
                                            {msg.role === 'assistant' ? (
                                                <AiReply content={msg.content} userId={user?.id || ''} />
                                            ) : (
                                                <p>{msg.content}</p>
                                            )}
                                        </div>
                                    </div>
                                ))}
                                {loading && (
                                    <div className="flex justify-start">
                                        <div className="bg-muted rounded-2xl rounded-bl-sm px-3 py-2 flex items-center gap-2 text-muted-foreground">
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            <span className="text-xs">Pensando...</span>
                                        </div>
                                    </div>
                                )}
                                <div ref={bottomRef} />
                            </div>

                            {/* Input */}
                            <div className="p-3 border-t border-border shrink-0">
                                {/* Indicador modo voz */}
                                {listening && (
                                    <div className="flex items-center justify-center gap-2 mb-2 text-xs font-medium animate-pulse text-red-500">
                                        <div className="w-2 h-2 rounded-full bg-red-500" />
                                        Escuchando... habla ahora
                                    </div>
                                )}
                                <div className="flex gap-2 items-center rounded-2xl px-3 py-2 bg-muted">
                                    <input
                                        className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground text-foreground"
                                        placeholder={listening ? 'Escuchando...' : 'Escríbeme algo...'}
                                        value={input}
                                        onChange={e => setInput(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && sendMessage()}
                                        disabled={loading || listening}
                                    />
                                    {/* Micrófono */}
                                    <button
                                        onClick={startListening}
                                        disabled={loading || listening}
                                        className={`w-7 h-7 flex items-center justify-center rounded-full transition-colors shrink-0 ${listening
                                            ? 'bg-red-500 animate-pulse text-white'
                                            : 'bg-slate-200 hover:bg-slate-300 dark:bg-zinc-700 dark:text-zinc-300'
                                            }`}
                                        title="Hablar"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                                            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                                            <line x1="12" y1="19" x2="12" y2="23" />
                                            <line x1="8" y1="23" x2="16" y2="23" />
                                        </svg>
                                    </button>
                                    {/* Enviar */}
                                    <button
                                        onClick={sendMessage}
                                        disabled={loading || !input.trim() || listening}
                                        className="w-7 h-7 flex items-center justify-center disabled:opacity-40 rounded-full transition-colors shrink-0 bg-green-500 hover:bg-green-800"
                                    >
                                        <Send className="w-3.5 h-3.5 text-white" />
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

        </>
    );
}


