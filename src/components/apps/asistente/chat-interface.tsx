'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Bot, User, Trash2, Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
    processQuery,
    saveConversation,
    loadConversation,
    clearConversation,
    Message,
    AssistantDataContext
} from './response-engine';
import ReactMarkdown from 'react-markdown';

interface ChatInterfaceProps {
    userId: string;
    userName?: string;
    compact?: boolean;
    initialMessage?: string;
}

export default function ChatInterface({ userId, userName, compact = false, initialMessage = '' }: ChatInterfaceProps) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState(initialMessage);
    const [isLoading, setIsLoading] = useState(false);
    const [isInitialLoading, setIsInitialLoading] = useState(true);
    const scrollRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const handleSend = useCallback(async (textToProcess?: string) => {
        const text = (textToProcess || input).trim();
        if (!text || isLoading) return;

        // Add user message
        const userMessage: Message = {
            id: crypto.randomUUID(),
            role: 'user',
            content: text,
            timestamp: new Date().toISOString(),
        };

        setMessages(prev => [...prev, userMessage]);
        if (!textToProcess) setInput('');
        setIsLoading(true);

        try {
            const ctx: AssistantDataContext = {
                userId,
                userName,
            };

            const response = await processQuery(text, ctx);

            const assistantMessage: Message = {
                id: crypto.randomUUID(),
                role: 'assistant',
                content: response,
                timestamp: new Date().toISOString(),
            };

            setMessages(prev => [...prev, assistantMessage]);
        } catch (error) {
            console.error('Error processing query:', error);
            const errorMessage: Message = {
                id: crypto.randomUUID(),
                role: 'assistant',
                content: '❌ Lo siento, ha ocurrido un error. Por favor, inténtalo de nuevo.',
                timestamp: new Date().toISOString(),
            };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
            if (!textToProcess) {
                setTimeout(() => inputRef.current?.focus(), 100);
            }
        }
    }, [input, isLoading, userId, userName]);

    // Load conversation on mount
    useEffect(() => {
        const loadMessages = async () => {
            try {
                const savedMessages = await loadConversation(userId);
                if (savedMessages.length > 0) {
                    setMessages(savedMessages);
                } else {
                    // Add welcome message
                    const welcomeMessage: Message = {
                        id: crypto.randomUUID(),
                        role: 'assistant',
                        content: compact
                            ? `¡Hola${userName ? `, ${userName}` : ''}! ¿En qué puedo ayudarte?`
                            : `¡Hola${userName ? `, ${userName}` : ''}! 👋 Soy el asistente de Quioba.\n\nPuedo ayudarte a consultar información de tu cuenta. Pregúntame sobre:\n\n• 💰 Mi Economía\n• ✅ Tus tareas pendientes\n• 🛒 Tu lista de la compra\n• 💊 Tus medicamentos\n• Y mucho más...\n\n¿En qué puedo ayudarte?`,
                        timestamp: new Date().toISOString(),
                    };
                    setMessages([welcomeMessage]);
                }

                // If initialMessage was passed, auto-submit it after loading
                if (initialMessage && !isLoading) {
                    // Slight delay to ensure UI is ready
                    setTimeout(() => {
                        handleSend(initialMessage);
                        setInput('');
                    }, 500);
                }

            } catch (error) {
                console.error('Error loading conversation:', error);
            } finally {
                setIsInitialLoading(false);
            }
        };

        loadMessages();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userId, userName, compact, initialMessage]);

    // Auto-scroll to bottom
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    // Save messages when they change
    useEffect(() => {
        if (messages.length > 0 && !isInitialLoading) {
            saveConversation(userId, messages);
        }
    }, [messages, userId, isInitialLoading]);

    const handleClearConversation = async () => {
        await clearConversation(userId);
        const welcomeMessage: Message = {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: '🗑️ Conversación borrada.\n\n¿En qué puedo ayudarte?',
            timestamp: new Date().toISOString(),
        };
        setMessages([welcomeMessage]);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    // Quick action buttons
    const quickActions = [
        { label: '💰 Mi Economía', query: '¿Cómo está mi economía?' },
        { label: '✅ Tareas', query: '¿Qué tareas tengo pendientes?' },
        { label: '🛒 Compras', query: '¿Qué tengo que comprar?' },
        { label: '💊 Medicamentos', query: '¿Qué medicamentos tengo?' },
    ];

    if (isInitialLoading) {
        return (
            <div className="flex flex-col items-center justify-center h-full gap-2">
                <Loader2 className={`${compact ? 'w-5 h-5' : 'w-8 h-8'} animate-spin text-primary`} />
                {!compact && <p className="text-muted-foreground">Cargando conversación...</p>}
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-background">
            {/* Header - only show when not compact */}
            {!compact && (
                <div className="flex items-center justify-between px-4 py-3 border-b bg-card">
                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <Avatar className="w-10 h-10 bg-gradient-to-br from-violet-500 to-purple-600">
                                <AvatarFallback>
                                    <Bot className="w-5 h-5 text-white" />
                                </AvatarFallback>
                            </Avatar>
                            <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-background" />
                        </div>
                        <div>
                            <h2 className="font-semibold">Asistente Quioba</h2>
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                                <Sparkles className="w-3 h-3" />
                                Consulta tus datos fácilmente
                            </p>
                        </div>
                    </div>

                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" title="Borrar conversación">
                                <Trash2 className="w-4 h-4 text-muted-foreground" />
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>¿Borrar conversación?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    Se eliminará todo el historial de esta conversación. Esta acción no se puede deshacer.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={handleClearConversation}>
                                    Borrar
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </div>
            )}

            {/* Messages */}
            <ScrollArea className={`flex-1 ${compact ? 'p-2' : 'p-4'}`} ref={scrollRef}>
                <div className="space-y-4 max-w-3xl mx-auto">
                    <AnimatePresence initial={false}>
                        {messages.map((message) => (
                            <motion.div
                                key={message.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className={`flex gap-3 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}
                            >
                                <Avatar className={`w-8 h-8 shrink-0 ${message.role === 'assistant'
                                    ? 'bg-gradient-to-br from-violet-500 to-purple-600'
                                    : 'bg-gradient-to-br from-blue-500 to-cyan-500'
                                    }`}>
                                    <AvatarFallback>
                                        {message.role === 'assistant'
                                            ? <Bot className="w-4 h-4 text-white" />
                                            : <User className="w-4 h-4 text-white" />
                                        }
                                    </AvatarFallback>
                                </Avatar>

                                <div className={`max-w-[80%] ${message.role === 'user' ? 'text-right' : ''}`}>
                                    <div className={`inline-block px-4 py-2 rounded-2xl ${message.role === 'user'
                                        ? 'bg-primary text-primary-foreground rounded-br-md'
                                        : 'bg-muted rounded-bl-md'
                                        }`}>
                                        {message.role === 'assistant' ? (
                                            <div className="prose prose-sm dark:prose-invert max-w-none">
                                                <ReactMarkdown
                                                    components={{
                                                        p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                                                        strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                                                        ul: ({ children }) => <ul className="list-disc list-inside mb-2">{children}</ul>,
                                                        li: ({ children }) => <li className="mb-0.5">{children}</li>,
                                                    }}
                                                >
                                                    {message.content}
                                                </ReactMarkdown>
                                            </div>
                                        ) : (
                                            <p className="text-sm">{message.content}</p>
                                        )}
                                    </div>
                                    <p className="text-[10px] text-muted-foreground mt-1 px-1">
                                        {new Date(message.timestamp).toLocaleTimeString('es-ES', {
                                            hour: '2-digit',
                                            minute: '2-digit',
                                        })}
                                    </p>
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>

                    {/* Loading indicator */}
                    {isLoading && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="flex gap-3"
                        >
                            <Avatar className="w-8 h-8 bg-gradient-to-br from-violet-500 to-purple-600">
                                <AvatarFallback>
                                    <Bot className="w-4 h-4 text-white" />
                                </AvatarFallback>
                            </Avatar>
                            <div className="bg-muted px-4 py-3 rounded-2xl rounded-bl-md">
                                <div className="flex gap-1">
                                    <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                    <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                    <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                </div>
                            </div>
                        </motion.div>
                    )}
                </div>

                {/* Quick actions (only show when few messages and NOT compact) */}
                {!compact && messages.length <= 2 && !isLoading && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex flex-wrap gap-2 justify-center mt-6 max-w-3xl mx-auto"
                    >
                        {quickActions.map((action) => (
                            <Button
                                key={action.label}
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                    setInput(action.query);
                                    inputRef.current?.focus();
                                }}
                                className="text-xs"
                            >
                                {action.label}
                            </Button>
                        ))}
                    </motion.div>
                )}
            </ScrollArea>

            {/* Input */}
            <div className={`border-t bg-card ${compact ? 'p-2' : 'p-4'}`}>
                <div className="max-w-3xl mx-auto flex gap-2">
                    <Input
                        ref={inputRef}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={compact ? "Pregunta..." : "Escribe tu pregunta..."}
                        disabled={isLoading}
                        className={`flex-1 ${compact ? 'h-9 text-sm' : ''}`}
                    />
                    <Button
                        onClick={() => handleSend()}
                        disabled={!input.trim() || isLoading}
                        size={compact ? "sm" : "icon"}
                    >
                        {isLoading ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Send className="w-4 h-4" />
                        )}
                    </Button>
                </div>
            </div>
        </div>
    );
}
