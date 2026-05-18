'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Pause, Send, Mic, Video, Type, Lock, Shield, Clock, Calendar as CalendarIcon, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageComposer } from '@/components/apps/mi-hogar/confessions/message-composer';
import { PauseDialog } from '@/components/apps/mi-hogar/confessions/pause-dialog-v2';
import { toast } from 'sonner';
import { formatDistanceToNow, format } from 'date-fns';
import { es } from 'date-fns/locale';
import { v4 as uuidv4 } from 'uuid';

type Message = {
    id: string;
    sender_type: 'creator' | 'recipient';
    type: 'text' | 'audio' | 'video';
    content: string;
    created_at: string;
};

type Thought = {
    id: string;
    is_anonymous: boolean;
    creator_name: string | null;
    created_at: string;
    interaction_mode: 'conversation' | 'read_only' | 'app_only';
    unlock_at: string | null;
};

export default function ThoughtClientPage() {
    const params = useParams();
    const token = params?.token as string;

    const [thought, setThought] = useState<Thought | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [isPaused, setIsPaused] = useState(false);
    const [pauseInfo, setPauseInfo] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [sessionId, setSessionId] = useState<string>('');
    const [showPauseDialog, setShowPauseDialog] = useState(false);
    const [hasResponded, setHasResponded] = useState(false);
    const [isLocked, setIsLocked] = useState(false);
    const [timeLeft, setTimeLeft] = useState<{ days: number, hours: number, minutes: number, seconds: number } | null>(null);

    useEffect(() => {
        initSession();
        fetchThought();
    }, [token]);

    const initSession = () => {
        // Get or create session ID for recipient
        let sid = localStorage.getItem(`thought_session_${token}`);
        if (!sid) {
            sid = uuidv4();
            localStorage.setItem(`thought_session_${token}`, sid);
        }
        setSessionId(sid);
    };

    const fetchThought = async () => {
        setIsLoading(true);

        // Get thought by token
        const { data: thoughtData, error: thoughtError } = await supabase
            .rpc('get_thought_by_token', { p_token: token });

        if (thoughtError || !thoughtData || thoughtData.length === 0) {
            toast.error('Pensamiento no encontrado');
            setIsLoading(false);
            return;
        }

        const thoughtInfo = thoughtData[0];
        setThought(thoughtInfo);

        // Check Time Capsule Lock
        if (thoughtInfo.unlock_at) {
            const unlockDate = new Date(thoughtInfo.unlock_at);
            const now = new Date();
            if (now < unlockDate) {
                setIsLocked(true);
                // Start countdown timer
                const updateTimer = () => {
                    const currentNow = new Date();
                    const diff = unlockDate.getTime() - currentNow.getTime();
                    if (diff <= 0) {
                        setIsLocked(false);
                        setTimeLeft(null);
                        return;
                    }
                    setTimeLeft({
                        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
                        hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
                        minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
                        seconds: Math.floor((diff % (1000 * 60)) / 1000)
                    });
                };
                updateTimer();
                const timerInterval = setInterval(updateTimer, 1000);
                setIsLoading(false); // Stop loading to show lock screen
                return () => clearInterval(timerInterval);
            }
        }

        // Get messages only if not locked
        const { data: messagesData } = await supabase
            .from('thought_messages')
            .select('*')
            .eq('thought_id', thoughtInfo.id)
            .order('created_at', { ascending: true });

        if (messagesData) {
            // Process media URLs
            const enriched = await Promise.all(
                messagesData.map(async (msg: any) => {
                    if (msg.type === 'audio' || msg.type === 'video') {
                        const { data: signedUrl } = await supabase.storage
                            .from('confessions')
                            .createSignedUrl(msg.content, 3600);

                        return {
                            ...msg,
                            content: signedUrl?.signedUrl || msg.content
                        };
                    }
                    return msg;
                })
            );
            setMessages(enriched);

            // Check if recipient has responded
            const recipientMsg = enriched.find((m: any) => m.sender_type === 'recipient');
            setHasResponded(!!recipientMsg);
        }

        // Check pause status
        const { data: pauseData } = await supabase
            .from('thought_pauses')
            .select('*')
            .eq('thought_id', thoughtInfo.id)
            .eq('is_active', true)
            .gt('resume_at', new Date().toISOString())
            .single();

        setIsPaused(!!pauseData);
        setPauseInfo(pauseData);

        setIsLoading(false);

        // Subscribe to new messages
        const channel = supabase
            .channel(`thought_${thoughtInfo.id}`)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'thought_messages',
                filter: `thought_id=eq.${thoughtInfo.id}`
            }, (payload) => {
                setMessages(prev => [...prev, payload.new as Message]);
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    };

    const handleSendMessage = async (type: 'text' | 'audio' | 'video', content: string) => {
        if (!thought) return;

        const { error } = await supabase
            .from('thought_messages')
            .insert({
                thought_id: thought.id,
                sender_type: 'recipient',
                sender_session_id: sessionId,
                type,
                content
            });

        if (error) {
            console.error('Error sending message:', error);
            toast.error('Error al enviar mensaje');
        } else {
            setHasResponded(true);
        }
    };

    const handlePause = async (durationHours: number, reason?: string) => {
        if (!thought) return;

        const resumeAt = new Date();
        resumeAt.setHours(resumeAt.getHours() + durationHours);

        const { error } = await supabase
            .from('thought_pauses')
            .insert({
                thought_id: thought.id,
                paused_by: 'recipient',
                resume_at: resumeAt.toISOString(),
                reason
            });

        if (!error) {
            setIsPaused(true);
            setShowPauseDialog(false);
            fetchThought();
        }
    };

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <p className="text-muted-foreground">Cargando...</p>
            </div>
        );
    }

    if (!thought) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <Card className="max-w-md w-full mx-4">
                    <CardContent className="pt-6 text-center">
                        <span className="text-6xl mb-4 block">❌</span>
                        <h2 className="text-xl font-semibold mb-2">Pensamiento no encontrado</h2>
                        <p className="text-muted-foreground">
                            Este enlace no es válido o el pensamiento fue eliminado.
                        </p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (isLocked && thought.unlock_at) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4 text-center">
                <div className="mb-8">
                    <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
                        <Lock className="w-10 h-10 text-primary" />
                    </div>
                    <h1 className="text-3xl font-bold mb-2">Cápsula del Tiempo</h1>
                    <p className="text-muted-foreground max-w-md mx-auto">
                        Este pensamiento está bloqueado hasta el {format(new Date(thought.unlock_at), "PPP 'a las' p", { locale: es })}
                    </p>
                </div>

                {timeLeft && (
                    <div className="grid grid-cols-4 gap-4 mb-8">
                        <div className="bg-muted p-4 rounded-xl min-w-[80px]">
                            <div className="text-3xl font-mono font-bold">{timeLeft.days}</div>
                            <div className="text-xs text-muted-foreground uppercase">Días</div>
                        </div>
                        <div className="bg-muted p-4 rounded-xl min-w-[80px]">
                            <div className="text-3xl font-mono font-bold">{timeLeft.hours}</div>
                            <div className="text-xs text-muted-foreground uppercase">Hs</div>
                        </div>
                        <div className="bg-muted p-4 rounded-xl min-w-[80px]">
                            <div className="text-3xl font-mono font-bold">{timeLeft.minutes}</div>
                            <div className="text-xs text-muted-foreground uppercase">Min</div>
                        </div>
                        <div className="bg-muted p-4 rounded-xl min-w-[80px]">
                            <div className="text-3xl font-mono font-bold">{timeLeft.seconds}</div>
                            <div className="text-xs text-muted-foreground uppercase">Seg</div>
                        </div>
                    </div>
                )}

                <p className="text-sm text-muted-foreground/50">
                    Vuelve cuando el contador llegue a cero.
                </p>
            </div>
        );
    }

    const initialMessage = messages[0];

    return (
        <div className="min-h-screen bg-background flex flex-col">
            {/* Header */}
            <header className="p-4 border-b bg-background/80 backdrop-blur-md sticky top-0 z-10">
                <div className="max-w-4xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-violet-500/10 rounded-lg">
                            <span className="text-2xl">🤔</span>
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h1 className="font-semibold">
                                    {thought.is_anonymous ? 'Pensamiento Anónimo' : thought.creator_name}
                                </h1>
                                {thought.interaction_mode === 'read_only' && (
                                    <Badge variant="secondary" className="gap-1">
                                        <Lock className="w-3 h-3" /> Solo lectura
                                    </Badge>
                                )}
                                {thought.interaction_mode === 'app_only' && (
                                    <Badge variant="secondary" className="gap-1 bg-amber-100 text-amber-800 border-amber-200">
                                        <Shield className="w-3 h-3" /> Solo App
                                    </Badge>
                                )}
                            </div>
                            <p className="text-xs text-muted-foreground">
                                {formatDistanceToNow(new Date(thought.created_at), {
                                    addSuffix: true,
                                    locale: es
                                })}
                            </p>
                        </div>
                    </div>
                    {hasResponded && !isPaused && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setShowPauseDialog(true)}
                        >
                            <Pause className="w-4 h-4 mr-2" />
                            Pausar
                        </Button>
                    )}
                </div>
            </header>

            {/* App Only Alert */}
            {
                thought.interaction_mode === 'app_only' && (
                    <Alert className="m-4 max-w-4xl mx-auto border-amber-200 bg-amber-50">
                        <Shield className="h-4 w-4 text-amber-600" />
                        <AlertDescription className="text-sm text-amber-800 ml-2">
                            <strong>Atención:</strong> El creador pide que esta conversación se mantenga <strong>exclusivamente en esta aplicación</strong>.
                            Por favor, no menciones este tema en persona ni por otros medios.
                        </AlertDescription>
                    </Alert>
                )
            }

            {/* Read Only Alert */}
            {
                thought.interaction_mode === 'read_only' && (
                    <Alert className="m-4 max-w-4xl mx-auto bg-muted/50">
                        <Lock className="h-4 w-4 text-muted-foreground" />
                        <AlertDescription className="text-sm text-muted-foreground ml-2">
                            Este pensamiento es de solo lectura. Puedes verlo pero no responder.
                        </AlertDescription>
                    </Alert>
                )
            }

            {/* Pause Alert */}
            {
                isPaused && pauseInfo && (
                    <Alert className="m-4 max-w-4xl mx-auto border-orange-200 bg-orange-50">
                        <AlertDescription className="text-sm">
                            Esta conversación está pausada hasta el{' '}
                            {new Date(pauseInfo.resume_at).toLocaleString()}.
                            {pauseInfo.reason && (
                                <>
                                    <br />
                                    Motivo: "{pauseInfo.reason}"
                                </>
                            )}
                        </AlertDescription>
                    </Alert>
                )
            }

            {/* Messages */}
            <ScrollArea className="flex-1 p-4">
                <div className="max-w-4xl mx-auto space-y-4">
                    {!hasResponded && initialMessage && (
                        <Card className="bg-violet-50 border-violet-200">
                            <CardContent className="pt-6">
                                <div className="mb-4 text-center">
                                    <span className="text-4xl mb-2 block">💭</span>
                                    <h2 className="font-semibold text-lg">
                                        Alguien compartió un pensamiento contigo
                                    </h2>
                                </div>
                                <div className="bg-white p-4 rounded-lg">
                                    {initialMessage.type === 'text' && (
                                        <p className="whitespace-pre-wrap">{initialMessage.content}</p>
                                    )}
                                    {initialMessage.type === 'audio' && (
                                        <audio controls src={initialMessage.content} className="w-full" />
                                    )}
                                    {initialMessage.type === 'video' && (
                                        <video controls src={initialMessage.content} className="w-full rounded" />
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {hasResponded && messages.map((msg) => (
                        <motion.div
                            key={msg.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className={`flex ${msg.sender_type === 'creator' ? 'justify-start' : 'justify-end'}`}
                        >
                            <div
                                className={`max-w-[70%] rounded-lg p-3 ${msg.sender_type === 'creator'
                                    ? 'bg-muted'
                                    : 'bg-primary text-primary-foreground'
                                    }`}
                            >
                                {msg.type === 'text' && (
                                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                                )}
                                {msg.type === 'audio' && (
                                    <audio controls src={msg.content} className="max-w-full" />
                                )}
                                {msg.type === 'video' && (
                                    <video controls src={msg.content} className="max-w-full rounded" />
                                )}
                                <span className="text-xs opacity-70 mt-1 block">
                                    {formatDistanceToNow(new Date(msg.created_at), {
                                        addSuffix: true,
                                        locale: es
                                    })}
                                </span>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </ScrollArea>

            {/* Message Composer */}
            {
                thought.interaction_mode !== 'read_only' && (
                    <div className="border-t bg-background">
                        <div className="max-w-4xl mx-auto">
                            <MessageComposer
                                onSend={handleSendMessage}
                                disabled={isPaused}
                                placeholder={hasResponded ? undefined : "Escribe tu respuesta..."}
                            />
                        </div>
                    </div>
                )
            }

            {/* Pause Dialog */}
            {
                showPauseDialog && (
                    <PauseDialog
                        isOpen={showPauseDialog}
                        onClose={() => setShowPauseDialog(false)}
                        onConfirm={handlePause}
                    />
                )
            }
        </div >
    );
}
